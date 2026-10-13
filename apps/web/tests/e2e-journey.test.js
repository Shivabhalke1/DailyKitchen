import test from 'node:test';
import assert from 'node:assert/strict';

const WEB_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8000/api/v1';

test('DailyKitchen End-to-End Customer Journey Verification', async (t) => {
  let sessionCookie = '';
  let accessToken = '';
  let createdOrderId = '';
  let variantId = '';
  let slotId = '';
  let addressId = '';
  // Unique valid Indian mobile number (+9198...) to prevent OTP rate-limit cooldown conflicts
  const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  await t.test('1. Next.js Web Shell renders successfully', async () => {
    const res = await fetch(`${WEB_URL}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /DailyKitchen/i);
  });

  await t.test('2. Initial Next.js BFF session is unauthenticated', async () => {
    const res = await fetch(`${WEB_URL}/api/auth/session`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.authenticated, false);
  });

  await t.test('3. Pincode Serviceability Check (Authoritative API)', async () => {
    // Serviceable PIN
    const resValid = await fetch(`${API_URL}/delivery/zones/check?pincode=560034`);
    assert.equal(resValid.status, 200);
    const dataValid = await resValid.json();
    assert.equal(dataValid.is_serviceable, true);
    assert.ok(dataValid.zone);

    // Unserviceable PIN
    const resInvalid = await fetch(`${API_URL}/delivery/zones/check?pincode=999999`);
    assert.equal(resInvalid.status, 200);
    const dataInvalid = await resInvalid.json();
    assert.equal(dataInvalid.is_serviceable, false);
  });

  await t.test('4. Authentication flow: OTP challenge + verification + BFF HttpOnly Cookie', async () => {
    // Request OTP
    const otpRes = await fetch(`${API_URL}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, purpose: 'login' }),
    });
    assert.equal(otpRes.status, 200);

    // Verify OTP with dev seed (1234)
    const verifyRes = await fetch(`${API_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, otp: '1234', purpose: 'login' }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyEnvelope = await verifyRes.json();
    assert.equal(verifyEnvelope.success, true);
    const tokenData = verifyEnvelope.data;
    assert.ok(tokenData.access_token);
    assert.ok(tokenData.refresh_token);
    accessToken = tokenData.access_token;

    // Send tokens to Next.js BFF to establish HttpOnly session cookie
    const bffRes = await fetch(`${WEB_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: tokenData.user,
      }),
    });
    assert.equal(bffRes.status, 200);

    // Inspect Set-Cookie header for security flags
    const rawCookie = bffRes.headers.get('set-cookie');
    assert.ok(rawCookie, 'Expected Set-Cookie header from BFF');
    assert.match(rawCookie, /dk_refresh_token=/);
    assert.match(rawCookie, /HttpOnly/i);
    assert.match(rawCookie, /SameSite=Strict/i);

    // Extract cookie value for subsequent requests
    sessionCookie = rawCookie.split(';')[0];
  });

  await t.test('5. Verify authenticated session resolution through Next.js BFF', async () => {
    const res = await fetch(`${WEB_URL}/api/auth/session`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.authenticated, true);
    assert.ok(data.user);
    assert.equal(data.user.phone, testPhone);
  });

  await t.test('6. Fetch Catalog & Delivery Slots', async () => {
    // Categories
    const catRes = await fetch(`${API_URL}/catalog/categories`);
    assert.equal(catRes.status, 200);
    const categories = await catRes.json();
    assert.ok(Array.isArray(categories));
    assert.ok(categories.length > 0);

    // Products (Paginated)
    const prodRes = await fetch(`${API_URL}/catalog/products`);
    assert.equal(prodRes.status, 200);
    const prodData = await prodRes.json();
    assert.ok(Array.isArray(prodData.items));
    assert.ok(prodData.items.length > 0);

    const firstAvailable = prodData.items.find((p) => p.variants?.some((v) => v.is_available));
    assert.ok(firstAvailable, 'Expected at least one produce product with an available variant');
    variantId = firstAvailable.variants.find((v) => v.is_available).id;

    // Delivery Slots
    const slotRes = await fetch(`${API_URL}/delivery/slots`);
    assert.equal(slotRes.status, 200);
    const slots = await slotRes.json();
    assert.ok(Array.isArray(slots));
    assert.ok(slots.length > 0);
    slotId = slots[0].id;
  });

  await t.test('7. Cart Mutations & Authoritative Pricing Rule Verification', async () => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    // Add produce variant to cart
    const addRes = await fetch(`${API_URL}/cart/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    });
    assert.equal(addRes.status, 200);
    const cart = await addRes.json();

    assert.ok(cart.items.length > 0);
    assert.ok(cart.pricing, 'Expected authoritative pricing summary');

    // Rule 1: Packaging fee is strictly ₹10.00
    assert.equal(Number(cart.pricing.packaging_fee), 10.0);

    // Rule 2: Free delivery threshold is ₹99.00
    const subtotal = Number(cart.pricing.subtotal);
    if (subtotal >= 99) {
      assert.equal(Number(cart.pricing.delivery_fee), 0.0);
      assert.equal(cart.pricing.is_free_delivery, true);
    } else {
      assert.equal(Number(cart.pricing.delivery_fee), 40.0);
      assert.equal(cart.pricing.is_free_delivery, false);
    }
  });

  await t.test('8. Setup Customer Address & Place Server-Authoritative Order', async () => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    // Create delivery address using authoritative schema (label: 'home')
    const addrRes = await fetch(`${API_URL}/users/me/addresses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        full_name: 'Shiva Customer',
        phone: testPhone,
        house_flat: 'Flat 402, Green Garden',
        street_area: '80 Feet Road, 4th Block',
        landmark: 'Near Sony World Signal',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        label: 'home',
        is_default: true,
      }),
    });
    assert.equal(addrRes.status, 201);
    const addrEnvelope = await addrRes.json();
    assert.equal(addrEnvelope.success, true);
    addressId = addrEnvelope.data.id;
    assert.ok(addressId);

    // Place Order via Server Checkout
    const orderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        address_id: addressId,
        slot_id: slotId,
        payment_method: 'cod',
      }),
    });
    const errBody = await orderRes.text();
    console.log('ORDER RES STATUS:', orderRes.status, 'BODY:', errBody);
    assert.equal(orderRes.status, 201);
    const order = JSON.parse(errBody);
    assert.ok(order.id);
    assert.ok(order.order_number);
    assert.ok(['placed', 'confirmed'].includes(order.status));
    assert.ok(order.address_snapshot);
    assert.equal(order.address_snapshot.pincode, '560034');
    assert.ok(order.items.length > 0);
    createdOrderId = order.id;
  });

  await t.test('9. Order Tracking & Lifecycle Verification', async () => {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    const getRes = await fetch(`${API_URL}/orders/${createdOrderId}`, { headers });
    assert.equal(getRes.status, 200);
    const order = await getRes.json();
    assert.equal(order.id, createdOrderId);
    assert.ok(['placed', 'confirmed'].includes(order.status));
    assert.equal(order.payment_method, 'cod');
    assert.equal(order.payment_status, 'pending');
    assert.ok(order.items[0].product_name_snap);
    assert.ok(order.items[0].line_total);
  });

  await t.test('10. Logout and Session Invalidation via Next.js BFF', async () => {
    const logoutRes = await fetch(`${WEB_URL}/api/auth/session`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });
    assert.equal(logoutRes.status, 200);

    const clearedCookie = logoutRes.headers.get('set-cookie');
    assert.ok(clearedCookie);
    assert.ok(clearedCookie.includes('dk_refresh_token='));
    assert.ok(clearedCookie.includes('1970') || clearedCookie.toLowerCase().includes('max-age=0'));

    // Verify subsequent session query returns unauthenticated
    const checkRes = await fetch(`${WEB_URL}/api/auth/session`, {
      headers: { Cookie: 'dk_refresh_token=' },
    });
    assert.equal(checkRes.status, 200);
    const checkData = await checkRes.json();
    assert.equal(checkData.authenticated, false);
  });
});

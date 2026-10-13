import test from 'node:test';
import assert from 'node:assert/strict';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api/v1';

test('DailyKitchen Mobile Customer Journey & Security Verification', async (t) => {
  let userAccessToken = '';
  let userRefreshToken = '';
  let testOrderId = '';
  let slotId = '';
  let variantId = '';
  let addressId = '';

  const testPhone = `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;

  await t.test('1. Mobile Pincode Serviceability Check', async () => {
    const res = await fetch(`${API_BASE_URL}/delivery/zones/check?pincode=560034`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.is_serviceable, true);
    assert.equal(data.pincode, '560034');
    assert.equal(typeof data.zone?.name, 'string');
  });

  await t.test('2. Mobile OTP Challenge and Verification', async () => {
    // Request OTP
    const reqRes = await fetch(`${API_BASE_URL}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, purpose: 'login' }),
    });
    assert.equal(reqRes.status, 200);

    // Verify with test OTP 1234
    const verifyRes = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, otp: '1234', purpose: 'login' }),
    });
    assert.equal(verifyRes.status, 200);
    const envelope = await verifyRes.json();
    assert.equal(envelope.success, true);
    const authData = envelope.data;
    assert.ok(authData.access_token, 'Access token must be returned');
    assert.ok(authData.refresh_token, 'Refresh token must be returned');
    assert.equal(authData.token_type, 'bearer');
    assert.ok(authData.user?.id);

    userAccessToken = authData.access_token;
    userRefreshToken = authData.refresh_token;
  });

  await t.test('3. Mobile Token Refresh Rotation Contract & Replay Protection', async () => {
    const oldRefreshToken = userRefreshToken;

    // 1st Refresh: succeeds and rotates
    const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: oldRefreshToken }),
    });
    assert.equal(refreshRes.status, 200);
    const envelope = await refreshRes.json();
    assert.equal(envelope.success, true);
    const refreshed = envelope.data;
    assert.ok(refreshed.access_token);
    assert.ok(refreshed.refresh_token);
    // Refresh token must be rotated
    assert.notEqual(refreshed.refresh_token, oldRefreshToken);

    // Update in-memory credentials
    userAccessToken = refreshed.access_token;
    userRefreshToken = refreshed.refresh_token;

    // 2nd Replay attempt with old token must be blocked by replay detector
    const replayRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: oldRefreshToken }),
    });
    assert.equal(replayRes.status, 401);
    const replayError = await replayRes.json();
    assert.match(replayError.detail, /replay detected/i);
  });

  await t.test('4. Fetch Produce Catalog & Delivery Slots', async () => {
    // Categories
    const catRes = await fetch(`${API_BASE_URL}/catalog/categories`);
    assert.equal(catRes.status, 200);
    const categories = await catRes.json();
    assert.ok(Array.isArray(categories) && categories.length > 0);

    // Products
    const prodRes = await fetch(`${API_BASE_URL}/catalog/products?page=1&page_size=20`);
    assert.equal(prodRes.status, 200);
    const productsData = await prodRes.json();
    assert.ok(productsData.items.length > 0);
    const itemWithVariant = productsData.items.find((p) => p.variants && p.variants.length > 0);
    assert.ok(itemWithVariant && itemWithVariant.variants.length > 0, 'Must find product with variants');
    variantId = itemWithVariant.variants[0].id;

    // Delivery Slots
    const slotRes = await fetch(`${API_BASE_URL}/delivery/slots`);
    assert.equal(slotRes.status, 200);
    const slots = await slotRes.json();
    assert.ok(Array.isArray(slots) && slots.length > 0);
    slotId = slots[0].id;
  });

  await t.test('5. Cart Operations & Authoritative Pricing Breakdown', async () => {
    // Add item to cart
    const addRes = await fetch(`${API_BASE_URL}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    });
    assert.equal(addRes.status, 200);
    const cart = await addRes.json();
    assert.ok(cart.pricing);

    // Verify pricing rules: packaging fee is exactly ₹10
    assert.equal(Number(cart.pricing.packaging_fee), 10);
    const subtotal = Number(cart.pricing.subtotal);
    if (subtotal < 99) {
      assert.equal(Number(cart.pricing.delivery_fee), 40);
      assert.equal(cart.pricing.is_free_delivery, false);
      assert.equal(Number(cart.pricing.total), subtotal + 40 + 10);
    } else {
      assert.equal(Number(cart.pricing.delivery_fee), 0);
      assert.equal(cart.pricing.is_free_delivery, true);
      assert.equal(Number(cart.pricing.total), subtotal + 0 + 10);
    }
  });

  await t.test('6. Address Management & Server-Authoritative Checkout', async () => {
    // Create delivery address
    const addrRes = await fetch(`${API_BASE_URL}/users/me/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        full_name: 'Mobile Customer',
        phone: testPhone,
        house_flat: 'Villa 108, Palm Meadows',
        street_area: 'Whitefield Main Road',
        landmark: 'Opposite Forum Mall',
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

    // Place server-authoritative order
    const orderRes = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        slot_id: slotId,
        address_id: addressId,
        payment_method: 'cod',
      }),
    });
    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.ok(order.id);
    assert.ok(order.order_number.startsWith('DK-'));
    assert.equal(order.status, 'placed');
    assert.equal(Number(order.packaging_fee), 10);
    assert.ok(order.items && order.items.length > 0);
    assert.equal(order.items[0].variant_id, variantId);

    testOrderId = order.id;
  });

  await t.test('7. Order Details & Immutable Snapshot Tracking', async () => {
    const res = await fetch(`${API_BASE_URL}/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    assert.equal(res.status, 200);
    const order = await res.json();
    assert.equal(order.id, testOrderId);
    assert.equal(order.status, 'placed');
    assert.ok(order.address_snapshot);
    assert.equal(order.address_snapshot.pincode, '560034');
    assert.ok(order.items[0].product_name_snap);
    assert.ok(order.items[0].weight_label_snap);
  });
});

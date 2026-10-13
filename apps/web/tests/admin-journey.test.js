import test from 'node:test';
import assert from 'node:assert/strict';

const WEB_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8000/api/v1';

async function parseJson(res) {
  const json = await res.json();
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

test('DailyKitchen Phase 7: Backoffice Admin Console & Operations E2E Verification', async (t) => {
  let adminToken = '';
  let customerToken = '';
  let customerPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  let testOrderId = '';
  let testVariantId = '';
  let testSlotId = '';
  let initialStock = 0;
  let initialReserved = 0;

  await t.test('1. Admin Layout & Route Security: Admin Login Shell renders successfully', async () => {
    const res = await fetch(`${WEB_URL}/admin/login`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Operations Console Login/i);
  });

  await t.test('2. Customer vs Admin RBAC: Customer OTP user is strictly rejected from Admin APIs', async () => {
    // 2.1 Authenticate customer
    await fetch(`${API_URL}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: customerPhone, purpose: 'login' }),
    });

    const verifyRes = await fetch(`${API_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: customerPhone, otp: '1234', purpose: 'login' }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await parseJson(verifyRes);
    customerToken = verifyData.access_token;
    assert.equal(verifyData.role, 'customer');

    // 2.2 Attempt to call admin dashboard metrics using customer token
    const rbacRes = await fetch(`${API_URL}/admin/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(rbacRes.status, 403);
    const rbacData = await rbacRes.json();
    assert.match(rbacData.detail, /Administrator access is required/i);
  });

  await t.test('3. Admin Authentication: Authenticate with provisioned admin credentials', async () => {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '+919999999999',
        password: 'Admin@123456',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await parseJson(loginRes);
    adminToken = loginData.access_token;
    assert.equal(loginData.role, 'admin');
  });

  await t.test('4. Dashboard Metrics: Authoritative backend aggregates calculate correctly', async () => {
    const metricsRes = await fetch(`${API_URL}/admin/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(metricsRes.status, 200);
    const metrics = await parseJson(metricsRes);

    assert.ok(metrics.date);
    assert.equal(typeof metrics.total_orders_today, 'number');
    assert.ok(metrics.orders_by_status);
    assert.equal(typeof metrics.orders_by_status.placed, 'number');
    assert.equal(typeof metrics.orders_by_status.delivered, 'number');
    assert.equal(typeof metrics.orders_by_status.cancelled, 'number');
    assert.ok(metrics.revenue_today);
    assert.equal(typeof metrics.low_stock_variants_count, 'number');
    assert.equal(typeof metrics.slot_utilization_percent, 'number');
  });

  await t.test('5. Setup customer order to test fulfillment state-machine', async () => {
    // 5.1 Fetch produce catalog to pick a variant
    const catRes = await fetch(`${API_URL}/catalog/products?page=1&page_size=20`);
    assert.equal(catRes.status, 200);
    const catData = await parseJson(catRes);
    assert.ok(catData.items.length > 0);
    const product = catData.items.find((p) => p.variants && p.variants.length > 0);
    assert.ok(product, 'Must find a product with variants');
    const variant = product.variants[0];
    testVariantId = variant.id;
    initialStock = variant.inventory.stock_quantity;
    initialReserved = variant.inventory.reserved_quantity;

    // 5.2 Fetch available slots
    const slotsRes = await fetch(`${API_URL}/delivery/slots`);
    assert.equal(slotsRes.status, 200);
    const slots = await parseJson(slotsRes);
    assert.ok(Array.isArray(slots) && slots.length > 0);
    testSlotId = slots[0].id;

    // 5.3 Customer creates address
    const addrRes = await fetch(`${API_URL}/users/me/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        full_name: 'Test Customer',
        phone: customerPhone,
        house_flat: 'Flat 402, Green Towers',
        street_area: '100ft Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        label: 'home',
        is_default: true,
      }),
    });
    assert.equal(addrRes.status, 201);
    const addr = await parseJson(addrRes);

    // 5.4 Customer adds item to cart
    const cartRes = await fetch(`${API_URL}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ variant_id: testVariantId, quantity: 2 }),
    });
    assert.equal(cartRes.status, 200);

    // 5.5 Customer places order
    const orderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        address_id: addr.id,
        slot_id: testSlotId,
        payment_method: 'cod',
      }),
    });
    if (orderRes.status !== 201) {
      console.error('Order placement failed:', await orderRes.json());
    }
    assert.equal(orderRes.status, 201);
    const orderData = await parseJson(orderRes);
    testOrderId = orderData.id;
    assert.equal(orderData.status, 'placed');
  });

  await t.test('6. Order Fulfillment Lifecycle: State machine transitions (placed -> confirmed -> out_for_delivery -> delivered)', async () => {
    // 6.1 Admin retrieves order detail
    const getOrderRes = await fetch(`${API_URL}/admin/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(getOrderRes.status, 200);
    const orderDetail = await parseJson(getOrderRes);
    assert.equal(orderDetail.id, testOrderId);
    assert.equal(orderDetail.status, 'placed');

    // 6.2 Transition placed -> confirmed
    const confirmRes = await fetch(`${API_URL}/admin/orders/${testOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'confirmed',
        note: 'Harvest confirmed and packed in eco-friendly jute bag',
      }),
    });
    assert.equal(confirmRes.status, 200);
    const confirmedOrder = await parseJson(confirmRes);
    assert.equal(confirmedOrder.status, 'confirmed');

    // 6.3 Transition confirmed -> out_for_delivery
    const dispatchRes = await fetch(`${API_URL}/admin/orders/${testOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'out_for_delivery',
        note: 'Assigned to delivery executive with EV vehicle',
      }),
    });
    assert.equal(dispatchRes.status, 200);
    const dispatchedOrder = await parseJson(dispatchRes);
    assert.equal(dispatchedOrder.status, 'out_for_delivery');

    // 6.4 Transition out_for_delivery -> delivered
    const deliverRes = await fetch(`${API_URL}/admin/orders/${testOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'delivered',
        note: 'Delivered to doorstep and OTP verified',
      }),
    });
    assert.equal(deliverRes.status, 200);
    const deliveredOrder = await parseJson(deliverRes);
    assert.equal(deliveredOrder.status, 'delivered');

    // 6.5 Illegal transition: delivered -> cancelled must fail with 409 Conflict
    const illegalCancel = await fetch(`${API_URL}/admin/orders/${testOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'cancelled',
        note: 'Attempting invalid cancellation on delivered order',
      }),
    });
    assert.equal(illegalCancel.status, 409);
  });

  await t.test('7. Inventory Delta Barrier & Reservation Integrity', async () => {
    // 7.1 Negative adjustment beyond reserved barrier must fail with 422
    const failAdjRes = await fetch(`${API_URL}/admin/catalog/variants/${testVariantId}/inventory`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        delta: -99999, // Impossible reduction below reserved
        reason: 'Illegal audit decrement',
      }),
    });
    assert.equal(failAdjRes.status, 422);
    const failData = await failAdjRes.json();
    assert.match(failData.detail, /cannot reduce stock/i);

    // 7.2 Legitimate positive restock adjustment
    const validAdjRes = await fetch(`${API_URL}/admin/catalog/variants/${testVariantId}/inventory`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        delta: 25,
        reason: 'Organic fresh morning farm shipment intake',
      }),
    });
    assert.equal(validAdjRes.status, 200);
    const updatedInv = await parseJson(validAdjRes);
    assert.ok(updatedInv.stock_quantity > 0);
  });

  await t.test('8. Delivery Zone & Slot Scheduling and Freeze Controls', async () => {
    // 8.1 Admin lists all slots (including capacity)
    const adminSlotsRes = await fetch(`${API_URL}/admin/delivery/slots`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminSlotsRes.status, 200);
    const allSlots = await parseJson(adminSlotsRes);
    assert.ok(Array.isArray(allSlots));

    if (allSlots.length > 0) {
      const targetSlot = allSlots[0];

      // 8.2 Emergency freeze toggle (is_active: false)
      const freezeRes = await fetch(`${API_URL}/admin/delivery/slots/${targetSlot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ is_active: false }),
      });
      assert.equal(freezeRes.status, 200);
      const frozenSlot = await parseJson(freezeRes);
      assert.equal(frozenSlot.is_active, false);

      // 8.3 Unfreeze slot (is_active: true)
      const unfreezeRes = await fetch(`${API_URL}/admin/delivery/slots/${targetSlot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ is_active: true }),
      });
      assert.equal(unfreezeRes.status, 200);
      const unfrozenSlot = await parseJson(unfreezeRes);
      assert.equal(unfrozenSlot.is_active, true);
    }
  });

  await t.test('9. Next.js BFF Admin Proxy Validation', async () => {
    // The Next.js BFF proxy at /api/admin/dashboard/metrics requires active session
    const bffRes = await fetch(`${WEB_URL}/api/admin/dashboard/metrics`);
    // Without admin cookie, must be rejected with 401 or 403
    assert.ok(bffRes.status === 401 || bffRes.status === 403);
  });
});

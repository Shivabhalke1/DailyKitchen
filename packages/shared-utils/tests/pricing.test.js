import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePricing, PACKAGING_FEE, STANDARD_DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '../dist/pricing.js';
import { formatINR } from '../dist/currency.js';
import { formatWeight } from '../dist/weight.js';

test('Locked constants are exact', () => {
  assert.equal(PACKAGING_FEE, 10);
  assert.equal(STANDARD_DELIVERY_FEE, 40);
  assert.equal(FREE_DELIVERY_THRESHOLD, 99);
});

test('Pricing rule: subtotal below ₹99 charges ₹40 delivery and ₹10 packaging', () => {
  const result = calculatePricing(98);
  assert.equal(result.subtotal, 98);
  assert.equal(result.packagingFee, 10);
  assert.equal(result.deliveryFee, 40);
  assert.equal(result.total, 148);
  assert.equal(result.isFreeDeliveryEligible, false);
  assert.equal(result.amountNeededForFreeDelivery, 1);
});

test('Pricing rule: subtotal exactly ₹99 qualifies for free delivery', () => {
  const result = calculatePricing(99);
  assert.equal(result.subtotal, 99);
  assert.equal(result.packagingFee, 10);
  assert.equal(result.deliveryFee, 0);
  assert.equal(result.total, 109);
  assert.equal(result.isFreeDeliveryEligible, true);
  assert.equal(result.amountNeededForFreeDelivery, 0);
});

test('Pricing rule: subtotal above ₹99 qualifies for free delivery', () => {
  const result = calculatePricing(250);
  assert.equal(result.subtotal, 250);
  assert.equal(result.packagingFee, 10);
  assert.equal(result.deliveryFee, 0);
  assert.equal(result.total, 260);
  assert.equal(result.isFreeDeliveryEligible, true);
  assert.equal(result.amountNeededForFreeDelivery, 0);
});

test('Currency formatting formatINR works as expected', () => {
  assert.equal(formatINR(0), '₹0');
  assert.equal(formatINR(99), '₹99');
  assert.equal(formatINR(1250), '₹1,250');
  assert.equal(formatINR(1250.5), '₹1,250.50');
});

test('Weight formatting formatWeight works as expected', () => {
  assert.equal(formatWeight(250), '250g');
  assert.equal(formatWeight(500), '500g');
  assert.equal(formatWeight(1000), '1kg');
  assert.equal(formatWeight(1500), '1.5kg');
});

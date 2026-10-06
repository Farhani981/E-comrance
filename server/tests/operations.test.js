import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, numberValue } from '../utils/operations.js';

const lines = [{ id: 1, price: 1000, quantity: 2 }, { id: 2, price: 500, quantity: 1 }];
const promotion = overrides => ({ id: 1, name: 'Offer', code: null, active: 1, discount_type: 'Percentage', value: 10, min_subtotal: 0, ...overrides });
test('automatic discounts use the best offer, not stacked discounts', () => {
  const quote = calculateQuote(lines, [promotion({}), promotion({ id: 2, value: 20 })]);
  assert.equal(quote.discountAmount, 500);
  assert.equal(quote.grandTotal, 2000);
  assert.equal(quote.shipping, 0);
});
test('product rules discount only the eligible product and cap fixed amounts', () => {
  assert.equal(calculateQuote(lines, [promotion({ product_id: 2, value: 50 })]).discountAmount, 250);
  assert.equal(calculateQuote(lines, [promotion({ product_id: 2, discount_type: 'Fixed', value: 900 })]).discountAmount, 500);
});
test('coupons require a matching code, dates, minimum spend and eligible products', () => {
  const now = new Date('2026-09-09T12:00:00Z');
  const coupon = promotion({ code: 'SAVE' });
  assert.equal(calculateQuote(lines, [coupon], 'save', now).discountAmount, 250);
  for (const overrides of [{ active: 0 }, { starts_at: '2027-01-01' }, { ends_at: '2025-01-01' }, { min_subtotal: 3000 }, { product_id: 99 }]) {
    assert.throws(() => calculateQuote(lines, [{ ...coupon, ...overrides }], 'SAVE', now));
  }
  assert.equal(calculateQuote(lines, [coupon], '', now).discountAmount, 0);
});
test('money rounds to cents and invalid quantities are rejected', () => {
  assert.equal(calculateQuote([{ id: 1, price: 10.99, quantity: 3 }], [promotion({ value: 15 })]).discountAmount, 4.95);
  for (const value of ['', null, undefined, 'abc', Infinity, -1, 1.2]) assert.throws(() => numberValue(value, 'Quantity', 0, true));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, validateSettings } from '../utils/storeSettings.js';
import { calculateQuote } from '../utils/operations.js';

test('settings retain live pricing defaults and reject unsupported or invalid business configuration', () => {
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  for (const input of [{}, [], null, { currency: 'USD' }, { shippingFee: -1 }, { shippingFee: '200' }, { shippingFee: 0.001 }, { freeShippingAbove: null }, { lowStockThreshold: 1.5 }, { storeName: '' }, { contactEmail: 'bad' }, { contactPhone: 'abc' }, { logo: 'javascript:alert(1)' }, { tax: 10 }, { codEnabled: false }, { role: 'admin' }]) {
    assert.throws(() => validateSettings(input), { status: 400 });
  }
});

test('saved shipping rules preserve strict threshold, rounding and zero-fee behavior', () => {
  const lines = [{ id: 1, price: 1000, quantity: 1 }];
  const settings = { ...DEFAULT_SETTINGS, shippingFee: 350.25, freeShippingAbove: 1000 };
  assert.equal(calculateQuote(lines, [], '', new Date(), settings).grandTotal, 1350.25);
  assert.equal(calculateQuote(lines, [], '', new Date(), { ...settings, freeShippingAbove: 999 }).shipping, 0);
  assert.equal(calculateQuote(lines, [], '', new Date(), { ...settings, shippingFee: 0 }).grandTotal, 1000);
});

test('social and SEO fields validate URLs and support clearing', () => {
  assert.deepEqual(validateSettings({ facebook: 'https://facebook.com/store', metaTitle: 'My shop', instagram: '' }), { facebook: 'https://facebook.com/store', metaTitle: 'My shop', instagram: '' });
  for (const facebook of ['javascript:alert(1)', 'data:text/html,test', 'not-a-url', 'https://user:pass@example.com']) {
    assert.throws(() => validateSettings({ facebook }), { status: 400 });
  }
});

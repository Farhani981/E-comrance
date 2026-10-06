import { DEFAULT_SETTINGS } from '../utils/storeSettings.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, quoteCart, toMinorUnits } from '../utils/operations.js';

test('PKR shipping boundaries, zero cart and rounding use the existing rules', () => {
  for (const [price, shipping] of [[0, 0], [50, 200], [1999.99, 200], [2000, 200], [2000.01, 0]]) {
    const quote = calculateQuote([{ id: 1, price, quantity: 1 }], []);
    assert.equal(quote.currency, 'PKR');
    assert.equal(quote.tax, 0);
    assert.equal(quote.shipping, shipping);
    assert.equal(quote.totalMinor, toMinorUnits(price) + shipping * 100);
    assert.equal(quote.grandTotal, quote.totalMinor / 100);
  }
  assert.equal(calculateQuote([{ price: 0.1, quantity: 3 }, { price: 0.2, quantity: 1 }], []).subtotal, 0.5);
});

test('multiple products and variant sale prices come from SQL, ignoring all client amounts', async () => {
  const db = { async query(sql) {
    if (sql.includes('FROM store_settings')) return [[{ settings: JSON.stringify(DEFAULT_SETTINGS) }]];
    if (sql.includes('FROM products')) return [[
      { id: 1, name: 'Shirt', price: '1000.25', stock: 10 },
      { id: 2, name: 'Suit', price: '9000', has_variants: true, stock: 10 },
    ]];
    if (sql.includes('FROM product_variants')) return [[{ id: 22, price: '4000', sale_price: '500.10', stock_quantity: 10, options: '[]' }]];
    if (sql.includes('FROM promotions')) return [[{ active: 1, code: 'SAVE', name: 'Save', discount_type: 'Percentage', value: 10, min_subtotal: 0 }]];
    throw new Error(sql);
  } };
  const quote = await quoteCart(db, [
    { id: 1, quantity: 2, price: 0, total: 0 },
    { id: 2, productVariantId: 22, quantity: 1, price: 0, currency: 'USD', shipping: -1000 },
  ], 'save');
  assert.equal(quote.subtotal, 2500.6);
  assert.equal(quote.discountAmount, 250.06);
  assert.equal(quote.shipping, 0);
  assert.equal(quote.grandTotal, 2250.54);
  assert.equal(quote.totalMinor, 225054);
  assert.equal(quote.currency, 'PKR');
  assert.equal(quote.lines[1].price, 500.1);
});

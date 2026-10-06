import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES, validateImageFile, validateImageReference } from '../../shared/images.js';
import { validateVariants } from '../../shared/variants.js';
import { checkoutItems } from '../../shared/checkout.js';
import { ensureImageSchema } from '../utils/imageSchema.js';
import { pngImage } from './imageFixtures.js';

test('normal URLs, local references and base64 images are retained unchanged', () => {
  for (const image of ['https://example.com/image.webp?size=800', '/images/shirt.jpg', pngImage()]) assert.equal(validateImageReference(image), image);
  assert.equal(validateImageReference(null, { optional: true }), '');
});
test('large images above old TEXT capacity and exactly 512 KiB are supported', () => {
  for (const size of [100000, MAX_IMAGE_BYTES]) {
    const image = pngImage(size);
    assert.ok(image.length > 65535);
    assert.equal(validateImageReference(image), image);
  }
});
test('invalid MIME, disguised content, truncated base64 and unsafe references rejected', () => {
  for (const image of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,aGVsbG8=', pngImage().replace('image/png', 'image/jpeg'), pngImage().slice(0, -16), 'javascript:alert(1)', '//example.com/a.png', '/\\example.com/a.png', 'https://', 'https://user:pass@example.com/a.png']) {
    assert.throws(() => validateImageReference(image), { status: 400 });
  }
});
test('embedded images over 512 KiB rejected on the API/shared validation boundary', () => {
  assert.throws(() => validateImageReference(pngImage(MAX_IMAGE_BYTES + 1)), /size/);
});
test('upload file metadata enforces raster type, nonempty content and raw file limit', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) validateImageFile({ type, size: MAX_UPLOAD_BYTES });
  for (const file of [{ type: 'image/svg+xml', size: 100 }, { type: 'text/plain', size: 100 }, { type: 'image/png', size: 0 }, { type: 'image/png', size: MAX_UPLOAD_BYTES + 1 }]) assert.throws(() => validateImageFile(file));
});
test('variant validation applies the same image limits', () => {
  const row = { options: [], sku: 'IMAGE-TEST', price: 100, stockQuantity: 1, imageUrl: pngImage(100000) };
  assert.equal(validateVariants([], [row])[0].imageUrl, row.imageUrl);
  assert.throws(() => validateVariants([], [{ ...row, imageUrl: 'data:text/html;base64,AAAA' }]));
  assert.throws(() => validateVariants([], [{ ...row, imageUrl: pngImage(MAX_IMAGE_BYTES + 1) }]));
});
test('checkout requests contain only IDs and quantities, never image copies', () => {
  const cart = [{ id: 1, quantity: 2, productVariantId: 10, image: pngImage(100000), variants: [{ imageUrl: pngImage() }], price: 1 }, { id: 2, quantity: 1, image: '/old.jpg' }];
  assert.deepEqual(checkoutItems(cart), [{ id: 1, quantity: 2, productVariantId: 10 }, { id: 2, quantity: 1 }]);
  assert.ok(cart[0].image.length > 65535, 'original cart/receipt keeps its display data');
});
test('unchanged legacy variant images survive edits but new oversized images cannot bypass validation', () => {
  const imageUrl = pngImage(MAX_IMAGE_BYTES + 1);
  const row = { id: 7, options: [], sku: 'LEGACY', price: 100, stockQuantity: 1, imageUrl };
  assert.equal(validateVariants([], [row], [{ id: 7, imageUrl }])[0].imageUrl, imageUrl);
  assert.throws(() => validateVariants([], [row], [{ id: 8, imageUrl }]));
  assert.throws(() => validateVariants([], [row]));
});
test('image schema migration widens once and preserves nullability without data writes', async () => {
  const types = { products: 'longtext', order_items: 'text', product_variants: 'text' };
  const altered = [];
  const db = { query: async sql => {
    if (sql.startsWith('SHOW COLUMNS')) {
      const table = sql.split(' ')[3];
      return [[{ Type: types[table], Null: table === 'product_variants' ? 'NO' : 'YES' }]];
    }
    assert.match(sql, /^ALTER TABLE (order_items|product_variants) MODIFY COLUMN image(_url)? LONGTEXT (NULL|NOT NULL)$/);
    types[sql.split(' ')[2]] = 'longtext'; altered.push(sql); return [[]];
  } };
  await ensureImageSchema(db, true);
  await ensureImageSchema(db, true);
  assert.deepEqual(altered, ['ALTER TABLE order_items MODIFY COLUMN image LONGTEXT NULL', 'ALTER TABLE product_variants MODIFY COLUMN image_url LONGTEXT NOT NULL']);
});

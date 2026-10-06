import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct, matchesCategory, shopLink, categoryHierarchy } from '../src/utils/catalog.js';
test('every configured category/subcategory link selects its product after API reload', () => {
  for (const [category, subs] of Object.entries(categoryHierarchy)) for (const subcategory of subs) {
    const product = normalizeProduct({ category_name: category, subcategory, name: 'Test product' });
    const url = new URL(shopLink(category, subcategory), 'http://localhost');
    assert.ok(matchesCategory(product, url.searchParams.get('category'), url.searchParams.get('sub')));
    assert.ok(matchesCategory(product, category));
    assert.ok(!matchesCategory(product, 'Unrelated Category'));
  }
});
test('legacy slugs and aliases select the same catalog items', () => {
  assert.ok(matchesCategory(normalizeProduct({category: 'Casual Shirts'}), 'Casual-Shirts'));
  assert.ok(matchesCategory(normalizeProduct({category: 'Denim Jeans'}), 'Jeans'));
  assert.ok(matchesCategory(normalizeProduct({category_name: 'Eastern Wear', name: 'Cotton Kurta'}), 'Eastern Wear', 'Kurta'));
  assert.ok(matchesCategory(normalizeProduct({category: 'Topwear', subCategory: 'Formal Shirts'}), 'Topwear', 'Shirts'));
  assert.ok(!matchesCategory(normalizeProduct({category: 'Topwear', subCategory: 'Casual Shirts'}), 'Topwear', 'Formal Shirts'));
});
test('custom names and ampersands survive links and reload', () => {
  const p = normalizeProduct({category_name: 'Grooming & Tech', subcategory: 'Special & New'});
  const url = new URL(shopLink(p.category, p.subCategory), 'http://localhost');
  assert.ok(matchesCategory(p, url.searchParams.get('category'), url.searchParams.get('sub')));
});

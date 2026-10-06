import {
  initialMensTree,
  legacyPlacement,
  catalogKey,
  slugify,
} from "../../../shared/mensCatalog.js";
export { catalogKey, slugify };
export const categoryHierarchy = Object.fromEntries(
  initialMensTree.map((p) => [p.name, p.children.map((c) => c.name)]),
);
export const shopLink = (category, sub = "", type = "") =>
  "/products?" +
  new URLSearchParams({
    category: catalogKey(category),
    ...(sub ? { subcategory: catalogKey(sub) } : {}),
    ...(type ? { type: slugify(type) } : {}),
  });
import { normalizeStock } from '../../../shared/stock.js';

export function normalizeProduct(p) {
  if (!p) return p;
  // An explicit empty/null attribute list means cleared options. Only older
  // products without the field may retain their legacy size/color arrays.
  const hasAttributes = Object.hasOwn(p, 'attributes');
  let attributes = p.attributes;
  if (typeof attributes === 'string') {
    try { attributes = JSON.parse(attributes); } catch { attributes = []; }
  }
  attributes = Array.isArray(attributes) ? attributes : [];
  const sizes = hasAttributes
    ? attributes.filter(a => ['size', 'sizes'].includes(String(a?.name || '').trim().toLowerCase()))
      .flatMap(a => (a.values || []).map(v => v.label))
    : p.sizes || [];
  const colors = hasAttributes
    ? attributes.filter(a => String(a?.type || '').trim().toLowerCase() === 'color')
      .flatMap(a => (a.values || []).map(v => ({ name: v.label, hex: v.color || v.hex || '#1E3A8A' })))
    : p.colors || [];
  return { ...p, ...(p.categorySlug ? {} : legacyPlacement(p)),
    ...(hasAttributes ? { attributes } : {}), sizes, colors, ...normalizeStock(p) };
}
export function matchesCategory(
  product,
  category = "all",
  sub = "",
  type = "",
) {
  const p = normalizeProduct(product);
  const parent = catalogKey(p.categorySlug || p.category),
    child = catalogKey(p.subcategorySlug || p.subCategory),
    item = slugify(p.productTypeSlug || p.productType);
  const matches = (value) => {
    const k = catalogKey(value);
    return (
      k === parent ||
      k === child ||
      k === item ||
      (k === "shirts" && ["formal-shirts", "casual-shirts"].includes(child))
    );
  };
  return (
    (catalogKey(category) === "all" || matches(category)) &&
    (!sub || matches(sub)) &&
    (!type || item === slugify(type))
  );
}

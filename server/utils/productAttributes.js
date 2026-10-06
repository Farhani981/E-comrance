export async function resolveProductAttributes(db, selections) {
  if (!Array.isArray(selections) || selections.length > 100) throw new Error('Invalid product attributes.');
  if (!selections.length) return [];
  const [definitions] = await db.query('SELECT * FROM product_attributes');
  const seen = new Set();
  return selections.map(selection => {
    const definition = definitions.find(item => item.id === selection?.id);
    if (!definition || seen.has(definition.id)) throw new Error('An attribute no longer exists or was selected twice. Reload the attribute list.');
    seen.add(definition.id);
    const available = typeof definition.attribute_values === 'string' ? JSON.parse(definition.attribute_values) : definition.attribute_values;
    if (!Array.isArray(selection.values) || !selection.values.length || selection.values.length > 100) throw new Error('Choose at least one value for each attribute.');
    const labels = new Set();
    const values = selection.values.map(value => {
      const match = available.find(option => option.label === value?.label);
      if (!match || labels.has(match.label)) throw new Error('An attribute value is unavailable or duplicated. Reload the attribute list.');
      labels.add(match.label);
      return match;
    });
    return { id: definition.id, name: definition.name, type: definition.type, values };
  });
}

export function withProductAttributes(product) {
  const attributes = typeof product.attributes === 'string' ? JSON.parse(product.attributes) : product.attributes;
  return { ...product, attributes: attributes || [] };
}

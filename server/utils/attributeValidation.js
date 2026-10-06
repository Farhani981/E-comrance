export function validateAttribute(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) throw new Error('Enter an attribute name of 1–100 characters.');
  if (!['text', 'color'].includes(body.type)) throw new Error('Choose text or color as the attribute type.');
  if (!Array.isArray(body.values) || !body.values.length || body.values.length > 100) throw new Error('Add between 1 and 100 values.');
  const seen = new Set();
  const values = body.values.map(value => {
    const label = typeof value?.label === 'string' ? value.label.trim() : '';
    if (!label || label.length > 100) throw new Error('Each value needs a name of 1–100 characters.');
    if (seen.has(label.toLowerCase())) throw new Error('Attribute values must be unique.');
    seen.add(label.toLowerCase());
    if (body.type === 'color' && !/^#[0-9a-f]{6}$/i.test(value.color || '')) throw new Error('Each color needs a valid hex code, such as #000000.');
    return body.type === 'color' ? { label, color: value.color.toUpperCase() } : { label };
  });
  return { name, type: body.type, values };
}

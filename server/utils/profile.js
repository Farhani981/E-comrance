export const PROFILE_COLUMNS = 'id, name, email, role, phone, address, city, created_at';

export async function ensureProfileSchema(db) {
  for (const [column, type] of [['phone', "VARCHAR(50) NOT NULL DEFAULT ''"], ['address', 'TEXT NULL'], ['city', "VARCHAR(100) NOT NULL DEFAULT ''"]]) {
    const [rows] = await db.query('SHOW COLUMNS FROM users LIKE ?', [column]);
    if (!rows.length) await db.query(`ALTER TABLE users ADD COLUMN ${column} ${type}`);
  }
}

export function validateProfile(body) {
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  const limits = { name: 255, email: 255, phone: 50, address: 1000, city: 100 };
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) invalid('Provide profile fields to update.');
  const fields = {};
  for (const [key, value] of Object.entries(body)) {
    if (!Object.hasOwn(limits, key)) invalid('Only name, email, phone, address and city can be updated.');
    if (typeof value !== 'string') invalid(`${key} must be text.`);
    const text = value.trim();
    if (text.length > limits[key] || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || (key !== 'address' && /[\r\n\t]/.test(text))) invalid(`Invalid ${key}.`);
    if (['name', 'email'].includes(key) && !text) invalid(`${key} is required.`);
    if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) invalid('Enter a valid email address.');
    if (key === 'phone' && text && (!/^\+?[\d ().-]+$/.test(text) || !/^\d{7,15}$/.test(text.replace(/\D/g, '')))) invalid('Enter a valid phone number with 7–15 digits.');
    fields[key] = key === 'email' ? text.toLowerCase() : text;
  }
  return fields;
}

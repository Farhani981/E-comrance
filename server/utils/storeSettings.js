import { validateImageReference } from '../../shared/images.js';
const SOCIAL_DEFAULTS = { facebook: '', instagram: '', tiktok: '', metaTitle: '', metaDescription: '', metaKeywords: '' };
export const DEFAULT_SETTINGS = Object.freeze({
  storeName: 'ShopHub', storeTagline: "Premium Men's Fashion & Lifestyle", logo: '',
  contactEmail: 'support@shophub.com.pk', contactPhone: '+92 300 1234567',
  whatsapp: '+92 300 1234567', address: 'Plot #45, Main Boulevard, Gulberg III, Lahore, Pakistan',
  ...SOCIAL_DEFAULTS,
  currency: 'PKR', shippingFee: 200, freeShippingAbove: 2000, lowStockThreshold: 5,
});

export async function ensureStoreSettingsSchema(db) {
  await db.query('CREATE TABLE IF NOT EXISTS store_settings (id TINYINT PRIMARY KEY, settings LONGTEXT NOT NULL, CHECK (id=1))');
  await db.query('INSERT IGNORE INTO store_settings (id,settings) VALUES (1,?)', [JSON.stringify(DEFAULT_SETTINGS)]);
}

export function validateSettings(input) {
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length) invalid('Provide settings to update.');
  const result = {};
  const limits = { storeName: 100, storeTagline: 200, contactEmail: 255, contactPhone: 50, whatsapp: 50, address: 1000, facebook: 2048, instagram: 2048, tiktok: 2048, metaTitle: 200, metaDescription: 1000, metaKeywords: 1000 };
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) invalid('Unsupported store setting.');
    if (key === 'currency') {
      if (value !== 'PKR') invalid('Only PKR is supported by this store.');
      result[key] = value;
    } else if (key === 'logo') {
      result[key] = validateImageReference(value, { optional: true });
    } else if (['shippingFee', 'freeShippingAbove', 'lowStockThreshold'].includes(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000 || (key === 'lowStockThreshold' ? !Number.isInteger(value) : Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) invalid(`Invalid ${key}.`);
      result[key] = value;
    } else {
      if (typeof value !== 'string' || value.trim().length > limits[key] || /[\x00-\x1f\x7f]/.test(value)) invalid(`Invalid ${key}.`);
      const text = value.trim();
      if (['facebook', 'instagram', 'tiktok'].includes(key) && text) {
        let url; try { url = new URL(text); } catch { invalid(`Invalid ${key} URL.`); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) invalid(`Invalid ${key} URL.`);
      }
      if (key === 'storeName' && !text) invalid('Store name is required.');
      if (key === 'contactEmail' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) invalid('Invalid contact email.');
      if (['contactPhone', 'whatsapp'].includes(key) && text && (!/^\+?[\d ().-]+$/.test(text) || !/^\d{7,15}$/.test(text.replace(/\D/g, '')))) invalid('Invalid contact phone number.');
      result[key] = text;
    }
  }
  return result;
}

// Read on every operation: restarting workers never resets administrator values.
export async function readStoreSettings(db, lock = false) {
  const [[row]] = await db.query(`SELECT settings FROM store_settings WHERE id=1${lock ? ' FOR UPDATE' : ''}`);
  if (!row) throw new Error('Store settings are unavailable.');
  const stored = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
  const settings = stored && { ...SOCIAL_DEFAULTS, ...stored };
  if (!settings || Object.keys(DEFAULT_SETTINGS).some(key => !Object.hasOwn(settings, key))) throw new Error('Store settings are incomplete.');
  return validateSettings(settings);
}

export const publicStoreInfo = ({ lowStockThreshold, ...settings }) => settings;

export async function ensureContactSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    reply_message TEXT NULL,
    replied_at TIMESTAMP NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX contact_created (created_at,id))`);
}

export function validateContact(body) {
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  const limits = { name: 100, email: 255, phone: 50, subject: 200, message: 5000 };
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Submit valid contact details.');
  const required = ['name', 'email', 'subject', 'message'];
  for (const key of Object.keys(body)) {
    if (!(key in limits)) invalid(`Unknown field: ${key}.`);
  }
  for (const key of required) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > limits[key]) {
      invalid(`${key} is required and must be at most ${limits[key]} characters.`);
    }
  }
  const fields = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (body[key] !== undefined && body[key] !== null) {
      if (typeof body[key] !== 'string' || body[key].length > limit) invalid(`Invalid ${key}.`);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body[key]) || (key !== 'message' && /[\r\n\t]/.test(body[key]))) invalid(`Invalid ${key}.`);
      fields[key] = body[key].trim();
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) invalid('Enter a valid email address.');
  fields.email = fields.email.toLowerCase();
  if (fields.phone !== undefined) {
    fields.phone = fields.phone || null;
  }
  return fields;
}

// Bounded per-process abuse protection. Do not trust client-supplied forwarding headers.
export function createContactLimiter({ limit = 5, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, entry] of attempts) if (entry.expires <= time) attempts.delete(key);
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = attempts.get(key);
    if (!entry && attempts.size < 10000) { entry = { count: 0, expires: time + windowMs }; attempts.set(key, entry); }
    if (!entry || entry.count >= limit) return res.set('Retry-After', String(Math.ceil(((entry?.expires || time + windowMs) - time) / 1000))).status(429).json({ success: false, message: 'Too many contact attempts. Please try again later.' });
    entry.count++; next();
  };
}

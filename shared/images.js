export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Base64 expands this to ~683 KiB, below the local DB's 1 MiB packet limit.
export const MAX_IMAGE_BYTES = 512 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };

export function validateImageFile(file) {
  if (!file || !IMAGE_TYPES.includes(file.type)) invalid('Use a JPG, PNG, WebP or GIF image.');
  if (!Number.isFinite(file.size) || file.size <= 0) invalid('The image file is empty or invalid.');
  if (file.size > MAX_UPLOAD_BYTES) invalid('Image files must be 5 MiB or smaller.');
}

// Shared browser/API validation. The browser additionally decodes uploaded files
// before resizing. Remote URLs are references, never fetched by the API.
export function validateImageReference(value, { optional = false, maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || !value) invalid('An image is required.');
  if (!value.startsWith('data:')) {
    if (value.length > 2048 || /[\s\\\x00-\x1f]/.test(value)) invalid('Use a valid image URL or local image path (maximum 2048 characters).');
    if (/^\/(?!\/)/.test(value)) return value;
    try {
      const url = new URL(value);
      if (['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password) return value;
    } catch { /* Reject unsupported references below. */ }
    invalid('Use an HTTP(S) image URL or a local path.');
  }
  // Check the encoded size before allocating decoded image bytes.
  if (value.length > Math.ceil(maxBytes / 3) * 4 + 40) invalid('Embedded image exceeds the allowed size.');
  const match = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) invalid('Invalid image type or base64 encoding.');
  const data = match[2];
  const bytes = data.length / 4 * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (bytes > maxBytes) invalid('Embedded image exceeds the allowed size.');
  let decoded;
  try { decoded = atob(data); } catch { invalid('Invalid base64 image.'); }
  const starts = values => values.every((value, index) => decoded.charCodeAt(index) === value);
  const valid = {
    jpeg: decoded.length >= 4 && starts([255, 216, 255]) && decoded.endsWith('\xff\xd9'),
    png: decoded.length >= 45 && starts([137, 80, 78, 71, 13, 10, 26, 10]) && decoded.slice(12, 16) === 'IHDR' && decoded.slice(-8, -4) === 'IEND',
    gif: decoded.length >= 14 && /^GIF8[79]a/.test(decoded) && decoded.endsWith(';'),
    webp: decoded.length >= 20 && decoded.startsWith('RIFF') && decoded.slice(8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(decoded.slice(12, 16)),
  }[match[1]];
  if (!valid) invalid('Image content does not match its type or is truncated.');
  return value;
}

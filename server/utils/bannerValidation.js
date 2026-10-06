const limits = { title: 255, description: 1500, buttonText: 100, badge: 80, link: 500, secondaryButtonText: 100, secondaryLink: 500, imageAlt: 255 };
export const safeBannerLink = value => typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\s\x00-\x1f]/.test(value);
export function validateBanner(body, partial = false) {
  const result = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string' || body[key].length > limit) throw new Error(`${key} must be text up to ${limit} characters.`);
    result[key] = body[key].trim();
  }
  if ((!partial || body.title !== undefined) && !result.title) throw new Error('A headline is required.');
  for (const key of ['link', 'secondaryLink']) {
    if (result[key] !== undefined && !safeBannerLink(result[key])) throw new Error(`${key} must be a storefront path such as /shop or /#categories.`);
  }
  if (body.image !== undefined || !partial) {
    const image = body.image;
    if (typeof image !== 'string' || image.length > 2800000 || !(/^(https?:\/\/[^\s]+|\/(?!\/)[^\s\\]+)$/.test(image) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))) throw new Error('Use an image URL or a JPG, PNG or WebP upload smaller than 2 MB.');
    result.image = image;
  }
  if (body.kind !== undefined) {
    if (!['hero', 'promo'].includes(body.kind)) throw new Error('Invalid banner placement.');
    result.kind = body.kind;
  }
  if (body.imagePosition !== undefined) {
    if (!['left', 'center', 'right', 'top', 'bottom'].includes(body.imagePosition)) throw new Error('Invalid image crop.');
    result.imagePosition = body.imagePosition;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new Error('Visibility must be true or false.');
    result.isActive = body.isActive;
  }
  if (body.position !== undefined) {
    if (!Number.isInteger(body.position) || body.position < 0 || body.position > 100000) throw new Error('Invalid slide position.');
    result.position = body.position;
  }
  if (!Object.keys(result).length) throw new Error('No banner fields supplied.');
  return result;
}

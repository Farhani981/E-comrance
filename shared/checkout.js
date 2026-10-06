// Checkout trusts server catalog data, so never send cached images/variant arrays.
export const checkoutItems = cart => cart.map(({ id, quantity, productVariantId }) => ({
  id, quantity, ...(productVariantId == null ? {} : { productVariantId }),
}));

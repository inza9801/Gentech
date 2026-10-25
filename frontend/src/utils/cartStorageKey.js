const CART_STORAGE_KEY = 'gentech.cart.items.v2';

export function getCartStorageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    return `${CART_STORAGE_KEY}.guest`;
  }
  return `${CART_STORAGE_KEY}.${encodeURIComponent(userId.trim())}`;
}

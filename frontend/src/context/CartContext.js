import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { getCartStorageKey } from '../utils/cartStorageKey';

const CartContext = createContext(null);
const LEGACY_CART_KEY = 'gentech.cart.items';

export function CartProvider({ children }) {
  const { token, customer, loading: authLoading } = useAuth();
  const userId = customer?.id || (token ? `session-${token}` : null);
  const storageKey = authLoading ? null : getCartStorageKey(userId);
  const [cartState, setCartState] = useState({ storageKey: null, items: [] });
  const hydrated = Boolean(storageKey && cartState.storageKey === storageKey);
  const items = useMemo(
    () => (hydrated ? cartState.items : []),
    [cartState.items, hydrated],
  );

  useEffect(() => {
    let active = true;
    if (!storageKey) return undefined;
    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        const savedItems = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(savedItems)) {
          throw new Error('Saved cart has an invalid format.');
        }
        if (active) setCartState({ storageKey, items: savedItems });
        AsyncStorage.removeItem(LEGACY_CART_KEY).catch((error) =>
          console.warn('Could not remove the shared legacy cart:', error),
        );
      })
      .catch((error) => {
        console.warn('Could not restore the shopping cart:', error);
        if (active) setCartState({ storageKey, items: [] });
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(items)).catch((error) =>
      console.warn('Could not save the shopping cart:', error),
    );
  }, [items, hydrated, storageKey]);

  const addItem = useCallback((product) => {
    setCartState((current) => {
      if (current.storageKey !== storageKey) return current;
      const currentItems = current.items;
      const existing = currentItems.find((item) => item.product.id === product.id);
      if (existing) {
        return {
          ...current,
          items: currentItems.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ),
        };
      }
      return { ...current, items: [...currentItems, { product, quantity: 1 }] };
    });
  }, [storageKey]);

  const changeQuantity = useCallback((productId, change) => {
    setCartState((current) =>
      current.storageKey !== storageKey
        ? current
        : {
            ...current,
            items: current.items
              .map((item) =>
                item.product.id === productId
                  ? { ...item, quantity: item.quantity + change }
                  : item,
              )
              .filter((item) => item.quantity > 0),
        },
    );
  }, [storageKey]);

  const removeItem = useCallback((productId) => {
    setCartState((current) =>
      current.storageKey !== storageKey
        ? current
        : {
            ...current,
            items: current.items.filter((item) => item.product.id !== productId),
        },
    );
  }, [storageKey]);

  const clearCart = useCallback(() =>
    setCartState((current) =>
      current.storageKey === storageKey
        ? { ...current, items: [] }
        : current,
    ), [storageKey]);

  const value = useMemo(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      addItem,
      changeQuantity,
      removeItem,
      clearCart,
    }),
    [items, addItem, changeQuantity, clearCart, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return context;
}

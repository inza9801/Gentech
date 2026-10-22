import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getMyOrders } from '../services/commerceService';

const NotificationContext = createContext(null);
const STORAGE_KEY = 'gentech.order-notifications';
const POLL_INTERVAL = 20000;

export function NotificationProvider({ children }) {
  const { token, customer } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const storageKey = customer?.id ? `${STORAGE_KEY}.${customer.id}` : null;
  const [loadedStorageKey, setLoadedStorageKey] = useState(null);

  useEffect(() => {
    let active = true;
    setNotifications([]);
    setInitialized(false);
    if (!storageKey) {
      setLoadedStorageKey(null);
      setInitialized(true);
      return () => {
        active = false;
      };
    }

    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (active && value) setNotifications(JSON.parse(value));
      })
      .catch((error) => console.warn('Could not restore notifications:', error))
      .finally(() => {
        if (active) {
          setLoadedStorageKey(storageKey);
          setInitialized(true);
        }
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!initialized || !storageKey || loadedStorageKey !== storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(notifications)).catch((error) =>
      console.warn('Could not save notifications:', error),
    );
  }, [notifications, initialized, storageKey, loadedStorageKey]);

  useEffect(() => {
    if (!token || customer?.role === 'admin') return undefined;
    let active = true;
    let isFirstRead = true;

    const checkOrderUpdates = async () => {
      try {
        const orders = await getMyOrders(token);
        if (!active) return;
        const seenKey = `gentech.order-statuses.${customer?.id || 'customer'}`;
        const stored = await AsyncStorage.getItem(seenKey);
        const previous = stored ? JSON.parse(stored) : null;
        const current = {};
        const updates = [];

        orders.forEach((order) => {
          const orderId = order._id || order.id;
          const marker = `${order.status}:${order.updatedAt || ''}`;
          current[orderId] = marker;
          if (!isFirstRead && previous && previous[orderId] !== marker) {
            updates.push({
              id: `${orderId}-${marker}`,
              orderId,
              orderNumber: order.orderNumber || orderId,
              status: order.status,
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        });

        if (updates.length) {
          setNotifications((existing) => [...updates, ...existing].slice(0, 100));
        }
        await AsyncStorage.setItem(seenKey, JSON.stringify(current));
        isFirstRead = false;
      } catch (error) {
        if (active && error.status !== 401) {
          console.warn('Could not check order notifications:', error);
        }
      }
    };

    checkOrderUpdates();
    const interval = setInterval(checkOrderUpdates, POLL_INTERVAL);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkOrderUpdates();
    });

    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [token, customer?.id, customer?.role]);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, []);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const value = useMemo(
    () => ({ notifications, unreadCount, markAllRead }),
    [notifications, unreadCount, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}

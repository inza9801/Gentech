import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMyProfile, loginCustomer } from '../services/commerceService';

const TOKEN_KEY = 'gentech.auth.token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (!savedToken) return;
        try {
          const profile = await getMyProfile(savedToken);
          if (active) {
            setToken(savedToken);
            setCustomer(profile);
          }
        } catch (error) {
          if (error.status === 401) {
            await AsyncStorage.removeItem(TOKEN_KEY);
          } else if (active) {
            setToken(savedToken);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const result = await loginCustomer({ email, password });
    await AsyncStorage.setItem(TOKEN_KEY, result.access_token);
    setToken(result.access_token);
    setCustomer(result.customer);
    return result.customer;
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCustomer(null);
  }, []);

  const value = useMemo(
    () => ({ token, customer, loading, signIn, signOut, setCustomer }),
    [token, customer, loading, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

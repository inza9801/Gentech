import styles from '../styles/OrdersScreenStyles';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getMyOrders } from '../services/commerceService';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';

export function OrdersScreen({ navigation }) {
  const { token, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!token) {
      navigation.replace('Login', { loginFirst: true, returnTo: 'Orders' });
      return undefined;
    }
    let active = true;
    getMyOrders(token)
      .then((result) => { if (active) setOrders(result); })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, authLoading, navigation]);

  if (authLoading) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;
  if (!token) return <View style={styles.center}><Text style={styles.hint}>Login first to view your orders.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!orders.length) return <View style={styles.center}><Text style={styles.title}>No orders yet</Text><Text style={styles.hint}>Your placed orders will appear here.</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {orders.map((order) => (
        <View key={order._id} style={styles.card}>
          <View style={styles.row}><Text style={styles.title}>{order.orderNumber}</Text><Text style={styles.status}>{order.status}</Text></View>
          <Text style={styles.hint}>{order.items?.length || 0} products · {order.paymentType === 'mobile' ? 'bKash demo' : 'Cash on delivery'}</Text>
          <Text style={styles.total}>{formatPrice(order.total)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}



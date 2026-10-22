import styles from '../styles/NotificationsScreenStyles';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import { colors } from '../theme/colors';

const statusCopy = {
  placed: 'Your order has been placed.',
  pending: 'Your order is awaiting confirmation.',
  accepted: 'Your order has been accepted.',
  cancelled: 'Your order was cancelled.',
  delivered: 'Your order has been delivered.',
};

export function NotificationsScreen({ navigation }) {
  const { notifications, markAllRead } = useNotifications();

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>ORDER UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <View style={styles.headingIcon}>
          <Ionicons name="notifications-outline" size={22} color={colors.blue} />
        </View>
      </View>
      {!notifications.length ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={30} color={colors.blue} />
          </View>
          <Text style={styles.emptyTitle}>You’re all caught up</Text>
          <Text style={styles.copy}>We’ll show order acceptance and status changes here.</Text>
          <Pressable onPress={() => navigation.navigate('Home')} style={styles.button}>
            <Text style={styles.buttonText}>Continue shopping</Text>
          </Pressable>
        </View>
      ) : notifications.map((notification) => (
        <View key={notification.id} style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="cube-outline" size={19} color={colors.blue} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{statusCopy[notification.status] || 'Your order status was updated.'}</Text>
            <Text style={styles.copy}>Order {notification.orderNumber}</Text>
            <Text style={styles.time}>{new Date(notification.createdAt).toLocaleString()}</Text>
          </View>
          {!notification.read ? <View style={styles.unread} /> : null}
        </View>
      ))}
      <Text style={styles.note}>Order updates refresh automatically while the app is open.</Text>
    </ScrollView>
  );
}



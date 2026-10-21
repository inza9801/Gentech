import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { colors } from '../theme/colors';
import { useCart } from '../context/CartContext';
import { HomeScreen } from '../screens/HomeScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProductDetailsScreen } from '../screens/ProductDetailsScreen';
import { CategoryBrandsScreen } from '../screens/CategoryBrandsScreen';
import { BrandProductsScreen } from '../screens/BrandProductsScreen';
import { CartScreen } from '../screens/CartScreen';
import { OffersScreen } from '../screens/OffersScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { OrdersScreen } from '../screens/OrdersScreen';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BottomTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Offers: focused ? 'pricetag' : 'pricetag-outline',
            Account: focused ? 'person' : 'person-outline',
            Chat: focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Offers" component={OffersScreen} />
      <Tabs.Screen name="Account" component={AccountScreen} />
      <Tabs.Screen name="Chat" component={ChatScreen} />
    </Tabs.Navigator>
  );
}

function ScreenHeader({ title, onHomePress, onCartPress }) {
  const { itemCount } = useCart();
  return (
    <View style={styles.screenHeader}>
      <Pressable onPress={onHomePress} accessibilityLabel="GenTech home">
        <BrandMark compact />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable
        onPress={onCartPress}
        style={styles.cartButton}
        accessibilityRole="button"
        accessibilityLabel={`Shopping cart, ${itemCount} items`}
      >
        <Ionicons name="bag-handle-outline" size={21} color="#FFFFFF" />
        {itemCount > 0 ? (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>
              {itemCount > 9 ? '9+' : itemCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function StackScreen({ component: Component, title, ...props }) {
  const { navigation } = props;
  return (
    <SafeAreaView style={styles.stackScreen} edges={['top']}>
      <ScreenHeader
        title={title}
        onHomePress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        onCartPress={() => navigation.navigate('Cart')}
      />
      <Component {...props} />
    </SafeAreaView>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabs} />
      <Stack.Screen name="ProductDetails">
        {(props) => (
          <StackScreen
            {...props}
            title="Product"
            component={ProductDetailsScreen}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CategoryBrands">
        {(props) => (
          <StackScreen
            {...props}
            title="Choose a brand"
            component={CategoryBrandsScreen}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BrandProducts">
        {(props) => (
          <StackScreen
            {...props}
            title={props.route.params.brand}
            component={BrandProductsScreen}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Cart">
        {(props) => (
          <StackScreen {...props} title="Your bag" component={CartScreen} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Checkout">
        {(props) => (
          <StackScreen {...props} title="Checkout" component={CheckoutScreen} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Login">
        {(props) => (
          <StackScreen {...props} title="Login" component={LoginScreen} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {(props) => (
          <StackScreen {...props} title="Register" component={RegisterScreen} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Orders">
        {(props) => (
          <StackScreen {...props} title="My orders" component={OrdersScreen} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 66,
    paddingHorizontal: 3,
    paddingTop: 8,
    paddingBottom: 7,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    elevation: 16,
  },
  tabLabel: { fontSize: 9, fontWeight: '700' },
  stackScreen: { flex: 1, backgroundColor: colors.background },
  screenHeader: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cartButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inkSoft,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
});

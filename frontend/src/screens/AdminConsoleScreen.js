import styles from '../styles/AdminConsoleScreenStyles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from '../components/FormField';
import { SelectField } from '../components/SelectField';
import { useAuth } from '../context/AuthContext';
import {
  adminCreateCategory,
  adminCreateCoupon,
  adminCreateProduct,
  adminDeleteCategory,
  adminDeleteCoupon,
  adminDeleteProduct,
  adminListCategories,
  adminListCoupons,
  adminListOrders,
  adminListProducts,
  adminUpdateCategory,
  adminUpdateCoupon,
  adminUpdateOrderStatus,
  adminUpdateProduct,
} from '../services/adminService';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';

const SECTIONS = [
  { key: 'categories', label: 'Categories', icon: 'grid-outline' },
  { key: 'products', label: 'Products', icon: 'cube-outline' },
  { key: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { key: 'coupons', label: 'Coupons', icon: 'pricetag-outline' },
];

const COLLECTIONS = [
  'processors', 'motherboards', 'rams', 'ssds', 'graphics_cards',
  'power_supplies', 'casings', 'monitors', 'ups', 'keyboards', 'mice', 'laptops',
];

const EMPTY_FORM = {
  name: '', slug: '', collection: COLLECTIONS[0], brand: '', price: '',
  discount: '0', availability: '0', sku: '', extraJson: '',
  code: '', discountType: 'percentage', discountValue: '', minOrderAmount: '0',
  maxDiscount: '', usageLimit: '', active: true,
};

export function AdminConsoleScreen() {
  const { token, customer } = useAuth();
  const [section, setSection] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const category = useMemo(
    () => categories.find((item) => item.slug === activeSlug),
    [categories, activeSlug],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResult, orderResult, couponResult] = await Promise.all([
        adminListCategories(token),
        adminListOrders(token),
        adminListCoupons(token),
      ]);
      setCategories(categoryResult);
      setOrders(orderResult);
      setCoupons(couponResult);
      setActiveSlug((current) => current || categoryResult[0]?.slug || '');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadProducts = useCallback(async () => {
    if (!activeSlug) {
      setProducts([]);
      return;
    }
    try {
      setProducts(await adminListProducts(activeSlug, token));
    } catch (reason) {
      setError(reason.message);
    }
  }, [activeSlug, token]);

  useEffect(() => {
    if (customer?.role === 'admin') loadBase();
  }, [customer?.role, loadBase]);

  useEffect(() => {
    if (section === 'products' && activeSlug) loadProducts();
  }, [section, activeSlug, loadProducts]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const openEditor = (type, item = null) => {
    if (type === 'category') {
      setForm(item
        ? { ...EMPTY_FORM, name: item.name, slug: item.slug, collection: item.collection }
        : { ...EMPTY_FORM });
    } else if (type === 'product') {
      const standardKeys = new Set([
        '_id', 'name', 'brand', 'price', 'discount', 'availability', 'sku',
        'category', 'createdAt', 'updatedAt',
      ]);
      const extras = Object.fromEntries(Object.entries(item || {}).filter(([key]) => !standardKeys.has(key)));
      setForm({
        ...EMPTY_FORM,
        name: item?.name || '',
        brand: item?.brand || '',
        price: String(item?.price ?? ''),
        discount: String(item?.discount ?? 0),
        availability: String(item?.availability ?? 0),
        sku: item?.sku || '',
        extraJson: Object.keys(extras).length ? JSON.stringify(extras, null, 2) : '',
      });
    } else if (type === 'coupon') {
      setForm({
        ...EMPTY_FORM,
        code: item?.code || '',
        discountType: item?.discountType || 'percentage',
        discountValue: String(item?.discountValue ?? ''),
        minOrderAmount: String(item?.minOrderAmount ?? 0),
        maxDiscount: item?.maxDiscount == null ? '' : String(item.maxDiscount),
        usageLimit: item?.usageLimit == null ? '' : String(item.usageLimit),
        active: item?.active !== false,
      });
    }
    setEditor({ type, item });
  };

  const saveEditor = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    try {
      if (editor.type === 'category') {
        const body = editor.item
          ? { name: form.name.trim() }
          : { name: form.name.trim(), slug: form.slug.trim(), collection: form.collection };
        if (editor.item) await adminUpdateCategory(editor.item.slug, body, token);
        else await adminCreateCategory(body, token);
      } else if (editor.type === 'product') {
        let extras = {};
        if (form.extraJson.trim()) {
          extras = JSON.parse(form.extraJson);
          if (!extras || Array.isArray(extras) || typeof extras !== 'object') {
            throw new Error('Additional product data must be a JSON object.');
          }
        }
        const body = {
          ...extras,
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          price: Number(form.price),
          discount: Number(form.discount || 0),
          availability: Number(form.availability || 0),
          sku: form.sku.trim() || null,
        };
        if (editor.item) await adminUpdateProduct(activeSlug, editor.item._id, body, token);
        else await adminCreateProduct(activeSlug, body, token);
      } else if (editor.type === 'coupon') {
        const body = {
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          minOrderAmount: Number(form.minOrderAmount || 0),
          maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
          active: form.active,
        };
        if (editor.item) await adminUpdateCoupon(editor.item._id, body, token);
        else await adminCreateCoupon({
          ...body,
          code: form.code.trim().toUpperCase(),
        }, token);
      }
      setEditor(null);
      await loadBase();
      if (editor.type === 'product') await loadProducts();
    } catch (reason) {
      setError(reason instanceof SyntaxError ? 'Additional product data contains invalid JSON.' : reason.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (label, remove) => Alert.alert(
    `Delete ${label}?`,
    'This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await remove();
            await loadBase();
            if (section === 'products') await loadProducts();
          } catch (reason) {
            setError(reason.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ],
  );

  const changeOrderStatus = async (order, status) => {
    setBusy(true);
    setError(null);
    try {
      await adminUpdateOrderStatus(order._id, status, token);
      await loadBase();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  if (customer?.role !== 'admin') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={35} color={colors.blue} />
        <Text style={styles.title}>Administrator access required</Text>
        <Text style={styles.muted}>Sign in with an authorized admin account to manage the store.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>STORE MANAGEMENT</Text>
        <Text style={styles.heroTitle}>Admin console</Text>
        <Text style={styles.heroSubtitle}>Manage catalog, promotions and customer orders.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
        {SECTIONS.map((item) => (
          <Pressable key={item.key} onPress={() => setSection(item.key)} style={[styles.sectionTab, section === item.key && styles.sectionTabActive]}>
            <Ionicons name={item.icon} size={16} color={section === item.key ? '#FFFFFF' : colors.muted} />
            <Text style={[styles.sectionTabText, section === item.key && styles.sectionTabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.blue} /></View>
      ) : (
        <FlatList
          key={section}
          data={section === 'categories' ? categories : section === 'products' ? products : section === 'orders' ? orders : coupons}
          keyExtractor={(item) => item._id || item.slug || item.orderNumber}
          contentContainerStyle={styles.list}
          ListHeaderComponent={section === 'products' ? (
            <View style={styles.productHeader}>
              <SelectField
                label="Product category"
                value={category?.name || ''}
                options={categories.map((item) => item.name)}
                onSelect={(name) => setActiveSlug(categories.find((item) => item.name === name)?.slug || '')}
              />
              <Pressable disabled={!activeSlug} style={styles.primaryButton} onPress={() => openEditor('product')}>
                <Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Add product</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.listHeading}>
              <Text style={styles.listTitle}>{sectionTitle(section)}</Text>
              {section !== 'orders' ? (
                <Pressable style={styles.primaryButton} onPress={() => openEditor(section === 'categories' ? 'category' : 'coupon')}>
                  <Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Add</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nothing to show here yet.</Text>}
          renderItem={({ item }) => {
            if (section === 'categories') {
              return <ManagedCard title={item.name} subtitle={`${item.slug} · ${item.collection}`} onEdit={() => openEditor('category', item)} onDelete={() => confirmDelete(item.name, () => adminDeleteCategory(item.slug, token))} />;
            }
            if (section === 'products') {
              return <ManagedCard title={item.name} subtitle={`${item.brand || 'Unbranded'} · ${formatPrice(item.price)} · stock ${item.availability ?? 0}`} onEdit={() => openEditor('product', item)} onDelete={() => confirmDelete(item.name, () => adminDeleteProduct(activeSlug, item._id, token))} />;
            }
            if (section === 'coupons') {
              const description = `${item.discountValue}${item.discountType === 'percentage' ? '%' : ' ৳'} discount · ${item.active ? 'Active' : 'Inactive'}`;
              return <ManagedCard title={item.code} subtitle={description} onEdit={() => openEditor('coupon', item)} onDelete={() => confirmDelete(item.code, () => adminDeleteCoupon(item._id, token))} />;
            }
            const status = item.status || 'placed';
            const actions = status === 'placed' || status === 'pending'
              ? [['accepted', 'Accept'], ['cancelled', 'Cancel']]
              : status === 'accepted'
                ? [[
                  'delivered',
                  item.deliveryInventoryStatus === 'processing' ? 'Resume delivery' : 'Mark delivered',
                ], ['cancelled', 'Cancel']]
                : [];
            return (
              <View style={styles.orderCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{item.orderNumber || item._id}</Text>
                  <Text style={styles.status}>{status}</Text>
                </View>
                <Text style={styles.cardSubtitle}>{item.customer?.name || 'Guest'} · {item.customer?.phone || 'No phone'}</Text>
                <Text style={styles.orderTotal}>{formatPrice(item.total)}</Text>
                {actions.length ? (
                  <View style={styles.orderActions}>
                    {actions.map(([nextStatus, label]) => (
                      <Pressable key={nextStatus} disabled={busy} onPress={() => changeOrderStatus(item, nextStatus)} style={[styles.statusButton, nextStatus === 'cancelled' && styles.cancelButton]}>
                        <Text style={[styles.statusButtonText, nextStatus === 'cancelled' && styles.cancelButtonText]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }}
          refreshing={busy}
          onRefresh={loadBase}
        />
      )}

      <Modal visible={Boolean(editor)} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={() => setEditor(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editor ? `${editor.item ? 'Edit' : 'Add'} ${editor.type}` : ''}</Text>
              <Pressable onPress={() => setEditor(null)}><Ionicons name="close" size={23} color={colors.text} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              {editor?.type === 'category' ? (
                <>
                  <FormField label="Category name" value={form.name} onChangeText={(value) => update('name', value)} />
                  {!editor.item ? (
                    <>
                      <FormField label="URL slug (lowercase-with-hyphens)" value={form.slug} onChangeText={(value) => update('slug', value)} autoCapitalize="none" />
                      <SelectField label="Product collection" value={form.collection} options={COLLECTIONS} onSelect={(value) => update('collection', value)} />
                    </>
                  ) : null}
                </>
              ) : null}
              {editor?.type === 'product' ? (
                <>
                  <FormField label="Product name" value={form.name} onChangeText={(value) => update('name', value)} />
                  <FormField label="Brand" value={form.brand} onChangeText={(value) => update('brand', value)} />
                  <FormField label="Price" value={form.price} onChangeText={(value) => update('price', value)} keyboardType="numeric" />
                  <FormField label="Discount percentage" value={form.discount} onChangeText={(value) => update('discount', value)} keyboardType="numeric" />
                  <FormField label="Available stock" value={form.availability} onChangeText={(value) => update('availability', value)} keyboardType="numeric" />
                  <FormField label="SKU (optional)" value={form.sku} onChangeText={(value) => update('sku', value)} />
                  <FormField label="Additional category fields (JSON object)" value={form.extraJson} onChangeText={(value) => update('extraJson', value)} multiline autoCapitalize="none" placeholder={'{"description":"...","features":[]}'} />
                </>
              ) : null}
              {editor?.type === 'coupon' ? (
                <>
                  {!editor.item ? <FormField label="Coupon code" value={form.code} onChangeText={(value) => update('code', value)} autoCapitalize="characters" /> : null}
                  <SelectField label="Discount type" value={form.discountType} options={['percentage', 'fixed']} onSelect={(value) => update('discountType', value)} />
                  <FormField label="Discount value" value={form.discountValue} onChangeText={(value) => update('discountValue', value)} keyboardType="numeric" />
                  <FormField label="Minimum order amount" value={form.minOrderAmount} onChangeText={(value) => update('minOrderAmount', value)} keyboardType="numeric" />
                  <FormField label="Maximum discount (optional)" value={form.maxDiscount} onChangeText={(value) => update('maxDiscount', value)} keyboardType="numeric" />
                  <FormField label="Usage limit (optional)" value={form.usageLimit} onChangeText={(value) => update('usageLimit', value)} keyboardType="numeric" />
                  <Pressable onPress={() => update('active', !form.active)} style={styles.activeToggle}>
                    <Ionicons name={form.active ? 'checkbox' : 'square-outline'} size={19} color={colors.blue} />
                    <Text style={styles.cardSubtitle}>Coupon is active</Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
            <Pressable disabled={busy} onPress={saveEditor} style={[styles.primaryButton, styles.saveButton, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ManagedCard({ title, subtitle, onEdit, onDelete }) {
  return (
    <View style={styles.managedCard}>
      <View style={styles.managedCopy}>
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Pressable onPress={onEdit} style={styles.iconButton} accessibilityLabel={`Edit ${title}`}>
        <Ionicons name="create-outline" size={18} color={colors.blue} />
      </Pressable>
      <Pressable onPress={onDelete} style={styles.iconButton} accessibilityLabel={`Delete ${title}`}>
        <Ionicons name="trash-outline" size={17} color={colors.red} />
      </Pressable>
    </View>
  );
}

function sectionTitle(section) {
  return SECTIONS.find((item) => item.key === section)?.label || 'Manage';
}


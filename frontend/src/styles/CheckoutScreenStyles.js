import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 35, gap: 15, backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: colors.blue, fontSize: 13, fontWeight: '800' },
  note: { backgroundColor: colors.blueLight, borderRadius: 13, padding: 12 },
  noteText: { color: '#315A84', fontSize: 11, lineHeight: 16 },
  groupLabel: { color: colors.text, fontSize: 12, fontWeight: '900' },
  paymentRow: { gap: 9 },
  paymentOption: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13 },
  paymentSelected: { borderColor: colors.blue },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.muted },
  radioSelected: { borderWidth: 5, borderColor: colors.blue },
  paymentText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: 15, borderRadius: 14 },
  totalCard: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12 },
  total: { color: colors.text, fontSize: 18, fontWeight: '900' },
  deliveryHint: { color: colors.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 15 },
  coupon: { color: colors.green, fontWeight: '800', fontSize: 12 },
  error: { color: colors.red, fontSize: 12 },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});

export default styles;

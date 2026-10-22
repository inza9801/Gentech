import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 11, fontWeight: '800' },
  select: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disabled: { opacity: 0.55 },
  value: { color: colors.text, fontSize: 13 },
  placeholder: { color: colors.muted },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0008' },
  sheet: { maxHeight: '70%', backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  option: { minHeight: 47, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { color: colors.muted, paddingVertical: 20, textAlign: 'center' },
});

export default styles;

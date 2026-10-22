import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

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
  tabBadge: { backgroundColor: colors.red, color: '#FFFFFF', fontSize: 9 },
  stackScreen: { flex: 1, backgroundColor: colors.background },
  screenHeader: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  headerTitle: {
    flex: 1,
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: 10,
  },
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

export default styles;

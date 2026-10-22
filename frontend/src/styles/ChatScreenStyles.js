import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kicker: { color: colors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 27 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#AAB9CC', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 295 },
  content: {
    margin: 18,
    marginTop: 22,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: { width: 76, height: 76, borderRadius: 26, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 16 },
  cardText: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  button: { width: '100%', height: 48, marginTop: 20, borderRadius: 15, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  availabilityText: { color: colors.muted, fontSize: 10 },
});

export default styles;

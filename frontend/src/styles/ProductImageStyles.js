import { StyleSheet } from 'react-native';


const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { width: '100%', height: 124, borderRadius: 15 },
  row: { width: 70, height: 70, borderRadius: 14 },
  large: { width: '100%', height: 300, borderRadius: 24 },
  image: { width: '100%', height: '100%' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default styles;

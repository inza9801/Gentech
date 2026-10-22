import styles from '../styles/BrandMarkStyles';
import { Image } from 'react-native';

export function BrandMark({ compact = false }) {
  return (
    <Image
      source={require('../../assets/gentech-logo-cropped.png')}
      resizeMode="contain"
      style={compact ? styles.logoCompact : styles.logo}
    />
  );
}

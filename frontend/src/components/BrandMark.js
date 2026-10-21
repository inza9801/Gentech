import { Image, StyleSheet, View } from 'react-native';

export function BrandMark({ compact = false }) {
  return (
    <View style={[styles.crop, compact && styles.cropCompact]}>
      <View style={[styles.imageCanvas, compact && styles.imageCanvasCompact]}>
        <Image
          source={require('../../assets/gentech-logo.png')}
          resizeMode="stretch"
          style={[styles.logoImage, compact && styles.logoImageCompact]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  crop: {
    width: 124,
    height: 40,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  cropCompact: { width: 110, height: 34 },
  imageCanvas: {
    width: 183,
    height: 96,
    position: 'absolute',
    left: -29,
    top: -27,
  },
  imageCanvasCompact: {
    width: 162,
    height: 85,
    left: -26,
    top: -24,
  },
  logoImage: { width: '100%', height: '100%' },
  logoImageCompact: { width: '100%', height: '100%' },
});

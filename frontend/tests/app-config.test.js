import { describe, expect, it } from 'vitest';
import { expo } from '../app.json';

describe('Expo app configuration', () => {
  it('keeps the application identity and supported platforms configured', () => {
    expect(expo.name).toBe('GenTech');
    expect(expo.slug).toBe('gentech');
    expect(expo.ios).toBeDefined();
    expect(expo.android).toBeDefined();
    expect(expo.orientation).toBe('portrait');
  });

  it('keeps the app-level Expo plugins enabled', () => {
    expect(expo.plugins).toEqual(
      expect.arrayContaining(['expo-font', 'expo-status-bar']),
    );
  });
});

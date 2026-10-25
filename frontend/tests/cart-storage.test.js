import { describe, expect, it } from 'vitest';
import { getCartStorageKey } from '../src/utils/cartStorageKey';

describe('cart storage keys', () => {
  it('keeps each signed-in customer cart separate from other accounts and guests', () => {
    expect(getCartStorageKey('customer-a')).not.toBe(
      getCartStorageKey('customer-b'),
    );
    expect(getCartStorageKey('customer-a')).not.toBe(getCartStorageKey(null));
  });

  it('uses the guest cart for an absent customer ID', () => {
    expect(getCartStorageKey(null)).toBe(getCartStorageKey(''));
    expect(getCartStorageKey('   ')).toBe(getCartStorageKey(undefined));
  });
});

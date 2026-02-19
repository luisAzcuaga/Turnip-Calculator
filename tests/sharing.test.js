import { decodeFromBase64, encodeToBase64, getDataFromURL } from '../lib/ui/sharing.js';
import { describe, expect, it } from "vitest";

describe('encodeToBase64', () => {
  it('produces a non-empty base64 string', () => {
    const data = { buyPrice: '100', previousPattern: 'fluctuating' };
    const result = encodeToBase64(data);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('round-trips correctly with decodeFromBase64', () => {
    const data = {
      buyPrice: '100',
      previousPattern: 'large_spike',
      mon_am: '80',
      mon_pm: '75',
      tue_am: '200'
    };
    const encoded = encodeToBase64(data);
    const decoded = decodeFromBase64(encoded);
    expect(decoded.buyPrice).toBe('100');
    expect(decoded.previousPattern).toBe('large_spike');
    expect(decoded.mon_am).toBe('80');
    expect(decoded.mon_pm).toBe('75');
    expect(decoded.tue_am).toBe('200');
  });

  it('round-trips with no previousPattern', () => {
    const data = { buyPrice: '95', previousPattern: '', mon_am: '85' };
    const encoded = encodeToBase64(data);
    const decoded = decodeFromBase64(encoded);
    expect(decoded.buyPrice).toBe('95');
    expect(decoded.previousPattern).toBe('');
    expect(decoded.mon_am).toBe('85');
  });

  it('round-trips with all 12 price periods', () => {
    const data = {
      buyPrice: '100',
      previousPattern: 'decreasing',
      mon_am: '88', mon_pm: '84', tue_am: '80', tue_pm: '76',
      wed_am: '72', wed_pm: '68', thu_am: '64', thu_pm: '60',
      fri_am: '56', fri_pm: '52', sat_am: '48', sat_pm: '44'
    };
    const encoded = encodeToBase64(data);
    const decoded = decodeFromBase64(encoded);
    expect(decoded.buyPrice).toBe('100');
    expect(decoded.sat_pm).toBe('44');
  });

  it('trims trailing empty price slots to keep the encoded string short', () => {
    const sparse = encodeToBase64({ buyPrice: '100', previousPattern: '', mon_am: '90' });
    const full = encodeToBase64({
      buyPrice: '100', previousPattern: '', mon_am: '90',
      sat_pm: '50'
    });
    expect(sparse.length).toBeLessThan(full.length);
  });
});

describe('decodeFromBase64', () => {
  it('returns null for null input', () => {
    expect(decodeFromBase64(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeFromBase64('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(decodeFromBase64(123)).toBeNull();
    expect(decodeFromBase64(undefined)).toBeNull();
  });

  it('returns null for a valid base64 string with fewer than 2 chunks', () => {
    // btoa('onlyone') has no pipe character
    expect(decodeFromBase64(btoa('onlyone'))).toBeNull();
  });

  it('returns null for a completely malformed (non-base64) string', () => {
    expect(decodeFromBase64('!!!not-base64!!!')).toBeNull();
  });

  it('handles an unknown pattern letter gracefully', () => {
    // 'x' is not in PATTERN_DECODE_MAP → previousPattern should be ''
    const encoded = btoa('100|x|80');
    const result = decodeFromBase64(encoded);
    expect(result.previousPattern).toBe('');
    expect(result.buyPrice).toBe('100');
  });
});

describe('getDataFromURL', () => {
  it('returns null for an empty search string', () => {
    expect(getDataFromURL('')).toBeNull();
  });

  it('returns null when the turnipData param is absent', () => {
    expect(getDataFromURL('?foo=bar')).toBeNull();
  });

  it('returns decoded data for a valid ?turnipData= search string', () => {
    const data = { buyPrice: '100', previousPattern: 'small_spike', mon_am: '90' };
    const encoded = encodeToBase64(data);
    const result = getDataFromURL(`?turnipData=${encoded}`);
    expect(result).not.toBeNull();
    expect(result.buyPrice).toBe('100');
    expect(result.previousPattern).toBe('small_spike');
    expect(result.mon_am).toBe('90');
  });

  it('returns null when the turnipData param contains malformed data', () => {
    expect(getDataFromURL('?turnipData=!!!bad!!!')).toBeNull();
  });
});

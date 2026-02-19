import { PATTERN_DECODE_MAP, PATTERN_ENCODE_MAP, PRICE_INPUT_IDS } from "./constants.js";

// Encode data to base64 for URL sharing
// Compact format: buyPrice|pattern|price1|price2|...|price12
// pattern: f=fluctuating, l=large_spike, s=small_spike, d=decreasing, empty=none
export function encodeToBase64(data) {
  try {
    const chunks = [
      data.buyPrice || '',
      PATTERN_ENCODE_MAP[data.previousPattern] || ''
    ];

    PRICE_INPUT_IDS.forEach(id => {
      chunks.push(data[id] || '');
    });

    // Remove trailing empty values to save space
    while (chunks.length > 2 && chunks[chunks.length - 1] === '') {
      chunks.pop();
    }

    const compactString = chunks.join('|');
    return btoa(compactString);
  } catch (e) {
    console.error('Error encoding data to base64:', e);
    return null;
  }
}

// Decode base64 from URL to data
// Compact format: buyPrice|pattern|price1|price2|...|price12
export function decodeFromBase64(base64String) {
  try {
    if (!base64String || typeof base64String !== 'string') {
      return null;
    }

    const decoded = atob(base64String);
    const chunks = decoded.split('|');

    if (chunks.length < 2) {
      return null;
    }

    const data = {
      buyPrice: chunks[0] || '',
      previousPattern: PATTERN_DECODE_MAP[chunks[1]] || ''
    };

    PRICE_INPUT_IDS.forEach((id, index) => {
      const value = chunks[index + 2];
      if (value) {
        data[id] = value;
      }
    });

    return data;
  } catch (e) {
    console.error('Error decoding data from base64:', e);
    return null;
  }
}

// Get data from a URL search string (e.g. window.location.search)
export function getDataFromURL(searchString) {
  const urlParams = new URLSearchParams(searchString);
  const encoded = urlParams.get('turnipData');
  return encoded ? decodeFromBase64(encoded) : null;
}

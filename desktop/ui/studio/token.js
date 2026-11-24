/**
 * Resolve the loopback token for the Studio frame.
 *
 * The desktop shell persists the token in sessionStorage under the same key
 * this module reads. An iframe shares that session with its parent, whereas
 * localStorage is a different store; reading localStorage first makes the
 * in-app wizard look permanently unauthenticated. URL wins, session next,
 * local is only a standalone-browser fallback.
 */

export const TOKEN_KEY = 'maestro.desktop.token';

/**
 * @param {string} search window.location.search
 * @param {{sessionStorage?: object, localStorage?: object}} storages
 * @returns {string} token or empty string
 */
export function readDesktopToken(search = '', storages = {}) {
  try {
    const fromUrl = new URLSearchParams(search).get('token');
    if (fromUrl) return fromUrl;
  } catch {
    // A malformed query must not blank the page.
  }
  for (const storage of [storages.sessionStorage, storages.localStorage]) {
    try {
      const value = storage?.getItem?.(TOKEN_KEY);
      if (typeof value === 'string' && value.length > 0) return value;
    } catch {
      // A blocked storage must never blank the wizard.
    }
  }
  return '';
}

/**
 * Environment detection utilities for Sphere transport selection.
 *
 * Priority order:
 *   P1 — inside Sphere iframe  → PostMessageTransport to parent window
 *   P2 — extension installed   → ExtensionTransport via chrome extension
 *   P3 — standalone page       → PostMessageTransport to popup window
 *
 * Source: official sphere-sdk-connect-example
 */

/** Returns true when the page is running inside an iframe. */
export function isInIframe(): boolean {
  try {
    return window.parent !== window && window.self !== window.top;
  } catch {
    return true;
  }
}

/** Returns true when the Sphere browser extension is installed and active. */
export function hasExtension(): boolean {
  try {
    const sphere = (window as unknown as Record<string, unknown>).sphere;
    if (!sphere || typeof sphere !== 'object') return false;
    const isInstalled = (sphere as Record<string, unknown>).isInstalled;
    if (typeof isInstalled !== 'function') return false;
    return (isInstalled as () => boolean)() === true;
  } catch {
    return false;
  }
}

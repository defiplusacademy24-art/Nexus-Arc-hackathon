/** True when the user is on a phone/tablet browser (not a desktop wallet in-app browser). */
export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** True when running inside a wallet's in-app browser (has injected provider on mobile). */
export function isWalletInAppBrowser(): boolean {
  return isMobileBrowser() && typeof window !== 'undefined' && Boolean(
    (window as Window & { ethereum?: unknown }).ethereum,
  );
}
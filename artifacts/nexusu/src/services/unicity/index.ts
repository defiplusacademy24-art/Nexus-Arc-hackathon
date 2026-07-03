/**
 * Public barrel for all Unicity-related functionality.
 * Import from here — not from individual service files.
 */

export * from './identity';
export * from './session';
export * from './assets';
export * from './profile';
export {
  WALLET_URL,
  WALLET_INSTALL_URL,
  WALLET_EXTENSION_URL,
  NEXUSU_DAPP,
  WALLET_EVENTS,
  waitForHostReady,
  buildClient,
  createExtensionTransport,
  createIframeTransport,
  createPopupTransport,
  openWalletPopup,
} from './wallet';
export type {
  PublicIdentity,
  PermissionScope,
  RpcMethod,
  IntentAction,
} from './wallet';

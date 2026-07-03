/**
 * UnicityProvider — React context that exposes the Sphere wallet connection
 * to the entire Nexusu app tree. Wrap the app root with this provider.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useUnicityWallet, type UseUnicityWallet } from '@/hooks/useUnicityWallet';

const UnicityContext = createContext<UseUnicityWallet | null>(null);

interface UnicityProviderProps {
  children: ReactNode;
}

export function UnicityProvider({ children }: UnicityProviderProps) {
  const wallet = useUnicityWallet();
  return (
    <UnicityContext.Provider value={wallet}>
      {children}
    </UnicityContext.Provider>
  );
}

/**
 * Access the Unicity wallet from any component.
 * Must be used inside <UnicityProvider>.
 */
export function useUnicity(): UseUnicityWallet {
  const ctx = useContext(UnicityContext);
  if (!ctx) {
    throw new Error('useUnicity must be used inside <UnicityProvider>');
  }
  return ctx;
}

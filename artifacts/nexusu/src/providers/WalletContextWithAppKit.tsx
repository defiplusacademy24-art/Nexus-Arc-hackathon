import { useAppKit } from '@reown/appkit/react';
import type { ReactNode } from 'react';
import { WalletContextBridge } from '@/providers/WalletContextBridge';

export function WalletContextWithAppKit({ children }: { children: ReactNode }) {
  const { open } = useAppKit();

  const openConnectModal = async () => {
    await open({ view: 'Connect' });
  };

  return (
    <WalletContextBridge openModal={openConnectModal}>
      {children}
    </WalletContextBridge>
  );
}
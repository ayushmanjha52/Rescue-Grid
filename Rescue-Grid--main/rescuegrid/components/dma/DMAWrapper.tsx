'use client';

import { AIAssistantProvider, useAIAssistant } from '@/components/dma/AIAssistantProvider';
import { CountersProvider } from '@/components/dma/CountersProvider';
import Topbar from '@/components/dma/Topbar';
import OperationalToast from '@/components/shared/OperationalToast';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';

function DMAContent({ children }: { children: ReactNode }) {
  const [loginTime] = useState(() => new Date());
  const { isOpen: aiDrawerOpen, toggle: toggleAI } = useAIAssistant();

  return (
    <>
      <Topbar loginTime={loginTime} aiAssistantOpen={aiDrawerOpen} onToggleAI={toggleAI} />
      <OperationalToast />
      {children}
    </>
  );
}

export function DMAWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The login screen has no session yet — render it without the command shell.
  if (pathname.startsWith('/dma/login')) {
    return <>{children}</>;
  }

  return (
    <CountersProvider>
      <AIAssistantProvider>
        <DMAContent>{children}</DMAContent>
      </AIAssistantProvider>
    </CountersProvider>
  );
}

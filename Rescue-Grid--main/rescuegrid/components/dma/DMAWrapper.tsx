'use client';

import { AIAssistantProvider, useAIAssistant } from '@/components/dma/AIAssistantProvider';
import { CountersProvider } from '@/components/dma/CountersProvider';
import Topbar from '@/components/dma/Topbar';
import { ReactNode, useState } from 'react';

function DMAContent({ children }: { children: ReactNode }) {
  const [loginTime] = useState(() => new Date());
  const { isOpen: aiDrawerOpen, toggle: toggleAI } = useAIAssistant();

  return (
    <>
      <Topbar loginTime={loginTime} aiAssistantOpen={aiDrawerOpen} onToggleAI={toggleAI} />
      {children}
    </>
  );
}

export function DMAWrapper({ children }: { children: ReactNode }) {
  return (
    <CountersProvider>
      <AIAssistantProvider>
        <DMAContent>{children}</DMAContent>
      </AIAssistantProvider>
    </CountersProvider>
  );
}
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AIAssistantDrawer } from './AIAssistantDrawer';

interface AIAssistantContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AIAssistantContext = createContext<AIAssistantContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function useAIAssistant() {
  return useContext(AIAssistantContext);
}

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <AIAssistantContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
      <AIAssistantDrawer isOpen={isOpen} onClose={close} />
    </AIAssistantContext.Provider>
  );
}

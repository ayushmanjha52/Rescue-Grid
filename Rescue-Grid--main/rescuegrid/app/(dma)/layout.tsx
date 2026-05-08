'use client';

import { DMAWrapper } from '@/components/dma/DMAWrapper';
import { ReactNode } from 'react';

export default function DmaLayout({ children }: { children: ReactNode }) {
  return <DMAWrapper>{children}</DMAWrapper>;
}
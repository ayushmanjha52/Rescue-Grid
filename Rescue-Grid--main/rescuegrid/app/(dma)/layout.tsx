import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { DMAWrapper } from '@/components/dma/DMAWrapper';

export const metadata: Metadata = {
  title: 'DMA Command Center',
  robots: { index: false, follow: false },
};

export default function DmaLayout({ children }: { children: ReactNode }) {
  return <DMAWrapper>{children}</DMAWrapper>;
}

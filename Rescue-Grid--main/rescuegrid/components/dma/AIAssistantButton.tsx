'use client';

import { Sparkles, Command } from 'lucide-react';
import { motion } from 'framer-motion';

interface AIAssistantButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function AIAssistantButton({ isOpen, onClick }: AIAssistantButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative flex items-center gap-2 px-3 py-1.5 
        font-mono text-[11px] uppercase tracking-[0.15em] 
        transition-all duration-150
        ${isOpen 
          ? 'text-orange bg-orange/10' 
          : 'text-dim hover:text-ink hover:bg-gray-100'
        }
      `}
    >
      <motion.div
        animate={!isOpen ? { rotate: [0, -10, 10, 0] } : {}}
        transition={{ duration: 0.5, repeat: !isOpen ? Infinity : 0, repeatDelay: 3 }}
      >
        <Sparkles className="w-4 h-4" />
      </motion.div>
      <span>INTEL</span>
      <span className="hidden lg:flex items-center gap-0.5 text-[9px] text-dim/60 px-1.5 py-0.5 bg-gray-100 rounded">
        <Command className="w-3 h-3" />
        <span>K</span>
      </span>
    </motion.button>
  );
}

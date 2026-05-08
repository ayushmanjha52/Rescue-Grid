'use client';

import { Sparkles } from 'lucide-react';
import { useAIAssistant } from './AIAssistantProvider';
import { motion } from 'framer-motion';

export function AIFloatingButton() {
  const { open } = useAIAssistant();

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={open}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-purple-500/40 transition-shadow"
      aria-label="Open DRIS Assistant"
    >
      <Sparkles className="w-6 h-6 text-white" />
    </motion.button>
  );
}

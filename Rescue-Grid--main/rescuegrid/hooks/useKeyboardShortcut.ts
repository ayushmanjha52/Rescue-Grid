import { useEffect } from 'react';

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { meta?: boolean; ctrl?: boolean } = {}
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = options.meta ? event.metaKey : true;
      const isCtrl = options.ctrl ? event.ctrlKey : true;
      
      if (event.key.toLowerCase() === key.toLowerCase() && isMeta && isCtrl) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options.meta, options.ctrl]);
}

'use client';

import { useOperationalAlerts, OperationalAlert } from '@/hooks/useOperationalAlerts';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Bell, ShieldAlert, AlertTriangle, CheckCircle2, Navigation, Star, Info } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  broadcast: Bell,
  mission: Star,
  intel: Info,
  caution: ShieldAlert,
};

export default function OperationalToast() {
  const { alerts, dismissAlert } = useOperationalAlerts();

  return (
    <div className="fixed top-20 left-0 right-0 z-[9999] flex flex-col items-center gap-3 pointer-events-none px-4">
      <AnimatePresence>
        {alerts.map((alert) => {
          const Icon = ICON_MAP[alert.type] || Info;

          return (
            <motion.div
              key={alert.id}
              initial={{ y: -50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ x: 100, opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-surface-2 border border-border-dim shadow-[0_10px_30px_rgba(0,0,0,0.5)] pointer-events-auto overflow-hidden flex transition-all hover:scale-[1.02]"
              style={{ borderLeft: `3px solid ${alert.color}` }}
            >
              <div className="p-3 flex-1">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: alert.color }} />
                    <span className="font-mono text-[9px] font-black uppercase tracking-widest text-dim">
                      {alert.title}
                    </span>
                  </div>
                  <button 
                    onClick={() => dismissAlert(alert.id)} 
                    className="text-dim hover:text-orange transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <h4 className="font-body font-bold text-ink text-[13px] leading-tight mb-2">
                  {alert.message}
                </h4>
                
                <div className="flex items-center gap-3 font-mono text-[9px] font-bold text-dim uppercase tracking-tighter">
                  <span>SYSTEM ALERT</span>
                  <span>•</span>
                  <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {alert.type === 'caution' && (
                <div className="bg-alert/10 px-3 flex items-center justify-center border-l border-alert/20">
                  <AlertTriangle className="w-5 h-5 text-alert animate-pulse" />
                </div>
              )}
              {alert.type === 'broadcast' && (
                <div className="bg-orange/10 px-3 flex items-center justify-center border-l border-orange/20">
                  <Bell className="w-5 h-5 text-orange" />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

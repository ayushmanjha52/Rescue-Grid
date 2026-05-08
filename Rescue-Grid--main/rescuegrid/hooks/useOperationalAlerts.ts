'use client';

import { useState, useCallback } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';

export interface OperationalAlert {
  id: string;
  type: 'broadcast' | 'mission' | 'intel' | 'caution';
  title: string;
  message: string;
  timestamp: string;
  color: string;
  isRead: boolean;
}

const TYPE_COLORS = {
  broadcast: '#FF6B2B',
  mission: '#2ECC71',
  intel: '#3B8BFF',
  caution: '#F5A623',
};

export function useOperationalAlerts() {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);

  const addAlert = useCallback((alert: Omit<OperationalAlert, 'id' | 'timestamp' | 'isRead'>) => {
    const newAlert: OperationalAlert = {
      ...alert,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 5));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useRealtimeSubscription([
    {
      table: 'assignment',
      onInsert: (payload: any) => {
        addAlert({
          type: 'mission',
          title: 'New Assignment',
          message: `Task: ${payload.task}`,
          color: TYPE_COLORS.mission,
        });
      },
      onUpdate: (payload: any) => {
        if (payload.status === 'completed') {
          addAlert({
            type: 'mission',
            title: 'Mission Completed',
            message: `Task: ${payload.task} has been finished.`,
            color: TYPE_COLORS.mission,
          });
        }
      },
    },
    {
      table: 'victim_report',
      onInsert: (payload: any) => {
        if (payload.urgency === 'critical') {
          addAlert({
            type: 'caution',
            title: 'CRITICAL NEED',
            message: `New critical report from ${payload.city || 'Unknown'}.`,
            color: TYPE_COLORS.caution,
          });
        }
      },
    },
  ]);

  return { alerts, dismissAlert };
}

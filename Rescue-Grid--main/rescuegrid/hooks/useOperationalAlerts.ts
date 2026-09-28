'use client';

import { useState, useCallback, useRef } from 'react';
import { useRealtimeSubscription } from '@/lib/realtime';

export interface OperationalAlert {
  id: string;
  type: 'broadcast' | 'mission' | 'intel' | 'caution';
  title: string;
  message: string;
  timestamp: string;
  color: string;
  isRead: boolean;
  /** Where "View" takes the operator. */
  href?: string;
}

interface ReportRow {
  id?: string;
  urgency?: string;
  situation?: string;
  city?: string | null;
  district?: string | null;
}

interface MessageRow {
  id?: string;
  sender_type?: string;
  sender_id?: string | null;
  task_force_id?: string | null;
  victim_report_id?: string | null;
  assignment_id?: string | null;
  is_flagged_for_dma?: boolean;
  read_at?: string | null;
  content?: string;
}

interface VolunteerRow {
  name?: string;
  auth_id?: string | null;
}

const TYPE_COLORS = {
  broadcast: '#C44A12',
  mission: '#1E8449',
  intel: '#1F5FCC',
  caution: '#B45309',
};

const MAX_ALERTS = 5;
const AUTO_DISMISS_MS = 12000;

function preview(content: string | undefined, fallback: string) {
  return content?.replace(/\s+/g, ' ').slice(0, 140) || fallback;
}

/** Where a message is read in the dashboard. */
function messageHref(row: MessageRow) {
  if (row.assignment_id) return `/dma/assignments?open=${row.assignment_id}`;
  if (row.victim_report_id) return `/dma/messages?report=${row.victim_report_id}`;
  if (row.task_force_id) return `/dma/messages?tf=${row.task_force_id}`;
  if (row.sender_id) return `/dma/messages?volunteer=${row.sender_id}`;
  return '/dma/messages';
}

/**
 * Live operational toasts for the DMA dashboard: new reports, people joining
 * as volunteers, responders' mission updates and incoming messages.
 *
 * Supabase sends only the primary key as the "old" row for tables with RLS,
 * so alerts are driven by inserts rather than by comparing old and new values.
 */
export function useOperationalAlerts() {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const alertedMessages = useRef(new Set<string>());

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addAlert = useCallback((alert: Omit<OperationalAlert, 'id' | 'timestamp' | 'isRead'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAlerts((prev) => [{ ...alert, id, timestamp: new Date().toISOString(), isRead: false }, ...prev].slice(0, MAX_ALERTS));
    setTimeout(() => dismissAlert(id), AUTO_DISMISS_MS);
  }, [dismissAlert]);

  /** Alerts at most once per message and kind (a later flag still alerts). */
  const alertOnce = (
    row: MessageRow,
    alert: Omit<OperationalAlert, 'id' | 'timestamp' | 'isRead'>,
    kind: 'message' | 'flag' = 'message'
  ) => {
    if (row.id) {
      const key = `${kind}:${row.id}`;
      if (alertedMessages.current.has(key)) return;
      alertedMessages.current.add(key);
    }
    addAlert(alert);
  };

  const flaggedAlert = (row: MessageRow) =>
    alertOnce(row, {
      type: 'caution',
      title: row.assignment_id ? '⚑ Urgent mission update' : '⚑ Flagged for DMA',
      message: preview(row.content, 'A message was flagged for your attention'),
      color: TYPE_COLORS.caution,
      href: messageHref(row),
    }, 'flag');

  useRealtimeSubscription<Record<string, unknown>>([
    {
      table: 'victim_report',
      onInsert: (payload) => {
        const row = payload as ReportRow;
        const place = [row.city, row.district].filter(Boolean).join(', ') || 'unknown location';
        const href = row.id ? `/dma/messages?report=${row.id}` : '/dma/dashboard';
        if (row.urgency === 'critical') {
          addAlert({
            type: 'caution',
            title: 'CRITICAL NEED',
            message: `New ${row.situation || ''} report from ${place}.`.replace(/\s+/g, ' '),
            color: TYPE_COLORS.caution,
            href,
          });
        } else {
          addAlert({
            type: 'intel',
            title: 'New Report',
            message: `${(row.situation || 'Emergency').toUpperCase()} · ${place}`,
            color: TYPE_COLORS.intel,
            href,
          });
        }
      },
    },
    {
      table: 'volunteer',
      onInsert: (payload) => {
        const row = payload as VolunteerRow;
        // Walk-ins are registered by an operator, who already knows.
        if (!row.auth_id) return;
        addAlert({
          type: 'mission',
          title: '🙋 New volunteer joined',
          message: `${row.name || 'Someone'} signed up and is ready to be briefed.`,
          color: TYPE_COLORS.mission,
          href: '/dma/volunteers?filter=new',
        });
      },
    },
    {
      table: 'message',
      onInsert: (payload) => {
        const row = payload as MessageRow;
        if (row.sender_type === 'dma') return;

        if (row.is_flagged_for_dma) {
          flaggedAlert(row);
        } else if (row.assignment_id) {
          alertOnce(row, {
            type: 'mission',
            title: 'Mission update',
            message: preview(row.content, 'A responder posted an update'),
            color: TYPE_COLORS.mission,
            href: messageHref(row),
          });
        } else if (row.sender_type === 'victim') {
          alertOnce(row, {
            type: 'intel',
            title: 'Message from victim',
            message: preview(row.content, 'New message'),
            color: TYPE_COLORS.intel,
            href: messageHref(row),
          });
        } else if (row.sender_type === 'volunteer' && !row.task_force_id) {
          alertOnce(row, {
            type: 'intel',
            title: 'Message from volunteer',
            message: preview(row.content, 'New message'),
            color: TYPE_COLORS.intel,
            href: messageHref(row),
          });
        }
        // Ordinary team-room chatter doesn't raise an alert.
      },
      onUpdate: (payload) => {
        const row = payload as MessageRow;
        // A volunteer flagged an existing message. Reading a message also sends
        // an update, so unread-and-flagged is the condition, deduplicated by id.
        if (row.is_flagged_for_dma && !row.read_at && row.sender_type !== 'dma') flaggedAlert(row);
      },
    },
  ]);

  return { alerts, dismissAlert };
}

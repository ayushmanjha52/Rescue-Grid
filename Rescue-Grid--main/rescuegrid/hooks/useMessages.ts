'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ChannelType =
  | { type: 'taskforce'; taskForceId: string }
  | { type: 'victim_thread'; victimReportId: string }
  | { type: 'direct'; otherUserId: string };

export interface Message {
  id: string;
  content: string;
  sender_type: 'volunteer' | 'dma' | 'victim';
  sender_id: string;
  sender_name?: string;
  sender_initials?: string;
  task_force_id?: string;
  victim_report_id?: string;
  receiver_id?: string;
  is_flagged_for_dma: boolean;
  created_at: string;
  read_at?: string;
  is_own: boolean;
  is_private: boolean;
}

const MAX_MESSAGES = 200;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function enrichMessage(msg: Record<string, unknown>, currentUserId: string): Message {
  const sender_name = msg.sender_name as string | undefined;
  return {
    id: msg.id as string,
    content: msg.content as string,
    sender_type: msg.sender_type as 'volunteer' | 'dma' | 'victim',
    sender_id: msg.sender_id as string,
    sender_name,
    sender_initials: sender_name ? getInitials(sender_name) : '??',
    task_force_id: msg.task_force_id as string | undefined,
    victim_report_id: msg.victim_report_id as string | undefined,
    receiver_id: msg.receiver_id as string | undefined,
    is_flagged_for_dma: Boolean(msg.is_flagged_for_dma),
    created_at: msg.created_at as string,
    read_at: msg.read_at as string | undefined,
    is_own: msg.sender_id === currentUserId,
    is_private: msg.receiver_id !== null && msg.receiver_id !== undefined,
  };
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function useMessages(channel: ChannelType, currentUserId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();
  const isInitializedRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('message')
        .select(`
          *,
          sender_name:volunteer!sender_id(name)
        `)
        .order('created_at', { ascending: true })
        .limit(MAX_MESSAGES);

      if (channel.type === 'taskforce') {
        query = query
          .eq('task_force_id', channel.taskForceId)
          .is('receiver_id', null);
      } else if (channel.type === 'victim_thread') {
        query = query.eq('victim_report_id', channel.victimReportId);
      } else if (channel.type === 'direct') {
        query = query
          .is('task_force_id', null)
          .is('victim_report_id', null)
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${channel.otherUserId}),and(sender_id.eq.${channel.otherUserId},receiver_id.eq.${currentUserId})`
          );
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const enriched = (data || []).map((msg: Record<string, unknown>) =>
        enrichMessage(msg, currentUserId)
      );
      setMessages(enriched);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
      isInitializedRef.current = true;
    }
  }, [channel, currentUserId, supabase]);

  const markAsRead = useCallback(async () => {
    if (!currentUserId) return;

    try {
      let filterColumn: string;
      let filterValue: string;

      if (channel.type === 'taskforce') {
        filterColumn = 'task_force_id';
        filterValue = channel.taskForceId;
      } else if (channel.type === 'victim_thread') {
        filterColumn = 'victim_report_id';
        filterValue = channel.victimReportId;
      } else {
        return;
      }

      await supabase
        .from('message')
        .update({ read_at: new Date().toISOString() })
        .eq(filterColumn, filterValue)
        .is('read_at', null)
        .neq('sender_id', currentUserId);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [channel, currentUserId, supabase]);

  const sendMessage = useCallback(
    async (content: string, flagged = false) => {
      if (!content.trim()) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        content: content.trim(),
        sender_type: 'volunteer',
        sender_id: currentUserId,
        sender_name: 'You',
        sender_initials: 'YO',
        task_force_id: channel.type === 'taskforce' ? channel.taskForceId : undefined,
        victim_report_id: channel.type === 'victim_thread' ? channel.victimReportId : undefined,
        receiver_id: channel.type === 'direct' ? channel.otherUserId : undefined,
        is_flagged_for_dma: flagged,
        created_at: new Date().toISOString(),
        is_own: true,
        is_private: false,
      };

      setMessages(prev => [...prev, optimisticMsg]);

      try {
        const insertData: Record<string, unknown> = {
          content: content.trim(),
          sender_type: 'volunteer',
          sender_id: currentUserId,
          is_flagged_for_dma: flagged,
        };

        if (channel.type === 'taskforce') {
          insertData.task_force_id = channel.taskForceId;
        } else if (channel.type === 'victim_thread') {
          insertData.victim_report_id = channel.victimReportId;
        } else if (channel.type === 'direct') {
          insertData.receiver_id = channel.otherUserId;
        }

        const { data, error: insertError } = await supabase
          .from('message')
          .insert(insertData)
          .select(`
            *,
            sender_name:volunteer!sender_id(name)
          `)
          .single();

        if (insertError) throw insertError;

        setMessages(prev => {
          const withoutOptimistic = prev.filter(m => !m.id.startsWith('temp-'));
          const newMsg = enrichMessage(data as Record<string, unknown>, currentUserId);
          if (withoutOptimistic.find(m => m.id === newMsg.id)) {
            return withoutOptimistic;
          }
          return [...withoutOptimistic, newMsg];
        });
      } catch (err) {
        console.error('Error sending message:', err);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        throw err;
      }
    },
    [channel, currentUserId, supabase]
  );

  useEffect(() => {
    isInitializedRef.current = false;
    fetchMessages();
    markAsRead();
  }, [fetchMessages, markAsRead]);

  useEffect(() => {
    if (!isInitializedRef.current) return;

    let filter: string;
    if (channel.type === 'taskforce') {
      filter = `task_force_id=eq.${channel.taskForceId}`;
    } else if (channel.type === 'victim_thread') {
      filter = `victim_report_id=eq.${channel.victimReportId}`;
    } else {
      filter = `receiver_id=eq.${currentUserId}`;
    }

    const channelKey =
      channel.type === 'taskforce'
        ? `use-messages-taskforce:${channel.taskForceId}`
        : channel.type === 'victim_thread'
        ? `use-messages-victim:${channel.victimReportId}`
        : `use-messages-direct:${currentUserId}`;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(channelKey)
      .on(
        'postgres_changes' as const,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message',
          filter,
        },
        (payload) => {
          const newMsg = payload.new as Record<string, unknown>;
          
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            if (newMsg.sender_id === currentUserId) return prev;
            
            const enriched = enrichMessage(newMsg, currentUserId);
            const updated = [...prev, enriched];
            if (updated.length > MAX_MESSAGES) {
              return updated.slice(-MAX_MESSAGES);
            }
            return updated;
          });
        }
      )
      .on(
        'postgres_changes' as const,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message',
          filter,
        },
        (payload) => {
          const updatedMsg = payload.new as Record<string, unknown>;
          setMessages(prev =>
            prev.map(m => m.id === updatedMsg.id ? enrichMessage(updatedMsg, currentUserId) : m)
          );
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channel, currentUserId, supabase]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    formatTime,
    refetch: fetchMessages,
  };
}
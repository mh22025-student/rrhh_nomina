'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, CheckCircle, AlertTriangle, Clock, FileText, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ============================================================
// Types
// ============================================================
type NotificationTipo = 'VENCIMIENTO' | 'PLANILLA' | 'INCIDENCIA' | 'SISTEMA';

interface Notificacion {
  id: string;
  tipo: NotificationTipo;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  link?: string;
}

interface NotificationBellProps {
  accessToken: string | null;
  onNavigate?: (viewId: string) => void;
}

// ============================================================
// Helpers
// ============================================================
const TIPO_CONFIG: Record<NotificationTipo, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  VENCIMIENTO: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-l-amber-500' },
  PLANILLA: { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-500' },
  INCIDENCIA: { icon: AlertTriangle, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-l-sky-500' },
  SISTEMA: { icon: CheckCircle, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-l-slate-400' },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr < 24) return `hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
  if (diffDay < 30) return `hace ${diffDay} día${diffDay > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-SV', { day: '2-digit', month: 'short' });
}

// localStorage helpers for read state
const READ_STORAGE_KEY = 'nomina-notificaciones-leidas';

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(READ_STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {
    // ignore
  }
  return new Set();
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

// ============================================================
// Component
// ============================================================
export default function NotificationBell({ accessToken, onNavigate }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);

  const fetchNotifications = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notificaciones', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notificaciones || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Mark a notification as read
  const markAsRead = async (notifId: string) => {
    // Optimistic local update
    const newReadIds = new Set(readIds);
    newReadIds.add(notifId);
    setReadIds(newReadIds);
    saveReadIds(newReadIds);

    // Server-side mark
    try {
      await fetch(`/api/notificaciones/${encodeURIComponent(notifId)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ leida: true }),
      });
    } catch {
      // ignore
    }
  };

  // Mark all as read
  const markAllRead = async () => {
    const newReadIds = new Set(readIds);
    for (const n of notifications) {
      newReadIds.add(n.id);
    }
    setReadIds(newReadIds);
    saveReadIds(newReadIds);

    // Mark all on server
    try {
      await Promise.all(
        notifications.map(n =>
          fetch(`/api/notificaciones/${encodeURIComponent(n.id)}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ leida: true }),
          }).catch(() => {})
        )
      );
    } catch {
      // ignore
    }
  };

  // Compute unread count
  const unreadCount = notifications.filter(n => !readIds.has(n.id) && !n.leida).length;

  // Handle notification click
  const handleNotifClick = (notif: Notificacion) => {
    markAsRead(notif.id);
    if (notif.link && onNavigate) {
      onNavigate(notif.link);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
        >
          <Bell className="h-5 w-5 text-slate-500 hover:text-slate-700 transition-colors" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center bg-emerald-600 text-white text-[10px] font-bold border-2 border-white rounded-full"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          {/* Ring animation for unread */}
          {unreadCount > 0 && (
            <span className="absolute inset-0 rounded-lg animate-ping bg-emerald-400/20" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[380px] p-0 shadow-lg border-slate-200"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2"
                onClick={markAllRead}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Marcar todo
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-[400px]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600 mr-2" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Bell className="h-8 w-8 mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Sin notificaciones</p>
              <p className="text-xs text-slate-400 mt-0.5">Todo está al día</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notif, idx) => {
                const config = TIPO_CONFIG[notif.tipo] || TIPO_CONFIG.SISTEMA;
                const Icon = config.icon;
                const isUnread = !readIds.has(notif.id) && !notif.leida;

                return (
                  <React.Fragment key={notif.id}>
                    <button
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors group ${
                        isUnread ? `border-l-[3px] ${config.border} ${config.bg}/30` : 'border-l-[3px] border-l-transparent'
                      }`}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${config.bg}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-[13px] truncate ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {notif.titulo}
                            </p>
                            {isUnread && (
                              <span className="flex-shrink-0 h-2 w-2 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                            {notif.mensaje}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {timeAgo(notif.fecha)}
                          </p>
                        </div>
                      </div>
                    </button>
                    {idx < notifications.length - 1 && <Separator className="mx-4" />}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2">
            <p className="text-[10px] text-slate-400 text-center">
              Se actualiza automáticamente cada 60 segundos
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

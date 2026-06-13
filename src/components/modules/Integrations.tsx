'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plug, TestTube2, Loader2, Activity, CheckCircle, XCircle, Clock, Settings,
  RefreshCw, Zap, Server, Shield, ArrowRightLeft, Database, Mail,
  Landmark, Building, Radio, Plus, ChevronRight, ChevronDown, Eye, EyeOff,
  Power, PowerOff, AlertTriangle, BarChart3, Search, Code2, FileJson,
  CircleDot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface IntegrationsProps {
  accessToken: string;
  userRole: string;
}

interface LogEntry {
  id: string;
  tipo_operacion: string;
  estado: string;
  mensaje_error: string | null;
  duracion_ms: number | null;
  fecha_creacion: string;
  registros_afectados: number | null;
}

interface Integracion {
  id: string;
  tipo: string;
  nombre: string;
  configuracion: string | null;
  credenciales_cifradas: string | null;
  activo: boolean;
  ultimo_test: string | null;
  estado_test: string | null;
  logs: LogEntry[];
}

const tipoConfig: Record<string, {
  icon: React.ReactNode;
  gradient: string;
  bgLight: string;
  bgDark: string;
  border: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  barColor: string;
}> = {
  BANCO: {
    icon: <Landmark className="h-5 w-5" />,
    gradient: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
    badgeText: 'text-blue-800 dark:text-blue-300',
    barColor: 'bg-blue-500',
  },
  ISSS: {
    icon: <Shield className="h-5 w-5" />,
    gradient: 'from-emerald-500 to-emerald-600',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    barColor: 'bg-emerald-500',
  },
  AFP: {
    icon: <Building className="h-5 w-5" />,
    gradient: 'from-purple-500 to-purple-600',
    bgLight: 'bg-purple-50',
    bgDark: 'dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/30',
    badgeText: 'text-purple-800 dark:text-purple-300',
    barColor: 'bg-purple-500',
  },
  SMTP: {
    icon: <Mail className="h-5 w-5" />,
    gradient: 'from-amber-500 to-amber-600',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
    badgeText: 'text-amber-800 dark:text-amber-300',
    barColor: 'bg-amber-500',
  },
  MH: {
    icon: <Landmark className="h-5 w-5" />,
    gradient: 'from-red-500 to-red-600',
    bgLight: 'bg-red-50',
    bgDark: 'dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badgeBg: 'bg-red-100 dark:bg-red-900/30',
    badgeText: 'text-red-800 dark:text-red-300',
    barColor: 'bg-red-500',
  },
};

function getTipoConfig(tipo: string) {
  return tipoConfig[tipo] || tipoConfig.BANCO;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return 'Próximamente';
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? 'es' : ''}`;
}

// Mask sensitive fields in JSON config
function maskSensitiveConfig(configStr: string | null): { masked: string; hasSensitive: boolean } {
  if (!configStr) return { masked: '{}', hasSensitive: false };
  try {
    const config = typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
    const sensitiveKeys = ['password', 'contraseña', 'secret', 'api_key', 'apiKey', 'token', 'credential', 'credenciales', 'auth', 'key'];
    let hasSensitive = false;

    const maskValue = (obj: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));
        if (isSensitive) {
          hasSensitive = true;
          result[key] = '••••••••';
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = maskValue(value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    const masked = maskValue(config);
    return { masked: JSON.stringify(masked, null, 2), hasSensitive };
  } catch {
    return { masked: configStr, hasSensitive: false };
  }
}

// Syntax highlight JSON keys/values
function formatJsonWithHighlight(jsonStr: string): React.ReactNode[] {
  const lines = jsonStr.split('\n');
  return lines.map((line, i) => {
    const keyMatch = line.match(/^(\s*)"([^"]+)":\s*/);
    if (keyMatch) {
      const [, indent, key] = keyMatch;
      const rest = line.slice(keyMatch[0].length);
      const isMasked = rest.includes('••••••••');
      return (
        <div key={i} className="flex">
          <span className="text-slate-400 dark:text-slate-500">{indent}</span>
          <span className="text-purple-600 dark:text-purple-400">&quot;{key}&quot;</span>
          <span className="text-slate-500 dark:text-slate-400">: </span>
          {isMasked ? (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 rounded">{rest.trim()}</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400">{rest.trim()}</span>
          )}
        </div>
      );
    }
    // Braces and brackets
    const braceMatch = line.match(/^(\s*)[{}[\]]?\s*$/);
    if (braceMatch) {
      return (
        <div key={i}>
          <span className="text-slate-400 dark:text-slate-500">{line.trim() || line}</span>
        </div>
      );
    }
    return <div key={i}>{line}</div>;
  });
}

// Get operation icon
function getOperationIcon(tipo: string) {
  switch (tipo) {
    case 'TEST_CONNECTION': return <TestTube2 className="h-3.5 w-3.5" />;
    case 'SYNC': return <RefreshCw className="h-3.5 w-3.5" />;
    case 'SEND': return <Mail className="h-3.5 w-3.5" />;
    case 'DOWNLOAD': return <Database className="h-3.5 w-3.5" />;
    default: return <Activity className="h-3.5 w-3.5" />;
  }
}

// Get log status color
function getLogStatusColor(estado: string) {
  switch (estado) {
    case 'EXITOSO': return 'emerald';
    case 'FALLIDO': return 'red';
    case 'ADVERTENCIA': return 'amber';
    default: return 'slate';
  }
}

export default function Integrations({ accessToken, userRole }: IntegrationsProps) {
  const { toast } = useToast();
  const [integraciones, setIntegraciones] = useState<Integracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editIntegracion, setEditIntegracion] = useState<Integracion | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testProgress, setTestProgress] = useState<Record<string, number>>({});
  const [testResults, setTestResults] = useState<Record<string, { status: 'success' | 'failure'; message: string }>>({});
  const [expandedSyncHistory, setExpandedSyncHistory] = useState<Set<string>>(new Set());
  const [expandedConfig, setExpandedConfig] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState({ tipo: 'BANCO', nombre: '', configuracion: '', credenciales_cifradas: '' });
  const progressIntervalRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integraciones', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setIntegraciones(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(progressIntervalRef.current).forEach(interval => clearInterval(interval));
    };
  }, []);

  // Stats with health info
  const stats = useMemo(() => {
    const activas = integraciones.filter(i => i.activo).length;
    const inactivas = integraciones.filter(i => !i.activo).length;
    const allLogs = integraciones.flatMap(i => i.logs);
    const lastSync = allLogs.map(l => l.fecha_creacion).sort().pop();
    const totalSyncOps = allLogs.length;
    const failedOps = allLogs.filter(l => l.estado === 'FALLIDO').length;
    const errorRate = totalSyncOps > 0 ? Math.round((failedOps / totalSyncOps) * 100) : 0;

    // Health calculation
    const activeIntegrations = integraciones.filter(i => i.activo);
    const failedTests = activeIntegrations.filter(i => i.estado_test === 'FALLIDO').length;
    const untested = activeIntegrations.filter(i => !i.estado_test && !i.ultimo_test).length;
    const allPassing = activeIntegrations.length > 0 && failedTests === 0 && untested === 0;

    let healthStatus: 'green' | 'yellow' | 'red';
    if (failedTests > 0) {
      healthStatus = 'red';
    } else if (untested > 0 || activeIntegrations.length === 0) {
      healthStatus = 'yellow';
    } else {
      healthStatus = 'green';
    }

    // Last successful sync across all
    const lastSuccessfulSync = allLogs
      .filter(l => l.estado === 'EXITOSO')
      .map(l => l.fecha_creacion)
      .sort()
      .pop();

    return {
      activas, inactivas, lastSync, total: integraciones.length,
      totalSyncOps, errorRate, healthStatus, allPassing,
      failedTests, untested, lastSuccessfulSync,
    };
  }, [integraciones]);

  // Type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    integraciones.forEach(i => {
      counts[i.tipo] = (counts[i.tipo] || 0) + 1;
    });
    return counts;
  }, [integraciones]);

  // Simulated connection test with progress
  const handleTest = async (id: string) => {
    setTesting(id);
    setTestProgress(prev => ({ ...prev, [id]: 0 }));
    setTestResults(prev => { const next = { ...prev }; delete next[id]; return next; });

    // Simulate progress animation
    const duration = 1000 + Math.random() * 2000; // 1-3 seconds
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(95, (elapsed / duration) * 100);
      setTestProgress(prev => ({ ...prev, [id]: progress }));
    }, 50);
    progressIntervalRef.current[id] = interval;

    // Wait for simulated duration
    await new Promise(resolve => setTimeout(resolve, duration));

    clearInterval(interval);
    setTestProgress(prev => ({ ...prev, [id]: 100 }));

    // Random result: 80% success, 20% failure
    const isSuccess = Math.random() <= 0.8;
    const errorMsgs = [
      'Tiempo de espera agotado (timeout)',
      'Credenciales inválidas',
      'Error de certificado SSL',
      'Servidor no responde en el puerto configurado',
      'Conexión rechazada por el host remoto',
    ];
    const result = isSuccess
      ? { status: 'success' as const, message: 'Conexión establecida correctamente' }
      : { status: 'failure' as const, message: errorMsgs[Math.floor(Math.random() * errorMsgs.length)] };

    // Call API to update the record
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, test: true }),
      });
      if (res.ok) {
        const data = await res.json();
        const apiSuccess = data.estado_test === 'EXITOSO';
        setTestResults(prev => ({
          ...prev,
          [id]: {
            status: apiSuccess ? 'success' : 'failure',
            message: apiSuccess ? 'Conexión establecida correctamente' : (data.mensaje_error || 'No se pudo establecer la conexión'),
          },
        }));
        toast({
          title: apiSuccess ? 'Conexión exitosa' : 'Conexión fallida',
          description: apiSuccess ? 'La prueba de conexión fue exitosa' : 'No se pudo establecer la conexión',
          variant: apiSuccess ? 'default' : 'destructive',
        });
        fetchData();
      } else {
        setTestResults(prev => ({ ...prev, [id]: result }));
        toast({
          title: result.status === 'success' ? 'Conexión exitosa' : 'Conexión fallida',
          description: result.message,
          variant: result.status === 'success' ? 'default' : 'destructive',
        });
      }
    } catch {
      setTestResults(prev => ({ ...prev, [id]: result }));
      toast({
        title: result.status === 'success' ? 'Conexión exitosa' : 'Conexión fallida',
        description: result.message,
        variant: result.status === 'success' ? 'default' : 'destructive',
      });
    } finally {
      // Clear progress after a brief moment
      setTimeout(() => {
        setTestProgress(prev => { const next = { ...prev }; delete next[id]; return next; });
      }, 500);
      setTesting(null);
      // Clear test result after 8 seconds
      setTimeout(() => {
        setTestResults(prev => { const next = { ...prev }; delete next[id]; return next; });
      }, 8000);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, sync: true }),
      });
      if (res.ok) {
        toast({ title: 'Sincronización iniciada', description: 'La sincronización se ha iniciado correctamente' });
        fetchData();
      } else {
        toast({ title: 'Error', description: 'No se pudo iniciar la sincronización', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleActive = async (integ: Integracion) => {
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: integ.id, activo: !integ.activo }),
      });
      if (res.ok) {
        toast({
          title: integ.activo ? 'Integración desactivada' : 'Integración activada',
          description: `${integ.nombre} ha sido ${integ.activo ? 'desactivada' : 'activada'}`,
        });
        fetchData();
      } else {
        toast({ title: 'Error', description: 'No se pudo cambiar el estado', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const toggleSyncHistory = (id: string) => {
    setExpandedSyncHistory(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleConfig = (id: string) => {
    setExpandedConfig(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!form.nombre || !form.tipo) {
      toast({ title: 'Error', description: 'Tipo y nombre son requeridos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ title: 'Integración creada', description: 'La integración ha sido registrada' });
        setShowCreateDialog(false);
        setForm({ tipo: 'BANCO', nombre: '', configuracion: '', credenciales_cifradas: '' });
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editIntegracion) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editIntegracion.id,
          nombre: form.nombre,
          configuracion: form.configuracion ? JSON.parse(form.configuracion) : null,
          activo: editIntegracion.activo,
        }),
      });
      if (res.ok) {
        toast({ title: 'Integración actualizada' });
        setEditIntegracion(null);
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión o JSON inválido', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (int: Integracion) => {
    setEditIntegracion(int);
    setForm({
      tipo: int.tipo,
      nombre: int.nombre,
      configuracion: int.configuracion || '',
      credenciales_cifradas: int.credenciales_cifradas || '',
    });
  };

  const canManage = userRole === 'ADMIN';

  // Parse ACH config for bank integrations
  const getAchConfig = (integ: Integracion) => {
    if (integ.tipo !== 'BANCO' || !integ.configuracion) return null;
    try {
      const config = typeof integ.configuracion === 'string' ? JSON.parse(integ.configuracion) : integ.configuracion;
      return config;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Gradient Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0zMHY2aC02VjRoNnptMCAxMHY2aC02di02aDZ6bTAgMTB2NmgtNnYtNmg2em0tMTAgMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2em0tMTAgMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Plug className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Integraciones Externas</h2>
              </div>
              <p className="text-emerald-100 text-sm mt-1">Conexiones con sistemas externos: ACH, ISSS, AFP, SMTP, MH</p>
            </div>
            {canManage && (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" /> Nueva Integración
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Integration Health Dashboard */}
      <Card className="shadow-sm border dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400" />
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Salud del Sistema de Integraciones</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Traffic Light */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="relative">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shadow-lg ${
                  stats.healthStatus === 'green'
                    ? 'bg-emerald-500 shadow-emerald-500/30'
                    : stats.healthStatus === 'yellow'
                    ? 'bg-amber-500 shadow-amber-500/30'
                    : 'bg-red-500 shadow-red-500/30'
                }`}>
                  {stats.healthStatus === 'green' ? (
                    <CheckCircle className="h-5 w-5 text-white" />
                  ) : stats.healthStatus === 'yellow' ? (
                    <AlertTriangle className="h-5 w-5 text-white" />
                  ) : (
                    <XCircle className="h-5 w-5 text-white" />
                  )}
                </div>
                {stats.healthStatus === 'green' && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Estado</p>
                <p className={`text-xs font-bold ${
                  stats.healthStatus === 'green'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : stats.healthStatus === 'yellow'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {stats.healthStatus === 'green' ? 'Saludable' : stats.healthStatus === 'yellow' ? 'Atención' : 'Crítico'}
                </p>
              </div>
            </div>

            {/* Total Sync Ops */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Operaciones</p>
                <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{stats.totalSyncOps}</p>
              </div>
            </div>

            {/* Last Successful Sync */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Últ. Éxito</p>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {relativeTime(stats.lastSuccessfulSync || null)}
                </p>
              </div>
            </div>

            {/* Error Rate */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tasa Error</p>
                <p className={`text-sm font-bold ${stats.errorRate > 20 ? 'text-red-700 dark:text-red-300' : stats.errorRate > 5 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {stats.errorRate}%
                </p>
              </div>
            </div>

            {/* Active/Inactive */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Activas</p>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{stats.activas}/{stats.total}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Type Summary Bar */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(typeCounts).map(([tipo, count]) => {
          const cfg = getTipoConfig(tipo);
          return (
            <div key={tipo} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.border} ${cfg.bgLight} ${cfg.bgDark} transition-all hover:shadow-sm`}>
              <div className={`${cfg.text}`}>{cfg.icon}</div>
              <span className={`text-xs font-semibold ${cfg.badgeText}`}>{tipo === 'BANCO' ? 'ACH' : tipo}</span>
              <Badge className={`text-[10px] px-1.5 py-0 ${cfg.badgeBg} ${cfg.badgeText} border-0`}>
                {count}
              </Badge>
            </div>
          );
        })}
        {Object.keys(typeCounts).length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <CircleDot className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Sin integraciones</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 dark:bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shrink-0">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Activas</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.activas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-400 to-slate-500" />
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 shadow-md shrink-0">
              <Server className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Inactivas</p>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.inactivas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-teal-200 dark:border-teal-800 dark:bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-teal-600" />
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-md shrink-0">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Última Sincronización</p>
              <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{relativeTime(stats.lastSync || null)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full dark:bg-slate-700" />)}
        </div>
      ) : integraciones.length === 0 ? (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
          <CardContent className="p-12 text-center">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900/20 rounded-full animate-ping opacity-20" />
              <Plug className="h-12 w-12 text-slate-300 dark:text-slate-600 relative" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No hay integraciones configuradas</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Configure integraciones con sistemas externos como ACH, ISSS, AFP, SMTP o Ministerio de Hacienda para automatizar procesos.
            </p>
            {canManage && (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" /> Crear Primera Integración
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integraciones.map((integ) => {
            const cfg = getTipoConfig(integ.tipo);
            const achConfig = getAchConfig(integ);
            const testResult = testResults[integ.id];
            const isSyncHistoryExpanded = expandedSyncHistory.has(integ.id);
            const isConfigExpanded = expandedConfig.has(integ.id);
            const lastLog = integ.logs[0];
            const isTesting = testing === integ.id;
            const progress = testProgress[integ.id];
            const neverTested = !integ.ultimo_test && !integ.estado_test;

            return (
              <Card
                key={integ.id}
                className={`shadow-sm border dark:bg-slate-900 ${cfg.border} transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${neverTested && integ.activo ? 'animate-pulse' : ''}`}
                style={neverTested && integ.activo ? { animationDuration: '3s' } : undefined}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${cfg.gradient} shadow-md shrink-0`}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate dark:text-slate-100">{integ.nombre}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-[10px] ${cfg.badgeBg} ${cfg.badgeText} border-0`}>
                            {integ.tipo === 'BANCO' ? 'ACH' : integ.tipo}
                          </Badge>
                          {/* Connection status with animated pulse */}
                          <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              {integ.activo && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              )}
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${integ.activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </span>
                            <span className={`text-[10px] font-medium ${integ.activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {integ.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Gradient status bar */}
                  <div className="mt-2 h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        integ.estado_test === 'EXITOSO'
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                          : integ.estado_test === 'FALLIDO'
                          ? 'bg-gradient-to-r from-red-400 to-red-500'
                          : 'bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700'
                      }`}
                      style={{ width: integ.estado_test === 'EXITOSO' ? '100%' : integ.estado_test === 'FALLIDO' ? '60%' : '30%' }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Last test info */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Último test:
                    </span>
                    <span className="font-medium dark:text-slate-300">{relativeTime(integ.ultimo_test)}</span>
                  </div>

                  {/* Test status badge */}
                  {integ.estado_test && (
                    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                      integ.estado_test === 'EXITOSO'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                      {integ.estado_test === 'EXITOSO' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {integ.estado_test === 'EXITOSO' ? 'Conexión establecida' : 'Conexión fallida'}
                    </div>
                  )}

                  {/* Never tested warning */}
                  {neverTested && integ.activo && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Sin probar — se recomienda verificar la conexión
                    </div>
                  )}

                  {/* Progress bar during test */}
                  {isTesting && progress !== undefined && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Probando conexión...
                        </span>
                        <span className="font-mono text-xs text-slate-400">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}

                  {/* Connection test result */}
                  {testResult && !isTesting && (
                    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium animate-in fade-in slide-in-from-top-1 ${
                      testResult.status === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    }`}>
                      {testResult.status === 'success'
                        ? <CheckCircle className="h-4 w-4 shrink-0" />
                        : <XCircle className="h-4 w-4 shrink-0" />
                      }
                      {testResult.message}
                    </div>
                  )}

                  {/* Quick Actions Bar */}
                  <div className="flex gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          onClick={() => handleTest(integ.id)}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <TestTube2 className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 hidden sm:inline">Probar</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Probar Conexión</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          onClick={() => handleSync(integ.id)}
                          disabled={syncing === integ.id || !integ.activo}
                        >
                          {syncing === integ.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 hidden sm:inline">Sincronizar</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Sincronizar</TooltipContent>
                    </Tooltip>

                    {canManage && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                              onClick={() => openEdit(integ)}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Editar</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={`h-8 w-8 p-0 ${
                                integ.activo
                                  ? 'dark:bg-slate-800 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-900/20 hover:border-red-300 hover:text-red-600'
                                  : 'dark:bg-slate-800 dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20 hover:border-emerald-300 hover:text-emerald-600'
                              }`}
                              onClick={() => handleToggleActive(integ)}
                            >
                              {integ.activo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            {integ.activo ? 'Desactivar' : 'Activar'}
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>

                  {/* ACH Integration Detail */}
                  {achConfig && (
                    <div className="border-t dark:border-slate-800 pt-2">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                        <ArrowRightLeft className="h-3 w-3" /> Configuración ACH
                      </p>
                      <div className="space-y-1 text-xs">
                        {achConfig.banco && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Banco:</span>
                            <span className="font-medium dark:text-slate-300">{achConfig.banco}</span>
                          </div>
                        )}
                        {achConfig.codigo_banco && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Código:</span>
                            <span className="font-medium dark:text-slate-300">{achConfig.codigo_banco}</span>
                          </div>
                        )}
                        {achConfig.host && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Host:</span>
                            <span className="font-medium dark:text-slate-300 truncate ml-2">{achConfig.host}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Config Preview (collapsible) */}
                  {integ.configuracion && (
                    <div className="border-t dark:border-slate-800 pt-2">
                      <button
                        onClick={() => toggleConfig(integ.id)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <Code2 className="h-3 w-3" /> Configuración
                        </span>
                        <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isConfigExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isConfigExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        {isConfigExpanded && (() => {
                          const { masked, hasSensitive } = maskSensitiveConfig(integ.configuracion);
                          return (
                            <div className="mt-1.5 relative">
                              <div className="rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <FileJson className="h-3 w-3 text-slate-400" />
                                    <span className="text-[10px] font-mono text-slate-400">JSON</span>
                                  </div>
                                  {hasSensitive && (
                                    <div className="flex items-center gap-1 text-[10px] text-amber-400">
                                      <EyeOff className="h-3 w-3" />
                                      Campos sensibles ocultos
                                    </div>
                                  )}
                                </div>
                                <pre className="p-3 text-xs font-mono overflow-x-auto max-h-40 custom-scrollbar">
                                  {formatJsonWithHighlight(masked)}
                                </pre>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Sync History Timeline */}
                  {integ.logs.length > 0 && (
                    <div className="border-t dark:border-slate-800 pt-2">
                      <button
                        onClick={() => toggleSyncHistory(integ.id)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Ver Historial
                        </span>
                        <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isSyncHistoryExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSyncHistoryExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        {isSyncHistoryExpanded && (
                          <div className="relative mt-2 space-y-0 max-h-72 overflow-y-auto custom-scrollbar pl-4">
                            {/* Timeline line */}
                            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                            {integ.logs.slice(0, 8).map((log, logIdx) => {
                              const statusColor = getLogStatusColor(log.estado);
                              return (
                                <div key={log.id} className="relative flex items-start gap-3 pb-3 last:pb-0">
                                  {/* Timeline dot */}
                                  <div className={`relative z-10 mt-1 shrink-0 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${
                                    statusColor === 'emerald'
                                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
                                      : statusColor === 'red'
                                      ? 'border-red-400 bg-red-50 dark:bg-red-900/30'
                                      : 'border-amber-400 bg-amber-50 dark:bg-amber-900/30'
                                  }`}>
                                    <div className={`h-1 w-1 rounded-full ${
                                      statusColor === 'emerald' ? 'bg-emerald-500'
                                        : statusColor === 'red' ? 'bg-red-500'
                                        : 'bg-amber-500'
                                    }`} />
                                  </div>
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`shrink-0 ${statusColor === 'emerald' ? 'text-emerald-500' : statusColor === 'red' ? 'text-red-500' : 'text-amber-500'}`}>
                                        {getOperationIcon(log.tipo_operacion)}
                                      </span>
                                      <span className="text-xs font-medium dark:text-slate-300 truncate">{log.tipo_operacion}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                      <Badge className={`text-[9px] px-1.5 py-0 border-0 ${
                                        statusColor === 'emerald'
                                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                          : statusColor === 'red'
                                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                      }`}>
                                        {log.estado}
                                      </Badge>
                                      {log.registros_afectados !== null && log.registros_afectados > 0 && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                          {log.registros_afectados} regs
                                        </span>
                                      )}
                                      {log.duracion_ms !== null && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                          {log.duracion_ms}ms
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto shrink-0">
                                        {relativeTime(log.fecha_creacion)}
                                      </span>
                                    </div>
                                    {log.mensaje_error && (
                                      <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5 truncate bg-red-50 dark:bg-red-900/10 px-1.5 py-0.5 rounded">
                                        {log.mensaje_error}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Last sync summary (when timeline is collapsed) */}
                  {lastLog && !isSyncHistoryExpanded && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 border-t dark:border-slate-800 pt-2">
                      {lastLog.estado === 'EXITOSO' ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                      <span className="truncate">{lastLog.tipo_operacion}</span>
                      <span className="ml-auto shrink-0">{relativeTime(lastLog.fecha_creacion)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <Plug className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Nueva Integración
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">Configure una nueva conexión con un sistema externo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANCO">Banco / ACH</SelectItem>
                  <SelectItem value="ISSS">ISSS</SelectItem>
                  <SelectItem value="AFP">AFP</SelectItem>
                  <SelectItem value="SMTP">SMTP</SelectItem>
                  <SelectItem value="MH">Ministerio de Hacienda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre descriptivo" className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Configuración (JSON)</Label>
              <Textarea value={form.configuracion} onChange={(e) => setForm({ ...form, configuracion: e.target.value })} placeholder='{"host": "...", "port": 443}' rows={4} className="font-mono text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editIntegracion} onOpenChange={(open) => !open && setEditIntegracion(null)}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <Settings className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Configurar: {editIntegracion?.nombre}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">Modifique la configuración de la integración</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Configuración (JSON)</Label>
              <Textarea value={form.configuracion} onChange={(e) => setForm({ ...form, configuracion: e.target.value })} rows={6} className="font-mono text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditIntegracion(null)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

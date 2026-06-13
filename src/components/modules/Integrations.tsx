'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plug, TestTube2, Loader2, Activity, CheckCircle, XCircle, Clock, Settings,
  RefreshCw, Zap, Server, Shield, ArrowRightLeft, Database, Mail,
  Landmark, Building, Radio, Plus, ChevronRight,
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
import { useToast } from '@/hooks/use-toast';

interface IntegrationsProps {
  accessToken: string;
  userRole: string;
}

interface LogEntry { id: string; tipo_operacion: string; estado: string; mensaje_error: string | null; duracion_ms: number | null; fecha_creacion: string; registros_afectados: number | null; }

interface Integracion {
  id: string; tipo: string; nombre: string; configuracion: string | null;
  credenciales_cifradas: string | null; activo: boolean;
  ultimo_test: string | null; estado_test: string | null;
  logs: LogEntry[];
}

const tipoConfig: Record<string, { icon: React.ReactNode; gradient: string; bgLight: string; bgDark: string; border: string; text: string; badgeBg: string; badgeText: string }> = {
  BANCO: {
    icon: <Landmark className="h-5 w-5" />,
    gradient: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
    badgeText: 'text-blue-800 dark:text-blue-300',
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

export default function Integrations({ accessToken, userRole }: IntegrationsProps) {
  const { toast } = useToast();
  const [integraciones, setIntegraciones] = useState<Integracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editIntegracion, setEditIntegracion] = useState<Integracion | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: 'success' | 'failure'; message: string }>>({});
  const [expandedSyncHistory, setExpandedSyncHistory] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState({ tipo: 'BANCO', nombre: '', configuracion: '', credenciales_cifradas: '' });

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

  // Stats
  const stats = useMemo(() => {
    const activas = integraciones.filter(i => i.activo).length;
    const inactivas = integraciones.filter(i => !i.activo).length;
    const lastSync = integraciones
      .flatMap(i => i.logs.map(l => l.fecha_creacion))
      .sort()
      .pop();
    return { activas, inactivas, lastSync, total: integraciones.length };
  }, [integraciones]);

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResults(prev => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const res = await fetch('/api/admin/integraciones', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, test: true }),
      });
      if (res.ok) {
        const data = await res.json();
        const isSuccess = data.estado_test === 'EXITOSO';
        setTestResults(prev => ({
          ...prev,
          [id]: {
            status: isSuccess ? 'success' : 'failure',
            message: isSuccess ? 'Conexión establecida correctamente' : 'No se pudo establecer la conexión',
          },
        }));
        toast({
          title: isSuccess ? 'Conexión exitosa' : 'Conexión fallida',
          description: isSuccess ? 'La prueba de conexión fue exitosa' : 'No se pudo establecer la conexión',
          variant: isSuccess ? 'default' : 'destructive',
        });
        fetchData();
        // Clear test result after 5 seconds
        setTimeout(() => {
          setTestResults(prev => { const next = { ...prev }; delete next[id]; return next; });
        }, 5000);
      }
    } catch {
      setTestResults(prev => ({
        ...prev,
        [id]: { status: 'failure', message: 'Error de red al probar conexión' },
      }));
      toast({ title: 'Error', description: 'Error al probar conexión', variant: 'destructive' });
    } finally {
      setTesting(null);
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

  const toggleSyncHistory = (id: string) => {
    setExpandedSyncHistory(prev => {
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
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-12 text-center">
            <Plug className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No hay integraciones</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configure integraciones con sistemas externos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integraciones.map((integ) => {
            const cfg = getTipoConfig(integ.tipo);
            const achConfig = getAchConfig(integ);
            const testResult = testResults[integ.id];
            const isSyncHistoryExpanded = expandedSyncHistory.has(integ.id);
            const lastLog = integ.logs[0];

            return (
              <Card key={integ.id} className={`shadow-sm border dark:bg-slate-900 ${cfg.border} transition-all duration-200 hover:shadow-md`}>
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
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Last sync info */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Último test:
                    </span>
                    <span className="font-medium dark:text-slate-300">{relativeTime(integ.ultimo_test)}</span>
                  </div>

                  {/* Test result */}
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

                  {/* Connection test animation result */}
                  {testResult && (
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

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      onClick={() => handleTest(integ.id)}
                      disabled={testing === integ.id}
                    >
                      {testing === integ.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          Probando...
                        </>
                      ) : (
                        <>
                          <TestTube2 className="h-3.5 w-3.5 mr-1" />
                          Probar Conexión
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      onClick={() => handleSync(integ.id)}
                      disabled={syncing === integ.id || !integ.activo}
                    >
                      {syncing === integ.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={() => openEdit(integ)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
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

                  {/* Sync History */}
                  {integ.logs.length > 0 && (
                    <div className="border-t dark:border-slate-800 pt-2">
                      <button
                        onClick={() => toggleSyncHistory(integ.id)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Historial de Sincronización
                        </span>
                        <ChevronRight className={`h-3 w-3 transition-transform ${isSyncHistoryExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      {isSyncHistoryExpanded && (
                        <div className="space-y-1.5 mt-1.5 max-h-40 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1">
                          {integ.logs.slice(0, 5).map((log) => (
                            <div key={log.id} className="flex items-start gap-2 text-xs p-1.5 rounded-md bg-slate-50 dark:bg-slate-800/50">
                              <div className={`mt-0.5 shrink-0 ${log.estado === 'EXITOSO' ? 'text-emerald-500' : 'text-red-500'}`}>
                                {log.estado === 'EXITOSO' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium dark:text-slate-300 truncate">{log.tipo_operacion}</span>
                                  <span className="text-slate-400 dark:text-slate-500 shrink-0 ml-1">{relativeTime(log.fecha_creacion)}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge className={`text-[9px] px-1 py-0 ${
                                    log.estado === 'EXITOSO' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                  }`}>
                                    {log.estado}
                                  </Badge>
                                  {log.registros_afectados !== null && log.registros_afectados > 0 && (
                                    <span className="text-[10px] text-slate-400">{log.registros_afectados} registros</span>
                                  )}
                                  {log.duracion_ms && (
                                    <span className="text-[10px] text-slate-400">{log.duracion_ms}ms</span>
                                  )}
                                </div>
                                {log.mensaje_error && (
                                  <p className="text-[10px] text-red-500 mt-0.5 truncate">{log.mensaje_error}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Last sync summary */}
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
                  <SelectItem value="BANCO">🏦 Banco / ACH</SelectItem>
                  <SelectItem value="ISSS">🏥 ISSS</SelectItem>
                  <SelectItem value="AFP">💼 AFP</SelectItem>
                  <SelectItem value="SMTP">📧 SMTP</SelectItem>
                  <SelectItem value="MH">🏛️ Ministerio de Hacienda</SelectItem>
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



'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollText, Download, Filter, ChevronDown, ChevronRight, ChevronUp, Loader2, Shield,
  KeyRound, Plus, FileText, Trash2, CheckCircle, Calculator, Activity, Clock, AlertTriangle,
  X, List, AlignLeft, ArrowUpDown, Eye, Monitor, Globe, User, Fingerprint, LogOut,
  UserMinus, Ban, RotateCcw, Send, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface AuditLogProps {
  accessToken: string;
  userRole: string;
}

interface AuditEntry {
  id: string; usuario_id: string | null; usuario_email: string | null;
  accion: string; tabla_afectada: string | null; registro_id: string | null;
  valor_anterior: string | null; valor_nuevo: string | null; resultado: string | null;
  nivel_criticidad: string; ip_origen: string | null; user_agent: string | null;
  detalle_adicional: string | null; fecha_accion: string;
  usuario: { nombre: string; apellido: string; email: string } | null;
}

// ─── Action-specific icon map ────────────────────────────────────────
const actionIconMap: Record<string, React.ElementType> = {
  LOGIN: KeyRound, LOGOUT: LogOut, CREAR: Plus, ACTUALIZAR: FileText,
  ELIMINAR: Trash2, APROBAR: CheckCircle, CALCULAR: Calculator,
  DESACTIVAR: UserMinus, RECHAZAR: Ban, REVERTIR: RotateCcw,
  DISPERSAR: Send, RECARGAR: RefreshCw,
};

const actionColorMap: Record<string, string> = {
  LOGIN: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50',
  LOGOUT: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  CREAR: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/50',
  ACTUALIZAR: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50',
  ELIMINAR: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/50',
  APROBAR: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50',
  CALCULAR: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950/50',
  DESACTIVAR: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/50',
  RECHAZAR: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/50',
  REVERTIR: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/50',
  DISPERSAR: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/50',
  RECARGAR: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950/50',
};

const severityColors: Record<string, { bg: string; dot: string; text: string; border: string }> = {
  NORMAL: { bg: 'bg-teal-50 dark:bg-teal-950/30', dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  ALTO: { bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  ALTA: { bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  CRITICO: { bg: 'bg-red-50 dark:bg-red-950/30', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  MEDIA: { bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
};

// ─── Relative time helper ────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay === 1) return 'Ayer';
  if (diffDay < 7) return `Hace ${diffDay} días`;
  return new Date(dateStr).toLocaleDateString('es-SV', { day: 'numeric', month: 'short' });
}

function getInitials(nombre: string, apellido: string): string {
  return ((nombre?.[0] || '') + (apellido?.[0] || '')).toUpperCase() || '?';
}

type ViewMode = 'timeline' | 'table';
type QuickFilter = 'todas' | 'hoy' | 'semana' | 'criticas';
type SortField = 'fecha_accion' | 'accion' | 'nivel_criticidad' | 'usuario_email';
type SortDir = 'asc' | 'desc';

export default function AuditLog({ accessToken }: AuditLogProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  // Filters
  const [filterUsuario, setFilterUsuario] = useState('');
  const [filterAccion, setFilterAccion] = useState('');
  const [filterTabla, setFilterTabla] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterCriticidad, setFilterCriticidad] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todas');

  // Sort
  const [sortField, setSortField] = useState<SortField>('fecha_accion');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Detail dialog
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);

  const pageSize = 20;

  // ─── Compute quick-filter dates ─────────────────────────────────────
  const quickFilterDates = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { today, weekAgo };
  }, []);

  // ─── Stats computation ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = quickFilterDates.today;
    const todayCount = entries.filter((e) => e.fecha_accion.slice(0, 10) === today).length;
    const criticalCount = entries.filter((e) =>
      e.nivel_criticidad === 'CRITICO' || e.nivel_criticidad === 'ALTA' || e.nivel_criticidad === 'ALTO'
    ).length;
    const lastAccess = entries.length > 0
      ? entries.find((e) => e.accion === 'LOGIN')?.fecha_accion || entries[0].fecha_accion
      : null;
    return { total, todayCount, criticalCount, lastAccess };
  }, [entries, total, quickFilterDates.today]);

  // ─── Active filter chips ────────────────────────────────────────────
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; value: string }[] = [];
    if (filterUsuario) chips.push({ key: 'usuario', label: 'Usuario', value: filterUsuario });
    if (filterAccion) chips.push({ key: 'accion', label: 'Acción', value: filterAccion });
    if (filterTabla) chips.push({ key: 'tabla', label: 'Tabla', value: filterTabla });
    if (filterFechaDesde) chips.push({ key: 'desde', label: 'Desde', value: filterFechaDesde });
    if (filterFechaHasta) chips.push({ key: 'hasta', label: 'Hasta', value: filterFechaHasta });
    if (filterCriticidad) chips.push({ key: 'criticidad', label: 'Criticidad', value: filterCriticidad });
    return chips;
  }, [filterUsuario, filterAccion, filterTabla, filterFechaDesde, filterFechaHasta, filterCriticidad]);

  const clearFilter = (key: string) => {
    switch (key) {
      case 'usuario': setFilterUsuario(''); break;
      case 'accion': setFilterAccion(''); break;
      case 'tabla': setFilterTabla(''); break;
      case 'desde': setFilterFechaDesde(''); break;
      case 'hasta': setFilterFechaHasta(''); break;
      case 'criticidad': setFilterCriticidad(''); break;
    }
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilterUsuario(''); setFilterAccion(''); setFilterTabla('');
    setFilterFechaDesde(''); setFilterFechaHasta(''); setFilterCriticidad('');
    setQuickFilter('todas'); setPage(1);
  };

  // ─── Quick filter logic ─────────────────────────────────────────────
  const handleQuickFilter = (qf: QuickFilter) => {
    setQuickFilter(qf);
    setPage(1);
    // Reset manual date filters when quick-filtering
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    if (qf === 'criticas') {
      setFilterCriticidad('CRITICO');
    } else if (qf !== 'criticas' && filterCriticidad === 'CRITICO') {
      setFilterCriticidad('');
    }
  };

  // ─── Apply quick filter as actual date params before fetch ──────────
  const effectiveFechaDesde = useMemo(() => {
    if (filterFechaDesde) return filterFechaDesde;
    if (quickFilter === 'hoy') return quickFilterDates.today;
    if (quickFilter === 'semana') return quickFilterDates.weekAgo;
    return '';
  }, [filterFechaDesde, quickFilter, quickFilterDates]);

  const effectiveFechaHasta = useMemo(() => {
    if (filterFechaHasta) return filterFechaHasta;
    if (quickFilter === 'hoy') return quickFilterDates.today;
    return '';
  }, [filterFechaHasta, quickFilter, quickFilterDates.today]);

  const effectiveCriticidad = useMemo(() => {
    if (filterCriticidad) return filterCriticidad;
    if (quickFilter === 'criticas') return 'CRITICO';
    return '';
  }, [filterCriticidad, quickFilter]);

  // ─── Fetch ──────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (filterUsuario) params.set('usuario', filterUsuario);
      if (filterAccion) params.set('accion', filterAccion);
      if (filterTabla) params.set('tabla', filterTabla);
      if (effectiveFechaDesde) params.set('fecha_desde', effectiveFechaDesde);
      if (effectiveFechaHasta) params.set('fecha_hasta', effectiveFechaHasta);
      if (effectiveCriticidad) params.set('nivel_criticidad', effectiveCriticidad);

      const res = await fetch(`/api/admin/bitacora?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotal(data.pagination.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, filterUsuario, filterAccion, filterTabla, effectiveFechaDesde, effectiveFechaHasta, effectiveCriticidad]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ─── CSV Export (client-side) ───────────────────────────────────────
  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.set('export', 'csv');
      if (filterUsuario) params.set('usuario', filterUsuario);
      if (filterAccion) params.set('accion', filterAccion);
      if (filterTabla) params.set('tabla', filterTabla);
      if (effectiveFechaDesde) params.set('fecha_desde', effectiveFechaDesde);
      if (effectiveFechaHasta) params.set('fecha_hasta', effectiveFechaHasta);
      if (effectiveCriticidad) params.set('nivel_criticidad', effectiveCriticidad);

      const res = await fetch(`/api/admin/bitacora?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bitacora_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'CSV exportado', description: 'Archivo descargado exitosamente' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error al exportar', variant: 'destructive' });
    }
  };

  // ─── Expand / Collapse ──────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Sort ───────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const severityOrder: Record<string, number> = { CRITICO: 3, ALTA: 2, ALTO: 2, MEDIA: 1, NORMAL: 0 };

  const sortedEntries = useMemo(() => {
    const arr = [...entries];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'fecha_accion':
          cmp = new Date(a.fecha_accion).getTime() - new Date(b.fecha_accion).getTime();
          break;
        case 'accion':
          cmp = a.accion.localeCompare(b.accion);
          break;
        case 'nivel_criticidad':
          cmp = (severityOrder[a.nivel_criticidad] ?? 0) - (severityOrder[b.nivel_criticidad] ?? 0);
          break;
        case 'usuario_email':
          cmp = (a.usuario_email || '').localeCompare(b.usuario_email || '');
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [entries, sortField, sortDir]);

  const totalPages = Math.ceil(total / pageSize);

  const formatJson = (jsonStr: string | null) => {
    if (!jsonStr) return null;
    try {
      return JSON.stringify(JSON.parse(jsonStr), null, 2);
    } catch {
      return jsonStr;
    }
  };

  const getActionIcon = (accion: string) => actionIconMap[accion] || Activity;
  const getActionColor = (accion: string) => actionColorMap[accion] || 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800';
  const getSeverityStyle = (nivel: string) => severityColors[nivel] || severityColors.NORMAL;

  // ─── JSON Diff renderer ─────────────────────────────────────────────
  const JsonDiff = ({ oldVal, newVal }: { oldVal: string | null; newVal: string | null }) => {
    let oldObj: Record<string, unknown> | null = null;
    let newObj: Record<string, unknown> | null = null;
    try { oldObj = oldVal ? JSON.parse(oldVal) : null; } catch { /* not json */ }
    try { newObj = newVal ? JSON.parse(newVal) : null; } catch { /* not json */ }

    if (!oldObj || typeof oldObj !== 'object' || !newObj || typeof newObj !== 'object') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {oldVal && (
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Valor Anterior</p>
              <pre className="text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-800 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">{formatJson(oldVal)}</pre>
            </div>
          )}
          {newVal && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Valor Nuevo</p>
              <pre className="text-xs bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded border border-emerald-200 dark:border-emerald-800 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">{formatJson(newVal)}</pre>
            </div>
          )}
        </div>
      );
    }

    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).sort();
    return (
      <div className="space-y-1">
        {allKeys.map((key) => {
          const oldV = JSON.stringify(oldObj[key]);
          const newV = JSON.stringify(newObj[key]);
          const changed = oldV !== newV;
          const onlyNew = !(key in oldObj);
          const onlyOld = !(key in newObj);
          return (
            <div key={key} className={`text-xs font-mono px-2 py-1 rounded ${changed ? (onlyNew ? 'bg-emerald-50 dark:bg-emerald-950/30' : onlyOld ? 'bg-red-50 dark:bg-red-950/30 line-through' : 'bg-amber-50 dark:bg-amber-950/30') : 'bg-slate-50 dark:bg-slate-800/30'}`}>
              <span className="font-semibold text-slate-600 dark:text-slate-300">{key}:</span>{' '}
              {changed ? (
                <>
                  {oldV && <span className="text-red-600 dark:text-red-400">{oldV}</span>}
                  {oldV && newV && <span className="text-slate-400 mx-1">→</span>}
                  {newV && <span className="text-emerald-600 dark:text-emerald-400">{newV}</span>}
                </>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">{oldV}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Sort icon helper ───────────────────────────────────────────────
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-slate-400" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-emerald-600" />
      : <ChevronDown className="h-3 w-3 ml-1 text-emerald-600" />;
  };

  return (
    <div className="space-y-5">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-emerald-600" />
            Bitácora de Auditoría
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Registro inmutable de todas las acciones del sistema (solo lectura)</p>
        </div>
        <Button onClick={exportCSV} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {/* ─── Inmutabilidad notice ──────────────────────────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-start gap-2">
        <Shield className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-600 dark:text-slate-400">Este registro es inmutable y de solo lectura. No se pueden modificar ni eliminar entradas.</p>
      </div>

      {/* ─── Statistics Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
              <Activity className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Eventos</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.total.toLocaleString('es-SV')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-teal-500">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center shrink-0">
              <Clock className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Eventos Hoy</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.todayCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-red-500">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Alta Criticidad</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.criticalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
              <Fingerprint className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Último Acceso</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{stats.lastAccess ? relativeTime(stats.lastAccess) : '-'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Quick Filter Tabs ─────────────────────────────────────────── */}
      <Tabs value={quickFilter} onValueChange={(v) => handleQuickFilter(v as QuickFilter)}>
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="todas" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Todas</TabsTrigger>
          <TabsTrigger value="hoy" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Hoy</TabsTrigger>
          <TabsTrigger value="semana" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Esta Semana</TabsTrigger>
          <TabsTrigger value="criticas" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Críticas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ─── Filters Card ──────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Usuario / Email</Label>
              <Input placeholder="Buscar usuario..." value={filterUsuario} onChange={(e) => { setFilterUsuario(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Acción</Label>
              <Select value={filterAccion || 'all'} onValueChange={(v) => { setFilterAccion(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="LOGIN">LOGIN</SelectItem>
                  <SelectItem value="LOGOUT">LOGOUT</SelectItem>
                  <SelectItem value="CREAR">CREAR</SelectItem>
                  <SelectItem value="ACTUALIZAR">ACTUALIZAR</SelectItem>
                  <SelectItem value="ELIMINAR">ELIMINAR</SelectItem>
                  <SelectItem value="DESACTIVAR">DESACTIVAR</SelectItem>
                  <SelectItem value="APROBAR">APROBAR</SelectItem>
                  <SelectItem value="CALCULAR">CALCULAR</SelectItem>
                  <SelectItem value="RECHAZAR">RECHAZAR</SelectItem>
                  <SelectItem value="REVERTIR">REVERTIR</SelectItem>
                  <SelectItem value="DISPERSAR">DISPERSAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tabla Afectada</Label>
              <Input placeholder="Tabla afectada..." value={filterTabla} onChange={(e) => { setFilterTabla(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha Desde</Label>
              <Input type="date" value={filterFechaDesde} onChange={(e) => { setFilterFechaDesde(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha Hasta</Label>
              <Input type="date" value={filterFechaHasta} onChange={(e) => { setFilterFechaHasta(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Criticidad</Label>
              <Select value={filterCriticidad || 'all'} onValueChange={(v) => { setFilterCriticidad(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="NORMAL">NORMAL</SelectItem>
                  <SelectItem value="MEDIA">MEDIA</SelectItem>
                  <SelectItem value="ALTO">ALTO</SelectItem>
                  <SelectItem value="ALTA">ALTA</SelectItem>
                  <SelectItem value="CRITICO">CRÍTICO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Filtros activos:</span>
              {activeFilters.map((f) => (
                <Badge key={f.key} variant="secondary" className="text-xs gap-1 pr-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {f.label}: {f.value}
                  <button onClick={() => clearFilter(f.key)} className="ml-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-6 text-red-600 hover:text-red-700" onClick={clearAllFilters}>
                Limpiar todo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── View Toggle ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? 'Cargando...' : `${total} registro${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <Button variant={viewMode === 'timeline' ? 'default' : 'ghost'} size="sm" className={`h-7 text-xs gap-1.5 ${viewMode === 'timeline' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`} onClick={() => setViewMode('timeline')}>
            <AlignLeft className="h-3.5 w-3.5" /> Timeline
          </Button>
          <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" className={`h-7 text-xs gap-1.5 ${viewMode === 'table' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`} onClick={() => setViewMode('table')}>
            <List className="h-3.5 w-3.5" /> Tabla
          </Button>
        </div>
      </div>

      {/* ─── Loading state ─────────────────────────────────────────────── */}
      {loading ? (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <ScrollText className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No se encontraron registros</p>
          </CardContent>
        </Card>
      ) : viewMode === 'timeline' ? (
        /* ─── Timeline View ─────────────────────────────────────────────── */
        <div className="relative">
          {/* Vertical connecting line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          <div className="space-y-0">
            {sortedEntries.map((entry, idx) => {
              const Icon = getActionIcon(entry.accion);
              const actionColor = getActionColor(entry.accion);
              const sev = getSeverityStyle(entry.nivel_criticidad);
              const isExpanded = expandedIds.has(entry.id);
              const isLast = idx === sortedEntries.length - 1;

              return (
                <div key={entry.id} className={`relative flex gap-3 sm:gap-4 ${!isLast ? 'pb-2' : ''}`}>
                  {/* Timeline node */}
                  <div className="relative z-10 shrink-0 hidden sm:flex flex-col items-center">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm ${actionColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Content */}
                  <Card className={`flex-1 shadow-sm transition-all duration-200 hover:shadow-md cursor-pointer border-l-4 ${sev.border} ${isExpanded ? 'ring-1 ring-emerald-200 dark:ring-emerald-800' : ''}`} onClick={() => toggleExpand(entry.id)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Mobile icon */}
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 sm:hidden ${actionColor}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs font-semibold">{entry.accion}</Badge>
                              <Badge className={`text-xs ${sev.bg} ${sev.text} border ${sev.border}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot} mr-1.5`} />
                                {entry.nivel_criticidad}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 truncate">
                              {entry.detalle_adicional || entry.tabla_afectada || entry.accion}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{relativeTime(entry.fecha_accion)}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.fecha_accion).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        </div>
                      </div>

                      {/* User info line */}
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                            {entry.usuario ? getInitials(entry.usuario.nombre, entry.usuario.apellido) : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {entry.usuario ? `${entry.usuario.nombre} ${entry.usuario.apellido}` : entry.usuario_email || 'Sistema'}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 sm:hidden">{relativeTime(entry.fecha_accion)}</span>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(entry.fecha_accion).toLocaleString('es-SV')}</span>
                            {entry.tabla_afectada && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {entry.tabla_afectada}</span>}
                            {entry.registro_id && <span className="font-mono">ID: {entry.registro_id.slice(0, 12)}...</span>}
                          </div>

                          {(entry.valor_anterior || entry.valor_nuevo) && (
                            <JsonDiff oldVal={entry.valor_anterior} newVal={entry.valor_nuevo} />
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDetailEntry(entry)}>
                              <Eye className="h-3 w-3 mr-1" /> Ver Detalle Completo
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─── Table View ────────────────────────────────────────────────── */
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 w-8" />
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none" onClick={() => handleSort('fecha_accion')}>
                      <span className="inline-flex items-center">Fecha/Hora <SortIcon field="fecha_accion" /></span>
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none" onClick={() => handleSort('usuario_email')}>
                      <span className="inline-flex items-center">Usuario <SortIcon field="usuario_email" /></span>
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none" onClick={() => handleSort('accion')}>
                      <span className="inline-flex items-center">Acción <SortIcon field="accion" /></span>
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Tabla</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Registro ID</th>
                    <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none" onClick={() => handleSort('nivel_criticidad')}>
                      <span className="inline-flex items-center justify-center">Criticidad <SortIcon field="nivel_criticidad" /></span>
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => {
                    const Icon = getActionIcon(entry.accion);
                    const actionColor = getActionColor(entry.accion);
                    const sev = getSeverityStyle(entry.nivel_criticidad);
                    const isExpanded = expandedIds.has(entry.id);
                    return (
                      <React.Fragment key={entry.id}>
                        <tr className={`border-b hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors ${isExpanded ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`} onClick={() => toggleExpand(entry.id)}>
                          <td className="p-3">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center ${actionColor}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                          </td>
                          <td className="p-3 text-xs whitespace-nowrap">
                            <div>{new Date(entry.fecha_accion).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' })}</div>
                            <div className="text-slate-400 dark:text-slate-500">{new Date(entry.fecha_accion).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="p-3 text-xs">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[9px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                  {entry.usuario ? getInitials(entry.usuario.nombre, entry.usuario.apellido) : '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                  {entry.usuario ? `${entry.usuario.nombre} ${entry.usuario.apellido}` : entry.usuario_email || '-'}
                                </div>
                                {entry.usuario?.email && <div className="text-slate-400 dark:text-slate-500">{entry.usuario.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs font-semibold">{entry.accion}</Badge>
                          </td>
                          <td className="p-3 text-xs text-slate-600 dark:text-slate-400">{entry.tabla_afectada || '-'}</td>
                          <td className="p-3 text-xs font-mono text-slate-500 dark:text-slate-400">{entry.registro_id ? entry.registro_id.slice(0, 8) + '...' : '-'}</td>
                          <td className="p-3 text-center">
                            <Badge className={`text-xs ${sev.bg} ${sev.text} border ${sev.border}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sev.dot} mr-1`} />
                              {entry.nivel_criticidad}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-slate-600 dark:text-slate-400 max-w-48 truncate" title={entry.detalle_adicional || ''}>
                            {entry.detalle_adicional || '-'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b bg-slate-50 dark:bg-slate-800/30">
                            <td colSpan={8} className="p-4">
                              <JsonDiff oldVal={entry.valor_anterior} newVal={entry.valor_nuevo} />
                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> IP: {entry.ip_origen || '-'}</span>
                                <span className="flex items-center gap-1"><Monitor className="h-3 w-3" /> {entry.user_agent ? entry.user_agent.slice(0, 50) + (entry.user_agent.length > 50 ? '...' : '') : '-'}</span>
                                {entry.resultado && <span>Resultado: {entry.resultado}</span>}
                              </div>
                              <Button variant="outline" size="sm" className="h-7 text-xs mt-2" onClick={() => setDetailEntry(entry)}>
                                <Eye className="h-3 w-3 mr-1" /> Ver Detalle Completo
                              </Button>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
              <span className="px-2">{page}</span>
              <span>de</span>
              <span className="px-2">{totalPages}</span>
            </div>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* ─── Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!detailEntry} onOpenChange={(open) => { if (!open) setDetailEntry(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => { const Icon = getActionIcon(detailEntry.accion); return <Icon className="h-5 w-5 text-emerald-600" />; })()}
                  Detalle de Evento — {detailEntry.accion}
                </DialogTitle>
                <DialogDescription>
                  Registro de auditoría #{detailEntry.id.slice(0, 12)}...
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Severity & Result */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs ${getSeverityStyle(detailEntry.nivel_criticidad).bg} ${getSeverityStyle(detailEntry.nivel_criticidad).text} border ${getSeverityStyle(detailEntry.nivel_criticidad).border}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${getSeverityStyle(detailEntry.nivel_criticidad).dot} mr-1.5`} />
                    Criticidad: {detailEntry.nivel_criticidad}
                  </Badge>
                  {detailEntry.resultado && (
                    <Badge variant="outline" className="text-xs">{detailEntry.resultado}</Badge>
                  )}
                </div>

                <Separator />

                {/* User Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                      {detailEntry.usuario ? getInitials(detailEntry.usuario.nombre, detailEntry.usuario.apellido) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {detailEntry.usuario ? `${detailEntry.usuario.nombre} ${detailEntry.usuario.apellido}` : detailEntry.usuario_email || 'Sistema'}
                    </p>
                    {detailEntry.usuario?.email && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{detailEntry.usuario.email}</p>
                    )}
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Fecha y Hora</p>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{new Date(detailEntry.fecha_accion).toLocaleString('es-SV')}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{relativeTime(detailEntry.fecha_accion)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <Globe className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">IP de Origen</p>
                      <p className="font-medium text-slate-800 dark:text-slate-200 font-mono">{detailEntry.ip_origen || 'No registrada'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <Monitor className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">User Agent</p>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 break-all">{detailEntry.user_agent || 'No registrado'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <User className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Usuario ID</p>
                      <p className="font-medium text-slate-800 dark:text-slate-200 font-mono text-xs">{detailEntry.usuario_id || 'Sistema'}</p>
                    </div>
                  </div>
                </div>

                {/* Affected record */}
                {(detailEntry.tabla_afectada || detailEntry.registro_id) && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Registro Afectado</p>
                    <div className="flex items-center gap-2 text-sm">
                      {detailEntry.tabla_afectada && (
                        <Badge variant="outline" className="text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300">
                          {detailEntry.tabla_afectada}
                        </Badge>
                      )}
                      {detailEntry.registro_id && (
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          ID: {detailEntry.registro_id}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional detail */}
                {detailEntry.detalle_adicional && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Detalle Adicional</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{detailEntry.detalle_adicional}</p>
                  </div>
                )}

                {/* Value diff */}
                {(detailEntry.valor_anterior || detailEntry.valor_nuevo) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Cambios Realizados</p>
                    <JsonDiff oldVal={detailEntry.valor_anterior} newVal={detailEntry.valor_nuevo} />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Inbox, Search, Filter, CheckCircle, XCircle, Clock, X, Eye,
  Plane, FileBadge, Receipt, FileText, Edit3, AlertCircle,
  User, Mail, Phone, Building2, Calendar, MessageSquare, ChevronLeft, ChevronRight,
  CheckCheck, Loader2, CircleDot, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/toaster';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================
type SolicitudEstado = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';

interface SolicitudBandeja {
  id: string;
  tipo: string;
  estado: SolicitudEstado;
  detalle: string | null;
  fecha_solicitud: string;
  fecha_resolucion: string | null;
  empleado: {
    id: string;
    codigo_empleado: string;
    primer_nombre: string;
    segundo_nombre: string | null;
    primer_apellido: string;
    segundo_apellido: string | null;
    email_personal: string | null;
    telefono: string | null;
    perfil_puesto: { nombre_puesto: string } | null;
    area: { nombre: string } | null;
  };
  aprobada_por: { nombre: string; apellido: string; email: string } | null;
}

interface BandejaStats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  canceladas: number;
  byTipo: Record<string, number>;
}

interface SolicitudesBandejaProps {
  accessToken: string;
  userRole: string;
}

// ============================================================
// Constants
// ============================================================
const TIPO_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = {
  VACACION: {
    label: 'Vacaciones',
    icon: Plane,
    color: 'text-teal-700',
    bg: 'bg-teal-50 dark:bg-teal-900/30',
    border: 'border-teal-200 dark:border-teal-800',
  },
  CONSTANCIA_EMPLEO: {
    label: 'Constancia de Empleo',
    icon: FileBadge,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  CONSTANCIA_SALARIAL: {
    label: 'Constancia Salarial',
    icon: Receipt,
    color: 'text-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800',
  },
  CONSTANCIA_ISR: {
    label: 'Constancia ISR',
    icon: FileText,
    color: 'text-rose-700',
    bg: 'bg-rose-50 dark:bg-rose-900/30',
    border: 'border-rose-200 dark:border-rose-800',
  },
  CAMBIO_DATOS: {
    label: 'Cambio de Datos',
    icon: Edit3,
    color: 'text-sky-700',
    bg: 'bg-sky-50 dark:bg-sky-900/30',
    border: 'border-sky-200 dark:border-sky-800',
  },
};

const ESTADO_CONFIG: Record<SolicitudEstado, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  PENDIENTE: { label: 'Pendiente', icon: Clock, color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  APROBADA: { label: 'Aprobada', icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  RECHAZADA: { label: 'Rechazada', icon: XCircle, color: 'text-rose-700', bg: 'bg-rose-100 dark:bg-rose-900/40' },
  CANCELADA: { label: 'Cancelada', icon: X, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800/60' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr < 24) return `hace ${diffHr}h`;
  if (diffDay < 30) return `hace ${diffDay}d`;
  return date.toLocaleDateString('es-SV', { day: '2-digit', month: 'short' });
}

// ============================================================
// Component
// ============================================================
export default function SolicitudesBandeja({ accessToken, userRole }: SolicitudesBandejaProps) {
  const [data, setData] = useState<SolicitudBandeja[]>([]);
  const [stats, setStats] = useState<BandejaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [estadoFilter, setEstadoFilter] = useState<string>('PENDIENTE');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail dialog
  const [selected, setSelected] = useState<SolicitudBandeja | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  // Approve/reject dialog
  const [resolveDialog, setResolveDialog] = useState<{
    solicitud: SolicitudBandeja;
    action: 'APROBADA' | 'RECHAZADA';
  } | null>(null);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // -------------------------------------------------------
  // Debounce search
  // -------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // -------------------------------------------------------
  // Fetch bandeja
  // -------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });
      // "_TODOS" sentinel means "no filter"
      if (estadoFilter && estadoFilter !== '_TODOS') params.set('estado', estadoFilter);
      if (tipoFilter && tipoFilter !== '_TODOS') params.set('tipo', tipoFilter);
      if (debouncedSearch) params.set('q', debouncedSearch);

      const res = await fetch(`/api/selfservice/bandeja?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json.data || []);
      setStats(json.stats || null);
      setTotal(json.pagination?.total || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      toast.error('Error al cargar solicitudes', { description: msg });
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, estadoFilter, tipoFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [estadoFilter, tipoFilter, debouncedSearch]);

  // -------------------------------------------------------
  // Approve / reject handler
  // -------------------------------------------------------
  const handleResolve = async () => {
    if (!resolveDialog) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/selfservice/${encodeURIComponent(resolveDialog.solicitud.id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estado: resolveDialog.action,
          comentario: comentario.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      toast.success(
        resolveDialog.action === 'APROBADA'
          ? 'Solicitud aprobada'
          : 'Solicitud rechazada',
        {
          description:
            resolveDialog.action === 'APROBADA'
              ? 'Se ha notificado al empleado.'
              : 'Se ha notificado al empleado del rechazo.',
        }
      );

      setResolveDialog(null);
      setComentario('');
      // Refresh list
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error('Error al procesar solicitud', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------
  // Download constancia PDF (for approved CONSTANCIA_* solicitudes)
  // -------------------------------------------------------
  const handleDownload = async (solicitud: SolicitudBandeja) => {
    try {
      setDownloadingId(solicitud.id);
      const res = await fetch(`/api/selfservice/${encodeURIComponent(solicitud.id)}/descargar`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      a.download = filenameMatch ? filenameMatch[1] : `constancia-${solicitud.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Documento descargado', {
        description: 'El PDF de la constancia ha sido descargado.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error('Error al descargar', { description: msg });
    } finally {
      setDownloadingId(null);
    }
  };

  // -------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------
  const fullName = (s: SolicitudBandeja) =>
    `${s.empleado.primer_nombre}${s.empleado.segundo_nombre ? ' ' + s.empleado.segundo_nombre : ''} ${s.empleado.primer_apellido}${s.empleado.segundo_apellido ? ' ' + s.empleado.segundo_apellido : ''}`;

  const parseDetalle = (detalle: string | null, tipo: string) => {
    if (!detalle) return null;
    if (tipo === 'VACACION') {
      try {
        const parsed = JSON.parse(detalle);
        return {
          tipo: 'vacacion' as const,
          fecha_inicio: parsed.fecha_inicio,
          fecha_fin: parsed.fecha_fin,
          dias: parsed.dias,
          motivo: parsed.motivo,
        };
      } catch {
        return { tipo: 'text' as const, text: detalle };
      }
    }
    return { tipo: 'text' as const, text: detalle };
  };

  // -------------------------------------------------------
  // KPI cards
  // -------------------------------------------------------
  const KpiCards = useMemo(() => {
    if (!stats) return null;
    const cards = [
      { label: 'Total', value: stats.total, icon: Inbox, color: 'text-slate-700', bg: 'bg-slate-100 dark:bg-slate-800/60' },
      { label: 'Pendientes', value: stats.pendientes, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/40' },
      { label: 'Aprobadas', value: stats.aprobadas, icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
      { label: 'Rechazadas', value: stats.rechazadas, icon: XCircle, color: 'text-rose-700', bg: 'bg-rose-100 dark:bg-rose-900/40' },
    ];
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card
              key={c.label}
              className={cn(
                'p-4 sm:p-5 border-0 shadow-sm hover:shadow-md transition-all',
                'bg-white dark:bg-slate-900/60',
                'ring-1 ring-slate-200/60 dark:ring-slate-800/60'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {c.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {c.value}
                  </p>
                </div>
                <div className={cn('flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center', c.bg)}>
                  <Icon className={cn('h-5 w-5', c.color)} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }, [stats]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <Toaster richColors position="top-right" />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Inbox className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Bandeja de Solicitudes
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gestión de solicitudes de empleados (vacaciones, constancias, cambio de datos)
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {KpiCards}

      {/* Filters */}
      <Card className="p-4 border-0 shadow-sm bg-white dark:bg-slate-900/60 ring-1 ring-slate-200/60 dark:ring-slate-800/60">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre o código de empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
            />
          </div>

          {/* Estado filter */}
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full md:w-44 h-10 bg-slate-50 dark:bg-slate-800/50">
              <Filter className="h-4 w-4 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDIENTE">Pendientes</SelectItem>
              <SelectItem value="APROBADA">Aprobadas</SelectItem>
              <SelectItem value="RECHAZADA">Rechazadas</SelectItem>
              <SelectItem value="CANCELADA">Canceladas</SelectItem>
              <SelectItem value="_TODOS">Todos los estados</SelectItem>
            </SelectContent>
          </Select>

          {/* Tipo filter */}
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full md:w-52 h-10 bg-slate-50 dark:bg-slate-800/50">
              <SelectValue placeholder="Tipo de solicitud" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_TODOS">Todos los tipos</SelectItem>
              {Object.entries(TIPO_CONFIG).map(([value, cfg]) => (
                <SelectItem key={value} value={value}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-emerald-600" />
          <p className="text-sm">Cargando solicitudes...</p>
        </div>
      ) : error ? (
        <Card className="p-8 text-center border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-rose-500" />
          <p className="font-medium text-rose-800 dark:text-rose-200">Error al cargar</p>
          <p className="text-sm text-rose-600 dark:text-rose-300 mt-1">{error}</p>
          <Button onClick={fetchData} variant="outline" className="mt-4">
            Reintentar
          </Button>
        </Card>
      ) : data.length === 0 ? (
        <Card className="p-12 text-center border-0 shadow-sm bg-white dark:bg-slate-900/60 ring-1 ring-slate-200/60 dark:ring-slate-800/60">
          <CircleDot className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700 dark:text-slate-200">Sin solicitudes</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            No hay solicitudes que coincidan con los filtros seleccionados.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4">
            {data.map((s) => {
              const tipoCfg = TIPO_CONFIG[s.tipo] || {
                label: s.tipo,
                icon: AlertCircle,
                color: 'text-slate-700',
                bg: 'bg-slate-50 dark:bg-slate-800/60',
                border: 'border-slate-200 dark:border-slate-700',
              };
              const estadoCfg = ESTADO_CONFIG[s.estado];
              const TipoIcon = tipoCfg.icon;
              const EstadoIcon = estadoCfg.icon;

              return (
                <Card
                  key={s.id}
                  className={cn(
                    'p-4 sm:p-5 border-0 shadow-sm hover:shadow-md transition-all cursor-pointer',
                    'bg-white dark:bg-slate-900/60',
                    'ring-1 ring-slate-200/60 dark:ring-slate-800/60 hover:ring-emerald-300/60 dark:hover:ring-emerald-700/60'
                  )}
                  onClick={() => {
                    setSelected(s);
                    setDetalleOpen(true);
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    {/* Left: tipo icon + name */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn('flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center border', tipoCfg.bg, tipoCfg.border)}>
                        <TipoIcon className={cn('h-5 w-5', tipoCfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {fullName(s)}
                          </h3>
                          <Badge variant="outline" className="text-[10px] font-medium border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                            {s.empleado.codigo_empleado}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                          {tipoCfg.label}
                          {s.empleado.perfil_puesto?.nombre_puesto && (
                            <span className="text-slate-400 dark:text-slate-500"> · {s.empleado.perfil_puesto.nombre_puesto}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {timeAgo(s.fecha_solicitud)}
                          </span>
                          {s.empleado.area?.nombre && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {s.empleado.area.nombre}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: estado + actions */}
                    <div className="flex items-center gap-2 sm:gap-3 sm:flex-shrink-0">
                      <Badge className={cn('text-[11px] font-medium', estadoCfg.bg, estadoCfg.color)}>
                        <EstadoIcon className="h-3 w-3 mr-1" />
                        {estadoCfg.label}
                      </Badge>
                      {s.estado === 'PENDIENTE' && (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                            onClick={() => {
                              setResolveDialog({ solicitud: s, action: 'APROBADA' });
                              setComentario('');
                            }}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                            onClick={() => {
                              setResolveDialog({ solicitud: s, action: 'RECHAZADA' });
                              setComentario('');
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(s);
                          setDetalleOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {s.estado === 'APROBADA' && ['CONSTANCIA_EMPLEO', 'CONSTANCIA_SALARIAL', 'CONSTANCIA_ISR'].includes(s.tipo) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          disabled={downloadingId === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(s);
                          }}
                          title="Descargar PDF"
                        >
                          {downloadingId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Página {page} de {totalPages} · {total} solicitudes
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Detail Dialog ────────────────────────────────── */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && (() => {
                const cfg = TIPO_CONFIG[selected.tipo] || TIPO_CONFIG.CAMBIO_DATOS;
                const Icon = cfg.icon;
                return <Icon className={cn('h-5 w-5', cfg.color)} />;
              })()}
              Detalle de Solicitud
            </DialogTitle>
            <DialogDescription>
              Información completa de la solicitud y el empleado.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-5 pb-2">
                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <Badge className={cn('text-xs', ESTADO_CONFIG[selected.estado].bg, ESTADO_CONFIG[selected.estado].color)}>
                    {ESTADO_CONFIG[selected.estado].label}
                  </Badge>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Solicitada el {formatDate(selected.fecha_solicitud)}
                  </p>
                </div>

                {/* Employee info */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Empleado
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Nombre</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{fullName(selected)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CircleDot className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Código</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selected.empleado.codigo_empleado}</p>
                      </div>
                    </div>
                    {selected.empleado.email_personal && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Email</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{selected.empleado.email_personal}</p>
                        </div>
                      </div>
                    )}
                    {selected.empleado.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Teléfono</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selected.empleado.telefono}</p>
                        </div>
                      </div>
                    )}
                    {selected.empleado.perfil_puesto?.nombre_puesto && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Puesto</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selected.empleado.perfil_puesto.nombre_puesto}</p>
                        </div>
                      </div>
                    )}
                    {selected.empleado.area?.nombre && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Área</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selected.empleado.area.nombre}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Solicitud detalle */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Detalle de la Solicitud
                  </h4>
                  <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    {(() => {
                      const parsed = parseDetalle(selected.detalle, selected.tipo);
                      if (!parsed) {
                        return <p className="text-sm text-slate-500 dark:text-slate-400 italic">Sin detalle adicional.</p>;
                      }
                      if (parsed.tipo === 'vacacion') {
                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">Fecha inicio</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {new Date(parsed.fecha_inicio).toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">Fecha fin</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {new Date(parsed.fecha_fin).toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">Días solicitados</p>
                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{parsed.dias} día{parsed.dias !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            {parsed.motivo && (
                              <div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">Motivo</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{parsed.motivo}</p>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{parsed.text}</p>;
                    })()}
                  </div>
                </div>

                {/* Resolution info */}
                {selected.estado !== 'PENDIENTE' && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Resolución
                    </h4>
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Resuelta por:</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {selected.aprobada_por
                            ? `${selected.aprobada_por.nombre} ${selected.aprobada_por.apellido}`
                            : 'N/A'}
                        </span>
                      </div>
                      {selected.fecha_resolucion && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Fecha:</span>
                          <span className="text-sm text-slate-900 dark:text-slate-100">{formatDate(selected.fecha_resolucion)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {selected?.estado === 'PENDIENTE' && (
              <>
                <Button
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                  onClick={() => {
                    setResolveDialog({ solicitud: selected, action: 'RECHAZADA' });
                    setComentario('');
                    setDetalleOpen(false);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setResolveDialog({ solicitud: selected, action: 'APROBADA' });
                    setComentario('');
                    setDetalleOpen(false);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprobar
                </Button>
              </>
            )}
            {selected?.estado !== 'PENDIENTE' && (
              <Button variant="outline" onClick={() => setDetalleOpen(false)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resolve Dialog (approve/reject) ─────────────── */}
      <Dialog open={!!resolveDialog} onOpenChange={(o) => !o && !submitting && setResolveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resolveDialog?.action === 'APROBADA' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  Aprobar Solicitud
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-600" />
                  Rechazar Solicitud
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {resolveDialog?.action === 'APROBADA'
                ? 'La solicitud será aprobada y se notificará al empleado.'
                : 'La solicitud será rechazada y se notificará al empleado. Se recomienda agregar un motivo.'}
            </DialogDescription>
          </DialogHeader>

          {resolveDialog && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-sm">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Empleado</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{fullName(resolveDialog.solicitud)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {TIPO_CONFIG[resolveDialog.solicitud.tipo]?.label || resolveDialog.solicitud.tipo}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comentario {resolveDialog.action === 'RECHAZADA' && <span className="text-rose-600">*</span>}
                </label>
                <Textarea
                  placeholder={
                    resolveDialog.action === 'APROBADA'
                      ? 'Comentario opcional para el empleado...'
                      : 'Explica el motivo del rechazo (obligatorio)...'
                  }
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="bg-slate-50 dark:bg-slate-800/50 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  {comentario.length}/500
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => !submitting && setResolveDialog(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              className={
                resolveDialog?.action === 'APROBADA'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }
              onClick={handleResolve}
              disabled={
                submitting ||
                (resolveDialog?.action === 'RECHAZADA' && !comentario.trim())
              }
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {resolveDialog?.action === 'APROBADA' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Aprobación
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirmar Rechazo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

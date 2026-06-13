'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, Clock, CheckCircle2, XCircle, Plus, Loader2, Search,
  Zap, Gift, Percent, Heart, CalendarDays, FileText, Eye, Ban,
  Moon, Sun, Briefcase, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface IncidenceManagerProps {
  accessToken: string | null;
  userRole: UserRole;
}

interface Incidencia {
  id: string;
  tipo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  cantidad_horas: number | null;
  tipo_horas_extra: string | null;
  monto: number | null;
  descripcion: string | null;
  numero_incapacidad: string | null;
  empleado: {
    id: string;
    codigo_empleado: string;
    primer_nombre: string;
    segundo_nombre: string | null;
    primer_apellido: string;
    segundo_apellido: string | null;
  };
  aprobada_por: { nombre: string; apellido: string } | null;
}

interface EmpleadoOption {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  primer_apellido: string;
}

const TIPO_LABELS: Record<string, string> = {
  HORAS_EXTRA: 'Horas Extra',
  AUSENCIA: 'Ausencia',
  INCAPACIDAD_ISSS: 'Incapacidad ISSS',
  PERMISO: 'Permiso',
  COMISION: 'Comisión',
  BONO: 'Bono',
  DESCUENTO_ESPECIAL: 'Descuento Especial',
};

const TIPO_ICONS: Record<string, React.ElementType> = {
  HORAS_EXTRA: Timer,
  AUSENCIA: CalendarDays,
  INCAPACIDAD_ISSS: Heart,
  PERMISO: FileText,
  COMISION: Percent,
  BONO: Gift,
  DESCUENTO_ESPECIAL: Ban,
};

const TIPO_COLORS: Record<string, { bg: string; icon: string; accent: string; border: string }> = {
  HORAS_EXTRA: { bg: 'bg-sky-50 dark:bg-sky-900/20', icon: 'text-sky-600 dark:text-sky-400', accent: 'bg-sky-500', border: 'border-sky-200 dark:border-sky-800' },
  AUSENCIA: { bg: 'bg-slate-50 dark:bg-slate-800', icon: 'text-slate-600 dark:text-slate-400', accent: 'bg-slate-500', border: 'border-slate-200 dark:border-slate-700' },
  INCAPACIDAD_ISSS: { bg: 'bg-rose-50 dark:bg-rose-900/20', icon: 'text-rose-600 dark:text-rose-400', accent: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800' },
  PERMISO: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', accent: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800' },
  COMISION: { bg: 'bg-violet-50 dark:bg-violet-900/20', icon: 'text-violet-600 dark:text-violet-400', accent: 'bg-violet-500', border: 'border-violet-200 dark:border-violet-800' },
  BONO: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  DESCUENTO_ESPECIAL: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400', accent: 'bg-red-500', border: 'border-red-200 dark:border-red-800' },
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  APROBADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  RECHAZADA: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const ESTADO_DOT: Record<string, string> = {
  PENDIENTE: 'bg-amber-500',
  APROBADA: 'bg-emerald-500',
  RECHAZADA: 'bg-red-500',
};

function AvatarInitials({ nombre, apellido }: { nombre: string; apellido: string }) {
  const initials = (nombre[0] || '') + (apellido[0] || '');
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials.toUpperCase()}
    </div>
  );
}

export default function IncidenceManager({ accessToken, userRole }: IncidenceManagerProps) {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 0 });
  const [tipoFilter, setTipoFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    empleado_id: '',
    tipo: 'HORAS_EXTRA',
    fecha_inicio: '',
    fecha_fin: '',
    descripcion: '',
    // Conditional
    cantidad_horas: '',
    tipo_horas_extra: 'DIURNA',
    monto: '',
    numero_incapacidad: '',
  });

  const fetchIncidencias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));
      if (tipoFilter && tipoFilter !== 'all') params.set('tipo', tipoFilter);
      if (estadoFilter && estadoFilter !== 'all') params.set('estado', estadoFilter);

      const res = await fetch(`/api/incidencias?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setIncidencias(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching incidencias:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, pagination.page, pagination.pageSize, tipoFilter, estadoFilter]);

  useEffect(() => { fetchIncidencias(); }, [fetchIncidencias]);

  // Fetch employees for dropdown
  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        const res = await fetch('/api/empleados?pageSize=100&estado=ACTIVO', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (res.ok) setEmpleados(data.data || []);
      } catch { /* ignore */ }
    };
    fetchEmpleados();
  }, [accessToken]);

  // Summary counts
  const summary = {
    total: pagination.total,
    pendientes: incidencias.filter(i => i.estado === 'PENDIENTE').length,
    aprobadas: incidencias.filter(i => i.estado === 'APROBADA').length,
    rechazadas: incidencias.filter(i => i.estado === 'RECHAZADA').length,
  };

  const handleCreate = async () => {
    // Validate
    if (!form.empleado_id) { toast({ title: 'Error', description: 'Seleccione un empleado', variant: 'destructive' }); return; }
    if (!form.tipo) { toast({ title: 'Error', description: 'Seleccione el tipo de incidencia', variant: 'destructive' }); return; }
    if (!form.fecha_inicio) { toast({ title: 'Error', description: 'Fecha inicio es requerida', variant: 'destructive' }); return; }

    if (form.tipo === 'HORAS_EXTRA' && (!form.cantidad_horas || parseFloat(form.cantidad_horas) <= 0)) {
      toast({ title: 'Error', description: 'Cantidad de horas es requerida para HORAS_EXTRA', variant: 'destructive' });
      return;
    }
    if (['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && (!form.monto || parseFloat(form.monto) <= 0)) {
      toast({ title: 'Error', description: 'Monto es requerido', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        empleado_id: form.empleado_id,
        tipo: form.tipo,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null,
        descripcion: form.descripcion || null,
      };

      if (form.tipo === 'HORAS_EXTRA') {
        body.cantidad_horas = parseFloat(form.cantidad_horas);
        body.tipo_horas_extra = form.tipo_horas_extra;
      }
      if (form.tipo === 'INCAPACIDAD_ISSS') {
        body.numero_incapacidad = form.numero_incapacidad;
      }
      if (['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo)) {
        body.monto = parseFloat(form.monto);
      }

      const res = await fetch('/api/incidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Incidencia creada', description: 'La incidencia ha sido registrada' });
        setDialogOpen(false);
        setPreviewMode(false);
        resetForm();
        fetchIncidencias();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al crear incidencia', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReject = async (id: string, estado: 'APROBADA' | 'RECHAZADA') => {
    try {
      const res = await fetch(`/api/incidencias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `Incidencia ${estado.toLowerCase()}`, description: `La incidencia ha sido ${estado === 'APROBADA' ? 'aprobada' : 'rechazada'}` });
        fetchIncidencias();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setForm({
      empleado_id: '', tipo: 'HORAS_EXTRA', fecha_inicio: '', fecha_fin: '',
      descripcion: '', cantidad_horas: '', tipo_horas_extra: 'DIURNA',
      monto: '', numero_incapacidad: '',
    });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-SV');
  const formatMonto = (v: number | null) => v ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const getNombreEmp = (inc: Incidencia) =>
    `${inc.empleado.primer_nombre} ${inc.empleado.primer_apellido}`;

  const canCreate = userRole === 'ADMIN' || userRole === 'ANALISTA';
  const canApprove = userRole === 'ADMIN' || userRole === 'APROBADOR';

  const filteredEmpleados = searchEmpleado
    ? empleados.filter(e => `${e.primer_nombre} ${e.primer_apellido} ${e.codigo_empleado}`.toLowerCase().includes(searchEmpleado.toLowerCase()))
    : empleados;

  const selectedEmpleadoName = form.empleado_id
    ? (() => {
        const emp = empleados.find(e => e.id === form.empleado_id);
        return emp ? `${emp.primer_nombre} ${emp.primer_apellido}` : '';
      })()
    : '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Incidencias de Nómina
        </h2>
        {canCreate && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800" onClick={() => { setDialogOpen(true); setPreviewMode(false); }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Incidencia
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              <AlertCircle className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Incidencias</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{summary.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800 border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pendientes</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.pendientes}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800 border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Aprobadas</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.aprobadas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800 border-l-4 border-l-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Rechazadas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.rechazadas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={tipoFilter} onValueChange={v => { setTipoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={v => { setEstadoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="APROBADA">Aprobada</SelectItem>
                <SelectItem value="RECHAZADA">Rechazada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidence Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4 dark:bg-slate-700" />
                <Skeleton className="h-4 w-1/2 dark:bg-slate-700" />
                <Skeleton className="h-4 w-2/3 dark:bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : incidencias.length === 0 ? (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No se encontraron incidencias</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Intente ajustar los filtros</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidencias.map(inc => {
            const tipoStyle = TIPO_COLORS[inc.tipo] || TIPO_COLORS.AUSENCIA;
            const TipoIcon = TIPO_ICONS[inc.tipo] || AlertCircle;
            return (
              <Card
                key={inc.id}
                className={`shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 dark:bg-slate-900 dark:hover:border-slate-700 border-l-4 ${tipoStyle.border} ${tipoStyle.bg}`}
              >
                <CardContent className="p-4">
                  {/* Type icon + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${tipoStyle.bg} border ${tipoStyle.border}`}>
                      <TipoIcon className={`h-5 w-5 ${tipoStyle.icon}`} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${ESTADO_DOT[inc.estado] || 'bg-slate-400'}`} />
                      <Badge className={`${ESTADO_COLORS[inc.estado] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'} text-[11px] px-2 py-0.5`}>
                        {inc.estado}
                      </Badge>
                    </div>
                  </div>

                  {/* Type label */}
                  <p className={`text-xs font-medium ${tipoStyle.icon} mb-2`}>
                    {TIPO_LABELS[inc.tipo] || inc.tipo}
                  </p>

                  {/* Employee info with avatar */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <AvatarInitials nombre={inc.empleado.primer_nombre} apellido={inc.empleado.primer_apellido} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate dark:text-slate-100">{getNombreEmp(inc)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{inc.empleado.codigo_empleado}</p>
                    </div>
                  </div>

                  {/* Date range */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatDate(inc.fecha_inicio)}</span>
                    {inc.fecha_fin && (
                      <>
                        <span>→</span>
                        <span>{formatDate(inc.fecha_fin)}</span>
                      </>
                    )}
                  </div>

                  {/* Amount / Hours in prominent display */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-3 border border-slate-100 dark:border-slate-700">
                    {inc.cantidad_horas ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Horas Extra</span>
                        <span className="text-xl font-bold text-sky-600 dark:text-sky-400">{inc.cantidad_horas}h</span>
                      </div>
                    ) : inc.monto ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Monto</span>
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatMonto(inc.monto)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Sin monto/horas</span>
                        <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
                      </div>
                    )}
                    {inc.tipo_horas_extra && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Tipo: {inc.tipo_horas_extra}</p>
                    )}
                    {inc.numero_incapacidad && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Incapacidad #: {inc.numero_incapacidad}</p>
                    )}
                  </div>

                  {/* Description snippet */}
                  {inc.descripcion && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{inc.descripcion}</p>
                  )}

                  {/* Action buttons */}
                  {canApprove && inc.estado === 'PENDIENTE' && (
                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                        onClick={() => handleApproveReject(inc.id, 'APROBADA')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprobar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                        onClick={() => handleApproveReject(inc.id, 'RECHAZADA')}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Rechazar
                      </Button>
                    </div>
                  )}

                  {/* Approved by info */}
                  {inc.aprobada_por && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                      Por: {inc.aprobada_por.nombre} {inc.aprobada_por.apellido}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* New Incidence Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setPreviewMode(false); } }}>
        <DialogContent className="sm:max-w-lg dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">Nueva Incidencia</DialogTitle>
            <DialogDescription className="dark:text-slate-400">Registrar una incidencia de nómina</DialogDescription>
          </DialogHeader>

          {!previewMode ? (
            <div className="space-y-4">
              {/* Employee search */}
              <div>
                <Label className="dark:text-slate-300">Empleado *</Label>
                <div className="space-y-2 mt-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      placeholder="Buscar empleado..."
                      value={searchEmpleado}
                      onChange={e => setSearchEmpleado(e.target.value)}
                      className="h-9 pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <Select value={form.empleado_id} onValueChange={v => setForm(p => ({ ...p, empleado_id: v }))}>
                    <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                    <SelectContent>
                      {filteredEmpleados.slice(0, 20).map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.primer_nombre} {e.primer_apellido} ({e.codigo_empleado})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Type selector with visual icons */}
              <div>
                <Label className="dark:text-slate-300 mb-2 block">Tipo de Incidencia *</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Object.entries(TIPO_LABELS).map(([key, label]) => {
                    const tipoStyle = TIPO_COLORS[key];
                    const TipoIcon = TIPO_ICONS[key] || AlertCircle;
                    const isSelected = form.tipo === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, tipo: key }))}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs transition-all ${
                          isSelected
                            ? `${tipoStyle.bg} ${tipoStyle.border} ${tipoStyle.icon} ring-2 ring-offset-1 dark:ring-offset-slate-900`
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <TipoIcon className="h-5 w-5" />
                        <span className="text-[10px] leading-tight text-center">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="dark:text-slate-300">Fecha Inicio *</Label>
                  <Input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                </div>
                <div>
                  <Label className="dark:text-slate-300">Fecha Fin</Label>
                  <Input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                </div>
              </div>

              {/* Conditional: HORAS_EXTRA */}
              {form.tipo === 'HORAS_EXTRA' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
                  <div>
                    <Label className="text-sky-700 dark:text-sky-300">Cantidad de Horas *</Label>
                    <Input type="number" step="0.5" value={form.cantidad_horas} onChange={e => setForm(p => ({ ...p, cantidad_horas: e.target.value }))} className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Máximo 10h/semana (Art. 169 CT)</p>
                  </div>
                  <div>
                    <Label className="text-sky-700 dark:text-sky-300">Tipo de Horas Extra</Label>
                    <Select value={form.tipo_horas_extra} onValueChange={v => setForm(p => ({ ...p, tipo_horas_extra: v }))}>
                      <SelectTrigger className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DIURNA">Diurna</SelectItem>
                        <SelectItem value="NOCTURNA">Nocturna</SelectItem>
                        <SelectItem value="DESCANSO">Día de Descanso</SelectItem>
                        <SelectItem value="ASUETO">Asueto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Conditional: INCAPACIDAD_ISSS */}
              {form.tipo === 'INCAPACIDAD_ISSS' && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                  <Label className="text-rose-700 dark:text-rose-300">Número de Incapacidad *</Label>
                  <Input value={form.numero_incapacidad} onChange={e => setForm(p => ({ ...p, numero_incapacidad: e.target.value }))} className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                </div>
              )}

              {/* Conditional: COMISION/BONO/DESCUENTO_ESPECIAL */}
              {['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && (
                <div className={`p-3 rounded-lg border ${
                  form.tipo === 'BONO'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : form.tipo === 'COMISION'
                    ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <Label className={`${
                    form.tipo === 'BONO'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : form.tipo === 'COMISION'
                      ? 'text-violet-700 dark:text-violet-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>Monto (USD) *</Label>
                  <Input type="number" step="0.01" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                </div>
              )}

              <div>
                <Label className="dark:text-slate-300">Descripción</Label>
                <Input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
                <Button
                  variant="outline"
                  onClick={() => setPreviewMode(true)}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                >
                  <Eye className="h-4 w-4 mr-1" /> Vista Previa
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800" onClick={handleCreate} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Crear Incidencia
                </Button>
              </div>
            </div>
          ) : (
            /* Preview Mode */
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">VISTA PREVIA DE INCIDENCIA</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AvatarInitials
                      nombre={selectedEmpleadoName ? selectedEmpleadoName.split(' ')[0] : '?'}
                      apellido={selectedEmpleadoName ? selectedEmpleadoName.split(' ').slice(1).join(' ') || selectedEmpleadoName[0] : '?'}
                    />
                    <div>
                      <p className="font-medium dark:text-slate-100">{selectedEmpleadoName || 'Sin empleado'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{TIPO_LABELS[form.tipo]}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Fecha Inicio</p>
                      <p className="dark:text-slate-200">{form.fecha_inicio ? formatDate(form.fecha_inicio) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Fecha Fin</p>
                      <p className="dark:text-slate-200">{form.fecha_fin ? formatDate(form.fecha_fin) : '—'}</p>
                    </div>
                    {form.tipo === 'HORAS_EXTRA' && form.cantidad_horas && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Horas</p>
                        <p className="font-bold text-sky-600 dark:text-sky-400">{form.cantidad_horas}h ({form.tipo_horas_extra})</p>
                      </div>
                    )}
                    {['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && form.monto && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Monto</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">${parseFloat(form.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}
                    {form.tipo === 'INCAPACIDAD_ISSS' && form.numero_incapacidad && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Incapacidad #</p>
                        <p className="dark:text-slate-200">{form.numero_incapacidad}</p>
                      </div>
                    )}
                  </div>
                  {form.descripcion && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Descripción</p>
                      <p className="text-sm dark:text-slate-300">{form.descripcion}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewMode(false)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                  ← Editar
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800" onClick={handleCreate} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Confirmar Incidencia
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

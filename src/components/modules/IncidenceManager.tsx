'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle, Clock, CheckCircle2, XCircle, Plus, Loader2, Search,
  Zap, Gift, Percent, Heart, CalendarDays, FileText, Eye, Ban,
  Briefcase, Timer, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  DoorOpen, HeartPulse, Scale, AlertTriangle, Info, X, Filter,
  ThumbsUp, ThumbsDown, UserCheck, CalendarCheck, ArrowRight,
  ShieldCheck, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  fecha_creacion?: string;
  fecha_actualizacion?: string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

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
  HORAS_EXTRA: Clock,
  AUSENCIA: XCircle,
  INCAPACIDAD_ISSS: HeartPulse,
  PERMISO: DoorOpen,
  COMISION: Percent,
  BONO: Gift,
  DESCUENTO_ESPECIAL: Ban,
};

const TIPO_COLORS: Record<string, { bg: string; icon: string; accent: string; border: string }> = {
  HORAS_EXTRA: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', accent: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800' },
  AUSENCIA: { bg: 'bg-slate-50 dark:bg-slate-800', icon: 'text-slate-600 dark:text-slate-400', accent: 'bg-slate-500', border: 'border-slate-200 dark:border-slate-700' },
  INCAPACIDAD_ISSS: { bg: 'bg-rose-50 dark:bg-rose-900/20', icon: 'text-rose-600 dark:text-rose-400', accent: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800' },
  PERMISO: { bg: 'bg-teal-50 dark:bg-teal-900/20', icon: 'text-teal-600 dark:text-teal-400', accent: 'bg-teal-500', border: 'border-teal-200 dark:border-teal-800' },
  COMISION: { bg: 'bg-violet-50 dark:bg-violet-900/20', icon: 'text-violet-600 dark:text-violet-400', accent: 'bg-violet-500', border: 'border-violet-200 dark:border-violet-800' },
  BONO: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  DESCUENTO_ESPECIAL: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400', accent: 'bg-red-500', border: 'border-red-200 dark:border-red-800' },
};

// Legal references per type
const TIPO_LEGAL_REF: Record<string, string> = {
  HORAS_EXTRA: 'Art. 169 CT',
  AUSENCIA: 'Art. 52 CT',
  INCAPACIDAD_ISSS: 'Art. 61 Ley ISSS',
  PERMISO: 'Art. 177 CT',
  COMISION: 'Art. 140 CT',
  BONO: 'Art. 140 CT',
  DESCUENTO_ESPECIAL: 'Art. 140 CT',
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

const WIZARD_STEPS = [
  { id: 1, label: 'Empleado', icon: Briefcase },
  { id: 2, label: 'Tipo', icon: Zap },
  { id: 3, label: 'Detalles', icon: FileText },
  { id: 4, label: 'Revisar', icon: Eye },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function AvatarInitials({ nombre, apellido, size = 'md' }: { nombre: string; apellido: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (nombre[0] || '') + (apellido[0] || '');
  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shrink-0 shadow-sm`}>
      {initials.toUpperCase()}
    </div>
  );
}

function KpiCard({
  title, count, total, icon: Icon, iconBg, iconColor, accentColor, barColor,
}: {
  title: string; count: number; total: number;
  icon: React.ElementType; iconBg: string; iconColor: string;
  accentColor: string; barColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Card className={`shadow-sm hover:shadow-md transition-all duration-200 dark:bg-slate-900 dark:border-slate-800 border-l-4 ${accentColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{count}</p>
          </div>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
      {label}
      <button onClick={onClear} className="hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full p-0.5 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IncidenceManager({ accessToken, userRole }: IncidenceManagerProps) {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 0 });

  // Filters
  const [quickTab, setQuickTab] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Dialog & Wizard
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [searchEmpleado, setSearchEmpleado] = useState('');

  // Expandable detail
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Overtime calculator
  const [horasCalc, setHorasCalc] = useState({ rate: '', hours: '' });

  const { toast } = useToast();

  const [form, setForm] = useState({
    empleado_id: '',
    tipo: 'HORAS_EXTRA',
    fecha_inicio: '',
    fecha_fin: '',
    descripcion: '',
    cantidad_horas: '',
    tipo_horas_extra: 'DIURNA',
    monto: '',
    numero_incapacidad: '',
  });

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchIncidencias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));
      if (tipoFilter && tipoFilter !== 'all') params.set('tipo', tipoFilter);
      if (estadoFilter && estadoFilter !== 'all') params.set('estado', estadoFilter);
      if (employeeFilter && employeeFilter !== 'all') params.set('empleado_id', employeeFilter);
      if (dateFrom) params.set('fechaDesde', dateFrom);
      if (dateTo) params.set('fechaHasta', dateTo);

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
  }, [accessToken, pagination.page, pagination.pageSize, tipoFilter, estadoFilter, employeeFilter, dateFrom, dateTo]);

  useEffect(() => { fetchIncidencias(); }, [fetchIncidencias]);

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

  // ─── Computed Values ───────────────────────────────────────────────────────

  const summary = useMemo(() => ({
    total: pagination.total,
    pendientes: incidencias.filter(i => i.estado === 'PENDIENTE').length,
    aprobadas: incidencias.filter(i => i.estado === 'APROBADA').length,
    rechazadas: incidencias.filter(i => i.estado === 'RECHAZADA').length,
  }), [pagination.total, incidencias]);

  const activeFilterCount = [
    tipoFilter !== 'all',
    estadoFilter !== 'all',
    employeeFilter !== 'all',
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const filteredEmpleados = searchEmpleado
    ? empleados.filter(e => `${e.primer_nombre} ${e.primer_apellido} ${e.codigo_empleado}`.toLowerCase().includes(searchEmpleado.toLowerCase()))
    : empleados;

  const selectedEmpleadoName = form.empleado_id
    ? (() => {
        const emp = empleados.find(e => e.id === form.empleado_id);
        return emp ? `${emp.primer_nombre} ${emp.primer_apellido}` : '';
      })()
    : '';

  const selectedEmpleadoCode = form.empleado_id
    ? (() => {
        const emp = empleados.find(e => e.id === form.empleado_id);
        return emp?.codigo_empleado || '';
      })()
    : '';

  const canCreate = userRole === 'ADMIN' || userRole === 'ANALISTA';
  const canApprove = userRole === 'ADMIN' || userRole === 'APROBADOR';

  // Overtime calculation
  const overtimeCalcResult = useMemo(() => {
    if (!horasCalc.rate || !horasCalc.hours) return null;
    const rate = parseFloat(horasCalc.rate);
    const hours = parseFloat(horasCalc.hours);
    if (isNaN(rate) || isNaN(hours) || rate <= 0 || hours <= 0) return null;
    const hourlyRate = rate / 30 / 8; // monthly salary / 30 days / 8 hours
    const multiplier = form.tipo_horas_extra === 'DIURNA' ? 2 : form.tipo_horas_extra === 'NOCTURNA' ? 2.5 : 3;
    const total = hourlyRate * hours * multiplier;
    return { hourlyRate, multiplier, total };
  }, [horasCalc, form.tipo_horas_extra]);

  // ─── Legal Compliance Data ────────────────────────────────────────────────

  const overtimeHoursUsed = useMemo(() => {
    const extraIncs = incidencias.filter(i => i.tipo === 'HORAS_EXTRA' && i.estado !== 'RECHAZADA');
    return extraIncs.reduce((sum, i) => sum + (i.cantidad_horas || 0), 0);
  }, [incidencias]);

  const overtimeWarning = overtimeHoursUsed > 100; // approaching 147h/year limit

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleQuickTabChange = (tab: string) => {
    setQuickTab(tab);
    if (tab === 'all') setEstadoFilter('all');
    else if (tab === 'PENDIENTE') setEstadoFilter('PENDIENTE');
    else if (tab === 'APROBADA') setEstadoFilter('APROBADA');
    else if (tab === 'RECHAZADA') setEstadoFilter('RECHAZADA');
    setPagination(p => ({ ...p, page: 1 }));
  };

  const clearAllFilters = () => {
    setTipoFilter('all');
    setEstadoFilter('all');
    setEmployeeFilter('all');
    setDateFrom('');
    setDateTo('');
    setQuickTab('all');
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleCreate = async () => {
    if (!form.empleado_id) { toast({ title: 'Error', description: 'Seleccione un empleado', variant: 'destructive' }); return; }
    if (!form.tipo) { toast({ title: 'Error', description: 'Seleccione el tipo de incidencia', variant: 'destructive' }); return; }
    if (!form.fecha_inicio) { toast({ title: 'Error', description: 'Fecha inicio es requerida', variant: 'destructive' }); return; }

    if (form.tipo === 'HORAS_EXTRA' && (!form.cantidad_horas || parseFloat(form.cantidad_horas) <= 0)) {
      toast({ title: 'Error', description: 'Cantidad de horas es requerida para HORAS_EXTRA', variant: 'destructive' });
      return;
    }
    if (form.tipo === 'HORAS_EXTRA' && parseFloat(form.cantidad_horas) > 4) {
      toast({ title: 'Advertencia Legal', description: 'Art. 169 CT: Máximo 4 horas de horas extra por día', variant: 'destructive' });
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
        toast({ title: 'Incidencia creada', description: 'La incidencia ha sido registrada exitosamente' });
        setDialogOpen(false);
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
        toast({
          title: `Incidencia ${estado.toLowerCase()}`,
          description: `La incidencia ha sido ${estado === 'APROBADA' ? 'aprobada' : 'rechazada'}`,
        });
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
    setWizardStep(1);
    setSearchEmpleado('');
    setHorasCalc({ rate: '', hours: '' });
  };

  const openDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  // ─── Formatters ────────────────────────────────────────────────────────────

  const formatDate = (d: string) => {
    if (!d) return '—';
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (d: string | undefined) => {
    if (!d) return '—';
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  };

  const formatMonto = (v: number | null) => v ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const getNombreEmp = (inc: Incidencia) =>
    `${inc.empleado.primer_nombre} ${inc.empleado.primer_apellido}`;

  const canAdvanceWizard = () => {
    if (wizardStep === 1) return !!form.empleado_id;
    if (wizardStep === 2) return !!form.tipo;
    if (wizardStep === 3) {
      if (!form.fecha_inicio) return false;
      if (form.tipo === 'HORAS_EXTRA' && (!form.cantidad_horas || parseFloat(form.cantidad_horas) <= 0)) return false;
      if (['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && (!form.monto || parseFloat(form.monto) <= 0)) return false;
      if (form.tipo === 'INCAPACIDAD_ISSS' && !form.numero_incapacidad) return false;
    }
    return true;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Incidencias de Nómina
          <Badge variant="outline" className="ml-1 text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
            {summary.total}
          </Badge>
        </h2>
        {canCreate && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 shadow-sm" onClick={openDialog}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Incidencia
          </Button>
        )}
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total Incidencias"
          count={summary.total}
          total={Math.max(summary.total, 1)}
          icon={AlertCircle}
          iconBg="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-600 dark:text-slate-400"
          accentColor="border-l-slate-400"
          barColor="bg-slate-400"
        />
        <KpiCard
          title="Pendientes"
          count={summary.pendientes}
          total={Math.max(summary.total, 1)}
          icon={Clock}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          accentColor="border-l-amber-500"
          barColor="bg-amber-500"
        />
        <KpiCard
          title="Aprobadas"
          count={summary.aprobadas}
          total={Math.max(summary.total, 1)}
          icon={CheckCircle2}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          accentColor="border-l-emerald-500"
          barColor="bg-emerald-500"
        />
        <KpiCard
          title="Rechazadas"
          count={summary.rechazadas}
          total={Math.max(summary.total, 1)}
          icon={XCircle}
          iconBg="bg-red-50 dark:bg-red-900/30"
          iconColor="text-red-600 dark:text-red-400"
          accentColor="border-l-red-500"
          barColor="bg-red-500"
        />
      </div>

      {/* ── Quick Filter Tabs ─────────────────────────────────────────────── */}
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Tabs value={quickTab} onValueChange={handleQuickTabChange}>
              <TabsList className="bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">
                  Todas
                </TabsTrigger>
                <TabsTrigger value="PENDIENTE" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400">
                  <Clock className="h-3.5 w-3.5 mr-1" /> Pendientes
                </TabsTrigger>
                <TabsTrigger value="APROBADA" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprobadas
                </TabsTrigger>
                <TabsTrigger value="RECHAZADA" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Rechazadas
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-slate-600 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700"
            >
              <Filter className="h-4 w-4 mr-1" /> Filtros
              {activeFilterCount > 0 && (
                <Badge className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center bg-emerald-500 text-white text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Select value={tipoFilter} onValueChange={v => { setTipoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
                  <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={employeeFilter} onValueChange={v => { setEmployeeFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
                  <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los empleados</SelectItem>
                    {empleados.slice(0, 50).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.primer_nombre} {e.primer_apellido}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Input
                    type="date"
                    placeholder="Desde"
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                    className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Hasta"
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                    className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-9 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                >
                  <X className="h-4 w-4 mr-1" /> Limpiar
                </Button>
              </div>
            </div>
          )}

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {tipoFilter !== 'all' && (
                <FilterChip label={`Tipo: ${TIPO_LABELS[tipoFilter] || tipoFilter}`} onClear={() => { setTipoFilter('all'); setPagination(p => ({ ...p, page: 1 })); }} />
              )}
              {estadoFilter !== 'all' && (
                <FilterChip label={`Estado: ${estadoFilter}`} onClear={() => { setEstadoFilter('all'); setQuickTab('all'); setPagination(p => ({ ...p, page: 1 })); }} />
              )}
              {employeeFilter !== 'all' && (
                <FilterChip
                  label={`Empleado: ${empleados.find(e => e.id === employeeFilter)?.primer_nombre || employeeFilter}`}
                  onClear={() => { setEmployeeFilter('all'); setPagination(p => ({ ...p, page: 1 })); }}
                />
              )}
              {dateFrom && (
                <FilterChip label={`Desde: ${formatDate(dateFrom)}`} onClear={() => { setDateFrom(''); setPagination(p => ({ ...p, page: 1 })); }} />
              )}
              {dateTo && (
                <FilterChip label={`Hasta: ${formatDate(dateTo)}`} onClear={() => { setDateTo(''); setPagination(p => ({ ...p, page: 1 })); }} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Legal Compliance Widget ───────────────────────────────────────── */}
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800 border-l-4 border-l-emerald-500">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
              <Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Cumplimiento Legal
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Referencias CT
                </Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {/* Overtime */}
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Horas Extra — Art. 169 CT</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1">Máx. 4h/día, 147h/año</p>
                  <div className="flex items-center gap-2">
                    <Progress value={Math.min((overtimeHoursUsed / 147) * 100, 100)} className="h-2 flex-1" />
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{overtimeHoursUsed.toFixed(1)}h</span>
                  </div>
                  {overtimeWarning && (
                    <div className="flex items-center gap-1 mt-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-[10px] font-medium">Acercándose al límite anual</span>
                    </div>
                  )}
                </div>
                {/* Vacation */}
                <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CalendarDays className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Vacaciones — Art. 177 CT</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">Mín. 15 días después de 1 año</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Se acumulan 1.25 días/mes</p>
                </div>
                {/* Sick Leave */}
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <HeartPulse className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Incapacidad — Art. 61 ISSS</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">Pagada por ISSS desde el 4° día</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Primeros 3 días a cargo del empleador</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Incidence Cards Grid ──────────────────────────────────────────── */}
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
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-3 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <X className="h-4 w-4 mr-1" /> Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidencias.map(inc => {
            const tipoStyle = TIPO_COLORS[inc.tipo] || TIPO_COLORS.AUSENCIA;
            const TipoIcon = TIPO_ICONS[inc.tipo] || AlertCircle;
            const legalRef = TIPO_LEGAL_REF[inc.tipo] || '';
            const isExpanded = expandedId === inc.id;
            return (
              <Card
                key={inc.id}
                className={`shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 dark:bg-slate-900 dark:hover:border-slate-700 border-l-4 ${tipoStyle.border} ${tipoStyle.bg}`}
              >
                <CardContent className="p-4">
                  {/* Type badge + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${tipoStyle.bg} border ${tipoStyle.border}`}>
                        <TipoIcon className={`h-4 w-4 ${tipoStyle.icon}`} />
                      </div>
                      <div>
                        <Badge className={`${tipoStyle.bg} ${tipoStyle.icon} border ${tipoStyle.border} text-[11px] px-2 py-0.5`}>
                          {TIPO_LABELS[inc.tipo] || inc.tipo}
                        </Badge>
                        {legalRef && (
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                            <BookOpen className="h-2.5 w-2.5" /> {legalRef}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${ESTADO_DOT[inc.estado] || 'bg-slate-400'}`} />
                      <Badge className={`${ESTADO_COLORS[inc.estado] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'} text-[11px] px-2 py-0.5`}>
                        {inc.estado}
                      </Badge>
                    </div>
                  </div>

                  {/* Employee info */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <AvatarInitials nombre={inc.empleado.primer_nombre} apellido={inc.empleado.primer_apellido} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate dark:text-slate-100">{getNombreEmp(inc)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{inc.empleado.codigo_empleado}</p>
                    </div>
                  </div>

                  {/* Date range DD/MM/YYYY */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatDate(inc.fecha_inicio)}</span>
                    {inc.fecha_fin && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span>{formatDate(inc.fecha_fin)}</span>
                      </>
                    )}
                  </div>

                  {/* Amount / Hours */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-2 border border-slate-100 dark:border-slate-700">
                    {inc.cantidad_horas ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Horas Extra</span>
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{inc.cantidad_horas}h</span>
                      </div>
                    ) : inc.monto ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Monto</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatMonto(inc.monto)}</span>
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

                  {/* Description with truncation/expand */}
                  {inc.descripcion && (
                    <div className="mb-2">
                      <p className={`text-xs text-slate-500 dark:text-slate-400 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                        {inc.descripcion}
                      </p>
                      {inc.descripcion.length > 80 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline mt-0.5 flex items-center gap-0.5"
                        >
                          {isExpanded ? 'Ver menos' : 'Ver más'}
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expand detail toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                    className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 py-1.5 border-t border-slate-100 dark:border-slate-800 transition-colors mt-1"
                  >
                    <Eye className="h-3 w-3" />
                    {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>

                  {/* Expanded Detail Section */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      {/* Approval Timeline */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Línea de Tiempo</p>
                        <div className="space-y-2">
                          {/* Created */}
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                              <FileText className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Creada</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatDateTime(inc.fecha_creacion)}</p>
                            </div>
                          </div>
                          {/* Reviewed/In Process */}
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              inc.estado === 'PENDIENTE' ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-100 dark:bg-slate-800'
                            }`}>
                              <UserCheck className={`h-3 w-3 ${inc.estado === 'PENDIENTE' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-medium ${inc.estado === 'PENDIENTE' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                En Revisión
                              </p>
                              {inc.estado === 'PENDIENTE' && (
                                <p className="text-[10px] text-amber-500 dark:text-amber-400/70">Esperando aprobación</p>
                              )}
                            </div>
                          </div>
                          {/* Approved / Rejected */}
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              inc.estado === 'APROBADA' ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                              inc.estado === 'RECHAZADA' ? 'bg-red-100 dark:bg-red-900/40' :
                              'bg-slate-100 dark:bg-slate-800'
                            }`}>
                              {inc.estado === 'RECHAZADA' ? (
                                <ThumbsDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                              ) : (
                                <ThumbsUp className={`h-3 w-3 ${
                                  inc.estado === 'APROBADA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                                }`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-medium ${
                                inc.estado === 'APROBADA' ? 'text-emerald-600 dark:text-emerald-400' :
                                inc.estado === 'RECHAZADA' ? 'text-red-600 dark:text-red-400' :
                                'text-slate-400 dark:text-slate-500'
                              }`}>
                                {inc.estado === 'APROBADA' ? 'Aprobada' : inc.estado === 'RECHAZADA' ? 'Rechazada' : 'Pendiente'}
                              </p>
                              {inc.aprobada_por && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                  Por: {inc.aprobada_por.nombre} {inc.aprobada_por.apellido}
                                </p>
                              )}
                              {inc.fecha_actualizacion && inc.estado !== 'PENDIENTE' && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                  {formatDateTime(inc.fecha_actualizacion)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Legal Reference */}
                      {legalRef && (
                        <div className="flex items-start gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                          <Info className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Referencia Legal</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {legalRef === 'Art. 169 CT' && 'Máximo 4 horas/día y 147 horas/año de trabajo extraordinario.'}
                              {legalRef === 'Art. 52 CT' && 'El empleador puede descontar salarios por ausencias injustificadas.'}
                              {legalRef === 'Art. 61 Ley ISSS' && 'Incapacidad pagada por ISSS desde el 4to día. Primeros 3 días a cargo del empleador.'}
                              {legalRef === 'Art. 177 CT' && 'Todo trabajador tiene derecho a permisos con goce de sueldo conforme la ley.'}
                              {legalRef === 'Art. 140 CT' && 'Las comisiones, bonos y descuentos forman parte del salario conforme el Código de Trabajo.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action buttons for APROBADOR */}
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
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
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
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── New Incidence Dialog (Wizard) ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Nueva Incidencia
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Registrar una incidencia de nómina — Paso {wizardStep} de 4
            </DialogDescription>
          </DialogHeader>

          {/* Wizard Progress Bar */}
          <div className="flex items-center gap-1 mb-2">
            {WIZARD_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = wizardStep === step.id;
              const isComplete = wizardStep > step.id;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => { if (isComplete) setWizardStep(step.id); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shadow-sm'
                        : isComplete
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                        : 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }`}
                  >
                    <StepIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{step.label}</span>
                    {isComplete && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 rounded-full transition-colors ${wizardStep > step.id ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Step 1: Select Employee */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Paso 1: Seleccionar Empleado</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Busque y seleccione el empleado para la incidencia</p>
              </div>
              <div>
                <Label className="dark:text-slate-300 mb-2 block">Buscar empleado *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    placeholder="Buscar por nombre o código..."
                    value={searchEmpleado}
                    onChange={e => setSearchEmpleado(e.target.value)}
                    className="h-10 pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 focus:border-emerald-400 focus:ring-emerald-400"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredEmpleados.slice(0, 20).map(e => {
                  const isSelected = form.empleado_id === e.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, empleado_id: e.id }))}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <AvatarInitials nombre={e.primer_nombre} apellido={e.primer_apellido} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'dark:text-slate-100'}`}>
                          {e.primer_nombre} {e.primer_apellido}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{e.codigo_empleado}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
                {filteredEmpleados.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No se encontraron empleados</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Select Type */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Paso 2: Tipo de Incidencia</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Seleccione el tipo de incidencia a registrar</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(TIPO_LABELS).map(([key, label]) => {
                  const tipoStyle = TIPO_COLORS[key];
                  const TipoIcon = TIPO_ICONS[key] || AlertCircle;
                  const legal = TIPO_LEGAL_REF[key];
                  const isSelected = form.tipo === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, tipo: key }))}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-xs transition-all ${
                        isSelected
                          ? `${tipoStyle.bg} ${tipoStyle.border} ${tipoStyle.icon} ring-2 ring-emerald-400/50 shadow-md dark:ring-offset-slate-900 ring-offset-1`
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? tipoStyle.bg : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <TipoIcon className={`h-6 w-6 ${isSelected ? tipoStyle.icon : 'text-slate-500 dark:text-slate-400'}`} />
                      </div>
                      <span className="font-medium leading-tight text-center">{label}</span>
                      {legal && (
                        <span className={`text-[9px] ${isSelected ? tipoStyle.icon : 'text-slate-400 dark:text-slate-500'}`}>
                          {legal}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Enter Details */}
          {wizardStep === 3 && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Paso 3: Detalles de Incidencia</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Ingrese la información específica según el tipo seleccionado</p>
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
                <div className="space-y-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Horas Extra — Art. 169 CT</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-amber-700 dark:text-amber-300">Cantidad de Horas *</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={form.cantidad_horas}
                        onChange={e => { setForm(p => ({ ...p, cantidad_horas: e.target.value })); setHorasCalc(h => ({ ...h, hours: e.target.value })); }}
                        className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                      />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Máx. 4h/día, 147h/año
                      </p>
                      {form.cantidad_horas && parseFloat(form.cantidad_horas) > 4 && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Excede el máximo de 4h/día
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-amber-700 dark:text-amber-300">Tipo de Horas Extra</Label>
                      <Select value={form.tipo_horas_extra} onValueChange={v => setForm(p => ({ ...p, tipo_horas_extra: v }))}>
                        <SelectTrigger className="h-9 mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DIURNA">Diurna (2x)</SelectItem>
                          <SelectItem value="NOCTURNA">Nocturna (2.5x)</SelectItem>
                          <SelectItem value="DESCANSO">Día de Descanso (3x)</SelectItem>
                          <SelectItem value="ASUETO">Asueto (3x)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Overtime Calculator */}
                  <div className="p-3 rounded-md bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/40">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Calculadora de Horas Extra
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <Label className="text-[10px] text-slate-500 dark:text-slate-400">Salario Mensual</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="$0.00"
                          value={horasCalc.rate}
                          onChange={e => setHorasCalc(h => ({ ...h, rate: e.target.value }))}
                          className="h-8 text-xs mt-0.5 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500 dark:text-slate-400">Horas</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={horasCalc.hours || form.cantidad_horas}
                          onChange={e => { setHorasCalc(h => ({ ...h, hours: e.target.value })); if (!form.cantidad_horas) setForm(p => ({ ...p, cantidad_horas: e.target.value })); }}
                          className="h-8 text-xs mt-0.5 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                        />
                      </div>
                    </div>
                    {overtimeCalcResult && (
                      <div className="text-[10px] text-slate-600 dark:text-slate-300 space-y-0.5">
                        <p>Tarifa por hora: <span className="font-mono">${overtimeCalcResult.hourlyRate.toFixed(2)}</span></p>
                        <p>Multiplicador: <span className="font-mono">{overtimeCalcResult.multiplier}x</span></p>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Total estimado: <span className="font-mono">${overtimeCalcResult.total.toFixed(2)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Conditional: INCAPACIDAD_ISSS */}
              {form.tipo === 'INCAPACIDAD_ISSS' && (
                <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span className="text-sm font-medium text-rose-700 dark:text-rose-300">Incapacidad — Art. 61 Ley ISSS</span>
                  </div>
                  <Label className="text-rose-700 dark:text-rose-300">Número de Incapacidad *</Label>
                  <Input value={form.numero_incapacidad} onChange={e => setForm(p => ({ ...p, numero_incapacidad: e.target.value }))} className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Primeros 3 días a cargo del empleador, desde el 4° día ISSS
                  </p>
                </div>
              )}

              {/* Conditional: PERMISO */}
              {form.tipo === 'PERMISO' && (
                <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                  <div className="flex items-center gap-2 mb-2">
                    <DoorOpen className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-sm font-medium text-teal-700 dark:text-teal-300">Permiso — Art. 177 CT</span>
                  </div>
                  <p className="text-[10px] text-teal-600 dark:text-teal-400">
                    Los permisos con goce de sueldo están sujetos a las disposiciones del empleador y la ley.
                  </p>
                </div>
              )}

              {/* Conditional: COMISION/BONO/DESCUENTO_ESPECIAL */}
              {['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && (
                <div className={`p-4 rounded-lg border space-y-2 ${
                  form.tipo === 'BONO'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : form.tipo === 'COMISION'
                    ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {form.tipo === 'BONO' && <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    {form.tipo === 'COMISION' && <Percent className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                    {form.tipo === 'DESCUENTO_ESPECIAL' && <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />}
                    <span className={`text-sm font-medium ${
                      form.tipo === 'BONO' ? 'text-emerald-700 dark:text-emerald-300' :
                      form.tipo === 'COMISION' ? 'text-violet-700 dark:text-violet-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {TIPO_LABELS[form.tipo]} — Art. 140 CT
                    </span>
                  </div>
                  <Label className={`${
                    form.tipo === 'BONO' ? 'text-emerald-700 dark:text-emerald-300' :
                    form.tipo === 'COMISION' ? 'text-violet-700 dark:text-violet-300' :
                    'text-red-700 dark:text-red-300'
                  }`}>Monto (USD) *</Label>
                  <Input type="number" step="0.01" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                </div>
              )}

              {/* Description */}
              <div>
                <Label className="dark:text-slate-300">Descripción</Label>
                <Textarea
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="mt-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 min-h-20"
                  placeholder="Describa el motivo o detalle de la incidencia..."
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {wizardStep === 4 && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Paso 4: Revisión</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Verifique la información antes de enviar</p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
                {/* Employee */}
                <div className="flex items-center gap-3">
                  <AvatarInitials
                    nombre={selectedEmpleadoName ? selectedEmpleadoName.split(' ')[0] : '?'}
                    apellido={selectedEmpleadoName ? selectedEmpleadoName.split(' ').slice(1).join(' ') || selectedEmpleadoName[0] : '?'}
                    size="lg"
                  />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedEmpleadoName || 'Sin empleado'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{selectedEmpleadoCode}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Type */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tipo</p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const TipoIcon = TIPO_ICONS[form.tipo] || AlertCircle;
                        const tipoStyle = TIPO_COLORS[form.tipo];
                        return (
                          <>
                            <TipoIcon className={`h-4 w-4 ${tipoStyle.icon}`} />
                            <span className="text-sm font-medium dark:text-slate-200">{TIPO_LABELS[form.tipo]}</span>
                          </>
                        );
                      })()}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                      <BookOpen className="h-2.5 w-2.5" /> {TIPO_LEGAL_REF[form.tipo]}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Estado</p>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                      PENDIENTE
                    </Badge>
                  </div>

                  {/* Dates */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fecha Inicio</p>
                    <p className="text-sm font-medium dark:text-slate-200 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {form.fecha_inicio ? formatDate(form.fecha_inicio) : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fecha Fin</p>
                    <p className="text-sm font-medium dark:text-slate-200 flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                      {form.fecha_fin ? formatDate(form.fecha_fin) : '—'}
                    </p>
                  </div>
                </div>

                {/* Conditional details */}
                {form.tipo === 'HORAS_EXTRA' && form.cantidad_horas && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Horas Extra</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{form.cantidad_horas}h</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">{form.tipo_horas_extra}</span>
                    </div>
                    {overtimeCalcResult && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                        Monto estimado: <span className="font-mono">${overtimeCalcResult.total.toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                )}
                {['COMISION', 'BONO', 'DESCUENTO_ESPECIAL'].includes(form.tipo) && form.monto && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Monto</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ${parseFloat(form.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {form.tipo === 'INCAPACIDAD_ISSS' && form.numero_incapacidad && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Incapacidad</p>
                    <p className="text-sm font-medium dark:text-slate-200">#{form.numero_incapacidad}</p>
                  </div>
                )}

                {form.descripcion && (
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Descripción</p>
                    <p className="text-sm dark:text-slate-300">{form.descripcion}</p>
                  </div>
                )}
              </div>

              {/* Legal Validation Messages */}
              {form.tipo === 'HORAS_EXTRA' && form.cantidad_horas && parseFloat(form.cantidad_horas) > 4 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-red-700 dark:text-red-300">Excede límite diario</p>
                    <p className="text-[10px] text-red-600 dark:text-red-400">Art. 169 CT: Máximo 4 horas extra por día</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Wizard Navigation ──────────────────────────────────────────── */}
          <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              {wizardStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setWizardStep(s => s - 1)}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                Cancelar
              </Button>
              {wizardStep < 4 ? (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                  disabled={!canAdvanceWizard()}
                  onClick={() => setWizardStep(s => s + 1)}
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                  onClick={handleCreate}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Confirmar Incidencia
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User, Calendar, FileText, Download, Plus, Clock, CheckCircle,
  Loader2, Briefcase, MapPin, DollarSign, Plane, FileBadge, Receipt,
  ChevronRight, AlertCircle, Sun, Moon, XCircle, Filter, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface SelfServicePortalProps {
  accessToken: string;
  userRole: string;
}

interface SelfServiceData {
  empleado: {
    id: string; codigo_empleado: string; primer_nombre: string; segundo_nombre: string | null;
    primer_apellido: string; segundo_apellido: string | null; dui: string;
    email_personal: string | null; telefono: string | null; fecha_ingreso: string;
    salario_base: number; genero: string | null; estado: string;
  };
  area: { id: string; nombre: string; codigo: string } | null;
  perfil_puesto: { id: string; nombre_puesto: string; banda_salarial: { nombre: string; grado: number } | null } | null;
  vacaciones: { id: string; anio: number; dias_derecho: number; dias_tomados: number; dias_pendientes: number; estado: string }[];
  recibos: { id: string; periodo_inicio: string; periodo_fin: string; tipo: string; salario_bruto: number; total_descuentos: number; salario_neto: number; isss_laboral: number; afp_laboral: number; isr_retenido: number }[];
  documentos: { id: string; tipo_documento: string; nombre_archivo: string; descripcion: string | null; fecha_creacion: string }[];
  solicitudes: { id: string; tipo: string; estado: string; detalle: string | null; fecha_solicitud: string; fecha_resolucion: string | null }[];
}

const solicitudTipos = [
  { value: 'VACACION', label: 'Vacaciones', icon: Plane, color: 'text-sky-600', bg: 'bg-sky-50' },
  { value: 'CONSTANCIA_EMPLEO', label: 'Constancia Empleo', icon: FileBadge, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'CONSTANCIA_SALARIAL', label: 'Constancia Salarial', icon: Receipt, color: 'text-violet-600', bg: 'bg-violet-50' },
  { value: 'CONSTANCIA_ISR', label: 'Constancia ISR', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
];

const incidenciaTipos = [
  { value: 'HORAS_EXTRA', label: 'Horas Extra', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'BONO', label: 'Bono', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'COMISION', label: 'Comisión', icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50' },
  { value: 'INCAPACIDAD_ISSS', label: 'Incapacidad ISSS', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  { value: 'PERMISO', label: 'Permiso', icon: Calendar, color: 'text-sky-600', bg: 'bg-sky-50' },
  { value: 'OTRO', label: 'Otro', icon: AlertCircle, color: 'text-slate-600', bg: 'bg-slate-50' },
];

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

function calcDaysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

export default function SelfServicePortal({ accessToken }: SelfServicePortalProps) {
  const { toast } = useToast();
  const [data, setData] = useState<SelfServiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showVacationDialog, setShowVacationDialog] = useState(false);
  const [showIncidenceDialog, setShowIncidenceDialog] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState('');
  const [requestDetail, setRequestDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Vacation dialog state
  const [vacStartDate, setVacStartDate] = useState('');
  const [vacEndDate, setVacEndDate] = useState('');
  const [vacMotivo, setVacMotivo] = useState('');
  const [vacSubmitting, setVacSubmitting] = useState(false);

  // Incidence dialog state
  const [incTipo, setIncTipo] = useState('');
  const [incFechaInicio, setIncFechaInicio] = useState('');
  const [incFechaFin, setIncFechaFin] = useState('');
  const [incHoras, setIncHoras] = useState('');
  const [incMonto, setIncMonto] = useState('');
  const [incDescripcion, setIncDescripcion] = useState('');
  const [incSubmitting, setIncSubmitting] = useState(false);

  // Request history filter
  const [solicitudesFilter, setSolicitudesFilter] = useState<'TODAS' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('TODAS');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/selfservice', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Vacation calculations
  const vacDaysRequested = useMemo(() => calcDaysBetween(vacStartDate, vacEndDate), [vacStartDate, vacEndDate]);

  const currentYearVacation = useMemo(() => {
    if (!data) return null;
    const currentYear = new Date().getFullYear();
    return data.vacaciones.find(v => v.anio === currentYear) || data.vacaciones[0] || null;
  }, [data]);

  const availableVacationDays = currentYearVacation?.dias_pendientes ?? 0;

  // Filtered solicitudes
  const filteredSolicitudes = useMemo(() => {
    if (!data) return [];
    if (solicitudesFilter === 'TODAS') return data.solicitudes;
    return data.solicitudes.filter(s => s.estado === solicitudesFilter);
  }, [data, solicitudesFilter]);

  const handleSubmitRequest = async () => {
    if (!requestType) {
      toast({ title: 'Error', description: 'Seleccione un tipo de solicitud', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/selfservice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: requestType, detalle: requestDetail }),
      });
      if (res.ok) {
        toast({ title: 'Solicitud enviada', description: 'Su solicitud ha sido registrada exitosamente' });
        setShowRequestDialog(false);
        setRequestType('');
        setRequestDetail('');
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVacation = async () => {
    // Validation
    if (!vacStartDate || !vacEndDate) {
      toast({ title: 'Error', description: 'Seleccione las fechas de inicio y fin', variant: 'destructive' });
      return;
    }

    const start = new Date(vacStartDate);
    const end = new Date(vacEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      toast({ title: 'Error', description: 'No puede solicitar vacaciones para fechas pasadas', variant: 'destructive' });
      return;
    }

    if (end < start) {
      toast({ title: 'Error', description: 'La fecha fin no puede ser anterior a la fecha inicio', variant: 'destructive' });
      return;
    }

    if (vacDaysRequested > availableVacationDays) {
      toast({ title: 'Error', description: `Solo tiene ${availableVacationDays} días disponibles. Solicitó ${vacDaysRequested}.`, variant: 'destructive' });
      return;
    }

    if (vacDaysRequested === 0) {
      toast({ title: 'Error', description: 'El rango de fechas no es válido', variant: 'destructive' });
      return;
    }

    setVacSubmitting(true);
    try {
      const detalle = JSON.stringify({
        fecha_inicio: vacStartDate,
        fecha_fin: vacEndDate,
        dias: vacDaysRequested,
        motivo: vacMotivo || 'Solicitud de vacaciones',
      });

      const res = await fetch('/api/selfservice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'VACACION', detalle }),
      });

      if (res.ok) {
        toast({
          title: 'Solicitud de vacaciones enviada',
          description: `Se solicitaron ${vacDaysRequested} días de vacaciones`,
        });
        setShowVacationDialog(false);
        setVacStartDate('');
        setVacEndDate('');
        setVacMotivo('');
        fetchData();
      } else {
        const errData = await res.json();
        toast({ title: 'Error', description: errData.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setVacSubmitting(false);
    }
  };

  const handleSubmitIncidence = async () => {
    if (!incTipo) {
      toast({ title: 'Error', description: 'Seleccione el tipo de incidencia', variant: 'destructive' });
      return;
    }

    if (!incFechaInicio) {
      toast({ title: 'Error', description: 'Seleccione la fecha de inicio', variant: 'destructive' });
      return;
    }

    // Type-specific validations
    if (incTipo === 'HORAS_EXTRA') {
      if (!incHoras || parseFloat(incHoras) <= 0) {
        toast({ title: 'Error', description: 'Ingrese la cantidad de horas', variant: 'destructive' });
        return;
      }
    }

    if (incTipo === 'BONO' || incTipo === 'COMISION') {
      if (!incMonto || parseFloat(incMonto) <= 0) {
        toast({ title: 'Error', description: 'Ingrese el monto', variant: 'destructive' });
        return;
      }
    }

    if (incTipo === 'INCAPACIDAD_ISSS') {
      if (!incFechaFin) {
        toast({ title: 'Error', description: 'Seleccione la fecha fin de la incapacidad', variant: 'destructive' });
        return;
      }
      if (new Date(incFechaFin) < new Date(incFechaInicio)) {
        toast({ title: 'Error', description: 'La fecha fin no puede ser anterior a la fecha inicio', variant: 'destructive' });
        return;
      }
    }

    if (incTipo === 'PERMISO' && !incDescripcion) {
      toast({ title: 'Error', description: 'Ingrese el motivo del permiso', variant: 'destructive' });
      return;
    }

    setIncSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        tipo: incTipo,
        fecha_inicio: incFechaInicio,
        descripcion: incDescripcion || null,
      };

      if (incTipo === 'HORAS_EXTRA') {
        body.cantidad_horas = parseFloat(incHoras);
        body.tipo_horas_extra = 'DIURNA';
      }

      if (incTipo === 'BONO' || incTipo === 'COMISION') {
        body.monto = parseFloat(incMonto);
      }

      if (incTipo === 'INCAPACIDAD_ISSS') {
        body.fecha_fin = incFechaFin;
        body.numero_incapacidad = `INC-${Date.now()}`;
      }

      if (incTipo === 'PERMISO') {
        body.descripcion = incDescripcion;
      }

      const res = await fetch('/api/incidencias', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({
          title: 'Incidencia reportada',
          description: 'Su reporte de incidencia ha sido registrado exitosamente',
        });
        setShowIncidenceDialog(false);
        setIncTipo('');
        setIncFechaInicio('');
        setIncFechaFin('');
        setIncHoras('');
        setIncMonto('');
        setIncDescripcion('');
        fetchData();
      } else {
        const errData = await res.json();
        toast({ title: 'Error', description: errData.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setIncSubmitting(false);
    }
  };

  const handleDownloadBoleta = async (planillaId: string) => {
    try {
      setDownloadingId(planillaId);
      const res = await fetch(`/api/nomina/planillas/${planillaId}/boleta?empleado_id=${data!.empleado.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al generar boleta');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Boleta_${data!.empleado.codigo_empleado}_${planillaId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Boleta descargada', description: 'El PDF de su recibo ha sido descargado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar la boleta', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No se pudieron cargar sus datos</p>
        </CardContent>
      </Card>
    );
  }

  const emp = data.empleado;
  const totalDiasPendientes = data.vacaciones.reduce((s, v) => s + v.dias_pendientes, 0);
  const totalDiasTomados = data.vacaciones.reduce((s, v) => s + v.dias_tomados, 0);
  const totalDiasDerecho = data.vacaciones.reduce((s, v) => s + v.dias_derecho, 0);
  const vacationProgress = totalDiasDerecho > 0 ? Math.round((totalDiasTomados / totalDiasDerecho) * 100) : 0;

  const getSolicitudBadge = (estado: string) => {
    if (estado === 'PENDIENTE') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    if (estado === 'APROBADA') return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  };

  const getSolicitudIcon = (tipo: string) => {
    switch (tipo) {
      case 'VACACION': return <Plane className="h-4 w-4 text-sky-600" />;
      case 'CONSTANCIA_EMPLEO': return <FileBadge className="h-4 w-4 text-emerald-600" />;
      case 'CONSTANCIA_SALARIAL': return <Receipt className="h-4 w-4 text-violet-600" />;
      case 'CONSTANCIA_ISR': return <FileText className="h-4 w-4 text-amber-600" />;
      default: return <AlertCircle className="h-4 w-4 text-slate-500" />;
    }
  };

  const getSolicitudTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'VACACION': return 'bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800';
      case 'CONSTANCIA_EMPLEO': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800';
      case 'CONSTANCIA_SALARIAL': return 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800';
      case 'CONSTANCIA_ISR': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800';
      default: return 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header card with gradient overlay pattern */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-xl p-5 text-white shadow-lg relative overflow-hidden gradient-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 right-1/3 w-12 h-12 bg-white/[0.03] rounded-lg rotate-12 animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold ring-2 ring-white/30">
            {emp.primer_nombre[0]}{emp.primer_apellido[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">
              {emp.primer_nombre} {emp.segundo_nombre || ''} {emp.primer_apellido} {emp.segundo_apellido || ''}
            </h2>
            <p className="text-emerald-100 text-sm flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              {emp.codigo_empleado} · {data.perfil_puesto?.nombre_puesto || 'Sin puesto'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">
                {data.area?.nombre || 'Sin área'}
              </Badge>
              <Badge variant="secondary" className="bg-emerald-400/30 text-white border-0 text-[10px]">
                {emp.estado}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Vacation Balance with Enhanced UI */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Plane className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Saldo de Vacaciones
            </CardTitle>
            <Button
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-8 gap-1.5"
              onClick={() => setShowVacationDialog(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Solicitar Vacaciones
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Circular-like progress indicator */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-700" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - vacationProgress / 100)}`}
                  strokeLinecap="round"
                  className="text-emerald-500 dark:text-emerald-400 transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{vacationProgress}%</span>
                <span className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Utilizado</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">Días utilizados</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{totalDiasTomados} / {totalDiasDerecho}</span>
              </div>
              <Progress value={vacationProgress} className="h-3 progress-animate" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-500" /> Disponibles
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalDiasPendientes} días</span>
              </div>
            </div>
          </div>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-3 text-center border border-emerald-100 dark:border-emerald-800">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Pendientes</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{totalDiasPendientes}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Tomados</p>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">{totalDiasTomados}</p>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/30 rounded-lg p-3 text-center border border-teal-100 dark:border-teal-800">
              <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider">Derecho</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-0.5">{totalDiasDerecho}</p>
            </div>
          </div>
          {/* Per year breakdown with calendar-like indicator */}
          {data.vacaciones.length > 0 && (
            <div className="space-y-1.5">
              {data.vacaciones.map((v) => {
                const yearProgress = v.dias_derecho > 0 ? Math.round((v.dias_tomados / v.dias_derecho) * 100) : 0;
                const takenSegments = Math.round((v.dias_tomados / v.dias_derecho) * 10);
                return (
                  <div key={v.id} className="bg-slate-50/80 dark:bg-slate-800/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Año {v.anio}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{v.dias_pendientes} pendientes</span>
                    </div>
                    <Progress value={yearProgress} className="h-1.5 progress-animate" />
                    {/* Calendar-like day indicators */}
                    <div className="flex gap-0.5 mt-2">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-sm ${
                            i < takenSegments
                              ? 'bg-emerald-400 dark:bg-emerald-500'
                              : 'bg-slate-200 dark:bg-slate-600'
                          }`}
                          title={i < takenSegments ? 'Tomado' : 'Disponible'}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">{v.dias_tomados} tomados</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">{v.dias_derecho} total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Pay Slips */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Recibos de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recibos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
              <Receipt className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">No hay recibos disponibles</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recibos.map((recibo) => (
                <div key={recibo.id} className="flex items-center justify-between p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(recibo.periodo_inicio).toLocaleDateString('es-SV', { month: 'short', year: 'numeric' })}
                      </p>
                      <Badge variant="secondary" className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {recibo.tipo}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>Bruto: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{fmt(recibo.salario_bruto)}</span></span>
                      <span>Neto: <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{fmt(recibo.salario_neto)}</span></span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 ml-2 h-8 text-xs gap-1.5"
                    onClick={() => handleDownloadBoleta(recibo.id)}
                    disabled={downloadingId === recibo.id}
                  >
                    {downloadingId === recibo.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Buttons - now includes Incidence */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Nueva Solicitud
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5">
            {solicitudTipos.filter(t => t.value !== 'VACACION').map((tipo) => (
              <button
                key={tipo.value}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer text-left group card-hover-lift"
                onClick={() => { setRequestType(tipo.value); setShowRequestDialog(true); }}
              >
                <div className={`p-2 rounded-lg ${tipo.bg} dark:opacity-80 group-hover:scale-110 transition-transform`}>
                  <tipo.icon className={`h-4 w-4 ${tipo.color}`} />
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{tipo.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 ml-auto" />
              </button>
            ))}
            {/* Vacation request button */}
            <button
              className="flex items-center gap-2.5 p-3 rounded-lg border border-sky-200 dark:border-sky-800 hover:border-sky-300 dark:hover:border-sky-700 bg-sky-50/50 dark:bg-sky-900/20 hover:bg-sky-100/50 dark:hover:bg-sky-800/30 transition-all cursor-pointer text-left group card-hover-lift"
              onClick={() => setShowVacationDialog(true)}
            >
              <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-800/50 group-hover:scale-110 transition-transform">
                <Plane className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-xs font-medium text-sky-700 dark:text-sky-300">Vacaciones</span>
              <ChevronRight className="h-3.5 w-3.5 text-sky-400 dark:text-sky-500 ml-auto" />
            </button>
            {/* Incidence report button */}
            <button
              className="flex items-center gap-2.5 p-3 rounded-lg border border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 bg-orange-50/50 dark:bg-orange-900/20 hover:bg-orange-100/50 dark:hover:bg-orange-800/30 transition-all cursor-pointer text-left group card-hover-lift"
              onClick={() => setShowIncidenceDialog(true)}
            >
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-800/50 group-hover:scale-110 transition-transform">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Reportar Incidencia</span>
              <ChevronRight className="h-3.5 w-3.5 text-orange-400 dark:text-orange-500 ml-auto" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* My Requests - Enhanced with filter and icons */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Mis Solicitudes
              <Badge variant="secondary" className="ml-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {data.solicitudes.length}
              </Badge>
            </CardTitle>
          </div>
          {/* Filter tabs */}
          {data.solicitudes.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {(['TODAS', 'PENDIENTE', 'APROBADA', 'RECHAZADA'] as const).map((filter) => {
                const count = filter === 'TODAS'
                  ? data.solicitudes.length
                  : data.solicitudes.filter(s => s.estado === filter).length;
                return (
                  <button
                    key={filter}
                    onClick={() => setSolicitudesFilter(filter)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                      solicitudesFilter === filter
                        ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {filter === 'TODAS' ? 'Todas' : filter.charAt(0) + filter.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {data.solicitudes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
              <Clock className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">No hay solicitudes registradas</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Cree una nueva solicitud usando los botones de arriba</p>
            </div>
          ) : filteredSolicitudes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
              <Filter className="h-6 w-6 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">No hay solicitudes con este filtro</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredSolicitudes.map((sol) => (
                <div key={sol.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${getSolicitudTypeColor(sol.tipo)}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0">{getSolicitudIcon(sol.tipo)}</div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate text-xs">{sol.tipo.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{fmtDate(sol.fecha_solicitud)}</p>
                      {sol.detalle && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[180px]">{sol.detalle}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={`text-[10px] border shrink-0 ml-2 ${getSolicitudBadge(sol.estado)}`}>
                    {sol.estado}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Info Card with gradient border */}
      <Card className="shadow-sm gradient-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Información Personal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Código</p>
              <p className="font-medium text-slate-800 dark:text-slate-200 font-mono text-xs">{emp.codigo_empleado}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Área</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{data.area?.nombre || 'Sin área'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Puesto</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{data.perfil_puesto?.nombre_puesto || 'Sin puesto'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Fecha Ingreso</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{fmtDate(emp.fecha_ingreso)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">DUI</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{emp.dui}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Teléfono</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{emp.telefono || '—'}</p>
            </div>
            {data.perfil_puesto?.banda_salarial && (
              <div className="col-span-2">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Banda Salarial</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{data.perfil_puesto.banda_salarial.nombre} (Grado {data.perfil_puesto.banda_salarial.grado})</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generic Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud</DialogTitle>
            <DialogDescription>Complete la información para su solicitud</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Solicitud</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {solicitudTipos.filter(t => t.value !== 'VACACION').map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Detalle / Comentario</Label>
              <Textarea value={requestDetail} onChange={(e) => setRequestDetail(e.target.value)} placeholder="Información adicional..." rows={3} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancelar</Button>
              <Button onClick={handleSubmitRequest} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar Solicitud
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vacation Request Dialog */}
      <Dialog open={showVacationDialog} onOpenChange={setShowVacationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-sky-600" /> Solicitar Vacaciones
            </DialogTitle>
            <DialogDescription>Complete la información para su solicitud de vacaciones</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Available days indicator */}
            <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-3 border border-sky-100 dark:border-sky-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-sky-700 dark:text-sky-300 font-medium">Días disponibles</span>
                <span className="text-lg font-bold text-sky-700 dark:text-sky-300">{availableVacationDays}</span>
              </div>
              {currentYearVacation && (
                <p className="text-[10px] text-sky-500 dark:text-sky-400 mt-1">
                  Año {currentYearVacation.anio}: {currentYearVacation.dias_tomados} tomados de {currentYearVacation.dias_derecho}
                </p>
              )}
            </div>

            {/* Date pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vac-start">Fecha inicio</Label>
                <Input
                  id="vac-start"
                  type="date"
                  value={vacStartDate}
                  onChange={(e) => setVacStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vac-end">Fecha fin</Label>
                <Input
                  id="vac-end"
                  type="date"
                  value={vacEndDate}
                  onChange={(e) => setVacEndDate(e.target.value)}
                  min={vacStartDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Auto-calculated days */}
            {vacStartDate && vacEndDate && (
              <div className={`rounded-lg p-3 border ${
                vacDaysRequested > availableVacationDays
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : vacDaysRequested > 0
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${
                    vacDaysRequested > availableVacationDays
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {vacDaysRequested > availableVacationDays ? (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Excede días disponibles
                      </span>
                    ) : (
                      'Días a solicitar'
                    )}
                  </span>
                  <span className={`text-lg font-bold ${
                    vacDaysRequested > availableVacationDays
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {vacDaysRequested}
                  </span>
                </div>
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="vac-motivo">Motivo (opcional)</Label>
              <Textarea
                id="vac-motivo"
                value={vacMotivo}
                onChange={(e) => setVacMotivo(e.target.value)}
                placeholder="Razón de la solicitud de vacaciones..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowVacationDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmitVacation}
                disabled={vacSubmitting || vacDaysRequested > availableVacationDays || vacDaysRequested === 0}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {vacSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Solicitar {vacDaysRequested > 0 ? `${vacDaysRequested} Días` : 'Vacaciones'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incidence Request Dialog */}
      <Dialog open={showIncidenceDialog} onOpenChange={setShowIncidenceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" /> Reportar Incidencia
            </DialogTitle>
            <DialogDescription>Complete la información para reportar una incidencia</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Incidence type selector */}
            <div className="space-y-2">
              <Label>Tipo de Incidencia</Label>
              <Select value={incTipo} onValueChange={(val) => {
                setIncTipo(val);
                // Reset type-specific fields
                setIncHoras('');
                setIncMonto('');
                setIncFechaFin('');
                setIncDescripcion('');
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {incidenciaTipos.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* HORAS_EXTRA: hours and date */}
            {incTipo === 'HORAS_EXTRA' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-hours">Cantidad de horas</Label>
                  <Input
                    id="inc-hours"
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={incHoras}
                    onChange={(e) => setIncHoras(e.target.value)}
                    placeholder="Ej: 4"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Máximo 10 horas semanales según Art. 169 CT</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-date-he">Fecha</Label>
                  <Input
                    id="inc-date-he"
                    type="date"
                    value={incFechaInicio}
                    onChange={(e) => setIncFechaInicio(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* BONO / COMISION: amount input */}
            {(incTipo === 'BONO' || incTipo === 'COMISION') && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-amount">Monto ($)</Label>
                  <Input
                    id="inc-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={incMonto}
                    onChange={(e) => setIncMonto(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-date-bc">Fecha</Label>
                  <Input
                    id="inc-date-bc"
                    type="date"
                    value={incFechaInicio}
                    onChange={(e) => setIncFechaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-desc-bc">Descripción</Label>
                  <Textarea
                    id="inc-desc-bc"
                    value={incDescripcion}
                    onChange={(e) => setIncDescripcion(e.target.value)}
                    placeholder={`Detalle del ${incTipo === 'BONO' ? 'bono' : 'comisión'}...`}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* INCAPACIDAD_ISSS: date range */}
            {incTipo === 'INCAPACIDAD_ISSS' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="inc-start-inc">Fecha inicio</Label>
                    <Input
                      id="inc-start-inc"
                      type="date"
                      value={incFechaInicio}
                      onChange={(e) => setIncFechaInicio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inc-end-inc">Fecha fin</Label>
                    <Input
                      id="inc-end-inc"
                      type="date"
                      value={incFechaFin}
                      onChange={(e) => setIncFechaFin(e.target.value)}
                      min={incFechaInicio}
                    />
                  </div>
                </div>
                {incFechaInicio && incFechaFin && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Duración: {calcDaysBetween(incFechaInicio, incFechaFin)} día(s)
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="inc-desc-inc">Descripción</Label>
                  <Textarea
                    id="inc-desc-inc"
                    value={incDescripcion}
                    onChange={(e) => setIncDescripcion(e.target.value)}
                    placeholder="Detalle de la incapacidad..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* PERMISO: date and reason */}
            {incTipo === 'PERMISO' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-date-perm">Fecha</Label>
                  <Input
                    id="inc-date-perm"
                    type="date"
                    value={incFechaInicio}
                    onChange={(e) => setIncFechaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-reason-perm">Motivo del permiso</Label>
                  <Textarea
                    id="inc-reason-perm"
                    value={incDescripcion}
                    onChange={(e) => setIncDescripcion(e.target.value)}
                    placeholder="Describa el motivo de su permiso..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* OTRO: generic description and date */}
            {incTipo === 'OTRO' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-date-otro">Fecha</Label>
                  <Input
                    id="inc-date-otro"
                    type="date"
                    value={incFechaInicio}
                    onChange={(e) => setIncFechaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-desc-otro">Descripción</Label>
                  <Textarea
                    id="inc-desc-otro"
                    value={incDescripcion}
                    onChange={(e) => setIncDescripcion(e.target.value)}
                    placeholder="Describa la incidencia..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* No type selected yet */}
            {!incTipo && (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                <AlertCircle className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm">Seleccione un tipo de incidencia para continuar</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowIncidenceDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmitIncidence}
                disabled={incSubmitting || !incTipo}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {incSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reportar Incidencia
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

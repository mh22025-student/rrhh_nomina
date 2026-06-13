'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User, Calendar, FileText, Download, Plus, Clock, CheckCircle,
  Loader2, Briefcase, MapPin, DollarSign, Plane, FileBadge, Receipt,
  ChevronRight, AlertCircle, Sun, Moon, XCircle, Filter, AlertTriangle,
  ChevronDown, ChevronUp, Shield, Heart, Banknote, Megaphone, TrendingUp,
  Edit3, Phone, Mail, Building, CalendarDays, Ban, Info, Award, PiggyBank,
  CircleDot, Activity, GraduationCap, Link2, BarChart3, FileDown, Bug
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
  notificaciones?: { id: string; titulo: string; mensaje: string; prioridad: string; fecha: string; leida: boolean }[];
}

const solicitudTipos = [
  { value: 'VACACION', label: 'Vacaciones', icon: Plane, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  { value: 'CONSTANCIA_EMPLEO', label: 'Constancia Empleo', icon: FileBadge, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  { value: 'CONSTANCIA_SALARIAL', label: 'Constancia Salarial', icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  { value: 'CONSTANCIA_ISR', label: 'Constancia ISR', icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/30' },
  { value: 'CAMBIO_DATOS', label: 'Cambio de Datos', icon: Edit3, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
];

const incidenciaTipos = [
  { value: 'HORAS_EXTRA', label: 'Horas Extra', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  { value: 'BONO', label: 'Bono', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  { value: 'COMISION', label: 'Comisión', icon: DollarSign, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  { value: 'INCAPACIDAD_ISSS', label: 'Incapacidad ISSS', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30' },
  { value: 'PERMISO', label: 'Permiso', icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  { value: 'OTRO', label: 'Otro', icon: AlertCircle, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-800/50' },
];

// Mock announcements for demo purposes (in production these come from API)
const defaultAnnouncements = [
  { id: '1', titulo: 'Cierre de Nómina - Febrero 2026', mensaje: 'Se recuerda que el cierre de nómina del mes de febrero será el día 25. Favor verificar incidencias.', prioridad: 'ALTA', fecha: '2026-02-20' },
  { id: '2', titulo: 'Actualización de Política de Vacaciones', mensaje: 'Se ha actualizado la política de vacaciones conforme al Código de Trabajo. Revisar portal de RRHH.', prioridad: 'MEDIA', fecha: '2026-02-15' },
  { id: '3', titulo: 'Capacitación Obligatoria - Seguridad', mensaje: 'Todos los colaboradores deben completar la capacitación de seguridad laboral antes del 28 de febrero.', prioridad: 'ALTA', fecha: '2026-02-10' },
];

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};
const fmtDateLong = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
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

function calcTenure(fechaIngreso: string): { years: number; months: number } {
  const start = new Date(fechaIngreso);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (now.getDate() < start.getDate()) {
    months--;
    if (months < 0) {
      years--;
      months += 12;
    }
  }
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

// Circular Progress Component
function CircularProgress({ value, size = 80, strokeWidth = 8, colorClass = 'text-emerald-500', trackClass = 'text-slate-100 dark:text-slate-700', children }: {
  value: number; size?: number; strokeWidth?: number;
  colorClass?: string; trackClass?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={trackClass} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="currentColor" strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-700`}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

// Mini bar chart for salary trend
function SalaryBarChart({ data: chartData }: { data: { label: string; value: number }[] }) {
  if (chartData.length === 0) return null;
  const maxVal = Math.max(...chartData.map(d => d.value));
  return (
    <div className="flex items-end gap-1.5 h-16">
      {chartData.map((d, i) => {
        const height = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t-sm bg-gradient-to-t from-emerald-500 to-teal-400 dark:from-emerald-600 dark:to-teal-500 transition-all duration-500 min-h-[4px]"
              style={{ height: `${Math.max(height, 8)}%` }}
              title={`${d.label}: ${fmt(d.value)}`}
            />
            <span className="text-[8px] text-slate-400 dark:text-slate-500 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Salary Progression SVG Line Chart
function SalaryLineChart({ data: chartData }: { data: { label: string; value: number }[] }) {
  if (chartData.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
        <TrendingUp className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
        <p className="text-xs">Historial no disponible</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Se necesitan al menos 2 períodos de datos</p>
      </div>
    );
  }

  const width = 280;
  const height = 100;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;
  const range = maxVal - minVal || 1;

  const points = chartData.map((d, i) => ({
    x: padding.left + (i / (chartData.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight,
  }));

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${padding.left},${padding.top + chartHeight} ${polylinePoints} ${padding.left + chartWidth},${padding.top + chartHeight}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" className="text-emerald-400" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" className="text-emerald-400" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon points={areaPoints} fill="url(#salaryGrad)" />
        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="currentColor"
          className="text-emerald-500 dark:text-emerald-400"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" className="fill-white dark:fill-slate-800 stroke-emerald-500 dark:stroke-emerald-400" strokeWidth="2" />
            {/* Label */}
            <text
              x={p.x}
              y={height - 2}
              textAnchor="middle"
              className="fill-slate-400 dark:fill-slate-500"
              fontSize="7"
              fontFamily="sans-serif"
            >
              {chartData[i].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Deduction Breakdown Bar
function DeductionBreakdownBar({ isss, afp, isr, other, total }: { isss: number; afp: number; isr: number; other: number; total: number }) {
  if (total <= 0) return null;
  const segments = [
    { label: 'ISSS', value: isss, color: 'bg-emerald-500 dark:bg-emerald-400', textColor: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'AFP', value: afp, color: 'bg-teal-500 dark:bg-teal-400', textColor: 'text-teal-700 dark:text-teal-300' },
    { label: 'ISR', value: isr, color: 'bg-amber-500 dark:bg-amber-400', textColor: 'text-amber-700 dark:text-amber-300' },
    { label: 'Otros', value: other, color: 'bg-slate-400 dark:bg-slate-500', textColor: 'text-slate-600 dark:text-slate-400' },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div
              key={i}
              className={`${seg.color} transition-all duration-500 flex items-center justify-center`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${fmt(seg.value)} (${pct.toFixed(1)}%)`}
            >
              {pct >= 12 && (
                <span className="text-[8px] font-bold text-white drop-shadow-sm">{pct.toFixed(0)}%</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend with amounts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-sm ${seg.color} shrink-0`} />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{seg.label}</span>
              <span className={`text-[10px] font-semibold ml-auto ${seg.textColor} font-mono`}>{fmt(seg.value)}</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">({pct.toFixed(1)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Animated entrance wrapper
function AnimatedCard({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div
      className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} ${className || ''}`}
    >
      {children}
    </div>
  );
}

// Month names for vacation calendar
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function SelfServicePortal({ accessToken }: SelfServicePortalProps) {
  const { toast } = useToast();
  const [data, setData] = useState<SelfServiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showVacationDialog, setShowVacationDialog] = useState(false);
  const [showIncidenceDialog, setShowIncidenceDialog] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
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

  // Certificate dialog state
  const [certTipo, setCertTipo] = useState('');
  const [certMotivo, setCertMotivo] = useState('');
  const [certSubmitting, setCertSubmitting] = useState(false);

  // Request history filter
  const [solicitudesFilter, setSolicitudesFilter] = useState<'TODAS' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('TODAS');

  // Expandable pay slip
  const [expandedRecibo, setExpandedRecibo] = useState<string | null>(null);

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

  // Salary trend data (last 6 months) for bar chart
  const salaryTrend = useMemo(() => {
    if (!data) return [];
    return [...data.recibos]
      .reverse()
      .slice(0, 6)
      .map(r => ({
        label: new Date(r.periodo_inicio).toLocaleDateString('es-SV', { month: 'short' }),
        value: r.salario_neto,
      }));
  }, [data]);

  // Salary progression data for SVG line chart
  const salaryProgression = useMemo(() => {
    if (!data) return [];
    return [...data.recibos]
      .reverse()
      .map(r => ({
        label: new Date(r.periodo_inicio).toLocaleDateString('es-SV', { month: 'short' }),
        value: r.salario_bruto,
      }));
  }, [data]);

  // Year summary calculations
  const yearSummary = useMemo(() => {
    if (!data || data.recibos.length === 0) return null;
    const currentYear = new Date().getFullYear();
    const yearRecibos = data.recibos.filter(r => {
      try { return new Date(r.periodo_inicio).getFullYear() === currentYear; } catch { return false; }
    });
    const recibosToSum = yearRecibos.length > 0 ? yearRecibos : data.recibos;
    return {
      totalGross: recibosToSum.reduce((s, r) => s + r.salario_bruto, 0),
      totalDeductions: recibosToSum.reduce((s, r) => s + r.total_descuentos, 0),
      totalNet: recibosToSum.reduce((s, r) => s + r.salario_neto, 0),
      totalISR: recibosToSum.reduce((s, r) => s + r.isr_retenido, 0),
      count: recibosToSum.length,
      year: yearRecibos.length > 0 ? currentYear : null,
    };
  }, [data]);

  // Latest pay slip for deduction breakdown
  const latestRecibo = useMemo(() => {
    if (!data || data.recibos.length === 0) return null;
    return data.recibos[0];
  }, [data]);

  // Vacation calendar data - which months have vacation days taken
  const vacationCalendar = useMemo(() => {
    if (!data) return Array(12).fill(0);
    const months = Array(12).fill(0);
    data.solicitudes
      .filter(s => s.tipo === 'VACACION' && (s.estado === 'APROBADA' || s.estado === 'PENDIENTE'))
      .forEach(s => {
        try {
          const fecha = new Date(s.fecha_solicitud);
          months[fecha.getMonth()] += 1;
        } catch { /* skip */ }
      });
    return months;
  }, [data]);

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
        const errData = await res.json();
        toast({ title: 'Error', description: errData.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVacation = async () => {
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
        toast({ title: 'Solicitud de vacaciones enviada', description: `Se solicitaron ${vacDaysRequested} días de vacaciones` });
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
        toast({ title: 'Incidencia reportada', description: 'Su reporte de incidencia ha sido registrado exitosamente' });
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

  const handleSubmitCert = async () => {
    if (!certTipo) {
      toast({ title: 'Error', description: 'Seleccione el tipo de constancia', variant: 'destructive' });
      return;
    }
    setCertSubmitting(true);
    try {
      const res = await fetch('/api/selfservice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: certTipo, detalle: certMotivo || `Solicitud de ${certTipo.replace(/_/g, ' ').toLowerCase()}` }),
      });
      if (res.ok) {
        toast({ title: 'Solicitud enviada', description: `Su solicitud de ${certTipo.replace(/_/g, ' ').toLowerCase()} ha sido registrada` });
        setShowCertDialog(false);
        setCertTipo('');
        setCertMotivo('');
        fetchData();
      } else {
        const errData = await res.json();
        toast({ title: 'Error', description: errData.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setCertSubmitting(false);
    }
  };

  const handleCancelSolicitud = async (solicitudId: string) => {
    try {
      const res = await fetch('/api/selfservice', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: solicitudId, estado: 'CANCELADA' }),
      });
      if (res.ok) {
        toast({ title: 'Solicitud cancelada', description: 'La solicitud ha sido cancelada exitosamente' });
        fetchData();
      } else {
        const errData = await res.json();
        toast({ title: 'Error', description: errData.error || 'No se pudo cancelar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
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
      <div className="space-y-4 max-w-4xl mx-auto p-1">
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400">No se pudieron cargar sus datos</p>
          <Button onClick={fetchData} variant="outline" className="mt-4">Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  const emp = data.empleado;
  const tenure = calcTenure(emp.fecha_ingreso);
  const totalDiasPendientes = data.vacaciones.reduce((s, v) => s + v.dias_pendientes, 0);
  const totalDiasTomados = data.vacaciones.reduce((s, v) => s + v.dias_tomados, 0);
  const totalDiasDerecho = data.vacaciones.reduce((s, v) => s + v.dias_derecho, 0);
  const vacationProgress = totalDiasDerecho > 0 ? Math.round((totalDiasTomados / totalDiasDerecho) * 100) : 0;
  const vacationRemaining = totalDiasDerecho > 0 ? Math.round((totalDiasPendientes / totalDiasDerecho) * 100) : 100;

  // Benefits calculations
  const isssEmployeeRate = 0.03;
  const afpEmployeeRate = 0.0725;
  const monthlyISSS = emp.salario_base * isssEmployeeRate;
  const monthlyAFP = emp.salario_base * afpEmployeeRate;
  const annualISSS = monthlyISSS * 12;
  const annualAFP = monthlyAFP * 12;
  const aguinaldoEstimate = emp.salario_base * (tenure.years >= 1 ? 1 : tenure.months / 12);
  const seniorityBonusEligible = tenure.years >= 1;

  // AFP balance estimate: monthly contribution × months worked
  const totalMonthsWorked = tenure.years * 12 + tenure.months;
  const afpBalanceEstimate = monthlyAFP * totalMonthsWorked;

  // Announcements
  const announcements = data.notificaciones?.length ? data.notificaciones : defaultAnnouncements;

  const getSolicitudBadge = (estado: string) => {
    if (estado === 'PENDIENTE') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    if (estado === 'APROBADA') return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    if (estado === 'CANCELADA') return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700';
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  };

  const getSolicitudIcon = (tipo: string) => {
    switch (tipo) {
      case 'VACACION': return <Plane className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
      case 'CONSTANCIA_EMPLEO': return <FileBadge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'CONSTANCIA_SALARIAL': return <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'CONSTANCIA_ISR': return <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
      case 'CAMBIO_DATOS': return <Edit3 className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
      default: return <AlertCircle className="h-4 w-4 text-slate-500" />;
    }
  };

  const getSolicitudTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'VACACION': return 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800';
      case 'CONSTANCIA_EMPLEO': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800';
      case 'CONSTANCIA_SALARIAL': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800';
      case 'CONSTANCIA_ISR': return 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800';
      case 'CAMBIO_DATOS': return 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800';
      default: return 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700';
    }
  };

  const getPriorityBadge = (prioridad: string) => {
    if (prioridad === 'ALTA') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (prioridad === 'MEDIA') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400';
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-1">
      {/* ========== QUICK LINKS BAR ========== */}
      <AnimatedCard delay={0}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setShowCertDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all shrink-0 min-h-[44px] group"
          >
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 group-hover:scale-110 transition-transform">
              <FileBadge className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Mi Constancia</span>
          </button>
          <button
            onClick={() => {
              if (data.recibos.length > 0) handleDownloadBoleta(data.recibos[0].id);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all shrink-0 min-h-[44px] group"
          >
            <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-800/50 group-hover:scale-110 transition-transform">
              <FileDown className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Descargar Recibo</span>
          </button>
          <button
            onClick={() => setShowVacationDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-all shrink-0 min-h-[44px] group"
          >
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-800/50 group-hover:scale-110 transition-transform">
              <Plane className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Solicitar Vacación</span>
          </button>
          <button
            onClick={() => setShowIncidenceDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-all shrink-0 min-h-[44px] group"
          >
            <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-800/50 group-hover:scale-110 transition-transform">
              <Bug className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Reportar Incidencia</span>
          </button>
        </div>
      </AnimatedCard>

      {/* ========== ENHANCED HEADER CARD ========== */}
      <AnimatedCard delay={50}>
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-white/[0.03] rounded-lg rotate-12" />
          <div className="absolute bottom-1/4 right-2/3 w-10 h-10 bg-white/[0.04] rounded-full" />

          <div className="flex items-start gap-5 relative z-10">
            {/* Avatar with initials */}
            <Avatar className="h-20 w-20 ring-3 ring-white/30 shadow-lg">
              <AvatarFallback className="bg-white/20 backdrop-blur-sm text-2xl font-bold text-white">
                {emp.primer_nombre[0]}{emp.primer_apellido[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold truncate leading-tight">
                {emp.primer_nombre} {emp.segundo_nombre || ''} {emp.primer_apellido} {emp.segundo_apellido || ''}
              </h2>
              <p className="text-emerald-100 text-sm flex items-center gap-1.5 mt-1">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{data.perfil_puesto?.nombre_puesto || 'Sin puesto'}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[11px] hover:bg-white/30">
                  <Building className="h-3 w-3 mr-1" />
                  {data.area?.nombre || 'Sin área'}
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[11px] hover:bg-white/30">
                  <MapPin className="h-3 w-3 mr-1" />
                  {emp.codigo_empleado}
                </Badge>
                <Badge variant="secondary" className="bg-emerald-300/40 text-white border-emerald-400/30 text-[11px]">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  ACTIVO
                </Badge>
              </div>
              {/* Tenure info */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/15">
                <div className="flex items-center gap-1.5 text-emerald-100 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Desde {fmtDateLong(emp.fecha_ingreso)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white text-xs font-semibold">
                  <Award className="h-3.5 w-3.5" />
                  <span>{tenure.years} año{tenure.years !== 1 ? 's' : ''} {tenure.months} mes{tenure.months !== 1 ? 'es' : ''} de servicio</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* ========== QUICK STATS ROW ========== */}
      <AnimatedCard delay={100}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3.5 border border-emerald-100 dark:border-emerald-800/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-800/50">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Salario</span>
            </div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">{fmt(emp.salario_base)}</p>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3.5 border border-teal-100 dark:border-teal-800/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-800/50">
                <Sun className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              </div>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider">Vacaciones</span>
            </div>
            <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{totalDiasPendientes} <span className="text-xs font-normal text-teal-500">días</span></p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3.5 border border-amber-100 dark:border-amber-800/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-800/50">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">Pendientes</span>
            </div>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{data.solicitudes.filter(s => s.estado === 'PENDIENTE').length} <span className="text-xs font-normal text-amber-500">solicitudes</span></p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3.5 border border-rose-100 dark:border-rose-800/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-800/50">
                <Receipt className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wider">Recibos</span>
            </div>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-300">{data.recibos.length} <span className="text-xs font-normal text-rose-500">disponibles</span></p>
          </div>
        </div>
      </AnimatedCard>

      {/* ========== YEAR SUMMARY CARD ========== */}
      {yearSummary && (
        <AnimatedCard delay={150}>
          <Card className="shadow-sm border-0 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-800/50 dark:via-slate-800/30 dark:to-slate-800/50 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Resumen Anual {yearSummary.year || ''}
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                  {yearSummary.count} períodos
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/70 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total Bruto</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono mt-1">{fmt(yearSummary.totalGross)}</p>
                </div>
                <div className="bg-white/70 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total Descuentos</p>
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">{fmt(yearSummary.totalDeductions)}</p>
                </div>
                <div className="bg-white/70 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total Neto</p>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono mt-1">{fmt(yearSummary.totalNet)}</p>
                </div>
                <div className="bg-white/70 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">ISR Retenido YTD</p>
                  <p className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono mt-1">{fmt(yearSummary.totalISR)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      )}

      {/* ========== MAIN CONTENT GRID ========== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ===== ENHANCED VACATION SECTION ===== */}
        <AnimatedCard delay={200} className="md:row-span-2">
          <Card className="shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plane className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Saldo de Vacaciones
                </CardTitle>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 gap-1.5 min-h-[44px]"
                  onClick={() => setShowVacationDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Solicitar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Circular progress with available indicator */}
              <div className="flex items-center gap-5">
                <CircularProgress
                  value={vacationRemaining}
                  size={96}
                  strokeWidth={10}
                  colorClass="text-emerald-500 dark:text-emerald-400"
                >
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{totalDiasPendientes}</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-medium">Disponibles</span>
                </CircularProgress>
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Color legend */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Disponibles</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-auto">{totalDiasPendientes} días</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400 dark:bg-amber-500" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Pendientes aprobación</span>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-auto">
                        {data.solicitudes.filter(s => s.tipo === 'VACACION' && s.estado === 'PENDIENTE').length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-teal-400 dark:bg-teal-500" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Tomados</span>
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 ml-auto">{totalDiasTomados} días</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Utilizado del total</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{vacationProgress}%</span>
                </div>
                <Progress value={vacationProgress} className="h-2.5" />
              </div>

              {/* Vacation Calendar - 12 months grid */}
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Calendario de Vacaciones</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {monthNames.map((name, i) => {
                    const hasVacation = vacationCalendar[i] > 0;
                    return (
                      <div
                        key={i}
                        className={`rounded-lg p-2 text-center border transition-colors ${
                          hasVacation
                            ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800'
                            : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700/50'
                        }`}
                      >
                        <p className={`text-[10px] font-semibold ${hasVacation ? 'text-teal-700 dark:text-teal-300' : 'text-slate-400 dark:text-slate-500'}`}>{name}</p>
                        {hasVacation && (
                          <p className="text-[8px] text-teal-500 dark:text-teal-400 mt-0.5">{vacationCalendar[i]} sol.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per year breakdown with calendar indicators */}
              {data.vacaciones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Desglose por Año</p>
                  {data.vacaciones.map((v) => {
                    const yearProgress = v.dias_derecho > 0 ? Math.round((v.dias_tomados / v.dias_derecho) * 100) : 0;
                    const availableSegments = Math.round((v.dias_pendientes / v.dias_derecho) * 10);
                    const takenSegments = Math.round((v.dias_tomados / v.dias_derecho) * 10);
                    return (
                      <div key={v.id} className="bg-slate-50/80 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Año {v.anio}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{v.dias_pendientes} disp.</span>
                            <span className="text-[10px] text-slate-400">|</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{v.dias_tomados} tomados</span>
                          </div>
                        </div>
                        <Progress value={yearProgress} className="h-1.5" />
                        {/* Calendar-like day indicators */}
                        <div className="flex gap-0.5 mt-2">
                          {Array.from({ length: 10 }, (_, i) => (
                            <div
                              key={i}
                              className={`h-2.5 flex-1 rounded-sm transition-colors ${
                                i < takenSegments
                                  ? 'bg-teal-400 dark:bg-teal-500'
                                  : i < takenSegments + availableSegments
                                    ? 'bg-emerald-400 dark:bg-emerald-500'
                                    : 'bg-slate-200 dark:bg-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-teal-500 dark:text-teal-400">Tomado</span>
                          <span className="text-[9px] text-emerald-500 dark:text-emerald-400">Disponible</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>

        {/* ===== BENEFITS SUMMARY CARD ===== */}
        <AnimatedCard delay={250}>
          <Card className="shadow-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Beneficios y Prestaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {/* ISSS Coverage */}
                <div className="bg-emerald-50/80 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-emerald-100 dark:bg-emerald-800/50">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">ISSS - Seguro Social</p>
                        <p className="text-[10px] text-emerald-500 dark:text-emerald-400">Cobertura médica y maternidad</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-emerald-500 dark:text-emerald-400">Desc. mensual</p>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">{fmt(monthlyISSS)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-emerald-200/50 dark:border-emerald-700/30">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Aporte anual estimado</span>
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 font-mono">{fmt(annualISSS)}</span>
                  </div>
                </div>

                {/* AFP Retirement Savings */}
                <div className="bg-teal-50/80 dark:bg-teal-900/20 rounded-lg p-3 border border-teal-100 dark:border-teal-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-teal-100 dark:bg-teal-800/50">
                        <PiggyBank className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">AFP - Fondo de Pensión</p>
                        <p className="text-[10px] text-teal-500 dark:text-teal-400">Ahorro para jubilación</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-teal-500 dark:text-teal-400">Desc. mensual</p>
                      <p className="text-xs font-bold text-teal-700 dark:text-teal-300 font-mono">{fmt(monthlyAFP)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-teal-200/50 dark:border-teal-700/30">
                    <span className="text-[10px] text-teal-600 dark:text-teal-400">Saldo estimado acumulado ({totalMonthsWorked} meses)</span>
                    <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 font-mono">{fmt(afpBalanceEstimate)}</span>
                  </div>
                </div>

                {/* INSAFORP Training Benefit */}
                <div className="bg-violet-50/80 dark:bg-violet-900/20 rounded-lg p-3 border border-violet-100 dark:border-violet-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-violet-100 dark:bg-violet-800/50">
                        <GraduationCap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">INSAFORP - Capacitación</p>
                        <p className="text-[10px] text-violet-500 dark:text-violet-400">Beneficio de formación profesional</p>
                      </div>
                    </div>
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800 text-[10px]">
                      <CheckCircle className="h-2.5 w-2.5 mr-1" />
                      Activo
                    </Badge>
                  </div>
                  <p className="text-[10px] text-violet-500 dark:text-violet-400 mt-1.5">1% del planilla patronal destinado a capacitación (Art. 56 Código Trabajo)</p>
                </div>

                {/* Seguro Complementario */}
                <div className="bg-sky-50/80 dark:bg-sky-900/20 rounded-lg p-3 border border-sky-100 dark:border-sky-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-sky-100 dark:bg-sky-800/50">
                        <Heart className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">Seguro Complementario</p>
                        <p className="text-[10px] text-sky-500 dark:text-sky-400">Cobertura adicional de salud</p>
                      </div>
                    </div>
                    <Badge className="bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800 text-[10px]">
                      <Info className="h-2.5 w-2.5 mr-1" />
                      Opcional
                    </Badge>
                  </div>
                </div>

                {/* Aguinaldo */}
                <div className="bg-amber-50/80 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-100 dark:border-amber-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-amber-100 dark:bg-amber-800/50">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Aguinaldo Estimado</p>
                        <p className="text-[10px] text-amber-500 dark:text-amber-400">Basado en salario actual</p>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300 font-mono">{fmt(aguinaldoEstimate)}</p>
                  </div>
                </div>

                {/* Seniority Bonus */}
                <div className={`rounded-lg p-3 border ${
                  seniorityBonusEligible
                    ? 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50'
                    : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${
                        seniorityBonusEligible ? 'bg-emerald-100 dark:bg-emerald-800/50' : 'bg-slate-100 dark:bg-slate-700'
                      }`}>
                        <Award className={`h-3.5 w-3.5 ${seniorityBonusEligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${seniorityBonusEligible ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                          Bono de Antigüedad
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {seniorityBonusEligible ? 'Elegible' : 'Requiere 1+ año de servicio'}
                        </p>
                      </div>
                    </div>
                    {seniorityBonusEligible ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px]">
                        Elegible
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700 text-[10px]">
                        Pendiente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </div>

      {/* ===== MONTHLY DEDUCTION BREAKDOWN CHART ===== */}
      <AnimatedCard delay={300}>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Desglose de Descuentos
              </CardTitle>
              {latestRecibo && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {new Date(latestRecibo.periodo_inicio).toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {latestRecibo ? (
              <div>
                <DeductionBreakdownBar
                  isss={latestRecibo.isss_laboral}
                  afp={latestRecibo.afp_laboral}
                  isr={latestRecibo.isr_retenido}
                  other={latestRecibo.total_descuentos - latestRecibo.isss_laboral - latestRecibo.afp_laboral - latestRecibo.isr_retenido}
                  total={latestRecibo.total_descuentos}
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Total Descuentos</span>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">{fmt(latestRecibo.total_descuentos)}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                <BarChart3 className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm">No hay datos de descuentos disponibles</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Los descuentos aparecerán cuando haya recibos de pago</p>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>

      {/* ===== ENHANCED PAY SLIPS SECTION ===== */}
      <AnimatedCard delay={350}>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Recibos de Pago
              </CardTitle>
              {data.recibos.length > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                  Últimos {data.recibos.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.recibos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                <Receipt className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm">No hay recibos disponibles</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Los recibos aparecerán cuando se procesen las planillas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Salary trend mini chart */}
                {salaryTrend.length > 1 && (
                  <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Tendencia Salario Neto
                      </p>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Últimos {salaryTrend.length} períodos</span>
                    </div>
                    <SalaryBarChart data={salaryTrend} />
                  </div>
                )}

                {/* Pay slip list with expandable rows */}
                <div className="space-y-2">
                  {data.recibos.map((recibo) => {
                    const isExpanded = expandedRecibo === recibo.id;
                    const deductionsTotal = recibo.isss_laboral + recibo.afp_laboral + recibo.isr_retenido;
                    const otherDeductions = recibo.total_descuentos - deductionsTotal;

                    return (
                      <Collapsible key={recibo.id} open={isExpanded} onOpenChange={(open) => setExpandedRecibo(open ? recibo.id : null)}>
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors text-left">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                  {new Date(recibo.periodo_inicio).toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })}
                                </p>
                                <Badge variant="secondary" className="text-[9px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                                  {recibo.tipo}
                                </Badge>
                                <Badge variant="secondary" className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                  <Banknote className="h-2.5 w-2.5" /> Transferencia
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-xs">
                                <span className="text-slate-500 dark:text-slate-400">Bruto: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{fmt(recibo.salario_bruto)}</span></span>
                                <span className="text-slate-500 dark:text-slate-400">Neto: <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{fmt(recibo.salario_neto)}</span></span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 min-h-[44px] border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                onClick={(e) => { e.stopPropagation(); handleDownloadBoleta(recibo.id); }}
                                disabled={downloadingId === recibo.id}
                              >
                                {downloadingId === recibo.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                <span className="hidden sm:inline">PDF</span>
                              </Button>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-1 p-4 bg-white dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                            {/* Earnings vs Deductions */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Devengado</p>
                                <div className="flex items-center justify-between py-1">
                                  <span className="text-xs text-slate-600 dark:text-slate-400">Salario Base</span>
                                  <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200">{fmt(recibo.salario_bruto)}</span>
                                </div>
                                <Separator className="my-1" />
                                <div className="flex items-center justify-between py-1">
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Devengado</span>
                                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{fmt(recibo.salario_bruto)}</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Descuentos</p>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">ISSS (3%)</span>
                                    <span className="text-xs font-mono text-rose-600 dark:text-rose-400">-{fmt(recibo.isss_laboral)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">AFP (7.25%)</span>
                                    <span className="text-xs font-mono text-rose-600 dark:text-rose-400">-{fmt(recibo.afp_laboral)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">ISR Retención</span>
                                    <span className="text-xs font-mono text-rose-600 dark:text-rose-400">-{fmt(recibo.isr_retenido)}</span>
                                  </div>
                                  {otherDeductions > 0 && (
                                    <div className="flex items-center justify-between py-0.5">
                                      <span className="text-xs text-slate-600 dark:text-slate-400">Otros Descuentos</span>
                                      <span className="text-xs font-mono text-rose-600 dark:text-rose-400">-{fmt(otherDeductions)}</span>
                                    </div>
                                  )}
                                </div>
                                <Separator className="my-1" />
                                <div className="flex items-center justify-between py-1">
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Descuentos</span>
                                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">-{fmt(recibo.total_descuentos)}</span>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            {/* Net pay */}
                            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800/50">
                              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Líquido a Recibir</span>
                              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">{fmt(recibo.salario_neto)}</span>
                            </div>

                            {/* Period info */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                              <span>Período: {fmtDate(recibo.periodo_inicio)} - {fmtDate(recibo.periodo_fin)}</span>
                              <span className="flex items-center gap-1"><Banknote className="h-2.5 w-2.5" /> Pago por transferencia bancaria</span>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>

      {/* ===== SALARY PROGRESSION MINI CHART ===== */}
      <AnimatedCard delay={400}>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Progresión Salarial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SalaryLineChart data={salaryProgression} />
            {salaryProgression.length >= 2 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Salario Bruto por período</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Tendencia</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>

      {/* ===== REQUEST MANAGEMENT + ANNOUNCEMENTS GRID ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ===== NEW REQUEST BUTTONS ===== */}
        <AnimatedCard delay={450}>
          <Card className="shadow-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Nueva Solicitud
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Vacation request */}
                <button
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-teal-200 dark:border-teal-800 hover:border-teal-300 dark:hover:border-teal-700 bg-teal-50/50 dark:bg-teal-900/20 hover:bg-teal-100/50 dark:hover:bg-teal-800/30 transition-all cursor-pointer text-left group min-h-[44px]"
                  onClick={() => setShowVacationDialog(true)}
                >
                  <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-800/50 group-hover:scale-110 transition-transform">
                    <Plane className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Vacaciones</span>
                </button>
                {/* Certificate request */}
                <button
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-800/30 transition-all cursor-pointer text-left group min-h-[44px]"
                  onClick={() => setShowCertDialog(true)}
                >
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 group-hover:scale-110 transition-transform">
                    <FileBadge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Constancias</span>
                </button>
                {/* Incidence report */}
                <button
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 bg-orange-50/50 dark:bg-orange-900/20 hover:bg-orange-100/50 dark:hover:bg-orange-800/30 transition-all cursor-pointer text-left group min-h-[44px]"
                  onClick={() => setShowIncidenceDialog(true)}
                >
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-800/50 group-hover:scale-110 transition-transform">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Incidencia</span>
                </button>
                {/* Data change request */}
                <button
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer text-left group min-h-[44px]"
                  onClick={() => { setRequestType('CAMBIO_DATOS'); setShowRequestDialog(true); }}
                >
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 group-hover:scale-110 transition-transform">
                    <Edit3 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Cambio Datos</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>

        {/* ===== ANNOUNCEMENTS / NOTICES ===== */}
        <AnimatedCard delay={500}>
          <Card className="shadow-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Avisos y Comunicados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {announcements.slice(0, 3).map((notice) => (
                  <div key={notice.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{notice.titulo}</p>
                      <Badge className={`text-[9px] border shrink-0 ${getPriorityBadge(notice.prioridad)}`}>
                        {notice.prioridad}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{notice.mensaje}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {fmtDate(notice.fecha)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </div>

      {/* ===== MY REQUESTS - TIMELINE VIEW ===== */}
      <AnimatedCard delay={550}>
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
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {(['TODAS', 'PENDIENTE', 'APROBADA', 'RECHAZADA'] as const).map((filter) => {
                  const count = filter === 'TODAS'
                    ? data.solicitudes.length
                    : data.solicitudes.filter(s => s.estado === filter).length;
                  return (
                    <button
                      key={filter}
                      onClick={() => setSolicitudesFilter(filter)}
                      className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors min-h-[32px] ${
                        solicitudesFilter === filter
                          ? 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
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
              /* Visual Timeline */
              <div className="relative max-h-96 overflow-y-auto">
                <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-0">
                  {filteredSolicitudes.map((sol, idx) => {
                    const isLast = idx === filteredSolicitudes.length - 1;
                    // Timeline dot color based on status
                    const dotColor = sol.estado === 'APROBADA'
                      ? 'bg-emerald-500'
                      : sol.estado === 'PENDIENTE'
                        ? 'bg-amber-400'
                        : sol.estado === 'CANCELADA'
                          ? 'bg-slate-400'
                          : 'bg-red-400';
                    const DotIcon = sol.estado === 'APROBADA'
                      ? CheckCircle
                      : sol.estado === 'RECHAZADA'
                        ? XCircle
                        : sol.estado === 'CANCELADA'
                          ? Ban
                          : Clock;
                    const dotIconColor = sol.estado === 'APROBADA'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : sol.estado === 'PENDIENTE'
                        ? 'text-amber-600 dark:text-amber-400'
                        : sol.estado === 'CANCELADA'
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-red-600 dark:text-red-400';

                    return (
                      <div key={sol.id} className="relative flex gap-4 pb-4">
                        {/* Timeline dot */}
                        <div className="relative z-10 flex items-center justify-center w-[30px] shrink-0">
                          <div className={`w-[30px] h-[30px] rounded-full ${dotColor} flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-slate-900`}>
                            <DotIcon className={`h-3.5 w-3.5 text-white`} />
                          </div>
                        </div>
                        {/* Content */}
                        <div className={`flex-1 min-w-0 ${!isLast ? 'pb-1' : ''}`}>
                          <div className={`p-3 rounded-lg border ${getSolicitudTypeColor(sol.tipo)} transition-colors`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0">
                                <div className="shrink-0 mt-0.5">{getSolicitudIcon(sol.tipo)}</div>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">{sol.tipo.replace(/_/g, ' ')}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{fmtDate(sol.fecha_solicitud)}</p>
                                  {sol.detalle && (
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{sol.detalle}</p>
                                  )}
                                  {sol.fecha_resolucion && (
                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                                      <CheckCircle className="h-2.5 w-2.5" />
                                      Resuelta: {fmtDate(sol.fecha_resolucion)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge className={`text-[10px] border ${getSolicitudBadge(sol.estado)}`}>
                                  {sol.estado}
                                </Badge>
                                {sol.estado === 'PENDIENTE' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px] min-w-[44px]"
                                    onClick={() => handleCancelSolicitud(sol.id)}
                                    title="Cancelar solicitud"
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>

      {/* ===== PERSONAL INFORMATION CARD ===== */}
      <AnimatedCard delay={600}>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Información Personal
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5 min-h-[44px] border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                onClick={() => { setRequestType('CAMBIO_DATOS'); setShowRequestDialog(true); }}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Solicitar Cambio
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Briefcase className="h-2.5 w-2.5" /> Código
                  </p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 font-mono text-xs mt-0.5">{emp.codigo_empleado}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Building className="h-2.5 w-2.5" /> Área
                  </p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5">{data.area?.nombre || 'Sin área'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Puesto</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5">{data.perfil_puesto?.nombre_puesto || 'Sin puesto'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <CalendarDays className="h-2.5 w-2.5" /> Ingreso
                  </p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5">{fmtDate(emp.fecha_ingreso)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">DUI</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5">{emp.dui}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Phone className="h-2.5 w-2.5" /> Teléfono
                  </p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5">{emp.telefono || '—'}</p>
                </div>
              </div>

              <Separator />

              {/* Contact info */}
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 mb-2">
                  <Mail className="h-2.5 w-2.5" /> Contacto
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300">{emp.email_personal || 'No registrado'}</p>
              </div>

              <Separator />

              {/* Emergency & Bank info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5" /> Emergencia
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">No registrado</p>
                  <p className="text-[10px] text-slate-400">—</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Banknote className="h-2.5 w-2.5" /> Cuenta Bancaria
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">Transferencia</p>
                  <p className="text-[10px] text-slate-400 font-mono">****-****-****</p>
                </div>
              </div>

              {data.perfil_puesto?.banda_salarial && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Banda Salarial</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5">
                      {data.perfil_puesto.banda_salarial.nombre} (Grado {data.perfil_puesto.banda_salarial.grado})
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>

      {/* ========== DIALOGS ========== */}

      {/* Generic Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" /> Nueva Solicitud
            </DialogTitle>
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
              <Button variant="outline" onClick={() => setShowRequestDialog(false)} className="min-h-[44px]">Cancelar</Button>
              <Button onClick={handleSubmitRequest} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 min-h-[44px]">
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
              <Plane className="h-5 w-5 text-teal-600" /> Solicitar Vacaciones
            </DialogTitle>
            <DialogDescription>Complete la información para su solicitud de vacaciones</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Available days indicator */}
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 border border-teal-100 dark:border-teal-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-teal-700 dark:text-teal-300 font-medium">Días disponibles</span>
                <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{availableVacationDays}</span>
              </div>
              {currentYearVacation && (
                <p className="text-[10px] text-teal-500 dark:text-teal-400 mt-1">
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
                  className="min-h-[44px]"
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
                  className="min-h-[44px]"
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
              <Button variant="outline" onClick={() => setShowVacationDialog(false)} className="min-h-[44px]">Cancelar</Button>
              <Button
                onClick={handleSubmitVacation}
                disabled={vacSubmitting || vacDaysRequested > availableVacationDays || vacDaysRequested === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white min-h-[44px]"
              >
                {vacSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Solicitar {vacDaysRequested > 0 ? `${vacDaysRequested} Días` : 'Vacaciones'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate Request Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-emerald-600" /> Solicitar Constancia
            </DialogTitle>
            <DialogDescription>Seleccione el tipo de constancia que necesita</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Constancia</Label>
              <Select value={certTipo} onValueChange={setCertTipo}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSTANCIA_EMPLEO">Constancia de Empleo</SelectItem>
                  <SelectItem value="CONSTANCIA_SALARIAL">Constancia Salarial</SelectItem>
                  <SelectItem value="CONSTANCIA_ISR">Constancia ISR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-motivo">Motivo / Uso (opcional)</Label>
              <Textarea
                id="cert-motivo"
                value={certMotivo}
                onChange={(e) => setCertMotivo(e.target.value)}
                placeholder="Ej: Trámite bancario, visa, etc."
                rows={2}
              />
            </div>

            {certTipo && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {certTipo === 'CONSTANCIA_EMPLEO' && 'La constancia de empleo incluye: datos personales, cargo, fecha de ingreso y salario actual.'}
                    {certTipo === 'CONSTANCIA_SALARIAL' && 'La constancia salarial detalla su remuneración actual y deducciones aplicables.'}
                    {certTipo === 'CONSTANCIA_ISR' && 'La constancia ISR muestra las retenciones de impuesto sobre la renta del período fiscal.'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCertDialog(false)} className="min-h-[44px]">Cancelar</Button>
              <Button
                onClick={handleSubmitCert}
                disabled={certSubmitting || !certTipo}
                className="bg-emerald-600 hover:bg-emerald-700 min-h-[44px]"
              >
                {certSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Solicitar Constancia
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
            <div className="space-y-2">
              <Label>Tipo de Incidencia</Label>
              <Select value={incTipo} onValueChange={(val) => {
                setIncTipo(val);
                setIncHoras('');
                setIncMonto('');
                setIncFechaFin('');
                setIncDescripcion('');
              }}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {incidenciaTipos.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {incTipo === 'HORAS_EXTRA' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-hours">Cantidad de horas</Label>
                  <Input id="inc-hours" type="number" min="0.5" max="10" step="0.5" value={incHoras} onChange={(e) => setIncHoras(e.target.value)} placeholder="Ej: 4" className="min-h-[44px]" />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Máximo 10 horas semanales según Art. 169 CT</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-date-he">Fecha</Label>
                  <Input id="inc-date-he" type="date" value={incFechaInicio} onChange={(e) => setIncFechaInicio(e.target.value)} className="min-h-[44px]" />
                </div>
              </div>
            )}

            {(incTipo === 'BONO' || incTipo === 'COMISION') && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-amount">Monto ($)</Label>
                  <Input id="inc-amount" type="number" min="0.01" step="0.01" value={incMonto} onChange={(e) => setIncMonto(e.target.value)} placeholder="0.00" className="min-h-[44px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-date-bc">Fecha</Label>
                  <Input id="inc-date-bc" type="date" value={incFechaInicio} onChange={(e) => setIncFechaInicio(e.target.value)} className="min-h-[44px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-desc-bc">Descripción</Label>
                  <Textarea id="inc-desc-bc" value={incDescripcion} onChange={(e) => setIncDescripcion(e.target.value)} placeholder={`Detalle del ${incTipo === 'BONO' ? 'bono' : 'comisión'}...`} rows={2} />
                </div>
              </div>
            )}

            {incTipo === 'INCAPACIDAD_ISSS' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="inc-start-inc">Fecha inicio</Label>
                    <Input id="inc-start-inc" type="date" value={incFechaInicio} onChange={(e) => setIncFechaInicio(e.target.value)} className="min-h-[44px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inc-end-inc">Fecha fin</Label>
                    <Input id="inc-end-inc" type="date" value={incFechaFin} onChange={(e) => setIncFechaFin(e.target.value)} min={incFechaInicio} className="min-h-[44px]" />
                  </div>
                </div>
                {incFechaInicio && incFechaFin && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Duración: {calcDaysBetween(incFechaInicio, incFechaFin)} día(s)</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="inc-desc-inc">Descripción</Label>
                  <Textarea id="inc-desc-inc" value={incDescripcion} onChange={(e) => setIncDescripcion(e.target.value)} placeholder="Detalle de la incapacidad..." rows={2} />
                </div>
              </div>
            )}

            {incTipo === 'PERMISO' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-date-perm">Fecha</Label>
                  <Input id="inc-date-perm" type="date" value={incFechaInicio} onChange={(e) => setIncFechaInicio(e.target.value)} className="min-h-[44px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-reason-perm">Motivo del permiso</Label>
                  <Textarea id="inc-reason-perm" value={incDescripcion} onChange={(e) => setIncDescripcion(e.target.value)} placeholder="Describa el motivo de su permiso..." rows={2} />
                </div>
              </div>
            )}

            {incTipo === 'OTRO' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="inc-date-otro">Fecha</Label>
                  <Input id="inc-date-otro" type="date" value={incFechaInicio} onChange={(e) => setIncFechaInicio(e.target.value)} className="min-h-[44px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-desc-otro">Descripción</Label>
                  <Textarea id="inc-desc-otro" value={incDescripcion} onChange={(e) => setIncDescripcion(e.target.value)} placeholder="Describa la incidencia..." rows={3} />
                </div>
              </div>
            )}

            {!incTipo && (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                <AlertCircle className="h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm">Seleccione un tipo de incidencia para continuar</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowIncidenceDialog(false)} className="min-h-[44px]">Cancelar</Button>
              <Button onClick={handleSubmitIncidence} disabled={incSubmitting || !incTipo} className="bg-orange-600 hover:bg-orange-700 text-white min-h-[44px]">
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

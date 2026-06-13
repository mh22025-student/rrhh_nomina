'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator, Users, FileText, DollarSign, Shield, CheckCircle,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, Download,
  ArrowLeft, ArrowRight, RefreshCw, Eye, Circle, Minus,
  Search, Calendar, Clock, TrendingUp, TrendingDown, Info,
  Plus, Trash2, X, AlertOctagon, CheckCheck, Scale,
  Building2, Briefcase, Hash
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface PayrollCalculationProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

const STEPS = [
  { num: 1, label: 'Seleccionar Período', icon: Calendar },
  { num: 2, label: 'Verificar Empleados', icon: Users },
  { num: 3, label: 'Cargar Incidencias', icon: AlertTriangle },
  { num: 4, label: 'Salarios Brutos', icon: TrendingUp },
  { num: 5, label: 'Deducciones', icon: Shield },
  { num: 6, label: 'Descuentos Adicionales', icon: Calculator },
  { num: 7, label: 'Salarios Netos', icon: DollarSign },
  { num: 8, label: 'Revisar y Confirmar', icon: CheckCircle },
];

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const INCIDENCE_TYPE_LABELS: Record<string, string> = {
  HORAS_EXTRA: 'Horas Extra',
  BONO: 'Bonos',
  COMISION: 'Comisiones',
  INCAPACIDAD_ISSS: 'Incapacidades ISSS',
  PERMISO: 'Permisos',
  DESCUENTO_ESPECIAL: 'Descuentos Especiales',
  INCAPACIDAD: 'Incapacidad',
};

const INCIDENCE_TYPE_COLORS: Record<string, string> = {
  HORAS_EXTRA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  BONO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  COMISION: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  INCAPACIDAD_ISSS: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  INCAPACIDAD: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  PERMISO: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  DESCUENTO_ESPECIAL: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
};

const INCIDENCE_TYPE_DOT: Record<string, string> = {
  HORAS_EXTRA: 'bg-amber-500',
  BONO: 'bg-emerald-500',
  COMISION: 'bg-teal-500',
  INCAPACIDAD_ISSS: 'bg-rose-500',
  INCAPACIDAD: 'bg-rose-500',
  PERMISO: 'bg-slate-400',
  DESCUENTO_ESPECIAL: 'bg-violet-500',
};

interface CalculationResult {
  planilla: {
    id: string;
    codigo_planilla: string;
    tipo: string;
    estado: string;
    total_empleados: number;
    total_salarios_brutos: number;
    total_isss_laboral: number;
    total_isss_patronal: number;
    total_afp_laboral: number;
    total_afp_patronal: number;
    total_isr_retenido: number;
    total_descuentos: number;
    total_neto_a_pagar: number;
    total_cargas_patronales: number;
    insaforp?: number;
    fecha_inicio_periodo?: string;
    fecha_fin_periodo?: string;
    fecha_calculo?: string;
  };
  detalles: Array<{
    empleado_id: string;
    salario_base: number;
    total_horas_extra: number;
    total_comisiones: number;
    total_bonos: number;
    salario_bruto: number;
    isss_laboral: number;
    isss_patronal: number;
    afp_laboral: number;
    afp_patronal: number;
    renta_imponible: number;
    isr_retenido: number;
    cuota_alimenticia: number;
    prestamo_patronal: number;
    seguro_complementario: number;
    otros_descuentos: number;
    total_descuentos: number;
    salario_neto: number;
    observaciones: string;
  }>;
  anomalies: Array<{
    empleado_id: string;
    empleado_nombre: string;
    tipo: string;
    detalle: string;
    severidad: string;
  }>;
  parametros_utilizados?: {
    tasa_isss_laboral: number;
    tasa_isss_patronal: number;
    tope_isss: number;
    tasa_afp_laboral: number;
    tasa_afp_patronal: number;
    tasa_insaforp: number;
    tramos_isr: Array<{
      numero_tramo: number;
      desde: number;
      hasta: number | null;
      porcentaje: number;
      cuota_fija: number;
    }>;
  };
}

interface EmployeeInfo {
  id: string;
  codigo: string;
  nombre: string;
  apellido: string;
  tieneContrato: boolean;
  tieneISSS: boolean;
  tieneAFP: boolean;
  salarioBase?: number;
  area?: string;
  contratoTipo?: string;
}

interface IncidenceInfo {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  tipo: string;
  monto: number;
  horas: number | null;
  estado: string;
  descripcion: string;
  fecha: string;
}

interface AdditionalDiscount {
  empleado_id: string;
  tipo: 'cuota_alimenticia' | 'prestamo_patronal' | 'seguro_complementario' | 'otros_descuentos';
  descripcion: string;
  monto: number;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const avatarColors = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
];

export default function PayrollCalculation({ accessToken }: PayrollCalculationProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipo, setTipo] = useState('MENSUAL');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [empleados, setEmpleados] = useState<EmployeeInfo[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenceInfo[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedEmpleados, setSelectedEmpleados] = useState<Set<string>>(new Set());
  const [selectedIncidencias, setSelectedIncidencias] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [existingPlanillas, setExistingPlanillas] = useState<Array<{ fecha_inicio: string; fecha_fin: string; estado: string }>>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [additionalDiscounts, setAdditionalDiscounts] = useState<AdditionalDiscount[]>([]);
  const [newDiscount, setNewDiscount] = useState<AdditionalDiscount>({
    empleado_id: '', tipo: 'otros_descuentos', descripcion: '', monto: 0,
  });
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [employeeDetailMap, setEmployeeDetailMap] = useState<Record<string, { nombre: string; codigo: string }>>({});

  // Fetch existing planillas on mount
  useEffect(() => {
    const fetchPlanillas = async () => {
      try {
        const res = await fetch('/api/nomina/planillas?limit=50', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setExistingPlanillas(
            (data.planillas || []).map((p: { fecha_inicio_periodo: string; fecha_fin_periodo: string; estado: string }) => ({
              fecha_inicio: p.fecha_inicio_periodo,
              fecha_fin: p.fecha_fin_periodo,
              estado: p.estado,
            }))
          );
        }
      } catch {
        // ignore
      }
    };
    fetchPlanillas();
  }, [accessToken]);

  // Fetch employees for step 2
  const fetchEmployees = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/empleados?pageSize=200&estado=ACTIVO', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const emps = (data.empleados || data.data || []).map((e: Record<string, unknown>) => {
          const area = e.area as Record<string, string> | null;
          return {
            id: e.id as string,
            codigo: (e.codigo_empleado as string) || (e.id as string).substring(0, 8),
            nombre: e.primer_nombre as string || '',
            apellido: e.primer_apellido as string || '',
            tieneContrato: true,
            tieneISSS: !!(e.numero_isss as string),
            tieneAFP: !!(e.numero_afp as string),
            salarioBase: (e.salario_base as number) || undefined,
            area: area?.nombre || 'Sin área',
            contratoTipo: 'Indefinido',
          };
        });
        setEmpleados(emps);
        setSelectedEmpleados(new Set(emps.map((e: EmployeeInfo) => e.id)));
        // Build detail map
        const map: Record<string, { nombre: string; codigo: string }> = {};
        emps.forEach((e: EmployeeInfo) => {
          map[e.id] = { nombre: `${e.nombre} ${e.apellido}`.trim(), codigo: e.codigo };
        });
        setEmployeeDetailMap(map);
      }
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, [accessToken]);

  // Fetch incidences for step 3
  const fetchIncidences = useCallback(async () => {
    if (!fechaInicio || !fechaFin) return;
    setLoadingData(true);
    try {
      const res = await fetch(`/api/incidencias?estado=APROBADA&limit=200&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const incs = (data.incidencias || data.data || []).map((i: Record<string, unknown>) => {
          const emp = i.empleado as Record<string, string> | null;
          return {
            id: i.id as string,
            empleado_id: i.empleado_id as string,
            empleado_nombre: emp ? `${emp.primer_nombre || ''} ${emp.primer_apellido || ''}`.trim() : 'Desconocido',
            tipo: i.tipo as string,
            monto: (i.monto as number) || 0,
            horas: (i.cantidad_horas as number) || null,
            estado: i.estado as string,
            descripcion: (i.descripcion as string) || '',
            fecha: i.fecha_inicio as string || '',
          };
        });
        setIncidencias(incs);
        setSelectedIncidencias(new Set(incs.map((i: IncidenceInfo) => i.id)));
      }
    } catch {
      // Generate placeholder incidences
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, fechaInicio, fechaFin]);

  // Auto-fetch data when moving to relevant steps
  useEffect(() => {
    if (step === 2 && empleados.length === 0) {
      fetchEmployees();
    }
    if (step === 3 && fechaInicio && fechaFin && incidencias.length === 0) {
      fetchIncidences();
    }
  }, [step, fetchEmployees, fetchIncidences, empleados.length, incidencias.length, fechaInicio, fechaFin]);

  const markStepComplete = (stepNum: number) => {
    setCompletedSteps(prev => new Set([...prev, stepNum]));
  };

  const handleCalculate = async () => {
    if (!fechaInicio || !fechaFin) {
      toast({ title: 'Error', description: 'Complete las fechas del período', variant: 'destructive' });
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch('/api/nomina/calcular', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoInicio: fechaInicio, periodoFin: fechaFin, tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular');
      setResult(data);
      // Build employee detail map from result
      const emps = data.detalles.map((d: CalculationResult['detalles'][0]) => ({
        id: d.empleado_id,
        codigo: d.empleado_id.substring(0, 8),
        nombre: d.observaciones || 'Empleado',
        apellido: '',
        tieneContrato: true,
        tieneISSS: true,
        tieneAFP: true,
        salarioBase: d.salario_base,
      }));
      if (empleados.length === 0) {
        setEmpleados(emps);
        setSelectedEmpleados(new Set(emps.map((e: EmployeeInfo) => e.id)));
      }
      // Build detail map
      setEmployeeDetailMap(prev => {
        const map = { ...prev };
        data.detalles.forEach((d: CalculationResult['detalles'][0]) => {
          if (!map[d.empleado_id]) {
            map[d.empleado_id] = { nombre: d.observaciones || 'Empleado', codigo: d.empleado_id.substring(0, 8) };
          }
        });
        return map;
      });
      // Generate incidences from result details
      const incs: IncidenceInfo[] = [];
      data.detalles.forEach((d: CalculationResult['detalles'][0], idx: number) => {
        if (d.total_horas_extra > 0) {
          incs.push({ id: `he-${idx}`, empleado_id: d.empleado_id, empleado_nombre: employeeDetailMap[d.empleado_id]?.nombre || d.empleado_id.substring(0, 8), tipo: 'HORAS_EXTRA', monto: d.total_horas_extra, horas: null, estado: 'APROBADA', descripcion: 'Horas extra del período', fecha: fechaInicio });
        }
        if (d.total_bonos > 0) {
          incs.push({ id: `bo-${idx}`, empleado_id: d.empleado_id, empleado_nombre: employeeDetailMap[d.empleado_id]?.nombre || d.empleado_id.substring(0, 8), tipo: 'BONO', monto: d.total_bonos, horas: null, estado: 'APROBADA', descripcion: 'Bonos del período', fecha: fechaInicio });
        }
        if (d.total_comisiones > 0) {
          incs.push({ id: `co-${idx}`, empleado_id: d.empleado_id, empleado_nombre: employeeDetailMap[d.empleado_id]?.nombre || d.empleado_id.substring(0, 8), tipo: 'COMISION', monto: d.total_comisiones, horas: null, estado: 'APROBADA', descripcion: 'Comisiones del período', fecha: fechaInicio });
        }
      });
      if (incs.length > 0) {
        setIncidencias(incs);
        setSelectedIncidencias(new Set(incs.map(i => i.id)));
      }
      setCompletedSteps(new Set([1, 2, 3, 4, 5, 6, 7]));
      toast({ title: 'Cálculo Completado', description: `${data.planilla.total_empleados} empleados procesados` });
      setStep(8);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al calcular nómina', variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ['Empleado ID', 'Salario Base', 'Horas Extra', 'Comisiones', 'Bonos', 'Salario Bruto', 'ISSS Laboral', 'AFP Laboral', 'Renta Imponible', 'ISR Retenido', 'Descuentos', 'Salario Neto'];
    const rows = result.detalles.map(d => [
      d.empleado_id, d.salario_base, d.total_horas_extra, d.total_comisiones, d.total_bonos,
      d.salario_bruto, d.isss_laboral, d.afp_laboral, d.renta_imponible, d.isr_retenido,
      d.total_descuentos, d.salario_neto,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina_${result.planilla.codigo_planilla}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nextStep = () => {
    markStepComplete(step);
    setStep(Math.min(step + 1, 8));
  };
  const prevStep = () => setStep(Math.max(step - 1, 1));

  const goToStep = (s: number) => {
    if (completedSteps.has(s) || s <= step) {
      setStep(s);
    }
  };

  const toggleEmpleado = (id: string) => {
    setSelectedEmpleados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEmpleados = () => {
    setSelectedEmpleados(new Set(empleados.map(e => e.id)));
  };

  const deselectAllEmpleados = () => {
    setSelectedEmpleados(new Set());
  };

  const toggleIncidencia = (id: string) => {
    setSelectedIncidencias(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addAdditionalDiscount = () => {
    if (!newDiscount.empleado_id || newDiscount.monto <= 0) {
      toast({ title: 'Error', description: 'Complete los campos del descuento', variant: 'destructive' });
      return;
    }
    setAdditionalDiscounts(prev => [...prev, { ...newDiscount }]);
    setNewDiscount({ empleado_id: '', tipo: 'otros_descuentos', descripcion: '', monto: 0 });
    setShowDiscountForm(false);
    toast({ title: 'Descuento Agregado', description: 'Se agregó el descuento adicional' });
  };

  const removeAdditionalDiscount = (index: number) => {
    setAdditionalDiscounts(prev => prev.filter((_, i) => i !== index));
  };

  // Helper to get employee name from result or detail map
  const getEmpName = (id: string): string => {
    return employeeDetailMap[id]?.nombre || id.substring(0, 8) + '...';
  };

  const getEmpCode = (id: string): string => {
    return employeeDetailMap[id]?.codigo || id.substring(0, 8);
  };

  // Filtered employees for step 2
  const filteredEmpleados = empleados.filter(e => {
    const searchLower = employeeSearch.toLowerCase();
    if (!searchLower) return true;
    return (
      e.nombre.toLowerCase().includes(searchLower) ||
      e.apellido.toLowerCase().includes(searchLower) ||
      e.codigo.toLowerCase().includes(searchLower) ||
      (e.area || '').toLowerCase().includes(searchLower)
    );
  });

  // Group incidences by type for step 3
  const incidencesByType = incidencias.reduce<Record<string, IncidenceInfo[]>>((acc, inc) => {
    if (!acc[inc.tipo]) acc[inc.tipo] = [];
    acc[inc.tipo].push(inc);
    return acc;
  }, {});

  // Get months with existing planillas for step 1
  const getPlanillaMonths = (): Set<string> => {
    const months = new Set<string>();
    existingPlanillas.forEach(p => {
      try {
        const d = new Date(p.fecha_inicio);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.add(key);
      } catch {
        // ignore
      }
    });
    return months;
  };

  // ISR calculation helper for step 5
  const calculateISR = (rentaImponible: number, tramos: CalculationResult['parametros_utilizados']['tramos_isr']) => {
    for (const tramo of tramos) {
      if (rentaImponible >= tramo.desde) {
        const base = rentaImponible - tramo.desde;
        const isr = base * tramo.porcentaje + tramo.cuota_fija;
        if (!tramo.hasta || rentaImponible <= tramo.hasta) {
          return { tramo, base, isr: Math.max(0, isr) };
        }
      }
    }
    return null;
  };

  // ========== STEP RENDERERS ==========

  const renderStep1 = () => {
    const currentYear = new Date().getFullYear();
    const planillaMonths = getPlanillaMonths();
    const selectedMonth = fechaInicio ? (() => {
      try { return new Date(fechaInicio).getMonth(); } catch { return -1; }
    })() : -1;
    const selectedYear = fechaInicio ? (() => {
      try { return new Date(fechaInicio).getFullYear(); } catch { return currentYear; }
    })() : currentYear;

    const handleMonthClick = (monthIdx: number) => {
      const year = selectedYear;
      const m = String(monthIdx + 1).padStart(2, '0');
      if (tipo === 'MENSUAL') {
        setFechaInicio(`${year}-${m}-01`);
        const lastDay = new Date(year, monthIdx + 1, 0).getDate();
        setFechaFin(`${year}-${m}-${String(lastDay).padStart(2, '0')}`);
      } else {
        setFechaInicio(`${year}-${m}-01`);
        setFechaFin(`${year}-${m}-15`);
      }
    };

    return (
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base dark:text-slate-100">Seleccionar Período</CardTitle>
          <CardDescription className="dark:text-slate-400">Defina el rango de fechas y tipo de nómina</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Type selector */}
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Tipo de Nómina</Label>
            <div className="flex gap-2">
              {['MENSUAL', 'QUINCENAL'].map(t => (
                <Button
                  key={t}
                  variant={tipo === t ? 'default' : 'outline'}
                  className={tipo === t ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600' : 'dark:border-slate-600 dark:text-slate-300'}
                  onClick={() => setTipo(t)}
                >
                  {t === 'MENSUAL' ? '📋 Mensual' : '📅 Quincenal'}
                </Button>
              ))}
            </div>
          </div>

          {/* Year selector */}
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Año</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => {
                const newYear = selectedYear - 1;
                if (fechaInicio) {
                  const m = fechaInicio.substring(5, 7);
                  const d = fechaInicio.substring(8, 10);
                  setFechaInicio(`${newYear}-${m}-${d}`);
                  if (fechaFin) {
                    const mf = fechaFin.substring(5, 7);
                    const df = fechaFin.substring(8, 10);
                    setFechaFin(`${newYear}-${mf}-${df}`);
                  }
                }
              }} className="dark:border-slate-600 dark:text-slate-300">
                ←
              </Button>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-200 min-w-[60px] text-center">{selectedYear}</span>
              <Button variant="outline" size="sm" onClick={() => {
                const newYear = selectedYear + 1;
                if (fechaInicio) {
                  const m = fechaInicio.substring(5, 7);
                  const d = fechaInicio.substring(8, 10);
                  setFechaInicio(`${newYear}-${m}-${d}`);
                  if (fechaFin) {
                    const mf = fechaFin.substring(5, 7);
                    const df = fechaFin.substring(8, 10);
                    setFechaFin(`${newYear}-${mf}-${df}`);
                  }
                }
              }} className="dark:border-slate-600 dark:text-slate-300">
                →
              </Button>
            </div>
          </div>

          {/* Month cards grid */}
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Seleccione el Mes</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {MONTHS_ES.map((month, idx) => {
                const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
                const hasPlanilla = planillaMonths.has(monthKey);
                const isSelected = selectedMonth === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleMonthClick(idx)}
                    className={`relative p-3 rounded-lg border-2 text-center transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-md'
                        : hasPlanilla
                        ? 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className={`text-xs font-semibold block ${
                      isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {month.substring(0, 3)}
                    </span>
                    {hasPlanilla && (
                      <span className="absolute top-1 right-1 flex items-center justify-center">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {planillaMonths.size > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" /> Meses con planilla existente
              </p>
            )}
          </div>

          {/* Custom date range */}
          <Separator className="dark:bg-slate-700" />
          <div className="space-y-2">
            <Label className="dark:text-slate-300 text-xs text-slate-500">O ingrese un rango personalizado:</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs dark:text-slate-400">Fecha Inicio</Label>
                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs dark:text-slate-400">Fecha Fin</Label>
                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700" />
              </div>
            </div>
          </div>

          {/* Period summary */}
          {fechaInicio && fechaFin && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">Resumen del Período</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">Desde</span>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">{new Date(fechaInicio).toLocaleDateString('es-SV')}</p>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">Hasta</span>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">{new Date(fechaFin).toLocaleDateString('es-SV')}</p>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">Tipo</span>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">{tipo === 'MENSUAL' ? 'Mensual' : 'Quincenal'}</p>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">Días</span>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">
                    {Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1}
                  </p>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">Empleados Activos</span>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">{empleados.length || '—'}</p>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">Incidencias Pendientes</span>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">{incidencias.length || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStep2 = () => {
    const totalBaseSalary = empleados.filter(e => selectedEmpleados.has(e.id)).reduce((sum, e) => sum + (e.salarioBase || 0), 0);
    const activeCount = selectedEmpleados.size;
    const missingIsss = empleados.filter(e => !e.tieneISSS).length;
    const missingAfp = empleados.filter(e => !e.tieneAFP).length;

    return (
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base dark:text-slate-100">Verificar Empleados</CardTitle>
              <CardDescription className="dark:text-slate-400">Confirmar empleados activos con contrato vigente</CardDescription>
            </div>
            {empleados.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllEmpleados} className="text-xs dark:border-slate-600 dark:text-slate-300">
                  Todos
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllEmpleados} className="text-xs dark:border-slate-600 dark:text-slate-300">
                  Ninguno
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">TOTAL ACTIVOS</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{empleados.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">SELECCIONADOS</p>
              <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">{activeCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">SIN ISSS</p>
              <p className="text-xl font-bold text-amber-800 dark:text-amber-200">{missingIsss}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">SIN AFP</p>
              <p className="text-xl font-bold text-amber-800 dark:text-amber-200">{missingAfp}</p>
            </div>
          </div>

          {/* Total salary */}
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-lg border border-teal-200 dark:border-teal-800 flex items-center justify-between">
            <span className="text-sm font-medium text-teal-800 dark:text-teal-300">Total Salarios Base (seleccionados)</span>
            <span className="text-lg font-bold text-teal-900 dark:text-teal-100">{fmt(totalBaseSalary)}</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, código o área..."
              value={employeeSearch}
              onChange={e => setEmployeeSearch(e.target.value)}
              className="pl-9 dark:bg-slate-800 dark:border-slate-700"
            />
          </div>

          {loadingData ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmpleados.length > 0 ? (
            <ScrollArea className="max-h-80">
              <div className="space-y-1.5 pr-2">
                {filteredEmpleados.map((emp, idx) => {
                  const isSelected = selectedEmpleados.has(emp.id);
                  const colorClass = avatarColors[idx % avatarColors.length];
                  return (
                    <div
                      key={emp.id}
                      onClick={() => toggleEmpleado(emp.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
                          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 opacity-60'
                      }`}
                    >
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colorClass}`}>
                        {getInitials(`${emp.nombre} ${emp.apellido}`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{emp.nombre} {emp.apellido}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{emp.codigo}</span>
                          {emp.area && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 dark:bg-slate-700 dark:text-slate-300">{emp.area}</Badge>
                          )}
                          {emp.tieneContrato && (
                            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="h-2.5 w-2.5" /> Contrato
                            </span>
                          )}
                          {!emp.tieneISSS && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-2.5 w-2.5" /> Sin ISSS
                            </span>
                          )}
                          {!emp.tieneAFP && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-2.5 w-2.5" /> Sin AFP
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {emp.salarioBase !== undefined && (
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fmt(emp.salarioBase)}</p>
                        )}
                      </div>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEmpleado(emp.id)}
                        className="shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-6 text-center">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {empleados.length === 0 ? 'Cargando empleados...' : 'No se encontraron empleados con ese filtro'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStep3 = () => {
    const selectedIncTotal = incidencias
      .filter(i => selectedIncidencias.has(i.id))
      .reduce((sum, i) => sum + i.monto, 0);
    const totalIncCount = incidencias.length;
    const selectedIncCount = selectedIncidencias.size;

    return (
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base dark:text-slate-100">Cargar Incidencias</CardTitle>
              <CardDescription className="dark:text-slate-400">Incidencias aprobadas del período a aplicar</CardDescription>
            </div>
            <Badge variant="secondary" className="dark:bg-slate-700 dark:text-slate-300">
              {selectedIncCount}/{totalIncCount} seleccionadas
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary bar */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Impacto financiero total (seleccionadas)</span>
            <span className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{fmt(selectedIncTotal)}</span>
          </div>

          {loadingData ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : incidencias.length === 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-sm text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                No hay incidencias aprobadas para este período. La planilla se calculará con salarios base únicamente.
              </div>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <p className="font-semibold dark:text-slate-300">Tipos de incidencia que se aplican automáticamente:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(INCIDENCE_TYPE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800">
                      <div className={`h-2.5 w-2.5 rounded-full ${INCIDENCE_TYPE_DOT[key] || 'bg-slate-400'}`} />
                      <span className="text-xs dark:text-slate-300">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-4 pr-2">
                {Object.entries(incidencesByType).map(([type, items]) => {
                  const typeTotal = items.reduce((s, i) => s + i.monto, 0);
                  const allSelected = items.every(i => selectedIncidencias.has(i.id));
                  const someSelected = items.some(i => selectedIncidencias.has(i.id));
                  const selectedTypeTotal = items.filter(i => selectedIncidencias.has(i.id)).reduce((s, i) => s + i.monto, 0);

                  return (
                    <div key={type} className="rounded-lg border dark:border-slate-700 overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                        onClick={() => {
                          items.forEach(i => {
                            if (allSelected) {
                              setSelectedIncidencias(prev => {
                                const next = new Set(prev);
                                next.delete(i.id);
                                return next;
                              });
                            } else {
                              setSelectedIncidencias(prev => {
                                const next = new Set(prev);
                                next.add(i.id);
                                return next;
                              });
                            }
                          });
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                            onCheckedChange={() => {}}
                          />
                          <div className={`h-2.5 w-2.5 rounded-full ${INCIDENCE_TYPE_DOT[type] || 'bg-slate-400'}`} />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {INCIDENCE_TYPE_LABELS[type] || type}
                          </span>
                          <Badge variant="secondary" className="text-[10px] dark:bg-slate-700 dark:text-slate-300">{items.length}</Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Impacto: </span>
                          <span className={`text-sm font-bold ${INCIDENCE_TYPE_DOT[type]?.includes('emerald') || INCIDENCE_TYPE_DOT[type]?.includes('teal') ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                            {fmt(selectedTypeTotal)}
                          </span>
                          {selectedTypeTotal !== typeTotal && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">/ {fmt(typeTotal)}</span>
                          )}
                        </div>
                      </div>
                      <div className="divide-y dark:divide-slate-700">
                        {items.map(inc => (
                          <div
                            key={inc.id}
                            className={`flex items-center justify-between p-2.5 pl-10 transition-colors ${
                              selectedIncidencias.has(inc.id) ? 'bg-white dark:bg-slate-800/50' : 'bg-slate-50/50 dark:bg-slate-900/50 opacity-50'
                            }`}
                            onClick={() => toggleIncidencia(inc.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{inc.empleado_nombre}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                {inc.descripcion || inc.tipo} {inc.horas ? `(${inc.horas}h)` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`text-[10px] ${INCIDENCE_TYPE_COLORS[inc.tipo] || 'bg-slate-100 text-slate-600'}`}>
                                {fmt(inc.monto)}
                              </Badge>
                              <Checkbox
                                checked={selectedIncidencias.has(inc.id)}
                                onCheckedChange={() => toggleIncidencia(inc.id)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStep4 = () => {
    if (!result) {
      return (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-base dark:text-slate-100">Salarios Brutos</CardTitle>
            <CardDescription className="dark:text-slate-400">Salario base + incidencias remunerativas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm space-y-3 dark:text-slate-300">
              <p className="font-semibold dark:text-slate-200">Fórmula de Cálculo:</p>
              <div className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-3 rounded-lg space-y-1">
                <p>Salario Bruto = Salario Base</p>
                <p className="text-emerald-600 dark:text-emerald-400 pl-4">+ Horas Extra (tarifa × horas × multiplicador)</p>
                <p className="text-emerald-600 dark:text-emerald-400 pl-4">+ Comisiones</p>
                <p className="text-emerald-600 dark:text-emerald-400 pl-4">+ Bonos</p>
              </div>
              <Separator className="dark:bg-slate-700" />
              <div className="space-y-2 text-xs">
                <p className="font-medium dark:text-slate-300">Multiplicadores de Horas Extra (Art. 169 CT):</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border dark:border-slate-700">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span>Diurna: ×2.0</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border dark:border-slate-700">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Nocturna: ×2.5</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border dark:border-slate-700">
                    <Clock className="h-3.5 w-3.5 text-orange-500" />
                    <span>Descanso: ×3.0</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border dark:border-slate-700">
                    <Clock className="h-3.5 w-3.5 text-red-500" />
                    <span>Asueto: ×3.0</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const totalBase = result.detalles.reduce((s, d) => s + d.salario_base, 0);
    const totalHE = result.detalles.reduce((s, d) => s + d.total_horas_extra, 0);
    const totalCom = result.detalles.reduce((s, d) => s + d.total_comisiones, 0);
    const totalBon = result.detalles.reduce((s, d) => s + d.total_bonos, 0);
    const totalBruto = result.planilla.total_salarios_brutos;

    return (
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base dark:text-slate-100">Salarios Brutos — Detalle por Empleado</CardTitle>
          <CardDescription className="dark:text-slate-400">Desglose de salario base + incidencias remunerativas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center border dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Base</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(totalBase)}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-center border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] text-amber-600 dark:text-amber-400">H. Extra</p>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">{fmt(totalHE)}</p>
            </div>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-center border border-teal-200 dark:border-teal-800">
              <p className="text-[10px] text-teal-600 dark:text-teal-400">Comisiones</p>
              <p className="text-sm font-bold text-teal-800 dark:text-teal-200">{fmt(totalCom)}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-center border border-emerald-200 dark:border-emerald-800">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Bonos</p>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">{fmt(totalBon)}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-center border border-slate-300 dark:border-slate-600">
              <p className="text-[10px] text-slate-600 dark:text-slate-300">TOTAL BRUTO</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmt(totalBruto)}</p>
            </div>
          </div>

          {/* Table */}
          <ScrollArea className="max-h-80">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-slate-700">
                  <TableHead className="dark:text-slate-400">Empleado</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Salario Base</TableHead>
                  <TableHead className="text-right dark:text-slate-400">H. Extra</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Comisiones</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Bonos</TableHead>
                  <TableHead className="text-right dark:text-slate-400 font-bold">Salario Bruto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.detalles.map(d => (
                  <TableRow key={d.empleado_id} className="dark:border-slate-700">
                    <TableCell className="font-medium dark:text-slate-200">
                      <div>
                        <p className="text-xs">{getEmpName(d.empleado_id)}</p>
                        <p className="text-[10px] font-mono text-slate-400">{getEmpCode(d.empleado_id)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right dark:text-slate-300">{fmt(d.salario_base)}</TableCell>
                    <TableCell className="text-right">
                      {d.total_horas_extra > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{fmt(d.total_horas_extra)}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.total_comisiones > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{fmt(d.total_comisiones)}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.total_bonos > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{fmt(d.total_bonos)}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-800 dark:text-slate-100">{fmt(d.salario_bruto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="dark:border-slate-700">
                  <TableCell className="font-bold dark:text-slate-200">TOTALES</TableCell>
                  <TableCell className="text-right font-bold dark:text-slate-200">{fmt(totalBase)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalHE)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalCom)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalBon)}</TableCell>
                  <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">{fmt(totalBruto)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const renderStep5 = () => {
    const params = result?.parametros_utilizados;
    const defaultTramos = [
      { numero_tramo: 1, desde: 0.01, hasta: 472.00, porcentaje: 0, cuota_fija: 0 },
      { numero_tramo: 2, desde: 472.01, hasta: 895.24, porcentaje: 0.10, cuota_fija: 17.67 },
      { numero_tramo: 3, desde: 895.25, hasta: 2038.10, porcentaje: 0.20, cuota_fija: 60.00 },
      { numero_tramo: 4, desde: 2038.11, hasta: null, porcentaje: 0.30, cuota_fija: 288.57 },
    ];

    if (!result) {
      return (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-base dark:text-slate-100">Deducciones Legales</CardTitle>
            <CardDescription className="dark:text-slate-400">ISSS, AFP e ISR según parámetros legales vigentes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ISSS */}
            <div className="p-4 rounded-lg border dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">ISSS Laboral</h4>
              </div>
              <div className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-3 rounded space-y-1">
                <p>ISSS = MIN(Salario Bruto, $1,000.00) × 3.00%</p>
                <p className="text-slate-500 dark:text-slate-400">Tope máximo: $1,000.00 × 3.00% = <strong>$30.00/mes</strong></p>
              </div>
            </div>

            {/* AFP */}
            <div className="p-4 rounded-lg border dark:border-slate-700 bg-orange-50/50 dark:bg-orange-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300">AFP Laboral</h4>
              </div>
              <div className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-3 rounded space-y-1">
                <p>AFP = Salario Bruto × 7.25%</p>
                <p className="text-slate-500 dark:text-slate-400">Sin tope máximo — aplica sobre el 100% del salario bruto</p>
              </div>
            </div>

            {/* Renta Imponible */}
            <div className="p-4 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Renta Imponible</h4>
              </div>
              <div className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-3 rounded">
                <p>Renta Imponible = Salario Bruto − ISSS Laboral − AFP Laboral</p>
              </div>
            </div>

            {/* ISR */}
            <div className="p-4 rounded-lg border dark:border-slate-700 bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="h-4 w-4 text-red-600 dark:text-red-400" />
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">ISR — Impuesto Sobre la Renta</h4>
              </div>
              <div className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-3 rounded space-y-2">
                <p>ISR = (Renta Imponible − Desde) × % Tramo + Cuota Fija</p>
                <Separator className="dark:bg-slate-700" />
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th className="text-left p-1">Tramo</th>
                      <th className="text-right p-1">Desde</th>
                      <th className="text-right p-1">Hasta</th>
                      <th className="text-right p-1">%</th>
                      <th className="text-right p-1">Cuota Fija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaultTramos.map(t => (
                      <tr key={t.numero_tramo} className="dark:text-slate-300">
                        <td className="p-1 font-medium">{t.numero_tramo}</td>
                        <td className="p-1 text-right">{fmt(t.desde)}</td>
                        <td className="p-1 text-right">{t.hasta ? fmt(t.hasta) : '∞'}</td>
                        <td className="p-1 text-right">{fmtPct(t.porcentaje)}</td>
                        <td className="p-1 text-right">{fmt(t.cuota_fija)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // With calculation results
    const tramos = params?.tramos_isr || defaultTramos;
    const totalIsss = result.planilla.total_isss_laboral;
    const totalAfp = result.planilla.total_afp_laboral;
    const totalIsr = result.planilla.total_isr_retenido;

    return (
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base dark:text-slate-100">Deducciones Legales — Detalle por Empleado</CardTitle>
          <CardDescription className="dark:text-slate-400">ISSS, AFP e ISR calculados según parámetros vigentes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary boxes */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">ISSS LABORAL</p>
              <p className="text-lg font-bold text-amber-800 dark:text-amber-200">{fmt(totalIsss)}</p>
              <p className="text-[10px] text-amber-500">{params ? fmtPct(params.tasa_isss_laboral) : '3.00%'} hasta {params ? fmt(params.tope_isss) : '$1,000.00'}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-center">
              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">AFP LABORAL</p>
              <p className="text-lg font-bold text-orange-800 dark:text-orange-200">{fmt(totalAfp)}</p>
              <p className="text-[10px] text-orange-500">{params ? fmtPct(params.tasa_afp_laboral) : '7.25%'} sin tope</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-center">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">ISR</p>
              <p className="text-lg font-bold text-red-800 dark:text-red-200">{fmt(totalIsr)}</p>
              <p className="text-[10px] text-red-500">4 tramos progresivos</p>
            </div>
          </div>

          {/* Detailed table with step-by-step ISR */}
          <ScrollArea className="max-h-80">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-slate-700">
                  <TableHead className="dark:text-slate-400">Empleado</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Bruto</TableHead>
                  <TableHead className="text-right dark:text-slate-400">ISSS</TableHead>
                  <TableHead className="text-right dark:text-slate-400">AFP</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Renta Imp.</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Tramo ISR</TableHead>
                  <TableHead className="text-right dark:text-slate-400">ISR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.detalles.map(d => {
                  const isrCalc = calculateISR(d.renta_imponible, tramos);
                  return (
                    <TableRow key={d.empleado_id} className="dark:border-slate-700">
                      <TableCell className="font-medium dark:text-slate-200">
                        <div>
                          <p className="text-xs">{getEmpName(d.empleado_id)}</p>
                          <p className="text-[10px] font-mono text-slate-400">{getEmpCode(d.empleado_id)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right dark:text-slate-300">{fmt(d.salario_bruto)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">-{fmt(d.isss_laboral)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">-{fmt(d.afp_laboral)}</TableCell>
                      <TableCell className="text-right dark:text-slate-300">{fmt(d.renta_imponible)}</TableCell>
                      <TableCell className="text-right">
                        {isrCalc ? (
                          <Badge variant="outline" className="text-[10px] dark:border-slate-600 dark:text-slate-300">
                            T{isrCalc.tramo.numero_tramo} ({fmtPct(isrCalc.tramo.porcentaje)})
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400">Exento</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 font-medium">-{fmt(d.isr_retenido)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="dark:border-slate-700">
                  <TableCell className="font-bold dark:text-slate-200">TOTALES</TableCell>
                  <TableCell className="text-right font-bold dark:text-slate-200">{fmt(result.planilla.total_salarios_brutos)}</TableCell>
                  <TableCell className="text-right font-bold text-red-600 dark:text-red-400">{fmt(totalIsss)}</TableCell>
                  <TableCell className="text-right font-bold text-red-600 dark:text-red-400">{fmt(totalAfp)}</TableCell>
                  <TableCell className="text-right font-bold dark:text-slate-300">{fmt(result.detalles.reduce((s, d) => s + d.renta_imponible, 0))}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold text-red-600 dark:text-red-400">{fmt(totalIsr)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollArea>

          {/* ISR formula breakdown for first employee with ISR */}
          {(() => {
            const d = result.detalles.find(det => det.isr_retenido > 0);
            if (!d || !params) return null;
            const isrCalc = calculateISR(d.renta_imponible, tramos);
            if (!isrCalc) return null;
            return (
              <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" /> Ejemplo de cálculo ISR — {getEmpName(d.empleado_id)}
                </h4>
                <div className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-3 rounded space-y-1">
                  <p>1. Renta Imponible = {fmt(d.salario_bruto)} − {fmt(d.isss_laboral)} − {fmt(d.afp_laboral)} = <strong>{fmt(d.renta_imponible)}</strong></p>
                  <p>2. Tramo aplicable: Tramo {isrCalc.tramo.numero_tramo} (desde {fmt(isrCalc.tramo.desde)}{isrCalc.tramo.hasta ? ` hasta ${fmt(isrCalc.tramo.hasta)}` : ' en adelante'})</p>
                  <p>3. Base = {fmt(d.renta_imponible)} − {fmt(isrCalc.tramo.desde)} = <strong>{fmt(isrCalc.base)}</strong></p>
                  <p>4. ISR = {fmt(isrCalc.base)} × {fmtPct(isrCalc.tramo.porcentaje)} + {fmt(isrCalc.tramo.cuota_fija)} = <strong className="text-red-600 dark:text-red-400">{fmt(isrCalc.isr)}</strong></p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    );
  };

  const renderStep6 = () => {
    if (!result) {
      return (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-base dark:text-slate-100">Descuentos Adicionales</CardTitle>
            <CardDescription className="dark:text-slate-400">Cuota alimenticia, préstamos, seguros y otros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm space-y-3 dark:text-slate-300">
              <p className="font-semibold dark:text-slate-200">Prioridad de aplicación de descuentos:</p>
              <div className="space-y-2">
                {[
                  { num: 1, label: 'Cuota Alimenticia', desc: 'Mayor prioridad — orden judicial', icon: Scale },
                  { num: 2, label: 'Préstamo Patronal', desc: 'Descuento autorizado por empleado', icon: Building2 },
                  { num: 3, label: 'Seguro Complementario', desc: 'Seguro voluntario del empleado', icon: Shield },
                  { num: 4, label: 'Otros Descuentos', desc: 'Cualquier otro descuento autorizado', icon: Calculator },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.num} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded border dark:border-slate-700">
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-bold shrink-0">
                        {item.num}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          <span className="font-medium text-xs dark:text-slate-200">{item.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const totalCuota = result.detalles.reduce((s, d) => s + d.cuota_alimenticia, 0);
    const totalPrestamo = result.detalles.reduce((s, d) => s + d.prestamo_patronal, 0);
    const totalSeguro = result.detalles.reduce((s, d) => s + d.seguro_complementario, 0);
    const totalOtros = result.detalles.reduce((s, d) => s + d.otros_descuentos, 0);

    const employeesWithDiscounts = result.detalles.filter(
      d => d.cuota_alimenticia > 0 || d.prestamo_patronal > 0 || d.seguro_complementario > 0 || d.otros_descuentos > 0
    );

    return (
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base dark:text-slate-100">Descuentos Adicionales</CardTitle>
              <CardDescription className="dark:text-slate-400">Descuentos especiales aplicados por empleado</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiscountForm(!showDiscountForm)}
              className="dark:border-slate-600 dark:text-slate-300"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar Descuento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add discount form */}
          {showDiscountForm && (
            <div className="p-4 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800 space-y-3">
              <h4 className="text-sm font-semibold text-violet-800 dark:text-violet-300">Nuevo Descuento</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs dark:text-slate-400">Empleado</Label>
                  <select
                    value={newDiscount.empleado_id}
                    onChange={e => setNewDiscount(prev => ({ ...prev, empleado_id: e.target.value }))}
                    className="w-full text-sm border rounded-md p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  >
                    <option value="">Seleccionar...</option>
                    {result.detalles.map(d => (
                      <option key={d.empleado_id} value={d.empleado_id}>{getEmpName(d.empleado_id)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs dark:text-slate-400">Tipo</Label>
                  <select
                    value={newDiscount.tipo}
                    onChange={e => setNewDiscount(prev => ({ ...prev, tipo: e.target.value as AdditionalDiscount['tipo'] }))}
                    className="w-full text-sm border rounded-md p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  >
                    <option value="cuota_alimenticia">Cuota Alimenticia</option>
                    <option value="prestamo_patronal">Préstamo Patronal</option>
                    <option value="seguro_complementario">Seguro Complementario</option>
                    <option value="otros_descuentos">Otros Descuentos</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs dark:text-slate-400">Descripción</Label>
                  <Input
                    value={newDiscount.descripcion}
                    onChange={e => setNewDiscount(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Motivo del descuento"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs dark:text-slate-400">Monto ($)</Label>
                  <Input
                    type="number"
                    value={newDiscount.monto || ''}
                    onChange={e => setNewDiscount(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowDiscountForm(false)} className="dark:border-slate-600 dark:text-slate-300">
                  Cancelar
                </Button>
                <Button size="sm" onClick={addAdditionalDiscount} className="bg-violet-600 hover:bg-violet-700">
                  Agregar
                </Button>
              </div>
            </div>
          )}

          {/* Additional discounts list */}
          {additionalDiscounts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">Descuentos Agregados Manualmente</h4>
              {additionalDiscounts.map((disc, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800">
                  <div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{getEmpName(disc.empleado_id)}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{disc.tipo.replace(/_/g, ' ')} — {disc.descripcion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-violet-700 dark:text-violet-300">{fmt(disc.monto)}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeAdditionalDiscount(idx)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-center border border-violet-200 dark:border-violet-800">
              <p className="text-[10px] text-violet-600 dark:text-violet-400">Cuota Alimenticia</p>
              <p className="text-sm font-bold text-violet-800 dark:text-violet-200">{fmt(totalCuota)}</p>
            </div>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-center border border-rose-200 dark:border-rose-800">
              <p className="text-[10px] text-rose-600 dark:text-rose-400">Préstamo</p>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-200">{fmt(totalPrestamo)}</p>
            </div>
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-center border border-cyan-200 dark:border-cyan-800">
              <p className="text-[10px] text-cyan-600 dark:text-cyan-400">Seguro</p>
              <p className="text-sm font-bold text-cyan-800 dark:text-cyan-200">{fmt(totalSeguro)}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center border dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Otros</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(totalOtros)}</p>
            </div>
          </div>

          {/* Table */}
          {employeesWithDiscounts.length > 0 ? (
            <ScrollArea className="max-h-60">
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-slate-700">
                    <TableHead className="dark:text-slate-400">Empleado</TableHead>
                    <TableHead className="text-right dark:text-slate-400">Cuota Alim.</TableHead>
                    <TableHead className="text-right dark:text-slate-400">Préstamo</TableHead>
                    <TableHead className="text-right dark:text-slate-400">Seguro</TableHead>
                    <TableHead className="text-right dark:text-slate-400">Otros</TableHead>
                    <TableHead className="text-right dark:text-slate-400 font-bold">Total Desc.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesWithDiscounts.map(d => (
                    <TableRow key={d.empleado_id} className="dark:border-slate-700">
                      <TableCell className="font-medium dark:text-slate-200 text-xs">{getEmpName(d.empleado_id)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">{d.cuota_alimenticia > 0 ? fmt(d.cuota_alimenticia) : '—'}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">{d.prestamo_patronal > 0 ? fmt(d.prestamo_patronal) : '—'}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">{d.seguro_complementario > 0 ? fmt(d.seguro_complementario) : '—'}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">{d.otros_descuentos > 0 ? fmt(d.otros_descuentos) : '—'}</TableCell>
                      <TableCell className="text-right font-bold text-red-700 dark:text-red-300 text-xs">{fmt(d.cuota_alimenticia + d.prestamo_patronal + d.seguro_complementario + d.otros_descuentos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="p-4 text-center bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">Sin descuentos adicionales</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Ningún empleado tiene descuentos especiales en este período</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStep7 = () => {
    if (!result) {
      return (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-base dark:text-slate-100">Salarios Netos</CardTitle>
            <CardDescription className="dark:text-slate-400">Resultado final después de todas las deducciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm space-y-3 dark:text-slate-300">
              <p className="font-semibold dark:text-slate-200">Fórmula de Salario Neto:</p>
              <div className="font-mono text-xs bg-white dark:bg-slate-900 dark:border dark:border-slate-700 p-3 rounded space-y-1">
                <p>Neto = Salario Bruto</p>
                <p className="text-red-600 dark:text-red-400 pl-4">− ISSS Laboral</p>
                <p className="text-red-600 dark:text-red-400 pl-4">− AFP Laboral</p>
                <p className="text-red-600 dark:text-red-400 pl-4">− ISR Retenido</p>
                <p className="text-red-600 dark:text-red-400 pl-4">− Cuota Alimenticia</p>
                <p className="text-red-600 dark:text-red-400 pl-4">− Préstamo Patronal</p>
                <p className="text-red-600 dark:text-red-400 pl-4">− Seguro Complementario</p>
                <p className="text-red-600 dark:text-red-400 pl-4">− Otros Descuentos</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                Si el salario neto resulta ≤ $0.00, se generará una anomalía de severidad ALTA.
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const totalBruto = result.planilla.total_salarios_brutos;
    const totalNeto = result.planilla.total_neto_a_pagar;
    const totalDesc = result.planilla.total_descuentos;
    const isss = result.planilla.total_isss_laboral;
    const afp = result.planilla.total_afp_laboral;
    const isr = result.planilla.total_isr_retenido;
    const otros = totalDesc - isss - afp - isr;

    return (
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base dark:text-slate-100">Salarios Netos — Resultado Final</CardTitle>
          <CardDescription className="dark:text-slate-400">Desglose completo: Bruto − Deducciones = Neto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Big summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">TOTAL BRUTO</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{fmt(totalBruto)}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20 border border-red-200 dark:border-red-800 text-center">
              <p className="text-[10px] font-medium text-red-600 dark:text-red-400">TOTAL DEDUCCIONES</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">-{fmt(totalDesc)}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/40 dark:to-teal-900/20 border border-teal-200 dark:border-teal-800 text-center">
              <p className="text-[10px] font-medium text-teal-600 dark:text-teal-400">TOTAL NETO</p>
              <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">{fmt(totalNeto)}</p>
            </div>
          </div>

          {/* Distribution bar chart */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Distribución del Salario Bruto</p>
            <div className="flex rounded-lg overflow-hidden h-10">
              {(() => {
                const bruto = totalBruto || 1;
                const segments = [
                  { label: 'Neto', value: totalNeto, color: 'bg-emerald-500 dark:bg-emerald-400' },
                  { label: 'ISSS', value: isss, color: 'bg-amber-400 dark:bg-amber-500' },
                  { label: 'AFP', value: afp, color: 'bg-orange-400 dark:bg-orange-500' },
                  { label: 'ISR', value: isr, color: 'bg-red-400 dark:bg-red-500' },
                  { label: 'Otros', value: Math.max(0, otros), color: 'bg-slate-400 dark:bg-slate-500' },
                ];
                return segments.map(s => (
                  <div
                    key={s.label}
                    className={`${s.color} transition-all duration-500 flex items-center justify-center`}
                    style={{ width: `${Math.max((s.value / bruto) * 100, 0.5)}%` }}
                    title={`${s.label}: ${fmt(s.value)}`}
                  >
                    {(s.value / bruto) * 100 > 6 && (
                      <span className="text-[9px] font-bold text-white drop-shadow-sm">{s.label} {Math.round((s.value / bruto) * 100)}%</span>
                    )}
                  </div>
                ));
              })()}
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Neto', value: totalNeto, color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'ISSS', value: isss, color: 'bg-amber-400', textColor: 'text-amber-700 dark:text-amber-300' },
                { label: 'AFP', value: afp, color: 'bg-orange-400', textColor: 'text-orange-700 dark:text-orange-300' },
                { label: 'ISR', value: isr, color: 'bg-red-400', textColor: 'text-red-700 dark:text-red-300' },
                { label: 'Otros Desc.', value: Math.max(0, otros), color: 'bg-slate-400', textColor: 'text-slate-600 dark:text-slate-300' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
                  <span className={`text-xs font-medium ${s.textColor}`}>
                    {s.label}: {fmt(s.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-employee net salary table */}
          <ScrollArea className="max-h-72">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-slate-700">
                  <TableHead className="dark:text-slate-400">Empleado</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Bruto</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Deducciones</TableHead>
                  <TableHead className="text-right dark:text-slate-400 font-bold">Neto</TableHead>
                  <TableHead className="text-right dark:text-slate-400">Barra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.detalles.map(d => {
                  const netPct = d.salario_bruto > 0 ? (d.salario_neto / d.salario_bruto) * 100 : 0;
                  return (
                    <TableRow key={d.empleado_id} className="dark:border-slate-700">
                      <TableCell className="font-medium dark:text-slate-200">
                        <div>
                          <p className="text-xs">{getEmpName(d.empleado_id)}</p>
                          <p className="text-[10px] font-mono text-slate-400">{getEmpCode(d.empleado_id)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right dark:text-slate-300 text-xs">{fmt(d.salario_bruto)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">-{fmt(d.total_descuentos)}</TableCell>
                      <TableCell className={`text-right font-bold text-xs ${d.salario_neto > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {fmt(d.salario_neto)}
                      </TableCell>
                      <TableCell className="text-right w-24">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${d.salario_neto > 0 ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500'}`}
                              style={{ width: `${Math.max(0, Math.min(100, netPct))}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 w-8 text-right">{Math.round(netPct)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="dark:border-slate-700">
                  <TableCell className="font-bold dark:text-slate-200">TOTALES</TableCell>
                  <TableCell className="text-right font-bold dark:text-slate-200">{fmt(totalBruto)}</TableCell>
                  <TableCell className="text-right font-bold text-red-600 dark:text-red-400">-{fmt(totalDesc)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">{fmt(totalNeto)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const renderStep8 = () => (
    <div className="space-y-4">
      {result ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 overflow-hidden relative">
              <div className="absolute top-2 right-2 opacity-10">
                <DollarSign className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Total Bruto</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{fmt(result.planilla.total_salarios_brutos)}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20 overflow-hidden relative">
              <div className="absolute top-2 right-2 opacity-10">
                <Minus className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-red-700 dark:text-red-300">Total Deducciones</p>
                <p className="text-xl font-bold text-red-900 dark:text-red-100">-{fmt(result.planilla.total_descuentos)}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/40 dark:to-teal-900/20 overflow-hidden relative">
              <div className="absolute top-2 right-2 opacity-10">
                <CheckCircle className="h-12 w-12 text-teal-600 dark:text-teal-400" />
              </div>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">Total Neto</p>
                <p className="text-xl font-bold text-teal-900 dark:text-teal-100">{fmt(result.planilla.total_neto_a_pagar)}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/60 dark:to-slate-700/30 overflow-hidden relative">
              <div className="absolute top-2 right-2 opacity-10">
                <Shield className="h-12 w-12 text-slate-500 dark:text-slate-400" />
              </div>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Cargas Patronales</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmt(result.planilla.total_cargas_patronales)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Visual Breakdown */}
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base dark:text-slate-100">Desglose Visual de Deducciones</CardTitle>
              <CardDescription className="dark:text-slate-400">Distribución del salario bruto en conceptos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const bruto = result.planilla.total_salarios_brutos || 1;
                const neto = result.planilla.total_neto_a_pagar;
                const isss = result.planilla.total_isss_laboral;
                const afp = result.planilla.total_afp_laboral;
                const isr = result.planilla.total_isr_retenido;
                const otros = result.planilla.total_descuentos - isss - afp - isr;

                const segments = [
                  { label: 'Neto', value: neto, color: 'bg-emerald-500 dark:bg-emerald-400', textColor: 'text-emerald-700 dark:text-emerald-300' },
                  { label: 'ISSS', value: isss, color: 'bg-amber-400 dark:bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300' },
                  { label: 'AFP', value: afp, color: 'bg-orange-400 dark:bg-orange-500', textColor: 'text-orange-700 dark:text-orange-300' },
                  { label: 'ISR', value: isr, color: 'bg-red-400 dark:bg-red-500', textColor: 'text-red-700 dark:text-red-300' },
                  { label: 'Otros Desc.', value: Math.max(0, otros), color: 'bg-slate-400 dark:bg-slate-500', textColor: 'text-slate-600 dark:text-slate-300' },
                ];

                return (
                  <>
                    <div className="flex rounded-lg overflow-hidden h-8">
                      {segments.map(s => (
                        <div
                          key={s.label}
                          className={`${s.color} transition-all duration-500 flex items-center justify-center`}
                          style={{ width: `${Math.max((s.value / bruto) * 100, 0.5)}%` }}
                          title={`${s.label}: ${fmt(s.value)}`}
                        >
                          {(s.value / bruto) * 100 > 8 && (
                            <span className="text-[10px] font-bold text-white drop-shadow-sm">{Math.round((s.value / bruto) * 100)}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {segments.map(s => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          <div className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
                          <span className={`text-xs font-medium ${s.textColor}`}>
                            {s.label}: {fmt(s.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Legal Compliance Summary */}
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
                <Scale className="h-4 w-4" /> Cumplimiento Legal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: 'ISSS Laboral (3%)', ok: true, detail: `${fmt(result.planilla.total_isss_laboral)} retenido` },
                  { label: 'ISSS Patronal (7.5%)', ok: true, detail: `${fmt(result.planilla.total_isss_patronal)} aportado` },
                  { label: 'AFP Laboral (7.25%)', ok: true, detail: `${fmt(result.planilla.total_afp_laboral)} retenido` },
                  { label: 'AFP Patronal (8.75%)', ok: true, detail: `${fmt(result.planilla.total_afp_patronal)} aportado` },
                  { label: 'ISR (Tramos progresivos)', ok: true, detail: `${fmt(result.planilla.total_isr_retenido)} retenido` },
                  { label: 'INSAFORP (1%)', ok: result.planilla.insaforp !== undefined, detail: result.planilla.insaforp ? `${fmt(result.planilla.insaforp)}` : 'N/A' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-700">
                    <CheckCircle className={`h-4 w-4 shrink-0 ${item.ok ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Anomaly Warnings */}
          {result.anomalies.length > 0 && (
            <Card className="shadow-sm border-amber-200 dark:border-amber-800 dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertOctagon className="h-4 w-4" /> Anomalías Detectadas ({result.anomalies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {result.anomalies.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                      a.severidad === 'ALTA'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{a.tipo.replace(/_/g, ' ')}</p>
                        <p>{a.empleado_nombre}: {a.detalle}</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ml-auto shrink-0 ${
                        a.severidad === 'ALTA'
                          ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
                          : 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'
                      }`}>
                        {a.severidad}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confirmation Checklist */}
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
                <CheckCheck className="h-4 w-4" /> Lista de Verificación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  `Headcount verificado: ${result.planilla.total_empleados} empleados`,
                  'Cálculos de ISR validados con tramos vigentes',
                  'Incidencias revisadas y aplicadas',
                  'Retenciones previsionales (ISSS/AFP) verificadas',
                  result.anomalies.length === 0 ? 'Sin anomalías detectadas' : `${result.anomalies.length} anomalía(s) requieren atención`,
                  'Totales cuadran con período',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <CheckCircle className={`h-4 w-4 shrink-0 ${
                      item.includes('anomalía') && !item.includes('Sin') ? 'text-amber-500' : 'text-emerald-500'
                    }`} />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Employee details table */}
          <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base dark:text-slate-100">Detalle por Empleado</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCSV} className="dark:border-slate-600 dark:text-slate-300">
                  <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                      <TableHead className="w-8 dark:text-slate-400"></TableHead>
                      <TableHead className="dark:text-slate-400">Empleado</TableHead>
                      <TableHead className="text-right dark:text-slate-400">Salario Base</TableHead>
                      <TableHead className="text-right dark:text-slate-400">Bruto</TableHead>
                      <TableHead className="text-right dark:text-slate-400">ISSS</TableHead>
                      <TableHead className="text-right dark:text-slate-400">AFP</TableHead>
                      <TableHead className="text-right dark:text-slate-400">ISR</TableHead>
                      <TableHead className="text-right dark:text-slate-400">Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.detalles.map(d => (
                      <React.Fragment key={d.empleado_id}>
                        <TableRow
                          className="cursor-pointer transition-colors dark:border-slate-700"
                          onClick={() => setExpandedRow(expandedRow === d.empleado_id ? null : d.empleado_id)}
                        >
                          <TableCell className="dark:text-slate-400">
                            {expandedRow === d.empleado_id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </TableCell>
                          <TableCell className="font-medium dark:text-slate-200">
                            <div>
                              <p className="text-xs">{getEmpName(d.empleado_id)}</p>
                              <p className="text-[10px] font-mono text-slate-400">{getEmpCode(d.empleado_id)}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right dark:text-slate-300 text-xs">{fmt(d.salario_base)}</TableCell>
                          <TableCell className="text-right font-medium dark:text-slate-200 text-xs">{fmt(d.salario_bruto)}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">-{fmt(d.isss_laboral)}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">-{fmt(d.afp_laboral)}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400 text-xs">-{fmt(d.isr_retenido)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400 text-xs">{fmt(d.salario_neto)}</TableCell>
                        </TableRow>
                        {expandedRow === d.empleado_id && (
                          <TableRow className="dark:border-slate-700">
                            <TableCell colSpan={8} className="bg-slate-50/50 dark:bg-slate-800/50 p-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div><span className="text-slate-500 dark:text-slate-400">Horas Extra:</span> <span className="font-medium dark:text-slate-200">{fmt(d.total_horas_extra)}</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400">Comisiones:</span> <span className="font-medium dark:text-slate-200">{fmt(d.total_comisiones)}</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400">Bonos:</span> <span className="font-medium dark:text-slate-200">{fmt(d.total_bonos)}</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400">Renta Imponible:</span> <span className="font-medium dark:text-slate-200">{fmt(d.renta_imponible)}</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400">Cuota Alimenticia:</span> <span className="font-medium dark:text-slate-200">{fmt(d.cuota_alimenticia)}</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400">Préstamo:</span> <span className="font-medium dark:text-slate-200">{fmt(d.prestamo_patronal)}</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400">Seguro:</span> <span className="font-medium dark:text-slate-200">{fmt(d.seguro_complementario)}</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400">Otros Desc:</span> <span className="font-medium dark:text-slate-200">{fmt(d.otros_descuentos)}</span></div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <CardContent className="p-8 text-center">
            <Calculator className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">Ejecute el cálculo para ver resultados</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Complete los pasos anteriores y presione &quot;Ejecutar Cálculo&quot;</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Step Indicator */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start min-w-max">
          {STEPS.map((s, i) => {
            const isCompleted = completedSteps.has(s.num);
            const isActive = step === s.num;
            const isPending = !isCompleted && step < s.num;
            const isClickable = isCompleted || s.num <= step;
            const Icon = s.icon;

            return (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => goToStep(s.num)}
                  disabled={!isClickable}
                  className={`flex flex-col items-center gap-1.5 group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`relative flex items-center justify-center h-9 w-9 rounded-full transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-500 dark:bg-emerald-600 shadow-md shadow-emerald-200 dark:shadow-emerald-900/50'
                      : isActive
                      ? 'bg-amber-500 dark:bg-amber-600 shadow-lg shadow-amber-200 dark:shadow-amber-900/50'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4.5 w-4.5 text-white" />
                    ) : isActive ? (
                      <>
                        <span className="absolute h-9 w-9 rounded-full bg-amber-400 animate-ping opacity-30" />
                        <span className="relative text-white text-sm font-bold">{s.num}</span>
                      </>
                    ) : isPending ? (
                      <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">{s.num}</span>
                    ) : (
                      <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium transition-colors max-w-[72px] text-center leading-tight ${
                    isCompleted
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : isActive
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 min-w-[24px] h-0.5 mt-[18px] mx-1 rounded transition-colors ${
                    isCompleted
                      ? 'bg-emerald-400 dark:bg-emerald-600'
                      : isActive
                      ? 'bg-gradient-to-r from-emerald-400 to-amber-400 dark:from-emerald-600 dark:to-amber-600'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {renderStepContent()}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={prevStep} disabled={step === 1} className="dark:border-slate-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < 8 ? (
          <Button onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
            Siguiente <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="flex gap-2">
            {!result && (
              <Button onClick={handleCalculate} disabled={calculating} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                {calculating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</> : <><Calculator className="h-4 w-4 mr-1" /> Ejecutar Cálculo</>}
              </Button>
            )}
            {result && (
              <Button variant="outline" onClick={() => { setResult(null); setStep(1); setCompletedSteps(new Set()); }} className="dark:border-slate-600 dark:text-slate-300">
                <RefreshCw className="h-4 w-4 mr-1" /> Nuevo Cálculo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

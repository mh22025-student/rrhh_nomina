'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Gift, Calculator, Loader2, BookOpen, Download, Info, FileText,
  ChevronLeft, ChevronRight, DollarSign, CalendarDays, Clock,
  CheckCircle2, AlertTriangle, Users, TrendingUp, Scale,
  ArrowRight, Hash, Star, BarChart3, Award,
  ChevronDown, ChevronUp, Scale as ScaleIcon, Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface AguinaldoViewProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface AguinaldoResult {
  planilla: {
    id: string;
    codigo_planilla: string;
    tipo: string;
    estado: string;
    total_empleados: number;
    total_aguinaldo_bruto: number;
    total_aguinaldo_neto: number;
  };
  resultados: Array<{
    empleado_id: string;
    codigo_empleado: string;
    nombre: string;
    fecha_ingreso: string;
    anios_servicio: number;
    dias_aguinaldo: number;
    salario_base: number;
    salario_diario: number;
    aguinaldo_bruto: number;
    exencion_isr: number;
    aguinaldo_gravado: number;
    isr_aguinaldo: number;
    aguinaldo_neto: number;
  }>;
  parametros_utilizados: {
    exencion_isr: string;
    salario_minimo_sector: number;
  };
}

// ISR Tramos for El Salvador 2024
const ISR_TRAMOS = [
  { desde: 0.01, hasta: 472.00, porcentaje: 0, cuota: 0, exceso: 0 },
  { desde: 472.01, hasta: 895.24, porcentaje: 0.10, cuota: 0, exceso: 472.00 },
  { desde: 895.25, hasta: 2038.10, porcentaje: 0.20, cuota: 42.32, exceso: 895.24 },
  { desde: 2038.11, hasta: Infinity, porcentaje: 0.30, cuota: 270.90, exceso: 2038.10 },
];

function calcularISR(montoGravado: number): number {
  if (montoGravado <= 0) return 0;
  const tramo = ISR_TRAMOS.find(t => montoGravado >= t.desde && montoGravado <= t.hasta);
  if (!tramo) return 0;
  return Math.round(((montoGravado - tramo.exceso) * tramo.porcentaje + tramo.cuota) * 100) / 100;
}

// Legal articles for reference
const LEGAL_ARTICLES = [
  { art: 'Art. 196', title: 'Derecho al Aguinaldo', desc: 'Todo empleado tiene derecho a que se le pague un aguinaldo en el mes de diciembre de cada año, equivalente a un mínimo de 15 días de salario.' },
  { art: 'Art. 197', title: 'Base de Cálculo', desc: 'El aguinaldo se calcula sobre el salario ordinario que devengue el trabajador al momento de pagar la prestación. Para salario variable, se promedian los últimos 3 meses.' },
  { art: 'Art. 198', title: 'Antigüedad 1-3 años', desc: 'Los trabajadores que tengan de 1 a 3 años de servicio tendrán derecho a un mínimo de 15 días de salario.' },
  { art: 'Art. 199', title: 'Antigüedad 3-10 años', desc: 'Los trabajadores que tengan de 3 a 10 años de servicio tendrán derecho a un mínimo de 19 días de salario.' },
  { art: 'Art. 200', title: 'Antigüedad 10+ años', desc: 'Los trabajadores que tengan 10 o más años de servicio tendrán derecho a un mínimo de 21 días de salario.' },
  { art: 'Art. 201', title: 'Proporcionalidad', desc: 'Si el trabajador no completó el año, el aguinaldo se paga en proporción a los días trabajados en el año.' },
  { art: 'Art. 202', title: 'Exención ISR', desc: 'El aguinaldo está exento de ISR hasta el equivalente de 2 veces el salario mínimo del sector. El excedente se grava según la Ley de Impuesto sobre la Renta.' },
];

// Animated number counter hook
function useAnimatedNumber(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else {
        setValue(target);
        prevTarget.current = target;
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

type SortField = 'codigo' | 'nombre' | 'anios' | 'dias' | 'bruto' | 'neto';

export default function AguinaldoView({ accessToken }: AguinaldoViewProps) {
  const { toast } = useToast();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<AguinaldoResult | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortAsc, setSortAsc] = useState(true);
  const [isrDetailOpen, setIsrDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Year navigation
  const handlePrevYear = () => setAnio(prev => prev - 1);
  const handleNextYear = () => setAnio(prev => prev + 1);

  const handleCalculate = async () => {
    if (!anio) {
      toast({ title: 'Error', description: 'Ingrese el año', variant: 'destructive' });
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch('/api/nomina/aguinaldo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular aguinaldo');
      setResult(data);
      setActiveTab('overview');
      toast({ title: 'Aguinaldo Calculado', description: `${data.resultados.length} empleados procesados` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al calcular aguinaldo', variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ['Código', 'Nombre', 'Años Servicio', 'Salario Base', 'Salario Diario', 'Días Aguinaldo', 'Aguinaldo Bruto', 'Exención ISR', 'Gravado', 'ISR', 'Aguinaldo Neto'];
    const rows = result.resultados.map(r => [
      r.codigo_empleado, r.nombre, r.anios_servicio, r.salario_base, r.salario_diario,
      r.dias_aguinaldo, r.aguinaldo_bruto,
      r.exencion_isr, r.aguinaldo_gravado, r.isr_aguinaldo, r.aguinaldo_neto,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aguinaldo_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGeneratePdf = async (empleadoId: string, codigoEmpleado: string) => {
    setGeneratingPdf(empleadoId);
    try {
      const res = await fetch(`/api/nomina/aguinaldo/pdf?empleado_id=${empleadoId}&anio=${anio}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al generar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aguinaldo-${codigoEmpleado}-${anio}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF Generado', description: `Constancia de aguinaldo para ${codigoEmpleado}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al generar PDF', variant: 'destructive' });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const getDiasAguinaldo = (anios: number) => {
    if (anios < 1) return 'Proporcional';
    if (anios < 3) return '15 días';
    if (anios < 10) return '19 días';
    return '21 días';
  };

  const getDiasAguinaldoNumber = (anios: number) => {
    if (anios < 1) return 15;
    if (anios < 3) return 15;
    if (anios < 10) return 19;
    return 21;
  };

  const getBracketColor = (anios: number) => {
    if (anios < 1) return 'emerald';
    if (anios < 3) return 'emerald';
    if (anios < 10) return 'teal';
    return 'amber';
  };

  // Sorted results
  const sortedResults = useMemo(() => {
    if (!result) return [];
    const sorted = [...result.resultados].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'codigo') cmp = a.codigo_empleado.localeCompare(b.codigo_empleado);
      else if (sortField === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
      else if (sortField === 'anios') cmp = a.anios_servicio - b.anios_servicio;
      else if (sortField === 'dias') cmp = a.dias_aguinaldo - b.dias_aguinaldo;
      else if (sortField === 'bruto') cmp = a.aguinaldo_bruto - b.aguinaldo_bruto;
      else if (sortField === 'neto') cmp = a.aguinaldo_neto - b.aguinaldo_neto;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [result, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(prev => !prev);
    else { setSortField(field); setSortAsc(true); }
  };

  // Tenure distribution
  const tenureDistribution = useMemo(() => {
    if (!result) return [];
    const brackets = [
      { label: '1-3 años', dias: 15, color: 'emerald', min: 1, max: 3 },
      { label: '3-10 años', dias: 19, color: 'teal', min: 3, max: 10 },
      { label: '10+ años', dias: 21, color: 'amber', min: 10, max: Infinity },
    ];
    return brackets.map(b => {
      const employees = result.resultados.filter(r => {
        if (b.max === Infinity) return r.anios_servicio >= b.min;
        return r.anios_servicio >= b.min && r.anios_servicio < b.max;
      });
      return { ...b, count: employees.length, employees, totalBruto: employees.reduce((s, e) => s + e.aguinaldo_bruto, 0) };
    });
  }, [result]);

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    if (!result) return null;
    const total = result.planilla.total_aguinaldo_neto;
    const count = result.planilla.total_empleados;
    const avg = count > 0 ? total / count : 0;
    const allCompliant = result.resultados.every(r => {
      const minDias = getDiasAguinaldoNumber(r.anios_servicio);
      return r.dias_aguinaldo >= minDias || r.anios_servicio < 1;
    });
    const totalIsr = result.resultados.reduce((s, r) => s + r.isr_aguinaldo, 0);
    const totalExencion = result.resultados.reduce((s, r) => s + r.exencion_isr, 0);
    return { total, count, avg, allCompliant, totalIsr, totalExencion };
  }, [result]);

  const animatedTotal = useAnimatedNumber(dashboardStats?.total || 0);
  const animatedAvg = useAnimatedNumber(dashboardStats?.avg || 0);
  const animatedIsr = useAnimatedNumber(dashboardStats?.totalIsr || 0);

  // ISR breakdown detail for a specific employee
  const getIsrBreakdown = (r: AguinaldoResult['resultados'][0]) => {
    const salarioMinimo = result?.parametros_utilizados.salario_minimo_sector || 365;
    const exencion = 2 * salarioMinimo;
    const gravado = Math.max(0, r.aguinaldo_bruto - exencion);
    const tramo = ISR_TRAMOS.find(t => gravado >= t.desde && gravado <= t.hasta);
    const isrCalculado = tramo ? (gravado - tramo.exceso) * tramo.porcentaje + tramo.cuota : 0;
    return { exencion, gravado, tramo, isrCalculado, salarioMinimo };
  };

  return (
    <div className="space-y-6">
      {/* ── Enhanced Header ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Gift className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Aguinaldo
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Cálculo de aguinaldo según el Código de Trabajo de El Salvador
        </p>
      </div>

      {/* Legal Banner */}
      <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Arts. 196-202 Código de Trabajo — Aguinaldo
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Todo empleado tiene derecho a un aguinaldo pagadero en el mes de diciembre de cada año,
                equivalente a un mínimo de 15 días de salario para quienes tengan de 1 a 3 años de servicio,
                19 días para quienes tengan de 3 a 10 años, y 21 días para quienes tengan 10 o más años.
                Si no se completó el año, el aguinaldo es proporcional a los días trabajados.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
                  1-3 años: 15 días
                </Badge>
                <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300">
                  3-10 años: 19 días
                </Badge>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                  10+ años: 21 días
                </Badge>
                <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300">
                  Exención ISR: 2× salario mínimo
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Year Selector with Navigation ──────────────────────────────── */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={handlePrevYear}
              >
                <ChevronLeft className="h-5 w-5 text-emerald-600" />
              </Button>
              <div className="text-center">
                <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {anio}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Período: Diciembre {anio}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={handleNextYear}
              >
                <ChevronRight className="h-5 w-5 text-emerald-600" />
              </Button>
            </div>
            <Button
              onClick={handleCalculate}
              disabled={calculating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
            >
              {calculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
              Calcular Aguinaldo {anio}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Results ────────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* ── Enhanced KPI Cards with Gradient Backgrounds ──────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Aguinaldo */}
            <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-900 dark:to-emerald-800 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
              <CardContent className="p-4 text-center relative z-10">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-[10px] text-emerald-100 font-medium">Total Aguinaldo Neto</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {fmt(animatedTotal)}
                </p>
              </CardContent>
            </Card>

            {/* Total Empleados */}
            <Card className="shadow-sm border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-500 to-teal-700 dark:from-teal-900 dark:to-teal-800 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
              <CardContent className="p-4 text-center relative z-10">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-[10px] text-teal-100 font-medium">Total Empleados</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {result.planilla.total_empleados}
                </p>
              </CardContent>
            </Card>

            {/* ISR Total */}
            <Card className="shadow-sm border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-500 to-amber-700 dark:from-amber-900 dark:to-amber-800 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
              <CardContent className="p-4 text-center relative z-10">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                    <ScaleIcon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-[10px] text-amber-100 font-medium">ISR Total Retenido</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {fmt(animatedIsr)}
                </p>
              </CardContent>
            </Card>

            {/* Cumplimiento Legal */}
            <Card className={`shadow-sm overflow-hidden relative ${dashboardStats?.allCompliant ? 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500 to-green-600 dark:from-emerald-900 dark:to-green-900' : 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-500 to-yellow-600 dark:from-amber-900 dark:to-yellow-900'}`}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
              <CardContent className="p-4 text-center relative z-10">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                    {dashboardStats?.allCompliant ? (
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-white" />
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-white/80 font-medium">Cumplimiento Legal</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {dashboardStats?.allCompliant ? '✓ Cumple' : '⚠ Revisar'}
                </p>
                <p className="text-[9px] text-white/70 mt-0.5">
                  {dashboardStats?.allCompliant ? 'Todos cumplen mínimos legales' : 'Algunos no cumplen'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Tabs for Different Views ──────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-0">
              <TabsTrigger value="overview" className="text-xs">
                <Eye className="h-3.5 w-3.5 mr-1" /> Resumen
              </TabsTrigger>
              <TabsTrigger value="table" className="text-xs">
                <Users className="h-3.5 w-3.5 mr-1" /> Tabla Detallada
              </TabsTrigger>
              <TabsTrigger value="distribution" className="text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1" /> Distribución
              </TabsTrigger>
              <TabsTrigger value="isr" className="text-xs">
                <ScaleIcon className="h-3.5 w-3.5 mr-1" /> ISR
              </TabsTrigger>
              <TabsTrigger value="legal" className="text-xs">
                <BookOpen className="h-3.5 w-3.5 mr-1" /> Legal
              </TabsTrigger>
            </TabsList>

            {/* ── Overview Tab ─────────────────────────────────────────── */}
            <TabsContent value="overview">
              <div className="space-y-6 mt-4">
                {/* ── Aguinaldo Calculator Visualization ────────────── */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-emerald-600" />
                      Cálculo Paso a Paso — Aguinaldo
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Visualización del proceso de cálculo según Arts. 196-202 CT
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Step 1 */}
                      <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                            PASO 1
                          </span>
                          <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Salario Base</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Salario diario = Mensual ÷ 30
                        </p>
                        <div className="space-y-1">
                          {result.resultados.slice(0, 3).map(r => (
                            <div key={r.empleado_id} className="flex justify-between text-[11px]">
                              <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{r.nombre.split(' ').slice(0, 2).join(' ')}</span>
                              <span className="font-medium text-slate-800 dark:text-slate-200">{fmt(r.salario_diario)}/d</span>
                            </div>
                          ))}
                          {result.resultados.length > 3 && (
                            <p className="text-[10px] text-slate-400">+{result.resultados.length - 3} más</p>
                          )}
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                            PASO 2
                          </span>
                          <CalendarDays className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Días Trabajados</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Desde fecha ingreso o 1/Ene hasta 12/Dic
                        </p>
                        <div className="space-y-1">
                          {result.resultados.slice(0, 3).map(r => {
                            const hireDate = new Date(r.fecha_ingreso);
                            const hireYear = hireDate.getFullYear();
                            const label = hireYear < anio ? 'Ene 1 - Dic 12' : `${hireDate.toLocaleDateString('es-SV', { month: 'short', day: 'numeric' })} - Dic 12`;
                            return (
                              <div key={r.empleado_id} className="flex justify-between text-[11px]">
                                <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{r.nombre.split(' ').slice(0, 2).join(' ')}</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
                              </div>
                            );
                          })}
                          {result.resultados.length > 3 && (
                            <p className="text-[10px] text-slate-400">+{result.resultados.length - 3} más</p>
                          )}
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                            PASO 3
                          </span>
                          <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Proporción</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Días trabajados ÷ 365
                        </p>
                        <div className="space-y-2">
                          {result.resultados.slice(0, 3).map(r => {
                            const proportion = Math.min(1, r.dias_aguinaldo / getDiasAguinaldoNumber(r.anios_servicio));
                            return (
                              <div key={r.empleado_id}>
                                <div className="flex justify-between text-[11px] mb-0.5">
                                  <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{r.nombre.split(' ').slice(0, 2).join(' ')}</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{(proportion * 100).toFixed(0)}%</span>
                                </div>
                                <Progress value={proportion * 100} className="h-1.5" />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                            PASO 4
                          </span>
                          <Award className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Días por Antigüedad</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Aguinaldo = Diario × Proporción × Días Art. 196 CT
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 dark:text-slate-400">1-3 años</span>
                            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">15 días</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 dark:text-slate-400">3-10 años</span>
                            <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300">19 días</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 dark:text-slate-400">10+ años</span>
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">21 días</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visual progress bars */}
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-emerald-600" />
                        Porcentaje del Aguinaldo Completo
                      </h4>
                      <div className="max-h-72 overflow-y-auto pr-2 space-y-2">
                        {result.resultados.map(r => {
                          const maxDias = 21;
                          const percentage = (r.dias_aguinaldo / maxDias) * 100;
                          const bracket = getBracketColor(r.anios_servicio);
                          const barColor = bracket === 'amber' ? 'bg-amber-500' : bracket === 'teal' ? 'bg-teal-500' : 'bg-emerald-500';
                          // Progress toward next bracket
                          const nextBracketYears = r.anios_servicio < 3 ? 3 : r.anios_servicio < 10 ? 10 : null;
                          const progressToNext = nextBracketYears ? (r.anios_servicio / nextBracketYears) * 100 : 100;
                          return (
                            <div key={r.empleado_id} className="flex items-center gap-3">
                              <div className="w-32 sm:w-44 shrink-0">
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{r.nombre}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <p className="text-[10px] text-slate-400">{r.anios_servicio.toFixed(1)} años · {getDiasAguinaldo(r.anios_servicio)}</p>
                                  {nextBracketYears && (
                                    <div className="flex-1 ml-1">
                                      <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(progressToNext, 100)}%` }} />
                                      </div>
                                    </div>
                                  )}
                                  {nextBracketYears === null && (
                                    <Star className="h-3 w-3 text-amber-500" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 w-16 text-right tabular-nums">
                                {fmt(r.aguinaldo_neto)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Avg per employee card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="shadow-sm border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Promedio por Empleado</p>
                          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                            {fmt(animatedAvg)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Total Bruto</p>
                          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                            {fmt(result.planilla.total_aguinaldo_bruto)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ── Detailed Employee Table Tab ──────────────────────────── */}
            <TabsContent value="table">
              <Card className="shadow-sm border-slate-200 dark:border-slate-700 mt-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-600" />
                        Detalle por Empleado — Cálculo Completo
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Resultados del cálculo de aguinaldo — {anio} · {result.resultados.length} empleados
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportCSV}>
                        <Download className="h-3.5 w-3.5 mr-1" /> CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                        onClick={() => {
                          toast({ title: 'Planilla PDF', description: 'Función de generación de planilla completa' });
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" /> Planilla PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-t border-b bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                          <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('codigo')}>
                            <span className="flex items-center gap-1">Código {sortField === 'codigo' && <span className="text-emerald-600">{sortAsc ? '↑' : '↓'}</span>}</span>
                          </th>
                          <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('nombre')}>
                            <span className="flex items-center gap-1">Nombre {sortField === 'nombre' && <span className="text-emerald-600">{sortAsc ? '↑' : '↓'}</span>}</span>
                          </th>
                          <th className="text-right font-medium text-teal-600 dark:text-teal-400 p-3 bg-teal-50/50 dark:bg-teal-950/20 cursor-pointer hover:text-teal-700 transition-colors" onClick={() => handleSort('anios')}>
                            <span className="flex items-center gap-1 justify-end">Años Servicio {sortField === 'anios' && <span className="text-teal-600">{sortAsc ? '↑' : '↓'}</span>}</span>
                          </th>
                          <th className="text-right font-medium text-amber-600 dark:text-amber-400 p-3 bg-amber-50/50 dark:bg-amber-950/20">Salario Base</th>
                          <th className="text-right font-medium text-amber-600 dark:text-amber-400 p-3 bg-amber-50/50 dark:bg-amber-950/20">Salario Diario</th>
                          <th className="text-center font-medium text-slate-500 dark:text-slate-400 p-3">Días Aguinaldo</th>
                          <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('bruto')}>
                            <span className="flex items-center gap-1 justify-end">Bruto {sortField === 'bruto' && <span className="text-emerald-600">{sortAsc ? '↑' : '↓'}</span>}</span>
                          </th>
                          <th className="text-right font-medium text-sky-600 dark:text-sky-400 p-3 bg-sky-50/50 dark:bg-sky-950/20">Exención ISR</th>
                          <th className="text-right font-medium text-rose-600 dark:text-rose-400 p-3 bg-rose-50/50 dark:bg-rose-950/20">ISR</th>
                          <th className="text-right font-medium text-emerald-600 dark:text-emerald-400 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer hover:text-emerald-700 transition-colors" onClick={() => handleSort('neto')}>
                            <span className="flex items-center gap-1 justify-end">Neto {sortField === 'neto' && <span className="text-emerald-600">{sortAsc ? '↑' : '↓'}</span>}</span>
                          </th>
                          <th className="text-center font-medium text-slate-500 dark:text-slate-400 p-3">PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedResults.map(r => {
                          const bracket = getBracketColor(r.anios_servicio);
                          return (
                            <tr key={r.empleado_id} className="border-b hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors">
                              <td className="p-3">
                                <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{r.codigo_empleado}</span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarFallback className={`text-[10px] font-bold ${bracket === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : bracket === 'teal' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'}`}>
                                      {r.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">{r.nombre}</p>
                                    <p className="text-[10px] text-slate-400">Ingreso: {new Date(r.fecha_ingreso).toLocaleDateString('es-SV')}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right bg-teal-50/20 dark:bg-teal-950/5">
                                <span className="font-semibold text-teal-700 dark:text-teal-300">{r.anios_servicio.toFixed(1)}</span>
                                {(() => {
                                  const nextBracketYears = r.anios_servicio < 3 ? 3 : r.anios_servicio < 10 ? 10 : null;
                                  return nextBracketYears ? (
                                    <div className="mt-1">
                                      <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-[60px] ml-auto">
                                        <div className={`h-full ${bracket === 'teal' ? 'bg-teal-500' : 'bg-emerald-500'} rounded-full`} style={{ width: `${(r.anios_servicio / nextBracketYears) * 100}%` }} />
                                      </div>
                                      <p className="text-[9px] text-slate-400 mt-0.5 text-right">{(nextBracketYears - r.anios_servicio).toFixed(1)} años para {nextBracketYears === 3 ? '19d' : '21d'}</p>
                                    </div>
                                  ) : (
                                    <p className="text-[9px] text-amber-500 mt-0.5 text-right">★ Máximo</p>
                                  );
                                })()}
                              </td>
                              <td className="p-3 text-right font-medium text-amber-700 dark:text-amber-300 bg-amber-50/20 dark:bg-amber-950/5">
                                {fmt(r.salario_base)}
                              </td>
                              <td className="p-3 text-right text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/5">
                                {fmt(r.salario_diario)}
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className={`text-[10px] ${bracket === 'amber' ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300' : bracket === 'teal' ? 'border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300' : 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'}`}>
                                  {getDiasAguinaldo(r.anios_servicio)}
                                </Badge>
                                <span className="text-[10px] text-slate-400 ml-1">({r.dias_aguinaldo.toFixed(1)}d)</span>
                              </td>
                              <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                {fmt(r.aguinaldo_bruto)}
                              </td>
                              <td className="p-3 text-right text-sky-600 dark:text-sky-400 bg-sky-50/20 dark:bg-sky-950/5">
                                {fmt(r.exencion_isr)}
                              </td>
                              <td className="p-3 text-right text-red-600 dark:text-red-400 bg-rose-50/20 dark:bg-rose-950/5">
                                {r.isr_aguinaldo > 0 ? `-${fmt(r.isr_aguinaldo)}` : '-'}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/5">
                                {fmt(r.aguinaldo_neto)}
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                  onClick={() => handleGeneratePdf(r.empleado_id, r.codigo_empleado)}
                                  disabled={generatingPdf === r.empleado_id}
                                  title="Generar Constancia de Aguinaldo PDF"
                                >
                                  {generatingPdf === r.empleado_id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Totals row */}
                      <tfoot>
                        <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 border-t-2 border-emerald-200 dark:border-emerald-800">
                          <td colSpan={2} className="p-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                            TOTAL ({result.planilla.total_empleados} empleados)
                          </td>
                          <td className="p-3 text-right font-bold text-teal-700 dark:text-teal-300 bg-teal-50/30 dark:bg-teal-950/10">—</td>
                          <td className="p-3 text-right font-bold text-amber-700 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/10">—</td>
                          <td className="p-3 text-right font-bold text-amber-700 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/10">—</td>
                          <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">—</td>
                          <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300">
                            {fmt(result.planilla.total_aguinaldo_bruto)}
                          </td>
                          <td className="p-3 text-right font-bold text-sky-600 dark:text-sky-400 bg-sky-50/30 dark:bg-sky-950/10">
                            {fmt(result.resultados.reduce((s, r) => s + r.exencion_isr, 0))}
                          </td>
                          <td className="p-3 text-right font-bold text-red-600 dark:text-red-400 bg-rose-50/30 dark:bg-rose-950/10">
                            -{fmt(result.planilla.total_aguinaldo_bruto - result.planilla.total_aguinaldo_neto)}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 text-lg bg-emerald-50/30 dark:bg-emerald-950/10">
                            {fmt(result.planilla.total_aguinaldo_neto)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tenure Distribution Chart Tab ────────────────────────── */}
            <TabsContent value="distribution">
              <div className="space-y-6 mt-4">
                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-600" />
                      Distribución por Antigüedad
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Empleados agrupados por bracket de antigüedad y días de aguinaldo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {tenureDistribution.map(bracket => {
                      const maxCount = Math.max(...tenureDistribution.map(b => b.count), 1);
                      const barWidth = (bracket.count / maxCount) * 100;
                      const colorClasses = {
                        emerald: { bar: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', badge: 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300' },
                        teal: { bar: 'bg-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-300', badge: 'border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300' },
                        amber: { bar: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', badge: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300' },
                      }[bracket.color];

                      return (
                        <div key={bracket.label} className={`p-5 rounded-xl border ${colorClasses.border} ${colorClasses.bg}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white/60 dark:bg-black/20">
                                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{bracket.count}</span>
                              </div>
                              <div>
                                <h4 className={`text-sm font-semibold ${colorClasses.text}`}>{bracket.label}</h4>
                                <Badge variant="outline" className={`text-[10px] ${colorClasses.badge}`}>
                                  {bracket.dias} días de aguinaldo
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Total Bruto</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(bracket.totalBruto)}</p>
                            </div>
                          </div>
                          {/* Horizontal bar */}
                          <div className="h-8 bg-white/40 dark:bg-black/20 rounded-lg overflow-hidden">
                            <div
                              className={`h-full ${colorClasses.bar} rounded-lg transition-all duration-700 flex items-center justify-end pr-3`}
                              style={{ width: `${Math.max(barWidth, 8)}%` }}
                            >
                              <span className="text-[11px] font-bold text-white">
                                {bracket.count} empleado{bracket.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          {/* Employee list within bracket */}
                          {bracket.employees.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {bracket.employees.map(emp => (
                                <Badge key={emp.empleado_id} variant="secondary" className="text-[10px] bg-white/60 dark:bg-black/20">
                                  {emp.nombre.split(' ').slice(0, 2).join(' ')} · {emp.anios_servicio.toFixed(1)}a
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Summary row */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Empleados</span>
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{result.planilla.total_empleados}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── ISR Calculation Detail Tab ────────────────────────────── */}
            <TabsContent value="isr">
              <div className="space-y-6 mt-4">
                {/* ISR Explanation Card */}
                <Card className="shadow-sm border-rose-200 dark:border-rose-800 bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/50 shrink-0">
                        <ScaleIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                          Cálculo de ISR sobre Aguinaldo
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          El aguinaldo está exento de ISR hasta el equivalente de <strong>2 veces el salario mínimo del sector comercial</strong> ($365 × 2 = $730.00).
                          El monto que exceda esta exención se grava según los tramos de la Ley de Impuesto sobre la Renta.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ISR Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="shadow-sm border-sky-200 dark:border-sky-800 bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950/30 dark:to-sky-900/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mb-1">Exención Total</p>
                      <p className="text-xl font-bold text-sky-800 dark:text-sky-200">{fmt(dashboardStats?.totalExencion || 0)}</p>
                      <p className="text-[10px] text-slate-500 mt-1">2 × $365.00 por empleado</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mb-1">ISR Total Retenido</p>
                      <p className="text-xl font-bold text-rose-800 dark:text-rose-200">{fmt(dashboardStats?.totalIsr || 0)}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Sobre monto gravado</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mb-1">Neto Total</p>
                      <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">{fmt(result.planilla.total_aguinaldo_neto)}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Bruto - ISR</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ISR Tramos Reference */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ScaleIcon className="h-4 w-4 text-rose-600" />
                      Tramos ISR — Ley de Impuesto sobre la Renta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                            <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Tramo</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Desde</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Hasta</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">% ISR</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Cuota Fija</th>
                            <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Exceso sobre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ISR_TRAMOS.map((t, i) => (
                            <tr key={i} className="border-b">
                              <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{i + 1}</td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-400">{fmt(t.desde)}</td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-400">{t.hasta === Infinity ? '∞' : fmt(t.hasta)}</td>
                              <td className="p-3 text-right font-semibold text-rose-600 dark:text-rose-400">{(t.porcentaje * 100).toFixed(0)}%</td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-400">{fmt(t.cuota)}</td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-400">{fmt(t.exceso)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Expandable ISR Detail per Employee */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-rose-600" />
                      Detalle ISR por Empleado
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Expanda cada empleado para ver el cálculo detallado del ISR
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.resultados.filter(r => r.isr_aguinaldo > 0).map(r => {
                      const breakdown = getIsrBreakdown(r);
                      return (
                        <Collapsible key={r.empleado_id}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 text-[10px] font-bold">
                                    {r.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.nombre}</p>
                                  <p className="text-[10px] text-slate-400">{r.codigo_empleado}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-[10px] text-slate-400">ISR</p>
                                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{fmt(r.isr_aguinaldo)}</p>
                                </div>
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-4 p-4 mt-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                              {/* ISR Calculation Steps */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-400">1. Aguinaldo Bruto</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{fmt(r.aguinaldo_bruto)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-400">2. Exención ISR (2 × ${breakdown.salarioMinimo})</span>
                                  <span className="font-medium text-sky-600 dark:text-sky-400">-{fmt(breakdown.exencion)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-600 dark:text-slate-400">3. Monto Gravado</span>
                                  <span className="font-medium text-amber-700 dark:text-amber-300">{fmt(breakdown.gravado)}</span>
                                </div>
                                {breakdown.tramo && breakdown.gravado > 0 && (
                                  <>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-600 dark:text-slate-400">
                                        4. Tramo {(ISR_TRAMOS.indexOf(breakdown.tramo) + 1)}: ({(breakdown.tramo.porcentaje * 100).toFixed(0)}% sobre exceso de {fmt(breakdown.tramo.exceso)})
                                      </span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200">
                                        ({fmt(breakdown.gravado)} - {fmt(breakdown.tramo.exceso)}) × {(breakdown.tramo.porcentaje * 100).toFixed(0)}% + {fmt(breakdown.tramo.cuota)}
                                      </span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between text-sm">
                                      <span className="font-semibold text-slate-700 dark:text-slate-300">5. ISR sobre Aguinaldo</span>
                                      <span className="font-bold text-rose-600 dark:text-rose-400">-{fmt(breakdown.isrCalculado)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="font-semibold text-slate-700 dark:text-slate-300">6. Aguinaldo Neto</span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(r.aguinaldo_neto)}</span>
                                    </div>
                                  </>
                                )}
                                {breakdown.gravado <= 0 && (
                                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-xs text-emerald-700 dark:text-emerald-300">
                                    ✓ El aguinaldo no excede la exención de ISR. No se retiene impuesto.
                                  </div>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    {result.resultados.filter(r => r.isr_aguinaldo <= 0).length > 0 && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                          {result.resultados.filter(r => r.isr_aguinaldo <= 0).length} empleado(s) exentos de ISR
                          (aguinaldo no excede 2× salario mínimo)
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Legal Reference Panel Tab ──────────────────────────────── */}
            <TabsContent value="legal">
              <div className="space-y-4 mt-4">
                <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                        <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                          Código de Trabajo de El Salvador
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Artículos 196 al 202 — Regulación del Aguinaldo
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {LEGAL_ARTICLES.map((article, idx) => (
                  <Card key={article.art} className="shadow-sm border-slate-200 dark:border-slate-700">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                          idx < 2 ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                          idx < 5 ? 'bg-teal-100 dark:bg-teal-900/50' :
                          'bg-amber-100 dark:bg-amber-900/50'
                        }`}>
                          <span className={`text-sm font-bold ${
                            idx < 2 ? 'text-emerald-700 dark:text-emerald-300' :
                            idx < 5 ? 'text-teal-700 dark:text-teal-300' :
                            'text-amber-700 dark:text-amber-300'
                          }`}>{idx + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
                              {article.art}
                            </Badge>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {article.title}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {article.desc}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Additional references */}
                <Card className="shadow-sm border-rose-200 dark:border-rose-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ScaleIcon className="h-4 w-4 text-rose-600" />
                      Ley de Impuesto sobre la Renta — Aplicación al Aguinaldo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Exención aplicable</h5>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        De acuerdo con la Ley de ISR, el aguinaldo está exento hasta el equivalente de <strong>2 veces el salario mínimo</strong> del sector
                        al que pertenece el trabajador. Para el sector comercio/servicios, el salario mínimo vigente es de <strong>$365.00</strong>,
                        resultando en una exención de <strong>$730.00</strong>.
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Monto gravado</h5>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        El excedente sobre la exención se grava conforme a los tramos progresivos de ISR:
                        Tramo 1 (0-472): 0%, Tramo 2 (472.01-895.24): 10%, Tramo 3 (895.25-2038.10): 20%, Tramo 4 (+2038.11): 30%.
                      </p>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <h5 className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Nota importante
                      </h5>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        El ISR sobre el aguinaldo se calcula de forma independiente al salario mensual, no se acumula.
                        El monto gravado del aguinaldo se tasa directamente en los tramos de ISR.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* ── Parameters Used ────────────────────────────────────────── */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p><strong>Parámetros utilizados:</strong> {result.parametros_utilizados.exencion_isr}</p>
                  <p><strong>Salario mínimo sector comercio:</strong> ${result.parametros_utilizados.salario_minimo_sector}</p>
                  <p><strong>Código planilla:</strong> {result.planilla.codigo_planilla}</p>
                  <p><strong>Estado:</strong> {result.planilla.estado}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

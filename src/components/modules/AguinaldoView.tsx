'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Gift, Calculator, Loader2, BookOpen, Download, Info, FileText,
  ChevronLeft, ChevronRight, DollarSign, CalendarDays, Clock,
  CheckCircle2, AlertTriangle, Users, TrendingUp, Scale,
  ArrowRight, Hash, Star, BarChart3, Award
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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

type SortField = 'nombre' | 'dias' | 'monto';

export default function AguinaldoView({ accessToken }: AguinaldoViewProps) {
  const { toast } = useToast();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<AguinaldoResult | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortAsc, setSortAsc] = useState(true);

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
      toast({ title: 'Aguinaldo Calculado', description: `${data.resultados.length} empleados procesados` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al calcular aguinaldo', variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ['Código', 'Nombre', 'Fecha Ingreso', 'Años Servicio', 'Días Aguinaldo', 'Salario Base', 'Aguinaldo Bruto', 'Exención ISR', 'Gravado', 'ISR', 'Aguinaldo Neto'];
    const rows = result.resultados.map(r => [
      r.codigo_empleado, r.nombre, r.fecha_ingreso, r.anios_servicio,
      r.dias_aguinaldo, r.salario_base, r.aguinaldo_bruto,
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
    if (anios < 1) return 15; // proportional base
    if (anios < 3) return 15;
    if (anios < 10) return 19;
    return 21;
  };

  // Sorted results
  const sortedResults = useMemo(() => {
    if (!result) return [];
    const sorted = [...result.resultados].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
      else if (sortField === 'dias') cmp = a.dias_aguinaldo - b.dias_aguinaldo;
      else if (sortField === 'monto') cmp = a.aguinaldo_neto - b.aguinaldo_neto;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [result, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(prev => !prev);
    else { setSortField(field); setSortAsc(true); }
  };

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    if (!result) return null;
    const total = result.planilla.total_aguinaldo_neto;
    const count = result.planilla.total_empleados;
    const avg = count > 0 ? total / count : 0;
    // Legal compliance: all employees meet minimum
    const allCompliant = result.resultados.every(r => {
      const minDias = getDiasAguinaldoNumber(r.anios_servicio);
      return r.dias_aguinaldo >= minDias || r.anios_servicio < 1;
    });
    return { total, count, avg, allCompliant };
  }, [result]);

  const animatedTotal = useAnimatedNumber(dashboardStats?.total || 0);
  const animatedAvg = useAnimatedNumber(dashboardStats?.avg || 0);

  return (
    <div className="space-y-6">
      {/* ── Enhanced Header with Legal Reference ──────────────────────────── */}
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

      {/* ── Year Selector with Navigation ──────────────────────────────────── */}
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

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* ── Aguinaldo Calculator Visualization ──────────────────────── */}
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
                {/* Step 1: Salario Base */}
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                      PASO 1
                    </span>
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Salario Base</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Último salario mensual o promedio de últimos 3 meses. Salario diario = Mensual ÷ 30
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

                {/* Step 2: Días Trabajados */}
                <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                      PASO 2
                    </span>
                    <CalendarDays className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Días Trabajados</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Desde la fecha de ingreso o 1 de enero, hasta el 12 de diciembre
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

                {/* Step 3: Proporción */}
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                      PASO 3
                    </span>
                    <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Proporción</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Días trabajados ÷ 365. Si completó el año, proporción = 1.0
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
                    {result.resultados.length > 3 && (
                      <p className="text-[10px] text-slate-400">+{result.resultados.length - 3} más</p>
                    )}
                  </div>
                </div>

                {/* Step 4: Días de Aguinaldo por Antigüedad */}
                <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">
                      PASO 4
                    </span>
                    <Award className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Días por Antigüedad</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Aguinaldo = Salario diario × Proporción × Días según Art. 196 CT
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

              {/* Visual progress bars for each employee */}
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Porcentaje del Aguinaldo Completo
                </h4>
                <div className="max-h-72 overflow-y-auto pr-2 space-y-2">
                  {result.resultados.map(r => {
                    const maxDias = 21; // max possible aguinaldo days
                    const percentage = (r.dias_aguinaldo / maxDias) * 100;
                    return (
                      <div key={r.empleado_id} className="flex items-center gap-3">
                        <div className="w-32 sm:w-44 shrink-0">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{r.nombre}</p>
                          <p className="text-[10px] text-slate-400">{r.anios_servicio.toFixed(1)} años · {getDiasAguinaldo(r.anios_servicio)}</p>
                        </div>
                        <div className="flex-1">
                          <Progress value={percentage} className="h-3" />
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

          {/* ── Aguinaldo Summary Dashboard ─────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Aguinaldo */}
            <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Total Aguinaldo</p>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                  {fmt(animatedTotal)}
                </p>
              </CardContent>
            </Card>

            {/* Total Empleados */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-8 w-8 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                    <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  </div>
                </div>
                <p className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">Total Empleados</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {result.planilla.total_empleados}
                </p>
              </CardContent>
            </Card>

            {/* Promedio por Empleado */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Promedio por Empleado</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {fmt(animatedAvg)}
                </p>
              </CardContent>
            </Card>

            {/* Cumplimiento Legal */}
            <Card className={`shadow-sm ${dashboardStats?.allCompliant ? 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30' : 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30'}`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${dashboardStats?.allCompliant ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
                    {dashboardStats?.allCompliant ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                </div>
                <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Cumplimiento Legal</p>
                <p className={`text-sm font-bold mt-0.5 ${dashboardStats?.allCompliant ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {dashboardStats?.allCompliant ? '✓ Cumple' : '⚠ Revisar'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {dashboardStats?.allCompliant ? 'Todos los cálculos cumplen mínimos legales' : 'Algunos cálculos no cumplen mínimos'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Employee Results Table ──────────────────────────────────── */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    Detalle por Empleado
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Resultados del cálculo de aguinaldo — {anio}
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
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-t border-b bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                      <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Empleado</th>
                      <th
                        className="text-left font-medium text-slate-500 dark:text-slate-400 p-3 cursor-pointer hover:text-emerald-600 transition-colors"
                        onClick={() => handleSort('nombre')}
                      >
                        <span className="flex items-center gap-1">
                          Nombre
                          {sortField === 'nombre' && <span className="text-emerald-600">{sortAsc ? '↑' : '↓'}</span>}
                        </span>
                      </th>
                      <th className="text-right font-medium text-amber-600 dark:text-amber-400 p-3 bg-amber-50/50 dark:bg-amber-950/20">
                        Salario
                      </th>
                      <th
                        className="text-right font-medium text-teal-600 dark:text-teal-400 p-3 bg-teal-50/50 dark:bg-teal-950/20 cursor-pointer hover:text-teal-700 transition-colors"
                        onClick={() => handleSort('dias')}
                      >
                        <span className="flex items-center gap-1 justify-end">
                          Días Trab.
                          {sortField === 'dias' && <span className="text-teal-600">{sortAsc ? '↑' : '↓'}</span>}
                        </span>
                      </th>
                      <th className="text-center font-medium text-slate-500 dark:text-slate-400 p-3">Días Aguinaldo</th>
                      <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Bruto</th>
                      <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">ISR</th>
                      <th
                        className="text-right font-medium text-emerald-600 dark:text-emerald-400 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer hover:text-emerald-700 transition-colors"
                        onClick={() => handleSort('monto')}
                      >
                        <span className="flex items-center gap-1 justify-end">
                          Neto
                          {sortField === 'monto' && <span className="text-emerald-600">{sortAsc ? '↑' : '↓'}</span>}
                        </span>
                      </th>
                      <th className="text-center font-medium text-slate-500 dark:text-slate-400 p-3">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map(r => (
                      <tr key={r.empleado_id} className="border-b hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors">
                        <td className="p-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px] font-bold">
                              {r.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{r.nombre}</p>
                          <p className="text-[11px] text-slate-400">{r.codigo_empleado}</p>
                        </td>
                        <td className="p-3 text-right font-medium text-amber-700 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/10">
                          {fmt(r.salario_base)}
                        </td>
                        <td className="p-3 text-right text-teal-700 dark:text-teal-300 bg-teal-50/30 dark:bg-teal-950/10">
                          {r.anios_servicio.toFixed(1)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
                            {getDiasAguinaldo(r.anios_servicio)}
                          </Badge>
                          <span className="text-[10px] text-slate-400 ml-1">({r.dias_aguinaldo.toFixed(1)}d)</span>
                        </td>
                        <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-300">{fmt(r.aguinaldo_bruto)}</td>
                        <td className="p-3 text-right text-red-600 dark:text-red-400">{r.isr_aguinaldo > 0 ? `-${fmt(r.isr_aguinaldo)}` : '-'}</td>
                        <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10">
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
                    ))}
                  </tbody>
                  {/* Total row */}
                  <tfoot>
                    <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 border-t-2 border-emerald-200 dark:border-emerald-800">
                      <td colSpan={5} className="p-3 text-sm font-bold text-slate-700 dark:text-slate-300 text-right">
                        Total General
                      </td>
                      <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300">
                        {fmt(result.planilla.total_aguinaldo_bruto)}
                      </td>
                      <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">
                        -{fmt(result.planilla.total_aguinaldo_bruto - result.planilla.total_aguinaldo_neto)}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 text-lg">
                        {fmt(result.planilla.total_aguinaldo_neto)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Parameters Used ────────────────────────────────────────── */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p><strong>Parámetros utilizados:</strong> {result.parametros_utilizados.exencion_isr}</p>
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

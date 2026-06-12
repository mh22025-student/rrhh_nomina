'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, DollarSign, Shield, Clock, AlertTriangle, TrendingUp,
  TrendingDown, CheckCircle, XCircle, Loader2, RefreshCw,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Info,
  CircleDot, AlertOctagon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

interface PayrollDashboardProps {
  accessToken: string;
  userRole: string;
}

interface DashboardData {
  kpis: {
    total_empleados_activos: number;
    tendencia_empleados: string;
    nomina_mes: number;
    cumplimiento_previsional: number;
    semaforo: string;
    planilla_actual: {
      id: string;
      codigo: string;
      estado: string;
      tipo: string;
      calculada_por: string | null;
    } | null;
  };
  cumplimientos: Array<{ nombre: string; presentado: boolean; peso: number }>;
  vencimientos: Array<{ nombre: string; fecha: string; estado: string }>;
  planillas_recientes: Array<{
    id: string;
    codigo: string;
    tipo: string;
    estado: string;
    total_neto: number;
    total_bruto: number;
    empleados: number;
    calculada_por: string | null;
    aprobada_por: string | null;
    fecha_creacion: string;
  }>;
  tendencia_mensual: Array<{ mes: string; total: number }>;
  distribucion_areas: Array<{ nombre: string; total: number }>;
  alertas: Array<{ tipo: string; mensaje: string; severidad: string }>;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  try {
    const date = new Date(d);
    return date.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-amber-100 text-amber-800 border-amber-200',
  CALCULADA: 'bg-amber-100 text-amber-800 border-amber-200',
  EN_CORRECCION: 'bg-orange-100 text-orange-800 border-orange-200',
  APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PAGADA: 'bg-sky-100 text-sky-800 border-sky-200',
  ANULADA: 'bg-red-100 text-red-800 border-red-200',
};

const estadoDot: Record<string, string> = {
  BORRADOR: 'bg-amber-500',
  CALCULADA: 'bg-amber-500',
  EN_CORRECCION: 'bg-orange-500',
  APROBADA: 'bg-emerald-500',
  PAGADA: 'bg-sky-500',
  ANULADA: 'bg-red-500',
};

export default function PayrollDashboard({ accessToken, userRole }: PayrollDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/nomina/dashboard', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al cargar dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={fetchData} className="mt-3 text-sm text-emerald-600 hover:underline flex items-center gap-1 mx-auto">
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const maxTendencia = Math.max(...data.tendencia_mensual.map(m => m.total), 1);
  const maxArea = Math.max(...data.distribucion_areas.map(a => a.total), 1);

  const semaforoColor = data.kpis.semaforo === 'verde' ? 'bg-emerald-500' : data.kpis.semaforo === 'amarillo' ? 'bg-amber-500' : 'bg-red-500';
  const semaforoLabel = data.kpis.semaforo === 'verde' ? 'En Cumplimiento' : data.kpis.semaforo === 'amarillo' ? 'Atención Requerida' : 'Incumplimiento';
  const semaforoRing = data.kpis.semaforo === 'verde' ? 'ring-emerald-200' : data.kpis.semaforo === 'amarillo' ? 'ring-amber-200' : 'ring-red-200';

  return (
    <div className="space-y-5">
      {/* Current Planilla Banner - Prominent if active */}
      {data.kpis.planilla_actual && (
        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Planilla en Progreso</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-mono font-medium">{data.kpis.planilla_actual.codigo}</span>
                    <span className="mx-1.5">·</span>
                    {data.kpis.planilla_actual.tipo}
                    {data.kpis.planilla_actual.calculada_por && (
                      <>
                        <span className="mx-1.5">·</span>
                        Calculada por: {data.kpis.planilla_actual.calculada_por}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Badge className={`${estadoColors[data.kpis.planilla_actual.estado] || 'bg-slate-100 text-slate-700'} border text-xs font-medium`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${estadoDot[data.kpis.planilla_actual.estado] || 'bg-slate-400'}`} />
                {data.kpis.planilla_actual.estado}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards - ERP style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Empleados */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Empleados Activos</span>
              <div className="p-2 rounded-lg bg-teal-50">
                <Users className="h-4 w-4 text-teal-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.kpis.total_empleados_activos}</p>
            <div className="flex items-center gap-1 mt-2">
              {data.kpis.tendencia_empleados.startsWith('-') ? (
                <>
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-600">{data.kpis.tendencia_empleados}%</span>
                  <span className="text-xs text-slate-400">vs mes anterior</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600">+{data.kpis.tendencia_empleados}%</span>
                  <span className="text-xs text-slate-400">vs mes anterior</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Nómina del Mes */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Nómina del Mes</span>
              <div className="p-2 rounded-lg bg-emerald-50">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono">{fmt(data.kpis.nomina_mes)}</p>
            <span className="text-xs text-slate-400 mt-2 block">Total neto pagado</span>
          </CardContent>
        </Card>

        {/* Cumplimiento Previsional with Traffic Light */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Cumplimiento</span>
              {/* Traffic light visual */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-full">
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'rojo' ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-red-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'amarillo' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-amber-900/40'}`} />
                <div className={`w-3 h-3 rounded-full ${data.kpis.semaforo === 'verde' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-emerald-900/40'}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.kpis.cumplimiento_previsional}%</p>
            <div className="flex items-center gap-2 mt-2">
              <Progress
                value={data.kpis.cumplimiento_previsional}
                className="h-2 flex-1"
              />
              <Badge variant="outline" className={`text-[10px] px-2 border ${
                data.kpis.semaforo === 'verde' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
                data.kpis.semaforo === 'amarillo' ? 'border-amber-300 text-amber-700 bg-amber-50' :
                'border-red-300 text-red-700 bg-red-50'
              }`}>
                {semaforoLabel}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Próximo Vencimiento */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Próximo Vencimiento</span>
              <div className="p-2 rounded-lg bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            {data.vencimientos.length > 0 ? (
              <>
                <p className="text-lg font-bold text-slate-900">{data.vencimientos[0].nombre}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-xs font-semibold text-orange-600">{data.vencimientos[0].fecha}</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-emerald-600">Al día</p>
                <span className="text-xs text-slate-400 mt-2 block">Sin vencimientos pendientes</span>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent planillas - improved table */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" /> Planillas Recientes
            </CardTitle>
            <CardDescription>Últimas planillas procesadas</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-slate-50/80">
                    <th className="text-left font-medium text-slate-500 p-3">Código</th>
                    <th className="text-left font-medium text-slate-500 p-3">Tipo</th>
                    <th className="text-left font-medium text-slate-500 p-3">Estado</th>
                    <th className="text-right font-medium text-slate-500 p-3">Total Neto</th>
                    <th className="text-right font-medium text-slate-500 p-3">Empleados</th>
                    <th className="text-right font-medium text-slate-500 p-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.planillas_recientes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                          <Info className="h-8 w-8 mb-2 text-slate-300" />
                          <p className="font-medium">No hay planillas registradas</p>
                          <p className="text-xs">Las planillas aparecerán aquí al calcularlas</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.planillas_recientes.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-mono text-xs font-medium text-slate-700">{p.codigo}</td>
                        <td className="p-3 text-slate-600">{p.tipo}</td>
                        <td className="p-3">
                          <Badge className={`text-[10px] border ${estadoColors[p.estado] || 'bg-slate-100 text-slate-700'}`} variant="secondary">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${estadoDot[p.estado] || 'bg-slate-400'}`} />
                            {p.estado}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-slate-900">{fmt(p.total_neto)}</td>
                        <td className="p-3 text-right text-slate-600">{p.empleados}</td>
                        <td className="p-3 text-right text-xs text-slate-500">{fmtDate(p.fecha_creacion)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Compliance semaphore - traffic light visual */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" /> Semáforo Previsional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Large traffic light */}
            <div className="flex items-center justify-center mb-4">
              <div className="flex flex-col items-center gap-2 p-3 bg-slate-900 rounded-2xl shadow-inner">
                <div className={`w-8 h-8 rounded-full transition-all ${
                  data.kpis.semaforo === 'rojo'
                    ? 'bg-red-500 shadow-lg shadow-red-500/50'
                    : 'bg-red-900/30'
                }`} />
                <div className={`w-8 h-8 rounded-full transition-all ${
                  data.kpis.semaforo === 'amarillo'
                    ? 'bg-amber-400 shadow-lg shadow-amber-400/50'
                    : 'bg-amber-900/30'
                }`} />
                <div className={`w-8 h-8 rounded-full transition-all ${
                  data.kpis.semaforo === 'verde'
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                    : 'bg-emerald-900/30'
                }`} />
              </div>
              <div className="ml-4">
                <p className={`text-lg font-bold ${
                  data.kpis.semaforo === 'verde' ? 'text-emerald-600' :
                  data.kpis.semaforo === 'amarillo' ? 'text-amber-600' :
                  'text-red-600'
                }`}>{semaforoLabel}</p>
                <p className="text-xs text-slate-500">{data.kpis.cumplimiento_previsional}% cumplimiento</p>
              </div>
            </div>

            <Separator />

            {/* Compliance items */}
            {data.cumplimientos.map(c => (
              <div key={c.nombre} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80">
                <div className="flex items-center gap-2">
                  {c.presentado ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium text-slate-700">{c.nombre}</span>
                </div>
                <Badge variant={c.presentado ? 'default' : 'destructive'} className={`text-[10px] ${c.presentado ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700'}`}>
                  {c.presentado ? 'Presentado' : 'Pendiente'}
                </Badge>
              </div>
            ))}

            <Separator className="my-2" />

            {/* Deadlines */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimientos</p>
              {data.vencimientos.map(v => (
                <div key={v.nombre} className="flex items-center justify-between text-xs bg-orange-50/50 rounded px-2 py-1.5">
                  <span className="text-slate-700 font-medium">{v.nombre}</span>
                  <span className="font-semibold text-orange-600">{v.fecha}</span>
                </div>
              ))}
              {data.vencimientos.length === 0 && (
                <p className="text-xs text-emerald-600 text-center py-1">✓ Todos los pagos al día</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly trend - better bar chart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" /> Tendencia Mensual
            </CardTitle>
            <CardDescription>Total salarios brutos por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {data.tendencia_mensual.every(m => m.total === 0) ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin datos históricos</p>
              </div>
            ) : (
              <div className="flex items-end gap-3 h-48 pt-2">
                {data.tendencia_mensual.map((m, i) => {
                  const height = Math.max((m.total / maxTendencia) * 160, 6);
                  const isMax = m.total === maxTendencia;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <span className="text-[10px] text-slate-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.total > 0 ? fmt(m.total) : '-'}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 min-h-[6px] group-hover:opacity-80 ${
                          isMax
                            ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                            : 'bg-gradient-to-t from-teal-500 to-teal-300'
                        }`}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[10px] text-slate-500 capitalize font-medium">{m.mes}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department distribution - better horizontal bars */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-slate-500" /> Distribución por Área
            </CardTitle>
            <CardDescription>Costo salarial por departamento</CardDescription>
          </CardHeader>
          <CardContent>
            {data.distribucion_areas.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin datos de distribución</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {data.distribucion_areas.slice(0, 8).map((a, i) => {
                  const pct = (a.total / maxArea) * 100;
                  const colors = [
                    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-amber-500',
                    'bg-orange-500', 'bg-rose-500', 'bg-violet-500', 'bg-slate-500',
                  ];
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-sm ${colors[i % colors.length]}`} />
                          <span className="font-medium text-slate-700">{a.nombre}</span>
                        </div>
                        <span className="font-mono text-slate-500 text-[11px]">{fmt(a.total)}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${colors[i % colors.length]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts with severity icons */}
      {data.alertas.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas del Sistema
              <Badge variant="secondary" className="ml-1 bg-slate-100 text-slate-600 text-[10px]">
                {data.alertas.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.alertas.map((a, i) => {
                const isHigh = a.severidad === 'ALTA';
                const isMedium = a.severidad === 'MEDIA';
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                      isHigh ? 'bg-red-50 border-red-200 text-red-800' :
                      isMedium ? 'bg-amber-50 border-amber-200 text-amber-800' :
                      'bg-sky-50 border-sky-200 text-sky-800'
                    }`}
                  >
                    {isHigh ? (
                      <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                    ) : isMedium ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{a.mensaje}</p>
                      <p className={`text-[10px] mt-0.5 font-semibold uppercase ${
                        isHigh ? 'text-red-500' : isMedium ? 'text-amber-500' : 'text-sky-500'
                      }`}>{a.severidad}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

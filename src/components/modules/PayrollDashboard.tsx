'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, DollarSign, Shield, Clock, AlertTriangle, TrendingUp,
  TrendingDown, CheckCircle, XCircle, Loader2, RefreshCw,
  BarChart3, PieChart
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

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  CALCULADA: 'bg-amber-100 text-amber-800',
  EN_CORRECCION: 'bg-orange-100 text-orange-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  PAGADA: 'bg-green-100 text-green-800',
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

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Empleados */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-500">Empleados Activos</span>
              <div className="p-2 rounded-lg bg-emerald-50">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.kpis.total_empleados_activos}</p>
            <div className="flex items-center gap-1 mt-1">
              {data.kpis.tendencia_empleados.startsWith('-') ? (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span className={`text-xs font-medium ${data.kpis.tendencia_empleados.startsWith('-') ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.kpis.tendencia_empleados}% vs mes anterior
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Nómina del Mes */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-500">Nómina del Mes</span>
              <div className="p-2 rounded-lg bg-teal-50">
                <DollarSign className="h-4 w-4 text-teal-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmt(data.kpis.nomina_mes)}</p>
            <span className="text-xs text-slate-500">Total neto pagado</span>
          </CardContent>
        </Card>

        {/* Cumplimiento Previsional */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-500">Cumplimiento Previsional</span>
              <div className={`p-2 rounded-lg ${data.kpis.semaforo === 'verde' ? 'bg-emerald-50' : data.kpis.semaforo === 'amarillo' ? 'bg-amber-50' : 'bg-red-50'}`}>
                <Shield className={`h-4 w-4 ${data.kpis.semaforo === 'verde' ? 'text-emerald-600' : data.kpis.semaforo === 'amarillo' ? 'text-amber-600' : 'text-red-600'}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.kpis.cumplimiento_previsional}%</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress
                value={data.kpis.cumplimiento_previsional}
                className="h-2 flex-1"
              />
              <Badge variant="outline" className={`text-[10px] px-1.5 ${data.kpis.semaforo === 'verde' ? 'border-emerald-300 text-emerald-700' : data.kpis.semaforo === 'amarillo' ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}`}>
                {data.kpis.semaforo === 'verde' ? 'OK' : data.kpis.semaforo === 'amarillo' ? 'ATENCIÓN' : 'CRÍTICO'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Próximo Vencimiento */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-500">Próximo Vencimiento</span>
              <div className="p-2 rounded-lg bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            {data.vencimientos.length > 0 ? (
              <>
                <p className="text-lg font-bold text-slate-900">{data.vencimientos[0].nombre}</p>
                <span className="text-xs text-orange-600 font-medium">{data.vencimientos[0].fecha}</span>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-emerald-600">Al día</p>
                <span className="text-xs text-slate-500">Sin vencimientos pendientes</span>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent planillas */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Planillas Recientes</CardTitle>
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
                  </tr>
                </thead>
                <tbody>
                  {data.planillas_recientes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">No hay planillas registradas</td>
                    </tr>
                  ) : (
                    data.planillas_recientes.map(p => (
                      <tr key={p.id} className="border-b hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-mono text-xs">{p.codigo}</td>
                        <td className="p-3">{p.tipo}</td>
                        <td className="p-3">
                          <Badge className={`text-[10px] ${estadoColors[p.estado] || 'bg-slate-100 text-slate-700'}`} variant="secondary">
                            {p.estado}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium">{fmt(p.total_neto)}</td>
                        <td className="p-3 text-right">{p.empleados}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Compliance semaphore */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Semáforo Previsional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.cumplimientos.map(c => (
              <div key={c.nombre} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  {c.presentado ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">{c.nombre}</span>
                </div>
                <Badge variant={c.presentado ? 'default' : 'destructive'} className="text-[10px]">
                  {c.presentado ? 'Presentado' : 'Pendiente'}
                </Badge>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="space-y-1">
              {data.vencimientos.map(v => (
                <div key={v.nombre} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{v.nombre}</span>
                  <span className="font-medium text-orange-600">{v.fecha}</span>
                </div>
              ))}
              {data.vencimientos.length === 0 && (
                <p className="text-xs text-emerald-600 text-center">Todos los pagos al día</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly trend */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Tendencia Mensual
            </CardTitle>
            <CardDescription>Total salarios brutos por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {data.tendencia_mensual.every(m => m.total === 0) ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin datos históricos</p>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {data.tendencia_mensual.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-medium">
                      {m.total > 0 ? fmt(m.total) : '-'}
                    </span>
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-sm transition-all duration-500 min-h-[4px]"
                      style={{ height: `${Math.max((m.total / maxTendencia) * 120, 4)}px` }}
                    />
                    <span className="text-[10px] text-slate-500 capitalize">{m.mes}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Distribución por Área
            </CardTitle>
            <CardDescription>Costo salarial por departamento</CardDescription>
          </CardHeader>
          <CardContent>
            {data.distribucion_areas.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p className="text-sm">Sin datos de distribución</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {data.distribucion_areas.slice(0, 8).map((a, i) => {
                  const pct = (a.total / maxArea) * 100;
                  const colors = [
                    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-amber-500',
                    'bg-orange-500', 'bg-rose-500', 'bg-violet-500', 'bg-slate-500',
                  ];
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{a.nombre}</span>
                        <span className="text-slate-500">{fmt(a.total)}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {data.alertas.length > 0 && (
        <Card className="shadow-sm border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {data.alertas.map((a, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${a.severidad === 'ALTA' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  {a.severidad === 'ALTA' ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                  <span>{a.mensaje}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current planilla in progress */}
      {data.kpis.planilla_actual && (
        <Card className="shadow-sm border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Planilla en Progreso</p>
                  <p className="text-xs text-slate-500">
                    {data.kpis.planilla_actual.codigo} — {data.kpis.planilla_actual.tipo}
                    {data.kpis.planilla_actual.calculada_por && ` — Calculada por: ${data.kpis.planilla_actual.calculada_por}`}
                  </p>
                </div>
              </div>
              <Badge className={estadoColors[data.kpis.planilla_actual.estado] || 'bg-slate-100'} variant="secondary">
                {data.kpis.planilla_actual.estado}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

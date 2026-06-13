'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, Users, DollarSign, TrendingUp, Shield, Loader2, Briefcase, CheckCircle2, Target, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface TalentReportProps {
  accessToken: string;
  userRole: string;
}

interface PerfilPuesto {
  id: string;
  codigo: string;
  nombre_puesto: string;
  estado: string;
  puntos_total: number;
  requisitos_habilidades: string | null;
  responsabilidades: string | null;
  condiciones_trabajo: string | null;
  banda_salarial: { id: string; nombre: string; grado: number; salario_minimo: number; salario_maximo: number } | null;
  _count: { empleados_perfil: number };
  area: { nombre: string; codigo: string };
}

export default function TalentReport({ accessToken }: TalentReportProps) {
  const { toast } = useToast();
  const [data, setData] = useState<{
    costo_personal: { por_departamento: { area_nombre: string; area_codigo: string; num_empleados: number; costo_total: number; costo_promedio: number }[]; total_empleados: number; costo_total: number; costo_promedio: number };
    equidad_salarial: { por_genero: { masculino: { count: number; promedio: number }; femenino: { count: number; promedio: number } }; brecha_salarial_pct: number; distribucion_banda: Record<string, { M: number; F: number }> };
    rotacion: { tasa_rotacion_pct: number; nuevas_contrataciones: number; terminaciones: number; empleados_activos: number };
    pasivos_laborales: { reserva_vacaciones: number; reserva_aguinaldo: number; reserva_indemnizacion: number; total_pasivos: number };
  } | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilPuesto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [talentRes, perfilesRes] = await Promise.all([
        fetch('/api/reportes/talento', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('/api/perfiles', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (talentRes.ok) {
        setData(await talentRes.json());
      }
      if (perfilesRes.ok) {
        setPerfiles(await perfilesRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportCSV = (section: string) => {
    if (!data) return;
    let content = '';

    if (section === 'costo') {
      content = 'Departamento,Código,Empleados,Costo Total,Costo Promedio\n';
      content += data.costo_personal.por_departamento.map((d) =>
        `"${d.area_nombre}",${d.area_codigo},${d.num_empleados},${d.costo_total.toFixed(2)},${d.costo_promedio.toFixed(2)}`
      ).join('\n');
    } else if (section === 'equidad') {
      content = 'Género,Empleados,Salario Promedio\n';
      content += `Masculino,${data.equidad_salarial.por_genero.masculino.count},${data.equidad_salarial.por_genero.masculino.promedio.toFixed(2)}\n`;
      content += `Femenino,${data.equidad_salarial.por_genero.femenino.count},${data.equidad_salarial.por_genero.femenino.promedio.toFixed(2)}\n`;
      content += `\nBrecha Salarial,${data.equidad_salarial.brecha_salarial_pct.toFixed(2)}%\n`;
    } else if (section === 'rotacion') {
      content = 'Métrica,Valor\n';
      content += `Tasa Rotación,${data.rotacion.tasa_rotacion_pct.toFixed(2)}%\n`;
      content += `Nuevas Contrataciones,${data.rotacion.nuevas_contrataciones}\n`;
      content += `Terminaciones,${data.rotacion.terminaciones}\n`;
      content += `Empleados Activos,${data.rotacion.empleados_activos}\n`;
    } else if (section === 'pasivos') {
      content = 'Concepto,Monto\n';
      content += `Reserva Vacaciones,${data.pasivos_laborales.reserva_vacaciones.toFixed(2)}\n`;
      content += `Reserva Aguinaldo,${data.pasivos_laborales.reserva_aguinaldo.toFixed(2)}\n`;
      content += `Reserva Indemnización,${data.pasivos_laborales.reserva_indemnizacion.toFixed(2)}\n`;
      content += `Total Pasivos,${data.pasivos_laborales.total_pasivos.toFixed(2)}\n`;
    }

    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${section}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: `Reporte de ${section} descargado` });
  };

  // Compute profile stats
  const totalPerfiles = perfiles.length;
  const puestosVigentes = perfiles.filter((p) => p.estado === 'VIGENTE').length;
  const avgPuntos = totalPerfiles > 0
    ? perfiles.reduce((s, p) => s + p.puntos_total, 0) / totalPerfiles
    : 0;
  const uniqueBandas = new Set(perfiles.filter((p) => p.banda_salarial).map((p) => p.banda_salarial!.id)).size;

  // Compute radar chart dimensions (average points as a proportion of a max scale)
  const radarMax = 500; // assumed max points for scaling
  const avgHabilidades = avgPuntos * 0.30;
  const avgEsfuerzo = avgPuntos * 0.25;
  const avgResponsabilidad = avgPuntos * 0.28;
  const avgCondiciones = avgPuntos * 0.17;
  const radarData = [
    { label: 'Habilidades', value: avgHabilidades, pct: Math.min((avgHabilidades / radarMax) * 100, 100) },
    { label: 'Esfuerzo', value: avgEsfuerzo, pct: Math.min((avgEsfuerzo / radarMax) * 100, 100) },
    { label: 'Responsabilidad', value: avgResponsabilidad, pct: Math.min((avgResponsabilidad / radarMax) * 100, 100) },
    { label: 'Condiciones', value: avgCondiciones, pct: Math.min((avgCondiciones / radarMax) * 100, 100) },
  ];

  // Compute employee distribution by band
  const bandDistribution: Record<string, number> = {};
  perfiles.forEach((p) => {
    const bandName = p.banda_salarial?.nombre || 'Sin Banda';
    bandDistribution[bandName] = (bandDistribution[bandName] || 0) + p._count.empleados_perfil;
  });
  const maxBandCount = Math.max(...Object.values(bandDistribution), 1);
  const bandColors = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-amber-500', 'bg-orange-500', 'bg-rose-500', 'bg-violet-500'];

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Gestión de Talento</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="shadow-sm"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p>No se pudieron cargar los datos del reporte</p>
        </CardContent>
      </Card>
    );
  }

  const maxCosto = Math.max(...data.costo_personal.por_departamento.map((d) => d.costo_total), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Gestión de Talento</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Dashboard de indicadores de gestión de recursos humanos</p>
      </div>

      {/* Stat Cards Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Perfiles */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Briefcase className="h-16 w-16" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Total Perfiles</p>
          <p className="mt-1 text-2xl font-bold font-mono">{totalPerfiles}</p>
          <p className="text-xs opacity-80">de puesto</p>
        </div>

        {/* Puestos Vigentes */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <CheckCircle2 className="h-16 w-16" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Puestos Vigentes</p>
          <p className="mt-1 text-2xl font-bold font-mono">{puestosVigentes}</p>
          <p className="text-xs opacity-80">{totalPerfiles > 0 ? ((puestosVigentes / totalPerfiles) * 100).toFixed(0) : 0}% del total</p>
        </div>

        {/* Promedio Valuación */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Target className="h-16 w-16" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Prom. Puntos</p>
          <p className="mt-1 text-2xl font-bold font-mono">{avgPuntos.toFixed(0)}</p>
          <p className="text-xs opacity-80">valuación promedio</p>
        </div>

        {/* Bandas Salariales */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Layers className="h-16 w-16" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Bandas</p>
          <p className="mt-1 text-2xl font-bold font-mono">{uniqueBandas}</p>
          <p className="text-xs opacity-80">salariales activas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Skills Radar Chart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Target className="h-4 w-4 text-emerald-600" /> Valuación por Dimensiones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              {/* CSS Radar/Spider Chart - Diamond shape */}
              <div className="relative" style={{ width: '220px', height: '220px' }}>
                {/* Grid lines (concentric diamonds) */}
                {[25, 50, 75, 100].map((pct) => (
                  <div
                    key={pct}
                    className="absolute border border-slate-200 dark:border-slate-700 rounded-sm"
                    style={{
                      width: `${pct}%`,
                      height: `${pct}%`,
                      top: `${(100 - pct) / 2}%`,
                      left: `${(100 - pct) / 2}%`,
                      transform: 'rotate(45deg)',
                    }}
                  />
                ))}

                {/* Data polygon */}
                <svg
                  viewBox="0 0 220 220"
                  className="absolute inset-0"
                  style={{ width: '100%', height: '100%' }}
                >
                  {/* Axis lines */}
                  <line x1="110" y1="110" x2="110" y2="10" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-600" />
                  <line x1="110" y1="110" x2="210" y2="110" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-600" />
                  <line x1="110" y1="110" x2="110" y2="210" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-600" />
                  <line x1="110" y1="110" x2="10" y2="110" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-600" />

                  {/* Data shape */}
                  <polygon
                    points={radarData.map((d, i) => {
                      const angle = (i * 90 - 90) * (Math.PI / 180);
                      const r = (d.pct / 100) * 100;
                      const x = 110 + r * Math.cos(angle);
                      const y = 110 + r * Math.sin(angle);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="rgba(16, 185, 129, 0.2)"
                    stroke="rgb(16, 185, 129)"
                    strokeWidth="2"
                  />

                  {/* Data points */}
                  {radarData.map((d, i) => {
                    const angle = (i * 90 - 90) * (Math.PI / 180);
                    const r = (d.pct / 100) * 100;
                    const x = 110 + r * Math.cos(angle);
                    const y = 110 + r * Math.sin(angle);
                    return (
                      <circle key={i} cx={x} cy={y} r="4" fill="rgb(16, 185, 129)" stroke="white" strokeWidth="1.5" />
                    );
                  })}
                </svg>

                {/* Labels */}
                <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  Hab. {avgHabilidades.toFixed(0)}
                </span>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  Esf. {avgEsfuerzo.toFixed(0)}
                </span>
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  Res. {avgResponsabilidad.toFixed(0)}
                </span>
                <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  Con. {avgCondiciones.toFixed(0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Distribution by Band */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Users className="h-4 w-4 text-teal-600" /> Distribución por Banda Salarial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(bandDistribution).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Sin datos de distribución</p>
              ) : (
                Object.entries(bandDistribution).map(([bandName, count], idx) => (
                  <div key={bandName} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-24 truncate" title={bandName}>
                      {bandName}
                    </span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-7 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full ${bandColors[idx % bandColors.length]} transition-all duration-500`}
                        style={{ width: `${(count / maxBandCount) * 100}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-start pl-3 text-xs font-bold text-white mix-blend-difference">
                        {count} empleado{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400 w-8 text-right">
                      {count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 1. Costo de Personal */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Costo de Personal
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('costo')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">${data.costo_personal.costo_total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Promedio</p>
                <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">${data.costo_personal.costo_promedio.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Empleados</p>
                <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{data.costo_personal.total_empleados}</p>
              </div>
            </div>
            {/* Bar chart */}
            <div className="space-y-2">
              {data.costo_personal.por_departamento.map((dept) => (
                <div key={dept.area_codigo} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 w-24 truncate" title={dept.area_nombre}>{dept.area_nombre}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 dark:bg-emerald-600 rounded-full"
                      style={{ width: `${(dept.costo_total / maxCosto) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium font-mono w-20 text-right text-slate-700 dark:text-slate-300">
                    ${dept.costo_total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 2. Equidad Salarial */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Shield className="h-4 w-4 text-purple-600" /> Equidad Salarial
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('equidad')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400">Masculino</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{data.equidad_salarial.por_genero.masculino.count}</p>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400">${data.equidad_salarial.por_genero.masculino.promedio.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-pink-50 dark:bg-pink-950/50 rounded-lg p-3 text-center">
                <p className="text-xs text-pink-600 dark:text-pink-400">Femenino</p>
                <p className="text-lg font-bold text-pink-800 dark:text-pink-200">{data.equidad_salarial.por_genero.femenino.count}</p>
                <p className="text-xs font-mono text-pink-600 dark:text-pink-400">${data.equidad_salarial.por_genero.femenino.promedio.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
            <div className={`rounded-lg p-3 text-center ${Math.abs(data.equidad_salarial.brecha_salarial_pct) < 10 ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-amber-50 dark:bg-amber-950/50'}`}>
              <p className="text-xs text-slate-500 dark:text-slate-400">Brecha Salarial</p>
              <p className={`text-xl font-bold ${Math.abs(data.equidad_salarial.brecha_salarial_pct) < 10 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {data.equidad_salarial.brecha_salarial_pct.toFixed(1)}%
              </p>
            </div>
            {/* Band distribution */}
            {Object.entries(data.equidad_salarial.distribucion_banda).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Distribución por Banda</p>
                {Object.entries(data.equidad_salarial.distribucion_banda).map(([banda, gen]) => (
                  <div key={banda} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate text-slate-600 dark:text-slate-400">{banda}</span>
                    <div className="flex-1 flex h-4 rounded overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div className="bg-blue-400 dark:bg-blue-600 h-full" style={{ width: `${(gen.M / (gen.M + gen.F)) * 100}%` }} />
                      <div className="bg-pink-400 dark:bg-pink-600 h-full" style={{ width: `${(gen.F / (gen.M + gen.F)) * 100}%` }} />
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">{gen.M}M / {gen.F}F</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Rotación */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-4 w-4 text-amber-600" /> Rotación de Personal
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('rotacion')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasa de Rotación</p>
              <p className={`text-4xl font-bold font-mono ${data.rotacion.tasa_rotacion_pct > 15 ? 'text-red-600 dark:text-red-400' : data.rotacion.tasa_rotacion_pct > 8 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {data.rotacion.tasa_rotacion_pct.toFixed(1)}%
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg p-2">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Activos</p>
                <p className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-200">{data.rotacion.empleados_activos}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-2">
                <p className="text-xs text-blue-600 dark:text-blue-400">Ingresos</p>
                <p className="text-lg font-bold font-mono text-blue-800 dark:text-blue-200">{data.rotacion.nuevas_contrataciones}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/50 rounded-lg p-2">
                <p className="text-xs text-red-600 dark:text-red-400">Salidas</p>
                <p className="text-lg font-bold font-mono text-red-800 dark:text-red-200">{data.rotacion.terminaciones}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Pasivos Laborales */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Users className="h-4 w-4 text-teal-600" /> Pasivos Laborales
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('pasivos')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { label: 'Reserva Vacaciones', value: data.pasivos_laborales.reserva_vacaciones, color: 'bg-teal-400 dark:bg-teal-600' },
                { label: 'Reserva Aguinaldo', value: data.pasivos_laborales.reserva_aguinaldo, color: 'bg-amber-400 dark:bg-amber-600' },
                { label: 'Reserva Indemnización', value: data.pasivos_laborales.reserva_indemnizacion, color: 'bg-red-400 dark:bg-red-600' },
              ].map((item) => {
                const pct = (item.value / data.pasivos_laborales.total_pasivos) * 100;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                      <span className="font-medium font-mono text-slate-900 dark:text-slate-100">${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className={`${item.color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t dark:border-slate-700 pt-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Pasivos Laborales</p>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                ${data.pasivos_laborales.total_pasivos.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Profiles Table */}
      {perfiles.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Briefcase className="h-4 w-4 text-emerald-600" /> Perfiles de Puesto
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-slate-50 dark:bg-slate-800">
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Código</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Puesto</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Área</th>
                    <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Estado</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Puntos</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Banda</th>
                    <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Empleados</th>
                  </tr>
                </thead>
                <tbody>
                  {perfiles.map((perfil, idx) => (
                    <tr
                      key={perfil.id}
                      className={`border-b transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${
                        idx % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50/50 dark:bg-slate-800/50'
                      }`}
                    >
                      <td className="p-3">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{perfil.codigo}</span>
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={perfil.nombre_puesto}>
                        {perfil.nombre_puesto}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{perfil.area?.nombre || '-'}</td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={`inline-flex items-center gap-1.5 text-xs ${
                            perfil.estado === 'VIGENTE'
                              ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50'
                              : perfil.estado === 'BORRADOR'
                              ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50'
                              : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            perfil.estado === 'VIGENTE' ? 'bg-emerald-500' : perfil.estado === 'BORRADOR' ? 'bg-amber-500' : 'bg-slate-400'
                          }`} />
                          {perfil.estado}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        {perfil.puntos_total}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {perfil.banda_salarial ? `G${perfil.banda_salarial.grado} ${perfil.banda_salarial.nombre}` : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
                          <Users className="h-3.5 w-3.5" /> {perfil._count.empleados_perfil}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

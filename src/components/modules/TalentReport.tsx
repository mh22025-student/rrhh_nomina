'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, Users, DollarSign, TrendingUp, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface TalentReportProps {
  accessToken: string;
  userRole: string;
}

export default function TalentReport({ accessToken }: TalentReportProps) {
  const { toast } = useToast();
  const [data, setData] = useState<{
    costo_personal: { por_departamento: { area_nombre: string; area_codigo: string; num_empleados: number; costo_total: number; costo_promedio: number }[]; total_empleados: number; costo_total: number; costo_promedio: number };
    equidad_salarial: { por_genero: { masculino: { count: number; promedio: number }; femenino: { count: number; promedio: number } }; brecha_salarial_pct: number; distribucion_banda: Record<string, { M: number; F: number }> };
    rotacion: { tasa_rotacion_pct: number; nuevas_contrataciones: number; terminaciones: number; empleados_activos: number };
    pasivos_laborales: { reserva_vacaciones: number; reserva_aguinaldo: number; reserva_indemnizacion: number; total_pasivos: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reportes/talento', {
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

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Gestión de Talento</h2>
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
        <CardContent className="p-12 text-center text-slate-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p>No se pudieron cargar los datos del reporte</p>
        </CardContent>
      </Card>
    );
  }

  const maxCosto = Math.max(...data.costo_personal.por_departamento.map((d) => d.costo_total), 1);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Gestión de Talento</h2>
        <p className="text-sm text-slate-500">Dashboard de indicadores de gestión de recursos humanos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Costo de Personal */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Costo de Personal
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('costo')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-sm font-bold">${data.costo_personal.costo_total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Promedio</p>
                <p className="text-sm font-bold">${data.costo_personal.costo_promedio.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Empleados</p>
                <p className="text-sm font-bold">{data.costo_personal.total_empleados}</p>
              </div>
            </div>
            {/* Bar chart */}
            <div className="space-y-2">
              {data.costo_personal.por_departamento.map((dept) => (
                <div key={dept.area_codigo} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-24 truncate" title={dept.area_nombre}>{dept.area_nombre}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${(dept.costo_total / maxCosto) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-20 text-right">
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
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-600" /> Equidad Salarial
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('equidad')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600">Masculino</p>
                <p className="text-lg font-bold text-blue-800">{data.equidad_salarial.por_genero.masculino.count}</p>
                <p className="text-xs text-blue-600">${data.equidad_salarial.por_genero.masculino.promedio.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-pink-50 rounded-lg p-3 text-center">
                <p className="text-xs text-pink-600">Femenino</p>
                <p className="text-lg font-bold text-pink-800">{data.equidad_salarial.por_genero.femenino.count}</p>
                <p className="text-xs text-pink-600">${data.equidad_salarial.por_genero.femenino.promedio.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
            <div className={`rounded-lg p-3 text-center ${Math.abs(data.equidad_salarial.brecha_salarial_pct) < 10 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className="text-xs text-slate-500">Brecha Salarial</p>
              <p className={`text-xl font-bold ${Math.abs(data.equidad_salarial.brecha_salarial_pct) < 10 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {data.equidad_salarial.brecha_salarial_pct.toFixed(1)}%
              </p>
            </div>
            {/* Band distribution */}
            {Object.entries(data.equidad_salarial.distribucion_banda).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600">Distribución por Banda</p>
                {Object.entries(data.equidad_salarial.distribucion_banda).map(([banda, gen]) => (
                  <div key={banda} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate">{banda}</span>
                    <div className="flex-1 flex h-4 rounded overflow-hidden bg-slate-100">
                      <div className="bg-blue-400 h-full" style={{ width: `${(gen.M / (gen.M + gen.F)) * 100}%` }} />
                      <div className="bg-pink-400 h-full" style={{ width: `${(gen.F / (gen.M + gen.F)) * 100}%` }} />
                    </div>
                    <span className="text-slate-500">{gen.M}M / {gen.F}F</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Rotación */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" /> Rotación de Personal
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('rotacion')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-500">Tasa de Rotación</p>
              <p className={`text-4xl font-bold ${data.rotacion.tasa_rotacion_pct > 15 ? 'text-red-600' : data.rotacion.tasa_rotacion_pct > 8 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {data.rotacion.tasa_rotacion_pct.toFixed(1)}%
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="text-xs text-emerald-600">Activos</p>
                <p className="text-lg font-bold text-emerald-800">{data.rotacion.empleados_activos}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-xs text-blue-600">Ingresos</p>
                <p className="text-lg font-bold text-blue-800">{data.rotacion.nuevas_contrataciones}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-xs text-red-600">Salidas</p>
                <p className="text-lg font-bold text-red-800">{data.rotacion.terminaciones}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Pasivos Laborales */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600" /> Pasivos Laborales
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => exportCSV('pasivos')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { label: 'Reserva Vacaciones', value: data.pasivos_laborales.reserva_vacaciones, color: 'bg-teal-400' },
                { label: 'Reserva Aguinaldo', value: data.pasivos_laborales.reserva_aguinaldo, color: 'bg-amber-400' },
                { label: 'Reserva Indemnización', value: data.pasivos_laborales.reserva_indemnizacion, color: 'bg-red-400' },
              ].map((item) => {
                const pct = (item.value / data.pasivos_laborales.total_pasivos) * 100;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-medium">${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div className={`${item.color} h-full rounded-full`} style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t pt-3 text-center">
              <p className="text-xs text-slate-500">Total Pasivos Laborales</p>
              <p className="text-2xl font-bold text-slate-900">
                ${data.pasivos_laborales.total_pasivos.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

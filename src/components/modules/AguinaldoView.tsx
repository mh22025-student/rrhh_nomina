'use client';

import React, { useState } from 'react';
import {
  Gift, Calculator, Loader2, BookOpen, Download, Info, FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function AguinaldoView({ accessToken }: AguinaldoViewProps) {
  const { toast } = useToast();
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<AguinaldoResult | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

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
        body: JSON.stringify({ anio: parseInt(anio) }),
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

  return (
    <div className="space-y-4">
      {/* Year selection and calculate */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" /> Cálculo de Aguinaldo
          </CardTitle>
          <CardDescription>Arts. 196-202 Código de Trabajo de El Salvador</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="space-y-2">
              <Label>Año</Label>
              <Input
                type="number"
                value={anio}
                onChange={e => setAnio(e.target.value)}
                placeholder="2026"
                className="w-32"
              />
            </div>
            <Button
              onClick={handleCalculate}
              disabled={calculating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {calculating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
              Calcular Aguinaldo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Legal references */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <p><strong>Arts. 196-202 CT:</strong> Derecho al aguinaldo según años de servicio:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>1 a &lt;3 años: 15 días de salario</li>
                <li>3 a &lt;10 años: 19 días de salario</li>
                <li>10+ años: 21 días de salario</li>
                <li>Proporcional si no completó el año: (días/360) × salario_diario × días_aguinaldo</li>
              </ul>
              <p><strong>Exención ISR:</strong> Hasta 2× salario mínimo del sector</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <Card className="shadow-sm border-emerald-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Empleados</p>
                  <p className="text-lg font-bold">{result.planilla.total_empleados}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Bruto</p>
                  <p className="text-lg font-bold">{fmt(result.planilla.total_aguinaldo_bruto)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total ISR</p>
                  <p className="text-lg font-bold text-red-600">-{fmt(result.planilla.total_aguinaldo_bruto - result.planilla.total_aguinaldo_neto)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Neto</p>
                  <p className="text-lg font-bold text-emerald-700">{fmt(result.planilla.total_aguinaldo_neto)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee list */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Detalle por Empleado</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-b bg-slate-50/80">
                      <th className="text-left font-medium text-slate-500 p-3">Código</th>
                      <th className="text-left font-medium text-slate-500 p-3">Nombre</th>
                      <th className="text-right font-medium text-slate-500 p-3">Años Serv.</th>
                      <th className="text-center font-medium text-slate-500 p-3">Días Aguinaldo</th>
                      <th className="text-right font-medium text-slate-500 p-3">Salario Base</th>
                      <th className="text-right font-medium text-slate-500 p-3">Bruto</th>
                      <th className="text-right font-medium text-slate-500 p-3">ISR</th>
                      <th className="text-right font-medium text-slate-500 p-3">Neto</th>
                      <th className="text-center font-medium text-slate-500 p-3">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.resultados.map(r => (
                      <tr key={r.empleado_id} className="border-b hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-mono text-xs">{r.codigo_empleado}</td>
                        <td className="p-3">{r.nombre}</td>
                        <td className="p-3 text-right">{r.anios_servicio.toFixed(1)}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-[10px]">{getDiasAguinaldo(r.anios_servicio)}</Badge>
                          <span className="text-xs text-slate-400 ml-1">({r.dias_aguinaldo.toFixed(1)}d)</span>
                        </td>
                        <td className="p-3 text-right">{fmt(r.salario_base)}</td>
                        <td className="p-3 text-right font-medium">{fmt(r.aguinaldo_bruto)}</td>
                        <td className="p-3 text-right text-red-600">{r.isr_aguinaldo > 0 ? `-${fmt(r.isr_aguinaldo)}` : '-'}</td>
                        <td className="p-3 text-right font-bold text-emerald-700">{fmt(r.aguinaldo_neto)}</td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
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
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Parameters used */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-500">
                  <p><strong>Parámetros utilizados:</strong> {result.parametros_utilizados.exencion_isr}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

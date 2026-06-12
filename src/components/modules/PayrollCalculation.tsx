'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator, Users, FileText, DollarSign, Shield, CheckCircle,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, Download,
  ArrowLeft, ArrowRight, RefreshCw, Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface PayrollCalculationProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STEPS = [
  { num: 1, label: 'Seleccionar Período', icon: FileText },
  { num: 2, label: 'Verificar Empleados', icon: Users },
  { num: 3, label: 'Cargar Incidencias', icon: AlertTriangle },
  { num: 4, label: 'Salarios Brutos', icon: DollarSign },
  { num: 5, label: 'Deducciones', icon: Shield },
  { num: 6, label: 'Descuentos Adicionales', icon: Calculator },
  { num: 7, label: 'Salarios Netos', icon: DollarSign },
  { num: 8, label: 'Revisar y Confirmar', icon: CheckCircle },
];

interface CalculationResult {
  planilla: {
    id: string;
    codigo_planilla: string;
    tipo: string;
    estado: string;
    total_empleados: number;
    total_salarios_brutos: number;
    total_isss_laboral: number;
    total_afp_laboral: number;
    total_isr_retenido: number;
    total_descuentos: number;
    total_neto_a_pagar: number;
    total_cargas_patronales: number;
  };
  detalles: Array<{
    empleado_id: string;
    salario_base: number;
    total_horas_extra: number;
    total_comisiones: number;
    total_bonos: number;
    salario_bruto: number;
    isss_laboral: number;
    afp_laboral: number;
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
}

export default function PayrollCalculation({ accessToken }: PayrollCalculationProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipo, setTipo] = useState('MENSUAL');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [empleados, setEmpleados] = useState<Array<{ id: string; codigo: string; nombre: string; tieneContrato: boolean; tieneISSS: boolean; tieneAFP: boolean }>>([]);
  const [incidencias, setIncidencias] = useState<Array<{ empleado: string; tipo: string; monto: number; horas: number | null; estado: string }>>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch employees and incidences when step changes
  const fetchPreviewData = useCallback(async () => {
    if (!fechaInicio || !fechaFin) return;
    setLoadingData(true);
    try {
      // Get employees for preview
      const empRes = await fetch('/api/nomina/planillas?limit=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // We'll just use the calculation result for employee data
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, fechaInicio, fechaFin]);

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
      // Populate employees from details
      setEmpleados(data.detalles.map((d: CalculationResult['detalles'][0]) => ({
        id: d.empleado_id,
        codigo: d.empleado_id.substring(0, 8),
        nombre: d.observaciones || 'Empleado',
        tieneContrato: true,
        tieneISSS: true,
        tieneAFP: true,
      })));
      setIncidencias(
        data.detalles
          .filter((d: CalculationResult['detalles'][0]) => d.total_horas_extra > 0 || d.total_comisiones > 0 || d.total_bonos > 0)
          .map((d: CalculationResult['detalles'][0]) => ({
            empleado: d.empleado_id.substring(0, 8),
            tipo: 'Mixto',
            monto: d.total_horas_extra + d.total_comisiones + d.total_bonos,
            horas: d.total_horas_extra > 0 ? d.total_horas_extra : null,
            estado: 'APROBADA',
          }))
      );
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

  const nextStep = () => setStep(Math.min(step + 1, 8));
  const prevStep = () => setStep(Math.max(step - 1, 1));

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Seleccionar Período</CardTitle>
              <CardDescription>Defina el rango de fechas y tipo de nómina</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Nómina</Label>
                <div className="flex gap-2">
                  {['MENSUAL', 'QUINCENAL'].map(t => (
                    <Button
                      key={t}
                      variant={tipo === t ? 'default' : 'outline'}
                      className={tipo === t ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      onClick={() => setTipo(t)}
                    >
                      {t === 'MENSUAL' ? 'Mensual' : 'Quincenal'}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Fin</Label>
                  <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
                </div>
              </div>
              {fechaInicio && fechaFin && (
                <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800">
                  <strong>Período:</strong> {new Date(fechaInicio).toLocaleDateString('es-SV')} — {new Date(fechaFin).toLocaleDateString('es-SV')} ({tipo})
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Verificar Empleados</CardTitle>
              <CardDescription>Confirmar que los empleados activos tienen contrato vigente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-amber-50 rounded-lg text-sm text-amber-800 mb-4">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Los empleados sin contrato activo serán excluidos del cálculo.
              </div>
              <p className="text-sm text-slate-500">
                Los datos de empleados se cargarán durante el cálculo. Continúe al siguiente paso.
              </p>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Cargar Incidencias</CardTitle>
              <CardDescription>Incidencias aprobadas del período serán aplicadas automáticamente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-emerald-50 rounded-lg text-sm text-emerald-800 mb-4">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                Solo se aplicarán incidencias en estado &quot;APROBADA&quot; dentro del rango de fechas.
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <p><strong>Tipos de incidencia soportados:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>HORAS_EXTRA: Diurna (×2.0), Nocturna (×2.5), Descanso (×3.0), Asueto (×3.0)</li>
                  <li>COMISION: Monto directo</li>
                  <li>BONO: Monto directo</li>
                  <li>DESCUENTO_ESPECIAL: Cuota alimenticia, préstamo, seguro, otros</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Salarios Brutos</CardTitle>
              <CardDescription>Salario base + incidencias remunerativas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-lg text-sm space-y-2">
                <p><strong>Fórmula:</strong></p>
                <p className="font-mono text-xs bg-white p-2 rounded">Salario Bruto = Salario Base + Horas Extra + Comisiones + Bonos</p>
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Deducciones Legales</CardTitle>
              <CardDescription>ISSS, AFP e ISR según parámetros legales vigentes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-lg text-sm space-y-2">
                <p><strong>ISSS Laboral:</strong> MIN(Salario Bruto, $1,000) × 3.00% = máx $30.00/mes</p>
                <p><strong>AFP Laboral:</strong> Salario Bruto × 7.25% (sin tope)</p>
                <p><strong>Renta Imponible:</strong> Bruto − ISSS − AFP</p>
                <p><strong>ISR:</strong> Según tabla de tramos vigente</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                Art. 169 CT: Horas extra diurnas = 100% recargo. Los tramos ISR se leen de parámetros_legales.
              </div>
            </CardContent>
          </Card>
        );

      case 6:
        return (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Descuentos Adicionales</CardTitle>
              <CardDescription>Cuota alimenticia, préstamos, seguros y otros</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 rounded-lg text-sm space-y-2">
                <p><strong>Prioridad de descuentos:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Cuota alimenticia (mayor prioridad)</li>
                  <li>Préstamo patronal</li>
                  <li>Seguro complementario</li>
                  <li>Otros descuentos</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        );

      case 7:
        return (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Salarios Netos</CardTitle>
              <CardDescription>Resultado final después de todas las deducciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 rounded-lg text-sm space-y-2">
                <p><strong>Fórmula:</strong></p>
                <p className="font-mono text-xs bg-white p-2 rounded">Neto = Bruto − ISSS − AFP − ISR − Descuentos Especiales</p>
                <div className="p-3 bg-red-50 rounded-lg text-xs text-red-700 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  Si el salario neto resulta ≤ $0.00, se generará una anomalía de severidad ALTA.
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 8:
        return (
          <div className="space-y-4">
            {result ? (
              <>
                {/* Summary totals */}
                <Card className="shadow-sm border-emerald-200">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Total Bruto</p>
                        <p className="text-lg font-bold text-slate-900">{fmt(result.planilla.total_salarios_brutos)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Deducciones</p>
                        <p className="text-lg font-bold text-red-600">-{fmt(result.planilla.total_descuentos)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Neto</p>
                        <p className="text-lg font-bold text-emerald-700">{fmt(result.planilla.total_neto_a_pagar)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Cargas Patronales</p>
                        <p className="text-lg font-bold text-slate-700">{fmt(result.planilla.total_cargas_patronales)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Anomalies */}
                {result.anomalies.length > 0 && (
                  <Card className="shadow-sm border-amber-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="h-4 w-4" /> Anomalías Detectadas ({result.anomalies.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {result.anomalies.map((a, i) => (
                          <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${a.severidad === 'ALTA' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">{a.tipo.replace(/_/g, ' ')}</p>
                              <p>{a.empleado_nombre}: {a.detalle}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Employee details table */}
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
                            <th className="text-left font-medium text-slate-500 p-3 w-8"></th>
                            <th className="text-left font-medium text-slate-500 p-3">Empleado</th>
                            <th className="text-right font-medium text-slate-500 p-3">Salario Base</th>
                            <th className="text-right font-medium text-slate-500 p-3">Bruto</th>
                            <th className="text-right font-medium text-slate-500 p-3">ISSS</th>
                            <th className="text-right font-medium text-slate-500 p-3">AFP</th>
                            <th className="text-right font-medium text-slate-500 p-3">ISR</th>
                            <th className="text-right font-medium text-slate-500 p-3">Neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.detalles.map((d) => (
                            <React.Fragment key={d.empleado_id}>
                              <tr
                                className="border-b hover:bg-slate-50/50 cursor-pointer transition-colors"
                                onClick={() => setExpandedRow(expandedRow === d.empleado_id ? null : d.empleado_id)}
                              >
                                <td className="p-3">
                                  {expandedRow === d.empleado_id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </td>
                                <td className="p-3 font-mono text-xs">{d.empleado_id.substring(0, 8)}...</td>
                                <td className="p-3 text-right">{fmt(d.salario_base)}</td>
                                <td className="p-3 text-right font-medium">{fmt(d.salario_bruto)}</td>
                                <td className="p-3 text-right text-red-600">-{fmt(d.isss_laboral)}</td>
                                <td className="p-3 text-right text-red-600">-{fmt(d.afp_laboral)}</td>
                                <td className="p-3 text-right text-red-600">-{fmt(d.isr_retenido)}</td>
                                <td className="p-3 text-right font-bold text-emerald-700">{fmt(d.salario_neto)}</td>
                              </tr>
                              {expandedRow === d.empleado_id && (
                                <tr>
                                  <td colSpan={8} className="bg-slate-50/50 p-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                      <div><span className="text-slate-500">Horas Extra:</span> <span className="font-medium">{fmt(d.total_horas_extra)}</span></div>
                                      <div><span className="text-slate-500">Comisiones:</span> <span className="font-medium">{fmt(d.total_comisiones)}</span></div>
                                      <div><span className="text-slate-500">Bonos:</span> <span className="font-medium">{fmt(d.total_bonos)}</span></div>
                                      <div><span className="text-slate-500">Renta Imponible:</span> <span className="font-medium">{fmt(d.renta_imponible)}</span></div>
                                      <div><span className="text-slate-500">Cuota Alimenticia:</span> <span className="font-medium">{fmt(d.cuota_alimenticia)}</span></div>
                                      <div><span className="text-slate-500">Préstamo:</span> <span className="font-medium">{fmt(d.prestamo_patronal)}</span></div>
                                      <div><span className="text-slate-500">Seguro:</span> <span className="font-medium">{fmt(d.seguro_complementario)}</span></div>
                                      <div><span className="text-slate-500">Otros Desc:</span> <span className="font-medium">{fmt(d.otros_descuentos)}</span></div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center">
                  <Calculator className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Ejecute el cálculo para ver resultados</p>
                  <p className="text-slate-400 text-sm mt-1">Complete los pasos anteriores y presione &quot;Ejecutar Cálculo&quot;</p>
                </CardContent>
              </Card>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.num}>
            <button
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                step === s.num
                  ? 'bg-emerald-100 text-emerald-800'
                  : step > s.num
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.num}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      {renderStepContent()}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={prevStep} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < 8 ? (
          <Button onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700">
            Siguiente <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="flex gap-2">
            {!result && (
              <Button onClick={handleCalculate} disabled={calculating} className="bg-emerald-600 hover:bg-emerald-700">
                {calculating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</> : <><Calculator className="h-4 w-4 mr-1" /> Ejecutar Cálculo</>}
              </Button>
            )}
            {result && (
              <Button variant="outline" onClick={() => { setResult(null); setStep(1); }}>
                <RefreshCw className="h-4 w-4 mr-1" /> Nuevo Cálculo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

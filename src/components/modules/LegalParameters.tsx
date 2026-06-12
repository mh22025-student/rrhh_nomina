'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Scale, Plus, Clock, AlertTriangle, Loader2, CheckCircle, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface LegalParametersProps {
  accessToken: string;
  userRole: string;
}

interface Parametro {
  id: string; descripcion_cambio: string; decreto_norma_origen: string;
  tasa_isss_laboral: number; tasa_isss_patronal: number; tope_cotizacion_isss: number;
  tasa_afp_laboral: number; tasa_afp_patronal: number; tasa_insaforp: number;
  empleados_minimos_insaforp: number; fecha_vigencia_desde: string; fecha_vigencia_hasta: string | null;
  estado: string; creado_por: { nombre: string; apellido: string } | null;
  tramos_isr: { id: string; numero_tramo: number; desde: number; hasta: number | null; porcentaje: number; cuota_fija: number }[];
  salarios_minimos: { id: string; sector: string; salario_mensual: number }[];
}

export default function LegalParameters({ accessToken, userRole }: LegalParametersProps) {
  const { toast } = useToast();
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [vigente, setVigente] = useState<Parametro | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    descripcion_cambio: '', decreto_norma_origen: '',
    tasa_isss_laboral: 0.03, tasa_isss_patronal: 0.075, tope_cotizacion_isss: 1000,
    tasa_afp_laboral: 0.0725, tasa_afp_patronal: 0.0875, tasa_insaforp: 0.01,
    empleados_minimos_insaforp: 10, fecha_vigencia_desde: '',
    tramos_isr: [
      { numero_tramo: 1, desde: 0.01, hasta: 472.00, porcentaje: 0, cuota_fija: 0 },
      { numero_tramo: 2, desde: 472.01, hasta: 895.24, porcentaje: 0.10, cuota_fija: 17.67 },
      { numero_tramo: 3, desde: 895.25, hasta: 2038.10, porcentaje: 0.20, cuota_fija: 85.68 },
      { numero_tramo: 4, desde: 2038.11, hasta: null, porcentaje: 0.30, cuota_fija: 314.50 },
    ],
    salarios_minimos: [
      { sector: 'COMERCIO', salario_mensual: 365.00 },
      { sector: 'INDUSTRIA', salario_mensual: 365.00 },
      { sector: 'SERVICIOS', salario_mensual: 365.00 },
      { sector: 'AGROPECUARIO', salario_mensual: 243.70 },
      { sector: 'MAQUILA', salario_mensual: 323.42 },
      { sector: 'GOBIERNO', salario_mensual: 365.00 },
    ],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vigRes, allRes] = await Promise.all([
        fetch('/api/admin/parametros/vigente', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/admin/parametros', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      if (vigRes.ok) {
        const vigData = await vigRes.json();
        setVigente(vigData);
        // Pre-fill form with current values
        setForm((prev) => ({
          ...prev,
          tasa_isss_laboral: vigData.tasa_isss_laboral,
          tasa_isss_patronal: vigData.tasa_isss_patronal,
          tope_cotizacion_isss: vigData.tope_cotizacion_isss,
          tasa_afp_laboral: vigData.tasa_afp_laboral,
          tasa_afp_patronal: vigData.tasa_afp_patronal,
          tasa_insaforp: vigData.tasa_insaforp,
          empleados_minimos_insaforp: vigData.empleados_minimos_insaforp,
          tramos_isr: vigData.tramos_isr.map((t: { numero_tramo: number; desde: number; hasta: number | null; porcentaje: number; cuota_fija: number }) => ({
            numero_tramo: t.numero_tramo, desde: t.desde, hasta: t.hasta, porcentaje: t.porcentaje, cuota_fija: t.cuota_fija,
          })),
          salarios_minimos: vigData.salarios_minimos.map((s: { sector: string; salario_mensual: number }) => ({
            sector: s.sector, salario_mensual: s.salario_mensual,
          })),
        }));
      }
      if (allRes.ok) setParametros(await allRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.descripcion_cambio || !form.decreto_norma_origen || !form.fecha_vigencia_desde) {
      toast({ title: 'Error', description: 'Descripción, decreto y fecha de vigencia son requeridos', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/parametros', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ title: 'Parámetro creado', description: 'El nuevo parámetro legal ha sido registrado exitosamente' });
        setShowCreateDialog(false);
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Error al crear parámetro', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const canCreate = userRole === 'ADMIN' || userRole === 'APROBADOR';

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Parámetros Legales</h2>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Parámetros Legales</h2>
          <p className="text-sm text-slate-500">Gestión de tasas, tramos y salarios mínimos vigentes</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Nuevo Parámetro
          </Button>
        )}
      </div>

      {/* Inmutabilidad warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Inmutabilidad Retroactiva</p>
          <p className="text-xs text-amber-700">Los parámetros legales nunca se modifican. Solo se crean nuevos con fecha de vigencia futura, y el anterior es marcado como REEMPLAZADO.</p>
        </div>
      </div>

      {/* Current Active Parameter */}
      {vigente && (
        <Card className="shadow-sm border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" /> Parámetro Vigente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">ISSS Laboral</p>
                <p className="text-lg font-bold">{(vigente.tasa_isss_laboral * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">ISSS Patronal</p>
                <p className="text-lg font-bold">{(vigente.tasa_isss_patronal * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">AFP Laboral</p>
                <p className="text-lg font-bold">{(vigente.tasa_afp_laboral * 100).toFixed(2)}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">AFP Patronal</p>
                <p className="text-lg font-bold">{(vigente.tasa_afp_patronal * 100).toFixed(2)}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">Tope ISSS</p>
                <p className="text-lg font-bold">${vigente.tope_cotizacion_isss.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">INSAFORP</p>
                <p className="text-lg font-bold">{(vigente.tasa_insaforp * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">Vigencia Desde</p>
                <p className="text-lg font-bold">{new Date(vigente.fecha_vigencia_desde).toLocaleDateString('es-SV')}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">Decreto</p>
                <p className="text-sm font-bold truncate" title={vigente.decreto_norma_origen}>{vigente.decreto_norma_origen}</p>
              </div>
            </div>

            {/* Tramos ISR */}
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-sm font-semibold text-slate-700 mb-2">Tramos ISR</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center p-1.5 font-semibold">Tramo</th>
                      <th className="text-right p-1.5 font-semibold">Desde</th>
                      <th className="text-right p-1.5 font-semibold">Hasta</th>
                      <th className="text-right p-1.5 font-semibold">% ISR</th>
                      <th className="text-right p-1.5 font-semibold">Cuota Fija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vigente.tramos_isr.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="p-1.5 text-center">{t.numero_tramo}</td>
                        <td className="p-1.5 text-right">${t.desde.toFixed(2)}</td>
                        <td className="p-1.5 text-right">{t.hasta ? `$${t.hasta.toFixed(2)}` : '∞'}</td>
                        <td className="p-1.5 text-right">{(t.porcentaje * 100).toFixed(0)}%</td>
                        <td className="p-1.5 text-right">${t.cuota_fija.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Salarios mínimos */}
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-sm font-semibold text-slate-700 mb-2">Salarios Mínimos por Sector</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {vigente.salarios_minimos.map((s) => (
                  <div key={s.id} className="bg-slate-50 rounded p-2 text-center">
                    <p className="text-xs text-slate-500">{s.sector}</p>
                    <p className="text-sm font-bold">${s.salario_mensual.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Timeline */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" /> Historial de Parámetros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-4">
            {/* Timeline line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />

            {parametros.map((param, idx) => (
              <div key={param.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-3 top-1.5 w-4 h-4 rounded-full border-2 ${
                  param.estado === 'ACTIVO' ? 'bg-emerald-500 border-emerald-600' :
                  param.estado === 'REEMPLAZADO' ? 'bg-slate-300 border-slate-400' :
                  'bg-gray-300 border-gray-400'
                }`} />

                <div className={`border rounded-lg p-3 ${param.estado === 'ACTIVO' ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={
                      param.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-slate-100 text-slate-600'
                    }>
                      {param.estado}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {new Date(param.fecha_vigencia_desde).toLocaleDateString('es-SV')}
                      {param.fecha_vigencia_hasta && ` — ${new Date(param.fecha_vigencia_hasta).toLocaleDateString('es-SV')}`}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{param.descripcion_cambio}</p>
                  <p className="text-xs text-slate-500">{param.decreto_norma_origen}</p>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>ISSS: {(param.tasa_isss_laboral * 100).toFixed(1)}%/{(param.tasa_isss_patronal * 100).toFixed(1)}%</span>
                    <span>AFP: {(param.tasa_afp_laboral * 100).toFixed(2)}%/{(param.tasa_afp_patronal * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            ))}

            {parametros.length === 0 && (
              <p className="text-sm text-slate-500">No hay parámetros registrados</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-emerald-600" /> Nuevo Parámetro Legal
            </DialogTitle>
            <DialogDescription>Cree un nuevo conjunto de parámetros legales con vigencia futura</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">El parámetro actual será marcado como REEMPLAZADO al crear uno nuevo. Los valores se pre-llenan con los del parámetro vigente.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label>Descripción del Cambio *</Label>
                <Textarea value={form.descripcion_cambio} onChange={(e) => setForm({ ...form, descripcion_cambio: e.target.value })} placeholder="Ej: Actualización anual de tasas..." />
              </div>
              <div className="space-y-2">
                <Label>Decreto / Norma de Origen *</Label>
                <Input value={form.decreto_norma_origen} onChange={(e) => setForm({ ...form, decreto_norma_origen: e.target.value })} placeholder="Ej: Decreto Ejecutivo No. 45" />
              </div>
              <div className="space-y-2">
                <Label>Fecha Vigencia Desde * (debe ser futura)</Label>
                <Input type="date" value={form.fecha_vigencia_desde} onChange={(e) => setForm({ ...form, fecha_vigencia_desde: e.target.value })} />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">Tasas de Cotización</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">ISSS Laboral</Label>
                  <Input type="number" step="0.001" value={form.tasa_isss_laboral} onChange={(e) => setForm({ ...form, tasa_isss_laboral: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ISSS Patronal</Label>
                  <Input type="number" step="0.001" value={form.tasa_isss_patronal} onChange={(e) => setForm({ ...form, tasa_isss_patronal: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tope ISSS</Label>
                  <Input type="number" step="1" value={form.tope_cotizacion_isss} onChange={(e) => setForm({ ...form, tope_cotizacion_isss: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">AFP Laboral</Label>
                  <Input type="number" step="0.001" value={form.tasa_afp_laboral} onChange={(e) => setForm({ ...form, tasa_afp_laboral: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">AFP Patronal</Label>
                  <Input type="number" step="0.001" value={form.tasa_afp_patronal} onChange={(e) => setForm({ ...form, tasa_afp_patronal: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">INSAFORP</Label>
                  <Input type="number" step="0.001" value={form.tasa_insaforp} onChange={(e) => setForm({ ...form, tasa_insaforp: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">Tramos ISR</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="p-2 text-center">Tramo</th>
                      <th className="p-2">Desde</th>
                      <th className="p-2">Hasta</th>
                      <th className="p-2">Porcentaje</th>
                      <th className="p-2">Cuota Fija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.tramos_isr.map((t, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 text-center"><Badge variant="outline">{t.numero_tramo}</Badge></td>
                        <td className="p-1"><Input type="number" step="0.01" value={t.desde} onChange={(e) => {
                          const newTramos = [...form.tramos_isr];
                          newTramos[idx] = { ...t, desde: parseFloat(e.target.value) || 0 };
                          setForm({ ...form, tramos_isr: newTramos });
                        }} className="h-8 text-sm" /></td>
                        <td className="p-1"><Input type="number" step="0.01" value={t.hasta || ''} onChange={(e) => {
                          const newTramos = [...form.tramos_isr];
                          newTramos[idx] = { ...t, hasta: e.target.value ? parseFloat(e.target.value) : null };
                          setForm({ ...form, tramos_isr: newTramos });
                        }} className="h-8 text-sm" placeholder="∞" /></td>
                        <td className="p-1"><Input type="number" step="0.01" value={t.porcentaje} onChange={(e) => {
                          const newTramos = [...form.tramos_isr];
                          newTramos[idx] = { ...t, porcentaje: parseFloat(e.target.value) || 0 };
                          setForm({ ...form, tramos_isr: newTramos });
                        }} className="h-8 text-sm" /></td>
                        <td className="p-1"><Input type="number" step="0.01" value={t.cuota_fija} onChange={(e) => {
                          const newTramos = [...form.tramos_isr];
                          newTramos[idx] = { ...t, cuota_fija: parseFloat(e.target.value) || 0 };
                          setForm({ ...form, tramos_isr: newTramos });
                        }} className="h-8 text-sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">Salarios Mínimos por Sector</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {form.salarios_minimos.map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <Label className="text-xs">{s.sector}</Label>
                    <Input type="number" step="0.01" value={s.salario_mensual} onChange={(e) => {
                      const newSalarios = [...form.salarios_minimos];
                      newSalarios[idx] = { ...s, salario_mensual: parseFloat(e.target.value) || 0 };
                      setForm({ ...form, salarios_minimos: newSalarios });
                    }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Parámetro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

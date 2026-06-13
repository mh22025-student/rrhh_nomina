'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scale, Plus, Clock, AlertTriangle, Loader2, CheckCircle, History,
  ChevronRight, ChevronDown, Shield, TrendingUp, Eye, ShoppingBag,
  Factory, Wrench, Tractor, Building2, Landmark, PieChart, Lock,
  ChevronLeft, ChevronRight as ChevronRightIcon, Info, FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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

const sectorConfig: Record<string, { icon: React.ReactNode; gradient: string; bgLight: string; bgDark: string; label: string }> = {
  COMERCIO: { icon: <ShoppingBag className="h-4 w-4" />, gradient: 'from-emerald-500 to-emerald-600', bgLight: 'bg-emerald-50', bgDark: 'dark:bg-emerald-900/20', label: 'Comercio' },
  INDUSTRIA: { icon: <Factory className="h-4 w-4" />, gradient: 'from-teal-500 to-teal-600', bgLight: 'bg-teal-50', bgDark: 'dark:bg-teal-900/20', label: 'Industria' },
  SERVICIOS: { icon: <Wrench className="h-4 w-4" />, gradient: 'from-cyan-500 to-cyan-600', bgLight: 'bg-cyan-50', bgDark: 'dark:bg-cyan-900/20', label: 'Servicios' },
  AGROPECUARIO: { icon: <Tractor className="h-4 w-4" />, gradient: 'from-amber-500 to-amber-600', bgLight: 'bg-amber-50', bgDark: 'dark:bg-amber-900/20', label: 'Agropecuario' },
  MAQUILA: { icon: <Building2 className="h-4 w-4" />, gradient: 'from-rose-500 to-rose-600', bgLight: 'bg-rose-50', bgDark: 'dark:bg-rose-900/20', label: 'Maquila' },
  GOBIERNO: { icon: <Landmark className="h-4 w-4" />, gradient: 'from-violet-500 to-violet-600', bgLight: 'bg-violet-50', bgDark: 'dark:bg-violet-900/20', label: 'Gobierno' },
};

function getSectorConfig(sector: string) {
  return sectorConfig[sector] || sectorConfig.COMERCIO;
}

const tramoColors = [
  { from: 'from-emerald-400', to: 'to-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  { from: 'from-teal-400', to: 'to-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', bar: 'bg-teal-500' },
  { from: 'from-amber-400', to: 'to-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
  { from: 'from-red-400', to: 'to-red-500', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', bar: 'bg-red-500' },
];

export default function LegalParameters({ accessToken, userRole }: LegalParametersProps) {
  const { toast } = useToast();
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [vigente, setVigente] = useState<Parametro | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewingParam, setViewingParam] = useState<Parametro | null>(null);
  const [wizardStep, setWizardStep] = useState(1);

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
        setWizardStep(1);
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

  // Patronal charges calculation
  const patronalCharges = useMemo(() => {
    if (!vigente) return null;
    const isss = vigente.tasa_isss_patronal * 100;
    const afp = vigente.tasa_afp_patronal * 100;
    const insaforp = vigente.tasa_insaforp * 100;
    const total = isss + afp + insaforp;
    return { isss, afp, insaforp, total };
  }, [vigente]);

  // Max salary for bar chart
  const maxSalary = useMemo(() => {
    if (!vigente) return 1;
    return Math.max(...vigente.salarios_minimos.map(s => s.salario_mensual));
  }, [vigente]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full dark:bg-slate-700" />
        <Skeleton className="h-48 w-full dark:bg-slate-700" />
        <Skeleton className="h-32 w-full dark:bg-slate-700" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gradient Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0zMHY2aC02VjRoNnptMCAxMHY2aC02di02aDZ6bTAgMTB2NmgtNnYtNmg2em0tMTAgMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2em0tMTAgMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Scale className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Parámetros Legales — El Salvador 2026</h2>
                  <p className="text-emerald-100 text-xs mt-0.5 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Decreto Legislativo No. 523 — Código de Trabajo
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs px-3 py-1.5">
                <Lock className="h-3 w-3 mr-1.5" /> Inmutables una vez creados
              </Badge>
              {canCreate && (
                <Button
                  onClick={() => { setWizardStep(1); setShowCreateDialog(true); }}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" /> Nuevo Parámetro
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inmutabilidad warning */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg shrink-0">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Inmutabilidad Retroactiva</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Los parámetros legales nunca se modifican. Solo se crean nuevos con fecha de vigencia futura, y el anterior es marcado como REEMPLAZADO.</p>
        </div>
      </div>

      {/* Parameter Version Timeline */}
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
            <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Línea de Tiempo de Versiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto pb-2 custom-scrollbar">
            {parametros.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay parámetros registrados</p>
            ) : (
              parametros.map((param, idx) => {
                const isActivo = param.estado === 'ACTIVO';
                const year = new Date(param.fecha_vigencia_desde).getFullYear();
                return (
                  <React.Fragment key={param.id}>
                    <button
                      onClick={() => setViewingParam(param)}
                      className={`flex flex-col items-center min-w-[100px] p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                        isActivo
                          ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 ${
                        isActivo
                          ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}>
                        {isActivo ? (
                          <CheckCircle className="h-4 w-4 text-white" />
                        ) : (
                          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      <span className={`text-sm font-bold ${isActivo ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>{year}</span>
                      <Badge className={`text-[9px] mt-1 ${isActivo ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                        {param.estado}
                      </Badge>
                    </button>
                    {idx < parametros.length - 1 && (
                      <div className="flex items-center px-1">
                        <ChevronRightIcon className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Viewing past parameter dialog */}
      {viewingParam && viewingParam.estado !== 'ACTIVO' && (
        <Card className="shadow-sm border-amber-200 dark:border-amber-800 dark:bg-slate-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
                <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Parámetro Histórico — Solo Lectura
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 dark:hover:bg-slate-800" onClick={() => setViewingParam(null)}>
                Cerrar
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">{viewingParam.estado}</Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(viewingParam.fecha_vigencia_desde).toLocaleDateString('es-SV')}
                {viewingParam.fecha_vigencia_hasta && ` — ${new Date(viewingParam.fecha_vigencia_hasta).toLocaleDateString('es-SV')}`}
              </span>
              <Badge variant="outline" className="text-[10px] dark:border-slate-700 dark:text-slate-400">
                <Lock className="h-2.5 w-2.5 mr-1" /> Solo lectura
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium dark:text-slate-200">{viewingParam.descripcion_cambio}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{viewingParam.decreto_norma_origen}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">ISSS Lab</p>
                <p className="text-sm font-bold dark:text-slate-200">{(viewingParam.tasa_isss_laboral * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">ISSS Pat</p>
                <p className="text-sm font-bold dark:text-slate-200">{(viewingParam.tasa_isss_patronal * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">AFP Lab</p>
                <p className="text-sm font-bold dark:text-slate-200">{(viewingParam.tasa_afp_laboral * 100).toFixed(2)}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">AFP Pat</p>
                <p className="text-sm font-bold dark:text-slate-200">{(viewingParam.tasa_afp_patronal * 100).toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Active Parameter */}
      {vigente && (
        <Card className="shadow-sm border-emerald-200 dark:border-emerald-800 dark:bg-slate-900 bg-emerald-50/30 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Parámetro Vigente
              <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-[10px]">ACTIVO</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Rate cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-emerald-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">ISSS Laboral</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{(vigente.tasa_isss_laboral * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-emerald-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">ISSS Patronal</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{(vigente.tasa_isss_patronal * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-teal-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">AFP Laboral</p>
                <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{(vigente.tasa_afp_laboral * 100).toFixed(2)}%</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-teal-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">AFP Patronal</p>
                <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{(vigente.tasa_afp_patronal * 100).toFixed(2)}%</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-cyan-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tope ISSS</p>
                <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300">${vigente.tope_cotizacion_isss.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-cyan-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">INSAFORP</p>
                <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300">{(vigente.tasa_insaforp * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Vigencia Desde</p>
                <p className="text-sm font-bold dark:text-slate-200">{new Date(vigente.fecha_vigencia_desde).toLocaleDateString('es-SV')}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Decreto</p>
                <p className="text-xs font-bold truncate dark:text-slate-200" title={vigente.decreto_norma_origen}>{vigente.decreto_norma_origen}</p>
              </div>
            </div>

            {/* ISR Tramos Enhanced */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Scale className="h-4 w-4" /> Tramos ISR — Impuesto sobre la Renta
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {vigente.tramos_isr.map((t, idx) => {
                  const colors = tramoColors[idx] || tramoColors[0];
                  const maxHasta = t.hasta || 5000;
                  const barWidth = (maxHasta / 5000) * 100;
                  return (
                    <div key={t.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs font-bold px-2.5 py-0.5 ${colors.bg} ${colors.text}`}>
                            Tramo {t.numero_tramo}
                          </Badge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ${t.desde.toFixed(2)} — {t.hasta ? `$${t.hasta.toFixed(2)}` : '∞'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${colors.text}`}>
                            {(t.porcentaje * 100).toFixed(0)}%
                          </span>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Cuota fija</p>
                            <p className="text-xs font-semibold dark:text-slate-300">${t.cuota_fija.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Marginal</p>
                            <p className="text-xs font-semibold dark:text-slate-300">{(t.porcentaje * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                      {/* Visual salary range bar */}
                      <div className="relative h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${colors.from} ${colors.to} transition-all duration-500`}
                          style={{ width: `${Math.min(barWidth, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Salario Mínimo por Sector Enhanced */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-emerald-700 p-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Salarios Mínimos por Sector
                </h4>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {vigente.salarios_minimos.map((s) => {
                    const cfg = getSectorConfig(s.sector);
                    const barWidth = maxSalary > 0 ? (s.salario_mensual / maxSalary) * 100 : 0;
                    const dailySalary = s.salario_mensual / 30;
                    return (
                      <div key={s.id} className={`rounded-xl border p-3 ${cfg.bgLight} ${cfg.bgDark} border-slate-200 dark:border-slate-700`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${cfg.gradient} text-white shadow-sm`}>
                            {cfg.icon}
                          </div>
                          <div>
                            <p className="text-xs font-semibold dark:text-slate-200">{cfg.label}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{s.sector}</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="text-lg font-bold dark:text-slate-100">${s.salario_mensual.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">/mes</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">${dailySalary.toFixed(2)} /día</p>
                        {/* Visual comparison bar */}
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${cfg.gradient} transition-all duration-500`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Patronal Charges Section */}
            {patronalCharges && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 p-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <PieChart className="h-4 w-4" /> Cargas Patronales
                  </h4>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* ISSS Patronal */}
                    <div className="text-center">
                      <div className="relative mx-auto w-24 h-24 mb-2">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-700" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                            strokeDasharray={`${(patronalCharges.isss / patronalCharges.total) * 251.2} 251.2`}
                            className="text-emerald-500" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{patronalCharges.isss.toFixed(1)}%</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold dark:text-slate-200">ISSS Patronal</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">7.5% sobre salarios</p>
                    </div>
                    {/* AFP Patronal */}
                    <div className="text-center">
                      <div className="relative mx-auto w-24 h-24 mb-2">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-700" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                            strokeDasharray={`${(patronalCharges.afp / patronalCharges.total) * 251.2} 251.2`}
                            className="text-teal-500" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{patronalCharges.afp.toFixed(2)}%</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold dark:text-slate-200">AFP Patronal</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">6.75% sobre salarios</p>
                    </div>
                    {/* INSAFORP */}
                    <div className="text-center">
                      <div className="relative mx-auto w-24 h-24 mb-2">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-700" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                            strokeDasharray={`${(patronalCharges.insaforp / patronalCharges.total) * 251.2} 251.2`}
                            className="text-cyan-500" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{patronalCharges.insaforp.toFixed(1)}%</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold dark:text-slate-200">INSAFORP</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">1.0% sobre planilla</p>
                    </div>
                  </div>
                  <Separator className="my-4 dark:bg-slate-700" />
                  <div className="flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-900/20 dark:via-teal-900/20 dark:to-cyan-900/20 rounded-xl p-4">
                    <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Tasa Patronal Efectiva Total</p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{patronalCharges.total.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historical Timeline (Enhanced) */}
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 dark:text-slate-100">
            <History className="h-4 w-4 text-slate-500 dark:text-slate-400" /> Historial de Parámetros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-4">
            {/* Timeline line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-300 via-teal-300 to-slate-200 dark:from-emerald-700 dark:via-teal-700 dark:to-slate-700" />

            {parametros.map((param) => {
              const isActivo = param.estado === 'ACTIVO';
              return (
                <div key={param.id} className="relative">
                  {/* Timeline dot */}
                  <div className={`absolute -left-3 top-1.5 w-4 h-4 rounded-full border-2 ${
                    isActivo ? 'bg-emerald-500 border-emerald-600 shadow-md shadow-emerald-200 dark:shadow-emerald-900' :
                    param.estado === 'REEMPLAZADO' ? 'bg-slate-300 dark:bg-slate-600 border-slate-400 dark:border-slate-500' :
                    'bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500'
                  }`} />

                  <div className={`border rounded-xl p-3 transition-all duration-200 hover:shadow-sm ${isActivo ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={
                        isActivo ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }>
                        {param.estado}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(param.fecha_vigencia_desde).toLocaleDateString('es-SV')}
                        {param.fecha_vigencia_hasta && ` — ${new Date(param.fecha_vigencia_hasta).toLocaleDateString('es-SV')}`}
                      </span>
                      {!isActivo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] ml-auto dark:hover:bg-slate-700"
                          onClick={() => setViewingParam(param)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Ver
                        </Button>
                      )}
                    </div>
                    <p className="text-sm font-medium dark:text-slate-200">{param.descripcion_cambio}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{param.decreto_norma_origen}</p>
                    <div className="flex gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>ISSS: {(param.tasa_isss_laboral * 100).toFixed(1)}%/{(param.tasa_isss_patronal * 100).toFixed(1)}%</span>
                      <span>AFP: {(param.tasa_afp_laboral * 100).toFixed(2)}%/{(param.tasa_afp_patronal * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {parametros.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay parámetros registrados</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog with Wizard */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setWizardStep(1); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Nuevo Parámetro Legal
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">Cree un nuevo conjunto de parámetros legales con vigencia futura</DialogDescription>
          </DialogHeader>

          {/* Wizard Progress */}
          <div className="flex items-center gap-2 py-2">
            {[
              { step: 1, label: 'General' },
              { step: 2, label: 'Tasas' },
              { step: 3, label: 'ISR' },
              { step: 4, label: 'Salarios' },
            ].map((s, idx) => (
              <React.Fragment key={s.step}>
                <button
                  onClick={() => { if (s.step < wizardStep) setWizardStep(s.step); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    wizardStep === s.step
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : wizardStep > s.step
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    wizardStep > s.step
                      ? 'bg-emerald-500 text-white'
                      : wizardStep === s.step
                      ? 'bg-emerald-600 dark:bg-emerald-500 text-white'
                      : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                  }`}>
                    {wizardStep > s.step ? <CheckCircle className="h-3 w-3" /> : s.step}
                  </div>
                  {s.label}
                </button>
                {idx < 3 && <div className="h-0.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full" />}
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-4 py-4">
            {/* Step 1: General Info */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">El parámetro actual será marcado como REEMPLAZADO. Los valores se pre-llenan con los del parámetro vigente.</p>
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Descripción del Cambio *</Label>
                  <Textarea value={form.descripcion_cambio} onChange={(e) => setForm({ ...form, descripcion_cambio: e.target.value })} placeholder="Ej: Actualización anual de tasas 2026..." className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Decreto / Norma de Origen *</Label>
                  <Input value={form.decreto_norma_origen} onChange={(e) => setForm({ ...form, decreto_norma_origen: e.target.value })} placeholder="Ej: Decreto Ejecutivo No. 45" className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Fecha Vigencia Desde * (debe ser futura)</Label>
                  <Input type="date" value={form.fecha_vigencia_desde} onChange={(e) => setForm({ ...form, fecha_vigencia_desde: e.target.value })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                  {form.fecha_vigencia_desde && new Date(form.fecha_vigencia_desde) <= new Date() && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> La fecha debe ser futura
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Rates */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm dark:text-slate-200 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Tasas de Cotización
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-300">ISSS Laboral</Label>
                    <Input type="number" step="0.001" value={form.tasa_isss_laboral} onChange={(e) => setForm({ ...form, tasa_isss_laboral: parseFloat(e.target.value) || 0 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                    <p className="text-[10px] text-slate-400">{(form.tasa_isss_laboral * 100).toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-300">ISSS Patronal</Label>
                    <Input type="number" step="0.001" value={form.tasa_isss_patronal} onChange={(e) => setForm({ ...form, tasa_isss_patronal: parseFloat(e.target.value) || 0 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                    <p className="text-[10px] text-slate-400">{(form.tasa_isss_patronal * 100).toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-300">Tope ISSS</Label>
                    <Input type="number" step="1" value={form.tope_cotizacion_isss} onChange={(e) => setForm({ ...form, tope_cotizacion_isss: parseFloat(e.target.value) || 0 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-300">AFP Laboral</Label>
                    <Input type="number" step="0.001" value={form.tasa_afp_laboral} onChange={(e) => setForm({ ...form, tasa_afp_laboral: parseFloat(e.target.value) || 0 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                    <p className="text-[10px] text-slate-400">{(form.tasa_afp_laboral * 100).toFixed(2)}%</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-300">AFP Patronal</Label>
                    <Input type="number" step="0.001" value={form.tasa_afp_patronal} onChange={(e) => setForm({ ...form, tasa_afp_patronal: parseFloat(e.target.value) || 0 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                    <p className="text-[10px] text-slate-400">{(form.tasa_afp_patronal * 100).toFixed(2)}%</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-300">INSAFORP</Label>
                    <Input type="number" step="0.001" value={form.tasa_insaforp} onChange={(e) => setForm({ ...form, tasa_insaforp: parseFloat(e.target.value) || 0 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                    <p className="text-[10px] text-slate-400">{(form.tasa_insaforp * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: ISR Tramos */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm dark:text-slate-200 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Tramos ISR
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 dark:bg-slate-800">
                        <th className="p-2 text-center dark:text-slate-300">Tramo</th>
                        <th className="p-2 dark:text-slate-300">Desde</th>
                        <th className="p-2 dark:text-slate-300">Hasta</th>
                        <th className="p-2 dark:text-slate-300">Porcentaje</th>
                        <th className="p-2 dark:text-slate-300">Cuota Fija</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.tramos_isr.map((t, idx) => (
                        <tr key={idx} className="border-b dark:border-slate-700">
                          <td className="p-2 text-center"><Badge variant="outline" className="dark:border-slate-600 dark:text-slate-300">{t.numero_tramo}</Badge></td>
                          <td className="p-1"><Input type="number" step="0.01" value={t.desde} onChange={(e) => {
                            const newTramos = [...form.tramos_isr];
                            newTramos[idx] = { ...t, desde: parseFloat(e.target.value) || 0 };
                            setForm({ ...form, tramos_isr: newTramos });
                          }} className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={t.hasta || ''} onChange={(e) => {
                            const newTramos = [...form.tramos_isr];
                            newTramos[idx] = { ...t, hasta: e.target.value ? parseFloat(e.target.value) : null };
                            setForm({ ...form, tramos_isr: newTramos });
                          }} className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" placeholder="∞" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={t.porcentaje} onChange={(e) => {
                            const newTramos = [...form.tramos_isr];
                            newTramos[idx] = { ...t, porcentaje: parseFloat(e.target.value) || 0 };
                            setForm({ ...form, tramos_isr: newTramos });
                          }} className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" /></td>
                          <td className="p-1"><Input type="number" step="0.01" value={t.cuota_fija} onChange={(e) => {
                            const newTramos = [...form.tramos_isr];
                            newTramos[idx] = { ...t, cuota_fija: parseFloat(e.target.value) || 0 };
                            setForm({ ...form, tramos_isr: newTramos });
                          }} className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 4: Salarios Mínimos */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm dark:text-slate-200 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Salarios Mínimos por Sector
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {form.salarios_minimos.map((s, idx) => {
                    const cfg = getSectorConfig(s.sector);
                    return (
                      <div key={idx} className={`space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 ${cfg.bgLight} ${cfg.bgDark}`}>
                        <div className="flex items-center gap-1.5">
                          <div className={`p-1 rounded-md bg-gradient-to-br ${cfg.gradient} text-white`}>
                            {cfg.icon}
                          </div>
                          <Label className="text-xs font-medium dark:text-slate-200">{cfg.label}</Label>
                        </div>
                        <Input type="number" step="0.01" value={s.salario_mensual} onChange={(e) => {
                          const newSalarios = [...form.salarios_minimos];
                          newSalarios[idx] = { ...s, salario_mensual: parseFloat(e.target.value) || 0 };
                          setForm({ ...form, salarios_minimos: newSalarios });
                        }} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-2 border-t dark:border-slate-700">
              <div>
                {wizardStep > 1 && (
                  <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); setWizardStep(1); }} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
                {wizardStep < 4 ? (
                  <Button onClick={() => setWizardStep(wizardStep + 1)} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                    Siguiente <ChevronRightIcon className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleCreate} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Crear Parámetro
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

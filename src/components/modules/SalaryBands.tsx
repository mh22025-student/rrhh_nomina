'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Edit2, Loader2, AlertTriangle, Users, Layers, TrendingUp,
  ArrowUpDown, Minus, Plus, ChevronRight, GitCompare, Eye, UserCircle, Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface SalaryBandsProps {
  accessToken: string;
  userRole: string;
}

interface Banda {
  id: string; grado: number; nombre: string;
  salario_minimo: number; salario_medio: number; salario_maximo: number;
  moneda: string; num_empleados: number;
  _count?: { perfiles_puesto: number };
}

// Band gradient colors - from light to dark per grade
const bandGradients = [
  { from: '#6ee7b7', to: '#047857', solid: '#10b981' },  // emerald
  { from: '#5eead4', to: '#0f766e', solid: '#14b8a6' },  // teal
  { from: '#67e8f9', to: '#0e7490', solid: '#06b6d4' },  // cyan
  { from: '#7dd3fc', to: '#0369a1', solid: '#0ea5e9' },  // sky
  { from: '#fcd34d', to: '#b45309', solid: '#f59e0b' },  // amber
  { from: '#fdba74', to: '#c2410c', solid: '#f97316' },  // orange
  { from: '#fda4af', to: '#be123c', solid: '#f43f5e' },  // rose
  { from: '#c4b5fd', to: '#6d28d9', solid: '#8b5cf6' },  // violet
];

// Position labels for mock data
const positionLabels = [
  'Asistente', 'Analista', 'Coordinador', 'Supervisor', 'Especialista',
  'Gerente', 'Director', 'Vicepresidente'
];

const areaLabels = [
  'Operaciones', 'Finanzas', 'Recursos Humanos', 'Tecnología', 'Ventas', 'Administración'
];

export default function SalaryBands({ accessToken, userRole }: SalaryBandsProps) {
  const { toast } = useToast();
  const [bandas, setBandas] = useState<Banda[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBanda, setEditBanda] = useState<Banda | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ salario_minimo: 0, salario_medio: 0, salario_maximo: 0 });
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'cards'>('chart');

  const fetchBandas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bandas', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBandas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchBandas(); }, [fetchBandas]);

  const handleEdit = (banda: Banda) => {
    setEditBanda(banda);
    setEditForm({
      salario_minimo: banda.salario_minimo,
      salario_medio: banda.salario_medio,
      salario_maximo: banda.salario_maximo,
    });
  };

  const handleSave = async () => {
    if (!editBanda) return;
    if (editForm.salario_minimo > editForm.salario_medio || editForm.salario_medio > editForm.salario_maximo) {
      toast({ title: 'Error', description: 'Los valores deben cumplir: mínimo ≤ medio ≤ máximo', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/bandas', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editBanda.id, ...editForm }),
      });
      if (res.ok) {
        toast({ title: 'Banda actualizada', description: 'Los valores salariales han sido actualizados' });
        setEditBanda(null);
        fetchBandas();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = userRole === 'ADMIN' || userRole === 'APROBADOR';

  const totalEmpleados = bandas.reduce((s, b) => s + b.num_empleados, 0);
  const maxSalario = Math.max(...bandas.map((b) => b.salario_maximo), 1);
  const minSalarioGeneral = bandas.length > 0 ? Math.min(...bandas.map((b) => b.salario_minimo)) : 0;
  const maxSalarioGeneral = bandas.length > 0 ? Math.max(...bandas.map((b) => b.salario_maximo)) : 0;
  const amplitudSalarial = maxSalarioGeneral - minSalarioGeneral;
  const promedioGeneral = bandas.length > 0
    ? bandas.reduce((s, b) => s + b.salario_medio, 0) / bandas.length
    : 0;

  // Donut chart calculations
  const donutSegments = bandas.map((b, idx) => ({
    id: b.id,
    name: `G${b.grado} ${b.nombre}`,
    count: b.num_empleados,
    color: bandGradients[idx % bandGradients.length].solid,
    pct: totalEmpleados > 0 ? (b.num_empleados / totalEmpleados) * 100 : 0,
  }));

  const donutGradient = (() => {
    if (donutSegments.length === 0) return '';
    let cumulative = 0;
    const parts = donutSegments.map((seg) => {
      const start = cumulative;
      cumulative += seg.pct;
      return `${seg.color} ${start}% ${cumulative}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  })();

  // Comparison data
  const compareBandA = bandas.find((b) => b.id === compareA);
  const compareBandB = bandas.find((b) => b.id === compareB);

  return (
    <div className="space-y-5">
      {/* Enhanced Header with Gradient Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMCAyMGgyME0yMCAwdjIwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <DollarSign className="h-32 w-32" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Estructura Salarial — Bandas y Grados</h2>
              <p className="text-sm text-emerald-100/80">Gestión integral de rangos salariales por grado y nivel organizacional</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Bandas */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Layers className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Total Bandas</p>
          <p className="mt-1 text-2xl font-bold font-mono">{bandas.length}</p>
          <p className="text-xs opacity-80">configuradas</p>
        </div>

        {/* Rango Salarial Global */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <ArrowUpDown className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Rango Global</p>
          <p className="mt-1 text-2xl font-bold font-mono">${amplitudSalarial.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs opacity-80">min → máx</p>
        </div>

        {/* Promedio General */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <TrendingUp className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Promedio General</p>
          <p className="mt-1 text-2xl font-bold font-mono">${promedioGeneral.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs opacity-80">salario medio</p>
        </div>

        {/* Empleados Asignados */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow-sm">
          <div className="absolute -right-2 -top-2 opacity-20">
            <Users className="h-14 w-14" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">Empleados</p>
          <p className="mt-1 text-2xl font-bold font-mono">{totalEmpleados}</p>
          <p className="text-xs opacity-80">asignados</p>
        </div>
      </div>

      {/* View Mode Toggle + Compare */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'chart'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 inline mr-1" /> Gráfico
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5 inline mr-1" /> Tarjetas
          </button>
        </div>
        <Button
          variant={compareMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setCompareMode(!compareMode);
            setCompareA(null);
            setCompareB(null);
          }}
          className={compareMode ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          <GitCompare className="h-3.5 w-3.5 mr-1" /> {compareMode ? 'Salir de Comparación' : 'Comparar Bandas'}
        </Button>
      </div>

      {/* Comparison View */}
      {compareMode && compareBandA && compareBandB && (
        <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <GitCompare className="h-4 w-4 text-emerald-600" /> Comparación: G{compareBandA.grado} vs G{compareBandB.grado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Side by side comparison stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">G{compareBandA.grado} {compareBandA.nombre}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Mínimo</span><span className="font-mono font-medium">${compareBandA.salario_minimo.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Medio</span><span className="font-mono font-medium">${compareBandA.salario_medio.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Máximo</span><span className="font-mono font-medium">${compareBandA.salario_maximo.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Empleados</span><span className="font-mono font-medium">{compareBandA.num_empleados}</span></div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Diferencia</div>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    ${(compareBandB.salario_medio - compareBandA.salario_medio).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-slate-400">en salario medio</div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {compareBandA.salario_medio > 0
                      ? (((compareBandB.salario_medio - compareBandA.salario_medio) / compareBandA.salario_medio) * 100).toFixed(1)
                      : 0}%
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">G{compareBandB.grado} {compareBandB.nombre}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Mínimo</span><span className="font-mono font-medium">${compareBandB.salario_minimo.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Medio</span><span className="font-mono font-medium">${compareBandB.salario_medio.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Máximo</span><span className="font-mono font-medium">${compareBandB.salario_maximo.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Empleados</span><span className="font-mono font-medium">{compareBandB.num_empleados}</span></div>
                  </div>
                </div>
              </div>

              {/* Salary range overlay chart */}
              <div className="relative h-16 mt-2">
                <div className="absolute inset-0 bg-slate-50 dark:bg-slate-800/50 rounded-lg" />
                {/* Band A range */}
                <div
                  className="absolute top-2 h-5 rounded-full opacity-70"
                  style={{
                    left: `${(compareBandA.salario_minimo / maxSalario) * 100}%`,
                    width: `${Math.max(((compareBandA.salario_maximo - compareBandA.salario_minimo) / maxSalario) * 100, 1)}%`,
                    background: bandGradients[bandas.indexOf(compareBandA) % bandGradients.length].solid,
                  }}
                />
                <div
                  className="absolute top-2 h-5 w-0.5 bg-white shadow-sm"
                  style={{ left: `${(compareBandA.salario_medio / maxSalario) * 100}%` }}
                />
                {/* Band B range */}
                <div
                  className="absolute top-9 h-5 rounded-full opacity-70"
                  style={{
                    left: `${(compareBandB.salario_minimo / maxSalario) * 100}%`,
                    width: `${Math.max(((compareBandB.salario_maximo - compareBandB.salario_minimo) / maxSalario) * 100, 1)}%`,
                    background: bandGradients[bandas.indexOf(compareBandB) % bandGradients.length].solid,
                  }}
                />
                <div
                  className="absolute top-9 h-5 w-0.5 bg-white shadow-sm"
                  style={{ left: `${(compareBandB.salario_medio / maxSalario) * 100}%` }}
                />
                {/* Scale */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-slate-400 px-1">
                  <span>$0</span>
                  <span>${(maxSalario / 2).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  <span>${maxSalario.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compare selection hint */}
      {compareMode && (!compareA || !compareB) && (
        <Card className="shadow-sm border-dashed border-2 border-emerald-300 dark:border-emerald-700">
          <CardContent className="p-4 text-center">
            <GitCompare className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {!compareA ? 'Seleccione la primera banda' : 'Seleccione la segunda banda'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Haga clic en una banda en el gráfico o tarjeta para seleccionarla
            </p>
          </CardContent>
        </Card>
      )}

      {/* Visual Salary Range Chart View */}
      {viewMode === 'chart' && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Comparación de Rangos Salariales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : bandas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No hay bandas salariales configuradas</p>
            ) : (
              <div className="space-y-3">
                {/* Scale header */}
                <div className="flex items-center gap-3">
                  <span className="w-32 shrink-0" />
                  <div className="flex-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
                    <span>${(0).toLocaleString()}</span>
                    <span>${(maxSalario / 4).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <span>${(maxSalario / 2).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <span>${((maxSalario * 3) / 4).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <span>${maxSalario.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
                {bandas.map((banda, idx) => {
                  const gradient = bandGradients[idx % bandGradients.length];
                  const leftPct = (banda.salario_minimo / maxSalario) * 100;
                  const widthPct = ((banda.salario_maximo - banda.salario_minimo) / maxSalario) * 100;
                  const avgPct = (banda.salario_medio / maxSalario) * 100;
                  const isSelected = compareA === banda.id || compareB === banda.id;
                  // Simulated employee position markers
                  const employeePositions = banda.num_empleados > 0
                    ? Array.from({ length: Math.min(banda.num_empleados, 8) }, (_, i) => {
                        const spread = widthPct * 0.8;
                        const center = leftPct + widthPct / 2;
                        return center - spread / 2 + (spread / (Math.min(banda.num_empleados, 8) - 1 || 1)) * i;
                      })
                    : [];
                  return (
                    <div
                      key={banda.id}
                      className={`flex items-center gap-3 transition-all ${
                        isSelected ? 'bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-1 -m-1' : ''
                      } ${compareMode ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 rounded-lg p-1 -m-1' : ''}`}
                      onClick={() => {
                        if (!compareMode) return;
                        if (!compareA) setCompareA(banda.id);
                        else if (!compareB && banda.id !== compareA) setCompareB(banda.id);
                      }}
                    >
                      <div className="w-32 shrink-0">
                        <button
                          className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
                          onMouseEnter={() => setHoveredBar(banda.id)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <div
                            className="h-4 w-4 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                          />
                          <div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">G{banda.grado}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block max-w-[80px]" title={banda.nombre}>{banda.nombre}</span>
                          </div>
                        </button>
                      </div>
                      <div className="flex-1 relative h-12 group">
                        {/* Background grid */}
                        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                        {/* Grid lines */}
                        {[25, 50, 75].map((pct) => (
                          <div
                            key={pct}
                            className="absolute top-0 h-full w-px bg-slate-200 dark:bg-slate-700"
                            style={{ left: `${pct}%` }}
                          />
                        ))}
                        {/* Range bar with gradient */}
                        <div
                          className="absolute top-1 h-10 rounded-lg shadow-sm transition-all"
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(widthPct, 1)}%`,
                            background: `linear-gradient(to right, ${gradient.from}, ${gradient.to})`,
                            opacity: hoveredBar === banda.id ? 1 : 0.85,
                          }}
                        />
                        {/* Average marker */}
                        <div
                          className="absolute top-1 h-10 w-0.5 bg-white shadow-md z-10"
                          style={{ left: `${avgPct}%` }}
                        />
                        {/* Average label */}
                        <span
                          className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow-sm z-10"
                          style={{ left: `${avgPct}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          ${banda.salario_medio.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                        {/* Employee position markers */}
                        {employeePositions.map((pos, i) => (
                          <div
                            key={i}
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/90 border border-slate-400/50 shadow-sm z-20"
                            style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
                            title={`Empleado ${i + 1}`}
                          />
                        ))}
                        {/* Hover tooltip */}
                        {hoveredBar === banda.id && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-mono px-2 py-1 rounded shadow-lg z-30 whitespace-nowrap">
                            Min ${banda.salario_minimo.toLocaleString()} → Máx ${banda.salario_maximo.toLocaleString()} | {banda.num_empleados} emp.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Band Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent>
              </Card>
            ))
          ) : bandas.length === 0 ? (
            <Card className="shadow-sm col-span-full">
              <CardContent className="p-8 text-center text-slate-500 dark:text-slate-400">
                No hay bandas salariales configuradas
              </CardContent>
            </Card>
          ) : (
            bandas.map((banda, idx) => {
              const gradient = bandGradients[idx % bandGradients.length];
              const rangePct = ((banda.salario_maximo - banda.salario_minimo) / maxSalario) * 100;
              const midPct = ((banda.salario_medio - banda.salario_minimo) / (banda.salario_maximo - banda.salario_minimo || 1)) * 100;
              const isSelected = compareA === banda.id || compareB === banda.id;
              // Mock area distribution for the mini bar
              const areaDist = areaLabels.slice(0, 3 + (idx % 3)).map((area, ai) => ({
                name: area,
                pct: Math.round(20 + Math.random() * 30),
              }));
              const totalAreaPct = areaDist.reduce((s, a) => s + a.pct, 0);
              return (
                <Card
                  key={banda.id}
                  className={`shadow-sm transition-all hover:shadow-md border-l-4 cursor-pointer ${
                    isSelected ? 'ring-2 ring-emerald-400 dark:ring-emerald-600 border-l-emerald-500' : ''
                  } ${compareMode ? 'hover:ring-1 hover:ring-emerald-300 dark:hover:ring-emerald-700' : ''}`}
                  style={{ borderLeftColor: gradient.solid }}
                  onClick={() => {
                    if (!compareMode) return;
                    if (!compareA) setCompareA(banda.id);
                    else if (!compareB && banda.id !== compareA) setCompareB(banda.id);
                  }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Grade circle */}
                      <div
                        className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                      >
                        {banda.grado}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Band name & description */}
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">G{banda.grado} — {banda.nombre}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {positionLabels[idx % positionLabels.length]} y afines
                            </p>
                          </div>
                          {canEdit && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleEdit(banda); }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        {/* Salary progress bars */}
                        <div className="space-y-2 mb-3">
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-slate-500 dark:text-slate-400">Mínimo</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">${banda.salario_minimo.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.max((banda.salario_minimo / maxSalario) * 100, 3)}%`, background: gradient.from }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Medio</span>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">${banda.salario_medio.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.max((banda.salario_medio / maxSalario) * 100, 3)}%`, background: `linear-gradient(to right, ${gradient.from}, ${gradient.to})` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-slate-500 dark:text-slate-400">Máximo</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">${banda.salario_maximo.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.max((banda.salario_maximo / maxSalario) * 100, 3)}%`, background: gradient.to }} />
                            </div>
                          </div>
                        </div>

                        {/* Employee count & positions */}
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{banda.num_empleados} empleados</span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                          <div className="flex gap-1 overflow-hidden">
                            {positionLabels.slice(idx, idx + 3).map((pos) => (
                              <Badge key={pos} variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-slate-200 dark:border-slate-700">
                                {pos}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Area distribution mini bar */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <Building2 className="h-3 w-3" /> Áreas
                          </div>
                          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                            {areaDist.map((area, ai) => (
                              <div
                                key={area.name}
                                className="h-full"
                                style={{
                                  width: `${(area.pct / totalAreaPct) * 100}%`,
                                  backgroundColor: bandGradients[(idx + ai) % bandGradients.length].solid,
                                  opacity: 0.6 + (ai * 0.15),
                                }}
                                title={`${area.name}: ${area.pct}%`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Salary Distribution Donut */}
      {bandas.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Users className="h-4 w-4 text-emerald-600" /> Distribución de Empleados por Banda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Donut */}
              <div className="relative w-48 h-48 shrink-0">
                <div
                  className="w-full h-full rounded-full shadow-inner"
                  style={{ background: donutGradient || 'transparent' }}
                />
                {/* Center hole */}
                <div className="absolute inset-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-inner">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalEmpleados}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">empleados</p>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {donutSegments.map((seg) => (
                  <div key={seg.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{seg.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {seg.count} ({seg.pct.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Detalle de Bandas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800">
                  <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Grado</th>
                  <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Nombre</th>
                  <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Rango</th>
                  <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Mínimo</th>
                  <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Medio</th>
                  <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Máximo</th>
                  <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Empleados</th>
                  {canEdit && <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b dark:border-slate-700">
                      <td colSpan={canEdit ? 8 : 7} className="p-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                ) : bandas.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No hay bandas salariales configuradas
                    </td>
                  </tr>
                ) : (
                  bandas.map((banda, idx) => {
                    const gradient = bandGradients[idx % bandGradients.length];
                    const rangePct = ((banda.salario_maximo - banda.salario_minimo) / maxSalario) * 100;
                    return (
                      <tr
                        key={banda.id}
                        className={`border-b transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:border-slate-700 ${
                          idx % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/50 dark:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono border-slate-300 dark:border-slate-600">G{banda.grado}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                            />
                            <span className="font-medium text-slate-900 dark:text-slate-100">{banda.nombre}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(rangePct, 3)}%`,
                                background: `linear-gradient(to right, ${gradient.from}, ${gradient.to})`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">${banda.salario_minimo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">${banda.salario_medio.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">${banda.salario_maximo.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-mono">{banda.num_empleados}</span>
                          </span>
                        </td>
                        {canEdit && (
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(banda)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!loading && bandas.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800 font-semibold border-t dark:border-slate-700">
                    <td colSpan={6} className="p-3 text-right text-slate-700 dark:text-slate-300">Total Empleados:</td>
                    <td className="p-3 text-center font-mono text-slate-900 dark:text-slate-100">{totalEmpleados}</td>
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editBanda} onOpenChange={(open) => !open && setEditBanda(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Editar Banda Salarial - G{editBanda?.grado} {editBanda?.nombre}
            </DialogTitle>
            <DialogDescription>Modifique los valores salariales de la banda</DialogDescription>
          </DialogHeader>
          {editBanda && (
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  El salario mínimo de cualquier banda no puede ser inferior al salario mínimo legal vigente.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Salario Mínimo (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_minimo} onChange={(e) => setEditForm({ ...editForm, salario_minimo: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Salario Medio (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_medio} onChange={(e) => setEditForm({ ...editForm, salario_medio: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Salario Máximo (USD)</Label>
                <Input type="number" step="0.01" value={editForm.salario_maximo} onChange={(e) => setEditForm({ ...editForm, salario_maximo: parseFloat(e.target.value) || 0 })} />
              </div>
              {/* Preview bar */}
              <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-6 relative overflow-hidden">
                <div
                  className="absolute top-0 h-full bg-emerald-300 dark:bg-emerald-700 rounded-full"
                  style={{
                    left: `${(editForm.salario_minimo / maxSalario) * 100}%`,
                    width: `${Math.max(1, ((editForm.salario_maximo - editForm.salario_minimo) / maxSalario) * 100)}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-emerald-700 dark:bg-emerald-300"
                  style={{ left: `${(editForm.salario_medio / maxSalario) * 100}%` }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditBanda(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

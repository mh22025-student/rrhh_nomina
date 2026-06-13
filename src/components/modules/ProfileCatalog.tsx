'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Eye, Trash2, BookOpen, MapPin, DollarSign, Star, Clock, Loader2,
  Users, TrendingUp, Layers, Award,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface ProfileCatalogProps {
  accessToken: string;
  userRole: string;
}

interface Area { id: string; nombre: string; codigo: string; }
interface Banda { id: string; nombre: string; grado: number; salario_minimo: number; salario_maximo: number; }
interface Perfil {
  id: string; codigo: string; nombre_puesto: string; estado: string; version: number;
  puntos_total: number; proposito: string | null; funciones_esenciales: string | null;
  requisitos_educacion: string | null; requisitos_experiencia: string | null;
  requisitos_habilidades: string | null; responsabilidades: string | null;
  condiciones_trabajo: string | null; sector_laboral: string;
  area: Area; banda_salarial: Banda | null;
  _count: { empleados_perfil: number };
  versiones?: { id: string; version: number; cambio_descripcion: string; fecha_creacion: string; creado_por: { nombre: string; apellido: string } | null }[];
}

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  ACTIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  OBSOLETO: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  VIGENTE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const estadoDotColors: Record<string, string> = {
  BORRADOR: 'bg-yellow-500',
  ACTIVO: 'bg-emerald-500',
  OBSOLETO: 'bg-red-500',
  VIGENTE: 'bg-emerald-500',
};

const areaColors = [
  'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500',
  'bg-teal-500', 'bg-orange-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-500',
];

function getAreaColor(areaName: string): string {
  let hash = 0;
  for (let i = 0; i < areaName.length; i++) {
    hash = areaName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return areaColors[Math.abs(hash) % areaColors.length];
}

function PointsIndicator({ points }: { points: number }) {
  const maxPoints = 1000;
  const pct = Math.min((points / maxPoints) * 100, 100);
  let color = 'bg-slate-400';
  if (points >= 700) color = 'bg-emerald-500';
  else if (points >= 400) color = 'bg-sky-500';
  else if (points >= 200) color = 'bg-amber-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 tabular-nums">{points}</span>
    </div>
  );
}

function SalaryRangeBar({ min, max }: { min: number; max: number }) {
  const globalMin = 200;
  const globalMax = 8000;
  const leftPct = Math.max(((min - globalMin) / (globalMax - globalMin)) * 100, 0);
  const rightPct = Math.min(((max - globalMin) / (globalMax - globalMin)) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function ProfileCatalog({ accessToken, userRole }: ProfileCatalogProps) {
  const { toast } = useToast();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [bandas, setBandas] = useState<Banda[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterBanda, setFilterBanda] = useState('all');
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // New profile form
  const [form, setForm] = useState({
    codigo: '', nombre_puesto: '', area_id: '', banda_salarial_id: '',
    sector_laboral: 'COMERCIO', proposito: '', funciones_esenciales: '',
    requisitos_educacion: '', requisitos_experiencia: '', requisitos_habilidades: '',
    responsabilidades: '', condiciones_trabajo: '', puntos_total: 0,
  });

  const fetchPerfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterArea !== 'all') params.set('area_id', filterArea);
      if (filterEstado !== 'all') params.set('estado', filterEstado);
      if (filterBanda !== 'all') params.set('banda_salarial_id', filterBanda);

      const res = await fetch(`/api/perfiles?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPerfiles(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, filterArea, filterEstado, filterBanda]);

  const fetchFilters = useCallback(async () => {
    try {
      const [areasRes, bandasRes] = await Promise.all([
        fetch('/api/areas', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/bandas', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      if (areasRes.ok) {
        const areasData = await areasRes.json();
        setAreas(Array.isArray(areasData) ? areasData : areasData.data || []);
      }
      if (bandasRes.ok) {
        const bandasData = await bandasRes.json();
        setBandas(Array.isArray(bandasData) ? bandasData : bandasData.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [accessToken]);

  useEffect(() => { fetchPerfiles(); }, [fetchPerfiles]);
  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  // Summary stats
  const stats = useMemo(() => {
    const totalPerfiles = perfiles.length;
    const vigentes = perfiles.filter(p => p.estado === 'VIGENTE' || p.estado === 'ACTIVO').length;
    const avgPuntos = totalPerfiles > 0
      ? Math.round(perfiles.reduce((sum, p) => sum + p.puntos_total, 0) / totalPerfiles)
      : 0;
    const uniqueBandas = new Set(perfiles.filter(p => p.banda_salarial).map(p => p.banda_salarial!.id)).size;
    return { totalPerfiles, vigentes, avgPuntos, uniqueBandas };
  }, [perfiles]);

  const handleCreate = async () => {
    if (!form.codigo || !form.nombre_puesto || !form.area_id) {
      toast({ title: 'Error', description: 'Código, nombre y área son requeridos', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/perfiles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast({ title: 'Perfil creado', description: 'El perfil se ha creado exitosamente' });
        setShowCreateDialog(false);
        setForm({ codigo: '', nombre_puesto: '', area_id: '', banda_salarial_id: '', sector_laboral: 'COMERCIO', proposito: '', funciones_esenciales: '', requisitos_educacion: '', requisitos_experiencia: '', requisitos_habilidades: '', responsabilidades: '', condiciones_trabajo: '', puntos_total: 0 });
        fetchPerfiles();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Error al crear perfil', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/perfiles/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPerfil(data);
        setShowDetailDialog(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/perfiles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        toast({ title: 'Perfil desactivado', description: 'El perfil ha sido marcado como obsoleto' });
        fetchPerfiles();
      }
    } catch {
      toast({ title: 'Error', description: 'Error al desactivar', variant: 'destructive' });
    }
  };

  const canCreate = userRole === 'ADMIN' || userRole === 'ANALISTA';
  const canDelete = userRole === 'ADMIN';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Catálogo de Perfiles de Puesto</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gestión de descripciones y valoraciones de puestos</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
            <Plus className="h-4 w-4 mr-2" /> Nuevo Perfil
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              <Layers className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Perfiles</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalPerfiles}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
              <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Perfiles Vigentes</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.vigentes}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-900/30">
              <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Promedio Valuación</p>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{stats.avgPuntos}<span className="text-sm font-normal text-slate-400 ml-1">pts</span></p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30">
              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Bandas Salariales</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.uniqueBandas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Filtrar por área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="BORRADOR">Borrador</SelectItem>
                <SelectItem value="ACTIVO">Activo</SelectItem>
                <SelectItem value="VIGENTE">Vigente</SelectItem>
                <SelectItem value="OBSOLETO">Obsoleto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBanda} onValueChange={setFilterBanda}>
              <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Filtrar por banda" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las bandas</SelectItem>
                {bandas.map((b) => <SelectItem key={b.id} value={b.id}>{b.nombre} (G{b.grado})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4 dark:bg-slate-700" />
                <Skeleton className="h-4 w-1/2 dark:bg-slate-700" />
                <Skeleton className="h-4 w-2/3 dark:bg-slate-700" />
                <div className="flex gap-2"><Skeleton className="h-6 w-16 dark:bg-slate-700" /><Skeleton className="h-6 w-20 dark:bg-slate-700" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : perfiles.length === 0 ? (
        <Card className="shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No se encontraron perfiles</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ajuste los filtros o cree un nuevo perfil</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perfiles.map((perfil) => (
            <Card
              key={perfil.id}
              className="shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 group"
            >
              <CardContent className="p-5">
                {/* Header: Code badge + Status */}
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="outline" className="text-[11px] font-mono px-2 py-0.5 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    {perfil.codigo}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${estadoDotColors[perfil.estado] || 'bg-gray-400'}`} />
                    <Badge className={`${estadoColors[perfil.estado] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'} text-[11px] px-2 py-0.5`}>
                      {perfil.estado}
                    </Badge>
                  </div>
                </div>

                {/* Job Title */}
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 mb-3 leading-snug line-clamp-2">
                  {perfil.nombre_puesto}
                </h3>

                {/* Area with colored dot */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getAreaColor(perfil.area?.nombre || '')}`} />
                  <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{perfil.area?.nombre || 'Sin área'}</span>
                </div>

                {/* Salary Band with range bar */}
                {perfil.banda_salarial && (
                  <div className="mb-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> {perfil.banda_salarial.nombre} (G{perfil.banda_salarial.grado})
                      </span>
                    </div>
                    <SalaryRangeBar min={perfil.banda_salarial.salario_minimo} max={perfil.banda_salarial.salario_maximo} />
                  </div>
                )}

                {/* Points valuation with visual indicator */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Star className="h-3 w-3" /> Valuación por Puntos
                    </span>
                  </div>
                  <PointsIndicator points={perfil.puntos_total} />
                </div>

                {/* Footer info */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> V{perfil.version}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {perfil._count.empleados_perfil}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      onClick={() => handleViewDetail(perfil.id)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Ver
                    </Button>
                    {canDelete && perfil.estado !== 'OBSOLETO' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        onClick={() => handleDeactivate(perfil.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">Nuevo Perfil de Puesto</DialogTitle>
            <DialogDescription className="dark:text-slate-400">Complete la información para crear un nuevo perfil</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Código *</Label>
              <Input placeholder="PP-001" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Nombre del Puesto *</Label>
              <Input placeholder="Nombre del puesto" value={form.nombre_puesto} onChange={(e) => setForm({ ...form, nombre_puesto: e.target.value })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Área *</Label>
              <Select value={form.area_id} onValueChange={(v) => setForm({ ...form, area_id: v })}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Banda Salarial</Label>
              <Select value={form.banda_salarial_id || 'none'} onValueChange={(v) => setForm({ ...form, banda_salarial_id: v === 'none' ? '' : v })}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue placeholder="Seleccionar banda" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin banda</SelectItem>
                  {bandas.map((b) => <SelectItem key={b.id} value={b.id}>{b.nombre} (G{b.grado})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Sector Laboral</Label>
              <Select value={form.sector_laboral} onValueChange={(v) => setForm({ ...form, sector_laboral: v })}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMERCIO">Comercio</SelectItem>
                  <SelectItem value="INDUSTRIA">Industria</SelectItem>
                  <SelectItem value="SERVICIOS">Servicios</SelectItem>
                  <SelectItem value="AGROPECUARIO">Agropecuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Puntos Total</Label>
              <Input type="number" value={form.puntos_total} onChange={(e) => setForm({ ...form, puntos_total: parseInt(e.target.value) || 0 })} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="dark:text-slate-300">Propósito</Label>
              <Textarea placeholder="Describa el propósito del puesto..." value={form.proposito} onChange={(e) => setForm({ ...form, proposito: e.target.value })} rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="dark:text-slate-300">Funciones Esenciales</Label>
              <Textarea placeholder="Describa las funciones esenciales..." value={form.funciones_esenciales} onChange={(e) => setForm({ ...form, funciones_esenciales: e.target.value })} rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="dark:text-slate-300">Requisitos de Educación</Label>
              <Textarea placeholder="Describa los requisitos educativos..." value={form.requisitos_educacion} onChange={(e) => setForm({ ...form, requisitos_educacion: e.target.value })} rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="dark:text-slate-300">Requisitos de Experiencia</Label>
              <Textarea placeholder="Describa los requisitos de experiencia..." value={form.requisitos_experiencia} onChange={(e) => setForm({ ...form, requisitos_experiencia: e.target.value })} rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="dark:text-slate-300">Requisitos de Habilidades</Label>
              <Textarea placeholder="Describa las habilidades requeridas..." value={form.requisitos_habilidades} onChange={(e) => setForm({ ...form, requisitos_habilidades: e.target.value })} rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="dark:text-slate-300">Responsabilidades</Label>
              <Textarea placeholder="Describa las responsabilidades..." value={form.responsabilidades} onChange={(e) => setForm({ ...form, responsabilidades: e.target.value })} rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="dark:text-slate-300">Condiciones de Trabajo</Label>
              <Textarea placeholder="Describa las condiciones de trabajo..." value={form.condiciones_trabajo} onChange={(e) => setForm({ ...form, condiciones_trabajo: e.target.value })} rows={2} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800">
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {selectedPerfil?.codigo} - {selectedPerfil?.nombre_puesto}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">Detalle del perfil de puesto</DialogDescription>
          </DialogHeader>
          {selectedPerfil && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Estado</p>
                  <Badge className={`${estadoColors[selectedPerfil.estado]} mt-1`}>{selectedPerfil.estado}</Badge>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Área</p>
                  <p className="text-sm font-medium dark:text-slate-200">{selectedPerfil.area?.nombre}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Banda Salarial</p>
                  <p className="text-sm font-medium dark:text-slate-200">{selectedPerfil.banda_salarial?.nombre || 'Sin asignar'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Puntos</p>
                  <p className="text-sm font-medium dark:text-slate-200">{selectedPerfil.puntos_total}</p>
                </div>
              </div>

              {[
                { label: 'Propósito', value: selectedPerfil.proposito },
                { label: 'Funciones Esenciales', value: selectedPerfil.funciones_esenciales },
                { label: 'Requisitos de Educación', value: selectedPerfil.requisitos_educacion },
                { label: 'Requisitos de Experiencia', value: selectedPerfil.requisitos_experiencia },
                { label: 'Requisitos de Habilidades', value: selectedPerfil.requisitos_habilidades },
                { label: 'Responsabilidades', value: selectedPerfil.responsabilidades },
                { label: 'Condiciones de Trabajo', value: selectedPerfil.condiciones_trabajo },
              ].map((section) => (
                section.value && (
                  <div key={section.label} className="border dark:border-slate-800 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-2">{section.label}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{section.value}</p>
                  </div>
                )
              ))}

              {/* Version History */}
              {selectedPerfil.versiones && selectedPerfil.versiones.length > 0 && (
                <div className="border dark:border-slate-800 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Historial de Versiones
                  </h4>
                  <div className="space-y-2">
                    {selectedPerfil.versiones.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <Badge variant="outline" className="text-xs dark:border-slate-700 dark:text-slate-300">V{v.version}</Badge>
                        <span className="text-slate-600 dark:text-slate-400 flex-1">{v.cambio_descripcion}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(v.fecha_creacion).toLocaleDateString('es-SV')}
                          {v.creado_por && ` · ${v.creado_por.nombre} ${v.creado_por.apellido}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

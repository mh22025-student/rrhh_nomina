'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Plus, Eye, Edit, Trash2, X, ChevronDown,
  BookOpen, MapPin, DollarSign, Star, Clock, FileText, Loader2,
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
  BORRADOR: 'bg-yellow-100 text-yellow-800',
  ACTIVO: 'bg-emerald-100 text-emerald-800',
  OBSOLETO: 'bg-red-100 text-red-800',
};

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
          <h2 className="text-xl font-bold text-slate-900">Catálogo de Perfiles de Puesto</h2>
          <p className="text-sm text-slate-500">Gestión de descripciones y valoraciones de puestos</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Nuevo Perfil
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger><SelectValue placeholder="Filtrar por área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="BORRADOR">Borrador</SelectItem>
                <SelectItem value="ACTIVO">Activo</SelectItem>
                <SelectItem value="OBSOLETO">Obsoleto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBanda} onValueChange={setFilterBanda}>
              <SelectTrigger><SelectValue placeholder="Filtrar por banda" /></SelectTrigger>
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
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-20" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : perfiles.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700">No se encontraron perfiles</h3>
            <p className="text-sm text-slate-500 mt-1">Ajuste los filtros o cree un nuevo perfil</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perfiles.map((perfil) => (
            <Card key={perfil.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-500">{perfil.codigo}</p>
                    <h3 className="font-semibold text-slate-900 truncate">{perfil.nombre_puesto}</h3>
                  </div>
                  <Badge className={`${estadoColors[perfil.estado] || 'bg-gray-100 text-gray-800'} text-xs ml-2 shrink-0`}>
                    {perfil.estado}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-sm text-slate-600 mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{perfil.area?.nombre || 'Sin área'}</span>
                  </div>
                  {perfil.banda_salarial && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                      <span>{perfil.banda_salarial.nombre} (G{perfil.banda_salarial.grado})</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-slate-400" />
                    <span>{perfil.puntos_total} puntos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>V{perfil.version} · {perfil._count.empleados_perfil} empleados</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewDetail(perfil.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                  </Button>
                  {canDelete && perfil.estado !== 'OBSOLETO' && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeactivate(perfil.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Perfil de Puesto</DialogTitle>
            <DialogDescription>Complete la información para crear un nuevo perfil</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input placeholder="PP-001" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nombre del Puesto *</Label>
              <Input placeholder="Nombre del puesto" value={form.nombre_puesto} onChange={(e) => setForm({ ...form, nombre_puesto: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Área *</Label>
              <Select value={form.area_id} onValueChange={(v) => setForm({ ...form, area_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Banda Salarial</Label>
              <Select value={form.banda_salarial_id || 'none'} onValueChange={(v) => setForm({ ...form, banda_salarial_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar banda" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin banda</SelectItem>
                  {bandas.map((b) => <SelectItem key={b.id} value={b.id}>{b.nombre} (G{b.grado})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sector Laboral</Label>
              <Select value={form.sector_laboral} onValueChange={(v) => setForm({ ...form, sector_laboral: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMERCIO">Comercio</SelectItem>
                  <SelectItem value="INDUSTRIA">Industria</SelectItem>
                  <SelectItem value="SERVICIOS">Servicios</SelectItem>
                  <SelectItem value="AGROPECUARIO">Agropecuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Puntos Total</Label>
              <Input type="number" value={form.puntos_total} onChange={(e) => setForm({ ...form, puntos_total: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Propósito</Label>
              <Textarea placeholder="Describa el propósito del puesto..." value={form.proposito} onChange={(e) => setForm({ ...form, proposito: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Funciones Esenciales</Label>
              <Textarea placeholder="Describa las funciones esenciales..." value={form.funciones_esenciales} onChange={(e) => setForm({ ...form, funciones_esenciales: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Requisitos de Educación</Label>
              <Textarea placeholder="Describa los requisitos educativos..." value={form.requisitos_educacion} onChange={(e) => setForm({ ...form, requisitos_educacion: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Requisitos de Experiencia</Label>
              <Textarea placeholder="Describa los requisitos de experiencia..." value={form.requisitos_experiencia} onChange={(e) => setForm({ ...form, requisitos_experiencia: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Requisitos de Habilidades</Label>
              <Textarea placeholder="Describa las habilidades requeridas..." value={form.requisitos_habilidades} onChange={(e) => setForm({ ...form, requisitos_habilidades: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Responsabilidades</Label>
              <Textarea placeholder="Describa las responsabilidades..." value={form.responsabilidades} onChange={(e) => setForm({ ...form, responsabilidades: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Condiciones de Trabajo</Label>
              <Textarea placeholder="Describa las condiciones de trabajo..." value={form.condiciones_trabajo} onChange={(e) => setForm({ ...form, condiciones_trabajo: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-600" />
              {selectedPerfil?.codigo} - {selectedPerfil?.nombre_puesto}
            </DialogTitle>
            <DialogDescription>Detalle del perfil de puesto</DialogDescription>
          </DialogHeader>
          {selectedPerfil && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Estado</p>
                  <Badge className={`${estadoColors[selectedPerfil.estado]} mt-1`}>{selectedPerfil.estado}</Badge>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Área</p>
                  <p className="text-sm font-medium">{selectedPerfil.area?.nombre}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Banda Salarial</p>
                  <p className="text-sm font-medium">{selectedPerfil.banda_salarial?.nombre || 'Sin asignar'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Puntos</p>
                  <p className="text-sm font-medium">{selectedPerfil.puntos_total}</p>
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
                  <div key={section.label} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 text-sm mb-2">{section.label}</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{section.value}</p>
                  </div>
                )
              ))}

              {/* Version History */}
              {selectedPerfil.versiones && selectedPerfil.versiones.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Historial de Versiones
                  </h4>
                  <div className="space-y-2">
                    {selectedPerfil.versiones.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg p-2">
                        <Badge variant="outline" className="text-xs">V{v.version}</Badge>
                        <span className="text-slate-600 flex-1">{v.cambio_descripcion}</span>
                        <span className="text-xs text-slate-400">
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

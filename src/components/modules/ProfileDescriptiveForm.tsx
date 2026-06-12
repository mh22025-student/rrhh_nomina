'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Save, Plus, Trash2, Loader2, AlertCircle, ChevronDown, ChevronRight,
  BookOpen, Target, Award, Shield, Settings2, History, RotateCcw, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface ProfileDescriptiveFormProps {
  accessToken: string;
  userRole: string;
}

interface Area {
  id: string;
  nombre: string;
  codigo: string;
}
interface Banda {
  id: string;
  nombre: string;
  grado: number;
  salario_minimo: number;
  salario_maximo: number;
}
interface PerfilListItem {
  id: string;
  codigo: string;
  nombre_puesto: string;
  estado: string;
  version: number;
  puntos_total: number;
  area: Area;
  banda_salarial: Banda | null;
}
interface VersionHistory {
  id: string;
  version: number;
  cambio_descripcion: string;
  fecha_creacion: string;
  creado_por: { nombre: string; apellido: string } | null;
}

interface PointFactor {
  label: string;
  value: number;
}

interface PointGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  factors: PointFactor[];
}

const SECTORES = ['COMERCIO', 'INDUSTRIA', 'SERVICIOS', 'AGROPECUARIO', 'MAQUILA', 'TRANSPORTE'];
const ESTADOS = ['BORRADOR', 'VIGENTE', 'EN_REVISION', 'OBSOLETO'];

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  VIGENTE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  EN_REVISION: 'bg-blue-100 text-blue-800 border-blue-200',
  OBSOLETO: 'bg-slate-100 text-slate-600 border-slate-200',
};

const defaultPointGroups: PointGroup[] = [
  {
    key: 'habilidades',
    label: 'Habilidades',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'emerald',
    factors: [
      { label: 'Educación', value: 0 },
      { label: 'Experiencia', value: 0 },
      { label: 'Habilidades técnicas', value: 0 },
    ],
  },
  {
    key: 'esfuerzo',
    label: 'Esfuerzo',
    icon: <Target className="h-4 w-4" />,
    color: 'amber',
    factors: [
      { label: 'Esfuerzo físico', value: 0 },
      { label: 'Esfuerzo mental', value: 0 },
      { label: 'Concentración', value: 0 },
    ],
  },
  {
    key: 'responsabilidad',
    label: 'Responsabilidad',
    icon: <Shield className="h-4 w-4" />,
    color: 'blue',
    factors: [
      { label: 'Supervisión', value: 0 },
      { label: 'Fondos', value: 0 },
      { label: 'Confidencialidad', value: 0 },
      { label: 'Equipos', value: 0 },
    ],
  },
  {
    key: 'condiciones',
    label: 'Condiciones',
    icon: <Settings2 className="h-4 w-4" />,
    color: 'purple',
    factors: [
      { label: 'Ambiente', value: 0 },
      { label: 'Riesgos', value: 0 },
      { label: 'Exposición', value: 0 },
    ],
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-500' },
  blue: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', accent: 'bg-sky-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500' },
};

export default function ProfileDescriptiveForm({ accessToken, userRole }: ProfileDescriptiveFormProps) {
  const { toast } = useToast();

  // Data
  const [perfiles, setPerfiles] = useState<PerfilListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [bandas, setBandas] = useState<Banda[]>([]);
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form mode
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [isNewMode, setIsNewMode] = useState(true);

  // Section collapse state
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    A: true, B: true, C: false, D: false, valuation: false,
  });

  // Form state
  const [form, setForm] = useState({
    codigo: '',
    nombre_puesto: '',
    area_id: '',
    banda_salarial_id: '',
    sector_laboral: 'COMERCIO',
    estado: 'BORRADOR',
    proposito: '',
    funciones_esenciales: [] as string[],
    requisitos_educacion: '',
    requisitos_experiencia: '',
    requisitos_habilidades: [] as string[],
    responsabilidades: [] as string[],
    condiciones_trabajo: '',
  });

  const [pointGroups, setPointGroups] = useState<PointGroup[]>(
    defaultPointGroups.map(g => ({ ...g, factors: g.factors.map(f => ({ ...f })) }))
  );

  // Dynamic list input states
  const [newFuncion, setNewFuncion] = useState('');
  const [newHabilidad, setNewHabilidad] = useState('');
  const [newResponsabilidad, setNewResponsabilidad] = useState('');

  const canEdit = userRole === 'ADMIN' || userRole === 'ANALISTA';

  // Calculated total points
  const totalPoints = useMemo(() => {
    return pointGroups.reduce((sum, group) => {
      return sum + group.factors.reduce((s, f) => s + f.value, 0);
    }, 0);
  }, [pointGroups]);

  // Group subtotals
  const groupSubtotals = useMemo(() => {
    const map: Record<string, number> = {};
    pointGroups.forEach(g => {
      map[g.key] = g.factors.reduce((s, f) => s + f.value, 0);
    });
    return map;
  }, [pointGroups]);

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [perfilesRes, areasRes, bandasRes] = await Promise.all([
        fetch('/api/perfiles', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/areas', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/bandas', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);

      if (perfilesRes.ok) {
        const data = await perfilesRes.json();
        setPerfiles(Array.isArray(data) ? data : data.data || []);
      }
      if (areasRes.ok) {
        const data = await areasRes.json();
        setAreas(data.data || data || []);
      }
      if (bandasRes.ok) {
        const data = await bandasRes.json();
        setBandas(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // Fetch existing perfil when selected
  const handleSelectPerfil = useCallback(async (perfilId: string) => {
    if (!perfilId) {
      setIsNewMode(true);
      setSelectedPerfilId('');
      resetForm();
      return;
    }

    setIsNewMode(false);
    setSelectedPerfilId(perfilId);

    try {
      const res = await fetch(`/api/perfiles/${perfilId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const perfil = await res.json();

        // Parse JSON arrays
        let funciones: string[] = [];
        try { funciones = perfil.funciones_esenciales ? JSON.parse(perfil.funciones_esenciales) : []; } catch { funciones = perfil.funciones_esenciales ? [perfil.funciones_esenciales] : []; }

        let habilidades: string[] = [];
        try { habilidades = perfil.requisitos_habilidades ? JSON.parse(perfil.requisitos_habilidades) : []; } catch { habilidades = perfil.requisitos_habilidades ? [perfil.requisitos_habilidades] : []; }

        let responsabilidadesArr: string[] = [];
        try { responsabilidadesArr = perfil.responsabilidades ? JSON.parse(perfil.responsabilidades) : []; } catch { responsabilidadesArr = perfil.responsabilidades ? [perfil.responsabilidades] : []; }

        setForm({
          codigo: perfil.codigo || '',
          nombre_puesto: perfil.nombre_puesto || '',
          area_id: perfil.area_id || '',
          banda_salarial_id: perfil.banda_salarial_id || '',
          sector_laboral: perfil.sector_laboral || 'COMERCIO',
          estado: perfil.estado || 'BORRADOR',
          proposito: perfil.proposito || '',
          funciones_esenciales: Array.isArray(funciones) ? funciones : [],
          requisitos_educacion: perfil.requisitos_educacion || '',
          requisitos_experiencia: perfil.requisitos_experiencia || '',
          requisitos_habilidades: Array.isArray(habilidades) ? habilidades : [],
          responsabilidades: Array.isArray(responsabilidadesArr) ? responsabilidadesArr : [],
          condiciones_trabajo: perfil.condiciones_trabajo || '',
        });

        // Restore point groups from puntos_total if available
        if (perfil.puntos_total > 0) {
          // Distribute points equally across factors as a reasonable default
          const totalFactors = pointGroups.reduce((s, g) => s + g.factors.length, 0);
          const pointsPerFactor = Math.floor(perfil.puntos_total / totalFactors);
          const remainder = perfil.puntos_total - (pointsPerFactor * totalFactors);
          let remainderIdx = 0;
          setPointGroups(prev => prev.map(g => ({
            ...g,
            factors: g.factors.map(f => {
              const extra = remainderIdx < remainder ? 1 : 0;
              remainderIdx++;
              return { ...f, value: pointsPerFactor + extra };
            }),
          })));
        }

        // Set version history
        setVersionHistory(perfil.versiones || []);
      }
    } catch (err) {
      console.error('Error fetching perfil:', err);
      toast({ title: 'Error', description: 'No se pudo cargar el perfil', variant: 'destructive' });
    }
  }, [accessToken, toast, pointGroups]);

  const resetForm = () => {
    setForm({
      codigo: '',
      nombre_puesto: '',
      area_id: '',
      banda_salarial_id: '',
      sector_laboral: 'COMERCIO',
      estado: 'BORRADOR',
      proposito: '',
      funciones_esenciales: [],
      requisitos_educacion: '',
      requisitos_experiencia: '',
      requisitos_habilidades: [],
      responsabilidades: [],
      condiciones_trabajo: '',
    });
    setPointGroups(defaultPointGroups.map(g => ({ ...g, factors: g.factors.map(f => ({ ...f })) })));
    setVersionHistory([]);
  };

  const handleNew = () => {
    setSelectedPerfilId('');
    setIsNewMode(true);
    resetForm();
    // Auto-generate codigo
    const nextNum = perfiles.length + 1;
    setForm(prev => ({ ...prev, codigo: `CARGO-${String(nextNum).padStart(3, '0')}` }));
  };

  // Dynamic list operations
  const addItem = (field: 'funciones_esenciales' | 'requisitos_habilidades' | 'responsabilidades', value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (!value.trim()) return;
    setForm(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    setter('');
  };

  const removeItem = (field: 'funciones_esenciales' | 'requisitos_habilidades' | 'responsabilidades', index: number) => {
    setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  // Point factor change
  const updatePointFactor = (groupKey: string, factorIndex: number, value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    setPointGroups(prev => prev.map(g =>
      g.key === groupKey
        ? { ...g, factors: g.factors.map((f, i) => i === factorIndex ? { ...f, value: clamped } : f) }
        : g
    ));
  };

  // Save handler
  const handleSave = async () => {
    if (!canEdit) {
      toast({ title: 'Sin permisos', description: 'No tiene permisos para guardar', variant: 'destructive' });
      return;
    }

    if (!form.nombre_puesto.trim()) {
      toast({ title: 'Campo requerido', description: 'El nombre del puesto es obligatorio', variant: 'destructive' });
      return;
    }
    if (!form.area_id) {
      toast({ title: 'Campo requerido', description: 'El área es obligatoria', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo,
        nombre_puesto: form.nombre_puesto,
        area_id: form.area_id,
        banda_salarial_id: form.banda_salarial_id || null,
        sector_laboral: form.sector_laboral,
        estado: form.estado,
        proposito: form.proposito || null,
        funciones_esenciales: JSON.stringify(form.funciones_esenciales),
        requisitos_educacion: form.requisitos_educacion || null,
        requisitos_experiencia: form.requisitos_experiencia || null,
        requisitos_habilidades: JSON.stringify(form.requisitos_habilidades),
        responsabilidades: JSON.stringify(form.responsabilidades),
        condiciones_trabajo: form.condiciones_trabajo || null,
        puntos_total: totalPoints,
        cambio_descripcion: isNewMode ? 'Creación inicial del perfil' : `Actualización versión - ${form.nombre_puesto}`,
      };

      let res: Response;
      if (isNewMode) {
        if (!form.codigo) {
          const nextNum = perfiles.length + 1;
          payload.codigo = `CARGO-${String(nextNum).padStart(3, '0')}`;
        }
        res = await fetch('/api/perfiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/perfiles/${selectedPerfilId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (res.ok) {
        toast({
          title: isNewMode ? 'Perfil creado' : 'Perfil actualizado',
          description: `${form.nombre_puesto} - ${isNewMode ? 'Versión 1' : `Actualizado exitosamente`}`,
        });
        // Refresh list
        fetchInitialData();
        if (!isNewMode && selectedPerfilId) {
          handleSelectPerfil(selectedPerfilId);
        }
      } else {
        toast({ title: 'Error', description: data.error || 'Error al guardar perfil', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Perfil Descriptivo de Puesto
          </h2>
          <p className="text-sm text-slate-500">Formulario de valuación por puntos según metodología vigente</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPerfilId} onValueChange={handleSelectPerfil}>
            <SelectTrigger className="w-[260px] h-9 text-sm">
              <SelectValue placeholder="Seleccionar perfil existente..." />
            </SelectTrigger>
            <SelectContent>
              {perfiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-mono text-xs mr-2">{p.codigo}</span>
                  {p.nombre_puesto}
                  <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 ${estadoColors[p.estado] || ''}`}>
                    {p.estado}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleNew} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      {/* Mode indicator */}
      <div className="flex items-center gap-2">
        <Badge variant={isNewMode ? 'default' : 'secondary'} className={isNewMode ? 'bg-emerald-600' : 'bg-amber-600'}>
          {isNewMode ? 'Creando nuevo perfil' : `Editando: ${form.codigo}`}
        </Badge>
        {!isNewMode && (
          <Badge variant="outline" className={estadoColors[form.estado] || ''}>
            {form.estado} • v{versionHistory.length || 1}
          </Badge>
        )}
      </div>

      {/* Section A - Identificación del Puesto */}
      <Collapsible open={sectionOpen.A} onOpenChange={(v) => setSectionOpen(p => ({ ...p, A: v }))}>
        <Card className="shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">A</span>
                  Identificación del Puesto
                </CardTitle>
                {sectionOpen.A ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Código</Label>
                  <Input
                    value={form.codigo}
                    readOnly
                    className="h-9 text-sm bg-slate-50 font-mono"
                    placeholder="Auto-generado"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Nombre del Puesto *</Label>
                  <Input
                    value={form.nombre_puesto}
                    onChange={e => setForm(p => ({ ...p, nombre_puesto: e.target.value }))}
                    className="h-9 text-sm"
                    placeholder="Ej: Analista de Nómina"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Área *</Label>
                  <Select value={form.area_id} onValueChange={v => setForm(p => ({ ...p, area_id: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.nombre} ({a.codigo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Banda Salarial</Label>
                  <Select value={form.banda_salarial_id} onValueChange={v => setForm(p => ({ ...p, banda_salarial_id: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar banda" /></SelectTrigger>
                    <SelectContent>
                      {bandas.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          G{b.grado} - {b.nombre} (${b.salario_minimo.toLocaleString()}-${b.salario_maximo.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Sector Laboral</Label>
                  <Select value={form.sector_laboral} onValueChange={v => setForm(p => ({ ...p, sector_laboral: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTORES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Estado</Label>
                  <Select value={form.estado} onValueChange={v => setForm(p => ({ ...p, estado: v }))} disabled={!canEdit}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section B - Propósito y Funciones */}
      <Collapsible open={sectionOpen.B} onOpenChange={(v) => setSectionOpen(p => ({ ...p, B: v }))}>
        <Card className="shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">B</span>
                  Propósito y Funciones
                </CardTitle>
                {sectionOpen.B ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-600">Propósito del Puesto</Label>
                <Textarea
                  value={form.proposito}
                  onChange={e => setForm(p => ({ ...p, proposito: e.target.value }))}
                  className="text-sm min-h-[80px]"
                  placeholder="Describa el propósito general del puesto..."
                  disabled={!canEdit}
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-600">Funciones Esenciales</Label>
                <div className="space-y-2 mt-1">
                  {form.funciones_esenciales.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-100">
                      <span className="text-xs font-mono text-slate-400 shrink-0">{i + 1}.</span>
                      <span className="text-sm flex-1">{f}</span>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-500" onClick={() => removeItem('funciones_esenciales', i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <div className="flex gap-2">
                      <Input
                        value={newFuncion}
                        onChange={e => setNewFuncion(e.target.value)}
                        className="h-8 text-sm flex-1"
                        placeholder="Agregar función esencial..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('funciones_esenciales', newFuncion, setNewFuncion); } }}
                      />
                      <Button size="sm" variant="outline" onClick={() => addItem('funciones_esenciales', newFuncion, setNewFuncion)} className="shrink-0">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                      </Button>
                    </div>
                  )}
                  {form.funciones_esenciales.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No hay funciones registradas</p>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section C - Requisitos del Cargo */}
      <Collapsible open={sectionOpen.C} onOpenChange={(v) => setSectionOpen(p => ({ ...p, C: v }))}>
        <Card className="shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-sky-100 text-sky-700 text-xs font-bold">C</span>
                  Requisitos del Cargo
                </CardTitle>
                {sectionOpen.C ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Requisitos de Educación</Label>
                  <Textarea
                    value={form.requisitos_educacion}
                    onChange={e => setForm(p => ({ ...p, requisitos_educacion: e.target.value }))}
                    className="text-sm min-h-[80px]"
                    placeholder="Ej: Licenciatura en Administración de Empresas..."
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Requisitos de Experiencia</Label>
                  <Textarea
                    value={form.requisitos_experiencia}
                    onChange={e => setForm(p => ({ ...p, requisitos_experiencia: e.target.value }))}
                    className="text-sm min-h-[80px]"
                    placeholder="Ej: Mínimo 3 años en posiciones similares..."
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-600">Requisitos de Habilidades</Label>
                <div className="space-y-2 mt-1">
                  {form.requisitos_habilidades.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-100">
                      <span className="text-xs font-mono text-slate-400 shrink-0">{i + 1}.</span>
                      <span className="text-sm flex-1">{h}</span>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-500" onClick={() => removeItem('requisitos_habilidades', i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <div className="flex gap-2">
                      <Input
                        value={newHabilidad}
                        onChange={e => setNewHabilidad(e.target.value)}
                        className="h-8 text-sm flex-1"
                        placeholder="Agregar habilidad..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('requisitos_habilidades', newHabilidad, setNewHabilidad); } }}
                      />
                      <Button size="sm" variant="outline" onClick={() => addItem('requisitos_habilidades', newHabilidad, setNewHabilidad)} className="shrink-0">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                      </Button>
                    </div>
                  )}
                  {form.requisitos_habilidades.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No hay habilidades registradas</p>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section D - Responsabilidades y Condiciones */}
      <Collapsible open={sectionOpen.D} onOpenChange={(v) => setSectionOpen(p => ({ ...p, D: v }))}>
        <Card className="shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">D</span>
                  Responsabilidades y Condiciones
                </CardTitle>
                {sectionOpen.D ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-600">Responsabilidades</Label>
                <div className="space-y-2 mt-1">
                  {form.responsabilidades.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-100">
                      <span className="text-xs font-mono text-slate-400 shrink-0">{i + 1}.</span>
                      <span className="text-sm flex-1">{r}</span>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-500" onClick={() => removeItem('responsabilidades', i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <div className="flex gap-2">
                      <Input
                        value={newResponsabilidad}
                        onChange={e => setNewResponsabilidad(e.target.value)}
                        className="h-8 text-sm flex-1"
                        placeholder="Agregar responsabilidad..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('responsabilidades', newResponsabilidad, setNewResponsabilidad); } }}
                      />
                      <Button size="sm" variant="outline" onClick={() => addItem('responsabilidades', newResponsabilidad, setNewResponsabilidad)} className="shrink-0">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                      </Button>
                    </div>
                  )}
                  {form.responsabilidades.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No hay responsabilidades registradas</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-600">Condiciones de Trabajo</Label>
                <Textarea
                  value={form.condiciones_trabajo}
                  onChange={e => setForm(p => ({ ...p, condiciones_trabajo: e.target.value }))}
                  className="text-sm min-h-[80px]"
                  placeholder="Describa las condiciones de trabajo del puesto..."
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Valuación por Puntos */}
      <Collapsible open={sectionOpen.valuation} onOpenChange={(v) => setSectionOpen(p => ({ ...p, valuation: v }))}>
        <Card className="shadow-sm border-2 border-dashed border-emerald-200">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-emerald-50/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  Valuación por Puntos
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">
                    Total: {totalPoints} pts
                  </Badge>
                  {sectionOpen.valuation ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <CardDescription className="mb-4">
                Asigne puntos (0-100) para cada factor de valuación. El total se calcula automáticamente.
              </CardDescription>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pointGroups.map(group => {
                  const colors = colorMap[group.color] || colorMap.emerald;
                  const subtotal = groupSubtotals[group.key] || 0;
                  return (
                    <div key={group.key} className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={colors.text}>{group.icon}</span>
                          <h4 className={`font-semibold text-sm ${colors.text}`}>{group.label}</h4>
                        </div>
                        <Badge variant="outline" className={`${colors.border} ${colors.text}`}>
                          {subtotal} pts
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {group.factors.map((factor, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-3">
                            <Label className="text-xs text-slate-600 w-32 shrink-0">{factor.label}</Label>
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={factor.value}
                                onChange={e => updatePointFactor(group.key, fIdx, parseInt(e.target.value))}
                                className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-emerald-500"
                                disabled={!canEdit}
                              />
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={factor.value}
                                onChange={e => updatePointFactor(group.key, fIdx, parseInt(e.target.value) || 0)}
                                className="h-7 w-16 text-sm text-center font-mono"
                                disabled={!canEdit}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Subtotal progress bar */}
                      <div className="mt-3">
                        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors.accent} rounded-full transition-all duration-300`}
                            style={{ width: `${Math.min(100, (subtotal / (group.factors.length * 100)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <Separator className="my-4" />
              <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-800">Total de Puntos de Valuación</span>
                </div>
                <span className="text-2xl font-bold font-mono text-emerald-700">{totalPoints}</span>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Version History */}
      {!isNewMode && versionHistory.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              Historial de Versiones
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {versionHistory.map(v => (
                <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-md bg-slate-50 border border-slate-100 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">v{v.version}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 truncate">{v.cambio_descripcion}</p>
                    <p className="text-xs text-slate-400">
                      {v.creado_por ? `${v.creado_por.nombre} ${v.creado_por.apellido} • ` : ''}
                      {v.fecha_creacion ? new Date(v.fecha_creacion).toLocaleDateString('es-SV') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setIsNewMode(true); setSelectedPerfilId(''); }}>
          <RotateCcw className="h-4 w-4 mr-1" /> Limpiar Formulario
        </Button>
        {canEdit && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSave}
            disabled={saving || !form.nombre_puesto || !form.area_id}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {isNewMode ? 'Crear Perfil' : 'Guardar Cambios'}
          </Button>
        )}
        {!canEdit && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <AlertCircle className="h-4 w-4" />
            Solo lectura — sin permisos de edición
          </div>
        )}
      </div>
    </div>
  );
}

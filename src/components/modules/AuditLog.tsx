'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, Download, Filter, ChevronDown, ChevronRight, Loader2, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface AuditLogProps {
  accessToken: string;
  userRole: string;
}

interface AuditEntry {
  id: string; usuario_id: string | null; usuario_email: string | null;
  accion: string; tabla_afectada: string | null; registro_id: string | null;
  valor_anterior: string | null; valor_nuevo: string | null; resultado: string | null;
  nivel_criticidad: string; ip_origen: string | null; user_agent: string | null;
  detalle_adicional: string | null; fecha_accion: string;
  usuario: { nombre: string; apellido: string; email: string } | null;
}

const criticidadColors: Record<string, string> = {
  NORMAL: 'bg-slate-100 text-slate-700',
  ALTO: 'bg-amber-100 text-amber-800',
  CRITICO: 'bg-red-100 text-red-800',
};

export default function AuditLog({ accessToken }: AuditLogProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filters
  const [filterUsuario, setFilterUsuario] = useState('');
  const [filterAccion, setFilterAccion] = useState('');
  const [filterTabla, setFilterTabla] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterCriticidad, setFilterCriticidad] = useState('');

  const pageSize = 50;

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (filterUsuario) params.set('usuario', filterUsuario);
      if (filterAccion) params.set('accion', filterAccion);
      if (filterTabla) params.set('tabla', filterTabla);
      if (filterFechaDesde) params.set('fecha_desde', filterFechaDesde);
      if (filterFechaHasta) params.set('fecha_hasta', filterFechaHasta);
      if (filterCriticidad) params.set('nivel_criticidad', filterCriticidad);

      const res = await fetch(`/api/admin/bitacora?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotal(data.pagination.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, filterUsuario, filterAccion, filterTabla, filterFechaDesde, filterFechaHasta, filterCriticidad]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.set('export', 'csv');
      if (filterUsuario) params.set('usuario', filterUsuario);
      if (filterAccion) params.set('accion', filterAccion);
      if (filterTabla) params.set('tabla', filterTabla);
      if (filterFechaDesde) params.set('fecha_desde', filterFechaDesde);
      if (filterFechaHasta) params.set('fecha_hasta', filterFechaHasta);
      if (filterCriticidad) params.set('nivel_criticidad', filterCriticidad);

      const res = await fetch(`/api/admin/bitacora?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bitacora_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'CSV exportado', description: 'Archivo descargado exitosamente' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error al exportar', variant: 'destructive' });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatJson = (jsonStr: string | null) => {
    if (!jsonStr) return null;
    try {
      return JSON.stringify(JSON.parse(jsonStr), null, 2);
    } catch {
      return jsonStr;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Bitácora de Auditoría</h2>
          <p className="text-sm text-slate-500">Registro inmutable de todas las acciones del sistema (solo lectura)</p>
        </div>
        <Button onClick={exportCSV} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Inmutabilidad notice */}
      <div className="bg-slate-50 border rounded-lg p-3 flex items-start gap-2">
        <Shield className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-600">Este registro es inmutable y de solo lectura. No se pueden modificar ni eliminar entradas.</p>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Usuario / Email</Label>
              <Input placeholder="Buscar usuario..." value={filterUsuario} onChange={(e) => { setFilterUsuario(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Acción</Label>
              <Select value={filterAccion} onValueChange={(v) => { setFilterAccion(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="CREAR">CREAR</SelectItem>
                  <SelectItem value="ACTUALIZAR">ACTUALIZAR</SelectItem>
                  <SelectItem value="DESACTIVAR">DESACTIVAR</SelectItem>
                  <SelectItem value="LOGIN">LOGIN</SelectItem>
                  <SelectItem value="APROBAR">APROBAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tabla</Label>
              <Input placeholder="Tabla afectada..." value={filterTabla} onChange={(e) => { setFilterTabla(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha Desde</Label>
              <Input type="date" value={filterFechaDesde} onChange={(e) => { setFilterFechaDesde(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha Hasta</Label>
              <Input type="date" value={filterFechaHasta} onChange={(e) => { setFilterFechaHasta(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Criticidad</Label>
              <Select value={filterCriticidad} onValueChange={(v) => { setFilterCriticidad(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="NORMAL">NORMAL</SelectItem>
                  <SelectItem value="ALTO">ALTO</SelectItem>
                  <SelectItem value="CRITICO">CRÍTICO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <ScrollText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No se encontraron registros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-semibold text-slate-700 w-8" />
                    <th className="text-left p-3 font-semibold text-slate-700">Fecha/Hora</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Usuario</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Acción</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Tabla</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Registro ID</th>
                    <th className="text-center p-3 font-semibold text-slate-700">Criticidad</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const isExpanded = expandedIds.has(entry.id);
                    return (
                      <React.Fragment key={entry.id}>
                        <tr className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => toggleExpand(entry.id)}>
                          <td className="p-3">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </td>
                          <td className="p-3 text-xs whitespace-nowrap">
                            {new Date(entry.fecha_accion).toLocaleString('es-SV')}
                          </td>
                          <td className="p-3 text-xs">
                            {entry.usuario ? `${entry.usuario.nombre} ${entry.usuario.apellido}` : entry.usuario_email || '-'}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{entry.accion}</Badge>
                          </td>
                          <td className="p-3 text-xs text-slate-600">{entry.tabla_afectada || '-'}</td>
                          <td className="p-3 text-xs font-mono text-slate-500">{entry.registro_id ? entry.registro_id.slice(0, 8) + '...' : '-'}</td>
                          <td className="p-3 text-center">
                            <Badge className={`${criticidadColors[entry.nivel_criticidad] || 'bg-gray-100'} text-xs`}>
                              {entry.nivel_criticidad}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-slate-600 max-w-48 truncate" title={entry.detalle_adicional || ''}>
                            {entry.detalle_adicional || '-'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b bg-slate-50">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {entry.valor_anterior && (
                                  <div>
                                    <p className="text-xs font-semibold text-red-600 mb-1">Valor Anterior</p>
                                    <pre className="text-xs bg-red-50 p-2 rounded border border-red-100 overflow-x-auto max-h-48 overflow-y-auto">
                                      {formatJson(entry.valor_anterior)}
                                    </pre>
                                  </div>
                                )}
                                {entry.valor_nuevo && (
                                  <div>
                                    <p className="text-xs font-semibold text-emerald-600 mb-1">Valor Nuevo</p>
                                    <pre className="text-xs bg-emerald-50 p-2 rounded border border-emerald-100 overflow-x-auto max-h-48 overflow-y-auto">
                                      {formatJson(entry.valor_nuevo)}
                                    </pre>
                                  </div>
                                )}
                                <div className="text-xs text-slate-500">
                                  <p>IP: {entry.ip_origen || '-'}</p>
                                  <p>User Agent: {entry.user_agent || '-'}</p>
                                  {entry.resultado && <p>Resultado: {entry.resultado}</p>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Plus, Download, Users, Loader2, ChevronLeft, ChevronRight,
  AlertCircle, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface EmployeeDirectoryProps {
  accessToken: string | null;
  userRole: UserRole;
  onNavigateToDetail: (empleadoId: string) => void;
  onNavigateToNew: () => void;
}

interface Area {
  id: string;
  nombre: string;
  codigo: string;
}

interface PerfilPuesto {
  id: string;
  nombre_puesto: string;
  codigo: string;
}

interface Empleado {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  dui: string;
  estado: string;
  salario_base: number;
  area: Area | null;
  perfilPuesto: PerfilPuesto | null;
}

export default function EmployeeDirectory({ accessToken, userRole, onNavigateToDetail, onNavigateToNew }: EmployeeDirectoryProps) {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilPuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [perfilFilter, setPerfilFilter] = useState('all');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 0 });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));
      if (search) params.set('search', search);
      if (areaFilter && areaFilter !== 'all') params.set('area_id', areaFilter);
      if (estadoFilter && estadoFilter !== 'all') params.set('estado', estadoFilter);
      if (perfilFilter && perfilFilter !== 'all') params.set('perfil_puesto_id', perfilFilter);

      const res = await fetch(`/api/empleados?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, pagination.page, pagination.pageSize, search, areaFilter, estadoFilter, perfilFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Fetch areas and perfiles for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [areasRes, perfilesRes] = await Promise.all([
          fetch('/api/areas', { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch('/api/perfiles-puesto', { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        if (areasRes.ok) {
          const areasData = await areasRes.json();
          setAreas(areasData.data || areasData || []);
        }
        if (perfilesRes.ok) {
          const perfilesData = await perfilesRes.json();
          setPerfiles(perfilesData.data || perfilesData || []);
        }
      } catch {
        // Filters may fail silently
      }
    };
    fetchFilters();
  }, [accessToken]);

  const formatSalary = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getNombreCompleto = (emp: Empleado) =>
    `${emp.primer_nombre}${emp.segundo_nombre ? ' ' + emp.segundo_nombre : ''} ${emp.primer_apellido}${emp.segundo_apellido ? ' ' + emp.segundo_apellido : ''}`;

  const exportCSV = () => {
    const headers = ['Código', 'Nombre Completo', 'DUI', 'Área', 'Puesto', 'Salario', 'Estado'];
    const rows = employees.map(emp => [
      emp.codigo_empleado,
      getNombreCompleto(emp),
      emp.dui,
      emp.area?.nombre || '',
      emp.perfilPuesto?.nombre_puesto || '',
      emp.salario_base.toString(),
      emp.estado,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `empleados_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const canCreate = userRole === 'ADMIN' || userRole === 'ANALISTA';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Directorio de Empleados
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {pagination.total} empleado{pagination.total !== 1 ? 's' : ''} registrado{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={employees.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          {canCreate && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onNavigateToNew}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo Empleado
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div className="sm:col-span-2 lg:col-span-1 xl:col-span-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, DUI, código..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                className="pl-9 h-9"
              />
            </div>
            <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={(v) => { setEstadoFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="ACTIVO">Activo</SelectItem>
                <SelectItem value="INACTIVO">Inactivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={perfilFilter} onValueChange={(v) => { setPerfilFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Puesto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los puestos</SelectItem>
                {perfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_puesto}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <Card className="shadow-sm hidden lg:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Nombre Completo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead className="text-right">Salario</TableHead>
                <TableHead className="w-[100px]">Estado</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <AlertCircle className="h-10 w-10 mb-2" />
                      <p className="text-sm font-medium">No se encontraron empleados</p>
                      <p className="text-xs">Intente ajustar los filtros de búsqueda</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employees.map(emp => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-emerald-50/50 transition-colors"
                    onClick={() => onNavigateToDetail(emp.id)}
                  >
                    <TableCell className="font-mono text-xs">{emp.codigo_empleado}</TableCell>
                    <TableCell className="font-medium">{getNombreCompleto(emp)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{emp.area?.nombre || '—'}</TableCell>
                    <TableCell className="text-sm text-slate-600">{emp.perfilPuesto?.nombre_puesto || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatSalary(emp.salario_base)}</TableCell>
                    <TableCell>
                      <Badge variant={emp.estado === 'ACTIVO' ? 'default' : 'secondary'} className={emp.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600'}>
                        {emp.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onNavigateToDetail(emp.id); }}>
                        <User className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card Layout */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : employees.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center text-slate-400">
                <AlertCircle className="h-10 w-10 mb-2" />
                <p className="text-sm font-medium">No se encontraron empleados</p>
                <p className="text-xs">Intente ajustar los filtros de búsqueda</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          employees.map(emp => (
            <Card key={emp.id} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateToDetail(emp.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{getNombreCompleto(emp)}</p>
                    <p className="text-xs text-slate-500 font-mono">{emp.codigo_empleado} • DUI: {emp.dui}</p>
                    <p className="text-sm text-slate-600 mt-1">{emp.area?.nombre || 'Sin área'} — {emp.perfilPuesto?.nombre_puesto || 'Sin puesto'}</p>
                  </div>
                  <Badge variant={emp.estado === 'ACTIVO' ? 'default' : 'secondary'} className={emp.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                    {emp.estado}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <span className="text-sm font-semibold text-slate-900">{formatSalary(emp.salario_base)}</span>
                  <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700">
                    Ver detalle →
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-slate-500">
            Mostrando {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-2">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

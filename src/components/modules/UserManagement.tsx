'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Plus, Edit2, Loader2, KeyRound, Users, Mail, Search,
  Filter, X, CheckCircle, UserCheck, UserPlus, Crown, AlertTriangle,
  ChevronRight, ChevronLeft, Eye, EyeOff, Clock, Power, PowerOff,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface UserManagementProps {
  accessToken: string;
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  estado: string;
  ultimo_login: string | null;
  debe_cambiar_password: boolean;
  fecha_creacion: string;
  empleado_id?: string | null;
  empleado: { codigo_empleado: string; primer_nombre: string; primer_apellido: string } | null;
}

interface EmpleadoOption {
  id: string;
  codigo_empleado: string;
  primer_nombre: string;
  primer_apellido: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string; desc: string }> = {
  ADMIN: { label: 'Administrador', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', icon: '🔑', desc: 'Acceso total al sistema' },
  ANALISTA: { label: 'Analista', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-300 dark:border-teal-700', icon: '📊', desc: 'Gestión de nómina y datos' },
  APROBADOR: { label: 'Aprobador', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', icon: '✅', desc: 'Aprobación de planillas' },
  GERENCIA: { label: 'Gerencia', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', icon: '👔', desc: 'Vista gerencial y reportes' },
  AUDITOR: { label: 'Auditor', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-violet-300 dark:border-violet-700', icon: '🔍', desc: 'Auditoría y cumplimiento' },
  EMPLEADO: { label: 'Empleado', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-300 dark:border-cyan-700', icon: '👤', desc: 'Portal de autoservicio' },
};

const GRADIENT_COLORS: string[] = [
  'from-emerald-400 to-teal-500',
  'from-teal-400 to-cyan-500',
  'from-cyan-400 to-sky-500',
  'from-amber-400 to-orange-500',
  'from-violet-400 to-purple-500',
  'from-rose-400 to-pink-500',
];

function getInitials(nombre: string, apellido: string): string {
  return `${(nombre || '').charAt(0)}${(apellido || '').charAt(0)}`.toUpperCase();
}

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length];
}

function formatRelativeDate(d: string | null): string {
  if (!d) return 'Nunca';
  const now = new Date();
  const date = new Date(d);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-SV', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score: 20, label: 'Muy débil', color: 'bg-red-500' };
  if (score === 2) return { score: 40, label: 'Débil', color: 'bg-orange-500' };
  if (score === 3) return { score: 60, label: 'Regular', color: 'bg-yellow-500' };
  if (score === 4) return { score: 80, label: 'Fuerte', color: 'bg-emerald-400' };
  return { score: 100, label: 'Muy fuerte', color: 'bg-emerald-600' };
}

export default function UserManagement({ accessToken }: UserManagementProps) {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { toast } = useToast();

  // Wizard state for create user
  const [wizardStep, setWizardStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);

  const [newUser, setNewUser] = useState({
    email: '', password: '', nombre: '', apellido: '', rol: 'EMPLEADO', empleado_id: '',
  });

  const [editForm, setEditForm] = useState({ rol: '', estado: '' });
  const [resetForm, setResetForm] = useState({ new_password: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) setUsers(data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Fetch employees for linking
  const fetchEmpleados = useCallback(async () => {
    try {
      const res = await fetch('/api/empleados?pageSize=200', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) setEmpleados(data.data || []);
    } catch { /* ignore */ }
  }, [accessToken]);

  useEffect(() => { fetchEmpleados(); }, [fetchEmpleados]);

  // Computed stats
  const stats = useMemo(() => ({
    total: users.length,
    activos: users.filter(u => u.estado === 'ACTIVO').length,
    nuevosMes: users.filter(u => {
      const created = new Date(u.fecha_creacion);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length,
    admins: users.filter(u => u.rol === 'ADMIN').length,
  }), [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let result = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.rol.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'ALL') result = result.filter(u => u.rol === roleFilter);
    if (statusFilter !== 'ALL') result = result.filter(u => u.estado === statusFilter);
    return result;
  }, [users, searchQuery, roleFilter, statusFilter]);

  const activeFilterCount = (roleFilter !== 'ALL' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0) + (searchQuery ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
  };

  const handleCreate = async () => {
    if (!newUser.email || !newUser.password || !newUser.nombre || !newUser.apellido) {
      toast({ title: 'Error', description: 'Todos los campos son requeridos', variant: 'destructive' });
      return;
    }
    if (newUser.password.length < 8) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 8 caracteres', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { ...newUser };
      if (!body.empleado_id) delete body.empleado_id;
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Usuario creado', description: `${newUser.email} registrado exitosamente` });
        setDialogOpen(false);
        setNewUser({ email: '', password: '', nombre: '', apellido: '', rol: 'EMPLEADO', empleado_id: '' });
        setWizardStep(1);
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al crear usuario', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Usuario actualizado', description: 'Los cambios han sido guardados' });
        setEditDialogOpen(false);
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (!resetForm.new_password || resetForm.new_password.length < 8) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 8 caracteres', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reset_password: true, new_password: resetForm.new_password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Contraseña restablecida', description: 'El usuario deberá cambiarla en su próximo inicio de sesión' });
        setResetDialogOpen(false);
        setResetForm({ new_password: '' });
      } else {
        toast({ title: 'Error', description: data.error || 'Error al restablecer', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (user: Usuario) => {
    const newStatus = user.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const msg = newStatus === 'INACTIVO' ? 'desactivar' : 'activar';
    if (!confirm(`¿Está seguro de ${msg} este usuario?`)) return;
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ estado: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `Usuario ${newStatus === 'ACTIVO' ? 'activado' : 'desactivado'}`, description: `El usuario ha sido ${newStatus === 'ACTIVO' ? 'activado' : 'desactivado'}` });
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Error al actualizar', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  const pwdStrength = getPasswordStrength(newUser.password);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-600" /> Gestión de Usuarios
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Administre cuentas, roles y permisos del sistema</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={() => { setWizardStep(1); setNewUser({ email: '', password: '', nombre: '', apellido: '', rol: 'EMPLEADO', empleado_id: '' }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Usuario
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Usuarios</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Usuarios Activos</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.activos}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-cyan-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nuevos este Mes</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.nuevosMes}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Administradores</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.admins}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, email o rol..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-[160px]">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los roles</SelectItem>
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span>{cfg.icon}</span> {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[140px]">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-slate-500">Filtros activos:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  &quot;{searchQuery}&quot; <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                </Badge>
              )}
              {roleFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {ROLE_CONFIG[roleFilter]?.label} <X className="h-3 w-3 cursor-pointer" onClick={() => setRoleFilter('ALL')} />
                </Badge>
              )}
              {statusFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {statusFilter} <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter('ALL')} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-500" onClick={clearFilters}>
                Limpiar todo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-slate-400 dark:text-slate-500">
              <Users className="h-12 w-12 mb-3" />
              <p className="text-base font-medium">
                {users.length === 0 ? 'No hay usuarios registrados' : 'No se encontraron resultados'}
              </p>
              <p className="text-sm mt-1">
                {users.length === 0 ? 'Cree el primer usuario para comenzar' : 'Intente ajustar los filtros de búsqueda'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers.map(u => {
            const roleCfg = ROLE_CONFIG[u.rol] || ROLE_CONFIG.EMPLEADO;
            return (
              <Card key={u.id} className={`shadow-sm hover:shadow-md transition-shadow border-l-4 ${u.estado === 'ACTIVO' ? 'border-l-emerald-500' : 'border-l-slate-400'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${getGradient(u.nombre + u.apellido)} flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-sm`}>
                      {getInitials(u.nombre, u.apellido)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {u.nombre} {u.apellido}
                        </h3>
                        {u.estado === 'ACTIVO' ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {u.estado}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={`${roleCfg.bg} ${roleCfg.color} ${roleCfg.border} border text-xs font-medium`}>
                          {roleCfg.icon} {u.rol}
                        </Badge>
                        {u.debe_cambiar_password && (
                          <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Cambiar contraseña
                          </Badge>
                        )}
                      </div>
                      {u.empleado && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                          Vinculado: {u.empleado.codigo_empleado} - {u.empleado.primer_nombre} {u.empleado.primer_apellido}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeDate(u.ultimo_login)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-emerald-600" onClick={() => {
                      setSelectedUser(u);
                      setEditForm({ rol: u.rol, estado: u.estado });
                      setEditDialogOpen(true);
                    }}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-600 dark:text-slate-300 hover:text-amber-600" onClick={() => {
                      setSelectedUser(u);
                      setResetForm({ new_password: '' });
                      setResetDialogOpen(true);
                    }}>
                      <KeyRound className="h-3.5 w-3.5 mr-1" /> Contraseña
                    </Button>
                    <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs ${u.estado === 'ACTIVO' ? 'text-red-500 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-700'}`} onClick={() => handleToggleStatus(u)}>
                      {u.estado === 'ACTIVO' ? <><PowerOff className="h-3.5 w-3.5 mr-1" /> Desactivar</> : <><Power className="h-3.5 w-3.5 mr-1" /> Activar</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create User Dialog - Step Wizard */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" /> Nuevo Usuario
            </DialogTitle>
            <DialogDescription>Crear una nueva cuenta de usuario en el sistema</DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-4">
            {[
              { num: 1, label: 'Personal' },
              { num: 2, label: 'Rol' },
              { num: 3, label: 'Revisión' },
            ].map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`flex items-center gap-1.5 ${wizardStep >= s.num ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep > s.num ? 'bg-emerald-600 text-white' : wizardStep === s.num ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    {wizardStep > s.num ? <CheckCircle className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-0.5 ${wizardStep > s.num ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Personal Info */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Información Personal</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nombre *</Label>
                      <Input value={newUser.nombre} onChange={e => setNewUser(p => ({ ...p, nombre: e.target.value }))} className="h-9" placeholder="Nombre" />
                    </div>
                    <div>
                      <Label className="text-xs">Apellido *</Label>
                      <Input value={newUser.apellido} onChange={e => setNewUser(p => ({ ...p, apellido: e.target.value }))} className="h-9" placeholder="Apellido" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="h-9 pl-8" placeholder="correo@ejemplo.com" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs">Contraseña *</Label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="h-9 pr-9" placeholder="Mínimo 8 caracteres" />
                      <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {/* Password strength meter */}
                    {newUser.password && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${pwdStrength.color} rounded-full transition-all duration-300`} style={{ width: `${pwdStrength.score}%` }} />
                        </div>
                        <p className={`text-xs mt-1 ${pwdStrength.score <= 40 ? 'text-red-500' : pwdStrength.score <= 60 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                          {pwdStrength.label}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setWizardStep(2)} disabled={!newUser.email || !newUser.password || !newUser.nombre || !newUser.apellido}>
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Role Assignment */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Asignación de Rol</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        className={`p-3 rounded-lg border-2 text-left transition-all ${newUser.rol === key ? `${cfg.border} ${cfg.bg} ring-1 ring-emerald-300` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                        onClick={() => setNewUser(p => ({ ...p, rol: key }))}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cfg.icon}</span>
                          <div>
                            <p className={`text-xs font-bold ${newUser.rol === key ? cfg.color : 'text-slate-700 dark:text-slate-300'}`}>{key}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{cfg.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Label className="text-xs">Empleado vinculado (opcional)</Label>
                    <Select value={newUser.empleado_id} onValueChange={v => setNewUser(p => ({ ...p, empleado_id: v }))}>
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue placeholder="Seleccionar empleado..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin vincular</SelectItem>
                        {empleados.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.codigo_empleado} - {emp.primer_nombre} {emp.primer_apellido}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">Vincule el usuario a un empleado existente para acceso al portal</p>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setWizardStep(3)}>
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Revisión</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Nombre</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{newUser.nombre} {newUser.apellido}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100 break-all">{newUser.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Rol</p>
                      <Badge className={`${ROLE_CONFIG[newUser.rol]?.bg} ${ROLE_CONFIG[newUser.rol]?.color} ${ROLE_CONFIG[newUser.rol]?.border} border`}>
                        {ROLE_CONFIG[newUser.rol]?.icon} {newUser.rol}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Empleado vinculado</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {newUser.empleado_id && newUser.empleado_id !== '_none'
                          ? empleados.find(e => e.id === newUser.empleado_id)?.codigo_empleado || 'Sí'
                          : 'Sin vincular'}
                      </p>
                    </div>
                  </div>
                  <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> El usuario deberá cambiar su contraseña en el primer inicio de sesión
                    </p>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreate} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />} Crear Usuario
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-emerald-600" /> Editar Usuario
            </DialogTitle>
            <DialogDescription>Modificar rol y estado del usuario</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {/* User info header */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${getGradient(selectedUser.nombre + selectedUser.apellido)} flex items-center justify-center text-white font-bold text-sm`}>
                  {getInitials(selectedUser.nombre, selectedUser.apellido)}
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{selectedUser.nombre} {selectedUser.apellido}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
                </div>
              </div>

              {/* Role selector with visual cards */}
              <div>
                <Label className="text-xs mb-2 block">Rol</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      className={`p-2 rounded-lg border text-center transition-all text-xs ${editForm.rol === key ? `${cfg.border} ${cfg.bg} ring-1 ring-emerald-300` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                      onClick={() => setEditForm(p => ({ ...p, rol: key }))}
                    >
                      <span className="text-base">{cfg.icon}</span>
                      <p className={`font-bold mt-0.5 ${editForm.rol === key ? cfg.color : 'text-slate-700 dark:text-slate-300'}`}>{key}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status toggle */}
              <div>
                <Label className="text-xs mb-2 block">Estado</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['ACTIVO', 'INACTIVO', 'BLOQUEADO'].map(status => (
                    <button
                      key={status}
                      type="button"
                      className={`p-2 rounded-lg border text-center transition-all text-xs ${editForm.estado === status ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-300' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                      onClick={() => setEditForm(p => ({ ...p, estado: status }))}
                    >
                      <span className={`h-2 w-2 rounded-full inline-block ${status === 'ACTIVO' ? 'bg-emerald-500' : status === 'INACTIVO' ? 'bg-slate-400' : 'bg-red-500'}`} />
                      <p className="font-medium mt-0.5 text-slate-700 dark:text-slate-300">{status === 'ACTIVO' ? 'Activo' : status === 'INACTIVO' ? 'Inactivo' : 'Bloqueado'}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedUser(selectedUser);
                  setResetForm({ new_password: '' });
                  setResetDialogOpen(true);
                }}>
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Restablecer Contraseña
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleEdit} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Guardar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600" /> Restablecer Contraseña
            </DialogTitle>
            <DialogDescription>Establecer nueva contraseña para {selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nueva Contraseña</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={resetForm.new_password} onChange={e => setResetForm(p => ({ ...p, new_password: e.target.value }))} className="h-9 pr-9" />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Mínimo 8 caracteres. El usuario deberá cambiarla al iniciar sesión.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleResetPassword} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Restablecer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

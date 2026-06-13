'use client';

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import {
  Users, Briefcase, Calculator, FileText, Settings, User, Shield,
  ChevronDown, ChevronRight, LogOut, Lock, Menu, X, LayoutDashboard,
  DollarSign, CheckCircle, Send, Gift, ClipboardList, ListChecks,
  BarChart3, BookOpen, GitBranch, Plug, ScrollText, Eye,
  AlertCircle, Loader2, KeyRound, ArrowLeft, Plus, XCircle, Clock,
  Sun, Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

// Module components
import EmployeeDirectory from '@/components/modules/EmployeeDirectory';
import EmployeeDetail from '@/components/modules/EmployeeDetail';
import NewEmployeeForm from '@/components/modules/NewEmployeeForm';
import IncidenceManager from '@/components/modules/IncidenceManager';
import UserManagement from '@/components/modules/UserManagement';
import PayrollDashboard from '@/components/modules/PayrollDashboard';
import PayrollPeriods from '@/components/modules/PayrollPeriods';
import PayrollCalculation from '@/components/modules/PayrollCalculation';
import PayrollApproval from '@/components/modules/PayrollApproval';
import BankDispersion from '@/components/modules/BankDispersion';
import AguinaldoView from '@/components/modules/AguinaldoView';
import LiquidationView from '@/components/modules/LiquidationView';
import ProfileCatalog from '@/components/modules/ProfileCatalog';
import SalaryBands from '@/components/modules/SalaryBands';
import IsssReport from '@/components/modules/IsssReport';
import AfpReport from '@/components/modules/AfpReport';
import IsrReport from '@/components/modules/IsrReport';
import TalentReport from '@/components/modules/TalentReport';
import LegalParameters from '@/components/modules/LegalParameters';
import OrgChart from '@/components/modules/OrgChart';
import Integrations from '@/components/modules/Integrations';
import AuditLog from '@/components/modules/AuditLog';
import SelfServicePortal from '@/components/modules/SelfServicePortal';
import ProfileDescriptiveForm from '@/components/modules/ProfileDescriptiveForm';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import NotificationBell from '@/components/NotificationBell';

// ============================================================
// Types
// ============================================================
type UserRole = 'ADMIN' | 'ANALISTA' | 'APROBADOR' | 'GERENCIA' | 'AUDITOR' | 'EMPLEADO';

interface UserData {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  debe_cambiar_password: boolean;
  empleadoId?: string;
}

interface AuthContextType {
  user: UserData | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  isLoading: boolean;
}

// ============================================================
// Auth Context
// ============================================================
const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================
// View Types
// ============================================================
type ViewId =
  | 'dashboard'
  | '02-01' | '02-02' | '02-03' | '02-04'
  | '03-01' | '03-02' | '03-03'
  | '04-01' | '04-02' | '04-03' | '04-04' | '04-05' | '04-06' | '04-07'
  | '05-01' | '05-02' | '05-03' | '05-04'
  | '06-01' | '06-02' | '06-03' | '06-04' | '06-05'
  | '01-03';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  roles: UserRole[];
}

// ============================================================
// Navigation Configuration (RBAC)
// ============================================================
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Seguridad',
    icon: Shield,
    roles: ['ADMIN'],
    items: [
      { id: '01-03', label: 'Gestión Usuarios', icon: Users },
    ],
  },
  {
    title: 'Módulo 02 - Empleados',
    icon: Users,
    roles: ['ADMIN', 'ANALISTA', 'AUDITOR'],
    items: [
      { id: '02-01', label: 'Directorio', icon: ListChecks },
      { id: '02-03', label: 'Nuevo Empleado', icon: User },
      { id: '02-04', label: 'Incidencias', icon: AlertCircle },
    ],
  },
  {
    title: 'Módulo 03 - Perfiles',
    icon: Briefcase,
    roles: ['ADMIN', 'ANALISTA', 'APROBADOR', 'AUDITOR'],
    items: [
      { id: '03-01', label: 'Catálogo', icon: BookOpen },
      { id: '03-02', label: 'Formulario de Perfil', icon: FileText },
      { id: '03-03', label: 'Bandas Salariales', icon: DollarSign },
    ],
  },
  {
    title: 'Módulo 04 - Nómina',
    icon: Calculator,
    roles: ['ADMIN', 'ANALISTA', 'APROBADOR', 'GERENCIA', 'AUDITOR'],
    items: [
      { id: '04-01', label: 'Dashboard', icon: LayoutDashboard },
      { id: '04-02', label: 'Períodos', icon: CalendarIcon },
      { id: '04-03', label: 'Cálculo', icon: Calculator },
      { id: '04-04', label: 'Aprobación', icon: CheckCircle },
      { id: '04-05', label: 'Dispersión', icon: Send },
      { id: '04-06', label: 'Aguinaldo', icon: Gift },
      { id: '04-07', label: 'Liquidaciones', icon: ClipboardList },
    ],
  },
  {
    title: 'Módulo 05 - Reportes',
    icon: FileText,
    roles: ['ADMIN', 'GERENCIA', 'AUDITOR'],
    items: [
      { id: '05-01', label: 'Planilla ISSS', icon: FileText },
      { id: '05-02', label: 'Planilla AFP', icon: FileText },
      { id: '05-03', label: 'Retenciones ISR', icon: FileText },
      { id: '05-04', label: 'Gestión Talento', icon: BarChart3 },
    ],
  },
  {
    title: 'Módulo 06 - Admin',
    icon: Settings,
    roles: ['ADMIN', 'APROBADOR'],
    items: [
      { id: '06-01', label: 'Parámetros Legales', icon: ScaleIcon },
      { id: '06-02', label: 'Organigrama', icon: GitBranch },
      { id: '06-03', label: 'Integraciones', icon: Plug },
      { id: '06-04', label: 'Bitácora', icon: ScrollText },
    ],
  },
  {
    title: 'Vista Empleado',
    icon: User,
    roles: ['EMPLEADO'],
    items: [
      { id: '06-05', label: 'Mi Portal', icon: Eye },
    ],
  },
];

// Filter items within a group based on more granular RBAC
function getVisibleItems(group: NavGroup, role: UserRole): NavItem[] {
  const roleItemMap: Record<UserRole, Record<string, string[]>> = {
    ADMIN: {
      'Seguridad': ['01-03'],
      'Módulo 02 - Empleados': ['02-01', '02-03', '02-04'],
      'Módulo 03 - Perfiles': ['03-01', '03-02', '03-03'],
      'Módulo 04 - Nómina': ['04-01', '04-02', '04-03', '04-04', '04-05', '04-06', '04-07'],
      'Módulo 05 - Reportes': ['05-01', '05-02', '05-03', '05-04'],
      'Módulo 06 - Admin': ['06-01', '06-02', '06-03', '06-04'],
      'Vista Empleado': [],
    },
    ANALISTA: {
      'Módulo 02 - Empleados': ['02-01', '02-03', '02-04'],
      'Módulo 03 - Perfiles': ['03-01', '03-02'],
      'Módulo 04 - Nómina': ['04-01', '04-02', '04-03', '04-06'],
    },
    APROBADOR: {
      'Módulo 03 - Perfiles': ['03-03'],
      'Módulo 04 - Nómina': ['04-04', '04-05', '04-07'],
      'Módulo 06 - Admin': ['06-01'],
    },
    GERENCIA: {
      'Módulo 04 - Nómina': ['04-01'],
      'Módulo 05 - Reportes': ['05-01', '05-02', '05-03', '05-04'],
    },
    AUDITOR: {
      'Módulo 02 - Empleados': ['02-01'],
      'Módulo 03 - Perfiles': ['03-01'],
      'Módulo 04 - Nómina': ['04-01', '04-02', '04-03'],
      'Módulo 05 - Reportes': ['05-01', '05-02', '05-03', '05-04'],
      'Módulo 06 - Admin': ['06-04'],
    },
    EMPLEADO: {
      'Vista Empleado': ['06-05'],
    },
  };

  const allowedIds = roleItemMap[role]?.[group.title] ?? [];
  return group.items.filter(item => allowedIds.includes(item.id));
}

// Custom calendar icon since we can't import it from lucide
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  );
}

function ScaleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 3h5v5"/>
      <path d="M8 3H3v5"/>
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/>
      <path d="m15 9 6-6"/>
    </svg>
  );
}

// ============================================================
// VIEW LABELS MAP
// ============================================================
const VIEW_LABELS: Record<ViewId, string> = {
  'dashboard': 'Dashboard',
  '01-03': 'Gestión de Usuarios',
  '02-01': 'Directorio de Empleados',
  '02-02': 'Detalle de Empleado',
  '02-03': 'Nuevo Empleado',
  '02-04': 'Incidencias',
  '03-01': 'Catálogo de Perfiles',
  '03-02': 'Formulario de Perfil',
  '03-03': 'Bandas Salariales',
  '04-01': 'Dashboard Nómina',
  '04-02': 'Períodos de Nómina',
  '04-03': 'Cálculo de Nómina',
  '04-04': 'Aprobación de Nómina',
  '04-05': 'Dispersión de Pago',
  '04-06': 'Aguinaldo',
  '04-07': 'Liquidaciones',
  '05-01': 'Planilla ISSS',
  '05-02': 'Planilla AFP',
  '05-03': 'Retenciones ISR',
  '05-04': 'Gestión de Talento',
  '06-01': 'Parámetros Legales',
  '06-02': 'Organigrama',
  '06-03': 'Integraciones',
  '06-04': 'Bitácora',
  '06-05': 'Mi Portal',
};

// ============================================================
// LOGIN SCREEN
// ============================================================
interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function LoginScreen({ onLogin, isLoading, error }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-100/40 dark:bg-emerald-900/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '0s' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-100/30 dark:bg-teal-900/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-emerald-400/30 dark:bg-emerald-500/20 rounded-full" />
        <div className="absolute top-1/3 left-1/3 w-1.5 h-1.5 bg-teal-400/20 dark:bg-teal-500/15 rounded-full" />
        <div className="absolute bottom-1/4 right-1/3 w-1 h-1 bg-emerald-300/30 dark:bg-emerald-500/10 rounded-full" />
        {/* Animated floating shapes */}
        <div className="absolute top-20 left-20 w-12 h-12 border border-emerald-200/30 dark:border-emerald-700/20 rounded-lg rotate-12 animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 right-32 w-8 h-8 border border-teal-200/30 dark:border-teal-700/20 rounded-full animate-float" style={{ animationDelay: '3s' }} />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-800/30 mb-4 relative animate-float">
            <svg viewBox="0 0 40 40" className="w-10 h-10 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4L4 12V28L20 36L36 28V12L20 4Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15"/>
              <path d="M20 4L4 12L20 20L36 12L20 4Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 12V28L20 36V20L4 12Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M36 12V28L20 36V20L36 12Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {/* Decorative ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/30 scale-110" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Sistema de Nómina y Perfiles de Puestos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm flex items-center justify-center gap-1.5">
            <span className="inline-block w-4 h-[1px] bg-slate-300 dark:bg-slate-600" />
            República de El Salvador
            <span className="inline-block w-4 h-[1px] bg-slate-300 dark:bg-slate-600" />
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 shadow-slate-200/60 dark:shadow-slate-900/40 dark:bg-slate-900 animate-scale-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 dark:text-slate-100">
              <div className="w-1.5 h-5 rounded-full bg-emerald-500" />
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Ingrese sus credenciales para acceder al sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@nomina.gob.sv"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-1.5 dark:text-slate-300">
                  <svg className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              {/* Remember me checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                />
                <Label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">Recordarme</Label>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    Iniciar Sesión
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </span>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="w-full text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline transition-colors flex items-center justify-center gap-1"
              >
                <Lock className="h-3 w-3" />
                ¿Olvidó su contraseña?
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="mt-4 bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/40 shadow-sm animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2.5 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              Credenciales de Demostración
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { email: 'admin@nomina.gob.sv', pass: 'Admin2026!', role: 'ADMIN' },
                { email: 'analista@nomina.gob.sv', pass: 'Analista2026!', role: 'ANALISTA' },
                { email: 'aprobador@nomina.gob.sv', pass: 'Aprobador2026!', role: 'APROBADOR' },
                { email: 'gerencia@nomina.gob.sv', pass: 'Gerencia2026!', role: 'GERENCIA' },
                { email: 'auditor@nomina.gob.sv', pass: 'Auditor2026!', role: 'AUDITOR' },
                { email: 'empleado@nomina.gob.sv', pass: 'Empleado2026!', role: 'EMPLEADO' },
              ].map((cred) => (
                <button
                  key={cred.email}
                  type="button"
                  onClick={() => { setEmail(cred.email); setPassword(cred.pass); }}
                  className="flex items-center gap-1.5 p-1.5 rounded-md hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors text-left group"
                >
                  <span className="text-amber-700 dark:text-amber-400 group-hover:text-amber-900 dark:group-hover:text-amber-300 truncate">{cred.email}</span>
                  <span className="text-amber-400 dark:text-amber-500 ml-auto shrink-0 tabular-nums">{cred.pass}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Password Recovery Dialog */}
        <PasswordRecoveryDialog open={showRecovery} onOpenChange={setShowRecovery} />
      </div>
    </div>
  );
}

// ============================================================
// PASSWORD RECOVERY DIALOG
// ============================================================
interface PasswordRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PasswordRecoveryDialog({ open, onOpenChange }: PasswordRecoveryDialogProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();

  const handleReset = () => {
    setStep(1);
    setEmail('');
    setOtp('');
    setOtpId('');
    setNewPassword('');
    setConfirmPassword('');
    setDemoOtp(null);
    setIsLoading(false);
    setError(null);
    setSuccess(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) handleReset();
    onOpenChange(newOpen);
  };

  const handleStep1 = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al solicitar código');
        return;
      }
      setDemoOtp(data.demo_otp);
      setSuccess('Código enviado. Verifique su correo.');
      setStep(2);
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2 = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Código inválido');
        return;
      }
      setOtpId(data.otp_id);
      setSuccess('Código verificado');
      setStep(3);
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep3 = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_id: otpId, email, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al actualizar contraseña');
        return;
      }
      toast({
        title: 'Contraseña actualizada',
        description: 'Puede iniciar sesión con su nueva contraseña',
      });
      handleClose(false);
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = ['Email', 'Verificación', 'Nueva Contraseña'];
  const progressValue = (step / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            Recuperar Contraseña
          </DialogTitle>
          <DialogDescription>
            Siga los pasos para restablecer su contraseña
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            {stepLabels.map((label, i) => (
              <span key={i} className={step > i ? 'text-emerald-600 font-medium' : step === i + 1 ? 'text-slate-900 font-medium' : ''}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && step > 1 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Correo Electrónico</Label>
                <Input
                  type="email"
                  placeholder="usuario@nomina.gob.sv"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleStep1} disabled={isLoading || !email} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar Código
              </Button>
            </div>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código de Verificación</Label>
                <Input
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isLoading}
                  className="text-center text-lg tracking-[0.5em] font-mono"
                  maxLength={6}
                />
              </div>
              {demoOtp && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                  Demo - Código: <strong>{demoOtp}</strong>
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Volver
                </Button>
                <Button onClick={handleStep2} disabled={isLoading || otp.length !== 6} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verificar
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nueva Contraseña</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Contraseña</Label>
                <Input
                  type="password"
                  placeholder="Repita la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleStep3} disabled={isLoading || !newPassword || !confirmPassword} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Actualizar Contraseña
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
interface SidebarProps {
  user: UserData;
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function Sidebar({ user, currentView, onNavigate, collapsed, onToggle }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV_GROUPS.forEach(g => {
      if (g.roles.includes(user.rol)) {
        initial.add(g.title);
      }
    });
    return initial;
  });

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out ${
          collapsed ? '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden' : 'w-64 translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0 shadow-lg shadow-emerald-900/40">
            <svg viewBox="0 0 40 40" className="w-5 h-5 text-white" fill="none">
              <path d="M20 4L4 12V28L20 36L36 28V12L20 4Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15"/>
              <path d="M20 4L4 12L20 20L36 12L20 4Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight whitespace-nowrap tracking-tight">Nómina SV</p>
            <p className="text-[10px] text-slate-500 whitespace-nowrap">El Salvador</p>
          </div>
          <button onClick={onToggle} className="ml-auto lg:hidden text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2 dark-scrollbar">
          <nav className="space-y-0.5 px-2">
            {/* Dashboard link at top */}
            <button
              onClick={() => { onNavigate('dashboard'); if (window.innerWidth < 1024) onToggle(); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-all mb-2 ${
                currentView === 'dashboard'
                  ? 'bg-emerald-600/20 text-emerald-400 font-medium'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <LayoutDashboard className={`h-4 w-4 ${currentView === 'dashboard' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Dashboard</span>
              {currentView === 'dashboard' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </button>

            {NAV_GROUPS.map(group => {
              const visibleItems = getVisibleItems(group, user.rol);
              if (visibleItems.length === 0) return null;

              const isExpanded = expandedGroups.has(group.title);
              const GroupIcon = group.icon;

              return (
                <div key={group.title}>
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="flex items-center gap-2 w-full px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors rounded-md hover:bg-slate-800/30"
                  >
                    <GroupIcon className="h-3 w-3" />
                    <span className="truncate flex-1 text-left">{group.title}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>

                  <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-0.5 mt-0.5 mb-1.5">
                      {visibleItems.map(item => {
                        const isActive = currentView === item.id;
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onNavigate(item.id);
                              if (window.innerWidth < 1024) onToggle();
                            }}
                            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all relative group/item ${
                              isActive
                                ? 'bg-emerald-600/20 text-emerald-400 font-medium'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                            }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-r-full" />
                            )}
                            <ItemIcon className={`h-4 w-4 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-600 group-hover/item:text-slate-400'}`} />
                            <span>{item.label}</span>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User info at bottom */}
        <div className="border-t border-slate-700/50 p-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                {user.nombre[0]}{user.apellido[0]}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.nombre} {user.apellido}</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <p className="text-[10px] text-slate-400 truncate">{user.rol}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// TOP HEADER BAR
// ============================================================
interface HeaderBarProps {
  user: UserData;
  currentView: ViewId;
  accessToken: string | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onNavigate?: (viewId: ViewId) => void;
}

function HeaderBar({ user, currentView, accessToken, onToggleSidebar, onLogout, onNavigate }: HeaderBarProps) {
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    onLogout();
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700/50 shadow-sm dark:shadow-slate-900/50 flex items-center px-4 gap-3 shrink-0 z-30">
      {/* Mobile menu toggle */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden text-slate-600 hover:text-slate-900 p-1 rounded-md hover:bg-slate-100 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleSidebar}
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Alternar menú</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Breadcrumb / Current view name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            {VIEW_LABELS[currentView] || 'Dashboard'}
          </h2>
          {currentView !== 'dashboard' && (
            <Badge variant="secondary" className="text-[9px] shrink-0 bg-slate-100 text-slate-500">
              {currentView}
            </Badge>
          )}
        </div>
      </div>

      {/* Dark mode toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              aria-label="Cambiar tema"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Notification bell */}
      <NotificationBell accessToken={accessToken} onNavigate={onNavigate} />

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium">
                {user.nombre[0]}{user.apellido[0]}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-700 leading-tight">{user.nombre} {user.apellido}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{user.rol}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.nombre} {user.apellido}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => toast({ title: 'Perfil', description: 'Módulo de perfil en desarrollo' })}>
            <User className="mr-2 h-4 w-4" />
            Mi Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
            <Lock className="mr-2 h-4 w-4" />
            Cambiar Contraseña
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        accessToken={accessToken}
      />
    </header>
  );
}

// ============================================================
// DASHBOARD / WELCOME VIEW
// ============================================================
function WelcomeDashboard({ user, accessToken, onNavigate }: { user: UserData; accessToken: string | null; onNavigate: (view: ViewId) => void }) {
  const [dashboardData, setDashboardData] = useState<{
    total_empleados_activos: number;
    nomina_mes: number;
    cumplimiento_previsional: number;
    semaforo: string;
    cumplimientos: { nombre: string; presentado: boolean; peso: number }[];
    vencimientos: { nombre: string; fecha: string; dias: number }[];
  } | null>(null);
  const [totalPerfiles, setTotalPerfiles] = useState(0);
  const [auditEntries, setAuditEntries] = useState<Array<{
    id: string;
    accion: string;
    tabla_afectada: string | null;
    fecha_accion: string;
    nivel_criticidad: string;
    usuario_email: string | null;
    usuario: { nombre: string; apellido: string } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [dashRes, perfilesRes, auditRes] = await Promise.all([
          fetch('/api/nomina/dashboard', { headers }),
          fetch('/api/perfiles-puesto', { headers }),
          fetch('/api/admin/bitacora?page=1&page_size=5', { headers }),
        ]);
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setDashboardData(dashData.kpis);
        }
        if (perfilesRes.ok) {
          const perfData = await perfilesRes.json();
          setTotalPerfiles(perfData.data?.length || 0);
        }
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditEntries(auditData.entries || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [accessToken]);

  const kpis = [
    { label: 'Empleados Activos', value: dashboardData?.total_empleados_activos ?? 0, icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Perfiles de Puesto', value: totalPerfiles, icon: Briefcase, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Nómina del Mes', value: dashboardData?.nomina_mes ? `$${dashboardData.nomina_mes.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00', icon: Calculator, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Cumplimiento', value: dashboardData ? `${dashboardData.cumplimiento_previsional}%` : '0%', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const semaforoColor = dashboardData?.semaforo === 'verde' ? 'bg-emerald-500' : dashboardData?.semaforo === 'amarillo' ? 'bg-amber-500' : 'bg-red-500';

  const quickActions: Array<{ label: string; desc: string; icon: React.ElementType; color: string; bg: string; viewId: ViewId; roles: UserRole[] }> = [
    { label: 'Directorio Empleados', desc: 'Buscar y gestionar empleados', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50', viewId: '02-01', roles: ['ADMIN', 'ANALISTA', 'AUDITOR'] },
    { label: 'Dashboard Nómina', desc: 'Ver resumen de nómina', icon: LayoutDashboard, color: 'text-emerald-600', bg: 'bg-emerald-50', viewId: '04-01', roles: ['ADMIN', 'ANALISTA', 'GERENCIA', 'AUDITOR'] },
    { label: 'Calcular Nómina', desc: 'Iniciar cálculo del período', icon: Calculator, color: 'text-sky-600', bg: 'bg-sky-50', viewId: '04-03', roles: ['ADMIN', 'ANALISTA'] },
    { label: 'Aprobar Nómina', desc: 'Revisar y aprobar nóminas', icon: CheckCircle, color: 'text-violet-600', bg: 'bg-violet-50', viewId: '04-04', roles: ['ADMIN', 'APROBADOR'] },
    { label: 'Gestionar Usuarios', desc: 'Crear, editar y desactivar', icon: Users, color: 'text-rose-600', bg: 'bg-rose-50', viewId: '01-03', roles: ['ADMIN'] },
    { label: 'Reportes', desc: 'Planillas ISSS, AFP, ISR', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50', viewId: '05-01', roles: ['ADMIN', 'GERENCIA', 'AUDITOR'] },
    { label: 'Mi Portal', desc: 'Vacaciones, recibos, solicitudes', icon: Eye, color: 'text-emerald-600', bg: 'bg-emerald-50', viewId: '06-05', roles: ['EMPLEADO'] },
  ];

  const visibleActions = quickActions.filter(a => a.roles.includes(user.rol));

  const getAuditIcon = (accion: string) => {
    if (accion.includes('LOGIN')) return <Shield className="h-3.5 w-3.5" />;
    if (accion.includes('CREATE')) return <Plus className="h-3.5 w-3.5" />;
    if (accion.includes('UPDATE')) return <FileText className="h-3.5 w-3.5" />;
    if (accion.includes('DELETE')) return <AlertCircle className="h-3.5 w-3.5" />;
    return <ScrollText className="h-3.5 w-3.5" />;
  };

  const getAuditColor = (nivel: string) => {
    if (nivel === 'ALTA') return 'text-red-600 bg-red-50';
    if (nivel === 'MEDIA') return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="space-y-6 stagger-children">
      {/* Welcome banner - Animated gradient with decorative shapes */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden animate-fade-in">
        {/* Animated floating shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 animate-float" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/[0.03] rounded-lg rotate-12 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 left-1/3 w-8 h-8 bg-white/[0.04] rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
        {/* Shimmer overlay */}
        <div className="absolute inset-0 animate-shimmer opacity-30" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">
            Bienvenido, {user.nombre}
          </h1>
          <p className="text-emerald-100 mt-1">
            Sistema de Nómina y Perfiles de Puestos — República de El Salvador
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
              {user.rol}
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
            {new Date().toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Badge>
        </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                  <div className="h-8 bg-slate-200 rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          kpis.map(kpi => (
            <Card key={kpi.label} className="shadow-sm card-hover-lift">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{kpi.label}</p>
                    <p className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">{kpi.value}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl ${kpi.bg} dark:opacity-80 shrink-0`}>
                    <kpi.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Compliance Semaphore & Deadlines */}
      {dashboardData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-500" />
                Semáforo de Cumplimiento
                {/* Traffic light dots */}
                <div className="flex items-center gap-1 ml-auto p-1 bg-slate-900 rounded-full">
                  <div className={`w-2.5 h-2.5 rounded-full ${dashboardData.semaforo === 'rojo' ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-red-900/40'}`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${dashboardData.semaforo === 'amarillo' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-amber-900/40'}`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${dashboardData.semaforo === 'verde' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-emerald-900/40'}`} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {dashboardData.cumplimientos?.map((c: { nombre: string; presentado: boolean; peso: number }) => (
                <div key={c.nombre} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    {c.presentado ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <span className="text-sm text-slate-700 dark:text-slate-300">{c.nombre}</span>
                  </div>
                  <Badge className={`text-[10px] ${c.presentado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {c.presentado ? 'Presentado' : 'Pendiente'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Próximos Vencimientos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {dashboardData.vencimientos?.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-emerald-600">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">Todos los pagos al día</span>
                </div>
              ) : (
                dashboardData.vencimientos?.map((v: { nombre: string; fecha: string; dias: number }) => (
                  <div key={v.nombre} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    v.dias <= 5 ? 'border-red-200 bg-red-50/50' : 'border-slate-100 bg-slate-50/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${v.dias <= 5 ? 'bg-red-500' : v.dias <= 10 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span className="text-sm font-medium text-slate-700">{v.nombre}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{new Date(v.fecha).toLocaleDateString('es-SV')}</p>
                      <p className={`text-xs ${v.dias <= 5 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                        {v.dias > 0 ? `${v.dias} días` : 'Vencido'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick actions and recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-slate-500" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleActions.map(action => (
                <button
                  key={action.viewId + action.label}
                  onClick={() => onNavigate(action.viewId)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all cursor-pointer text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-600 group card-hover-lift"
                >
                  <div className={`p-2.5 rounded-lg ${action.bg} dark:opacity-80 group-hover:scale-110 transition-transform`}>
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{action.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-slate-500" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <ScrollText className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${getAuditColor(entry.nivel_criticidad)}`}>
                      {getAuditIcon(entry.accion)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {entry.accion.replace(/_/g, ' ')}
                        {entry.tabla_afectada && (
                          <span className="text-slate-400 dark:text-slate-500 font-normal"> · {entry.tabla_afectada}</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {entry.usuario?.nombre ? `${entry.usuario.nombre} ${entry.usuario.apellido}` : entry.usuario_email || 'Sistema'}
                        <span className="mx-1">·</span>
                        {new Date(entry.fecha_accion).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// PLACEHOLDER VIEW
// ============================================================
function PlaceholderView({ viewId }: { viewId: ViewId }) {
  const label = VIEW_LABELS[viewId] || 'Vista';
  return (
    <Card className="shadow-sm">
      <CardContent className="p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
          <LayoutDashboard className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{label}</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          Este módulo se encuentra en desarrollo. Pronto estará disponible con todas sus funcionalidades.
        </p>
        <Badge variant="secondary" className="mt-4">
          Vista {viewId}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MAIN APPLICATION LAYOUT
// ============================================================
interface AppLayoutProps {
  user: UserData;
  accessToken: string | null;
  onLogout: () => void;
}

function AppLayout({ user, accessToken, onLogout }: AppLayoutProps) {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const renderView = () => {
    if (currentView === 'dashboard') {
      return <WelcomeDashboard user={user} accessToken={accessToken} onNavigate={setCurrentView} />;
    }
    switch (currentView) {
      case '02-01':
        return <EmployeeDirectory accessToken={accessToken} userRole={user.rol} onNavigateToDetail={(id) => { setSelectedEmployeeId(id); setCurrentView('02-02'); }} onNavigateToNew={() => setCurrentView('02-03')} />;
      case '02-02':
        return selectedEmployeeId ? <EmployeeDetail empleadoId={selectedEmployeeId} onBack={() => setCurrentView('02-01')} userRole={user.rol} accessToken={accessToken} /> : <PlaceholderView viewId={currentView} />;
      case '02-03':
        return <NewEmployeeForm accessToken={accessToken} userRole={user.rol} onBack={() => setCurrentView('02-01')} onSuccess={() => setCurrentView('02-01')} />;
      case '02-04':
        return <IncidenceManager accessToken={accessToken} userRole={user.rol} />;
      case '01-03':
        return <UserManagement accessToken={accessToken} />;
      case '04-01':
        return <PayrollDashboard accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-02':
        return <PayrollPeriods accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-03':
        return <PayrollCalculation accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-04':
        return <PayrollApproval accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-05':
        return <BankDispersion accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-06':
        return <AguinaldoView accessToken={accessToken || ''} userRole={user.rol} />;
      case '04-07':
        return <LiquidationView accessToken={accessToken || ''} userRole={user.rol} />;
      case '03-01':
        return <ProfileCatalog accessToken={accessToken || ''} userRole={user.rol} />;
      case '03-02':
        return <ProfileDescriptiveForm accessToken={accessToken || ''} userRole={user.rol} />;
      case '03-03':
        return <SalaryBands accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-01':
        return <IsssReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-02':
        return <AfpReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-03':
        return <IsrReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '05-04':
        return <TalentReport accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-01':
        return <LegalParameters accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-02':
        return <OrgChart accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-03':
        return <Integrations accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-04':
        return <AuditLog accessToken={accessToken || ''} userRole={user.rol} />;
      case '06-05':
        return <SelfServicePortal accessToken={accessToken || ''} userRole={user.rol} />;
      default:
        return <PlaceholderView viewId={currentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar
        user={user}
        currentView={currentView}
        onNavigate={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <HeaderBar
          user={user}
          currentView={currentView}
          accessToken={accessToken}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLogout={onLogout}
          onNavigate={setCurrentView}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 dark:bg-slate-950" key={currentView}>
          <div className="animate-fade-in">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// AUTH PROVIDER
// ============================================================
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const data = await res.json();
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.accessToken;
    } catch {
      return null;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const init = async () => {
      const token = await refreshAccessToken();
      if (!token) {
        setUser(null);
        setAccessToken(null);
      }
      setIsLoading(false);
    };
    init();
  }, [refreshAccessToken]);

  // Auto refresh token before expiry
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(async () => {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        setUser(null);
        setAccessToken(null);
      }
    }, 55 * 60 * 1000); // Refresh every 55 minutes (token expires in 1h)
    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, refreshAccessToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function HomePage() {
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  return (
    <AuthProvider>
      <AuthGate
        loginError={loginError}
        setLoginError={setLoginError}
        isLoginLoading={isLoginLoading}
        setIsLoginLoading={setIsLoginLoading}
      />
    </AuthProvider>
  );
}

function AuthGate({
  loginError,
  setLoginError,
  isLoginLoading,
  setIsLoginLoading,
}: {
  loginError: string | null;
  setLoginError: React.Dispatch<React.SetStateAction<string | null>>;
  isLoginLoading: boolean;
  setIsLoginLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { user, accessToken, login, logout, isLoading } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    setLoginError(null);
    setIsLoginLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoginLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} isLoading={isLoginLoading} error={loginError} />;
  }

  return <AppLayout user={user} accessToken={accessToken} onLogout={logout} />;
}

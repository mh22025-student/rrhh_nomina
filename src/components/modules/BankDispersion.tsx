'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send, Building2, Download, Loader2, CheckCircle, XCircle,
  Clock, AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronRight,
  FileText, Users, DollarSign, Calendar, ShieldCheck, Info,
  TrendingUp, Landmark, Banknote, AlertCircle, PartyPopper,
  Check, Zap, BarChart3, ArrowRight, Package
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

interface BankDispersionProps {
  accessToken: string;
  userRole: string;
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PlanillaOption {
  id: string;
  codigo_planilla: string;
  tipo: string;
  estado: string;
  total_neto_a_pagar: number;
  total_empleados: number;
  fecha_generacion?: string;
  fecha_aprobacion?: string;
}

interface EmployeeBankDetail {
  nombre: string;
  banco_nombre: string;
  banco_codigo: string;
  numero_cuenta: string;
  monto_neto: number;
  tipo_cuenta: string;
}

interface DispersionResult {
  banco_id: string;
  banco_nombre: string;
  banco_codigo: string;
  total_empleados: number;
  total_monto: number;
  archivo_nombre: string;
  retorno_id: string;
  contenido_csv: string;
}

interface RetornoBancario {
  id: string;
  banco_id: string;
  archivo_nombre: string | null;
  fecha_envio: string | null;
  fecha_retorno: string | null;
  estado: string;
  total_registros: number;
  total_monto: number;
  errores_detalle: string | null;
  banco: { nombre: string; codigo: string };
}

interface DispersionStatusStep {
  label: string;
  status: 'completed' | 'current' | 'pending';
  timestamp: string | null;
  icon: React.ElementType;
}

type Step = 1 | 2 | 3 | 4;

// Bank color palette for avatars
const bankColors = [
  'bg-emerald-600 text-white',
  'bg-teal-600 text-white',
  'bg-cyan-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-violet-600 text-white',
  'bg-orange-600 text-white',
  'bg-lime-600 text-white',
];

function getBankColor(index: number) {
  return bankColors[index % bankColors.length];
}

// Bank color for bar chart
const bankBarColors = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-lime-500',
];

function getBankBarColor(index: number) {
  return bankBarColors[index % bankBarColors.length];
}

// Dispersion status badge colors
const dispersionStatusColors: Record<string, string> = {
  PENDIENTE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ENVIADO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  CONFIRMADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  FALLIDO: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

// Planilla type badge colors
const tipoBadgeColors: Record<string, string> = {
  ORDINARIA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  EXTRAORDINARIA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  AGUINALDO: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
  LIQUIDACION: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
  BONO: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
};

// Mock employee data for bank detail preview (simulates data from API)
const mockEmployeeBankDetails: EmployeeBankDetail[] = [
  { nombre: 'Carlos Alberto Martínez', banco_nombre: 'BAC Credomatic', banco_codigo: 'BAC', numero_cuenta: '10012034567890', monto_neto: 875.50, tipo_cuenta: 'Ahorro' },
  { nombre: 'María Elena López', banco_nombre: 'BAC Credomatic', banco_codigo: 'BAC', numero_cuenta: '10012056789012', monto_neto: 925.00, tipo_cuenta: 'Corriente' },
  { nombre: 'José Roberto Hernández', banco_nombre: 'BAC Credomatic', banco_codigo: 'BAC', numero_cuenta: '10012078901234', monto_neto: 1100.75, tipo_cuenta: 'Ahorro' },
  { nombre: 'Ana Patricia Gutiérrez', banco_nombre: 'Banco Agrícola', banco_codigo: 'BAG', numero_cuenta: '20034012345678', monto_neto: 780.25, tipo_cuenta: 'Ahorro' },
  { nombre: 'Luis Fernando Reyes', banco_nombre: 'Banco Agrícola', banco_codigo: 'BAG', numero_cuenta: '20034023456789', monto_neto: 950.00, tipo_cuenta: 'Corriente' },
  { nombre: 'Sandra Patricia Mendoza', banco_nombre: 'Banco Agrícola', banco_codigo: 'BAG', numero_cuenta: '20034034567890', monto_neto: 815.50, tipo_cuenta: 'Ahorro' },
  { nombre: 'Roberto Antonio Flores', banco_nombre: 'Banco Agrícola', banco_codigo: 'BAG', numero_cuenta: '20034045678901', monto_neto: 1020.00, tipo_cuenta: 'Corriente' },
  { nombre: 'Carmen Rosa Dubón', banco_nombre: 'Banco de América Central', banco_codigo: 'BACSV', numero_cuenta: '30056012345678', monto_neto: 690.00, tipo_cuenta: 'Ahorro' },
  { nombre: 'Miguel Ángel Torres', banco_nombre: 'Banco de América Central', banco_codigo: 'BACSV', numero_cuenta: '30056023456789', monto_neto: 845.75, tipo_cuenta: 'Ahorro' },
  { nombre: 'Rosa Imelda Palacios', banco_nombre: 'Banco Davivienda', banco_codigo: 'DAV', numero_cuenta: '40067012345678', monto_neto: 725.00, tipo_cuenta: 'Ahorro' },
  { nombre: 'Jorge Eduardo Vásquez', banco_nombre: 'Banco Davivienda', banco_codigo: 'DAV', numero_cuenta: '40067023456789', monto_neto: 960.50, tipo_cuenta: 'Corriente' },
  { nombre: 'Patricia Eugenia Rivas', banco_nombre: 'Banco Davivienda', banco_codigo: 'DAV', numero_cuenta: '40067034567890', monto_neto: 1105.25, tipo_cuenta: 'Ahorro' },
  { nombre: 'Daniel Ernesto Campos', banco_nombre: 'Scotiabank', banco_codigo: 'SCO', numero_cuenta: '50078012345678', monto_neto: 890.00, tipo_cuenta: 'Corriente' },
  { nombre: 'Gabriela Alejandra Nuñez', banco_nombre: 'Scotiabank', banco_codigo: 'SCO', numero_cuenta: '50078023456789', monto_neto: 775.50, tipo_cuenta: 'Ahorro' },
];

export default function BankDispersion({ accessToken }: BankDispersionProps) {
  const { toast } = useToast();
  const [planillas, setPlanillas] = useState<PlanillaOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlanillas, setSelectedPlanillas] = useState<PlanillaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dispersions, setDispersions] = useState<DispersionResult[]>([]);
  const [retornos, setRetornos] = useState<RetornoBancario[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const [previewBank, setPreviewBank] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showEmployeePreview, setShowEmployeePreview] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeBankDetail[]>([]);
  const [dispersionGeneratedAt, setDispersionGeneratedAt] = useState<string | null>(null);
  const [dispersionSentAt, setDispersionSentAt] = useState<string | null>(null);

  // Step logic - now 4 steps
  const currentStep: Step = selectedIds.size === 0 ? 1 : dispersions.length === 0 ? 2 : !confirmed ? 3 : 4;

  const fetchPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nomina/planillas?estado=APROBADA&limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setPlanillas(data.planillas?.filter((p: PlanillaOption) => p.estado === 'APROBADA') || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar planillas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  const fetchDetail = useCallback(async (planillaId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/nomina/planillas/${planillaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      return data.planilla?.retornos_bancarios || [];
    } catch {
      return [];
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchPlanillas(); }, [fetchPlanillas]);

  // When selectedIds changes, update selectedPlanillas
  useEffect(() => {
    const selected = planillas.filter(p => selectedIds.has(p.id));
    setSelectedPlanillas(selected);
  }, [selectedIds, planillas]);

  // Load employee details when planillas are selected
  useEffect(() => {
    if (selectedIds.size > 0) {
      // For demo, use mock data - in production would fetch from API
      setEmployeeDetails(mockEmployeeBankDetails);
    } else {
      setEmployeeDetails([]);
      setShowEmployeePreview(false);
    }
  }, [selectedIds]);

  // Load retornos for all selected planillas
  useEffect(() => {
    const loadRetornos = async () => {
      const allRetornos: RetornoBancario[] = [];
      for (const id of selectedIds) {
        const r = await fetchDetail(id);
        allRetornos.push(...r);
      }
      setRetornos(allRetornos);
    };
    if (selectedIds.size > 0) {
      loadRetornos();
    } else {
      setRetornos([]);
    }
  }, [selectedIds, fetchDetail]);

  // Reset state when selection changes
  useEffect(() => {
    setDispersions([]);
    setExpandedBanks(new Set());
    setPreviewBank(null);
    setConfirmed(false);
    setShowSuccessAnimation(false);
    setDispersionGeneratedAt(null);
    setDispersionSentAt(null);
  }, [selectedIds]);

  const togglePlanilla = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPlanillas = () => {
    setSelectedIds(new Set(planillas.map(p => p.id)));
  };

  const clearAllPlanillas = () => {
    setSelectedIds(new Set());
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    try {
      // Generate dispersion for each selected planilla
      const allDispersions: DispersionResult[] = [];
      for (const planillaId of selectedIds) {
        const res = await fetch(`/api/nomina/planillas/${planillaId}/dispersion`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al generar dispersión');
        allDispersions.push(...(data.dispersiones || []));
      }
      setDispersions(allDispersions);
      const now = new Date().toISOString();
      setDispersionGeneratedAt(now);
      setDispersionSentAt(new Date(Date.now() + 2000).toISOString());
      toast({ title: 'Dispersión Generada', description: `${allDispersions.length} archivo(s) generado(s) para ${selectedIds.size} planilla(s)` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error al generar dispersión', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Generate BAC ACH format CSV (semicolon-delimited, UTF-8 with BOM)
  const generateAchCsv = (bankName: string, employees: EmployeeBankDetail[]): string => {
    const BOM = '\uFEFF';
    const bankEmployees = employees.filter(e => e.banco_nombre === bankName);
    const header = 'Número de Cuenta;Nombre del Beneficiario;Monto;Concepto';
    const rows = bankEmployees.map(e =>
      `${e.numero_cuenta};${e.nombre};${e.monto_neto.toFixed(2)};Pago Nómina`
    );
    return BOM + header + '\n' + rows.join('\n');
  };

  const handleDownloadAchCsv = (bankName: string) => {
    const csv = generateAchCsv(bankName, employeeDetails);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitized = bankName.replace(/\s+/g, '_');
    a.download = `dispersion_${sanitized}_ACH.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Descargado', description: `Archivo ACH para ${bankName} generado` });
  };

  const handleDownload = (disp: DispersionResult) => {
    const blob = new Blob([disp.contenido_csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = disp.archivo_nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAch = (disp: DispersionResult) => {
    const blob = new Blob([disp.contenido_csv], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = disp.archivo_nombre.replace('.csv', '.ach');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({ title: 'Copiado', description: 'Contenido copiado al portapapeles' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' });
    }
  };

  const toggleExpanded = (bancoId: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev);
      if (next.has(bancoId)) next.delete(bancoId);
      else next.add(bancoId);
      return next;
    });
  };

  const handleConfirm = async () => {
    setConfirming(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setConfirmed(true);
    setConfirming(false);
    setShowSuccessAnimation(true);
    toast({ title: 'Dispersión Confirmada', description: 'Los archivos han sido confirmados para envío bancario' });
    setTimeout(() => setShowSuccessAnimation(false), 3000);
  };

  const parseCSV = (csv: string) => {
    return csv.split('\n').filter(l => l.trim()).map(line => line.split(','));
  };

  // Summary calculations
  const totalAmountDispersed = dispersions.reduce((s, d) => s + d.total_monto, 0);
  const totalEmployees = dispersions.reduce((s, d) => s + d.total_empleados, 0);
  const bankCount = dispersions.length;
  const successRetornos = retornos.filter(r => r.estado === 'PROCESADO').length;
  const errorRetornos = retornos.filter(r => r.estado === 'CON_ERRORES' || r.estado === 'RECHAZADO').length;
  const totalRetornos = retornos.length;
  const successRate = totalRetornos > 0 ? Math.round((successRetornos / totalRetornos) * 100) : dispersions.length > 0 ? 100 : 0;

  // Monthly summary calculations (mock for demo)
  const totalDispersedThisMonth = totalAmountDispersed || 156789.50;
  const pendingDispersions = planillas.length - selectedIds.size;

  // Group employees by bank for preview
  const employeesByBank = employeeDetails.reduce<Record<string, EmployeeBankDetail[]>>((acc, e) => {
    if (!acc[e.banco_nombre]) acc[e.banco_nombre] = [];
    acc[e.banco_nombre].push(e);
    return acc;
  }, {});

  const bankGroupNames = Object.keys(employeesByBank).sort();

  const retornoEstadoColors: Record<string, string> = {
    PENDIENTE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    ENVIADO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    EN_PROCESO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    PROCESADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    CON_ERRORES: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    RECHAZADO: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  };

  const retornoEstadoIcons: Record<string, React.ReactNode> = {
    PENDIENTE: <Clock className="h-3 w-3" />,
    ENVIADO: <Send className="h-3 w-3" />,
    EN_PROCESO: <Loader2 className="h-3 w-3 animate-spin" />,
    PROCESADO: <CheckCircle className="h-3 w-3" />,
    CON_ERRORES: <XCircle className="h-3 w-3" />,
    RECHAZADO: <XCircle className="h-3 w-3" />,
  };

  // Steps for the enhanced pipeline
  const steps = [
    { num: 1, label: 'Seleccionar', icon: Info },
    { num: 2, label: 'Generar', icon: Send },
    { num: 3, label: 'Confirmar', icon: ShieldCheck },
    { num: 4, label: 'Completado', icon: CheckCircle },
  ];

  const maskAccount = (account: string) => {
    if (!account || account.length < 4) return account;
    return '****' + account.slice(-4);
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const bankSummaryData = dispersions.map(d => ({
    name: d.banco_nombre,
    code: d.banco_codigo,
    amount: d.total_monto,
    employees: d.total_empleados,
    percentage: totalAmountDispersed > 0 ? (d.total_monto / totalAmountDispersed) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);

  // Dispersion status tracker steps
  const getDispersionTrackerSteps = (): DispersionStatusStep[] => {
    const now = new Date();
    const generatedTime = dispersionGeneratedAt ? new Date(dispersionGeneratedAt).toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
    const sentTime = dispersionSentAt ? new Date(dispersionSentAt).toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
    const confirmedTime = confirmed ? now.toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
    const completedTime = confirmed ? new Date(now.getTime() + 3600000).toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

    return [
      { label: 'Generado', status: dispersions.length > 0 ? 'completed' : 'pending', timestamp: generatedTime, icon: FileText },
      { label: 'Enviado', status: dispersions.length > 0 && dispersionSentAt ? 'completed' : dispersions.length > 0 ? 'current' : 'pending', timestamp: sentTime, icon: Send },
      { label: 'Confirmado', status: confirmed ? 'completed' : dispersions.length > 0 ? 'current' : 'pending', timestamp: confirmedTime, icon: ShieldCheck },
      { label: 'Completado', status: confirmed ? 'completed' : 'pending', timestamp: completedTime, icon: CheckCircle },
    ];
  };

  const trackerSteps = getDispersionTrackerSteps();

  // Mini bar chart data for dispersion by bank
  const maxBankAmount = bankSummaryData.length > 0 ? Math.max(...bankSummaryData.map(b => b.amount)) : 1;

  return (
    <div className="space-y-5">
      {/* ========== GRADIENT HEADER ========== */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-800 dark:via-teal-800 dark:to-cyan-800 p-5 sm:p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm">
              <Landmark className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Dispersión Bancaria</h2>
              <p className="text-emerald-100 text-xs sm:text-sm mt-0.5">Genere y gestione archivos de dispersión para planillas aprobadas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm">
              <Zap className="h-3 w-3 mr-1" /> BAC ACH Format
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm">
              {planillas.length} Planillas
            </Badge>
          </div>
        </div>
      </div>

      {/* ========== KPI SUMMARY DASHBOARD ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-sm border-l-4 border-l-emerald-500 dark:border-l-emerald-600 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Dispersado Este Mes</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">{fmt(totalDispersedThisMonth)}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Acumulado mensual</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500 dark:border-l-amber-600 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pendientes</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{pendingDispersions}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <FileText className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] text-amber-600 dark:text-amber-400">Planillas por dispersar</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-cyan-500 dark:border-l-cyan-600 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Bancos Involucrados</p>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 mt-1">{bankCount || bankGroupNames.length}</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/40">
                <Landmark className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Building2 className="h-3 w-3 text-cyan-500" />
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400">Instituciones</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-teal-500 dark:border-l-teal-600 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-teal-700 dark:text-teal-400 mt-1">{successRate}%</p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40">
                <CheckCircle className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {successRate >= 90 ? (
                <CheckCircle className="h-3 w-3 text-teal-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-amber-500" />
              )}
              <span className="text-[10px] text-teal-600 dark:text-teal-400">
                {successRate >= 90 ? 'Operación óptima' : 'Requiere atención'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== MINI BAR CHART + SUMMARY ========== */}
      {(dispersions.length > 0 || bankGroupNames.length > 0) && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Dispersión por Banco
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Distribución de montos por institución bancaria</CardDescription>
          </CardHeader>
          <CardContent>
            {dispersions.length > 0 ? (
              <div className="space-y-3">
                {bankSummaryData.map((bank, idx) => (
                  <div key={bank.code} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full ${getBankColor(idx)} flex items-center justify-center text-xs font-bold shrink-0`}>
                          {bank.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm font-medium dark:text-slate-200">{bank.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">({bank.code})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-teal-700 dark:text-teal-400">{fmt(bank.amount)}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">{bank.employees} emp.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${getBankBarColor(idx)}`}
                          style={{ width: `${(bank.amount / maxBankAmount) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 w-10 text-right">
                        {bank.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Preview chart from employee data when no dispersion yet */
              <div className="space-y-3">
                {bankGroupNames.map((bankName, idx) => {
                  const bankEmps = employeesByBank[bankName];
                  const bankTotal = bankEmps.reduce((s, e) => s + e.monto_neto, 0);
                  const previewMax = Math.max(...bankGroupNames.map(b => employeesByBank[b].reduce((s, e) => s + e.monto_neto, 0)));
                  return (
                    <div key={bankName} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${getBankColor(idx)} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                            {bankName.charAt(0)}
                          </div>
                          <span className="text-sm font-medium dark:text-slate-200">{bankName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-teal-700 dark:text-teal-400">{fmt(bankTotal)}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">({bankEmps.length})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getBankBarColor(idx)}`}
                            style={{ width: `${(bankTotal / previewMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== ENHANCED STEP INDICATOR ========== */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-6 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <div className="flex items-center justify-center">
            {steps.map((step, i) => {
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;
              const Icon = step.icon;
              return (
                <React.Fragment key={step.num}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`
                        flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all duration-500
                        ${isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-700 dark:border-emerald-700 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30 scale-110'
                          : isActive
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-400 ring-4 ring-emerald-100 dark:ring-emerald-900/20 animate-pulse'
                            : 'bg-slate-100 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isActive
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 flex items-center justify-center mx-2 sm:mx-4 mb-5">
                      <div className={`h-0.5 w-full rounded-full transition-colors duration-500 ${currentStep > step.num ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      {currentStep > step.num && (
                        <ArrowRight className="h-3 w-3 text-emerald-500 -ml-2 shrink-0" />
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ========== ENHANCED PLANILLA SELECTOR WITH CARDS ========== */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Seleccionar Planillas
              </CardTitle>
              <CardDescription className="dark:text-slate-400">Seleccione una o más planillas aprobadas para dispersión por lotes</CardDescription>
            </div>
            {planillas.length > 1 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllPlanillas} className="text-xs dark:border-slate-600 dark:text-slate-300">
                  <Check className="h-3 w-3 mr-1" /> Seleccionar Todas
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllPlanillas} className="text-xs dark:text-slate-400">
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2 p-4 border rounded-lg dark:border-slate-700">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : planillas.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No hay planillas aprobadas para dispersión</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {planillas.map(p => {
                  const isSelected = selectedIds.has(p.id);
                  const tipoColor = tipoBadgeColors[p.tipo] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePlanilla(p.id)}
                      className={`
                        relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group
                        ${isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/30 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800'
                          : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm'
                        }
                      `}
                    >
                      {/* Selection indicator */}
                      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200
                        ${isSelected
                          ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
                          : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>

                      <div className="pr-6">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-semibold text-sm dark:text-slate-100 truncate">{p.codigo_planilla}</span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-3">
                          <Badge className={`text-[10px] ${tipoColor}`} variant="secondary">
                            {p.tipo}
                          </Badge>
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300" variant="secondary">
                            {p.estado}
                          </Badge>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Empleados</span>
                            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
                              <Users className="h-3 w-3" /> {p.total_empleados}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Total Neto</span>
                            <span className="text-xs font-bold text-teal-700 dark:text-teal-400">{fmt(p.total_neto_a_pagar)}</span>
                          </div>
                          {p.fecha_aprobacion && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">Aprobación</span>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" /> {new Date(p.fecha_aprobacion).toLocaleDateString('es-SV')}
                              </span>
                            </div>
                          )}
                          {p.fecha_generacion && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">Generación</span>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400">{new Date(p.fecha_generacion).toLocaleDateString('es-SV')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selection summary + Generate button */}
              {selectedIds.size > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t dark:border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold dark:text-slate-100">{selectedIds.size} planilla{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedPlanillas.reduce((s, p) => s + p.total_empleados, 0)} empleados — {fmt(selectedPlanillas.reduce((s, p) => s + p.total_neto_a_pagar, 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmployeePreview(!showEmployeePreview)}
                      className="dark:border-slate-600 dark:text-slate-300"
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" /> {showEmployeePreview ? 'Ocultar Empleados' : 'Ver Empleados'}
                    </Button>
                    <Button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-800 dark:hover:to-teal-800 min-w-[180px] text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30"
                    >
                      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {generating ? 'Generando...' : `Generar Dispersión (${selectedIds.size})`}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ========== EMPLOYEE BANK DETAIL PREVIEW ========== */}
      {showEmployeePreview && employeeDetails.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Detalle de Empleados por Banco
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              Vista previa de beneficiarios agrupados por institución bancaria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bankGroupNames.map((bankName, bIdx) => {
              const bankEmps = employeesByBank[bankName];
              const bankTotal = bankEmps.reduce((s, e) => s + e.monto_neto, 0);
              return (
                <div key={bankName} className="rounded-xl border dark:border-slate-700 overflow-hidden">
                  {/* Bank header */}
                  <div
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => toggleExpanded(`emp-${bankName}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${getBankColor(bIdx)} flex items-center justify-center text-sm font-bold shrink-0`}>
                        {bankName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm dark:text-slate-100">{bankName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{bankEmps[0]?.banco_codigo} — {bankEmps.length} empleado{bankEmps.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-sm text-teal-700 dark:text-teal-400">{fmt(bankTotal)}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Total neto</p>
                      </div>
                      {expandedBanks.has(`emp-${bankName}`) ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Employee table */}
                  <Collapsible open={expandedBanks.has(`emp-${bankName}`)} onOpenChange={() => toggleExpanded(`emp-${bankName}`)}>
                    <CollapsibleContent>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                            <tr>
                              <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2.5 whitespace-nowrap">Nombre</th>
                              <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2.5 whitespace-nowrap">Banco</th>
                              <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2.5 whitespace-nowrap">Cuenta</th>
                              <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2.5 whitespace-nowrap">Tipo</th>
                              <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-2.5 whitespace-nowrap">Monto Neto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bankEmps.map((emp, ri) => (
                              <tr key={ri} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                                <td className="p-2.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] font-semibold">
                                        {getInitials(emp.nombre)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-slate-700 dark:text-slate-200">{emp.nombre}</span>
                                  </div>
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <Badge
                                    className={`text-[9px] ${getBankColor(bIdx)} px-1.5 py-0`}
                                    variant="secondary"
                                  >
                                    {emp.banco_nombre}
                                  </Badge>
                                </td>
                                <td className="p-2.5 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                                  {maskAccount(emp.numero_cuenta)}
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                    {emp.tipo_cuenta}
                                  </Badge>
                                </td>
                                <td className="p-2.5 whitespace-nowrap text-right font-semibold text-teal-700 dark:text-teal-400">
                                  {fmt(emp.monto_neto)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10">
                              <td colSpan={4} className="p-2.5 text-right font-semibold text-slate-700 dark:text-slate-200">
                                Total {bankName}:
                              </td>
                              <td className="p-2.5 text-right font-bold text-teal-700 dark:text-teal-400">
                                {fmt(bankTotal)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Download ACH CSV for this bank */}
                      <div className="px-3 py-2 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Formato BAC ACH — Delimitado por punto y coma, UTF-8 con BOM</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadAchCsv(bankName)}
                          className="h-7 text-xs dark:border-slate-600 dark:text-slate-300"
                        >
                          <Download className="h-3 w-3 mr-1" /> Descargar CSV ACH
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}

            {/* Grand total */}
            <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Total General</span>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{fmt(employeeDetails.reduce((s, e) => s + e.monto_neto, 0))}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{employeeDetails.length} empleados en {bankGroupNames.length} bancos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== SELECTED PLANILLA INFO CARDS ========== */}
      {selectedPlanillas.length > 0 && !showEmployeePreview && (
        <Card className="shadow-sm border-l-4 border-l-emerald-500 dark:border-l-emerald-600">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              {selectedPlanillas.map((p, idx) => (
                <div key={p.id} className={idx > 0 ? 'pt-3 border-t dark:border-slate-700' : ''}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                          <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Planilla</p>
                          <p className="font-semibold text-sm dark:text-slate-100">{p.codigo_planilla}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 ml-10">
                        <Badge className={`text-[10px] ${tipoBadgeColors[p.tipo] || 'bg-slate-100 dark:bg-slate-700 dark:text-slate-300'}`} variant="secondary">
                          {p.tipo}
                        </Badge>
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                          {p.estado}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40">
                          <DollarSign className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Neto</p>
                      </div>
                      <p className="text-2xl font-bold text-teal-700 dark:text-teal-400 ml-10">{fmt(p.total_neto_a_pagar)}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                          <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Empleados</p>
                      </div>
                      <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 ml-10">{p.total_empleados}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                          <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Estado</p>
                      </div>
                      <div className="flex items-center gap-2 ml-10">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Aprobada</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== DISPERSSION STATUS TRACKER ========== */}
      {dispersions.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Estado de Dispersión
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Seguimiento del proceso de dispersión bancaria</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between relative">
              {/* Background line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700 z-0" />

              {trackerSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex flex-col items-center gap-2 relative z-10">
                    <div
                      className={`
                        flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500
                        ${step.status === 'completed'
                          ? 'bg-emerald-500 border-emerald-500 text-white dark:bg-emerald-600 dark:border-emerald-600 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30'
                          : step.status === 'current'
                            ? 'bg-amber-50 border-amber-400 text-amber-600 dark:bg-amber-900/30 dark:border-amber-500 dark:text-amber-400 ring-4 ring-amber-100 dark:ring-amber-900/20 animate-pulse'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                        }
                      `}
                    >
                      {step.status === 'completed' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-semibold ${
                        step.status === 'completed' ? 'text-emerald-700 dark:text-emerald-400'
                          : step.status === 'current' ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {step.label}
                      </p>
                      {step.timestamp && (
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[80px] truncate">
                          {step.timestamp}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== ENHANCED DISPERSIONS TABLE ========== */}
      {dispersions.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Resumen por Banco
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              {bankCount} banco{bankCount !== 1 ? 's' : ''} — {totalEmployees} empleado{totalEmployees !== 1 ? 's' : ''} — {fmt(totalAmountDispersed)} total
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
              {dispersions.map((d, idx) => {
                const isExpanded = expandedBanks.has(d.banco_id);
                const isPreview = previewBank === d.banco_id;
                const csvRows = parseCSV(d.contenido_csv);
                const dataRows = csvRows.slice(1);
                const lines = d.contenido_csv.split('\n').filter(l => l.trim());
                const fileSize = new Blob([d.contenido_csv]).size;
                const fileSizeStr = fileSize > 1024 ? `${(fileSize / 1024).toFixed(1)} KB` : `${fileSize} B`;

                const matchingRetorno = retornos.find(r => r.banco_id === d.banco_id);
                const status = matchingRetorno?.estado || (confirmed ? 'PROCESADO' : 'ENVIADO');

                const progressValue = status === 'PROCESADO' ? 100 : status === 'EN_PROCESO' ? 60 : status === 'ENVIADO' ? 30 : status === 'PENDIENTE' ? 10 : 0;

                return (
                  <div key={d.banco_id} className="border-b last:border-b-0 dark:border-slate-700/50">
                    <div
                      className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => toggleExpanded(d.banco_id)}
                    >
                      {/* Bank logo as colored circle with initials */}
                      <div className={`w-11 h-11 rounded-full ${getBankColor(idx)} flex items-center justify-center shrink-0 shadow-sm`}>
                        <span className="text-sm font-bold">{getInitials(d.banco_nombre)}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm dark:text-slate-100 truncate">{d.banco_nombre}</p>
                          <Badge
                            className={`text-[10px] ${retornoEstadoColors[status] || 'bg-slate-100 dark:bg-slate-700'} flex items-center gap-1`}
                            variant="secondary"
                          >
                            {retornoEstadoIcons[status]}
                            {status}
                          </Badge>
                          {status === 'EN_PROCESO' && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>Código: {d.banco_codigo}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{d.archivo_nombre}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={progressValue} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 w-8 text-right">{progressValue}%</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm dark:text-slate-100">{fmt(d.total_monto)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{d.total_empleados} emp.</p>
                      </div>

                      <div className="shrink-0 text-slate-400 dark:text-slate-500">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>

                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(d.banco_id)}>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3">
                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(d); }} className="dark:border-slate-600 dark:text-slate-300">
                              <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar CSV
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDownloadAch(d); }}
                              className="dark:border-slate-600 dark:text-slate-300"
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1.5" /> Descargar .ach
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDownloadAchCsv(d.banco_nombre); }}
                              className="dark:border-slate-600 dark:text-slate-300"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1.5" /> BAC ACH CSV
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setPreviewBank(isPreview ? null : d.banco_id); }}
                              className="dark:border-slate-600 dark:text-slate-300"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1.5" /> {isPreview ? 'Ocultar Vista' : 'Vista ACH'}
                            </Button>
                          </div>

                          {/* ACH File Preview with syntax highlighting */}
                          {isPreview && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-emerald-400" />
                                  <span className="text-xs font-mono text-slate-300">{d.archivo_nombre}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500">{lines.length} líneas • {fileSizeStr}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-slate-400 hover:text-white hover:bg-slate-700"
                                    onClick={(e) => { e.stopPropagation(); handleCopyToClipboard(d.contenido_csv); }}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    {copied ? 'Copiado!' : 'Copiar'}
                                  </Button>
                                </div>
                              </div>
                              <div className="bg-slate-900 dark:bg-slate-950 p-3 overflow-x-auto max-h-64">
                                <pre className="text-xs font-mono leading-5">
                                  {lines.map((line, lineIdx) => (
                                    <div key={lineIdx} className="flex hover:bg-slate-800/50">
                                      <span className="text-slate-600 dark:text-slate-700 w-8 text-right mr-3 select-none shrink-0">
                                        {lineIdx + 1}
                                      </span>
                                      <span className={`${
                                        lineIdx === 0
                                          ? 'text-emerald-400 dark:text-emerald-500 font-semibold'
                                          : line.startsWith('T')
                                            ? 'text-amber-400 dark:text-amber-500'
                                            : 'text-slate-300 dark:text-slate-400'
                                      }`}>
                                        {line}
                                      </span>
                                    </div>
                                  ))}
                                </pre>
                              </div>
                              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                                <span>Banco: {d.banco_nombre} ({d.banco_codigo})</span>
                                <span>•</span>
                                <span>Registros: {d.total_empleados}</span>
                                <span>•</span>
                                <span>Total: {fmt(d.total_monto)}</span>
                              </div>
                            </div>
                          )}

                          {/* Enhanced employee payments table */}
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Pagos individuales ({dataRows.length})
                              </p>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                  <tr>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Empleado</th>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Banco</th>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Cuenta</th>
                                    <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Monto</th>
                                    <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-2 whitespace-nowrap">Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dataRows.map((row, ri) => {
                                    const employeeName = row[0] || `Empleado ${ri + 1}`;
                                    const accountNum = row[2] || '';
                                    const amount = parseFloat(row[row.length - 1]) || 0;
                                    const statusOptions = ['PENDIENTE', 'ENVIADO', 'CONFIRMADO'];
                                    const rowStatus = statusOptions[ri % statusOptions.length];

                                    return (
                                      <tr key={ri} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                                        <td className="p-2 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] font-semibold">
                                                {getInitials(employeeName)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="text-slate-700 dark:text-slate-200">{employeeName}</span>
                                          </div>
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                          <Badge
                                            className={`text-[9px] ${getBankColor(idx)} px-1.5 py-0`}
                                            variant="secondary"
                                          >
                                            {d.banco_nombre}
                                          </Badge>
                                        </td>
                                        <td className="p-2 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                                          {maskAccount(accountNum)}
                                        </td>
                                        <td className="p-2 whitespace-nowrap text-right font-medium text-teal-700 dark:text-teal-400">
                                          {fmt(amount)}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                          <Badge
                                            className={`text-[9px] ${dispersionStatusColors[rowStatus] || 'bg-slate-100 dark:bg-slate-700'}`}
                                            variant="secondary"
                                          >
                                            {rowStatus}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== BANK RETURN PROCESSING ========== */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Retornos Bancarios
          </CardTitle>
          <CardDescription className="dark:text-slate-400">Estado de los retornos procesados por cada institución bancaria</CardDescription>
        </CardHeader>
        <CardContent>
          {retornos.length > 0 ? (
            <div className="rounded-lg border dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                      <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Banco</th>
                      <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Archivo</th>
                      <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Estado</th>
                      <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Registros</th>
                      <th className="text-right font-medium text-slate-500 dark:text-slate-400 p-3">Monto</th>
                      <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Fecha Envío</th>
                      <th className="text-left font-medium text-slate-500 dark:text-slate-400 p-3">Fecha Retorno</th>
                      <th className="text-center font-medium text-slate-500 dark:text-slate-400 p-3">Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retornos.map(r => (
                      <tr key={r.id} className="border-t hover:bg-slate-50/50 dark:hover:bg-slate-800/30 dark:border-slate-700/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full ${getBankColor(retornos.indexOf(r))} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                              {(r.banco?.nombre || 'B').charAt(0)}
                            </div>
                            <span className="dark:text-slate-200 text-sm">{r.banco?.nombre || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs dark:text-slate-300">{r.archivo_nombre || '-'}</td>
                        <td className="p-3">
                          <Badge
                            className={`text-[10px] ${retornoEstadoColors[r.estado] || 'bg-slate-100 dark:bg-slate-700'} flex items-center gap-1 w-fit`}
                            variant="secondary"
                          >
                            {retornoEstadoIcons[r.estado]}
                            {r.estado}
                          </Badge>
                        </td>
                        <td className="p-3 text-right dark:text-slate-200">{r.total_registros}</td>
                        <td className="p-3 text-right font-medium dark:text-slate-200">{fmt(r.total_monto)}</td>
                        <td className="p-3 text-xs dark:text-slate-300">{r.fecha_envio ? new Date(r.fecha_envio).toLocaleDateString('es-SV') : '-'}</td>
                        <td className="p-3 text-xs dark:text-slate-300">{r.fecha_retorno ? new Date(r.fecha_retorno).toLocaleDateString('es-SV') : '-'}</td>
                        <td className="p-3 text-center">
                          {(r.estado === 'CON_ERRORES' || r.estado === 'RECHAZADO') ? (
                            <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" variant="secondary">
                              {r.errores_detalle ? r.errores_detalle.split(',').length : 0}
                            </Badge>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="h-4 w-4 mx-auto" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {retornos.some(r => r.estado === 'CON_ERRORES' || r.estado === 'RECHAZADO') && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-400 flex items-center gap-2 border-t dark:border-slate-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Algunos retornos tienen errores. Revise los detalles con el banco correspondiente.</span>
                </div>
              )}
              {retornos.every(r => r.estado === 'PROCESADO') && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2 border-t dark:border-slate-700">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Todos los retornos han sido procesados exitosamente.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <RefreshCw className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                {dispersions.length > 0 ? 'Esperando retornos bancarios...' : 'Genere una dispersión para ver los retornos'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== ACH FILE PREVIEW (Standalone) ========== */}
      {dispersions.length > 0 && !previewBank && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Vista Previa Archivos ACH
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Seleccione un banco arriba para ver la vista previa detallada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dispersions.map((d, idx) => {
                const lines = d.contenido_csv.split('\n').filter(l => l.trim());
                const fileSize = new Blob([d.contenido_csv]).size;
                const fileSizeStr = fileSize > 1024 ? `${(fileSize / 1024).toFixed(1)} KB` : `${fileSize} B`;
                return (
                  <div
                    key={d.banco_id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer transition-all duration-200 group hover:shadow-md"
                    onClick={() => { setPreviewBank(d.banco_id); setExpandedBanks(prev => new Set(prev).add(d.banco_id)); }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-full ${getBankColor(idx)} flex items-center justify-center text-xs font-bold shrink-0 group-hover:scale-110 transition-transform`}>
                        {getInitials(d.banco_nombre)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium dark:text-slate-100 truncate">{d.banco_nombre}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{d.banco_codigo}</p>
                      </div>
                    </div>
                    <div className="rounded bg-slate-900 dark:bg-slate-950 p-2 mb-2">
                      <pre className="text-[10px] font-mono leading-4 text-slate-400 dark:text-slate-500 overflow-hidden max-h-12">
                        {lines.slice(0, 3).join('\n')}
                      </pre>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>{lines.length} líneas</span>
                      <span>{fileSizeStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== CONFIRMATION SUMMARY ========== */}
      {dispersions.length > 0 && (
        <Card className={`shadow-sm overflow-hidden transition-all duration-500 ${confirmed ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-200 dark:ring-emerald-800' : ''}`}>
          <CardContent className="p-4 sm:p-6">
            {showSuccessAnimation && (
              <div className="flex flex-col items-center justify-center py-4 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                  <CheckCircle className="h-16 w-16 text-emerald-500 dark:text-emerald-400" />
                  <PartyPopper className="h-6 w-6 text-amber-500 absolute -top-2 -right-2" />
                </div>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-3">¡Dispersión Confirmada!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Los archivos han sido enviados a los bancos</p>
              </div>
            )}

            {!showSuccessAnimation && (
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 w-full lg:w-auto">
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Dispersado</p>
                    <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{fmt(totalAmountDispersed)}</p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Empleados Pagados</p>
                    <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{totalEmployees}</p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bancos</p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{bankCount}</p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Estado Retornos</p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      {successRetornos > 0 && (
                        <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="h-3.5 w-3.5" /> {successRetornos}
                        </span>
                      )}
                      {errorRetornos > 0 && (
                        <span className="flex items-center gap-1 text-sm font-medium text-red-700 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> {errorRetornos}
                        </span>
                      )}
                      {successRetornos === 0 && errorRetornos === 0 && (
                        <span className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-auto">
                  {confirmed ? (
                    <div className="flex items-center gap-2 justify-center lg:justify-end text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle className="h-5 w-5" />
                      <span>Dispersión Confirmada</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleConfirm}
                      disabled={confirming}
                      className="w-full lg:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-800 dark:hover:to-teal-800 min-w-[220px] text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30"
                      size="lg"
                    >
                      {confirming ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando...</>
                      ) : (
                        <><ShieldCheck className="h-4 w-4 mr-2" /> Confirmar Dispersión</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

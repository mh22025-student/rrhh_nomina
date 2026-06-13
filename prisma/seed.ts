import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================================
  // 0. CLEANUP: Remove duplicate data from previous seed runs
  // ============================================================
  console.log('\n🧹 Cleaning up duplicate data...');

  // Clean up old banks with different codes
  const oldBankCodes = ['BAGR', 'BDAV', 'BPRO', 'BATL', 'ABNK', 'SCOT', 'BCUS'];
  for (const code of oldBankCodes) {
    const oldBank = await db.banco.findUnique({ where: { codigo: code } });
    if (oldBank) {
      // Check if any retornos_bancarios reference this bank
      const refCount = await db.retornoBancario.count({ where: { banco_id: oldBank.id } });
      if (refCount === 0) {
        await db.banco.delete({ where: { id: oldBank.id } });
        console.log(`  🗑️  Deleted old bank: ${code}`);
      }
    }
  }

  // Clean up old areas with different codes and migrate references
  const areaCodeMigration: Record<string, string> = {
    'GER-GEN': 'GG',
    'OPE': 'OPS',
    'CONT': 'CON',
    'VTA': 'VEN',
  };

  for (const [oldCode, newCode] of Object.entries(areaCodeMigration)) {
    const oldArea = await db.area.findUnique({ where: { codigo: oldCode } });
    const newArea = await db.area.findUnique({ where: { codigo: newCode } });

    if (oldArea && newArea) {
      // Migrate employees from old area to new area
      await db.empleado.updateMany({ where: { area_id: oldArea.id }, data: { area_id: newArea.id } });
      // Migrate perfiles from old area to new area
      await db.perfilPuesto.updateMany({ where: { area_id: oldArea.id }, data: { area_id: newArea.id } });
      // Migrate child areas
      await db.area.updateMany({ where: { area_padre_id: oldArea.id }, data: { area_padre_id: newArea.id } });
      // Delete old area (only if no more references)
      const remainingEmployees = await db.empleado.count({ where: { area_id: oldArea.id } });
      const remainingPerfiles = await db.perfilPuesto.count({ where: { area_id: oldArea.id } });
      const remainingChildren = await db.area.count({ where: { area_padre_id: oldArea.id } });
      if (remainingEmployees === 0 && remainingPerfiles === 0 && remainingChildren === 0) {
        await db.area.delete({ where: { id: oldArea.id } });
        console.log(`  🗑️  Migrated & deleted old area: ${oldCode} → ${newCode}`);
      } else {
        console.log(`  ⚠️  Cannot delete area ${oldCode}, still has references`);
      }
    } else if (oldArea && !newArea) {
      // Rename old area to new code
      await db.area.update({ where: { id: oldArea.id }, data: { codigo: newCode } });
      console.log(`  🔄 Renamed area: ${oldCode} → ${newCode}`);
    }
  }

  // Clean up old integrations that are duplicates
  // Delete integrations that are NOT in our target list
  const targetIntegrationNames = [
    'BAC Credomatic - Dispersión ACH',
    'ISSS - Planilla OIS',
    'AFP CRECER - Archivo SEPP',
    'AFP CONFIA - Archivo SEPP',
    'Servidor de Correo',
  ];
  const allIntegrations = await db.integracionExterna.findMany();
  for (const integ of allIntegrations) {
    if (!targetIntegrationNames.includes(integ.nombre)) {
      // Delete logs first, then the integration
      await db.logIntegracion.deleteMany({ where: { integracion_id: integ.id } });
      await db.integracionExterna.delete({ where: { id: integ.id } });
      console.log(`  🗑️  Deleted old integration: ${integ.nombre}`);
    }
  }

  // Clean up duplicate permissions (keep only one set per user per modulo/vista/permiso)
  // Also remove permissions for stale users that are not in our target user list
  const targetUserEmails = [
    'admin@nomina.gob.sv',
    'analista@nomina.gob.sv',
    'aprobador@nomina.gob.sv',
    'gerencia@nomina.gob.sv',
    'auditor@nomina.gob.sv',
    'empleado@nomina.gob.sv',
  ];
  const targetUsers = await db.usuario.findMany({ where: { email: { in: targetUserEmails } } });
  const targetUserIds = new Set(targetUsers.map(u => u.id));

  // Delete permissions for non-target users
  const stalePerms = await db.permisoGranularUsuario.findMany({
    where: { usuario_id: { notIn: Array.from(targetUserIds) } },
  });
  for (const perm of stalePerms) {
    await db.permisoGranularUsuario.delete({ where: { id: perm.id } });
  }
  if (stalePerms.length > 0) {
    console.log(`  🗑️  Deleted ${stalePerms.length} permissions for stale users`);
  }

  // Deduplicate permissions for target users
  const allPermRecords = await db.permisoGranularUsuario.findMany({
    orderBy: { fecha_creacion: 'asc' },
  });
  const seenKeys = new Set<string>();
  for (const perm of allPermRecords) {
    const key = `${perm.usuario_id}|${perm.modulo}|${perm.vista}|${perm.permiso}`;
    if (seenKeys.has(key)) {
      await db.permisoGranularUsuario.delete({ where: { id: perm.id } });
    } else {
      seenKeys.add(key);
    }
  }

  // Delete stale users that are not in our target list
  const staleUsers = await db.usuario.findMany({
    where: { email: { notIn: targetUserEmails } },
  });
  for (const staleUser of staleUsers) {
    // Delete related records first (order matters for FK constraints)
    await db.permisoGranularUsuario.deleteMany({ where: { usuario_id: staleUser.id } });
    await db.refreshToken.deleteMany({ where: { usuario_id: staleUser.id } });
    await db.otpToken.deleteMany({ where: { usuario_id: staleUser.id } });
    await db.historialContrasena.deleteMany({ where: { usuario_id: staleUser.id } });
    // Nullify FK references from other tables
    await db.parametroLegal.updateMany({ where: { creado_por_id: staleUser.id }, data: { creado_por_id: null } });
    await db.perfilPuesto.updateMany({ where: { creado_por_id: staleUser.id }, data: { creado_por_id: null } });
    await db.incidenciaNomina.updateMany({ where: { aprobada_por_id: staleUser.id }, data: { aprobada_por_id: null } });
    await db.liquidacion.updateMany({ where: { aprobada_por_id: staleUser.id }, data: { aprobada_por_id: null } });
    await db.historialCambioSalarial.updateMany({ where: { autorizado_por_id: staleUser.id }, data: { autorizado_por_id: null } });
    await db.historialCambioCargo.updateMany({ where: { autorizado_por_id: staleUser.id }, data: { autorizado_por_id: null } });
    await db.documentoEmpleado.updateMany({ where: { subido_por_id: staleUser.id }, data: { subido_por_id: null } });
    await db.solicitudSelfService.updateMany({ where: { aprobada_por_id: staleUser.id }, data: { aprobada_por_id: null } });
    await db.checklistAprobacionPlanilla.updateMany({ where: { completado_por_id: staleUser.id }, data: { completado_por_id: null } });
    await db.bitacoraAuditoria.updateMany({ where: { usuario_id: staleUser.id }, data: { usuario_id: null } });
    await db.planilla.updateMany({ where: { calculada_por_id: staleUser.id }, data: { calculada_por_id: null } });
    await db.planilla.updateMany({ where: { aprobada_por_id: staleUser.id }, data: { aprobada_por_id: null } });
    await db.usuario.updateMany({ where: { empleado_id: null }, data: {} }); // no-op, just in case
    try {
      await db.usuario.delete({ where: { id: staleUser.id } });
      console.log(`  🗑️  Deleted stale user: ${staleUser.email}`);
    } catch {
      console.log(`  ⚠️  Could not delete stale user: ${staleUser.email} (has remaining references)`);
    }
  }

  // ============================================================
  // 1. DEMO USERS
  // ============================================================
  console.log('\n📋 Creating demo users...');
  const users = [
    {
      email: 'admin@nomina.gob.sv',
      nombre: 'Carlos',
      apellido: 'Hernández',
      rol: 'ADMIN',
      password: 'Admin2026!',
    },
    {
      email: 'analista@nomina.gob.sv',
      nombre: 'María',
      apellido: 'López',
      rol: 'ANALISTA',
      password: 'Analista2026!',
    },
    {
      email: 'aprobador@nomina.gob.sv',
      nombre: 'Roberto',
      apellido: 'García',
      rol: 'APROBADOR',
      password: 'Aprobador2026!',
    },
    {
      email: 'gerencia@nomina.gob.sv',
      nombre: 'Ana',
      apellido: 'Martínez',
      rol: 'GERENCIA',
      password: 'Gerencia2026!',
    },
    {
      email: 'auditor@nomina.gob.sv',
      nombre: 'Jorge',
      apellido: 'Rivera',
      rol: 'AUDITOR',
      password: 'Auditor2026!',
    },
    {
      email: 'empleado@nomina.gob.sv',
      nombre: 'Laura',
      apellido: 'Peña',
      rol: 'EMPLEADO',
      password: 'Empleado2026!',
    },
  ];

  const userMap: Record<string, string> = {};
  for (const u of users) {
    const existing = await db.usuario.findUnique({ where: { email: u.email } });
    if (!existing) {
      const passwordHash = await hashPassword(u.password);
      const created = await db.usuario.create({
        data: {
          email: u.email,
          password_hash: passwordHash,
          nombre: u.nombre,
          apellido: u.apellido,
          rol: u.rol,
          estado: 'ACTIVO',
          debe_cambiar_password: false,
        },
      });
      userMap[u.rol] = created.id;
      console.log(`  ✅ Created user: ${u.email} (${u.rol})`);
    } else {
      userMap[u.rol] = existing.id;
      console.log(`  ⏭️  User already exists: ${u.email}`);
    }
  }

  // ============================================================
  // 2. BANKS
  // ============================================================
  console.log('\n🏦 Creating banks...');
  const banks = [
    { codigo: 'BAC', nombre: 'BAC Credomatic', codigo_ach: 'BAC', formato_cuenta: '17 dígitos', activo: true },
    { codigo: 'AGR', nombre: 'Banco Agrícola', codigo_ach: 'BAG', formato_cuenta: '14 dígitos', activo: true },
    { codigo: 'CUS', nombre: 'Banco Cuscatlán', codigo_ach: 'BCU', formato_cuenta: '14 dígitos', activo: true },
    { codigo: 'DAV', nombre: 'Banco Davivienda', codigo_ach: 'BDA', formato_cuenta: '14 dígitos', activo: true },
    { codigo: 'PRO', nombre: 'Banco Promérica', codigo_ach: 'BPR', formato_cuenta: '15 dígitos', activo: true },
    { codigo: 'SCO', nombre: 'Scotiabank', codigo_ach: 'SCO', formato_cuenta: '14 dígitos', activo: true },
    { codigo: 'ATL', nombre: 'Banco Atlántida', codigo_ach: 'BAT', formato_cuenta: '14 dígitos', activo: true },
    { codigo: 'ABA', nombre: 'Banco ABANK', codigo_ach: 'ABA', formato_cuenta: '14 dígitos', activo: true },
  ];

  for (const bank of banks) {
    const existing = await db.banco.findUnique({ where: { codigo: bank.codigo } });
    if (!existing) {
      await db.banco.create({ data: bank });
      console.log(`  ✅ Created bank: ${bank.nombre}`);
    } else {
      console.log(`  ⏭️  Bank already exists: ${bank.nombre}`);
    }
  }

  // ============================================================
  // 3. AREAS (with hierarchy)
  // ============================================================
  console.log('\n🏢 Creating areas...');
  const areaMap: Record<string, string> = {};

  // Parent area: Gerencia General
  let ggArea = await db.area.findUnique({ where: { codigo: 'GG' } });
  if (!ggArea) {
    ggArea = await db.area.create({
      data: {
        nombre: 'Gerencia General',
        codigo: 'GG',
        descripcion: 'Gerencia General de la empresa',
        nivel: 1,
        activo: true,
      },
    });
    console.log('  ✅ Created area: Gerencia General');
  } else {
    console.log('  ⏭️  Area already exists: Gerencia General');
  }
  areaMap['GG'] = ggArea.id;

  // Level 2 areas (children of GG)
  const level2Areas = [
    { nombre: 'Recursos Humanos', codigo: 'RRHH', descripcion: 'Departamento de Recursos Humanos', nivel: 2 },
    { nombre: 'Finanzas', codigo: 'FIN', descripcion: 'Departamento de Finanzas', nivel: 2 },
    { nombre: 'Operaciones', codigo: 'OPS', descripcion: 'Departamento de Operaciones', nivel: 2 },
    { nombre: 'Tecnología', codigo: 'TEC', descripcion: 'Departamento de Tecnología', nivel: 2 },
  ];

  for (const area of level2Areas) {
    let existing = await db.area.findUnique({ where: { codigo: area.codigo } });
    if (!existing) {
      existing = await db.area.create({
        data: {
          nombre: area.nombre,
          codigo: area.codigo,
          descripcion: area.descripcion,
          nivel: area.nivel,
          area_padre_id: ggArea.id,
          activo: true,
        },
      });
      console.log(`  ✅ Created area: ${area.nombre}`);
    } else {
      // Ensure area_padre_id is set correctly
      if (!existing.area_padre_id) {
        await db.area.update({ where: { id: existing.id }, data: { area_padre_id: ggArea.id } });
      }
      console.log(`  ⏭️  Area already exists: ${area.nombre}`);
    }
    areaMap[area.codigo] = existing.id;
  }

  // Level 3 areas (children of their respective parents)
  const level3Areas = [
    { nombre: 'Contabilidad', codigo: 'CON', descripcion: 'Sección de Contabilidad', nivel: 3, parentCodigo: 'FIN' },
    { nombre: 'Ventas', codigo: 'VEN', descripcion: 'Sección de Ventas', nivel: 3, parentCodigo: 'OPS' },
  ];

  for (const area of level3Areas) {
    let existing = await db.area.findUnique({ where: { codigo: area.codigo } });
    if (!existing) {
      existing = await db.area.create({
        data: {
          nombre: area.nombre,
          codigo: area.codigo,
          descripcion: area.descripcion,
          nivel: area.nivel,
          area_padre_id: areaMap[area.parentCodigo],
          activo: true,
        },
      });
      console.log(`  ✅ Created area: ${area.nombre}`);
    } else {
      // Ensure area_padre_id is set correctly
      if (!existing.area_padre_id || existing.area_padre_id !== areaMap[area.parentCodigo]) {
        await db.area.update({ where: { id: existing.id }, data: { area_padre_id: areaMap[area.parentCodigo] } });
      }
      console.log(`  ⏭️  Area already exists: ${area.nombre}`);
    }
    areaMap[area.codigo] = existing.id;
  }

  // ============================================================
  // 4. SALARY BANDS
  // ============================================================
  console.log('\n💰 Creating salary bands...');
  const existingBandCount = await db.bandaSalarial.count();
  const bandMap: Record<number, string> = {};

  const desiredBands = [
    { nombre: 'Banda 1 - Operativo', grado: 1, salario_minimo: 365.00, salario_medio: 480.00, salario_maximo: 600.00 },
    { nombre: 'Banda 2 - Técnico', grado: 2, salario_minimo: 500.00, salario_medio: 650.00, salario_maximo: 850.00 },
    { nombre: 'Banda 3 - Administrativo', grado: 3, salario_minimo: 700.00, salario_medio: 950.00, salario_maximo: 1200.00 },
    { nombre: 'Banda 4 - Profesional', grado: 4, salario_minimo: 1000.00, salario_medio: 1400.00, salario_maximo: 1800.00 },
    { nombre: 'Banda 5 - Supervisor', grado: 5, salario_minimo: 1500.00, salario_medio: 2000.00, salario_maximo: 2500.00 },
    { nombre: 'Banda 6 - Gerencia Media', grado: 6, salario_minimo: 2200.00, salario_medio: 3100.00, salario_maximo: 4000.00 },
    { nombre: 'Banda 7 - Alta Gerencia', grado: 7, salario_minimo: 3500.00, salario_medio: 5000.00, salario_maximo: 7000.00 },
  ];

  if (existingBandCount === 0) {
    for (const band of desiredBands) {
      const created = await db.bandaSalarial.create({ data: band });
      bandMap[band.grado] = created.id;
      console.log(`  ✅ Created band: ${band.nombre}`);
    }
  } else {
    // Load existing bands into map
    const existingBands = await db.bandaSalarial.findMany({ orderBy: { grado: 'asc' } });
    for (const band of existingBands) {
      bandMap[band.grado] = band.id;
    }

    // If we have wrong number of bands, delete old ones and create correct ones
    if (existingBandCount !== 7) {
      // Delete bands that have no profile references
      for (const band of existingBands) {
        const perfilCount = await db.perfilPuesto.count({ where: { banda_salarial_id: band.id } });
        if (perfilCount === 0) {
          await db.bandaSalarial.delete({ where: { id: band.id } });
          console.log(`  🗑️  Deleted old band: ${band.nombre}`);
        }
      }
      // Create missing bands
      const remainingBands = await db.bandaSalarial.findMany({ orderBy: { grado: 'asc' } });
      const remainingGrados = new Set(remainingBands.map(b => b.grado));
      bandMap.clear();
      for (const band of remainingBands) {
        bandMap[band.grado] = band.id;
      }
      for (const band of desiredBands) {
        if (!remainingGrados.has(band.grado)) {
          const created = await db.bandaSalarial.create({ data: band });
          bandMap[band.grado] = created.id;
          console.log(`  ✅ Created missing band: ${band.nombre}`);
        }
      }
    } else {
      console.log(`  ⏭️  Salary bands already exist (${existingBandCount} bands)`);
    }
  }

  // ============================================================
  // 5. LEGAL PARAMETERS (with ISR Tramos + Salarios Mínimos)
  // ============================================================
  console.log('\n⚖️ Creating legal parameters...');
  const existingParams = await db.parametroLegal.findFirst({ where: { estado: 'ACTIVO' } });

  if (!existingParams) {
    const param = await db.parametroLegal.create({
      data: {
        descripcion_cambio: 'Parámetros legales iniciales 2026 - ISR y Salarios Mínimos',
        decreto_norma_origen: 'Decreto Legislativo 2026 - Código Tributario y Ley de Salario Mínimo',
        tasa_isss_laboral: 0.03,
        tasa_isss_patronal: 0.075,
        tope_cotizacion_isss: 1000.00,
        tasa_afp_laboral: 0.0725,
        tasa_afp_patronal: 0.0875,
        tasa_insaforp: 0.01,
        empleados_minimos_insaforp: 10,
        fecha_vigencia_desde: new Date('2026-01-01'),
        estado: 'ACTIVO',
        creado_por_id: userMap['ADMIN'],
        tramos_isr: {
          create: [
            { numero_tramo: 1, desde: 0.01, hasta: 472.00, porcentaje: 0.00, cuota_fija: 0.00 },
            { numero_tramo: 2, desde: 472.01, hasta: 895.24, porcentaje: 0.10, cuota_fija: 17.67 },
            { numero_tramo: 3, desde: 895.25, hasta: 2038.10, porcentaje: 0.20, cuota_fija: 107.39 },
            { numero_tramo: 4, desde: 2038.11, hasta: null, porcentaje: 0.30, cuota_fija: 310.76 },
          ],
        },
        salarios_minimos: {
          create: [
            { sector: 'COMERCIO', salario_mensual: 365.00 },
            { sector: 'INDUSTRIA', salario_mensual: 365.00 },
            { sector: 'SERVICIOS', salario_mensual: 365.00 },
            { sector: 'AGROPECUARIO', salario_mensual: 246.87 },
            { sector: 'MAQUILA', salario_mensual: 352.72 },
            { sector: 'TRANSPORTE', salario_mensual: 365.00 },
          ],
        },
      },
    });
    console.log('  ✅ Created legal parameters with ISR tramos and salarios mínimos');
  } else {
    // Check if tramos exist for this parameter
    const existingTramos = await db.tramoISR.count({ where: { parametro_legal_id: existingParams.id } });
    if (existingTramos === 0) {
      await db.tramoISR.createMany({
        data: [
          { parametro_legal_id: existingParams.id, numero_tramo: 1, desde: 0.01, hasta: 472.00, porcentaje: 0.00, cuota_fija: 0.00 },
          { parametro_legal_id: existingParams.id, numero_tramo: 2, desde: 472.01, hasta: 895.24, porcentaje: 0.10, cuota_fija: 17.67 },
          { parametro_legal_id: existingParams.id, numero_tramo: 3, desde: 895.25, hasta: 2038.10, porcentaje: 0.20, cuota_fija: 107.39 },
          { parametro_legal_id: existingParams.id, numero_tramo: 4, desde: 2038.11, hasta: null, porcentaje: 0.30, cuota_fija: 310.76 },
        ],
      });
      console.log('  ✅ Added ISR tramos to existing parameter');
    } else {
      console.log('  ⏭️  ISR tramos already exist');
    }

    // Check if salarios mínimos exist
    const existingSalarios = await db.salarioMinimoSector.count({ where: { parametro_legal_id: existingParams.id } });
    if (existingSalarios === 0) {
      await db.salarioMinimoSector.createMany({
        data: [
          { parametro_legal_id: existingParams.id, sector: 'COMERCIO', salario_mensual: 365.00 },
          { parametro_legal_id: existingParams.id, sector: 'INDUSTRIA', salario_mensual: 365.00 },
          { parametro_legal_id: existingParams.id, sector: 'SERVICIOS', salario_mensual: 365.00 },
          { parametro_legal_id: existingParams.id, sector: 'AGROPECUARIO', salario_mensual: 246.87 },
          { parametro_legal_id: existingParams.id, sector: 'MAQUILA', salario_mensual: 352.72 },
          { parametro_legal_id: existingParams.id, sector: 'TRANSPORTE', salario_mensual: 365.00 },
        ],
      });
      console.log('  ✅ Added salarios mínimos to existing parameter');
    } else {
      console.log('  ⏭️  Salarios mínimos already exist');
    }
    console.log('  ⏭️  Legal parameters already exist');
  }

  // ============================================================
  // 6. JOB PROFILES (Perfiles de Puesto)
  // ============================================================
  console.log('\n📋 Creating job profiles...');
  const perfilMap: Record<string, string> = {};
  const adminUserId = userMap['ADMIN'];

  const profiles = [
    {
      codigo: 'CARGO-001',
      nombre_puesto: 'Gerente General',
      area_codigo: 'GG',
      banda_grado: 7,
      sector_laboral: 'COMERCIO',
      puntos_total: 850,
      proposito: 'Dirigir y gestionar las operaciones generales de la empresa, asegurando el cumplimiento de los objetivos estratégicos y la rentabilidad del negocio.',
      funciones_esenciales: 'Establecer la visión y estrategia de la empresa|Supervisar a los gerentes de área|Aprobar presupuestos y planes operativos|Representar a la empresa ante autoridades y stakeholders|Tomar decisiones estratégicas de alto nivel',
      requisitos_educacion: 'Licenciatura en Administración de Empresas o afín, Maestría deseable',
      requisitos_experiencia: 'Mínimo 10 años de experiencia en gerencia, 5 en posiciones de alta dirección',
      requisitos_habilidades: 'Liderazgo estratégico|Toma de decisiones|Negociación|Comunicación efectiva|Gestión del cambio',
      estado: 'VIGENTE',
    },
    {
      codigo: 'CARGO-002',
      nombre_puesto: 'Gerente de RRHH',
      area_codigo: 'RRHH',
      banda_grado: 6,
      sector_laboral: 'COMERCIO',
      puntos_total: 720,
      proposito: 'Diseñar, implementar y supervisar las políticas de recursos humanos para atraer, retener y desarrollar el talento humano de la organización.',
      funciones_esenciales: 'Desarrollar políticas de RRHH alineadas a la estrategia|Gestionar nómina y compensaciones|Supervisar reclutamiento y selección|Administrar relaciones laborales|Garantizar cumplimiento legal laboral',
      requisitos_educacion: 'Licenciatura en Administración de Recursos Humanos o Psicología Industrial',
      requisitos_experiencia: 'Mínimo 7 años en gestión de recursos humanos, 3 en posición gerencial',
      requisitos_habilidades: 'Gestión de talento|Conocimiento laboral|Mediación|Análisis de datos|Liderazgo',
      estado: 'VIGENTE',
    },
    {
      codigo: 'CARGO-003',
      nombre_puesto: 'Analista de Nómina',
      area_codigo: 'RRHH',
      banda_grado: 3,
      sector_laboral: 'COMERCIO',
      puntos_total: 450,
      proposito: 'Procesar y administrar la nómina de la empresa, realizando los cálculos de salarios, deducciones y retenciones de acuerdo con la legislación laboral vigente.',
      funciones_esenciales: 'Calcular y procesar nómina mensual y quincenal|Elaborar planillas de ISSS, AFP y ISR|Gestionar incidencias de nómina|Preparar reportes de costos laborales|Mantener actualizada la información salarial',
      requisitos_educacion: 'Técnico o Licenciatura en Contabilidad o Administración de Empresas',
      requisitos_experiencia: 'Mínimo 2 años en procesamiento de nóminas',
      requisitos_habilidades: 'Cálculo numérico|Atención al detalle|Conocimiento de legislación laboral|Excel avanzado|Análisis de datos',
      estado: 'VIGENTE',
    },
    {
      codigo: 'CARGO-004',
      nombre_puesto: 'Contador',
      area_codigo: 'CON',
      banda_grado: 4,
      sector_laboral: 'COMERCIO',
      puntos_total: 510,
      proposito: 'Gestionar la contabilidad general de la empresa, asegurando el registro fiel de las operaciones financieras y el cumplimiento de las obligaciones tributarias.',
      funciones_esenciales: 'Registrar operaciones contables diarias|Elaborar estados financieros|Calcular y declarar impuestos|Conciliar cuentas bancarias|Preparar informes de gestión financiera',
      requisitos_educacion: 'Licenciatura en Contaduría Pública',
      requisitos_experiencia: 'Mínimo 3 años en contabilidad general, experiencia en declaraciones tributarias',
      requisitos_habilidades: 'Contabilidad general|Normas tributarias|Análisis financiero|Sistemas contables|Organización',
      estado: 'VIGENTE',
    },
    {
      codigo: 'CARGO-005',
      nombre_puesto: 'Desarrollador de Software',
      area_codigo: 'TEC',
      banda_grado: 4,
      sector_laboral: 'COMERCIO',
      puntos_total: 530,
      proposito: 'Diseñar, desarrollar y mantener aplicaciones de software que soporten los procesos de negocio de la empresa.',
      funciones_esenciales: 'Desarrollar aplicaciones web y móviles|Diseñar arquitectura de software|Realizar pruebas de calidad|Documentar código y procesos|Dar soporte técnico a sistemas en producción',
      requisitos_educacion: 'Ingeniería en Sistemas Informáticos o afín',
      requisitos_experiencia: 'Mínimo 3 años en desarrollo de software',
      requisitos_habilidades: 'TypeScript/JavaScript|React/Next.js|Bases de datos|APIs REST|Metodologías ágiles',
      estado: 'VIGENTE',
    },
    {
      codigo: 'CARGO-006',
      nombre_puesto: 'Vendedor',
      area_codigo: 'VEN',
      banda_grado: 1,
      sector_laboral: 'COMERCIO',
      puntos_total: 280,
      proposito: 'Promover y vender los productos o servicios de la empresa, alcanzando las metas comerciales establecidas.',
      funciones_esenciales: 'Atender clientes y prospects|Realizar cotizaciones|Seguir el proceso de venta|Cumplir metas de ventas|Mantener actualizado el CRM',
      requisitos_educacion: 'Bachillerato, estudios técnicos en ventas deseables',
      requisitos_experiencia: 'Mínimo 1 año en ventas o atención al cliente',
      requisitos_habilidades: 'Comunicación|Persuasión|Orientación a resultados|Servicio al cliente|Trabajo en equipo',
      estado: 'VIGENTE',
    },
    {
      codigo: 'CARGO-007',
      nombre_puesto: 'Operario',
      area_codigo: 'OPS',
      banda_grado: 1,
      sector_laboral: 'INDUSTRIA',
      puntos_total: 250,
      proposito: 'Ejecutar las operaciones de producción y manufactura de acuerdo con los procedimientos y estándares de calidad establecidos.',
      funciones_esenciales: 'Operar maquinaria y equipo de producción|Realizar tareas de ensamblaje|Controlar calidad del producto|Mantener orden y limpieza del área|Reportar anomalías en el proceso',
      requisitos_educacion: 'Educación básica completa, capacitación técnica en producción deseable',
      requisitos_experiencia: 'No requiere experiencia previa, se brinda capacitación',
      requisitos_habilidades: 'Destreza manual|Atención al detalle|Cumplimiento de normas|Trabajo en equipo|Responsabilidad',
      estado: 'VIGENTE',
    },
  ];

  for (const profile of profiles) {
    const existing = await db.perfilPuesto.findUnique({ where: { codigo: profile.codigo } });
    if (!existing) {
      const created = await db.perfilPuesto.create({
        data: {
          codigo: profile.codigo,
          nombre_puesto: profile.nombre_puesto,
          area_id: areaMap[profile.area_codigo],
          banda_salarial_id: bandMap[profile.banda_grado] || null,
          sector_laboral: profile.sector_laboral,
          proposito: profile.proposito,
          funciones_esenciales: profile.funciones_esenciales,
          requisitos_educacion: profile.requisitos_educacion,
          requisitos_experiencia: profile.requisitos_experiencia,
          requisitos_habilidades: profile.requisitos_habilidades,
          puntos_total: profile.puntos_total,
          estado: profile.estado,
          creado_por_id: adminUserId,
        },
      });
      perfilMap[profile.nombre_puesto] = created.id;
      console.log(`  ✅ Created profile: ${profile.nombre_puesto} (${profile.codigo})`);
    } else {
      perfilMap[profile.nombre_puesto] = existing.id;
      // Update area_id if needed
      if (existing.area_id !== areaMap[profile.area_codigo]) {
        await db.perfilPuesto.update({
          where: { id: existing.id },
          data: {
            area_id: areaMap[profile.area_codigo],
            banda_salarial_id: bandMap[profile.banda_grado] || null,
          },
        });
      }
      console.log(`  ⏭️  Profile already exists: ${profile.nombre_puesto}`);
    }
  }

  // ============================================================
  // 7. EMPLOYEES + CONTRACTS + VACATIONS
  // ============================================================
  console.log('\n👥 Creating employees...');

  const employees = [
    {
      codigo_empleado: 'EMP-00001',
      primer_nombre: 'Juan',
      segundo_nombre: 'Carlos',
      primer_apellido: 'Pérez',
      segundo_apellido: 'García',
      dui: '12345678-1',
      nit: '1234-123456-101-0',
      fecha_nacimiento: new Date('1975-03-15'),
      genero: 'MASCULINO',
      estado_civil: 'CASADO',
      direccion: 'Col. Escalón, Av. Las Palmas #123, San Salvador',
      telefono: '2222-1234',
      email_personal: 'juan.perez@gmail.com',
      numero_isss: '12345678',
      numero_afp: 'AFP123456',
      afp_administradora: 'CONFIA',
      tipo_sangre: 'O+',
      contacto_emergencia_nombre: 'María Pérez',
      contacto_emergencia_telefono: '2222-5678',
      contacto_emergencia_relacion: 'Esposa',
      fecha_ingreso: new Date('2023-01-15'),
      salario_base: 5000.00,
      perfil_puesto_nombre: 'Gerente General',
      area_codigo: 'GG',
      tipo_contrato: 'INDEFINIDO',
      tipo_jornada: 'COMPLETA',
    },
    {
      codigo_empleado: 'EMP-00002',
      primer_nombre: 'María',
      segundo_nombre: 'Elena',
      primer_apellido: 'Rodríguez',
      segundo_apellido: 'López',
      dui: '23456789-2',
      nit: '2345-234567-102-0',
      fecha_nacimiento: new Date('1980-07-22'),
      genero: 'FEMENINO',
      estado_civil: 'CASADA',
      direccion: 'Col. San Benito, Pje. 3 #456, San Salvador',
      telefono: '2222-3456',
      email_personal: 'maria.rodriguez@gmail.com',
      numero_isss: '23456789',
      numero_afp: 'AFP234567',
      afp_administradora: 'CRECER',
      tipo_sangre: 'A+',
      contacto_emergencia_nombre: 'José Rodríguez',
      contacto_emergencia_telefono: '2222-7890',
      contacto_emergencia_relacion: 'Esposo',
      fecha_ingreso: new Date('2023-03-01'),
      salario_base: 3100.00,
      perfil_puesto_nombre: 'Gerente de RRHH',
      area_codigo: 'RRHH',
      tipo_contrato: 'INDEFINIDO',
      tipo_jornada: 'COMPLETA',
    },
    {
      codigo_empleado: 'EMP-00003',
      primer_nombre: 'Carlos',
      segundo_nombre: 'Alberto',
      primer_apellido: 'López',
      segundo_apellido: 'Martínez',
      dui: '34567890-3',
      nit: null,
      fecha_nacimiento: new Date('1992-11-08'),
      genero: 'MASCULINO',
      estado_civil: 'SOLTERO',
      direccion: 'Col. Flor Blanca, Calle El Progreso #789, San Salvador',
      telefono: '7777-1234',
      email_personal: 'carlos.lopez@gmail.com',
      numero_isss: '34567890',
      numero_afp: 'AFP345678',
      afp_administradora: 'CRECER',
      tipo_sangre: 'B+',
      contacto_emergencia_nombre: 'Ana López',
      contacto_emergencia_telefono: '7777-5678',
      contacto_emergencia_relacion: 'Madre',
      fecha_ingreso: new Date('2024-06-15'),
      salario_base: 950.00,
      perfil_puesto_nombre: 'Analista de Nómina',
      area_codigo: 'RRHH',
      tipo_contrato: 'INDEFINIDO',
      tipo_jornada: 'COMPLETA',
    },
    {
      codigo_empleado: 'EMP-00004',
      primer_nombre: 'Ana',
      segundo_nombre: 'Lucía',
      primer_apellido: 'Martínez',
      segundo_apellido: 'Hernández',
      dui: '45678901-4',
      nit: '4567-456789-103-0',
      fecha_nacimiento: new Date('1988-05-30'),
      genero: 'FEMENINO',
      estado_civil: 'CASADA',
      apellido_casada: 'de Torres',
      direccion: 'Col. La Sultana, Blvr. El Hipódromo #321, San Salvador',
      telefono: '2222-4321',
      email_personal: 'ana.martinez@gmail.com',
      numero_isss: '45678901',
      numero_afp: 'AFP456789',
      afp_administradora: 'CONFIA',
      tipo_sangre: 'AB+',
      contacto_emergencia_nombre: 'Roberto Torres',
      contacto_emergencia_telefono: '2222-8765',
      contacto_emergencia_relacion: 'Esposo',
      fecha_ingreso: new Date('2023-09-01'),
      salario_base: 1400.00,
      perfil_puesto_nombre: 'Contador',
      area_codigo: 'CON',
      tipo_contrato: 'INDEFINIDO',
      tipo_jornada: 'COMPLETA',
    },
    {
      codigo_empleado: 'EMP-00005',
      primer_nombre: 'Roberto',
      segundo_nombre: 'Antonio',
      primer_apellido: 'Hernández',
      segundo_apellido: 'Torres',
      dui: '56789012-5',
      nit: '5678-567890-104-0',
      fecha_nacimiento: new Date('1990-01-12'),
      genero: 'MASCULINO',
      estado_civil: 'SOLTERO',
      direccion: 'Col. Escalón, Calle El Mirador #654, San Salvador',
      telefono: '7777-4321',
      email_personal: 'roberto.hernandez@gmail.com',
      numero_isss: '56789012',
      numero_afp: 'AFP567890',
      afp_administradora: 'CONFIA',
      tipo_sangre: 'O-',
      contacto_emergencia_nombre: 'Carmen Hernández',
      contacto_emergencia_telefono: '7777-8765',
      contacto_emergencia_relacion: 'Madre',
      fecha_ingreso: new Date('2024-02-01'),
      salario_base: 1400.00,
      perfil_puesto_nombre: 'Desarrollador de Software',
      area_codigo: 'TEC',
      tipo_contrato: 'INDEFINIDO',
      tipo_jornada: 'COMPLETA',
    },
    {
      codigo_empleado: 'EMP-00006',
      primer_nombre: 'Laura',
      segundo_nombre: 'Patricia',
      primer_apellido: 'Gómez',
      segundo_apellido: 'Peña',
      dui: '67890123-6',
      nit: '6789-678901-105-0',
      fecha_nacimiento: new Date('1995-09-18'),
      genero: 'FEMENINO',
      estado_civil: 'SOLTERA',
      direccion: 'Soyapango, Col. Monte Sinaí #987, San Salvador',
      telefono: '7777-6543',
      email_personal: 'laura.gomez@gmail.com',
      numero_isss: '67890123',
      numero_afp: 'AFP678901',
      afp_administradora: 'CRECER',
      tipo_sangre: 'A-',
      contacto_emergencia_nombre: 'Pedro Gómez',
      contacto_emergencia_telefono: '7777-1098',
      contacto_emergencia_relacion: 'Padre',
      fecha_ingreso: new Date('2025-01-10'),
      salario_base: 480.00,
      perfil_puesto_nombre: 'Vendedor',
      area_codigo: 'VEN',
      tipo_contrato: 'INDEFINIDO',
      tipo_jornada: 'COMPLETA',
    },
    {
      codigo_empleado: 'EMP-00007',
      primer_nombre: 'Miguel',
      segundo_nombre: 'Ángel',
      primer_apellido: 'Torres',
      segundo_apellido: 'Ruiz',
      dui: '78901234-7',
      nit: '7890-789012-106-0',
      fecha_nacimiento: new Date('1993-04-05'),
      genero: 'MASCULINO',
      estado_civil: 'CASADO',
      direccion: 'Apopa, Col. Fátima #147, San Salvador',
      telefono: '7777-3210',
      email_personal: 'miguel.torres@gmail.com',
      numero_isss: '78901234',
      numero_afp: 'AFP789012',
      afp_administradora: 'CRECER',
      tipo_sangre: 'B-',
      contacto_emergencia_nombre: 'Sandra Torres',
      contacto_emergencia_telefono: '7777-7654',
      contacto_emergencia_relacion: 'Esposa',
      fecha_ingreso: new Date('2024-08-20'),
      salario_base: 450.00,
      perfil_puesto_nombre: 'Operario',
      area_codigo: 'OPS',
      tipo_contrato: 'INDEFINIDO',
      tipo_jornada: 'COMPLETA',
    },
  ];

  const empleadoMap: Record<string, string> = {};

  for (const emp of employees) {
    const existing = await db.empleado.findUnique({ where: { codigo_empleado: emp.codigo_empleado } });
    if (!existing) {
      const created = await db.empleado.create({
        data: {
          codigo_empleado: emp.codigo_empleado,
          primer_nombre: emp.primer_nombre,
          segundo_nombre: emp.segundo_nombre,
          primer_apellido: emp.primer_apellido,
          segundo_apellido: emp.segundo_apellido,
          apellido_casada: emp.apellido_casada || null,
          dui: emp.dui,
          nit: emp.nit,
          fecha_nacimiento: emp.fecha_nacimiento,
          genero: emp.genero,
          estado_civil: emp.estado_civil,
          direccion: emp.direccion,
          telefono: emp.telefono,
          email_personal: emp.email_personal,
          numero_isss: emp.numero_isss,
          numero_afp: emp.numero_afp,
          afp_administradora: emp.afp_administradora,
          tipo_sangre: emp.tipo_sangre,
          contacto_emergencia_nombre: emp.contacto_emergencia_nombre,
          contacto_emergencia_telefono: emp.contacto_emergencia_telefono,
          contacto_emergencia_relacion: emp.contacto_emergencia_relacion,
          fecha_ingreso: emp.fecha_ingreso,
          salario_base: emp.salario_base,
          perfil_puesto_id: perfilMap[emp.perfil_puesto_nombre] || null,
          area_id: areaMap[emp.area_codigo] || null,
          estado: 'ACTIVO',
        },
      });
      empleadoMap[emp.codigo_empleado] = created.id;
      console.log(`  ✅ Created employee: ${emp.primer_nombre} ${emp.primer_apellido} (${emp.codigo_empleado})`);

      // Create contract
      await db.contrato.create({
        data: {
          empleado_id: created.id,
          perfil_puesto_id: perfilMap[emp.perfil_puesto_nombre] || null,
          tipo_contrato: emp.tipo_contrato,
          salario_base_contrato: emp.salario_base,
          tipo_jornada: emp.tipo_jornada,
          fecha_inicio: emp.fecha_ingreso,
          activo: true,
        },
      });
      console.log(`    ✅ Created contract for ${emp.primer_nombre}`);

      // Create vacation record for 2026
      const existingVacation = await db.vacacionEmpleado.findFirst({
        where: { empleado_id: created.id, anio: 2026 },
      });
      if (!existingVacation) {
        await db.vacacionEmpleado.create({
          data: {
            empleado_id: created.id,
            anio: 2026,
            dias_derecho: 15,
            dias_tomados: 0,
            dias_pendientes: 15,
            dias_vendidos: 0,
            estado: 'ABIERTO',
          },
        });
        console.log(`    ✅ Created vacation record 2026 for ${emp.primer_nombre}`);
      }
    } else {
      empleadoMap[emp.codigo_empleado] = existing.id;
      // Update area_id and perfil_puesto_id if needed
      const updates: Record<string, string> = {};
      if (existing.area_id !== areaMap[emp.area_codigo]) {
        updates.area_id = areaMap[emp.area_codigo];
      }
      if (existing.perfil_puesto_id !== perfilMap[emp.perfil_puesto_nombre] && perfilMap[emp.perfil_puesto_nombre]) {
        updates.perfil_puesto_id = perfilMap[emp.perfil_puesto_nombre];
      }
      if (Object.keys(updates).length > 0) {
        await db.empleado.update({ where: { id: existing.id }, data: updates });
        console.log(`  🔄 Updated employee: ${emp.primer_nombre} ${emp.primer_apellido}`);
      } else {
        console.log(`  ⏭️  Employee already exists: ${emp.primer_nombre} ${emp.primer_apellido}`);
      }

      // Ensure contract exists
      const existingContract = await db.contrato.findFirst({
        where: { empleado_id: existing.id, activo: true },
      });
      if (!existingContract) {
        await db.contrato.create({
          data: {
            empleado_id: existing.id,
            perfil_puesto_id: perfilMap[emp.perfil_puesto_nombre] || null,
            tipo_contrato: emp.tipo_contrato,
            salario_base_contrato: emp.salario_base,
            tipo_jornada: emp.tipo_jornada,
            fecha_inicio: emp.fecha_ingreso,
            activo: true,
          },
        });
        console.log(`    ✅ Created missing contract for ${emp.primer_nombre}`);
      } else if (existingContract.perfil_puesto_id !== perfilMap[emp.perfil_puesto_nombre] && perfilMap[emp.perfil_puesto_nombre]) {
        await db.contrato.update({
          where: { id: existingContract.id },
          data: { perfil_puesto_id: perfilMap[emp.perfil_puesto_nombre] },
        });
      }

      // Ensure vacation record exists for 2026
      const existingVacation = await db.vacacionEmpleado.findFirst({
        where: { empleado_id: existing.id, anio: 2026 },
      });
      if (!existingVacation) {
        await db.vacacionEmpleado.create({
          data: {
            empleado_id: existing.id,
            anio: 2026,
            dias_derecho: 15,
            dias_tomados: 0,
            dias_pendientes: 15,
            dias_vendidos: 0,
            estado: 'ABIERTO',
          },
        });
        console.log(`    ✅ Created missing vacation record 2026 for ${emp.primer_nombre}`);
      }
    }
  }

  // ============================================================
  // 8. LINK EMPLOYEE TO USER (Laura Gómez Peña -> empleado@nomina.gob.sv)
  // ============================================================
  console.log('\n🔗 Linking employee to user...');
  const empleadoUser = await db.usuario.findUnique({ where: { email: 'empleado@nomina.gob.sv' } });
  const lauraEmpleadoId = empleadoMap['EMP-00006'];

  if (empleadoUser && lauraEmpleadoId) {
    if (!empleadoUser.empleado_id) {
      try {
        await db.usuario.update({
          where: { id: empleadoUser.id },
          data: { empleado_id: lauraEmpleadoId },
        });
        console.log('  ✅ Linked Laura Gómez Peña to empleado@nomina.gob.sv');
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        if (errMsg.includes('P2002') || errMsg.includes('Unique constraint')) {
          console.log('  ⏭️  Employee already linked to another user (unique constraint)');
        } else {
          throw e;
        }
      }
    } else if (empleadoUser.empleado_id === lauraEmpleadoId) {
      console.log('  ⏭️  User already correctly linked to Laura Gómez Peña');
    } else {
      console.log('  ⏭️  User already linked to a different employee');
    }
  } else {
    console.log('  ⚠️  Could not link employee to user - missing records');
  }

  // ============================================================
  // 9. EXTERNAL INTEGRATIONS
  // ============================================================
  console.log('\n🔌 Creating external integrations...');
  const integraciones = [
    { tipo: 'BANCO', nombre: 'BAC Credomatic - Dispersión ACH', activo: true, estado_test: 'NO_CONFIGURADO' },
    { tipo: 'ISSS', nombre: 'ISSS - Planilla OIS', activo: true, estado_test: 'NO_CONFIGURADO' },
    { tipo: 'AFP', nombre: 'AFP CRECER - Archivo SEPP', activo: true, estado_test: 'NO_CONFIGURADO' },
    { tipo: 'AFP', nombre: 'AFP CONFIA - Archivo SEPP', activo: true, estado_test: 'NO_CONFIGURADO' },
    { tipo: 'SMTP', nombre: 'Servidor de Correo', activo: true, estado_test: 'NO_CONFIGURADO' },
  ];

  for (const integ of integraciones) {
    const existing = await db.integracionExterna.findFirst({ where: { nombre: integ.nombre } });
    if (!existing) {
      await db.integracionExterna.create({
        data: {
          tipo: integ.tipo,
          nombre: integ.nombre,
          activo: integ.activo,
          estado_test: integ.estado_test,
        },
      });
      console.log(`  ✅ Created integration: ${integ.nombre}`);
    } else {
      console.log(`  ⏭️  Integration already exists: ${integ.nombre}`);
    }
  }

  // ============================================================
  // 10. GRANULAR PERMISSIONS FOR ADMIN
  // ============================================================
  console.log('\n🔐 Creating granular permissions for ADMIN...');
  const adminId = userMap['ADMIN'];
  if (adminId) {
    const permissions = [
      // Module: Empleados
      { modulo: 'EMPLEADOS', vista: 'DIRECTORIO', permiso: 'VER' },
      { modulo: 'EMPLEADOS', vista: 'DIRECTORIO', permiso: 'CREAR' },
      { modulo: 'EMPLEADOS', vista: 'DIRECTORIO', permiso: 'EDITAR' },
      { modulo: 'EMPLEADOS', vista: 'DIRECTORIO', permiso: 'ELIMINAR' },
      { modulo: 'EMPLEADOS', vista: 'DETALLE', permiso: 'VER' },
      { modulo: 'EMPLEADOS', vista: 'NUEVO', permiso: 'VER' },
      { modulo: 'EMPLEADOS', vista: 'NUEVO', permiso: 'CREAR' },
      { modulo: 'EMPLEADOS', vista: 'INCIDENCIAS', permiso: 'VER' },
      { modulo: 'EMPLEADOS', vista: 'INCIDENCIAS', permiso: 'CREAR' },
      { modulo: 'EMPLEADOS', vista: 'INCIDENCIAS', permiso: 'APROBAR' },

      // Module: Perfiles
      { modulo: 'PERFILES', vista: 'CATALOGO', permiso: 'VER' },
      { modulo: 'PERFILES', vista: 'CATALOGO', permiso: 'CREAR' },
      { modulo: 'PERFILES', vista: 'CATALOGO', permiso: 'EDITAR' },
      { modulo: 'PERFILES', vista: 'BANDAS', permiso: 'VER' },
      { modulo: 'PERFILES', vista: 'BANDAS', permiso: 'EDITAR' },

      // Module: Nómina
      { modulo: 'NOMINA', vista: 'DASHBOARD', permiso: 'VER' },
      { modulo: 'NOMINA', vista: 'PERIODOS', permiso: 'VER' },
      { modulo: 'NOMINA', vista: 'PERIODOS', permiso: 'CREAR' },
      { modulo: 'NOMINA', vista: 'CALCULO', permiso: 'VER' },
      { modulo: 'NOMINA', vista: 'CALCULO', permiso: 'EJECUTAR' },
      { modulo: 'NOMINA', vista: 'APROBACION', permiso: 'VER' },
      { modulo: 'NOMINA', vista: 'APROBACION', permiso: 'APROBAR' },
      { modulo: 'NOMINA', vista: 'DISPERSION', permiso: 'VER' },
      { modulo: 'NOMINA', vista: 'DISPERSION', permiso: 'EJECUTAR' },
      { modulo: 'NOMINA', vista: 'AGUINALDO', permiso: 'VER' },
      { modulo: 'NOMINA', vista: 'AGUINALDO', permiso: 'CALCULAR' },
      { modulo: 'NOMINA', vista: 'LIQUIDACION', permiso: 'VER' },
      { modulo: 'NOMINA', vista: 'LIQUIDACION', permiso: 'CALCULAR' },

      // Module: Reportes
      { modulo: 'REPORTES', vista: 'ISSS', permiso: 'VER' },
      { modulo: 'REPORTES', vista: 'AFP', permiso: 'VER' },
      { modulo: 'REPORTES', vista: 'ISR', permiso: 'VER' },
      { modulo: 'REPORTES', vista: 'TALENTO', permiso: 'VER' },

      // Module: Administración
      { modulo: 'ADMIN', vista: 'PARAMETROS', permiso: 'VER' },
      { modulo: 'ADMIN', vista: 'PARAMETROS', permiso: 'CREAR' },
      { modulo: 'ADMIN', vista: 'ORGANIGRAMA', permiso: 'VER' },
      { modulo: 'ADMIN', vista: 'ORGANIGRAMA', permiso: 'EDITAR' },
      { modulo: 'ADMIN', vista: 'INTEGRACIONES', permiso: 'VER' },
      { modulo: 'ADMIN', vista: 'INTEGRACIONES', permiso: 'EDITAR' },
      { modulo: 'ADMIN', vista: 'BITACORA', permiso: 'VER' },
      { modulo: 'ADMIN', vista: 'USUARIOS', permiso: 'VER' },
      { modulo: 'ADMIN', vista: 'USUARIOS', permiso: 'CREAR' },
      { modulo: 'ADMIN', vista: 'USUARIOS', permiso: 'EDITAR' },

      // Module: Self-service
      { modulo: 'SELFSERVICE', vista: 'PORTAL', permiso: 'VER' },
    ];

    let createdCount = 0;
    for (const perm of permissions) {
      const existing = await db.permisoGranularUsuario.findFirst({
        where: {
          usuario_id: adminId,
          modulo: perm.modulo,
          vista: perm.vista,
          permiso: perm.permiso,
        },
      });
      if (!existing) {
        await db.permisoGranularUsuario.create({
          data: {
            usuario_id: adminId,
            modulo: perm.modulo,
            vista: perm.vista,
            permiso: perm.permiso,
            concedido: true,
          },
        });
        createdCount++;
      }
    }
    if (createdCount > 0) {
      console.log(`  ✅ Created ${createdCount} permissions for ADMIN`);
    } else {
      console.log('  ⏭️  ADMIN permissions already exist');
    }
  }

  // ============================================================
  // VERIFICATION SUMMARY
  // ============================================================
  console.log('\n📊 Verification Summary:');
  const bankCount = await db.banco.count();
  const areaCount = await db.area.count();
  const bandCount = await db.bandaSalarial.count();
  const profileCount = await db.perfilPuesto.count();
  const employeeCount = await db.empleado.count();
  const contractCount = await db.contrato.count();
  const vacationCount = await db.vacacionEmpleado.count();
  const tramoCount = await db.tramoISR.count();
  const salarioMinCount = await db.salarioMinimoSector.count();
  const integCount = await db.integracionExterna.count();
  const permCount = await db.permisoGranularUsuario.count();

  console.log(`  Banks: ${bankCount} (expected: 8)`);
  console.log(`  Areas: ${areaCount} (expected: 7)`);
  console.log(`  Salary Bands: ${bandCount} (expected: 7)`);
  console.log(`  Job Profiles: ${profileCount} (expected: 7)`);
  console.log(`  Employees: ${employeeCount} (expected: 7)`);
  console.log(`  Contracts: ${contractCount} (expected: ≥7)`);
  console.log(`  Vacation Records: ${vacationCount} (expected: ≥7)`);
  console.log(`  ISR Tramos: ${tramoCount} (expected: 4)`);
  console.log(`  Salarios Mínimos: ${salarioMinCount} (expected: 6)`);
  console.log(`  Integrations: ${integCount} (expected: 5)`);
  console.log(`  Permissions: ${permCount} (expected: 43)`);

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

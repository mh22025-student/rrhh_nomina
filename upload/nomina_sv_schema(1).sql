-- ============================================================================================================================
-- SISTEMA DE NÓMINA Y PERFILES DE PUESTOS — REPÚBLICA DE EL SALVADOR
-- Script DDL/DML Completo | PostgreSQL 15+
-- Versión: 1.0 | Clasificación: Uso Interno
-- Tablas: 35 | ENUMs: 22 | Soporte: 26 Vistas / ~130 Funciones / 6 Módulos / 8 Roles
--
-- ESTRUCTURA DEL SCRIPT:
--   SECCIÓN 1 — Extensiones y tipos ENUM
--   SECCIÓN 2 — Tablas maestras (sin dependencias)
--   SECCIÓN 3 — Tablas principales (con dependencias)
--   SECCIÓN 4 — Tablas transaccionales (operaciones y cálculos)
--   SECCIÓN 5 — Tablas de soporte (seguridad, documentos, cumplimiento)
--   SECCIÓN 6 — Tabla de auditoría INMUTABLE (bitácora)
--   SECCIÓN 7 — DML de carga inicial (semillas / inserts maestros)
-- ============================================================================================================================

BEGIN;

-- ============================================================================================================================
-- SECCIÓN 1: EXTENSIONES Y TIPOS ENUM
-- ============================================================================================================================

-- Extensión para UUIDs criptográficamente seguros (nativa en PG 13+, pero se activa aquí por compatibilidad)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Extensión para búsqueda de texto completo y operaciones de texto avanzadas
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────────────────────
-- ENUMS DE SEGURIDAD Y ACCESO
-- ─────────────────────────────────────────────────────────────

-- Los 8 roles del sistema. Toda lógica de autorización (backend + DB) debe validar contra estos valores.
CREATE TYPE tipo_rol_sistema AS ENUM (
    'ADMIN',        -- Administrador del Sistema: acceso total, configuración, usuarios
    'ANALISTA',     -- Analista de Nómina: procesa incidencias, calcula planillas
    'RRHH',         -- Recursos Humanos: gestiona empleados y expedientes
    'CONTADOR',     -- Contador: acceso a reportes contables y cumplimiento fiscal
    'APROBADOR',    -- Aprobador RR.HH./Financiero: firma planillas y liquidaciones
    'GERENCIA',     -- Gerencia: reportes ejecutivos y dashboards
    'AUDITOR',      -- Auditor Interno: solo lectura en todos los módulos
    'EMPLEADO'      -- Empleado: portal self-service (solo datos propios)
);

-- Estados del ciclo de vida de un usuario en el sistema
CREATE TYPE tipo_estado_usuario AS ENUM (
    'ACTIVO',       -- Usuario operativo con acceso habilitado
    'INACTIVO',     -- Desactivado por el administrador
    'BLOQUEADO',    -- Bloqueado automáticamente por intentos fallidos (15 min) o por admin
    'ELIMINADO'     -- Soft delete; preserva integridad histórica de auditoría
);

-- ─────────────────────────────────────────────────────────────
-- ENUMS DE ORGANIZACIÓN Y EMPLEADOS
-- ─────────────────────────────────────────────────────────────

-- Género del empleado (para reportes de equidad salarial)
CREATE TYPE tipo_genero AS ENUM ('MASCULINO', 'FEMENINO', 'NO_ESPECIFICADO');

-- Estado laboral del empleado dentro de la organización
CREATE TYPE tipo_estado_empleado AS ENUM (
    'ACTIVO',           -- En funciones normales
    'PERIODO_PRUEBA',   -- Dentro de los 30 días iniciales (Art. 30 CT)
    'EN_LICENCIA',      -- Licencia autorizada (con o sin goce)
    'SUSPENDIDO',       -- Suspensión disciplinaria
    'TERMINADO'         -- Relación laboral concluida
);

-- Tipo de contrato laboral según el Código de Trabajo de El Salvador
CREATE TYPE tipo_contrato AS ENUM (
    'INDEFINIDO',           -- Contrato por tiempo indefinido
    'PLAZO_FIJO',           -- Contrato a plazo determinado
    'PERIODO_PRUEBA',       -- Período de prueba máx. 30 días (Art. 30 CT)
    'OBRA_DETERMINADA'      -- Por obra o servicio específico
);

-- Tipo de jornada laboral (determina horas ordinarias y recargos)
CREATE TYPE tipo_jornada AS ENUM (
    'DIURNA',    -- 8h/día, 44h/semana
    'NOCTURNA',  -- 7h/día, 39h/semana
    'MIXTA',     -- 7.5h/día, 42h/semana
    'VARIABLE'   -- Turnos rotativos
);

-- Periodicidad de pago de la nómina
CREATE TYPE tipo_forma_pago AS ENUM ('MENSUAL', 'QUINCENAL', 'SEMANAL');

-- Tipo de cuenta bancaria para dispersión ACH
CREATE TYPE tipo_cuenta_bancaria AS ENUM ('AHORRO', 'CORRIENTE');

-- AFP habilitadas en El Salvador (Ley del Sistema de Ahorro para Pensiones)
CREATE TYPE tipo_afp AS ENUM ('CRECER', 'CONFIA');

-- Nivel jerárquico para valuación de puestos
CREATE TYPE tipo_nivel_jerarquico AS ENUM (
    'OPERATIVO', 'TECNICO', 'PROFESIONAL', 'JEFATURA', 'GERENCIA', 'DIRECCION'
);

-- Sector laboral para aplicación de salario mínimo y exención de aguinaldo ISR
CREATE TYPE tipo_sector_laboral AS ENUM (
    'COMERCIO', 'INDUSTRIA', 'SERVICIOS', 'AGROPECUARIO', 'OTROS'
);

-- Estado del ciclo de vida del descriptivo de un perfil de puesto
CREATE TYPE tipo_estado_perfil AS ENUM (
    'BORRADOR',     -- En edición, no visible en selecciones de nómina
    'EN_REVISION',  -- Enviado a aprobación
    'VIGENTE',      -- Aprobado y activo
    'HISTORICO',    -- Versión anterior, archivada
    'RECHAZADO',    -- Devuelto con observaciones del aprobador
    'DESACTIVADO'   -- Perfil desactivado (sin empleados activos)
);

-- ─────────────────────────────────────────────────────────────
-- ENUMS DE NÓMINA Y PLANILLA
-- ─────────────────────────────────────────────────────────────

-- Estados del ciclo de vida de una planilla.
-- Los 4 estados canónicos del spec son BORRADOR, CALCULADA, APROBADA, PAGADA.
-- Se agregan RECHAZADA y EN_CORRECCION para cubrir el flujo completo de las 26 vistas.
CREATE TYPE tipo_estado_planilla AS ENUM (
    'BORRADOR',         -- Período creado, empleados cargados, sin cálculo ejecutado
    'CALCULADA',        -- Motor de cálculo ejecutado; pendiente de revisión y aprobación
    'APROBADA',         -- Firmada digitalmente por el aprobador; inmutable desde aquí
    'PAGADA',           -- Dispersión bancaria confirmada; período cerrado definitivamente
    'RECHAZADA',        -- Devuelta al analista con observaciones; requiere recálculo
    'EN_CORRECCION'     -- Reapertura de emergencia (requiere doble aprobación Admin+Aprobador)
);

-- Tipo de nómina procesada
CREATE TYPE tipo_planilla AS ENUM (
    'MENSUAL',          -- Nómina mensual regular
    'QUINCENAL',        -- Nómina quincenal
    'AGUINALDO',        -- Planilla especial de aguinaldo (Art. 196-202 CT)
    'LIQUIDACION',      -- Finiquito / Liquidación de relación laboral
    'COMPLEMENTARIA'    -- Ajuste posterior a una planilla cerrada (errores)
);

-- ─────────────────────────────────────────────────────────────
-- ENUMS DE INCIDENCIAS
-- ─────────────────────────────────────────────────────────────

-- Clasificación de los eventos que modifican la nómina base
CREATE TYPE tipo_incidencia AS ENUM (
    'HORAS_EXTRA',          -- Horas extraordinarias diurnas/nocturnas/descanso/asueto
    'AUSENCIA',             -- Días de ausencia justificados o injustificados
    'INCAPACIDAD_ISSS',     -- Incapacidad médica certificada por el ISSS
    'PERMISO',              -- Permiso con o sin goce de sueldo
    'COMISION',             -- Comisión variable del período
    'BONO',                 -- Bono o bonificación extraordinaria
    'DESCUENTO_ESPECIAL'    -- Descuento adicional autorizado (Art. 132 CT)
);

-- Flujo de aprobación de una incidencia antes de incluirse en el cálculo
CREATE TYPE tipo_estado_incidencia AS ENUM (
    'PENDIENTE',    -- Registrada, esperando aprobación del supervisor
    'APROBADA',     -- Aprobada; se incluirá en el próximo cálculo
    'RECHAZADA',    -- Rechazada con motivo; no afecta la nómina
    'PROCESADA',    -- Incluida en una planilla calculada/cerrada
    'ANULADA'       -- Anulada después de aprobación (requiere justificación)
);

-- Subtipo de horas extra para aplicar el recargo correcto (Arts. 169-170 CT)
CREATE TYPE tipo_hora_extra AS ENUM (
    'DIURNA',       -- Hora extra en jornada diurna
    'NOCTURNA',     -- Hora extra en jornada nocturna (recargo adicional Art. 161 CT)
    'DIA_DESCANSO', -- Hora trabajada en día de descanso semanal (Art. 165 CT)
    'DIA_ASUETO'    -- Hora trabajada en día de asueto nacional (Art. 192 CT)
);

-- Subtipo para incapacidades ISSS (determina regla de pago Art. 41 Ley ISSS)
CREATE TYPE tipo_incapacidad_isss AS ENUM (
    'ENFERMEDAD_COMUN',     -- Días 1-3 los paga el patrono; del 4 en adelante, el ISSS al 75%
    'ACCIDENTE_TRABAJO',    -- Cobertura inmediata por el ISSS
    'MATERNIDAD'            -- Cobertura de maternidad por el ISSS
);

-- Subtipo de permiso (impacto en salario, vacaciones y aguinaldo)
CREATE TYPE tipo_permiso AS ENUM (
    'CON_GOCE',     -- Sin descuento salarial; tiempo computa para prestaciones
    'SIN_GOCE'      -- Descuento proporcional; >2 meses afecta cómputo de vacaciones/aguinaldo
);

-- ─────────────────────────────────────────────────────────────
-- ENUMS DE LIQUIDACIONES Y CUMPLIMIENTO
-- ─────────────────────────────────────────────────────────────

-- Causal de terminación laboral (determina prestaciones aplicables según CT)
CREATE TYPE tipo_terminacion AS ENUM (
    'DESPIDO_INJUSTIFICADO',    -- Indemnización: 30 días/año (Art. 58 CT)
    'DESPIDO_JUSTIFICADO',      -- Sin indemnización (Art. 50 CT)
    'RENUNCIA_VOLUNTARIA',      -- Indemnización: 15 días/año (Ley 523)
    'MUTUO_CONSENTIMIENTO',     -- Según lo acordado por escrito
    'CASO_FORTUITO',            -- Fuerza mayor; sin indemnización
    'RENUNCIA_JUSTIFICADA'      -- Renuncia por causas imputables al patrono; indemnización completa
);

-- Estado de una liquidación desde apertura hasta cierre del expediente
CREATE TYPE tipo_estado_liquidacion AS ENUM (
    'BORRADOR',     -- En proceso de cálculo por el analista
    'CALCULADA',    -- Todos los rubros calculados; pendiente de revisión
    'APROBADA',     -- Aprobada; pendiente de firma del empleado y pago
    'CERRADA'       -- Firmada, pagada y expediente archivado
);

-- Estado de las obligaciones de cumplimiento ante ISSS, AFP y MH
CREATE TYPE tipo_estado_cumplimiento AS ENUM (
    'PENDIENTE',    -- Obligación identificada; no presentada aún
    'A_TIEMPO',     -- Presentada y pagada dentro del plazo legal
    'CON_MORA',     -- Presentada/pagada fuera del plazo; con recargo calculado
    'PRESENTADO'    -- Presentada (puede o no estar pagada)
);

-- Estado de los parámetros legales: inmutabilidad retroactiva (principio central del módulo 06-01)
CREATE TYPE tipo_estado_parametro AS ENUM (
    'VIGENTE',      -- Actualmente activo; alimenta el motor de cálculo
    'HISTORICO',    -- Expirado; conservado para reliquidaciones históricas
    'PROGRAMADO'    -- Fecha de vigencia futura; aún no en efecto
);

-- Vacaciones: estados del registro de período vacacional
CREATE TYPE tipo_estado_vacacion AS ENUM (
    'PROGRAMADA',   -- Aprobada y programada; aún no iniciada
    'TOMADA',       -- Período vacacional completado
    'CANCELADA',    -- Cancelada antes de iniciar
    'COMPENSADA'    -- Convertida en pago (solo al momento de liquidación)
);

-- Clasificación de documentos del expediente digital (Módulo 4 del manual)
CREATE TYPE tipo_documento_expediente AS ENUM (
    'CONTRATACION',     -- A) Documentos de ingreso: contrato, DUI, NIT, solicitud
    'SEGUIMIENTO',      -- B) Desempeño, cambios salariales, sanciones, capacitaciones
    'SEGURIDAD_SOCIAL', -- C) Afiliación ISSS, AFP, incapacidades
    'FISCAL',           -- D) Constancias ISR, NIT, declaraciones
    'TERMINACION'       -- E) Carta de renuncia, acta de liquidación, finiquito
);

-- Acciones registrables en la bitácora de auditoría (inmutable)
CREATE TYPE tipo_accion_auditoria AS ENUM (
    'INSERT', 'UPDATE', 'DELETE',
    'SELECT_SENSIBLE',  -- Consulta de datos sensibles: salarios, DUI, NIT, cuentas
    'LOGIN', 'LOGOUT', 'LOGIN_FALLIDO',
    'APPROVE',          -- Aprobación de planilla, incidencia o liquidación
    'REJECT',           -- Rechazo con observaciones
    'CALCULATE',        -- Ejecución del motor de cálculo de nómina
    'EXPORT',           -- Generación y descarga de reportes/archivos
    'ACCESO_DENEGADO',  -- Intento de acceso a módulo no autorizado (HTTP 403)
    'REOPEN',           -- Reapertura de período cerrado (evento CRÍTICO)
    'CAMBIO_CONTRASENA',
    'CAMBIO_ROL',       -- Modificación de rol de usuario (invalida sesiones)
    'BLOQUEO_CUENTA',
    'PARAMETROS_LEGALES_CREADOS'
);


-- ============================================================================================================================
-- SECCIÓN 2: TABLAS MAESTRAS (SIN DEPENDENCIAS DE NEGOCIO)
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA: bancos
-- Catálogo de instituciones bancarias habilitadas para dispersión ACH.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE bancos (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    codigo              VARCHAR(10)     NOT NULL,
    nombre              VARCHAR(100)    NOT NULL,
    codigo_ach          VARCHAR(20),                          -- Código ACH para archivo de dispersión
    formato_cuenta      VARCHAR(50),                          -- Descripción del formato de número de cuenta
    activo              BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_bancos PRIMARY KEY (id),
    CONSTRAINT uq_bancos_codigo UNIQUE (codigo)
);
COMMENT ON TABLE bancos IS 'Catálogo de instituciones bancarias habilitadas para dispersión de nómina vía ACH.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: parametros_legales
-- Almacena históricamente todos los parámetros que alimentan el motor de cálculo.
-- PRINCIPIO FUNDAMENTAL: Ningún registro existente se modifica jamás.
-- Ante un cambio de ley se crea un nuevo registro con fecha_vigencia_desde futura.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE parametros_legales (
    id                          UUID            NOT NULL DEFAULT gen_random_uuid(),
    descripcion_cambio          VARCHAR(255)    NOT NULL,                   -- Ej: "Actualización salario mínimo Decreto #123"
    decreto_norma_origen        VARCHAR(100)    NOT NULL,                   -- Referencia legal: número de decreto, Diario Oficial
    -- Tasas ISSS (Ley del Seguro Social)
    tasa_isss_laboral           NUMERIC(5,4)    NOT NULL DEFAULT 0.0300     CHECK (tasa_isss_laboral     BETWEEN 0 AND 1),
    tasa_isss_patronal          NUMERIC(5,4)    NOT NULL DEFAULT 0.0750     CHECK (tasa_isss_patronal    BETWEEN 0 AND 1),
    tope_cotizacion_isss        NUMERIC(10,2)   NOT NULL DEFAULT 1000.00    CHECK (tope_cotizacion_isss  > 0),
    -- Tasas AFP (Ley del Sistema de Ahorro para Pensiones)
    tasa_afp_laboral            NUMERIC(5,4)    NOT NULL DEFAULT 0.0725     CHECK (tasa_afp_laboral      BETWEEN 0 AND 1),
    tasa_afp_patronal           NUMERIC(5,4)    NOT NULL DEFAULT 0.0875     CHECK (tasa_afp_patronal     BETWEEN 0 AND 1),
    -- INSAFORP (Ley de Formación Profesional — aplica para patronos con ≥ 10 empleados)
    tasa_insaforp               NUMERIC(5,4)    NOT NULL DEFAULT 0.0100     CHECK (tasa_insaforp         BETWEEN 0 AND 1),
    empleados_minimos_insaforp  SMALLINT        NOT NULL DEFAULT 10         CHECK (empleados_minimos_insaforp > 0),
    -- Control de vigencia y estado (inmutabilidad retroactiva)
    fecha_vigencia_desde        DATE            NOT NULL,
    fecha_vigencia_hasta        DATE,                                       -- NULL = actualmente vigente
    estado                      tipo_estado_parametro NOT NULL DEFAULT 'PROGRAMADO',
    creado_por_usuario_id       UUID,                                       -- FK se agrega después (dependencia circular)
    fecha_creacion              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_parametros_legales PRIMARY KEY (id),
    -- Solo puede existir un registro VIGENTE a la vez
    CONSTRAINT uq_parametros_un_vigente UNIQUE (estado) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT ck_parametros_fechas CHECK (
        fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta > fecha_vigencia_desde
    )
);
COMMENT ON TABLE parametros_legales IS
    'Historial inmutable de parámetros legales: tasas ISSS/AFP/INSAFORP. '
    'NUNCA se modifica un registro existente. Ante cambio de ley: INSERT con fecha_vigencia_desde futura.';

-- NOTA: La UNIQUE CONSTRAINT en estado='VIGENTE' es DEFERRABLE para permitir la transición
-- atómica de un parámetro a HISTORICO y uno nuevo a VIGENTE dentro de la misma transacción.

-- ─────────────────────────────────────────────────────────────
-- TABLA: tramos_isr
-- Tramos de la tabla de retención ISR del Ministerio de Hacienda (Art. 37 Ley ISR).
-- MENSUAL. 4 tramos. Hijos de parametros_legales.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE tramos_isr (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    parametro_legal_id      UUID            NOT NULL,
    numero_tramo            SMALLINT        NOT NULL CHECK (numero_tramo BETWEEN 1 AND 10),
    limite_inferior         NUMERIC(10,2)   NOT NULL CHECK (limite_inferior >= 0),
    limite_superior         NUMERIC(10,2),                  -- NULL en el último tramo (sin límite superior)
    cuota_fija              NUMERIC(10,2)   NOT NULL DEFAULT 0.00 CHECK (cuota_fija >= 0),
    tasa_marginal           NUMERIC(5,4)    NOT NULL CHECK (tasa_marginal BETWEEN 0 AND 1),
    exceso_calculado_sobre  NUMERIC(10,2)   NOT NULL DEFAULT 0.00 CHECK (exceso_calculado_sobre >= 0),
    CONSTRAINT pk_tramos_isr PRIMARY KEY (id),
    CONSTRAINT fk_tramos_isr_parametros FOREIGN KEY (parametro_legal_id)
        REFERENCES parametros_legales(id) ON DELETE RESTRICT,
    CONSTRAINT uq_tramo_por_parametro UNIQUE (parametro_legal_id, numero_tramo),
    CONSTRAINT ck_tramos_limites CHECK (
        limite_superior IS NULL OR limite_superior > limite_inferior
    )
);
COMMENT ON TABLE tramos_isr IS
    'Tramos de la tabla mensual de ISR (Art. 37 Ley ISR). '
    'Formato: ISR = cuota_fija + (renta_imponible - exceso_calculado_sobre) * tasa_marginal, si renta en [inferior, superior).';

-- ─────────────────────────────────────────────────────────────
-- TABLA: salarios_minimos_sector
-- Salarios mínimos por sector laboral. Hijos de parametros_legales.
-- Base para validación de salarios y cálculo de exención ISR en aguinaldo.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE salarios_minimos_sector (
    id                  UUID                NOT NULL DEFAULT gen_random_uuid(),
    parametro_legal_id  UUID                NOT NULL,
    sector              tipo_sector_laboral NOT NULL,
    salario_mensual     NUMERIC(10,2)       NOT NULL CHECK (salario_mensual > 0),
    CONSTRAINT pk_salarios_minimos PRIMARY KEY (id),
    CONSTRAINT fk_salarios_minimos_parametros FOREIGN KEY (parametro_legal_id)
        REFERENCES parametros_legales(id) ON DELETE RESTRICT,
    CONSTRAINT uq_salario_por_sector_parametro UNIQUE (parametro_legal_id, sector)
);
COMMENT ON TABLE salarios_minimos_sector IS
    'Salario mínimo mensual vigente por sector (comercio, industria, servicios, agropecuario, otros). '
    'Se usa para: validar salarios al crear/modificar empleados, calcular exención ISR de aguinaldo '
    '(2 salarios mínimos), y detectar anomalías de salario neto menor al mínimo.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: usuarios
-- Cuentas de acceso al sistema. El campo password_hash almacena el hash bcrypt (factor 12).
-- PROHIBIDO almacenar contraseñas en texto plano.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE usuarios (
    id                          UUID                NOT NULL DEFAULT gen_random_uuid(),
    email                       VARCHAR(100)        NOT NULL,
    password_hash               VARCHAR(255)        NOT NULL,   -- SIEMPRE bcrypt factor ≥ 12. NUNCA texto plano.
    primer_nombre               VARCHAR(50)         NOT NULL,
    primer_apellido             VARCHAR(50)         NOT NULL,
    segundo_nombre              VARCHAR(50),
    segundo_apellido            VARCHAR(50),
    rol                         tipo_rol_sistema    NOT NULL,
    estado                      tipo_estado_usuario NOT NULL DEFAULT 'ACTIVO',
    debe_cambiar_contrasena     BOOLEAN             NOT NULL DEFAULT FALSE,  -- Flag para forzar cambio en próximo login
    empleado_id                 UUID,               -- FK se agrega después (dependencia con empleados)
    ultimo_login_exitoso_at     TIMESTAMPTZ,
    ultimo_login_fallido_at     TIMESTAMPTZ,
    contador_intentos_fallidos  SMALLINT            NOT NULL DEFAULT 0 CHECK (contador_intentos_fallidos >= 0),
    bloqueado_hasta             TIMESTAMPTZ,                    -- Bloqueo temporal por intentos fallidos (15 min)
    fecha_creacion              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    creado_por_id               UUID,               -- FK self-referencing: quién creó este usuario
    motivo_eliminacion          TEXT,               -- Obligatorio en soft-delete
    CONSTRAINT pk_usuarios PRIMARY KEY (id),
    CONSTRAINT uq_usuarios_email UNIQUE (email),
    CONSTRAINT ck_usuarios_email_formato CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);
COMMENT ON TABLE usuarios IS
    'Cuentas de acceso al sistema. password_hash: SIEMPRE bcrypt factor ≥ 12. '
    'Soft-delete: estado=ELIMINADO (no DELETE físico) para preservar integridad del historial de auditoría. '
    'Roles válidos: ADMIN, ANALISTA, RRHH, CONTADOR, APROBADOR, GERENCIA, AUDITOR, EMPLEADO.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: areas
-- Estructura organizacional de la empresa: áreas, departamentos, unidades.
-- Árbol jerárquico auto-referenciado. Alimenta filtros, organigramas y aprobadores de nómina.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE areas (
    id                          UUID            NOT NULL DEFAULT gen_random_uuid(),
    codigo                      VARCHAR(20)     NOT NULL,
    nombre                      VARCHAR(100)    NOT NULL,
    descripcion                 TEXT,
    area_padre_id               UUID,           -- NULL = área raíz (ej: empresa misma)
    nivel                       SMALLINT        NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 10),
    aprobador_nomina_id         UUID,           -- FK a usuarios: aprobador de nómina asignado al área
    jefe_id                     UUID,           -- FK a empleados (DEFERRABLE — se agrega post-creación de empleados)
    activo                      BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_areas PRIMARY KEY (id),
    CONSTRAINT uq_areas_codigo UNIQUE (codigo),
    CONSTRAINT uq_areas_nombre_padre UNIQUE (nombre, area_padre_id),
    CONSTRAINT fk_areas_padre FOREIGN KEY (area_padre_id)
        REFERENCES areas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_areas_aprobador FOREIGN KEY (aprobador_nomina_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE areas IS
    'Árbol organizacional auto-referenciado (área_padre_id). '
    'jefe_id se agrega como FK DEFERRABLE después de crear la tabla empleados (dependencia circular controlada).';


-- ============================================================================================================================
-- SECCIÓN 3: TABLAS PRINCIPALES (CON DEPENDENCIAS)
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA: bandas_salariales
-- Estructura de compensación: rangos de puntuación y rangos salariales por sector.
-- Base del sistema de valuación de puestos por el método de puntos por factor.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE bandas_salariales (
    id                  UUID                NOT NULL DEFAULT gen_random_uuid(),
    nombre              VARCHAR(80)         NOT NULL,
    descripcion         TEXT,
    sector              tipo_sector_laboral NOT NULL DEFAULT 'COMERCIO',
    puntuacion_min      INTEGER             NOT NULL CHECK (puntuacion_min >= 0),
    puntuacion_max      INTEGER             NOT NULL CHECK (puntuacion_max > 0),
    salario_minimo      NUMERIC(10,2)       NOT NULL CHECK (salario_minimo > 0),     -- Extremo inferior de la banda
    salario_midpoint    NUMERIC(10,2)       NOT NULL CHECK (salario_midpoint > 0),   -- Punto medio / referencia de mercado
    salario_maximo      NUMERIC(10,2)       NOT NULL CHECK (salario_maximo > 0),     -- Extremo superior de la banda
    activo              BOOLEAN             NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_bandas_salariales PRIMARY KEY (id),
    CONSTRAINT uq_bandas_nombre_sector UNIQUE (nombre, sector),
    CONSTRAINT ck_bandas_puntuacion CHECK (puntuacion_max > puntuacion_min),
    CONSTRAINT ck_bandas_salarios CHECK (
        salario_minimo < salario_midpoint AND salario_midpoint < salario_maximo
    )
);
COMMENT ON TABLE bandas_salariales IS
    'Estructura de bandas salariales para el sistema de valuación de puestos. '
    'Constraint ck_bandas_salarios garantiza que min < midpoint < max. '
    'Al actualizar una banda, el sistema debe identificar empleados fuera del nuevo rango.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: perfiles_puesto
-- Catálogo maestro de cargos. Cada fila representa UN cargo único en la organización.
-- Las versiones del descriptivo se almacenan en versiones_perfil_puesto.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE perfiles_puesto (
    id                          UUID                    NOT NULL DEFAULT gen_random_uuid(),
    codigo                      VARCHAR(20)             NOT NULL,           -- Auto-generado: CARGO-XXX
    nombre_cargo                VARCHAR(80)             NOT NULL,
    area_id                     UUID                    NOT NULL,
    superior_jerarquico_id      UUID,                                       -- FK self-referencing (perfil padre en el organigrama)
    banda_salarial_id           UUID,                                       -- Asignada al aprobar el descriptivo valorado
    nivel_jerarquico            tipo_nivel_jerarquico   NOT NULL,
    tipo_jornada_cargo          tipo_jornada            NOT NULL DEFAULT 'DIURNA',
    sector_laboral              tipo_sector_laboral     NOT NULL DEFAULT 'COMERCIO',
    plazas_presupuestadas       SMALLINT                NOT NULL DEFAULT 1 CHECK (plazas_presupuestadas > 0),
    puntuacion_valuacion        INTEGER                 CHECK (puntuacion_valuacion >= 0),
    estado                      tipo_estado_perfil      NOT NULL DEFAULT 'BORRADOR',
    fecha_creacion              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    creado_por_id               UUID,
    CONSTRAINT pk_perfiles_puesto PRIMARY KEY (id),
    CONSTRAINT uq_perfiles_codigo UNIQUE (codigo),
    CONSTRAINT uq_perfiles_nombre_area UNIQUE (nombre_cargo, area_id),
    CONSTRAINT fk_perfiles_area FOREIGN KEY (area_id)
        REFERENCES areas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_perfiles_superior FOREIGN KEY (superior_jerarquico_id)
        REFERENCES perfiles_puesto(id) ON DELETE SET NULL,
    CONSTRAINT fk_perfiles_banda FOREIGN KEY (banda_salarial_id)
        REFERENCES bandas_salariales(id) ON DELETE RESTRICT,
    CONSTRAINT fk_perfiles_creador FOREIGN KEY (creado_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE perfiles_puesto IS
    'Catálogo de cargos. Una fila = un cargo único. '
    'El descriptivo completo (funciones, requisitos, condiciones) vive en versiones_perfil_puesto. '
    'ON DELETE RESTRICT en area_id: no se puede eliminar un área con perfiles asignados.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: versiones_perfil_puesto
-- Historial completo de descriptivos de puestos con versionado semántico.
-- Una versión VIGENTE por perfil. Las anteriores pasan a HISTORICO.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE versiones_perfil_puesto (
    id                          UUID                NOT NULL DEFAULT gen_random_uuid(),
    perfil_puesto_id            UUID                NOT NULL,
    numero_version              SMALLINT            NOT NULL DEFAULT 1 CHECK (numero_version > 0),
    -- Sección A: Identificación (redundante con perfiles_puesto pero necesario por versionado)
    proposito_principal         TEXT                NOT NULL,
    -- Secciones B-D almacenadas como JSONB para flexibilidad (estructura definida en capa de aplicación)

    funciones_esenciales        JSONB               NOT NULL DEFAULT '[]'::JSONB,   -- Array de strings
    funciones_secundarias       JSONB               NOT NULL DEFAULT '[]'::JSONB,   -- Array de strings
    requisitos                  JSONB               NOT NULL DEFAULT '{}'::JSONB,   -- educación, experiencia, idiomas, etc.
    responsabilidades           JSONB               NOT NULL DEFAULT '{}'::JSONB,   -- supervisión, fondos, confidencialidad
    condiciones_trabajo         JSONB               NOT NULL DEFAULT '{}'::JSONB,   -- ambiente, riesgos, esfuerzo
    competencias_conductuales   JSONB               NOT NULL DEFAULT '[]'::JSONB,   -- Array de competencias
    indicadores_kpi             JSONB               NOT NULL DEFAULT '[]'::JSONB,   -- Metas y KPIs (¡Corregido con coma!)

    -- Resultado de la valuación (método de puntos por factor)
    puntos_habilidades          NUMERIC(6,2)        CHECK (puntos_habilidades >= 0),
    puntos_esfuerzo             NUMERIC(6,2)        CHECK (puntos_esfuerzo >= 0),
    puntos_responsabilidad      NUMERIC(6,2)        CHECK (puntos_responsabilidad >= 0),
    puntos_condiciones          NUMERIC(6,2)        CHECK (puntos_condiciones >= 0),
    puntuacion_total            NUMERIC(7,2)        CHECK (puntuacion_total >= 0),
    banda_sugerida_id           UUID,
    estado                      tipo_estado_perfil  NOT NULL DEFAULT 'BORRADOR',
    -- Flujo de aprobación
    fecha_envio_revision        TIMESTAMPTZ,
    revisado_por_id             UUID,
    fecha_aprobacion            TIMESTAMPTZ,
    motivo_rechazo              TEXT,
    fecha_vigencia_desde        DATE,
    fecha_creacion              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    creado_por_id               UUID,
    CONSTRAINT pk_versiones_perfil PRIMARY KEY (id),
    CONSTRAINT uq_version_por_perfil UNIQUE (perfil_puesto_id, numero_version),
    CONSTRAINT fk_versiones_perfil FOREIGN KEY (perfil_puesto_id)
        REFERENCES perfiles_puesto(id) ON DELETE RESTRICT,
    CONSTRAINT fk_versiones_banda_sugerida FOREIGN KEY (banda_sugerida_id)
        REFERENCES bandas_salariales(id) ON DELETE SET NULL,
    CONSTRAINT fk_versiones_revisor FOREIGN KEY (revisado_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_versiones_creador FOREIGN KEY (creado_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE versiones_perfil_puesto IS
    'Versionado del descriptivo de puesto. Formato diff entre versiones se calcula en capa de aplicación. '
    'Al aprobar una versión nueva: versión anterior pasa a HISTORICO. Solo una versión VIGENTE por perfil.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: empleados
-- Expediente maestro del colaborador. Fuente de verdad del sistema.
-- Campos legales salvadoreños: dui, nit, nup_afp, numero_afiliado_isss — todos UNIQUE.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE empleados (
    id                          UUID                    NOT NULL DEFAULT gen_random_uuid(),
    codigo_empleado             VARCHAR(20)             NOT NULL,               -- Auto-generado: EMP-XXXXX
    -- Datos de identidad
    primer_nombre               VARCHAR(50)             NOT NULL,
    segundo_nombre              VARCHAR(50),
    primer_apellido             VARCHAR(50)             NOT NULL,
    segundo_apellido            VARCHAR(50),
    fecha_nacimiento            DATE                    NOT NULL,
    genero                      tipo_genero             NOT NULL,
    -- Documentos de identidad salvadoreños — UNIQUE obligatorio por ley
    dui                         VARCHAR(10)             NOT NULL,               -- Formato: ########-#
    nit                         VARCHAR(17)             NOT NULL,               -- Formato: ####-######-###-#
    -- Previsional — UNIQUE obligatorio; se completa en Paso 2 del registro
    afp                         tipo_afp,
    nup_afp                     VARCHAR(30),                                    -- Número Único Previsional AFP
    numero_afiliado_isss        VARCHAR(20),                                    -- Número de afiliación ISSS
    -- Datos de contacto
    email_personal              VARCHAR(100)            NOT NULL,
    telefono_principal          VARCHAR(9)              NOT NULL,               -- Formato: ####-####
    telefono_alternativo        VARCHAR(9),
    nombre_contacto_emergencia  VARCHAR(100)            NOT NULL,
    telefono_emergencia         VARCHAR(9)              NOT NULL,
    direccion_residencia        TEXT                    NOT NULL,
    -- Datos laborales
    fecha_ingreso               DATE                    NOT NULL,
    estado                      tipo_estado_empleado    NOT NULL DEFAULT 'ACTIVO',
    area_id                     UUID                    NOT NULL,
    salario_base                NUMERIC(10,2)           NOT NULL                CHECK (salario_base >= 0),
    -- Relaciones del sistema
    usuario_id                  UUID,                                           -- Vinculación con usuario de self-service
    foto_url                    TEXT,
    observaciones_nomina        TEXT,
    activo                      BOOLEAN                 NOT NULL DEFAULT TRUE,
    fecha_terminacion           DATE,                                           -- Fecha efectiva de baja
    fecha_creacion              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    creado_por_id               UUID,
    CONSTRAINT pk_empleados PRIMARY KEY (id),
    CONSTRAINT uq_empleados_codigo         UNIQUE (codigo_empleado),
    CONSTRAINT uq_empleados_dui            UNIQUE (dui),
    CONSTRAINT uq_empleados_nit            UNIQUE (nit),
    CONSTRAINT uq_empleados_nup_afp        UNIQUE (nup_afp),
    CONSTRAINT uq_empleados_isss           UNIQUE (numero_afiliado_isss),
    CONSTRAINT uq_empleados_email          UNIQUE (email_personal),
    CONSTRAINT ck_empleados_edad           CHECK (
        fecha_nacimiento <= CURRENT_DATE - INTERVAL '18 years'
    ),
    CONSTRAINT ck_empleados_dui_formato    CHECK (dui ~ '^\d{8}-\d$'),
    CONSTRAINT ck_empleados_nit_formato    CHECK (nit ~ '^\d{4}-\d{6}-\d{3}-\d$'),
    CONSTRAINT ck_empleados_telefono       CHECK (telefono_principal ~ '^\d{4}-\d{4}$'),
    CONSTRAINT ck_empleados_salario        CHECK (salario_base >= 0),
    CONSTRAINT fk_empleados_area FOREIGN KEY (area_id)
        REFERENCES areas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_empleados_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_empleados_creador FOREIGN KEY (creado_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE empleados IS
    'Expediente maestro del colaborador. '
    'UNIQUE constraints en dui, nit, nup_afp, numero_afiliado_isss son requerimientos legales irrenunciables. '
    'ON DELETE RESTRICT en area_id: no se puede eliminar un área con empleados asignados. '
    'Soft-delete: activo=FALSE + fecha_terminacion (no DELETE físico).';

-- Resuelve la dependencia circular: areas.jefe_id → empleados.id
ALTER TABLE areas ADD CONSTRAINT fk_areas_jefe
    FOREIGN KEY (jefe_id) REFERENCES empleados(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;
COMMENT ON CONSTRAINT fk_areas_jefe ON areas IS
    'FK DEFERRABLE: permite insertar área y empleado en la misma transacción sin violar integridad referencial.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: contratos
-- Historial de contratos laborales del empleado. El contrato activo es activo=TRUE.
-- Un empleado puede tener solo un contrato activo a la vez.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE contratos (
    id                      UUID                NOT NULL DEFAULT gen_random_uuid(),
    empleado_id             UUID                NOT NULL,
    perfil_puesto_id        UUID,
    banda_salarial_id       UUID,
    banco_id                UUID,
    tipo_contrato           tipo_contrato       NOT NULL,
    tipo_jornada            tipo_jornada        NOT NULL,
    fecha_inicio            DATE                NOT NULL,
    fecha_fin               DATE,                                           -- NULL para contratos indefinidos
    salario_base_contrato   NUMERIC(10,2)       NOT NULL                    CHECK (salario_base_contrato >= 0),
    forma_pago              tipo_forma_pago     NOT NULL DEFAULT 'MENSUAL',
    numero_cuenta_bancaria  TEXT,                                           -- Cifrado en capa de aplicación (AES-256)
    tipo_cuenta             tipo_cuenta_bancaria,
    activo                  BOOLEAN             NOT NULL DEFAULT TRUE,
    fecha_creacion          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    registrado_por_id       UUID,
    CONSTRAINT pk_contratos PRIMARY KEY (id),
    CONSTRAINT fk_contratos_empleado FOREIGN KEY (empleado_id)
        REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contratos_perfil FOREIGN KEY (perfil_puesto_id)
        REFERENCES perfiles_puesto(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contratos_banda FOREIGN KEY (banda_salarial_id)
        REFERENCES bandas_salariales(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contratos_banco FOREIGN KEY (banco_id)
        REFERENCES bancos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contratos_registrador FOREIGN KEY (registrado_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT ck_contratos_salario  CHECK (salario_base_contrato >= 0),
    CONSTRAINT ck_contratos_fechas   CHECK (
        fecha_fin IS NULL OR fecha_fin > fecha_inicio
    )
);
COMMENT ON TABLE contratos IS
    'Historial contractual del empleado. El contrato vigente tiene activo=TRUE. '
    'numero_cuenta_bancaria debe almacenarse CIFRADO (AES-256) en la capa de aplicación. '
    'ON DELETE RESTRICT en empleado_id: no se puede eliminar un empleado con contratos históricos.';

-- Garantiza que cada empleado tenga máximo un contrato activo simultáneamente
CREATE UNIQUE INDEX uq_un_contrato_activo_por_empleado
    ON contratos (empleado_id) WHERE (activo = TRUE);
COMMENT ON INDEX uq_un_contrato_activo_por_empleado IS
    'Index parcial: garantiza que solo exista UN contrato activo por empleado en todo momento.';


-- ============================================================================================================================
-- SECCIÓN 4: TABLAS TRANSACCIONALES (OPERACIONES Y CÁLCULOS DE NÓMINA)
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA: planillas
-- Registro maestro de cada ciclo de nómina procesado.
-- Las planillas APROBADAS son INMUTABLES. Errores post-pago se corrigen con planillas COMPLEMENTARIAS.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE planillas (
    id                          UUID                    NOT NULL DEFAULT gen_random_uuid(),
    codigo_planilla             VARCHAR(30)             NOT NULL,               -- Ej: NOMINA-2026-01-M
    descripcion                 VARCHAR(200)            NOT NULL,
    tipo                        tipo_planilla           NOT NULL DEFAULT 'MENSUAL',
    estado                      tipo_estado_planilla    NOT NULL DEFAULT 'BORRADOR',
    fecha_inicio_periodo        DATE                    NOT NULL,
    fecha_fin_periodo           DATE                    NOT NULL,
    fecha_pago_programada       DATE,
    fecha_pago_confirmada       DATE,
    -- Parámetros legales usados para el cálculo (snapshot de la versión vigente al calcular)
    parametro_legal_id          UUID,
    -- Planilla de referencia para complementarias
    planilla_padre_id           UUID,                                           -- FK self: solo para tipo=COMPLEMENTARIA
    -- Totales calculados (se llenan al ejecutar el motor de cálculo)
    total_empleados             INTEGER                 DEFAULT 0               CHECK (total_empleados >= 0),
    total_salarios_brutos       NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_salarios_brutos >= 0),
    total_isss_laboral          NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_isss_laboral >= 0),
    total_afp_laboral           NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_afp_laboral >= 0),
    total_isr_retenido          NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_isr_retenido >= 0),
    total_otros_descuentos      NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_otros_descuentos >= 0),
    total_neto_a_pagar          NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_neto_a_pagar >= 0),
    total_isss_patronal         NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_isss_patronal >= 0),
    total_afp_patronal          NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_afp_patronal >= 0),
    total_insaforp              NUMERIC(14,2)           DEFAULT 0.00            CHECK (total_insaforp >= 0),
    -- Control de flujo
    calculada_por_id            UUID,
    fecha_calculo               TIMESTAMPTZ,
    aprobada_por_id             UUID,
    fecha_aprobacion            TIMESTAMPTZ,
    aprobacion_segundo_nivel_id UUID,                                           -- Para planillas > umbral configurado
    hash_integridad             VARCHAR(64),                                    -- SHA-256 del contenido al aprobar
    sello_aprobacion            JSONB,                                          -- { nombre, ip, timestamp, hash }
    motivo_rechazo              TEXT,
    referencia_lote_banco       VARCHAR(100),
    justificacion_reaper        TEXT,                                           -- Si estado=EN_CORRECCION
    fecha_creacion              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    creada_por_id               UUID,
    CONSTRAINT pk_planillas PRIMARY KEY (id),
    CONSTRAINT uq_planillas_codigo UNIQUE (codigo_planilla),
    CONSTRAINT fk_planillas_parametro FOREIGN KEY (parametro_legal_id)
        REFERENCES parametros_legales(id) ON DELETE RESTRICT,
    CONSTRAINT fk_planillas_padre FOREIGN KEY (planilla_padre_id)
        REFERENCES planillas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_planillas_calculador FOREIGN KEY (calculada_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_planillas_aprobador FOREIGN KEY (aprobada_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_planillas_segundo_aprobador FOREIGN KEY (aprobacion_segundo_nivel_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_planillas_creador FOREIGN KEY (creada_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT ck_planillas_fechas CHECK (fecha_fin_periodo >= fecha_inicio_periodo)
);
COMMENT ON TABLE planillas IS
    'Registro maestro del ciclo de nómina. INMUTABLE desde estado=APROBADA. '
    'Errores post-pago: crear nueva planilla con tipo=COMPLEMENTARIA y planilla_padre_id apuntando a la original. '
    'hash_integridad se calcula sobre todos los detalles_planilla al momento de la aprobación.';

-- Garantiza: solo un período BORRADOR o CALCULADO activo por tipo de nómina a la vez
CREATE UNIQUE INDEX uq_planilla_activa_por_tipo
    ON planillas (tipo)
    WHERE estado IN ('BORRADOR', 'CALCULADA');
COMMENT ON INDEX uq_planilla_activa_por_tipo IS
    'Regla de período único activo: no puede haber dos planillas en proceso para el mismo tipo de nómina.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: empleados_planilla
-- Tabla puente: empleados incluidos en cada planilla (carga inicial al crear el período).
-- Permite incluir/excluir empleados individualmente antes del cálculo.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE empleados_planilla (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    planilla_id         UUID        NOT NULL,
    empleado_id         UUID        NOT NULL,
    contrato_id         UUID,                       -- Snapshot del contrato vigente al momento de inclusión
    excluido            BOOLEAN     NOT NULL DEFAULT FALSE,
    justificacion_excl  TEXT,                       -- Obligatorio si excluido=TRUE
    fecha_inclusion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    incluido_por_id     UUID,
    CONSTRAINT pk_empleados_planilla PRIMARY KEY (id),
    CONSTRAINT uq_empleado_por_planilla UNIQUE (planilla_id, empleado_id),
    CONSTRAINT fk_ep_planilla FOREIGN KEY (planilla_id)
        REFERENCES planillas(id) ON DELETE CASCADE,     -- Si se elimina una planilla BORRADOR, se eliminan sus empleados
    CONSTRAINT fk_ep_empleado FOREIGN KEY (empleado_id)
        REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ep_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE SET NULL,
    CONSTRAINT fk_ep_inclusor FOREIGN KEY (incluido_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE empleados_planilla IS
    'Empleados cargados en una planilla. ON DELETE CASCADE desde planillas solo para estado=BORRADOR (controlado por aplicación). '
    'excluido=TRUE permite excluir temporalmente a un empleado sin eliminarlo del registro.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: incidencias_nomina
-- Registro de todos los eventos que modifican la nómina base del período activo.
-- Requieren aprobación antes de incluirse en el cálculo.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE incidencias_nomina (
    id                          UUID                        NOT NULL DEFAULT gen_random_uuid(),
    empleado_id                 UUID                        NOT NULL,
    planilla_id                 UUID                        NOT NULL,
    tipo                        tipo_incidencia             NOT NULL,
    estado                      tipo_estado_incidencia      NOT NULL DEFAULT 'PENDIENTE',
    -- Datos del evento
    fecha_inicio                DATE                        NOT NULL,
    fecha_fin                   DATE,                                       -- NULL para incidencias de un solo día
    descripcion                 VARCHAR(500),
    documento_url               TEXT,                                       -- URL firmada del respaldo adjunto
    -- Campos específicos por tipo (algunos son NULL según el tipo)
    tipo_hora_extra             tipo_hora_extra,                            -- Para tipo=HORAS_EXTRA
    cantidad_horas              NUMERIC(5,2)                CHECK (cantidad_horas IS NULL OR cantidad_horas > 0),
    tipo_incapacidad            tipo_incapacidad_isss,                      -- Para tipo=INCAPACIDAD_ISSS
    numero_certificado_isss     VARCHAR(50),
    tipo_ausencia               tipo_ausencia,                              -- Para tipo=AUSENCIA
    tipo_permiso                tipo_permiso,                               -- Para tipo=PERMISO
    gravado_isr                 BOOLEAN,                                    -- Para tipo=BONO
    es_comision_habitual        BOOLEAN,                                    -- Para tipo=COMISION (Art. 180 CT)
    -- Montos calculados (NUMERIC(10,2) — PROHIBIDO float)
    monto_incidencia            NUMERIC(10,2)               CHECK (monto_incidencia IS NULL OR monto_incidencia >= 0),
    monto_patrono               NUMERIC(10,2)               CHECK (monto_patrono IS NULL OR monto_patrono >= 0),  -- Días pagados por patrono (incapacidades)
    monto_isss_subsidio         NUMERIC(10,2)               CHECK (monto_isss_subsidio IS NULL OR monto_isss_subsidio >= 0),
    -- Flujo de aprobación
    aprobada_por_id             UUID,
    comentarios_aprobacion      TEXT,
    motivo_rechazo              TEXT,
    fecha_aprobacion            TIMESTAMPTZ,
    -- Control
    registrada_por_id           UUID                        NOT NULL,
    fecha_creacion              TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_incidencias PRIMARY KEY (id),
    CONSTRAINT fk_incidencias_empleado FOREIGN KEY (empleado_id)
        REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidencias_planilla FOREIGN KEY (planilla_id)
        REFERENCES planillas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidencias_aprobador FOREIGN KEY (aprobada_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_incidencias_registrador FOREIGN KEY (registrada_por_id)
        REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT ck_incidencias_fechas CHECK (
        fecha_fin IS NULL OR fecha_fin >= fecha_inicio
    ),
    CONSTRAINT ck_horas_extra_dia CHECK (
        tipo != 'HORAS_EXTRA' OR cantidad_horas <= 2   -- Art. 169 CT: máx. 2 horas extra por día
    )
);
COMMENT ON TABLE incidencias_nomina IS
    'Eventos que modifican la nómina base: horas extra, ausencias, incapacidades, permisos, comisiones, bonos y descuentos. '
    'Solo las incidencias con estado=APROBADA se incluyen en el motor de cálculo. '
    'ck_horas_extra_dia: Art. 169 CT limita a 2 horas extra por día por incidencia.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: detalles_planilla
-- Desglose de nómina calculado POR EMPLEADO POR PERÍODO.
-- Es el registro histórico inmutable del cálculo. Estructura exigida por Ley.
-- TODOS los campos monetarios: NUMERIC(10,2). PROHIBIDO REAL o DOUBLE PRECISION.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE detalles_planilla (
    id                              UUID            NOT NULL DEFAULT gen_random_uuid(),
    planilla_id                     UUID            NOT NULL,
    empleado_id                     UUID            NOT NULL,
    contrato_id                     UUID,                                       -- Snapshot del contrato usado en el cálculo
    -- ─── DEVENGADOS (INGRESOS) ───────────────────────────────
    salario_nominal                 NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (salario_nominal >= 0),
    monto_horas_extras_diurnas      NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (monto_horas_extras_diurnas >= 0),
    monto_horas_extras_nocturnas    NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (monto_horas_extras_nocturnas >= 0),
    monto_recargo_dia_descanso      NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (monto_recargo_dia_descanso >= 0),
    monto_recargo_dia_asueto        NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (monto_recargo_dia_asueto >= 0),
    monto_comisiones                NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (monto_comisiones >= 0),
    monto_bonos_gravados            NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (monto_bonos_gravados >= 0),
    monto_otros_ingresos            NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (monto_otros_ingresos >= 0),
    -- ─── SALARIO BRUTO (calculado = suma de devengados) ──────
    salario_bruto                   NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (salario_bruto >= 0),
    -- ─── DESCUENTOS LABORALES (de cargo del trabajador) ──────
    -- ISSS laboral: MIN(salario_bruto, tope_isss) × tasa_isss_laboral
    base_isss                       NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (base_isss >= 0),  -- MIN(bruto, $1,000)
    descuento_isss                  NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_isss >= 0),
    -- AFP laboral: salario_bruto × tasa_afp_laboral (sin tope)
    base_afp                        NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (base_afp >= 0),
    descuento_afp                   NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_afp >= 0),
    -- ISR: aplicado sobre la renta imponible = bruto - isss - afp (Art. 37 Ley ISR)
    renta_imponible                 NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (renta_imponible >= 0),
    tramo_isr_aplicado              SMALLINT        CHECK (tramo_isr_aplicado BETWEEN 1 AND 10),
    descuento_isr                   NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_isr >= 0),
    -- Otros descuentos en orden de prelación legal (Art. 132 CT)
    descuento_cuota_alimenticia     NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_cuota_alimenticia >= 0),   -- Prioridad 1
    descuento_prestamo_patronal     NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_prestamo_patronal >= 0),   -- Prioridad 2
    descuento_seguro_complementario NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_seguro_complementario >= 0),
    descuento_embargo_civil         NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_embargo_civil >= 0),       -- Máx 20% excedente mínimo
    descuento_otros                 NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (descuento_otros >= 0),
    -- ─── NETO A PAGAR ────────────────────────────────────────
    neto_a_pagar                    NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (neto_a_pagar >= 0),
    -- ─── CARGAS PATRONALES (NO se descuentan del empleado; son gasto del patrono) ─
    isss_patronal                   NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (isss_patronal >= 0),
    afp_patronal                    NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (afp_patronal >= 0),
    insaforp                        NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (insaforp >= 0),
    costo_laboral_total             NUMERIC(10,2)   NOT NULL DEFAULT 0.00       CHECK (costo_laboral_total >= 0),  -- neto + cargas patronales
    -- ─── ESTADO DE PAGO ──────────────────────────────────────
    estado_pago                     VARCHAR(30)     NOT NULL DEFAULT 'PENDIENTE',  -- PENDIENTE, PAGADO, RETORNADO, PENDIENTE_MANUAL
    fecha_acreditacion              DATE,
    referencia_pago                 VARCHAR(100),
    CONSTRAINT pk_detalles_planilla PRIMARY KEY (id),
    CONSTRAINT uq_detalle_empleado_planilla UNIQUE (planilla_id, empleado_id),
    CONSTRAINT fk_dp_planilla FOREIGN KEY (planilla_id)
        REFERENCES planillas(id) ON DELETE RESTRICT,    -- No borrar si la planilla está aprobada
    CONSTRAINT fk_dp_empleado FOREIGN KEY (empleado_id)
        REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_dp_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE SET NULL
);
COMMENT ON TABLE detalles_planilla IS
    'Desglose de nómina POR EMPLEADO POR PERÍODO. Registro histórico e inmutable post-aprobación. '
    'Estructura cumple Art. 138 CT: toda deducción debe estar identificada con su concepto y base legal. '
    'TODOS los campos monetarios son NUMERIC(10,2). El uso de REAL o DOUBLE PRECISION está PROHIBIDO. '
    'Orden de prelación de descuentos: cuota_alimenticia > préstamo > seguro > embargo > otros (Art. 132 CT).';

-- ─────────────────────────────────────────────────────────────
-- TABLA: vacaciones_empleado
-- Registro de períodos vacacionales. Base para cálculo de saldos y liquidaciones.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE vacaciones_empleado (
    id                      UUID                    NOT NULL DEFAULT gen_random_uuid(),
    empleado_id             UUID                    NOT NULL,
    periodo_vacacional      VARCHAR(20)             NOT NULL,           -- Ej: "2025-2026" (año de derecho)
    fecha_inicio            DATE                    NOT NULL,
    fecha_fin               DATE                    NOT NULL,
    dias_habiles            SMALLINT                NOT NULL            CHECK (dias_habiles > 0),
    tipo                    VARCHAR(20)             NOT NULL,           -- PROGRAMADA / TOMADA
    estado                  tipo_estado_vacacion    NOT NULL DEFAULT 'PROGRAMADA',
    autorizado_por_id       UUID,
    planilla_id             UUID,                                       -- Si se incluyó en una nómina
    fecha_cancelacion       DATE,
    motivo_cancelacion      TEXT,
    liquidacion_id          UUID,                                       -- FK se agrega después de crear liquidaciones
    fecha_creacion          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    registrada_por_id       UUID,
    CONSTRAINT pk_vacaciones PRIMARY KEY (id),
    CONSTRAINT fk_vac_empleado FOREIGN KEY (empleado_id)
        REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_vac_autorizador FOREIGN KEY (autorizado_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_vac_planilla FOREIGN KEY (planilla_id)
        REFERENCES planillas(id) ON DELETE SET NULL,
    CONSTRAINT fk_vac_registrador FOREIGN KEY (registrada_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT ck_vacaciones_fechas CHECK (fecha_fin >= fecha_inicio)
);
COMMENT ON TABLE vacaciones_empleado IS
    'Registro de períodos vacacionales. El saldo disponible se calcula dinámicamente. '
    'Base legal: Art. 177-187 CT. Derecho a 15 días con goce de sueldo después del primer año (Art. 177).';

-- ─────────────────────────────────────────────────────────────
-- TABLA: liquidaciones
-- Expediente de liquidación de relación laboral.
-- Cada rubro tiene fundamento legal trazable. Es inmutable desde estado=CERRADA.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE liquidaciones (
    id                              UUID                        NOT NULL DEFAULT gen_random_uuid(),
    empleado_id                     UUID                        NOT NULL,
    tipo_terminacion                tipo_terminacion            NOT NULL,
    estado                          tipo_estado_liquidacion     NOT NULL DEFAULT 'BORRADOR',
    fecha_terminacion               DATE                        NOT NULL,
    fecha_inicio_relacion           DATE                        NOT NULL,   -- Snapshot desde contratos
    -- Cálculo de antigüedad
    anios_servicio_exactos          NUMERIC(5,2)                CHECK (anios_servicio_exactos >= 0),
    anios_computables               SMALLINT                    CHECK (anios_computables >= 0),
    -- Rubros calculados (todos NUMERIC(10,2) — PROHIBIDO float)
    indemnizacion_bruta             NUMERIC(10,2)   DEFAULT 0.00    CHECK (indemnizacion_bruta >= 0),
    vacacion_proporcional           NUMERIC(10,2)   DEFAULT 0.00    CHECK (vacacion_proporcional >= 0),
    aguinaldo_proporcional          NUMERIC(10,2)   DEFAULT 0.00    CHECK (aguinaldo_proporcional >= 0),
    aguinaldo_exento_isr            NUMERIC(10,2)   DEFAULT 0.00    CHECK (aguinaldo_exento_isr >= 0),
    aguinaldo_gravado_isr           NUMERIC(10,2)   DEFAULT 0.00    CHECK (aguinaldo_gravado_isr >= 0),
    ultimo_salario_bruto            NUMERIC(10,2)   DEFAULT 0.00    CHECK (ultimo_salario_bruto >= 0),
    -- Deducciones sobre la liquidación
    isr_sobre_liquidacion           NUMERIC(10,2)   DEFAULT 0.00    CHECK (isr_sobre_liquidacion >= 0),
    descuentos_varios               NUMERIC(10,2)   DEFAULT 0.00    CHECK (descuentos_varios >= 0),
    -- Totales
    total_bruto_liquidacion         NUMERIC(10,2)   DEFAULT 0.00    CHECK (total_bruto_liquidacion >= 0),
    total_neto_liquidacion          NUMERIC(10,2)   DEFAULT 0.00    CHECK (total_neto_liquidacion >= 0),
    -- Documentación y control
    fundamento_legal                TEXT,                                   -- Síntesis del articulado aplicado
    acta_liquidacion_url            TEXT,                                   -- URL del acta firmada (cifrada)
    hash_acta                       VARCHAR(64),                            -- SHA-256 para verificar integridad del acta
    casos_especiales                JSONB           DEFAULT '{}'::JSONB,    -- Maternidad, incapacidad al despedir, embargo
    planilla_ultimo_periodo_id      UUID,
    aprobada_por_id                 UUID,
    fecha_aprobacion                TIMESTAMPTZ,
    fecha_firma_pago                DATE,
    motivo_retencion                TEXT,
    fecha_creacion                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    creada_por_id                   UUID,
    CONSTRAINT pk_liquidaciones PRIMARY KEY (id),
    CONSTRAINT fk_liq_empleado FOREIGN KEY (empleado_id)
        REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_liq_planilla FOREIGN KEY (planilla_ultimo_periodo_id)
        REFERENCES planillas(id) ON DELETE SET NULL,
    CONSTRAINT fk_liq_aprobador FOREIGN KEY (aprobada_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_liq_creador FOREIGN KEY (creada_por_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE liquidaciones IS
    'Expediente de terminación laboral. Calcula indemnización, vacación proporcional, aguinaldo proporcional y último salario. '
    'Referencia legal: Arts. 58, 113, 177-187, 196-202 CT. Ley 523 para renuncias voluntarias. '
    'casos_especiales JSONB: maternidad (fuero Art. 113), incapacidad ISSS al despedir, embargos activos.';

-- Agregar FK de vacaciones a liquidaciones
ALTER TABLE vacaciones_empleado ADD CONSTRAINT fk_vac_liquidacion
    FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones(id) ON DELETE SET NULL;


-- ============================================================================================================================
-- SECCIÓN 5: TABLAS DE SOPORTE (SEGURIDAD, DOCUMENTOS, CUMPLIMIENTO)
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA: historial_cambios_salariales
-- Registro inmutable de cada cambio de salario con fundamento documentado.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historial_cambios_salariales (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    empleado_id         UUID            NOT NULL,
    contrato_id         UUID,
    salario_anterior    NUMERIC(10,2)   NOT NULL CHECK (salario_anterior >= 0),
    salario_nuevo       NUMERIC(10,2)   NOT NULL CHECK (salario_nuevo >= 0),
    porcentaje_cambio   NUMERIC(6,2),   -- Calculado: ((nuevo-anterior)/anterior)*100
    fecha_efectividad   DATE            NOT NULL,
    motivo              VARCHAR(50)     NOT NULL,   -- 'EVALUACION_DESEMPENIO', 'AJUSTE_BANDA', 'NUEVO_CARGO', 'MERCADO', 'OTRO'
    detalle_motivo      TEXT,
    documento_url       TEXT,
    aprobado_por_id     UUID,
    fecha_registro      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_historial_salarios PRIMARY KEY (id),
    CONSTRAINT fk_hs_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_hs_contrato FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE SET NULL,
    CONSTRAINT fk_hs_aprobador FOREIGN KEY (aprobado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: historial_cambios_cargo
-- Registro de traspasos de puesto, ascensos y traslados.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historial_cambios_cargo (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    empleado_id             UUID            NOT NULL,
    perfil_anterior_id      UUID,
    perfil_nuevo_id         UUID,
    area_anterior_id        UUID,
    area_nueva_id           UUID,
    fecha_efectividad       DATE            NOT NULL,
    motivo                  TEXT            NOT NULL,
    alerta_salario_fuera_rango BOOLEAN      NOT NULL DEFAULT FALSE,
    aprobado_por_id         UUID,
    fecha_registro          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_historial_cargo PRIMARY KEY (id),
    CONSTRAINT fk_hc_empleado        FOREIGN KEY (empleado_id)       REFERENCES empleados(id)       ON DELETE RESTRICT,
    CONSTRAINT fk_hc_perfil_ant      FOREIGN KEY (perfil_anterior_id) REFERENCES perfiles_puesto(id) ON DELETE SET NULL,
    CONSTRAINT fk_hc_perfil_nuevo    FOREIGN KEY (perfil_nuevo_id)    REFERENCES perfiles_puesto(id) ON DELETE SET NULL,
    CONSTRAINT fk_hc_area_ant        FOREIGN KEY (area_anterior_id)   REFERENCES areas(id)           ON DELETE SET NULL,
    CONSTRAINT fk_hc_area_nueva      FOREIGN KEY (area_nueva_id)      REFERENCES areas(id)           ON DELETE SET NULL,
    CONSTRAINT fk_hc_aprobador       FOREIGN KEY (aprobado_por_id)    REFERENCES usuarios(id)        ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: historial_presentaciones_isss
-- Seguimiento del cumplimiento mensual ante el ISSS (sistema OIS).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historial_presentaciones_isss (
    id                          UUID                        NOT NULL DEFAULT gen_random_uuid(),
    planilla_id                 UUID                        NOT NULL,
    fecha_vencimiento_legal     DATE                        NOT NULL,   -- Último día del mes siguiente al período
    fecha_presentacion          DATE,
    referencia_ois              VARCHAR(100),
    monto_cuotas_laborales      NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_cuotas_laborales >= 0),
    monto_cuotas_patronales     NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_cuotas_patronales >= 0),
    monto_mora                  NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_mora >= 0),
    monto_total_pagado          NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_total_pagado >= 0),
    estado                      tipo_estado_cumplimiento    NOT NULL DEFAULT 'PENDIENTE',
    comprobante_url             TEXT,
    hash_archivo_ois            VARCHAR(64),
    registrado_por_id           UUID,
    fecha_registro              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_presentaciones_isss PRIMARY KEY (id),
    CONSTRAINT uq_isss_por_planilla UNIQUE (planilla_id),
    CONSTRAINT fk_pi_planilla FOREIGN KEY (planilla_id) REFERENCES planillas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pi_registrador FOREIGN KEY (registrado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE historial_presentaciones_isss IS
    'Registro de cumplimiento ante ISSS. Plazo legal: dentro del mes siguiente al período de pago. '
    'La mora se calcula al 1% mensual pro-rata (Art. 78 Ley ISSS).';

-- ─────────────────────────────────────────────────────────────
-- TABLA: historial_presentaciones_afp
-- Seguimiento del cumplimiento ante AFP Crecer / AFP Confía (sistema SEPP).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historial_presentaciones_afp (
    id                          UUID                        NOT NULL DEFAULT gen_random_uuid(),
    planilla_id                 UUID                        NOT NULL,
    afp                         tipo_afp                    NOT NULL,
    fecha_vencimiento_legal     DATE                        NOT NULL,
    fecha_presentacion          DATE,
    numero_lote_sepp            VARCHAR(100),
    monto_cuotas_laborales      NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_cuotas_laborales >= 0),
    monto_cuotas_patronales     NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_cuotas_patronales >= 0),
    monto_total_acreditado      NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_total_acreditado >= 0),
    estado                      tipo_estado_cumplimiento    NOT NULL DEFAULT 'PENDIENTE',
    comprobante_url             TEXT,
    registrado_por_id           UUID,
    fecha_registro              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_presentaciones_afp PRIMARY KEY (id),
    CONSTRAINT uq_afp_por_planilla_afp UNIQUE (planilla_id, afp),
    CONSTRAINT fk_pa_planilla FOREIGN KEY (planilla_id) REFERENCES planillas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pa_registrador FOREIGN KEY (registrado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE historial_presentaciones_afp IS
    'Registro de cotizaciones AFP enviadas vía SEPP. '
    'Fondos no acreditados en 5 días hábiles generan responsabilidad solidaria del patrono (Ley SAP).';

-- ─────────────────────────────────────────────────────────────
-- TABLA: historial_enteros_isr
-- Seguimiento de retenciones de ISR enteradas al Ministerio de Hacienda.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historial_enteros_isr (
    id                          UUID                        NOT NULL DEFAULT gen_random_uuid(),
    planilla_id                 UUID                        NOT NULL,
    fecha_vencimiento_legal     DATE                        NOT NULL,   -- 10 días hábiles siguientes (Art. 62 Ley ISR)
    fecha_entero                DATE,
    formulario_f910             VARCHAR(50),                            -- Número del formulario presentado al MH
    monto_isr_total             NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_isr_total >= 0),
    monto_mora_multa            NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_mora_multa >= 0),
    monto_total_pagado          NUMERIC(14,2)   DEFAULT 0.00    CHECK (monto_total_pagado >= 0),
    banco_entero                VARCHAR(100),
    referencia_transaccion      VARCHAR(100),
    estado                      tipo_estado_cumplimiento    NOT NULL DEFAULT 'PENDIENTE',
    comprobante_url             TEXT,
    registrado_por_id           UUID,
    fecha_registro              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_enteros_isr PRIMARY KEY (id),
    CONSTRAINT uq_isr_por_planilla UNIQUE (planilla_id),
    CONSTRAINT fk_ei_planilla FOREIGN KEY (planilla_id) REFERENCES planillas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ei_registrador FOREIGN KEY (registrado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
COMMENT ON TABLE historial_enteros_isr IS
    'Registro de retenciones ISR enteradas al MH. '
    'Incumplimiento genera responsabilidad solidaria + multa de 25% a 75% (Art. 246 Código Tributario). '
    'El plazo de 10 días hábiles se calcula excluyendo sábados, domingos y días de asueto.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: refresh_tokens
-- Gestión de tokens de sesión de larga duración (JWT Refresh Tokens).
-- La rotación garantiza que cada refresh token se use una sola vez.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    usuario_id      UUID        NOT NULL,
    token_hash      VARCHAR(64) NOT NULL,   -- SHA-256 del token real (nunca el token en claro)
    expira_en       TIMESTAMPTZ NOT NULL,
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_uso_en   TIMESTAMPTZ,
    ip_creacion     INET,
    user_agent      TEXT,
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_rt_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE CASCADE
);
COMMENT ON TABLE refresh_tokens IS
    'Tokens de sesión. El token real NUNCA se almacena; solo su SHA-256. '
    'Rotación en cada uso: el token anterior se invalida y se emite uno nuevo (previene replay attacks).';

-- ─────────────────────────────────────────────────────────────
-- TABLA: otp_tokens
-- Códigos OTP de un solo uso para recuperación de contraseña (TTL: 15 minutos).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE otp_tokens (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    usuario_id      UUID        NOT NULL,
    otp_hash        VARCHAR(64) NOT NULL,   -- SHA-256 del código OTP de 6 dígitos
    reset_token     VARCHAR(64),            -- UUID v4 de un solo uso para el step 3 del flujo
    expira_en       TIMESTAMPTZ NOT NULL,
    intentos        SMALLINT    NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    usado           BOOLEAN     NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_otp_tokens PRIMARY KEY (id),
    CONSTRAINT fk_otp_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: tokens_bloqueados
-- Lista negra de refresh tokens invalidados (logout, cambio de rol, cambio de contraseña).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE tokens_bloqueados (
    token_hash      VARCHAR(64) NOT NULL,
    bloqueado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo          VARCHAR(100),
    CONSTRAINT pk_tokens_bloqueados PRIMARY KEY (token_hash)
);
COMMENT ON TABLE tokens_bloqueados IS
    'Lista negra de tokens invalidados. Registros expirados pueden purgarse con un job periódico. '
    'El middleware de autenticación debe consultar esta tabla en cada request.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: intentos_login
-- Registro de intentos de login para el mecanismo anti-brute-force.
-- El bloqueo ocurre después de 5 intentos fallidos consecutivos por correo.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE intentos_login (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    email           VARCHAR(100) NOT NULL,
    ip_origen       INET        NOT NULL,
    user_agent      TEXT,
    exitoso         BOOLEAN     NOT NULL,
    intentado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_intentos_login PRIMARY KEY (id)
);
CREATE INDEX idx_intentos_login_email_fecha ON intentos_login (email, intentado_en DESC);
COMMENT ON TABLE intentos_login IS
    'Registro de intentos de login. Index en (email, fecha) para consultas eficientes del contador de fallos. '
    'El bloqueo de 15 min se aplica tras 5 intentos fallidos consecutivos por correo (no por IP). '
    'Rate limiting adicional de 10 intentos/IP/minuto se implementa en capa de aplicación (Redis).';

-- ─────────────────────────────────────────────────────────────
-- TABLA: permisos_granulares_usuario
-- Permisos adicionales o restricciones sobre el rol base de un usuario.
-- Ej: un ANALISTA con acceso de solo lectura a reportes de Gerencia.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE permisos_granulares_usuario (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    usuario_id  UUID            NOT NULL,
    modulo      VARCHAR(50)     NOT NULL,   -- 'M-01', 'M-02', ..., 'M-06'
    accion      VARCHAR(100)    NOT NULL,   -- Nombre de la función/endpoint
    permitido   BOOLEAN         NOT NULL,   -- TRUE = conceder; FALSE = denegar explícitamente
    vigente     BOOLEAN         NOT NULL DEFAULT TRUE,
    otorgado_por_id UUID,
    fecha_otorgamiento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_permisos_granulares PRIMARY KEY (id),
    CONSTRAINT uq_permiso_por_usuario_modulo_accion UNIQUE (usuario_id, modulo, accion),
    CONSTRAINT fk_pg_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_pg_otorgador FOREIGN KEY (otorgado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: historial_contrasenas
-- Hashes de las últimas 5 contraseñas por usuario.
-- Previene la reutilización de contraseñas recientes.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historial_contrasenas (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    usuario_id      UUID        NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,  -- bcrypt hash de la contraseña antigua
    cambiada_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_historial_contrasenas PRIMARY KEY (id),
    CONSTRAINT fk_hc_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE INDEX idx_historial_contrasenas_usuario ON historial_contrasenas (usuario_id, cambiada_en DESC);
COMMENT ON TABLE historial_contrasenas IS
    'Almacena los bcrypt hashes de las últimas 5 contraseñas. '
    'Al cambiar contraseña, comparar contra estos hashes y rechazar si coincide con alguno.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: documentos_empleado
-- Expediente documental digital. Archivos cifrados (AES-256) en almacenamiento.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE documentos_empleado (
    id                  UUID                        NOT NULL DEFAULT gen_random_uuid(),
    empleado_id         UUID                        NOT NULL,
    categoria           tipo_documento_expediente   NOT NULL,
    tipo_documento      VARCHAR(100)                NOT NULL,   -- De catálogo predefinido por categoría
    nombre_archivo      VARCHAR(255)                NOT NULL,
    url_almacenamiento  TEXT                        NOT NULL,   -- URL interna (nunca pública directamente)
    hash_sha256         VARCHAR(64)                 NOT NULL,   -- Integridad del archivo original
    tamano_bytes        INTEGER                     NOT NULL CHECK (tamano_bytes > 0),
    formato_mime        VARCHAR(50)                 NOT NULL,
    fecha_vigencia      DATE,                                   -- NULL para documentos sin vencimiento
    estado              VARCHAR(20)                 NOT NULL DEFAULT 'VIGENTE',  -- VIGENTE, VENCIDO, PENDIENTE
    eliminado           BOOLEAN                     NOT NULL DEFAULT FALSE,      -- Soft delete (requerimiento legal)
    motivo_eliminacion  TEXT,
    fecha_carga         TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    cargado_por_id      UUID,
    CONSTRAINT pk_documentos_empleado PRIMARY KEY (id),
    CONSTRAINT fk_de_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_de_usuario FOREIGN KEY (cargado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT ck_de_tamano CHECK (tamano_bytes <= 10485760)   -- Máx 10 MB por archivo
);
COMMENT ON TABLE documentos_empleado IS
    'Expediente documental. Archivos cifrados con AES-256 en almacenamiento. '
    'URL pública generada con firma temporal (TTL 1h) solo al momento de descarga. '
    'Eliminación: soft-delete (eliminado=TRUE). Los archivos físicos se conservan por requerimiento legal.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: solicitudes_self_service
-- Solicitudes de actualización de datos enviadas por los empleados desde el portal.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE solicitudes_self_service (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    empleado_id         UUID            NOT NULL,
    tipo_solicitud      VARCHAR(50)     NOT NULL DEFAULT 'ACTUALIZACION_DATOS',
    campos_solicitados  JSONB           NOT NULL DEFAULT '{}'::JSONB,   -- { campo: valor_nuevo }
    estado              VARCHAR(20)     NOT NULL DEFAULT 'PENDIENTE',   -- PENDIENTE, APROBADA, RECHAZADA
    revisado_por_id     UUID,
    comentarios         TEXT,
    fecha_solicitud     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    fecha_resolucion    TIMESTAMPTZ,
    CONSTRAINT pk_solicitudes_ss PRIMARY KEY (id),
    CONSTRAINT fk_ss_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ss_revisor FOREIGN KEY (revisado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: retornos_bancarios
-- Gestión de pagos devueltos por el banco (cuenta inexistente, bloqueada, etc.).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE retornos_bancarios (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    planilla_id         UUID        NOT NULL,
    empleado_id         UUID        NOT NULL,
    motivo_banco        TEXT        NOT NULL,
    accion_tomada       VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',   -- PENDIENTE, CUENTA_CORREGIDA, CHEQUE_EMITIDO, PAGO_MANUAL
    nueva_cuenta        TEXT,                   -- Si accion=CUENTA_CORREGIDA (cifrada)
    fecha_retorno       DATE        NOT NULL,
    procesado_en        TIMESTAMPTZ,
    procesado_por_id    UUID,
    CONSTRAINT pk_retornos PRIMARY KEY (id),
    CONSTRAINT fk_ret_planilla  FOREIGN KEY (planilla_id)  REFERENCES planillas(id)  ON DELETE RESTRICT,
    CONSTRAINT fk_ret_empleado  FOREIGN KEY (empleado_id)  REFERENCES empleados(id)  ON DELETE RESTRICT,
    CONSTRAINT fk_ret_procesador FOREIGN KEY (procesado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: integraciones_externas
-- Configuración de conexiones con ISSS (OIS), AFP (SEPP), bancos (ACH), SMTP, firma digital.
-- Credenciales almacenadas CIFRADAS (AES-256) nunca en texto plano.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE integraciones_externas (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid(),
    nombre                  VARCHAR(80) NOT NULL,
    tipo                    VARCHAR(30) NOT NULL,    -- 'BANCO_ACH', 'ISSS_OIS', 'AFP_SEPP', 'SMTP', 'FIRMA_DIGITAL'
    url_endpoint            TEXT,
    version_protocolo       VARCHAR(20),
    credenciales_cifradas   TEXT,                   -- AES-256; NUNCA en texto plano
    configuracion           JSONB       DEFAULT '{}'::JSONB,  -- Parámetros no sensibles
    activa                  BOOLEAN     NOT NULL DEFAULT FALSE,
    ultima_operacion_ok_at  TIMESTAMPTZ,
    estado_salud            VARCHAR(20) DEFAULT 'DESCONOCIDO',  -- OK, ERROR, DESCONOCIDO
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_integraciones PRIMARY KEY (id),
    CONSTRAINT uq_integraciones_nombre UNIQUE (nombre)
);
COMMENT ON TABLE integraciones_externas IS
    'credenciales_cifradas: cifrado AES-256 en capa de aplicación. NUNCA texto plano en base de datos. '
    'La bandera activa permite desactivar integraciones individualmente; el sistema procesa manualmente en ese caso.';

-- ─────────────────────────────────────────────────────────────
-- TABLA: log_integraciones
-- Historial de operaciones realizadas a través de cada integración.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE log_integraciones (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid(),
    integracion_id          UUID        NOT NULL,
    tipo_operacion          VARCHAR(50) NOT NULL,
    exitoso                 BOOLEAN     NOT NULL,
    registros_procesados    INTEGER     DEFAULT 0,
    mensaje_error           TEXT,
    detalle_tecnico         TEXT,       -- Solo visible para ADMIN
    tiempo_respuesta_ms     INTEGER,
    ejecutado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_log_integraciones PRIMARY KEY (id),
    CONSTRAINT fk_li_integracion FOREIGN KEY (integracion_id)
        REFERENCES integraciones_externas(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: checklist_aprobacion_planilla
-- Ítems del checklist de verificación que el aprobador debe completar antes de firmar.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE checklist_aprobacion_planilla (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    planilla_id     UUID        NOT NULL,
    item_codigo     VARCHAR(30) NOT NULL,
    descripcion     TEXT        NOT NULL,
    marcado         BOOLEAN     NOT NULL DEFAULT FALSE,
    marcado_por_id  UUID,
    marcado_en      TIMESTAMPTZ,
    CONSTRAINT pk_checklist PRIMARY KEY (id),
    CONSTRAINT uq_checklist_item UNIQUE (planilla_id, item_codigo),
    CONSTRAINT fk_ck_planilla FOREIGN KEY (planilla_id) REFERENCES planillas(id) ON DELETE CASCADE,
    CONSTRAINT fk_ck_usuario FOREIGN KEY (marcado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);


-- ============================================================================================================================
-- SECCIÓN 6: TABLA DE AUDITORÍA INMUTABLE (BITÁCORA)
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA: bitacora_auditoria
-- INMUTABLE: ningún usuario (incluyendo el ADMIN) puede modificar o eliminar registros.
-- Evidencia ante inspecciones del MTPS, ISSS, AFP o Ministerio de Hacienda.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE bitacora_auditoria (
    id                  UUID                    NOT NULL DEFAULT gen_random_uuid(),
    usuario_id          UUID,                               -- NULL si acción del sistema; SET NULL en soft-delete del usuario
    usuario_email       VARCHAR(100),                       -- Snapshot del email al momento del evento (para histórico)
    usuario_rol         tipo_rol_sistema,                   -- Snapshot del rol al momento del evento
    timestamp_evento    TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    direccion_ip        INET,
    user_agent          TEXT,
    modulo              VARCHAR(20),                        -- M-01 a M-06
    accion              tipo_accion_auditoria   NOT NULL,
    tabla_afectada      VARCHAR(100),
    registro_id         UUID,                               -- ID del registro afectado
    valor_anterior      JSONB,                              -- Estado antes del cambio (para UPDATE/DELETE)
    valor_nuevo         JSONB,                              -- Estado después del cambio (para INSERT/UPDATE)
    resultado           VARCHAR(20)             NOT NULL DEFAULT 'EXITOSO',  -- EXITOSO, FALLIDO, RECHAZADO
    nivel_criticidad    VARCHAR(10)             NOT NULL DEFAULT 'NORMAL',   -- NORMAL, ALTO, CRITICO
    detalle_adicional   TEXT,
    CONSTRAINT pk_bitacora PRIMARY KEY (id),
    CONSTRAINT fk_bit_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE SET NULL          -- ON DELETE SET NULL: el log se preserva aunque el usuario se elimine
);

-- Index de rendimiento para las consultas más frecuentes de auditoría
CREATE INDEX idx_bitacora_usuario       ON bitacora_auditoria (usuario_id,       timestamp_evento DESC);
CREATE INDEX idx_bitacora_tabla         ON bitacora_auditoria (tabla_afectada,   timestamp_evento DESC);
CREATE INDEX idx_bitacora_accion        ON bitacora_auditoria (accion,           timestamp_evento DESC);
CREATE INDEX idx_bitacora_criticidad    ON bitacora_auditoria (nivel_criticidad, timestamp_evento DESC);
CREATE INDEX idx_bitacora_timestamp     ON bitacora_auditoria (timestamp_evento  DESC);

COMMENT ON TABLE bitacora_auditoria IS
    '⚠️  TABLA INMUTABLE. Ningún usuario puede modificar ni eliminar sus registros. '
    'La capa de aplicación debe garantizar: INSERT-only. PROHIBIR UPDATE y DELETE a nivel de permisos de BD. '
    'Conservación mínima: 10 años (igual a la obligación legal de conservación de planillas). '
    'Es evidencia legal ante MTPS, ISSS, AFP y MH. El hash SHA-256 de exportaciones confirma integridad.';

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN Y TRIGGER: Prevención de modificaciones en la bitácora
-- Hace cumplir la inmutabilidad a nivel de base de datos.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_bitacora_proteger_inmutabilidad()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'VIOLACIÓN DE INMUTABILIDAD: La tabla bitacora_auditoria es de solo escritura. '
        'Está prohibido modificar o eliminar registros de auditoría. '
        'Acción intentada: % | Tabla: bitacora_auditoria | Registro: %',
        TG_OP, OLD.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bitacora_no_update
    BEFORE UPDATE ON bitacora_auditoria
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_proteger_inmutabilidad();

CREATE TRIGGER trg_bitacora_no_delete
    BEFORE DELETE ON bitacora_auditoria
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_proteger_inmutabilidad();

COMMENT ON FUNCTION fn_bitacora_proteger_inmutabilidad IS
    'Trigger de protección: lanza EXCEPTION ante cualquier intento de UPDATE o DELETE en bitacora_auditoria. '
    'Aplica incluso para el superusuario de PostgreSQL a menos que se desactive manualmente (operación CRÍTICA).';

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN: Cálculo de ISR mensual (helper reutilizable)
-- Implementa la fórmula de tramos del Art. 37 Ley ISR.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_calcular_isr_mensual(
    p_renta_imponible   NUMERIC,
    p_parametro_id      UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_tramo     RECORD;
    v_isr       NUMERIC(10,2) := 0.00;
BEGIN
    IF p_renta_imponible <= 0 THEN
        RETURN 0.00;
    END IF;

    SELECT INTO v_tramo *
    FROM tramos_isr
    WHERE parametro_legal_id = p_parametro_id
      AND limite_inferior <= p_renta_imponible
      AND (limite_superior IS NULL OR p_renta_imponible <= limite_superior)
    ORDER BY numero_tramo
    LIMIT 1;

    IF FOUND THEN
        v_isr := v_tramo.cuota_fija +
                 ((p_renta_imponible - v_tramo.exceso_calculado_sobre) * v_tramo.tasa_marginal);
        RETURN ROUND(GREATEST(v_isr, 0.00), 2);
    END IF;

    RETURN 0.00;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_calcular_isr_mensual IS
    'Calcula la retención mensual de ISR aplicando la tabla de tramos vigente (Art. 37 Ley ISR). '
    'Retorna NUMERIC(10,2) redondeado a 2 decimales. Sin uso de REAL ni DOUBLE PRECISION.';

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN: Obtener parámetro legal vigente en una fecha dada
-- Crucial para recálculos históricos (usa los parámetros de su época).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_parametro_vigente_en_fecha(p_fecha DATE)
RETURNS UUID AS $$
    SELECT id
    FROM parametros_legales
    WHERE fecha_vigencia_desde <= p_fecha
      AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= p_fecha)
    ORDER BY fecha_vigencia_desde DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION fn_parametro_vigente_en_fecha IS
    'Retorna el UUID del parametro_legal vigente en la fecha indicada. '
    'El motor de cálculo DEBE usar esta función para garantizar el principio de inmutabilidad retroactiva.';


-- ============================================================================================================================
-- SECCIÓN 7: DML DE CARGA INICIAL (SEMILLAS / INSERTS MAESTROS)
-- Esta sección carga los datos mínimos para que el sistema sea funcional al ejecutarse por primera vez.
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- SEMILLA: Catálogo de Bancos de El Salvador
-- ─────────────────────────────────────────────────────────────
INSERT INTO bancos (codigo, nombre, codigo_ach, formato_cuenta) VALUES
    ('AGRIC', 'Banco Agrícola S.A.',                   'AGRI', '20 dígitos'),
    ('DAVIVIENDA', 'Banco Davivienda Salvadoreño',     'DAVI', '14 dígitos'),
    ('BAC', 'BAC Credomatic S.A.',                     'BACC', '10 dígitos'),
    ('PROMERICA', 'Banco Promerica S.A.',               'PROM', '13 dígitos'),
    ('G&T', 'Banco G&T Continental S.A.',              'GTCO', '11 dígitos'),
    ('AZUL', 'Banco Azul de El Salvador S.A.',         'AZUL', '13 dígitos'),
    ('BANCO_UNO', 'Banco Uno S.A.',                    'UNO1', '14 dígitos'),
    ('ATLACATL', 'Banco Atlacatl S.A.',                'ATLA', '12 dígitos');

-- ─────────────────────────────────────────────────────────────
-- SEMILLA: Parámetros Legales Vigentes 2026
-- Fuentes: Ley del Seguro Social, Ley SAP, Ley ISR, Decreto de Salarios Mínimos
-- IMPORTANTE: Verificar y actualizar con los decretos oficiales más recientes antes de producción.
-- ─────────────────────────────────────────────────────────────
INSERT INTO parametros_legales (
    descripcion_cambio, decreto_norma_origen,
    tasa_isss_laboral, tasa_isss_patronal, tope_cotizacion_isss,
    tasa_afp_laboral, tasa_afp_patronal,
    tasa_insaforp, empleados_minimos_insaforp,
    fecha_vigencia_desde, fecha_vigencia_hasta, estado
) VALUES (
    'Parámetros base vigentes 2026 — Carga inicial del sistema',
    'Ley ISSS Art. 29; Ley SAP Arts. 16/38; Ley ISR Art. 37; Decreto salarios mínimos vigente',
    0.0300,     -- 3.00% ISSS laboral
    0.0750,     -- 7.50% ISSS patronal
    1000.00,    -- Tope cotización ISSS: $1,000.00/mes
    0.0725,     -- 7.25% AFP laboral
    0.0875,     -- 8.75% AFP patronal
    0.0100,     -- 1.00% INSAFORP
    10,
    '2026-01-01',
    NULL,       -- NULL = actualmente vigente
    'VIGENTE'
);

-- Tramos ISR Mensuales (Art. 37 Ley ISR — Tabla MH vigente 2026)
-- NOTA: Verificar con el portal del Ministerio de Hacienda antes de producción.
WITH p AS (SELECT id FROM parametros_legales WHERE estado = 'VIGENTE' LIMIT 1)
INSERT INTO tramos_isr (
    parametro_legal_id, numero_tramo,
    limite_inferior, limite_superior,
    cuota_fija, tasa_marginal, exceso_calculado_sobre
)
SELECT p.id, tramo, li, ls, cf, tm, es FROM p,
(VALUES
    (1,    0.00,   472.00,   0.00, 0.0000,    0.00),   -- 0% hasta $472.00
    (2,  472.01,   895.24,   0.00, 0.1000,  472.00),   -- $0 + 10% s/exceso $472
    (3,  895.25,  2038.10,  42.32, 0.2000,  895.24),   -- $42.32 + 20% s/exceso $895.24
    (4, 2038.11,    NULL,  271.19, 0.3000, 2038.10)    -- $271.19 + 30% s/exceso $2,038.10
) AS t(tramo, li, ls, cf, tm, es);

-- Salarios Mínimos por Sector (vigentes 2026)
-- NOTA: Confirmar con decretos del Ministerio de Trabajo antes de producción.
WITH p AS (SELECT id FROM parametros_legales WHERE estado = 'VIGENTE' LIMIT 1)
INSERT INTO salarios_minimos_sector (parametro_legal_id, sector, salario_mensual)
SELECT p.id, sector::tipo_sector_laboral, monto FROM p,
(VALUES
    ('COMERCIO',      365.00),
    ('INDUSTRIA',     359.16),
    ('SERVICIOS',     365.00),
    ('AGROPECUARIO',  274.22),
    ('OTROS',         359.16)
) AS t(sector, monto);

-- ─────────────────────────────────────────────────────────────
-- SEMILLA: Estructura Organizacional Base
-- ─────────────────────────────────────────────────────────────
INSERT INTO areas (codigo, nombre, descripcion, nivel) VALUES
    ('EMP',     'Empresa',                      'Nivel raíz de la organización',         1),
    ('RRHH',    'Recursos Humanos',             'Gestión del talento humano y nómina',   2),
    ('FIN',     'Finanzas y Contabilidad',      'Control financiero y tributario',       2),
    ('GER',     'Gerencia General',             'Dirección estratégica',                 2),
    ('OPS',     'Operaciones',                  'Área operativa principal',              2),
    ('SIT',     'Sistemas y Tecnología',        'Infraestructura y desarrollo TI',       2),
    ('VEN',     'Ventas y Comercial',           'Gestión de ventas y clientes',          2);

-- Actualizar áreas padre (excepto la raíz)
UPDATE areas SET area_padre_id = (SELECT id FROM areas WHERE codigo = 'EMP')
WHERE codigo IN ('RRHH','FIN','GER','OPS','SIT','VEN');

-- ─────────────────────────────────────────────────────────────
-- SEMILLA: Bandas Salariales Base
-- ─────────────────────────────────────────────────────────────
INSERT INTO bandas_salariales (nombre, sector, puntuacion_min, puntuacion_max, salario_minimo, salario_midpoint, salario_maximo) VALUES
    ('Banda 1 — Operativo Básico',      'COMERCIO',  100, 199,   365.00,   450.00,   600.00),
    ('Banda 2 — Operativo Calificado',  'COMERCIO',  200, 299,   500.00,   700.00,   900.00),
    ('Banda 3 — Técnico',               'COMERCIO',  300, 399,   700.00,  1000.00,  1300.00),
    ('Banda 4 — Profesional',           'COMERCIO',  400, 499,  1000.00,  1500.00,  2200.00),
    ('Banda 5 — Jefatura',              'COMERCIO',  500, 599,  1500.00,  2200.00,  3200.00),
    ('Banda 6 — Gerencia',              'COMERCIO',  600, 699,  2500.00,  3800.00,  5500.00),
    ('Banda 7 — Dirección',             'COMERCIO',  700, 999,  4000.00,  6500.00, 12000.00);

-- ─────────────────────────────────────────────────────────────
-- SEMILLA: Usuario Administrador por Defecto
-- CONTRASEÑA: Admin@2026! (hash bcrypt simulado — CAMBIAR OBLIGATORIAMENTE en primer login)
-- El flag debe_cambiar_contrasena=TRUE fuerza el cambio en el primer acceso.
-- ─────────────────────────────────────────────────────────────
INSERT INTO usuarios (
    email,
    password_hash,
    primer_nombre,
    primer_apellido,
    rol,
    estado,
    debe_cambiar_contrasena
) VALUES (
    'admin@empresa.com.sv',
    -- Hash bcrypt factor 12 de la contraseña temporal 'Admin@2026!'
    -- ⚠️  ESTE HASH ES SOLO PARA CARGA INICIAL. Cambiar en primer login.
    '$2b$12$SimulatedHashForInitialSeedOnlyMustBeChangedOnFirstLogin',
    'Administrador',
    'Sistema',
    'ADMIN',
    'ACTIVO',
    TRUE    -- Fuerza cambio de contraseña en el primer login
);

-- ─────────────────────────────────────────────────────────────
-- SEMILLA: Integraciones Externas (desactivadas por defecto — configurar antes de usar)
-- ─────────────────────────────────────────────────────────────
INSERT INTO integraciones_externas (nombre, tipo, url_endpoint, activa) VALUES
    ('ISSS — Sistema OIS',          'ISSS_OIS',       'https://ois.isss.gob.sv',      FALSE),
    ('AFP Crecer — SEPP',           'AFP_SEPP',       'https://sepp.afpcrecer.com.sv', FALSE),
    ('AFP Confía — SEPP',           'AFP_SEPP',       'https://sepp.afpconfia.com.sv', FALSE),
    ('Banco Principal ACH',         'BANCO_ACH',       NULL,                           FALSE),
    ('Servidor SMTP Corporativo',   'SMTP',            NULL,                           FALSE),
    ('Servicio Firma Digital',      'FIRMA_DIGITAL',   NULL,                           FALSE);

-- ─────────────────────────────────────────────────────────────
-- SEMILLA: Perfil de Puesto base — Administrador del Sistema
-- Necesario para vincular el usuario admin con un empleado si se requiere
-- ─────────────────────────────────────────────────────────────
INSERT INTO perfiles_puesto (
    codigo, nombre_cargo, area_id, nivel_jerarquico,
    tipo_jornada_cargo, sector_laboral, plazas_presupuestadas, estado
)
SELECT
    'CARGO-001', 'Administrador del Sistema de Nómina',
    a.id, 'PROFESIONAL', 'DIURNA', 'SERVICIOS', 1, 'VIGENTE'
FROM areas a WHERE a.codigo = 'SIT';

-- ─────────────────────────────────────────────────────────────
-- REGISTRO INICIAL EN BITÁCORA
-- El primer evento de auditoría documenta la carga inicial del schema.
-- ─────────────────────────────────────────────────────────────
INSERT INTO bitacora_auditoria (
    usuario_email, accion, tabla_afectada,
    resultado, nivel_criticidad, detalle_adicional
) VALUES (
    'system@nomina-sv.init',
    'INSERT',
    'SISTEMA',
    'EXITOSO',
    'CRITICO',
    'Carga inicial del schema DDL/DML completada. Sistema de Nómina El Salvador v1.0. '
    'Usuario administrador creado: admin@empresa.com.sv — Cambio de contraseña obligatorio en primer login. '
    'Parámetros legales vigentes cargados al ' || NOW()::TEXT
);

-- ─────────────────────────────────────────────────────────────
-- AGREGAR FKs DIFERIDAS (resolver dependencias circulares)
-- ─────────────────────────────────────────────────────────────

-- parametros_legales.creado_por_usuario_id → usuarios
ALTER TABLE parametros_legales
    ADD CONSTRAINT fk_pl_creador
    FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL;

-- usuarios.empleado_id → empleados
ALTER TABLE usuarios
    ADD CONSTRAINT fk_usr_empleado
    FOREIGN KEY (empleado_id)
    REFERENCES empleados(id) ON DELETE SET NULL;

-- usuarios.creado_por_id → usuarios (self-reference)
ALTER TABLE usuarios
    ADD CONSTRAINT fk_usr_creador
    FOREIGN KEY (creado_por_id)
    REFERENCES usuarios(id) ON DELETE SET NULL;

-- vacaciones_empleado.liquidacion_id → liquidaciones (ya fue agregado previamente mediante ALTER TABLE)
-- perfiles_puesto.creado_por_id → usuarios (ya definido)

COMMIT;

-- ============================================================================================================================
-- FIN DEL SCRIPT
-- ============================================================================================================================
-- RESUMEN DE OBJETOS CREADOS:
--   • 22 tipos ENUM
--   •  2 funciones PL/pgSQL (fn_calcular_isr_mensual, fn_parametro_vigente_en_fecha)
--   •  2 triggers de inmutabilidad en bitacora_auditoria
--   • 35 tablas con PRIMARY KEY, FOREIGN KEY, CHECK y UNIQUE constraints
--   •  8 índices adicionales de rendimiento
--   • DML inicial: 8 bancos, parámetros legales 2026 (ISSS/AFP/ISR/salarios mínimos),
--     7 áreas organizacionales, 7 bandas salariales, 1 usuario ADMIN,
--     6 integraciones externas (inactivas), 1 perfil de puesto base.
--
-- PRÓXIMOS PASOS OBLIGATORIOS:
--   1. Cambiar el hash de contraseña del admin en primer login.
--   2. Verificar y actualizar parámetros legales con decretos oficiales vigentes.
--   3. Configurar credenciales de integraciones (ISSS, AFP, bancos, SMTP).
--   4. Crear un rol de PostgreSQL READ-ONLY para la bitácora_auditoria:
--      GRANT SELECT ON bitacora_auditoria TO rol_auditor;
--      REVOKE INSERT, UPDATE, DELETE ON bitacora_auditoria FROM PUBLIC;
--   5. Ejecutar ANALYZE en todas las tablas después de la carga inicial de datos de producción.
-- ============================================================================================================================

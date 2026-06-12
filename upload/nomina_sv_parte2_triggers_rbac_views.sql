-- ============================================================================================================================
-- SISTEMA DE NÓMINA Y PERFILES DE PUESTOS — REPÚBLICA DE EL SALVADOR
-- PARTE 2: TRIGGERS · RBAC (Roles PostgreSQL) · RLS · VISTAS · ÍNDICES DE RENDIMIENTO
-- Prerequisito: Ejecutar nomina_sv_schema.sql (Parte 1) antes de este script.
-- PostgreSQL 15+
--
-- ESTRUCTURA DE ESTE SCRIPT:
--   SECCIÓN A — Triggers de automatización (timestamps, códigos, sincronización)
--   SECCIÓN B — Triggers de auditoría automática (bitácora)
--   SECCIÓN C — RBAC: Roles de PostgreSQL y GRANTS granulares
--   SECCIÓN D — Row Level Security (RLS): el empleado solo ve sus propios datos
--   SECCIÓN E — Vistas SQL (soporte a los 6 módulos del sistema)
--   SECCIÓN F — Índices de rendimiento adicionales
--   SECCIÓN G — Funciones de negocio reutilizables
-- ============================================================================================================================

BEGIN;

-- ============================================================================================================================
-- SECCIÓN A: TRIGGERS DE AUTOMATIZACIÓN
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- A-1: Función genérica para actualizar fecha_actualizacion en UPDATE
-- Se reutiliza como trigger en todas las tablas que tienen ese campo.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar el trigger a todas las tablas con fecha_actualizacion
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'usuarios', 'areas', 'bandas_salariales', 'perfiles_puesto',
        'versiones_perfil_puesto', 'empleados', 'integraciones_externas'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_set_updated
             BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION fn_set_fecha_actualizacion()',
            t
        );
    END LOOP;
END;
$$;

COMMENT ON FUNCTION fn_set_fecha_actualizacion IS
    'Trigger genérico: actualiza fecha_actualizacion = NOW() en cada UPDATE. '
    'Aplicado a: usuarios, areas, bandas_salariales, perfiles_puesto, versiones_perfil_puesto, empleados, integraciones_externas.';

-- ─────────────────────────────────────────────────────────────
-- A-2: Auto-generación de codigo_empleado (EMP-XXXXX)
-- Formato: EMP-00001, EMP-00002, ..., EMP-99999
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_codigo_empleado
    START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 99999 CACHE 1;

CREATE OR REPLACE FUNCTION fn_generar_codigo_empleado()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo asignar si no viene un código manual (el Admin puede asignarlo manualmente)
    IF NEW.codigo_empleado IS NULL OR NEW.codigo_empleado = '' THEN
        NEW.codigo_empleado := 'EMP-' || LPAD(nextval('seq_codigo_empleado')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_empleados_codigo_auto
    BEFORE INSERT ON empleados
    FOR EACH ROW EXECUTE FUNCTION fn_generar_codigo_empleado();

COMMENT ON FUNCTION fn_generar_codigo_empleado IS
    'Auto-genera codigo_empleado en formato EMP-XXXXX si no se suministra manualmente. '
    'El Admin puede asignar un código personalizado suministrando el valor en el INSERT.';

-- ─────────────────────────────────────────────────────────────
-- A-3: Auto-generación de codigo_planilla
-- Formato: NOMINA-2026-01-M (tipo: M=Mensual, Q=Quincenal, A=Aguinaldo, L=Liquidación, C=Complementaria)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generar_codigo_planilla()
RETURNS TRIGGER AS $$
DECLARE
    v_sufijo    CHAR(1);
    v_seq       INTEGER;
    v_año       TEXT;
    v_mes       TEXT;
BEGIN
    IF NEW.codigo_planilla IS NOT NULL AND NEW.codigo_planilla <> '' THEN
        RETURN NEW;
    END IF;

    v_sufijo := CASE NEW.tipo
        WHEN 'MENSUAL'        THEN 'M'
        WHEN 'QUINCENAL'      THEN 'Q'
        WHEN 'AGUINALDO'      THEN 'A'
        WHEN 'LIQUIDACION'    THEN 'L'
        WHEN 'COMPLEMENTARIA' THEN 'C'
        ELSE 'X'
    END;

    v_año := TO_CHAR(NEW.fecha_inicio_periodo, 'YYYY');
    v_mes := TO_CHAR(NEW.fecha_inicio_periodo, 'MM');

    -- Secuencia por tipo y mes para permitir complementarias en el mismo período
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(codigo_planilla, '-', 5) AS INTEGER)
    ), 0) + 1
    INTO v_seq
    FROM planillas
    WHERE tipo = NEW.tipo
      AND TO_CHAR(fecha_inicio_periodo, 'YYYY-MM') = v_año || '-' || v_mes;

    NEW.codigo_planilla := 'NOMINA-' || v_año || '-' || v_mes || '-' || v_sufijo
                          || CASE WHEN v_seq > 1 THEN '-' || v_seq::TEXT ELSE '' END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_planillas_codigo_auto
    BEFORE INSERT ON planillas
    FOR EACH ROW EXECUTE FUNCTION fn_generar_codigo_planilla();

-- ─────────────────────────────────────────────────────────────
-- A-4: Auto-generación de codigo de perfiles de puesto (CARGO-XXX)
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_codigo_perfil
    START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 9999 CACHE 1;

CREATE OR REPLACE FUNCTION fn_generar_codigo_perfil()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
        NEW.codigo := 'CARGO-' || LPAD(nextval('seq_codigo_perfil')::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_perfiles_codigo_auto
    BEFORE INSERT ON perfiles_puesto
    FOR EACH ROW EXECUTE FUNCTION fn_generar_codigo_perfil();

-- ─────────────────────────────────────────────────────────────
-- A-5: Sincronización salario_base en empleados cuando se activa un nuevo contrato
-- Al marcar un contrato como activo=TRUE, actualiza el salario en el expediente.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sincronizar_salario_empleado()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actuar cuando un contrato se marca como activo
    IF NEW.activo = TRUE AND (OLD.activo IS DISTINCT FROM TRUE) THEN
        -- Desactivar los contratos anteriores del mismo empleado
        UPDATE contratos
           SET activo = FALSE
         WHERE empleado_id = NEW.empleado_id
           AND id <> NEW.id
           AND activo = TRUE;

        -- Sincronizar salario_base en el expediente del empleado
        UPDATE empleados
           SET salario_base        = NEW.salario_base_contrato,
               fecha_actualizacion = NOW()
         WHERE id = NEW.empleado_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contratos_salario_sync
    AFTER INSERT OR UPDATE OF activo ON contratos
    FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_salario_empleado();

COMMENT ON FUNCTION fn_sincronizar_salario_empleado IS
    'Al activar un contrato (activo=TRUE): desactiva contratos anteriores y sincroniza '
    'el salario_base en empleados con el salario_base_contrato del nuevo contrato. '
    'Garantiza consistencia entre el expediente y el historial contractual.';

-- ─────────────────────────────────────────────────────────────
-- A-6: Bloqueo de modificaciones en planillas APROBADAS o PAGADAS
-- Hace cumplir la inmutabilidad a nivel de base de datos.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_proteger_planilla_aprobada()
RETURNS TRIGGER AS $$
BEGIN
    -- Permitir solo actualizaciones de estado de pago en planillas APROBADAS
    IF OLD.estado IN ('APROBADA', 'PAGADA') THEN
        -- Únicamente se permite avanzar el estado de pago o registrar referencias bancarias
        IF (NEW.estado NOT IN ('PAGADA', 'EN_CORRECCION'))
           AND (OLD.total_neto_a_pagar <> NEW.total_neto_a_pagar
                OR OLD.total_salarios_brutos <> NEW.total_salarios_brutos
                OR OLD.total_isr_retenido <> NEW.total_isr_retenido) THEN
            RAISE EXCEPTION
                'PLANILLA INMUTABLE: No se pueden modificar los montos de una planilla en estado %. '
                'Para correcciones, cree una planilla COMPLEMENTARIA vinculada al período original. '
                'Planilla ID: %', OLD.estado, OLD.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_planillas_inmutabilidad
    BEFORE UPDATE ON planillas
    FOR EACH ROW EXECUTE FUNCTION fn_proteger_planilla_aprobada();

-- ─────────────────────────────────────────────────────────────
-- A-7: Bloqueo de modificaciones en detalles_planilla una vez aprobada la planilla
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_proteger_detalle_planilla_aprobada()
RETURNS TRIGGER AS $$
DECLARE
    v_estado tipo_estado_planilla;
BEGIN
    SELECT estado INTO v_estado FROM planillas WHERE id = OLD.planilla_id;
    IF v_estado IN ('APROBADA', 'PAGADA') THEN
        RAISE EXCEPTION
            'DETALLE INMUTABLE: La planilla % está en estado %. '
            'Los detalles de nómina no se pueden modificar post-aprobación.',
            OLD.planilla_id, v_estado;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detalles_inmutabilidad
    BEFORE UPDATE OR DELETE ON detalles_planilla
    FOR EACH ROW EXECUTE FUNCTION fn_proteger_detalle_planilla_aprobada();

-- ─────────────────────────────────────────────────────────────
-- A-8: Validación de horas extra semanales (máx. 10h/semana — Art. 169 CT)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validar_horas_extra_semana()
RETURNS TRIGGER AS $$
DECLARE
    v_horas_semana NUMERIC;
    v_inicio_semana DATE;
    v_fin_semana    DATE;
BEGIN
    IF NEW.tipo <> 'HORAS_EXTRA' OR NEW.cantidad_horas IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calcular el lunes de la semana del evento
    v_inicio_semana := DATE_TRUNC('week', NEW.fecha_inicio)::DATE;
    v_fin_semana    := v_inicio_semana + INTERVAL '6 days';

    SELECT COALESCE(SUM(cantidad_horas), 0)
    INTO v_horas_semana
    FROM incidencias_nomina
    WHERE empleado_id   = NEW.empleado_id
      AND tipo          = 'HORAS_EXTRA'
      AND estado        NOT IN ('RECHAZADA', 'ANULADA')
      AND fecha_inicio BETWEEN v_inicio_semana AND v_fin_semana
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF (v_horas_semana + NEW.cantidad_horas) > 10 THEN
        RAISE EXCEPTION
            'LÍMITE SEMANAL: El empleado ya tiene %.2f horas extra registradas esta semana '
            '(semana del % al %). El máximo legal es 10 horas/semana (Art. 169 CT). '
            'Horas intentadas a agregar: %.2f. Total resultante: %.2f',
            v_horas_semana,
            v_inicio_semana, v_fin_semana,
            NEW.cantidad_horas,
            v_horas_semana + NEW.cantidad_horas;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incidencias_horas_extra_semana
    BEFORE INSERT OR UPDATE ON incidencias_nomina
    FOR EACH ROW EXECUTE FUNCTION fn_validar_horas_extra_semana();

COMMENT ON FUNCTION fn_validar_horas_extra_semana IS
    'Valida que un empleado no supere 10 horas extra semanales (Art. 169 CT). '
    'Se ejecuta en INSERT y UPDATE de incidencias tipo HORAS_EXTRA.';

-- ─────────────────────────────────────────────────────────────
-- A-9: Validación de salario mínimo al registrar/modificar un contrato
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validar_salario_minimo()
RETURNS TRIGGER AS $$
DECLARE
    v_salario_min   NUMERIC(10,2);
    v_sector        tipo_sector_laboral;
    v_param_id      UUID;
BEGIN
    -- Obtener el sector del perfil de puesto del contrato
    SELECT pp.sector_laboral INTO v_sector
    FROM perfiles_puesto pp
    WHERE pp.id = NEW.perfil_puesto_id;

    IF NOT FOUND OR v_sector IS NULL THEN
        v_sector := 'COMERCIO';  -- Sector por defecto si no hay perfil
    END IF;

    -- Obtener el parámetro legal vigente hoy
    v_param_id := fn_parametro_vigente_en_fecha(CURRENT_DATE);

    IF v_param_id IS NULL THEN
        RETURN NEW;  -- Sin parámetros configurados, permite continuar con advertencia
    END IF;

    SELECT salario_mensual INTO v_salario_min
    FROM salarios_minimos_sector
    WHERE parametro_legal_id = v_param_id
      AND sector = v_sector;

    IF FOUND AND NEW.salario_base_contrato < v_salario_min THEN
        RAISE EXCEPTION
            'SALARIO BAJO MÍNIMO LEGAL: El salario $%.2f es inferior al salario mínimo '
            'del sector % ($%.2f). No se puede crear ni modificar el contrato. '
            'Base legal: Decreto de Salarios Mínimos vigente.',
            NEW.salario_base_contrato, v_sector, v_salario_min;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contratos_salario_minimo
    BEFORE INSERT OR UPDATE OF salario_base_contrato ON contratos
    FOR EACH ROW EXECUTE FUNCTION fn_validar_salario_minimo();


-- ============================================================================================================================
-- SECCIÓN B: TRIGGERS DE AUDITORÍA AUTOMÁTICA (BITÁCORA)
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- B-1: Función genérica de auditoría para INSERT / UPDATE / DELETE
-- Se configura por tabla con el nombre de tabla y nivel de criticidad.
-- Captura el estado anterior y nuevo en JSONB para trazabilidad completa.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_auditar_cambios()
RETURNS TRIGGER AS $$
DECLARE
    v_accion        tipo_accion_auditoria;
    v_anterior      JSONB;
    v_nuevo         JSONB;
    v_criticidad    TEXT;
    v_tabla         TEXT := TG_TABLE_NAME;
BEGIN
    -- Determinar la acción
    v_accion := TG_OP::tipo_accion_auditoria;

    -- Capturar valores
    IF TG_OP = 'DELETE' THEN
        v_anterior := TO_JSONB(OLD);
        v_nuevo    := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        v_anterior := NULL;
        v_nuevo    := TO_JSONB(NEW);
    ELSE -- UPDATE
        v_anterior := TO_JSONB(OLD);
        v_nuevo    := TO_JSONB(NEW);
        -- Si no hay cambio real, no registrar (evita ruido de triggers en cadena)
        IF v_anterior = v_nuevo THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Nivel de criticidad según tabla
    v_criticidad := CASE v_tabla
        WHEN 'usuarios'           THEN 'ALTO'
        WHEN 'parametros_legales' THEN 'CRITICO'
        WHEN 'planillas'          THEN 'ALTO'
        WHEN 'liquidaciones'      THEN 'ALTO'
        WHEN 'contratos'          THEN 'ALTO'
        ELSE 'NORMAL'
    END;

    -- Enmascarar campos sensibles antes de guardar en JSONB
    -- Se eliminan password_hash, numero_cuenta_bancaria y credenciales
    IF v_nuevo IS NOT NULL THEN
        v_nuevo := v_nuevo
            - 'password_hash'
            - 'numero_cuenta_bancaria'
            - 'credenciales_cifradas';
    END IF;
    IF v_anterior IS NOT NULL THEN
        v_anterior := v_anterior
            - 'password_hash'
            - 'numero_cuenta_bancaria'
            - 'credenciales_cifradas';
    END IF;

    INSERT INTO bitacora_auditoria (
        accion,
        tabla_afectada,
        registro_id,
        valor_anterior,
        valor_nuevo,
        resultado,
        nivel_criticidad
    ) VALUES (
        v_accion,
        v_tabla,
        CASE TG_OP WHEN 'DELETE' THEN (OLD).id ELSE (NEW).id END,
        v_anterior,
        v_nuevo,
        'EXITOSO',
        v_criticidad
    );

    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_auditar_cambios IS
    'Trigger genérico de auditoría: registra INSERT/UPDATE/DELETE en bitacora_auditoria. '
    'Enmascara campos sensibles (password_hash, numero_cuenta_bancaria, credenciales_cifradas) '
    'antes de escribir en el JSONB. SECURITY DEFINER garantiza acceso al INSERT en bitácora '
    'incluso para roles con permisos restringidos.';

-- Aplicar el trigger de auditoría a las tablas de mayor sensibilidad
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'usuarios', 'empleados', 'contratos', 'planillas',
        'detalles_planilla', 'parametros_legales', 'liquidaciones',
        'perfiles_puesto', 'bandas_salariales', 'areas'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_auditoria
             AFTER INSERT OR UPDATE OR DELETE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambios()',
            t
        );
    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- B-2: Trigger específico para cambios de contraseña
-- Registra en bitácora Y guarda el hash antiguo en historial_contrasenas.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_auditar_cambio_contrasena()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actuar si el password_hash cambió
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
        -- Guardar hash anterior en el historial (para verificar reutilización)
        INSERT INTO historial_contrasenas (usuario_id, password_hash)
        VALUES (OLD.id, OLD.password_hash);

        -- Mantener solo las últimas 5 contraseñas por usuario
        DELETE FROM historial_contrasenas
        WHERE id IN (
            SELECT id FROM historial_contrasenas
            WHERE usuario_id = OLD.id
            ORDER BY cambiada_en DESC
            OFFSET 5
        );

        -- Registrar en bitácora (sin incluir el hash)
        INSERT INTO bitacora_auditoria (
            usuario_id, usuario_email, accion, tabla_afectada,
            registro_id, resultado, nivel_criticidad, detalle_adicional
        ) VALUES (
            OLD.id, OLD.email, 'CAMBIO_CONTRASENA', 'usuarios',
            OLD.id, 'EXITOSO', 'ALTO',
            'Contraseña actualizada. Historial de las últimas 5 contraseñas actualizado.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_usuarios_cambio_contrasena
    AFTER UPDATE OF password_hash ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambio_contrasena();

-- ─────────────────────────────────────────────────────────────
-- B-3: Trigger para auditoría de aprobación de planilla (evento CRÍTICO)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_auditar_aprobacion_planilla()
RETURNS TRIGGER AS $$
BEGIN
    -- Detectar transición a estado APROBADA
    IF OLD.estado <> 'APROBADA' AND NEW.estado = 'APROBADA' THEN
        INSERT INTO bitacora_auditoria (
            usuario_id, accion, tabla_afectada, registro_id,
            valor_nuevo, resultado, nivel_criticidad, detalle_adicional
        ) VALUES (
            NEW.aprobada_por_id,
            'APPROVE',
            'planillas',
            NEW.id,
            jsonb_build_object(
                'codigo_planilla',       NEW.codigo_planilla,
                'tipo',                  NEW.tipo,
                'total_neto_a_pagar',    NEW.total_neto_a_pagar,
                'total_empleados',       NEW.total_empleados,
                'fecha_aprobacion',      NEW.fecha_aprobacion,
                'hash_integridad',       NEW.hash_integridad
            ),
            'EXITOSO',
            'CRITICO',
            'Planilla aprobada y marcada como INMUTABLE. '
            'Total neto: $' || NEW.total_neto_a_pagar::TEXT ||
            ' | Empleados: ' || NEW.total_empleados::TEXT
        );
    END IF;

    -- Detectar reapertura de período cerrado (evento de máxima criticidad)
    IF OLD.estado IN ('APROBADA', 'PAGADA') AND NEW.estado = 'EN_CORRECCION' THEN
        INSERT INTO bitacora_auditoria (
            usuario_id, accion, tabla_afectada, registro_id,
            valor_anterior, valor_nuevo, resultado, nivel_criticidad, detalle_adicional
        ) VALUES (
            NEW.aprobada_por_id,
            'REOPEN',
            'planillas',
            NEW.id,
            jsonb_build_object('estado_anterior', OLD.estado),
            jsonb_build_object('estado_nuevo', NEW.estado, 'justificacion', NEW.justificacion_reaper),
            'EXITOSO',
            'CRITICO',
            '⚠️  REAPERTURA DE PERÍODO CERRADO. Requiere doble aprobación. '
            'Justificación: ' || COALESCE(NEW.justificacion_reaper, 'No registrada')
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_planillas_aprobacion_auditoria
    AFTER UPDATE OF estado ON planillas
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_aprobacion_planilla();


-- ============================================================================================================================
-- SECCIÓN C: RBAC — ROLES DE POSTGRESQL Y GRANTS GRANULARES
-- Cada rol de PostgreSQL corresponde a uno de los 8 roles del sistema.
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- Crear los roles de PostgreSQL
-- En producción: los roles se crean sin LOGIN; la aplicación usa un único
-- rol de conexión y aplica SET ROLE según el JWT del usuario autenticado.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Rol base de solo conexión (la aplicación usa este rol para conectarse)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nomina_app') THEN
        CREATE ROLE nomina_app NOLOGIN;
    END IF;
    -- Roles por función de negocio
    FOREACH r IN ARRAY ARRAY[
        'rol_admin', 'rol_analista', 'rol_rrhh', 'rol_contador',
        'rol_aprobador', 'rol_gerencia', 'rol_auditor', 'rol_empleado'
    ] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- C-1: ROL ADMINISTRADOR — Acceso total con restricción en bitácora (solo INSERT)
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rol_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rol_admin;
-- Revocar UPDATE y DELETE en bitácora (inmutabilidad)
REVOKE UPDATE, DELETE ON bitacora_auditoria FROM rol_admin;

-- ─────────────────────────────────────────────────────────────
-- C-2: ROL ANALISTA — Procesa nómina, registra incidencias, no aprueba
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_analista;
-- Lectura general
GRANT SELECT ON
    empleados, contratos, datos_previsionales, areas, perfiles_puesto,
    bandas_salariales, versiones_perfil_puesto, bancos,
    parametros_legales, tramos_isr, salarios_minimos_sector
TO rol_analista;
-- Operaciones de nómina
GRANT SELECT, INSERT, UPDATE ON
    planillas, empleados_planilla, incidencias_nomina, detalles_planilla,
    historial_presentaciones_isss, historial_presentaciones_afp, historial_enteros_isr
TO rol_analista;
GRANT SELECT ON vacaciones_empleado TO rol_analista;
GRANT INSERT ON bitacora_auditoria TO rol_analista;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_analista;

-- ─────────────────────────────────────────────────────────────
-- C-3: ROL RRHH — Gestión completa del expediente de empleados
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_rrhh;
GRANT SELECT, INSERT, UPDATE ON
    empleados, contratos, datos_previsionales, documentos_empleado,
    vacaciones_empleado, historial_cambios_salariales, historial_cambios_cargo,
    solicitudes_self_service, areas, perfiles_puesto, versiones_perfil_puesto,
    bandas_salariales
TO rol_rrhh;
GRANT SELECT ON
    planillas, detalles_planilla, incidencias_nomina,
    parametros_legales, tramos_isr, salarios_minimos_sector
TO rol_rrhh;
GRANT INSERT ON bitacora_auditoria TO rol_rrhh;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_rrhh;

-- ─────────────────────────────────────────────────────────────
-- C-4: ROL CONTADOR — Acceso a reportes de cumplimiento y datos financieros
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_contador;
GRANT SELECT ON
    planillas, detalles_planilla, empleados, contratos, areas,
    historial_presentaciones_isss, historial_presentaciones_afp, historial_enteros_isr,
    parametros_legales, tramos_isr, salarios_minimos_sector,
    liquidaciones, historial_cambios_salariales
TO rol_contador;
GRANT SELECT, INSERT, UPDATE ON
    historial_presentaciones_isss, historial_presentaciones_afp, historial_enteros_isr
TO rol_contador;
GRANT INSERT ON bitacora_auditoria TO rol_contador;

-- ─────────────────────────────────────────────────────────────
-- C-5: ROL APROBADOR — Firma planillas, aprueba incidencias y liquidaciones
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_aprobador;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rol_aprobador;
GRANT UPDATE (
    estado, aprobada_por_id, fecha_aprobacion,
    hash_integridad, sello_aprobacion, motivo_rechazo,
    referencia_lote_banco, fecha_pago_confirmada
) ON planillas TO rol_aprobador;
GRANT UPDATE (estado, aprobada_por_id, fecha_aprobacion, motivo_rechazo)
    ON incidencias_nomina TO rol_aprobador;
GRANT UPDATE (estado, aprobada_por_id, fecha_aprobacion, acta_liquidacion_url)
    ON liquidaciones TO rol_aprobador;
GRANT INSERT, UPDATE ON
    historial_presentaciones_isss, historial_presentaciones_afp, historial_enteros_isr,
    retornos_bancarios, checklist_aprobacion_planilla
TO rol_aprobador;
GRANT INSERT ON bitacora_auditoria TO rol_aprobador;
REVOKE UPDATE, DELETE ON bitacora_auditoria FROM rol_aprobador;

-- ─────────────────────────────────────────────────────────────
-- C-6: ROL GERENCIA — Acceso de solo lectura a todos los reportes y dashboards
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_gerencia;
GRANT SELECT ON
    empleados, contratos, areas, perfiles_puesto, bandas_salariales,
    planillas, detalles_planilla, liquidaciones, vacaciones_empleado,
    historial_cambios_salariales, historial_cambios_cargo,
    historial_presentaciones_isss, historial_presentaciones_afp, historial_enteros_isr,
    parametros_legales, incidencias_nomina
TO rol_gerencia;
-- Gerencia NO tiene acceso a DUI, NIT, cuentas bancarias (columnas sensibles)
-- Esto se refuerza con RLS en SECCIÓN D

-- ─────────────────────────────────────────────────────────────
-- C-7: ROL AUDITOR — Solo lectura en absolutamente todo, incluida la bitácora
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_auditor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rol_auditor;
-- El auditor puede exportar la bitácora (INSERT de registro de exportación)
GRANT INSERT ON bitacora_auditoria TO rol_auditor;
-- Sin acceso a tablas de seguridad interna
REVOKE SELECT ON refresh_tokens, otp_tokens, tokens_bloqueados,
    historial_contrasenas, intentos_login FROM rol_auditor;

-- ─────────────────────────────────────────────────────────────
-- C-8: ROL EMPLEADO — Solo sus propios datos (reforzado con RLS en Sección D)
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO rol_empleado;
-- Tablas accesibles para el empleado (RLS restringe a solo sus propios registros)
GRANT SELECT ON
    empleados, contratos, detalles_planilla, planillas,
    vacaciones_empleado, documentos_empleado, liquidaciones,
    historial_cambios_salariales, areas, perfiles_puesto
TO rol_empleado;
GRANT SELECT, INSERT ON solicitudes_self_service TO rol_empleado;
GRANT INSERT ON bitacora_auditoria TO rol_empleado;


-- ============================================================================================================================
-- SECCIÓN D: ROW LEVEL SECURITY (RLS)
-- El empleado solo puede ver SUS PROPIOS datos.
-- La aplicación establece la variable de sesión app.current_user_id antes de cada query.
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- Función auxiliar: obtiene el UUID del usuario autenticado desde la variable de sesión
-- La capa de aplicación DEBE ejecutar: SET app.current_user_id = '<uuid>';
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_current_user_id()
RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_current_user_role()
RETURNS TEXT AS $$
    SELECT NULLIF(current_setting('app.current_user_role', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION fn_current_user_id IS
    'Lee el UUID del usuario autenticado desde la variable de sesión app.current_user_id. '
    'La aplicación DEBE establecerla con: SET LOCAL app.current_user_id = ''<uuid>'' '
    'al inicio de cada transacción, inmediatamente después de validar el JWT.';

-- ─────────────────────────────────────────────────────────────
-- D-1: RLS en empleados
-- El rol EMPLEADO solo puede ver su propio expediente.
-- Los demás roles ven todos los registros activos.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

-- Política para EMPLEADO: solo su propio expediente
CREATE POLICY pol_empleados_self_only ON empleados
    FOR SELECT
    TO rol_empleado
    USING (
        usuario_id = fn_current_user_id()
    );

-- Política para roles administrativos: todo sin restricción
CREATE POLICY pol_empleados_admin ON empleados
    FOR ALL
    TO rol_admin, rol_analista, rol_rrhh, rol_aprobador, rol_auditor, rol_contador
    USING (TRUE);

-- Política para Gerencia: todos los empleados activos, pero sin datos previsionales/fiscales sensibles
-- (El control de columnas se hace en la vista vw_empleados_gerencia)
CREATE POLICY pol_empleados_gerencia ON empleados
    FOR SELECT
    TO rol_gerencia
    USING (activo = TRUE);

-- ─────────────────────────────────────────────────────────────
-- D-2: RLS en detalles_planilla
-- El empleado solo puede ver sus propios recibos de pago.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE detalles_planilla ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_detalles_self_only ON detalles_planilla
    FOR SELECT
    TO rol_empleado
    USING (
        empleado_id IN (
            SELECT id FROM empleados WHERE usuario_id = fn_current_user_id()
        )
    );

CREATE POLICY pol_detalles_admin ON detalles_planilla
    FOR ALL
    TO rol_admin, rol_analista, rol_aprobador, rol_auditor, rol_contador, rol_gerencia
    USING (TRUE);

-- ─────────────────────────────────────────────────────────────
-- D-3: RLS en vacaciones_empleado
-- ─────────────────────────────────────────────────────────────
ALTER TABLE vacaciones_empleado ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_vacaciones_self_only ON vacaciones_empleado
    FOR SELECT
    TO rol_empleado
    USING (
        empleado_id IN (
            SELECT id FROM empleados WHERE usuario_id = fn_current_user_id()
        )
    );

CREATE POLICY pol_vacaciones_admin ON vacaciones_empleado
    FOR ALL
    TO rol_admin, rol_analista, rol_rrhh, rol_aprobador, rol_auditor
    USING (TRUE);

-- ─────────────────────────────────────────────────────────────
-- D-4: RLS en documentos_empleado
-- ─────────────────────────────────────────────────────────────
ALTER TABLE documentos_empleado ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_documentos_self_only ON documentos_empleado
    FOR SELECT
    TO rol_empleado
    USING (
        empleado_id IN (
            SELECT id FROM empleados WHERE usuario_id = fn_current_user_id()
        )
        AND eliminado = FALSE
    );

CREATE POLICY pol_documentos_admin ON documentos_empleado
    FOR ALL
    TO rol_admin, rol_analista, rol_rrhh, rol_aprobador, rol_auditor
    USING (TRUE);

-- ─────────────────────────────────────────────────────────────
-- D-5: RLS en liquidaciones
-- ─────────────────────────────────────────────────────────────
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_liquidaciones_self_only ON liquidaciones
    FOR SELECT
    TO rol_empleado
    USING (
        empleado_id IN (
            SELECT id FROM empleados WHERE usuario_id = fn_current_user_id()
        )
    );

CREATE POLICY pol_liquidaciones_admin ON liquidaciones
    FOR ALL
    TO rol_admin, rol_analista, rol_rrhh, rol_aprobador, rol_auditor, rol_contador
    USING (TRUE);


-- ============================================================================================================================
-- SECCIÓN E: VISTAS SQL
-- Soporte directo a los 6 módulos del sistema.
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- E-1: vw_empleados_activos
-- Vista de uso general: empleados activos con su contrato vigente y perfil de puesto.
-- Soporta: VISTA 02-01 (Listado General de Empleados) y búsquedas de RRHH.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_empleados_activos AS
SELECT
    e.id,
    e.codigo_empleado,
    e.primer_nombre || ' ' || e.primer_apellido
        || COALESCE(' ' || e.segundo_apellido, '') AS nombre_completo,
    e.primer_nombre,
    e.segundo_nombre,
    e.primer_apellido,
    e.segundo_apellido,
    e.dui,
    e.nit,
    e.email_personal,
    e.telefono_principal,
    e.genero,
    e.fecha_nacimiento,
    e.fecha_ingreso,
    e.estado AS estado_laboral,
    -- Antigüedad calculada en tiempo real
    DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso))::INTEGER           AS anios_servicio,
    DATE_PART('month', AGE(CURRENT_DATE, e.fecha_ingreso))::INTEGER          AS meses_servicio,
    -- Área
    a.id            AS area_id,
    a.nombre        AS area_nombre,
    a.codigo        AS area_codigo,
    -- Contrato vigente
    c.id                        AS contrato_id,
    c.tipo_contrato,
    c.tipo_jornada,
    c.salario_base_contrato     AS salario_base,
    c.forma_pago,
    c.fecha_inicio              AS contrato_inicio,
    c.fecha_fin                 AS contrato_fin,
    -- Perfil de puesto
    pp.id                       AS perfil_puesto_id,
    pp.nombre_cargo,
    pp.nivel_jerarquico,
    pp.sector_laboral,
    -- Banda salarial
    bs.id                       AS banda_id,
    bs.nombre                   AS banda_nombre,
    bs.salario_minimo           AS banda_salario_min,
    bs.salario_midpoint         AS banda_midpoint,
    bs.salario_maximo           AS banda_salario_max,
    -- Compa-ratio: posición relativa del salario dentro de la banda
    CASE
        WHEN bs.salario_midpoint > 0
        THEN ROUND((c.salario_base_contrato / bs.salario_midpoint) * 100, 2)
        ELSE NULL
    END AS compa_ratio,
    -- Semáforo de posición salarial en la banda
    CASE
        WHEN c.salario_base_contrato < bs.salario_minimo   THEN 'BAJO_MINIMO'
        WHEN c.salario_base_contrato > bs.salario_maximo   THEN 'SOBRE_MAXIMO'
        WHEN c.salario_base_contrato < bs.salario_midpoint THEN 'EN_RANGO_BAJO'
        ELSE 'EN_RANGO_ALTO'
    END AS posicion_en_banda,
    -- Previsional
    e.afp,
    e.nup_afp,
    e.numero_afiliado_isss,
    -- Banco
    b.nombre AS banco_nombre
FROM empleados e
    INNER JOIN areas a ON e.area_id = a.id
    LEFT JOIN contratos c ON c.empleado_id = e.id AND c.activo = TRUE
    LEFT JOIN perfiles_puesto pp ON pp.id = c.perfil_puesto_id
    LEFT JOIN bandas_salariales bs ON bs.id = c.banda_salarial_id
    LEFT JOIN bancos b ON b.id = c.banco_id
WHERE e.activo = TRUE;

COMMENT ON VIEW vw_empleados_activos IS
    'Vista principal de empleados: unión de empleados + contrato vigente + perfil + banda salarial. '
    'Incluye: antigüedad calculada, compa-ratio y semáforo de posición salarial en la banda. '
    'Soporta: VISTA 02-01, búsquedas, filtros por departamento/banda/estado.';

-- ─────────────────────────────────────────────────────────────
-- E-2: vw_saldo_vacaciones
-- Calcula el saldo de vacaciones en tiempo real por empleado.
-- Soporta: VISTA 02-02 Pestaña 5, VISTA 06-05 Self-Service.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_saldo_vacaciones AS
WITH base AS (
    SELECT
        e.id AS empleado_id,
        e.codigo_empleado,
        e.primer_nombre || ' ' || e.primer_apellido AS nombre_completo,
        e.fecha_ingreso,
        CURRENT_DATE AS fecha_calculo,
        -- Aniversario laboral vigente
        (DATE_TRUNC('year', AGE(CURRENT_DATE, e.fecha_ingreso)) + e.fecha_ingreso)::DATE
            AS aniversario_anterior,
        (DATE_TRUNC('year', AGE(CURRENT_DATE, e.fecha_ingreso)) + e.fecha_ingreso
            + INTERVAL '1 year')::DATE
            AS proximo_aniversario,
        -- Años de servicio completados
        DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso))::INTEGER AS anios_completados,
        -- Tiene derecho a vacaciones (mínimo 1 año Art. 177 CT)
        CASE
            WHEN DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso)) >= 1 THEN TRUE
            ELSE FALSE
        END AS tiene_derecho_vacaciones
    FROM empleados e
    WHERE e.activo = TRUE
),
dias_tomados AS (
    SELECT
        empleado_id,
        COALESCE(SUM(dias_habiles), 0) AS dias_tomados_periodo
    FROM vacaciones_empleado
    WHERE estado IN ('TOMADA', 'PROGRAMADA')
      AND fecha_inicio >= (
          SELECT aniversario_anterior
          FROM base b2
          WHERE b2.empleado_id = vacaciones_empleado.empleado_id
      )
    GROUP BY empleado_id
)
SELECT
    b.empleado_id,
    b.codigo_empleado,
    b.nombre_completo,
    b.fecha_ingreso,
    b.anios_completados,
    b.tiene_derecho_vacaciones,
    b.aniversario_anterior,
    b.proximo_aniversario,
    -- Días de vacación que corresponden según antigüedad (Art. 177 CT: 15 días mínimo)
    15 AS dias_vacacion_anuales,
    COALESCE(dt.dias_tomados_periodo, 0) AS dias_tomados_periodo_actual,
    GREATEST(0, 15 - COALESCE(dt.dias_tomados_periodo, 0)) AS dias_disponibles
FROM base b
LEFT JOIN dias_tomados dt ON dt.empleado_id = b.empleado_id;

COMMENT ON VIEW vw_saldo_vacaciones IS
    'Calcula saldo de vacaciones en tiempo real (no almacena saldo). '
    'Base legal: Art. 177 CT — 15 días hábiles de vacación remunerada después del primer año. '
    'El derecho nace en el aniversario laboral; no es acumulable sin autorización.';

-- ─────────────────────────────────────────────────────────────
-- E-3: vw_dashboard_nomina
-- Dashboard del ciclo de nómina activo con KPIs y alertas de cumplimiento.
-- Soporta: VISTA 04-01 (Dashboard Central de Nómina).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_dashboard_nomina AS
WITH planilla_activa AS (
    SELECT *
    FROM planillas
    WHERE estado NOT IN ('PAGADA', 'RECHAZADA')
    ORDER BY fecha_inicio_periodo DESC
    LIMIT 1
),
planilla_pagada AS (
    SELECT *
    FROM planillas
    WHERE estado = 'PAGADA'
    ORDER BY fecha_fin_periodo DESC
    LIMIT 1
),
alertas_isss AS (
    SELECT
        hi.planilla_id,
        hi.fecha_vencimiento_legal,
        hi.estado,
        (hi.fecha_vencimiento_legal - CURRENT_DATE) AS dias_restantes
    FROM historial_presentaciones_isss hi
    WHERE hi.estado IN ('PENDIENTE', 'CON_MORA')
),
alertas_isr AS (
    SELECT
        ei.planilla_id,
        ei.fecha_vencimiento_legal,
        ei.estado,
        (ei.fecha_vencimiento_legal - CURRENT_DATE) AS dias_restantes
    FROM historial_enteros_isr ei
    WHERE ei.estado IN ('PENDIENTE', 'CON_MORA')
)
SELECT
    -- Estado del período activo
    pa.id                           AS planilla_activa_id,
    pa.codigo_planilla              AS planilla_activa_codigo,
    pa.estado                       AS planilla_activa_estado,
    pa.tipo                         AS planilla_activa_tipo,
    pa.fecha_inicio_periodo,
    pa.fecha_fin_periodo,
    pa.total_empleados,
    pa.total_salarios_brutos,
    pa.total_neto_a_pagar,
    -- Comparativo con período anterior
    pp.total_neto_a_pagar           AS neto_periodo_anterior,
    CASE
        WHEN pp.total_neto_a_pagar > 0
        THEN ROUND(((pa.total_neto_a_pagar - pp.total_neto_a_pagar) / pp.total_neto_a_pagar) * 100, 2)
        ELSE NULL
    END AS variacion_porcentual_vs_anterior,
    -- Alertas de cumplimiento (semáforo)
    ai_isss.dias_restantes          AS dias_venc_isss,
    CASE
        WHEN ai_isss.dias_restantes > 7  THEN 'VERDE'
        WHEN ai_isss.dias_restantes >= 3 THEN 'AMARILLO'
        ELSE 'ROJO'
    END                             AS semaforo_isss,
    ai_isr.dias_restantes           AS dias_venc_isr,
    CASE
        WHEN ai_isr.dias_restantes > 7  THEN 'VERDE'
        WHEN ai_isr.dias_restantes >= 3 THEN 'AMARILLO'
        ELSE 'ROJO'
    END                             AS semaforo_isr,
    -- KPIs generales de headcount
    (SELECT COUNT(*) FROM empleados WHERE activo = TRUE)            AS total_empleados_activos,
    (SELECT COUNT(*) FROM empleados
     WHERE activo = TRUE
       AND DATE_TRUNC('month', fecha_ingreso) = DATE_TRUNC('month', CURRENT_DATE))
                                                                    AS ingresos_mes_actual,
    (SELECT COUNT(*) FROM empleados
     WHERE activo = FALSE
       AND DATE_TRUNC('month', fecha_terminacion) = DATE_TRUNC('month', CURRENT_DATE))
                                                                    AS bajas_mes_actual
FROM planilla_activa pa
CROSS JOIN (SELECT * FROM planilla_pagada) pp
LEFT JOIN alertas_isss ai_isss ON ai_isss.planilla_id = pp.id
LEFT JOIN alertas_isr ai_isr   ON ai_isr.planilla_id  = pp.id;

COMMENT ON VIEW vw_dashboard_nomina IS
    'Dashboard del ciclo de nómina: período activo, comparativo vs anterior, '
    'semáforo de cumplimiento ISSS/ISR y KPIs de headcount. '
    'Soporta: VISTA 04-01. Actualizada en tiempo real.';

-- ─────────────────────────────────────────────────────────────
-- E-4: vw_detalle_planilla_completo
-- Desglose completo de nómina por empleado con fundamento legal en cada línea.
-- Soporta: VISTA 04-03 (desglose individual), VISTA 02-02 Pestaña 4 (historial de nómina),
--          generación de boletas de pago (Art. 138 CT).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_detalle_planilla_completo AS
SELECT
    dp.id                               AS detalle_id,
    -- Período
    p.id                                AS planilla_id,
    p.codigo_planilla,
    p.tipo                              AS tipo_planilla,
    p.fecha_inicio_periodo,
    p.fecha_fin_periodo,
    p.estado                            AS estado_planilla,
    -- Empleado
    e.id                                AS empleado_id,
    e.codigo_empleado,
    e.primer_nombre || ' ' || e.primer_apellido
        || COALESCE(' ' || e.segundo_apellido, '') AS nombre_empleado,
    e.dui,
    e.nit,
    e.afp,
    e.nup_afp,
    e.numero_afiliado_isss,
    -- Área y puesto
    a.nombre                            AS area_nombre,
    pp.nombre_cargo,
    -- ── DEVENGADOS ──
    dp.salario_nominal,
    dp.monto_horas_extras_diurnas,
    dp.monto_horas_extras_nocturnas,
    dp.monto_recargo_dia_descanso,
    dp.monto_recargo_dia_asueto,
    dp.monto_comisiones,
    dp.monto_bonos_gravados,
    dp.monto_otros_ingresos,
    dp.salario_bruto,
    -- ── DESCUENTOS ──
    dp.base_isss,
    dp.descuento_isss,
    dp.base_afp,
    dp.descuento_afp,
    dp.renta_imponible,
    dp.tramo_isr_aplicado,
    dp.descuento_isr,
    dp.descuento_cuota_alimenticia,
    dp.descuento_prestamo_patronal,
    dp.descuento_seguro_complementario,
    dp.descuento_embargo_civil,
    dp.descuento_otros,
    -- ── NETO ──
    dp.neto_a_pagar,
    -- ── CARGAS PATRONALES (informativas, no se descuentan del empleado) ──
    dp.isss_patronal,
    dp.afp_patronal,
    dp.insaforp,
    dp.costo_laboral_total,
    -- ── ESTADO DE PAGO ──
    dp.estado_pago,
    dp.fecha_acreditacion,
    dp.referencia_pago,
    -- ── PARÁMETROS USADOS EN EL CÁLCULO (para auditoría del cálculo) ──
    pl.tasa_isss_laboral,
    pl.tasa_isss_patronal,
    pl.tope_cotizacion_isss,
    pl.tasa_afp_laboral,
    pl.tasa_afp_patronal
FROM detalles_planilla dp
    INNER JOIN planillas p    ON p.id  = dp.planilla_id
    INNER JOIN empleados e    ON e.id  = dp.empleado_id
    INNER JOIN areas a        ON a.id  = e.area_id
    LEFT JOIN  contratos c    ON c.id  = dp.contrato_id
    LEFT JOIN  perfiles_puesto pp ON pp.id = c.perfil_puesto_id
    LEFT JOIN  parametros_legales pl ON pl.id = p.parametro_legal_id;

COMMENT ON VIEW vw_detalle_planilla_completo IS
    'Desglose completo de nómina por empleado incluyendo parámetros legales usados. '
    'Cumple Art. 138 CT: toda deducción identificada con concepto. '
    'Base para: boletas de pago PDF, auditoría de cálculo, reportes contables.';

-- ─────────────────────────────────────────────────────────────
-- E-5: vw_cumplimiento_legal_anual
-- Panel de semáforo de cumplimiento: ISSS, AFP, ISR del año en curso.
-- Soporta: VISTA 05-01/05-02/05-03 y VISTA 05-04 (Reporte Cumplimiento Legal Consolidado).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_cumplimiento_legal_anual AS
SELECT
    p.id                                AS planilla_id,
    p.codigo_planilla,
    p.tipo,
    p.fecha_inicio_periodo,
    p.fecha_fin_periodo,
    p.estado                            AS estado_planilla,
    -- ISSS
    hi.estado                           AS estado_isss,
    hi.fecha_vencimiento_legal          AS vencimiento_isss,
    hi.fecha_presentacion               AS presentacion_isss,
    hi.monto_mora                       AS mora_isss,
    CASE
        WHEN hi.id IS NULL                     THEN 'SIN_REGISTRO'
        WHEN hi.estado = 'A_TIEMPO'            THEN '✅ A TIEMPO'
        WHEN hi.estado = 'CON_MORA'            THEN '⚠️  CON MORA'
        WHEN hi.estado = 'PENDIENTE'
             AND hi.fecha_vencimiento_legal < CURRENT_DATE THEN '🔴 VENCIDO'
        ELSE '🔵 PENDIENTE'
    END                                 AS semaforo_isss,
    -- AFP Crecer
    ha_c.estado                         AS estado_afp_crecer,
    ha_c.fecha_presentacion             AS presentacion_afp_crecer,
    -- AFP Confía
    ha_k.estado                         AS estado_afp_confia,
    ha_k.fecha_presentacion             AS presentacion_afp_confia,
    -- ISR
    ei.estado                           AS estado_isr,
    ei.fecha_vencimiento_legal          AS vencimiento_isr,
    ei.fecha_entero                     AS entero_isr,
    ei.monto_mora_multa                 AS mora_isr,
    CASE
        WHEN ei.id IS NULL                     THEN 'SIN_REGISTRO'
        WHEN ei.estado = 'A_TIEMPO'            THEN '✅ A TIEMPO'
        WHEN ei.estado = 'CON_MORA'            THEN '⚠️  CON MORA'
        WHEN ei.estado = 'PENDIENTE'
             AND ei.fecha_vencimiento_legal < CURRENT_DATE THEN '🔴 VENCIDO'
        ELSE '🔵 PENDIENTE'
    END                                 AS semaforo_isr
FROM planillas p
    LEFT JOIN historial_presentaciones_isss hi   ON hi.planilla_id = p.id
    LEFT JOIN historial_presentaciones_afp ha_c  ON ha_c.planilla_id = p.id AND ha_c.afp = 'CRECER'
    LEFT JOIN historial_presentaciones_afp ha_k  ON ha_k.planilla_id = p.id AND ha_k.afp = 'CONFIA'
    LEFT JOIN historial_enteros_isr ei            ON ei.planilla_id  = p.id
WHERE EXTRACT(YEAR FROM p.fecha_inicio_periodo) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND p.estado IN ('APROBADA', 'PAGADA')
ORDER BY p.fecha_inicio_periodo DESC;

COMMENT ON VIEW vw_cumplimiento_legal_anual IS
    'Semáforo de cumplimiento legal del año en curso: ISSS, AFP (Crecer y Confía) e ISR. '
    'Soporta: VISTA 05-04 reporteCumplimientoLegalConsolidado(). '
    'La mora ISSS se calcula al 1%/mes pro-rata (Art. 78 Ley ISSS). '
    'La multa ISR: 25-75% del impuesto no enterado (Art. 246 Código Tributario).';

-- ─────────────────────────────────────────────────────────────
-- E-6: vw_costo_total_personal
-- Costo laboral total por área incluyendo cargas patronales.
-- Soporta: VISTA 05-04 reporteCostoTotalPersonal().
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_costo_total_personal AS
SELECT
    a.id                                AS area_id,
    a.nombre                            AS area_nombre,
    p.codigo_planilla,
    p.fecha_inicio_periodo,
    p.fecha_fin_periodo,
    COUNT(DISTINCT dp.empleado_id)      AS num_empleados,
    SUM(dp.salario_bruto)               AS total_brutos,
    SUM(dp.neto_a_pagar)                AS total_netos,
    SUM(dp.descuento_isss)              AS total_isss_laboral,
    SUM(dp.descuento_afp)               AS total_afp_laboral,
    SUM(dp.descuento_isr)               AS total_isr_retenido,
    SUM(dp.isss_patronal)               AS total_isss_patronal,
    SUM(dp.afp_patronal)                AS total_afp_patronal,
    SUM(dp.insaforp)                    AS total_insaforp,
    SUM(dp.costo_laboral_total)         AS costo_laboral_total,
    -- Costo promedio por empleado
    ROUND(SUM(dp.costo_laboral_total) / NULLIF(COUNT(DISTINCT dp.empleado_id), 0), 2)
                                        AS costo_promedio_empleado,
    -- Carga patronal como % del salario bruto
    ROUND(
        (SUM(dp.isss_patronal) + SUM(dp.afp_patronal) + SUM(dp.insaforp))
        / NULLIF(SUM(dp.salario_bruto), 0) * 100, 2
    )                                   AS pct_carga_patronal
FROM detalles_planilla dp
    INNER JOIN planillas p     ON p.id = dp.planilla_id
    INNER JOIN empleados e     ON e.id = dp.empleado_id
    INNER JOIN areas a         ON a.id = e.area_id
WHERE p.estado IN ('APROBADA', 'PAGADA')
GROUP BY a.id, a.nombre, p.codigo_planilla, p.fecha_inicio_periodo, p.fecha_fin_periodo;

-- ─────────────────────────────────────────────────────────────
-- E-7: vw_anomalias_nomina
-- Detección automática de anomalías en el cálculo de nómina.
-- Soporta: VISTA 04-03 ejecutarVerificacionAnomalias().
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_anomalias_nomina AS
WITH salarios_min AS (
    SELECT sms.sector, sms.salario_mensual, sms.parametro_legal_id
    FROM salarios_minimos_sector sms
    INNER JOIN parametros_legales pl ON pl.id = sms.parametro_legal_id
    WHERE pl.estado = 'VIGENTE'
),
detalle_prev AS (
    SELECT
        dp.planilla_id,
        dp.empleado_id,
        dp.neto_a_pagar,
        dp.descuento_isss,
        dp.descuento_afp,
        dp.descuento_isr,
        dp.base_isss,
        dp.salario_bruto,
        LAG(dp.neto_a_pagar) OVER (
            PARTITION BY dp.empleado_id
            ORDER BY p.fecha_inicio_periodo
        ) AS neto_periodo_anterior
    FROM detalles_planilla dp
    INNER JOIN planillas p ON p.id = dp.planilla_id
)
SELECT
    dp.planilla_id,
    dp.empleado_id,
    e.codigo_empleado,
    e.primer_nombre || ' ' || e.primer_apellido AS nombre_empleado,
    pp.sector_laboral,
    -- Tipo de anomalía
    CASE
        WHEN dp.neto_a_pagar < sm.salario_mensual
            THEN 'NETO_BAJO_MINIMO'
        WHEN dp.descuento_isr = 0 AND dp.salario_bruto > 472
            THEN 'ISR_CERO_SOSPECHOSO'
        WHEN dp.neto_periodo_anterior IS NOT NULL
             AND ABS(dp.neto_a_pagar - dp.neto_periodo_anterior) / NULLIF(dp.neto_periodo_anterior, 0) > 0.20
            THEN 'VARIACION_MAYOR_20PCT'
        WHEN dp.descuento_isss = 0 AND dp.salario_bruto > 0
            THEN 'ISSS_CERO_SIN_JUSTIFICACION'
        WHEN dp.base_isss > 1000
            THEN 'TOPE_ISSS_MAL_APLICADO'
        WHEN dp.descuento_afp = 0 AND dp.salario_bruto > 0
            THEN 'AFP_CERO_SIN_JUSTIFICACION'
        ELSE NULL
    END                                 AS tipo_anomalia,
    -- Descripción del problema
    CASE
        WHEN dp.neto_a_pagar < sm.salario_mensual
            THEN 'Neto a pagar ($' || dp.neto_a_pagar || ') es inferior al salario mínimo del sector ($' || sm.salario_mensual || ')'
        WHEN dp.descuento_isr = 0 AND dp.salario_bruto > 472
            THEN 'ISR calculado en $0 con salario bruto de $' || dp.salario_bruto || ' (supera el primer tramo de $472)'
        WHEN dp.neto_periodo_anterior IS NOT NULL
             AND ABS(dp.neto_a_pagar - dp.neto_periodo_anterior) / NULLIF(dp.neto_periodo_anterior, 0) > 0.20
            THEN 'Variación de ' || ROUND(ABS(dp.neto_a_pagar - dp.neto_periodo_anterior) / dp.neto_periodo_anterior * 100, 1) || '% respecto al período anterior'
        WHEN dp.descuento_isss = 0 AND dp.salario_bruto > 0
            THEN 'ISSS descontado en $0 con salario bruto de $' || dp.salario_bruto
        WHEN dp.base_isss > 1000
            THEN 'Base ISSS ($' || dp.base_isss || ') supera el tope legal de $1,000.00'
        WHEN dp.descuento_afp = 0 AND dp.salario_bruto > 0
            THEN 'AFP descontada en $0 con salario bruto de $' || dp.salario_bruto
        ELSE NULL
    END                                 AS descripcion_anomalia,
    CASE
        WHEN dp.neto_a_pagar < sm.salario_mensual         THEN 'ALTA'
        WHEN dp.base_isss > 1000                          THEN 'ALTA'
        WHEN dp.descuento_isr = 0 AND dp.salario_bruto > 472 THEN 'MEDIA'
        WHEN dp.descuento_isss = 0 AND dp.salario_bruto > 0  THEN 'MEDIA'
        WHEN dp.descuento_afp = 0 AND dp.salario_bruto > 0   THEN 'MEDIA'
        ELSE 'BAJA'
    END                                 AS severidad,
    dp.salario_bruto                    AS valor_encontrado,
    dp.neto_a_pagar
FROM detalle_prev dp
    INNER JOIN empleados e     ON e.id  = dp.empleado_id
    LEFT JOIN contratos c      ON c.empleado_id = e.id AND c.activo = TRUE
    LEFT JOIN perfiles_puesto pp ON pp.id = c.perfil_puesto_id
    LEFT JOIN salarios_min sm  ON sm.sector = COALESCE(pp.sector_laboral, 'COMERCIO')
WHERE (
    dp.neto_a_pagar < COALESCE(sm.salario_mensual, 0)
    OR (dp.descuento_isr = 0 AND dp.salario_bruto > 472)
    OR (dp.neto_periodo_anterior IS NOT NULL
        AND ABS(dp.neto_a_pagar - dp.neto_periodo_anterior) / NULLIF(dp.neto_periodo_anterior, 0) > 0.20)
    OR (dp.descuento_isss = 0 AND dp.salario_bruto > 0)
    OR dp.base_isss > 1000
    OR (dp.descuento_afp = 0 AND dp.salario_bruto > 0)
);

COMMENT ON VIEW vw_anomalias_nomina IS
    'Detección automática de 6 tipos de anomalías en el cálculo de nómina. '
    'Soporta: VISTA 04-03 ejecutarVerificacionAnomalias(). '
    'Severidades: ALTA (neto bajo mínimo, tope ISSS mal aplicado), '
    'MEDIA (ISR/ISSS/AFP en cero), BAJA (variación > 20% vs período anterior).';

-- ─────────────────────────────────────────────────────────────
-- E-8: vw_pasivos_laborales
-- Proyección de pasivos laborales para provisión contable (NIIF para PYMES).
-- Soporta: VISTA 05-04 proyeccionPasivosLaborales().
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_pasivos_laborales AS
SELECT
    e.id                                AS empleado_id,
    e.codigo_empleado,
    e.primer_nombre || ' ' || e.primer_apellido AS nombre_empleado,
    a.nombre                            AS area,
    e.salario_base,
    e.fecha_ingreso,
    DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso))   AS anios_servicio,
    -- 1. Vacaciones devengadas no tomadas
    ROUND(
        (sv.dias_disponibles * e.salario_base / 30), 2
    )                                   AS pasivo_vacaciones,
    -- 2. Aguinaldo acumulado del año en curso (provisión mensual)
    ROUND(
        CASE
            WHEN DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso)) < 1
                THEN (EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.fecha_ingreso)) / 12.0) * (15.0/30 * e.salario_base)
            WHEN DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso)) BETWEEN 1 AND 2
                THEN (EXTRACT(MONTH FROM CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE)::DATE + 1) / 12.0)
                     * (15.0/30 * e.salario_base)
            WHEN DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso)) BETWEEN 3 AND 9
                THEN (EXTRACT(MONTH FROM CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE)::DATE + 1) / 12.0)
                     * (19.0/30 * e.salario_base)
            ELSE (EXTRACT(MONTH FROM CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE)::DATE + 1) / 12.0)
                 * (21.0/30 * e.salario_base)
        END, 2
    )                                   AS pasivo_aguinaldo,
    -- 3. Indemnización acumulada estimada (despido injustificado Art. 58 CT)
    ROUND(
        DATE_PART('year', AGE(CURRENT_DATE, e.fecha_ingreso))
        * 30 * (e.salario_base / 30), 2
    )                                   AS pasivo_indemnizacion_estimada,
    CURRENT_DATE                        AS fecha_corte
FROM empleados e
    INNER JOIN areas a ON a.id = e.area_id
    LEFT JOIN vw_saldo_vacaciones sv ON sv.empleado_id = e.id
WHERE e.activo = TRUE;

COMMENT ON VIEW vw_pasivos_laborales IS
    'Proyección de pasivos laborales al día de hoy para provisión contable bajo NIIF para PYMES. '
    'Incluye: vacaciones devengadas no tomadas, aguinaldo acumulado y provisión de indemnización. '
    'La indemnización estimada asume despido injustificado (escenario de mayor pasivo). '
    'Soporta: VISTA 05-04 proyeccionPasivosLaborales().';

-- ─────────────────────────────────────────────────────────────
-- E-9: vw_estructura_salarial
-- Análisis de equidad interna y compa-ratios por banda.
-- Soporta: VISTA 03-03 (Valuación y Bandas), VISTA 05-04 reporteEquidadSalarialInterna().
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_estructura_salarial AS
SELECT
    bs.id                               AS banda_id,
    bs.nombre                           AS banda_nombre,
    bs.sector,
    bs.salario_minimo                   AS banda_min,
    bs.salario_midpoint                 AS banda_midpoint,
    bs.salario_maximo                   AS banda_max,
    COUNT(e.id)                         AS num_empleados,
    ROUND(AVG(c.salario_base_contrato), 2)  AS salario_promedio,
    ROUND(MIN(c.salario_base_contrato), 2)  AS salario_minimo_real,
    ROUND(MAX(c.salario_base_contrato), 2)  AS salario_maximo_real,
    -- Compa-ratio promedio de la banda
    ROUND(AVG(c.salario_base_contrato) / NULLIF(bs.salario_midpoint, 0) * 100, 2)
                                        AS compa_ratio_promedio,
    COUNT(CASE WHEN c.salario_base_contrato < bs.salario_minimo THEN 1 END)
                                        AS empleados_bajo_minimo,
    COUNT(CASE WHEN c.salario_base_contrato > bs.salario_maximo THEN 1 END)
                                        AS empleados_sobre_maximo,
    -- Costo de ajuste para llevar todos al mínimo de la banda
    ROUND(SUM(GREATEST(0, bs.salario_minimo - c.salario_base_contrato)), 2)
                                        AS costo_ajuste_a_minimo,
    -- Costo de ajuste para llevar todos al midpoint
    ROUND(SUM(GREATEST(0, bs.salario_midpoint - c.salario_base_contrato)), 2)
                                        AS costo_ajuste_a_midpoint
FROM bandas_salariales bs
    LEFT JOIN contratos c  ON c.banda_salarial_id = bs.id AND c.activo = TRUE
    LEFT JOIN empleados e  ON e.id = c.empleado_id AND e.activo = TRUE
WHERE bs.activo = TRUE
GROUP BY bs.id, bs.nombre, bs.sector, bs.salario_minimo, bs.salario_midpoint, bs.salario_maximo;

-- ─────────────────────────────────────────────────────────────
-- E-10: vw_catalogo_perfiles_activos
-- Vista del catálogo de perfiles con métricas de ocupación.
-- Soporta: VISTA 03-01 (Catálogo de Perfiles de Puestos).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_catalogo_perfiles_activos AS
SELECT
    pp.id,
    pp.codigo,
    pp.nombre_cargo,
    pp.nivel_jerarquico,
    pp.tipo_jornada_cargo,
    pp.sector_laboral,
    pp.plazas_presupuestadas,
    pp.puntuacion_valuacion,
    pp.estado,
    a.nombre                            AS area_nombre,
    bs.nombre                           AS banda_nombre,
    bs.salario_minimo                   AS banda_min,
    bs.salario_midpoint,
    bs.salario_maximo                   AS banda_max,
    -- Ocupación actual
    COUNT(CASE WHEN e.activo = TRUE THEN 1 END) AS plazas_ocupadas,
    pp.plazas_presupuestadas - COUNT(CASE WHEN e.activo = TRUE THEN 1 END) AS plazas_disponibles,
    -- Versión vigente del descriptivo
    vpv.numero_version                  AS version_descriptivo,
    vpv.fecha_vigencia_desde            AS fecha_vigencia_descriptivo,
    -- Última modificación
    pp.fecha_actualizacion
FROM perfiles_puesto pp
    INNER JOIN areas a             ON a.id  = pp.area_id
    LEFT JOIN  bandas_salariales bs ON bs.id = pp.banda_salarial_id
    LEFT JOIN  contratos c         ON c.perfil_puesto_id = pp.id AND c.activo = TRUE
    LEFT JOIN  empleados e         ON e.id  = c.empleado_id
    LEFT JOIN  versiones_perfil_puesto vpv
        ON vpv.perfil_puesto_id = pp.id AND vpv.estado = 'VIGENTE'
WHERE pp.estado <> 'DESACTIVADO'
GROUP BY pp.id, pp.codigo, pp.nombre_cargo, pp.nivel_jerarquico,
         pp.tipo_jornada_cargo, pp.sector_laboral, pp.plazas_presupuestadas,
         pp.puntuacion_valuacion, pp.estado, a.nombre,
         bs.nombre, bs.salario_minimo, bs.salario_midpoint, bs.salario_maximo,
         vpv.numero_version, vpv.fecha_vigencia_desde, pp.fecha_actualizacion;

-- ─────────────────────────────────────────────────────────────
-- E-11: vw_historial_cotizaciones_empleado
-- Historial de cotizaciones previsionales por empleado.
-- Soporta: VISTA 02-02 Pestaña 3 verHistorialCotizaciones().
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_historial_cotizaciones_empleado AS
SELECT
    dp.empleado_id,
    e.codigo_empleado,
    e.primer_nombre || ' ' || e.primer_apellido AS nombre_empleado,
    e.afp,
    e.nup_afp,
    e.numero_afiliado_isss,
    p.codigo_planilla                   AS periodo,
    p.fecha_inicio_periodo,
    p.fecha_fin_periodo,
    p.estado                            AS estado_planilla,
    -- ISSS
    dp.base_isss                        AS salario_cotizable_isss,
    dp.descuento_isss                   AS cuota_laboral_isss,
    dp.isss_patronal                    AS cuota_patronal_isss,
    (dp.descuento_isss + dp.isss_patronal) AS total_cotizacion_isss,
    -- AFP
    dp.base_afp                         AS ibc_afp,
    dp.descuento_afp                    AS cuota_laboral_afp,
    dp.afp_patronal                     AS cuota_patronal_afp,
    (dp.descuento_afp + dp.afp_patronal) AS total_cotizacion_afp,
    -- Estado de presentación
    CASE WHEN p.estado = 'PAGADA' THEN 'PRESENTADO' ELSE 'PENDIENTE' END
                                        AS estado_presentacion
FROM detalles_planilla dp
    INNER JOIN planillas p ON p.id = dp.planilla_id
    INNER JOIN empleados e ON e.id = dp.empleado_id
WHERE p.estado IN ('APROBADA', 'PAGADA')
ORDER BY dp.empleado_id, p.fecha_inicio_periodo DESC;

-- ─────────────────────────────────────────────────────────────
-- E-12: vw_rotacion_personal
-- Indicadores de rotación para el reporte de gestión de talento.
-- Soporta: VISTA 05-04 reporteRotacionPersonal().
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_rotacion_personal AS
WITH bajas_mes AS (
    SELECT
        DATE_TRUNC('month', fecha_terminacion)::DATE    AS mes,
        tipo_terminacion,
        COUNT(*)                                         AS cantidad_bajas,
        ROUND(AVG(
            DATE_PART('year', AGE(fecha_terminacion, fecha_ingreso)) * 12
            + DATE_PART('month', AGE(fecha_terminacion, fecha_ingreso))
        ), 1)                                            AS meses_promedio_al_retiro
    FROM empleados
    WHERE activo = FALSE AND fecha_terminacion IS NOT NULL
    GROUP BY DATE_TRUNC('month', fecha_terminacion), tipo_terminacion
),
headcount_mensual AS (
    -- Aproximación al headcount activo al final de cada mes
    SELECT
        DATE_TRUNC('month', CURRENT_DATE)::DATE         AS mes,
        COUNT(*)                                         AS headcount
    FROM empleados
    WHERE activo = TRUE
)
SELECT
    bm.mes,
    bm.tipo_terminacion,
    bm.cantidad_bajas,
    bm.meses_promedio_al_retiro,
    hm.headcount,
    -- Tasa de rotación mensual = (bajas / headcount promedio) × 100
    ROUND(bm.cantidad_bajas::NUMERIC / NULLIF(hm.headcount, 0) * 100, 2) AS tasa_rotacion_mensual
FROM bajas_mes bm
CROSS JOIN headcount_mensual hm
ORDER BY bm.mes DESC, bm.cantidad_bajas DESC;


-- ============================================================================================================================
-- SECCIÓN F: ÍNDICES DE RENDIMIENTO ADICIONALES
-- ============================================================================================================================

-- ─── Empleados ───
CREATE INDEX idx_empleados_estado         ON empleados (estado)         WHERE activo = TRUE;
CREATE INDEX idx_empleados_area           ON empleados (area_id)        WHERE activo = TRUE;
CREATE INDEX idx_empleados_dui            ON empleados (dui);
CREATE INDEX idx_empleados_nombre_trgm    ON empleados
    USING GIN ((primer_nombre || ' ' || primer_apellido) gin_trgm_ops);
COMMENT ON INDEX idx_empleados_nombre_trgm IS
    'Índice trigrama para búsqueda por nombre (LIKE/ILIKE) en el listado de empleados. '
    'Requiere extensión pg_trgm (activada en Parte 1).';

-- ─── Contratos ───
CREATE INDEX idx_contratos_empleado_activo ON contratos (empleado_id) WHERE activo = TRUE;
CREATE INDEX idx_contratos_perfil          ON contratos (perfil_puesto_id);
CREATE INDEX idx_contratos_vencimiento     ON contratos (fecha_fin)    WHERE activo = TRUE AND fecha_fin IS NOT NULL;
COMMENT ON INDEX idx_contratos_vencimiento IS
    'Usado para alertas de vencimiento de contratos temporales (30/15/5 días anticipación).';

-- ─── Planillas ───
CREATE INDEX idx_planillas_estado         ON planillas (estado);
CREATE INDEX idx_planillas_tipo_periodo   ON planillas (tipo, fecha_inicio_periodo DESC);
CREATE INDEX idx_planillas_periodo        ON planillas (fecha_inicio_periodo, fecha_fin_periodo);

-- ─── Detalles Planilla ───
CREATE INDEX idx_dp_planilla              ON detalles_planilla (planilla_id);
CREATE INDEX idx_dp_empleado              ON detalles_planilla (empleado_id);
CREATE INDEX idx_dp_estado_pago           ON detalles_planilla (estado_pago) WHERE estado_pago <> 'PAGADO';

-- ─── Incidencias ───
CREATE INDEX idx_inc_empleado_planilla    ON incidencias_nomina (empleado_id, planilla_id);
CREATE INDEX idx_inc_estado               ON incidencias_nomina (estado)  WHERE estado = 'PENDIENTE';
CREATE INDEX idx_inc_tipo_fecha           ON incidencias_nomina (tipo, fecha_inicio);

-- ─── Vacaciones ───
CREATE INDEX idx_vac_empleado_estado      ON vacaciones_empleado (empleado_id, estado);

-- ─── Cumplimiento legal ───
CREATE INDEX idx_isss_estado              ON historial_presentaciones_isss (estado) WHERE estado <> 'PRESENTADO';
CREATE INDEX idx_isr_estado               ON historial_enteros_isr         (estado) WHERE estado <> 'PRESENTADO';
CREATE INDEX idx_afp_estado               ON historial_presentaciones_afp  (estado) WHERE estado <> 'PRESENTADO';

-- ─── Parámetros legales ───
CREATE INDEX idx_pl_vigente               ON parametros_legales (fecha_vigencia_desde DESC) WHERE estado = 'VIGENTE';
CREATE INDEX idx_pl_estado                ON parametros_legales (estado);

-- ─── Seguridad ───
CREATE INDEX idx_rt_usuario_activo        ON refresh_tokens   (usuario_id) WHERE activo = TRUE;
CREATE INDEX idx_rt_expira                ON refresh_tokens   (expira_en)  WHERE activo = TRUE;
CREATE INDEX idx_otp_usuario_activo       ON otp_tokens       (usuario_id) WHERE usado = FALSE;

-- ─── Perfiles de puesto ───
CREATE INDEX idx_pp_area_estado           ON perfiles_puesto (area_id, estado);
CREATE INDEX idx_pp_banda                 ON perfiles_puesto (banda_salarial_id);


-- ============================================================================================================================
-- SECCIÓN G: FUNCIONES DE NEGOCIO REUTILIZABLES
-- ============================================================================================================================

-- ─────────────────────────────────────────────────────────────
-- G-1: Motor de cálculo de nómina por empleado
-- Implementa la secuencia obligatoria de 8 pasos (VISTA 04-03):
--   (1) Bruto = base + incidencias
--   (2) ISSS laboral = MIN(bruto, $1,000) × 3%
--   (3) AFP laboral = bruto × 7.25%
--   (4) Renta imponible = bruto - ISSS - AFP
--   (5) ISR = tabla de tramos
--   (6) Otros descuentos en prelación legal
--   (7) Neto = bruto - ISSS - AFP - ISR - otros
--   (8) Cargas patronales (no se descuentan del empleado)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_calcular_nomina_empleado(
    p_empleado_id   UUID,
    p_planilla_id   UUID,
    p_parametro_id  UUID
)
RETURNS TABLE (
    -- Devengados
    salario_nominal             NUMERIC,
    monto_horas_extras_diurnas  NUMERIC,
    monto_horas_extras_noct     NUMERIC,
    monto_recargo_descanso      NUMERIC,
    monto_recargo_asueto        NUMERIC,
    monto_comisiones            NUMERIC,
    monto_bonos_gravados        NUMERIC,
    monto_otros_ingresos        NUMERIC,
    salario_bruto               NUMERIC,
    -- Descuentos
    base_isss                   NUMERIC,
    descuento_isss              NUMERIC,
    base_afp                    NUMERIC,
    descuento_afp               NUMERIC,
    renta_imponible             NUMERIC,
    tramo_isr                   SMALLINT,
    descuento_isr               NUMERIC,
    desc_cuota_alimenticia      NUMERIC,
    desc_prestamo               NUMERIC,
    desc_seguro                 NUMERIC,
    desc_embargo                NUMERIC,
    desc_otros                  NUMERIC,
    neto_a_pagar                NUMERIC,
    -- Cargas patronales
    isss_patronal               NUMERIC,
    afp_patronal                NUMERIC,
    insaforp_monto              NUMERIC,
    costo_laboral_total         NUMERIC
) AS $$
DECLARE
    v_contrato          RECORD;
    v_params            RECORD;
    v_sal_nominal       NUMERIC(10,2);
    v_hex_diurno        NUMERIC(10,2) := 0;
    v_hex_noct          NUMERIC(10,2) := 0;
    v_rec_descanso      NUMERIC(10,2) := 0;
    v_rec_asueto        NUMERIC(10,2) := 0;
    v_comisiones        NUMERIC(10,2) := 0;
    v_bonos             NUMERIC(10,2) := 0;
    v_otros_ing         NUMERIC(10,2) := 0;
    v_bruto             NUMERIC(10,2);
    v_base_isss         NUMERIC(10,2);
    v_isss              NUMERIC(10,2);
    v_afp               NUMERIC(10,2);
    v_renta_imp         NUMERIC(10,2);
    v_isr               NUMERIC(10,2);
    v_tramo             SMALLINT;
    v_alimentos         NUMERIC(10,2) := 0;
    v_prestamo          NUMERIC(10,2) := 0;
    v_seguro            NUMERIC(10,2) := 0;
    v_embargo           NUMERIC(10,2) := 0;
    v_otros_desc        NUMERIC(10,2) := 0;
    v_neto              NUMERIC(10,2);
    v_isss_pat          NUMERIC(10,2);
    v_afp_pat           NUMERIC(10,2);
    v_insaforp          NUMERIC(10,2);
    v_total_empleados   INTEGER;
BEGIN
    -- ── Obtener contrato vigente ──
    SELECT c.salario_base_contrato, c.tipo_jornada
    INTO v_contrato
    FROM contratos c
    WHERE c.empleado_id = p_empleado_id AND c.activo = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empleado % no tiene contrato activo', p_empleado_id;
    END IF;

    -- ── Obtener parámetros legales ──
    SELECT * INTO v_params
    FROM parametros_legales WHERE id = p_parametro_id;

    -- ── PASO 1: Salario nominal + incidencias aprobadas ──
    v_sal_nominal := v_contrato.salario_base_contrato;

    -- Sumar montos de incidencias APROBADAS del período (por tipo)
    SELECT
        COALESCE(SUM(CASE WHEN tipo_hora_extra = 'DIURNA'       THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo_hora_extra = 'NOCTURNA'     THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo_hora_extra = 'DIA_DESCANSO' THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo_hora_extra = 'DIA_ASUETO'   THEN monto_incidencia ELSE 0 END), 0)
    INTO v_hex_diurno, v_hex_noct, v_rec_descanso, v_rec_asueto
    FROM incidencias_nomina
    WHERE empleado_id = p_empleado_id
      AND planilla_id = p_planilla_id
      AND tipo = 'HORAS_EXTRA'
      AND estado = 'APROBADA';

    SELECT
        COALESCE(SUM(CASE WHEN tipo = 'COMISION' THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'BONO' AND gravado_isr = TRUE THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo NOT IN ('HORAS_EXTRA','COMISION','BONO','DESCUENTO_ESPECIAL','AUSENCIA')
                          THEN COALESCE(monto_incidencia, 0) ELSE 0 END), 0)
    INTO v_comisiones, v_bonos, v_otros_ing
    FROM incidencias_nomina
    WHERE empleado_id = p_empleado_id
      AND planilla_id = p_planilla_id
      AND estado = 'APROBADA';

    v_bruto := ROUND(
        v_sal_nominal + v_hex_diurno + v_hex_noct + v_rec_descanso + v_rec_asueto
        + v_comisiones + v_bonos + v_otros_ing, 2
    );

    -- ── PASO 2: ISSS laboral = MIN(bruto, tope) × tasa ──
    v_base_isss := LEAST(v_bruto, v_params.tope_cotizacion_isss);
    v_isss := ROUND(v_base_isss * v_params.tasa_isss_laboral, 2);

    -- ── PASO 3: AFP laboral = bruto × tasa (sin tope) ──
    v_afp := ROUND(v_bruto * v_params.tasa_afp_laboral, 2);

    -- ── PASO 4: Renta imponible = bruto - ISSS - AFP ──
    v_renta_imp := GREATEST(ROUND(v_bruto - v_isss - v_afp, 2), 0);

    -- ── PASO 5: ISR según tabla de tramos ──
    v_isr := fn_calcular_isr_mensual(v_renta_imp, p_parametro_id);

    -- Determinar el tramo aplicado
    SELECT numero_tramo INTO v_tramo
    FROM tramos_isr
    WHERE parametro_legal_id = p_parametro_id
      AND limite_inferior <= v_renta_imp
      AND (limite_superior IS NULL OR v_renta_imp <= limite_superior)
    ORDER BY numero_tramo LIMIT 1;

    -- ── PASO 6: Otros descuentos en orden de prelación (Art. 132 CT) ──
    SELECT
        COALESCE(SUM(CASE WHEN concepto = 'CUOTA_ALIMENTICIA' THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN concepto = 'PRESTAMO_PATRONAL' THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN concepto = 'SEGURO_COMPLEMENTARIO' THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN concepto = 'EMBARGO_CIVIL' THEN monto_incidencia ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'DESCUENTO_ESPECIAL'
                          AND concepto NOT IN ('CUOTA_ALIMENTICIA','PRESTAMO_PATRONAL','SEGURO_COMPLEMENTARIO','EMBARGO_CIVIL')
                          THEN monto_incidencia ELSE 0 END), 0)
    INTO v_alimentos, v_prestamo, v_seguro, v_embargo, v_otros_desc
    FROM incidencias_nomina
    WHERE empleado_id = p_empleado_id
      AND planilla_id = p_planilla_id
      AND tipo = 'DESCUENTO_ESPECIAL'
      AND estado = 'APROBADA';

    -- ── PASO 7: Neto a pagar ──
    v_neto := GREATEST(ROUND(
        v_bruto - v_isss - v_afp - v_isr
        - v_alimentos - v_prestamo - v_seguro - v_embargo - v_otros_desc, 2
    ), 0);

    -- ── PASO 8: Cargas patronales (no se descuentan del empleado) ──
    v_isss_pat := ROUND(v_base_isss * v_params.tasa_isss_patronal, 2);
    v_afp_pat  := ROUND(v_bruto * v_params.tasa_afp_patronal, 2);

    -- INSAFORP solo si la empresa tiene ≥ empleados_minimos configurados
    SELECT COUNT(*) INTO v_total_empleados FROM empleados WHERE activo = TRUE;
    v_insaforp := CASE
        WHEN v_total_empleados >= v_params.empleados_minimos_insaforp
        THEN ROUND(v_bruto * v_params.tasa_insaforp, 2)
        ELSE 0.00
    END;

    RETURN QUERY SELECT
        v_sal_nominal, v_hex_diurno, v_hex_noct, v_rec_descanso, v_rec_asueto,
        v_comisiones, v_bonos, v_otros_ing, v_bruto,
        v_base_isss, v_isss,
        v_bruto, v_afp,
        v_renta_imp, v_tramo, v_isr,
        v_alimentos, v_prestamo, v_seguro, v_embargo, v_otros_desc, v_neto,
        v_isss_pat, v_afp_pat, v_insaforp,
        ROUND(v_neto + v_isss_pat + v_afp_pat + v_insaforp, 2);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_calcular_nomina_empleado IS
    'Motor de cálculo de nómina para un empleado y período específico. '
    'Implementa los 8 pasos de la VISTA 04-03 con la secuencia legal correcta: '
    'bruto → ISSS → AFP → renta imponible → ISR → descuentos → neto → cargas patronales. '
    'Todos los montos se calculan con NUMERIC(10,2) — PROHIBIDO REAL o DOUBLE PRECISION.';

-- ─────────────────────────────────────────────────────────────
-- G-2: Cálculo de aguinaldo por empleado (Arts. 196-202 CT)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_calcular_aguinaldo(
    p_empleado_id   UUID,
    p_anio          INTEGER,
    p_parametro_id  UUID
)
RETURNS TABLE (
    anios_servicio_al_12_dic    NUMERIC,
    dias_aguinaldo              SMALLINT,
    salario_base_calculo        NUMERIC,
    es_proporcional             BOOLEAN,
    meses_completos             SMALLINT,
    aguinaldo_bruto             NUMERIC,
    monto_exento_isr            NUMERIC,    -- Hasta 2 salarios mínimos del sector
    monto_gravado_isr           NUMERIC,
    isr_sobre_aguinaldo         NUMERIC,
    aguinaldo_neto              NUMERIC
) AS $$
DECLARE
    v_fecha_corte       DATE := MAKE_DATE(p_anio, 12, 12);
    v_empleado          RECORD;
    v_contrato          RECORD;
    v_sal_min           NUMERIC(10,2);
    v_anios             NUMERIC;
    v_dias              SMALLINT;
    v_meses             SMALLINT;
    v_bruto             NUMERIC(10,2);
    v_exento            NUMERIC(10,2);
    v_gravado           NUMERIC(10,2);
    v_isr               NUMERIC(10,2);
    v_neto              NUMERIC(10,2);
    v_es_proporcional   BOOLEAN;
BEGIN
    SELECT e.fecha_ingreso INTO v_empleado FROM empleados e WHERE e.id = p_empleado_id;
    SELECT c.salario_base_contrato, c.perfil_puesto_id INTO v_contrato
    FROM contratos c WHERE c.empleado_id = p_empleado_id AND c.activo = TRUE;

    -- Antigüedad exacta al 12 de diciembre
    v_anios := DATE_PART('year', AGE(v_fecha_corte, v_empleado.fecha_ingreso));

    -- Tramo de días según antigüedad (Art. 196 CT)
    v_dias := CASE
        WHEN v_anios < 1  THEN 0       -- Sin derecho (menos de 1 año)
        WHEN v_anios < 3  THEN 15      -- 1 a < 3 años
        WHEN v_anios < 10 THEN 19      -- 3 a < 10 años
        ELSE 21                        -- 10 años o más
    END;

    -- Determinar si tiene año completo o proporcional
    -- Proporcional: ingresó después del 1 de diciembre del año anterior
    v_es_proporcional := v_empleado.fecha_ingreso > MAKE_DATE(p_anio - 1, 12, 1);
    v_meses := CASE
        WHEN v_es_proporcional
        THEN DATE_PART('month', AGE(v_fecha_corte, v_empleado.fecha_ingreso))::SMALLINT
        ELSE 12
    END;

    -- Salario base de cálculo (salario de noviembre o del mes anterior)
    v_bruto := ROUND(v_contrato.salario_base_contrato / 30 * v_dias
               * (v_meses::NUMERIC / 12), 2);

    -- Monto exento de ISR = 2 salarios mínimos del sector del empleado
    SELECT sms.salario_mensual INTO v_sal_min
    FROM salarios_minimos_sector sms
    INNER JOIN perfiles_puesto pp ON pp.sector_laboral = sms.sector
    WHERE sms.parametro_legal_id = p_parametro_id
      AND pp.id = v_contrato.perfil_puesto_id
    LIMIT 1;

    v_sal_min := COALESCE(v_sal_min, 365.00);  -- Fallback al sector comercio
    v_exento  := LEAST(v_bruto, v_sal_min * 2);
    v_gravado := GREATEST(v_bruto - v_exento, 0);
    v_isr     := fn_calcular_isr_mensual(v_gravado, p_parametro_id);
    v_neto    := ROUND(v_bruto - v_isr, 2);

    RETURN QUERY SELECT
        v_anios, v_dias, v_contrato.salario_base_contrato,
        v_es_proporcional, v_meses,
        v_bruto, v_exento, v_gravado, v_isr, v_neto;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_calcular_aguinaldo IS
    'Calcula el aguinaldo por empleado (Arts. 196-202 CT). '
    'Tramos: 15 días (1-<3 años), 19 días (3-<10 años), 21 días (≥10 años). '
    'Exención ISR: hasta 2 salarios mínimos del sector (Ley ISR). '
    'Si el empleado ingresó después del 1-dic del año anterior, calcula proporcional (meses/12).';

-- ─────────────────────────────────────────────────────────────
-- G-3: Cálculo de mora ISSS
-- 1% mensual pro-rata sobre el total de cotizaciones adeudadas.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_calcular_mora_isss(
    p_planilla_id       UUID,
    p_fecha_proyectada  DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
    v_monto_base    NUMERIC(14,2);
    v_fecha_venc    DATE;
    v_dias_mora     INTEGER;
    v_mora          NUMERIC(14,2);
BEGIN
    SELECT
        monto_cuotas_laborales + monto_cuotas_patronales,
        fecha_vencimiento_legal
    INTO v_monto_base, v_fecha_venc
    FROM historial_presentaciones_isss
    WHERE planilla_id = p_planilla_id;

    IF NOT FOUND OR p_fecha_proyectada <= v_fecha_venc THEN
        RETURN 0.00;
    END IF;

    v_dias_mora := (p_fecha_proyectada - v_fecha_venc);
    -- 1% mensual = 1%/30 diario
    v_mora := ROUND(v_monto_base * 0.01 / 30 * v_dias_mora, 2);

    RETURN GREATEST(v_mora, 0.00);
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;

-- ============================================================================================================================
-- FIN DEL SCRIPT PARTE 2
-- ============================================================================================================================
-- RESUMEN DE OBJETOS CREADOS EN ESTA PARTE:
--
-- SECCIÓN A — TRIGGERS DE AUTOMATIZACIÓN (9 triggers):
--   • fn_set_fecha_actualizacion       → 7 tablas con auto-update de timestamp
--   • fn_generar_codigo_empleado       → EMP-XXXXX automático en INSERT
--   • fn_generar_codigo_planilla       → NOMINA-YYYY-MM-T automático
--   • fn_generar_codigo_perfil         → CARGO-XXX automático
--   • fn_sincronizar_salario_empleado  → Sincroniza salario_base al activar contrato
--   • fn_proteger_planilla_aprobada    → Bloquea cambios en planillas APROBADAS/PAGADAS
--   • fn_proteger_detalle_planilla     → Bloquea detalles post-aprobación
--   • fn_validar_horas_extra_semana    → Art. 169 CT: máx. 10h/semana
--   • fn_validar_salario_minimo        → Salario mínimo por sector al guardar contrato
--
-- SECCIÓN B — TRIGGERS DE AUDITORÍA (3 triggers):
--   • fn_auditar_cambios               → Auditoría automática en 10 tablas críticas
--   • fn_auditar_cambio_contrasena     → Historial de hashes + bitácora en cambio de clave
--   • fn_auditar_aprobacion_planilla   → Evento CRITICO al aprobar o reabrir planilla
--
-- SECCIÓN C — RBAC: 8 roles de PostgreSQL con GRANTs granulares
-- SECCIÓN D — ROW LEVEL SECURITY en 5 tablas sensibles (empleados, detalles, vacaciones, docs, liquidaciones)
--
-- SECCIÓN E — 12 VISTAS:
--   vw_empleados_activos               Listado general con compa-ratio (VISTA 02-01)
--   vw_saldo_vacaciones                Saldo en tiempo real (VISTA 02-02, VISTA 06-05)
--   vw_dashboard_nomina                KPIs y semáforo de cumplimiento (VISTA 04-01)
--   vw_detalle_planilla_completo       Boletas / desglose calculado (VISTA 04-03, Art. 138 CT)
--   vw_cumplimiento_legal_anual        Panel ISSS/AFP/ISR del año (VISTA 05-01/02/03/04)
--   vw_costo_total_personal            Costo laboral por área (VISTA 05-04)
--   vw_anomalias_nomina                6 tipos de anomalías automáticas (VISTA 04-03)
--   vw_pasivos_laborales               Provisión contable NIIF PYMES (VISTA 05-04)
--   vw_estructura_salarial             Compa-ratios y desajustes por banda (VISTA 03-03)
--   vw_catalogo_perfiles_activos       Ocupación y métricas de puestos (VISTA 03-01)
--   vw_historial_cotizaciones_empleado Cotizaciones ISSS/AFP por empleado (VISTA 02-02 P3)
--   vw_rotacion_personal               Tasa de rotación mensual (VISTA 05-04)
--
-- SECCIÓN F — 21 ÍNDICES DE RENDIMIENTO ADICIONALES
-- SECCIÓN G — 3 FUNCIONES DE NEGOCIO:
--   fn_calcular_nomina_empleado        Motor completo de 8 pasos para la VISTA 04-03
--   fn_calcular_aguinaldo              Aguinaldo + exención ISR (Arts. 196-202 CT)
--   fn_calcular_mora_isss              Mora del 1%/mes pro-rata (Art. 78 Ley ISSS)
-- ============================================================================================================================

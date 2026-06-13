# Task 2: PDF Pay Stub (Boleta de Pago) Generation API

## Work Summary
Created two API endpoints for generating professional PDF pay stubs (boletas de pago) for the El Salvador Payroll System, conforming to Art. 138 of the Código de Trabajo.

## Files Created

### 1. `/src/lib/pdf-boleta.ts` — Shared PDF Generation Utility
- Professional single-page Letter-size PDF layout with emerald/green accent colors
- Compact two-column layout: Earnings (left) | Deductions (right)
- Sections: Company Header, Planilla Info, Employee Info, Devengados/Deducciones (side-by-side), Summary Box, Cargas Patronales, Legal Footer
- INSAFORP estimation from planilla total_cargas_patronales
- Exports `generateBoletaPdf()` for single and `generateBoletasPdf()` for multi-employee PDFs
- Types: `BoletaData`, `EmpleadoBoleta`, `DetalleBoleta`, `PlanillaBoleta`

### 2. `/src/app/api/nomina/planillas/[id]/boleta/route.ts` — Single Employee Pay Stub
- `GET /api/nomina/planillas/[id]/boleta?empleado_id=xxx`
- Auth: Bearer token required, EMPLEADO role can only access their own boleta
- Returns PDF with `Content-Disposition: attachment; filename="boleta-{codigo_empleado}-{codigo_planilla}.pdf"`

### 3. `/src/app/api/nomina/planillas/[id]/boletas/route.ts` — All Employees Pay Stubs
- `GET /api/nomina/planillas/[id]/boletas`
- Auth: Bearer token required, restricted to ADMIN/ANALISTA/APROBADOR/GERENCIA/AUDITOR roles
- Returns single PDF with one pay stub per page, ordered by employee last name
- Returns PDF with `Content-Disposition: attachment; filename="boletas-{codigo_planilla}.pdf"`

## Files Modified

### `/next.config.ts`
- Added `serverExternalPackages: ["pdfkit"]` to fix font file path resolution issue (pdfkit uses `__dirname` which gets mangled by Next.js bundler)

## Dependencies Installed
- `pdfkit@0.19.1` — PDF generation library
- `@types/pdfkit@0.17.6` — TypeScript type definitions

## Testing Results
- ✅ Single boleta: 200 OK, 1-page PDF (3.2KB)
- ✅ Multi-boleta: 200 OK, 7-page PDF (16.3KB) for 7 employees
- ✅ Missing empleado_id: 400 error
- ✅ Non-existent planilla: 404 error
- ✅ No auth token: 401 error
- ✅ EMPLEADO accessing own boleta: 200 OK
- ✅ EMPLEADO accessing all boletas: 403 Forbidden
- ✅ `bun run lint` passes with 0 errors

## PDF Content
Each pay stub includes:
1. **Company Header**: "Sistema de Nómina y Perfiles de Puestos — El Salvador"
2. **Planilla Info**: Código, Tipo, Período (2-column compact)
3. **Employee Info**: Nombre, Código, DUI, Puesto, Área (2-column compact)
4. **Devengados**: Salario Base, Horas Extra, Bonos, Comisiones, Total Devengado
5. **Deducciones**: ISSS Laboral (3%), AFP Laboral (7.25%), ISR, Cuota Alimenticia, Préstamo Patronal, Seguro Complementario, Otros Descuentos, Total Deducciones
6. **Resumen de Pago**: Total Bruto, Total Deducciones, NETO A PAGAR
7. **Cargas Patronales**: ISSS Patronal (7.5%), AFP Patronal (8.75%), INSAFORP (1%)
8. **Legal Footer**: "Documento generado conforme al Art. 138 del Código de Trabajo de El Salvador"

# Task 5+6: Payroll Approval Workflow + Aguinaldo/Liquidación PDF

## Agent: full-stack-developer
## Date: 2026-03-04

## Task Summary
Enhanced the payroll approval workflow with full lifecycle management and RBAC, and created PDF generation for Aguinaldo and Liquidación documents.

## Files Modified
- `prisma/schema.prisma` — Added `fecha_pago`, `referencia_pago`, `motivo_rechazo` fields to Planilla model
- `src/app/api/nomina/planillas/[id]/route.ts` — Complete rewrite with workflow state machine and RBAC
- `src/components/modules/PayrollApproval.tsx` — Complete rewrite with stepper, rejection, payment, timeline
- `src/components/modules/AguinaldoView.tsx` — Added PDF generation button per employee
- `src/components/modules/LiquidationView.tsx` — Added PDF generation button, fixed DialogTitle import

## Files Created
- `src/lib/pdf-aguinaldo.ts` — Aguinaldo PDF generator using PDFKit
- `src/lib/pdf-liquidacion.ts` — Liquidación PDF generator using PDFKit
- `src/app/api/nomina/aguinaldo/pdf/route.ts` — GET endpoint for aguinaldo PDF download
- `src/app/api/nomina/liquidaciones/pdf/route.ts` — GET endpoint for liquidación PDF download

## Key Decisions
1. Used BitacoraAuditoria for workflow timeline instead of creating a new model
2. Used motivo_rechazo field on Planilla for rejection reasons (not observaciones)
3. RBAC transition matrix defined as a constant in the API route
4. PDF generators follow the same pattern as existing pdf-boleta.ts (colors, layout, helpers)
5. Aguinaldo PDF calculates in real-time from DB data (not from previously saved results)

## Lint Status
✅ Passes cleanly with no errors

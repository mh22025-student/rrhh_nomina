# Sistema de Nómina y Perfiles de Puestos — El Salvador

## Project Status: ALL 6 MODULES BUILT, 26 VIEWS IMPLEMENTED

### Overall Progress: ~85% Complete
- Phase 0: Prisma Schema (35 tables) + Seed Data ✅
- Phase 1: Auth Module (login, JWT, RBAC, user management) ✅
- Phase 2: Employee Management (directory, detail, new employee, incidencias) ✅
- Phase 3: Job Profiles (catalog, salary bands) ✅
- Phase 4: Payroll Core (dashboard, periods, calculation engine, approval, dispersion, aguinaldo, liquidaciones) ✅
- Phase 5: Reports & Compliance (ISSS, AFP, ISR, talent reports) ✅
- Phase 6: Admin (legal parameters, org chart, integrations, audit log, self-service) ✅
- Phase 8: Dashboard connected to real API data ✅

## Architecture Decisions
- Using Next.js 16 with App Router (required)
- Using Prisma with SQLite (environment constraint) - business logic from PG triggers/functions moved to application layer
- All 26 views rendered as client-side navigation within single / route
- JWT-based authentication with role-based access control
- Payroll calculation engine implemented in TypeScript (matching legal formulas from Manual de Cumplimiento)

## Key Adaptations (PostgreSQL → SQLite)
- ENUMs → String types with validation
- UUID → cuid() auto-generated IDs  
- Triggers → Application-layer middleware/hooks
- Views → Prisma queries with equivalent logic
- RLS → API-level filtering by user role
- pgcrypto → bcrypt for passwords, crypto for OTP

## What's Working
1. **Login/Authentication** - JWT with access+refresh tokens, rate limiting, account lockout
2. **RBAC Sidebar** - Dynamic menu based on 6 user roles (ADMIN, ANALISTA, APROBADOR, GERENCIA, AUDITOR, EMPLEADO)
3. **Dashboard** - Real KPI data from APIs (7 employees, 7 profiles, compliance semaphore)
4. **Employee Management** - Full CRUD with search, filters, 6-tab detail view, incidencias with legal validation (Art. 169 CT)
5. **Payroll Calculation Engine** - 8-step engine following El Salvador law exactly (ISSS 3%, AFP 7.25%, ISR 4 tramos)
6. **Report Generation** - ISSS (OIS), AFP (SEPP), ISR (F-910) report data
7. **Admin Module** - Legal parameters with inmutabilidad, org chart, integrations, immutable audit log

## Demo Credentials
| Email | Password | Role |
|-------|----------|------|
| admin@nomina.gob.sv | Admin2026! | ADMIN |
| analista@nomina.gob.sv | Analista2026! | ANALISTA |
| aprobador@nomina.gob.sv | Aprobador2026! | APROBADOR |
| gerencia@nomina.gob.sv | Gerencia2026! | GERENCIA |
| auditor@nomina.gob.sv | Auditor2026! | AUDITOR |
| empleado@nomina.gob.sv | Empleado2026! | EMPLEADO |

## Seed Data
- 8 Banks (BAC, Banco Agrícola, Cuscatlán, etc.)
- 7 Areas with hierarchy (GG → RRHH, FIN, OPS, TEC → CON, VEN)
- 7 Salary Bands (Operativo $365-$600 through Alta Gerencia $3,500-$7,000)
- 7 Job Profiles (CARGO-001 through CARGO-007, estado: VIGENTE)
- 7 Employees (EMP-00001 through EMP-00007, with contracts and vacations)
- Legal Parameters 2026 with 4 ISR tramos and 6 sector minimum wages
- 5 External Integrations (BAC ACH, ISSS OIS, AFP CRECER, AFP CONFIA, SMTP)
- 43 Granular permissions for admin

## Unresolved Issues / Next Steps
1. **Payroll calculation needs end-to-end testing** - Run a full calculation for a period and verify amounts match legal formulas
2. **Frontend styling polish** - Some views may need better responsive design and more polished UI
3. **File generation** - OIS, SEPP, F-910 file generation needs actual file download implementation
4. **PDF generation** - Pay stubs (boletas), liquidation documents not yet generating PDFs
5. **Some API responses need consistency** - Bandas returns array, others return {data: [...]}
6. **Prisma relation names** - Fixed main issues (banda_salarial, perfil_puesto) but may be more in edge cases

## Priority Recommendations for Next Phase
1. Run full payroll calculation test with real data and verify ISR/ISSS/AFP amounts
2. Test all RBAC rules - verify each role can only access their authorized views
3. Implement PDF generation for pay stubs and legal documents
4. Polish UI details and ensure all views render correctly on mobile
5. Add more comprehensive error handling in API routes

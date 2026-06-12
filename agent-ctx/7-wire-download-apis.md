# Task 7: Wire PDF/CSV Download APIs into Frontend Components

## Agent: wire-download-apis
## Status: Completed

## Summary
Wired the existing PDF boleta and CSV report download API endpoints into 4 frontend components, replacing placeholder/client-side-only download logic with real API-backed downloads with loading states and toast notifications.

## Files Modified

1. **`/src/components/modules/SelfServicePortal.tsx`**
   - Added `downloadingId` state + `handleDownloadBoleta()` async function
   - PDF download from `/api/nomina/planillas/[id]/boleta?empleado_id=xxx`
   - Button shows spinner while downloading, disabled during download

2. **`/src/components/modules/IsssReport.tsx`**
   - Added `downloading` state + replaced `generateOIS()` with async API download
   - CSV download from `/api/reportes/isss/download?mes=&anio=`
   - Button shows spinner while downloading, disabled during download

3. **`/src/components/modules/AfpReport.tsx`**
   - Added `downloadingAdmin` state + replaced `generateSEPP()` with async API download
   - CSV download from `/api/reportes/afp/download?mes=&anio=`
   - Both CRECER/CONFIA buttons track individual loading states

4. **`/src/components/modules/IsrReport.tsx`**
   - Added `downloading` state + replaced `generateF910()` with async API download
   - CSV download from `/api/reportes/isr/download?mes=&anio=`
   - `generateConstancia()` kept unchanged (per-employee text file)

## Lint
- Clean, 0 errors

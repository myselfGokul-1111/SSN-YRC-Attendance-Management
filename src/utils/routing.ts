import { BatchYear, RoutingLookupResult, SheetName, Student } from '../types';

/**
 * Dynamic Dataset Routing Logic (Digital ID Mapping)
 * Evaluates the 2nd and 3rd digits of the Digital ID to route lookups
 * to the exact batch roster sheets.
 *
 * Rules from Specification:
 * - 2nd & 3rd Digit = 52 or 57 (or 51) -> Target Sheets: ['YRC 25', 'NSS 25', 'NSO 25', 'NReg 25'] (Batch 2025)
 * - 2nd & 3rd Digit = 41 or 47 (or 42) -> Target Sheets: ['YRC 24', 'NSS 24', 'NSO 24', 'NReg 24'] (Batch 2024)
 * - 2nd & 3rd Digit = 31 or 37 (or 32) -> Target Sheets: ['YRC 23', 'NSS 23', 'NSO 23', 'NReg 23'] (Batch 2023)
 */
export function routeDigitalId(digitalId: string): {
  batchCode: string;
  targetBatch: BatchYear | 'Unknown';
  targetSheets: SheetName[];
  reasoning: string;
} {
  const cleanId = digitalId.trim();

  if (!cleanId || cleanId.length < 3) {
    return {
      batchCode: '',
      targetBatch: 'Unknown',
      targetSheets: [],
      reasoning: 'Digital ID must be at least 3 characters long to extract 2nd and 3rd digits.',
    };
  }

  // Extract 2nd and 3rd digits (0-indexed: index 1 and 2)
  const batchCode = cleanId.substring(1, 3);
  let targetBatch: BatchYear | 'Unknown' = 'Unknown';
  let targetSheets: SheetName[] = [];
  let reasoning = '';

  // Match according to PCD Routing Rules
  if (['51', '52', '57'].includes(batchCode)) {
    targetBatch = '2025';
    targetSheets = ['YRC 25', 'NSS 25', 'NSO 25', 'NReg 25'];
    reasoning = `2nd & 3rd digits "${batchCode}" map directly to Batch 2025 rosters (YRC 25, NSS 25, NSO 25, NReg 25).`;
  } else if (['41', '42', '47'].includes(batchCode)) {
    targetBatch = '2024';
    targetSheets = ['YRC 24', 'NSS 24', 'NSO 24', 'NReg 24'];
    reasoning = `2nd & 3rd digits "${batchCode}" map directly to Batch 2024 rosters (YRC 24, NSS 24, NSO 24, NReg 24).`;
  } else if (['31', '32', '37'].includes(batchCode)) {
    targetBatch = '2023';
    targetSheets = ['YRC 23', 'NSS 23', 'NSO 23', 'NReg 23'];
    reasoning = `2nd & 3rd digits "${batchCode}" map directly to Batch 2023 rosters (YRC 23, NSS 23, NSO 23, NReg 23).`;
  } else {
    // Intelligent Fallback: Check first 2 digits if 2nd/3rd pattern is non-standard
    const prefix2 = cleanId.substring(0, 2);
    if (prefix2 === '25') {
      targetBatch = '2025';
      targetSheets = ['YRC 25', 'NSS 25', 'NSO 25', 'NReg 25'];
      reasoning = `Non-standard middle digits "${batchCode}"; fallback routed via batch prefix "25" to Batch 2025 rosters.`;
    } else if (prefix2 === '24') {
      targetBatch = '2024';
      targetSheets = ['YRC 24', 'NSS 24', 'NSO 24', 'NReg 24'];
      reasoning = `Non-standard middle digits "${batchCode}"; fallback routed via batch prefix "24" to Batch 2024 rosters.`;
    } else if (prefix2 === '23') {
      targetBatch = '2023';
      targetSheets = ['YRC 23', 'NSS 23', 'NSO 23', 'NReg 23'];
      reasoning = `Non-standard middle digits "${batchCode}"; fallback routed via batch prefix "23" to Batch 2023 rosters.`;
    } else {
      reasoning = `Unrecognized Digital ID format: digits "${batchCode}" do not match standard batch patterns (51/52/57, 41/47, 31/37).`;
    }
  }

  return {
    batchCode,
    targetBatch,
    targetSheets,
    reasoning,
  };
}

/**
 * Searches across the targeted sheets determined by dynamic routing
 * to retrieve the student profile.
 */
export function lookupStudentInRosters(
  digitalId: string,
  rosterSheets: Record<string, Student[]>
): RoutingLookupResult {
  const routing = routeDigitalId(digitalId);

  if (routing.targetSheets.length === 0) {
    return {
      student: null,
      batchCode: routing.batchCode,
      targetBatch: routing.targetBatch,
      targetSheets: [],
      reasoning: routing.reasoning,
    };
  }

  const cleanId = digitalId.trim().toLowerCase();

  // Search across the targeted batch sheets in priority order (e.g. YRC, NSS, NSO, NReg)
  for (const sheetName of routing.targetSheets) {
    const sheetData = rosterSheets[sheetName] || [];
    const found = sheetData.find(
      (s) =>
        s.digitalId.toLowerCase() === cleanId ||
        s.registerNumber.toLowerCase() === cleanId
    );

    if (found) {
      return {
        student: found,
        batchCode: routing.batchCode,
        targetBatch: routing.targetBatch,
        targetSheets: routing.targetSheets,
        sourceSheet: sheetName,
        reasoning: `${routing.reasoning} Match confirmed in [${sheetName}] for ${found.name} (${found.dept}).`,
      };
    }
  }

  // Broad fallback: In case student transferred to another sheet or was cross-enrolled
  for (const [sheetName, sheetData] of Object.entries(rosterSheets)) {
    if (sheetName === 'UPDATE' || routing.targetSheets.includes(sheetName as SheetName)) continue;
    const found = sheetData.find(
      (s) =>
        s.digitalId.toLowerCase() === cleanId ||
        s.registerNumber.toLowerCase() === cleanId
    );
    if (found) {
      return {
        student: found,
        batchCode: routing.batchCode,
        targetBatch: found.batch,
        targetSheets: routing.targetSheets,
        sourceSheet: sheetName as SheetName,
        reasoning: `Digital ID "${digitalId}" was located in [${sheetName}] via global fallback search.`,
      };
    }
  }

  return {
    student: null,
    batchCode: routing.batchCode,
    targetBatch: routing.targetBatch,
    targetSheets: routing.targetSheets,
    reasoning: `${routing.reasoning} Student not found in targeted sheets: ${routing.targetSheets.join(', ')}.`,
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { getGoogleAccessToken } from './auth';

export const DEFAULT_SPREADSHEET_ID = '1Ez_KbSH9hE2NCTrvOngxDfjf88KwAccgfpaJsVDFLgg';
let activeSpreadsheetId = DEFAULT_SPREADSHEET_ID;

export const TARGET_SPREADSHEET_ID = DEFAULT_SPREADSHEET_ID;

export function getActiveSpreadsheetId(): string {
  return activeSpreadsheetId;
}

export function setActiveSpreadsheetId(id: string) {
  if (id && id.trim()) {
    activeSpreadsheetId = id.trim();
  }
}

export interface SheetFetchResult {
  rawRows: Record<string, any>[];
  allocRows: Record<string, any>[];
  validationWeeklyNonFunnelRows?: Record<string, any>[];
  validationWeeklyFunnelRows?: Record<string, any>[];
  tabsFound: string[];
  lastFetchedAt: Date;
}

/**
 * Transforms a 2D array of rows from Google Sheets API or Excel into an array of JS objects
 */
export function matrixToObjects(matrix: any[][]): Record<string, any>[] {
  if (!matrix || matrix.length < 2) return [];
  const rawHeaders = matrix[0];
  const headers = rawHeaders.map((h, i) =>
    h !== undefined && h !== null && String(h).trim() !== '' ? String(h).trim() : `col_${i}`
  );

  const results: Record<string, any>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.length === 0) continue;
    const obj: Record<string, any> = {};
    let hasAnyData = false;
    for (let c = 0; c < headers.length; c++) {
      const val = row[c] !== undefined ? row[c] : null;
      obj[headers[c]] = val;
      if (val !== null && val !== '') hasAnyData = true;
    }
    if (hasAnyData) {
      results.push(obj);
    }
  }
  return results;
}

/**
 * Fetches Google Sheet values using the user's authenticated Google OAuth token
 */
async function fetchSheetWithOAuth(spreadsheetId: string, accessToken: string): Promise<SheetFetchResult> {
  // First get spreadsheet metadata to list available tabs
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text().catch(() => '');
    throw new Error(`Google Sheets API authentication error (${metaRes.status}): ${errText}`);
  }

  const metaData = await metaRes.json();
  const sheets: any[] = metaData.sheets || [];
  const sheetTitles: string[] = sheets.map((s) => s.properties?.title || '').filter(Boolean);

  let rawSheetName = sheetTitles.find((t) => /raw/i.test(t) && !/alloc/i.test(t)) || sheetTitles.find((t) => /data/i.test(t)) || sheetTitles[0];
  let allocSheetName = sheetTitles.find((t) => /alloc/i.test(t)) || sheetTitles[1] || sheetTitles[0];

  let rawRows: Record<string, any>[] = [];
  let allocRows: Record<string, any>[] = [];

  if (rawSheetName) {
    const rawValRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rawSheetName)}?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (rawValRes.ok) {
      const rawData = await rawValRes.json();
      rawRows = matrixToObjects(rawData.values || []);
    }
  }

  if (allocSheetName && allocSheetName !== rawSheetName) {
    const allocValRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(allocSheetName)}?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (allocValRes.ok) {
      const allocData = await allocValRes.json();
      allocRows = matrixToObjects(allocData.values || []);
    }
  }

  return {
    rawRows,
    allocRows,
    tabsFound: sheetTitles,
    lastFetchedAt: new Date(),
  };
}

/**
 * Connects to the operational data source (READ-ONLY)
 * Checks for user's Google OAuth Bearer token first, then falls back to server-side operational cache.
 */
export async function fetchLiveGoogleSheet(
  spreadsheetId: string = activeSpreadsheetId,
  _fetchValidationTabs: boolean = false
): Promise<SheetFetchResult> {
  const token = getGoogleAccessToken();

  if (token) {
    try {
      return await fetchSheetWithOAuth(spreadsheetId, token);
    } catch (authErr) {
      console.warn('OAuth direct Google Sheet fetch fell back to server endpoint:', authErr);
    }
  }

  // Fallback to server endpoint
  const url = `/api/data/operational?spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const message = errJson.error || errJson.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Failed to load operational dataset: ${message}`);
  }

  const data = await response.json();

  const rawRows: Record<string, any>[] = Array.isArray(data.rawRows) ? data.rawRows : [];
  const allocRows: Record<string, any>[] = Array.isArray(data.allocRows) ? data.allocRows : [];
  const tabsFound: string[] = Array.isArray(data.tabsFound) ? data.tabsFound : ['Raw_data', 'Allocation_Raw'];
  const lastFetchedAt: Date = data.lastFetchedAt ? new Date(data.lastFetchedAt) : new Date();

  return {
    rawRows,
    allocRows,
    tabsFound,
    lastFetchedAt,
  };
}

/**
 * Local workbook file parser for Excel/CSV file upload
 */
export async function parseUploadedFiles(files: File[]): Promise<SheetFetchResult> {
  let combinedRaw: Record<string, any>[] = [];
  let combinedAlloc: Record<string, any>[] = [];
  let tabsFound: string[] = [];

  for (const file of files) {
    const fileName = file.name.toLowerCase();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    for (const sheetName of workbook.SheetNames) {
      tabsFound.push(sheetName);
      const sheet = workbook.Sheets[sheetName];
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const nameLower = sheetName.toLowerCase();
      if (nameLower.includes('allocation') || fileName.includes('allocation')) {
        combinedAlloc = combinedAlloc.concat(json);
      } else if (nameLower.includes('raw') || fileName.includes('raw') || nameLower.includes('data')) {
        combinedRaw = combinedRaw.concat(json);
      } else {
        // Default to raw if ambiguous
        combinedRaw = combinedRaw.concat(json);
      }
    }
  }

  return {
    rawRows: combinedRaw,
    allocRows: combinedAlloc,
    tabsFound: Array.from(new Set(tabsFound)),
    lastFetchedAt: new Date(),
  };
}

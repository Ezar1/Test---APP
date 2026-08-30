/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RawDataRecord, AllocationRecord } from '../types';

const NULLISH = new Set(['nan', 'n/a', 'null', '-', '', 'undefined', '#n/a', '#value!', '#ref!']);

export function sanitizeValue(v: any): any {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (NULLISH.has(t.toLowerCase())) return null;
    return t;
  }
  if (typeof v === 'number') {
    return isNaN(v) ? null : v;
  }
  return v;
}

export function toNumber(v: any): number | null {
  const s = sanitizeValue(v);
  if (s === null) return null;
  if (typeof s === 'number') return s;
  const cleaned = String(s).replace(/[^0-9.\-]+/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function toDate(v: any): Date | null {
  const s = sanitizeValue(v);
  if (s === null) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  
  // Try parsing ISO, Excel serial dates or standard date strings
  if (typeof s === 'number') {
    // Excel serial date timestamp
    const excelEpoch = new Date(1899, 11, 30);
    const ms = s * 86400000;
    const d = new Date(excelEpoch.getTime() + ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(s).trim();
  // Handle DD/MM/YYYY or DD-MM-YYYY formats if standard new Date fails
  const parts = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns Monday 00:00:00 (local) of the week containing the given date
 */
export function getMondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function isDateInRange(target: Date | null, start: Date, end: Date): boolean {
  if (!target) return false;
  return target >= start && target <= end;
}

export interface NormalizationAudit {
  rawTotal: number;
  rawUsable: number;
  rawExcluded: number;
  rawSanitizedNulls: number;
  allocTotal: number;
  allocUsable: number;
  allocExcluded: number;
}

/**
 * Normalizes raw rows into strongly-typed RawDataRecord array
 */
export function normalizeRawData(rows: Record<string, any>[]): { records: RawDataRecord[]; audit: NormalizationAudit } {
  let excluded = 0;
  let sanitizedCount = 0;
  const records: RawDataRecord[] = [];

  rows.forEach((r, idx) => {
    // Check if any field had sentinel nullish values
    Object.values(r).forEach((val) => {
      if (typeof val === 'string' && NULLISH.has(val.trim().toLowerCase())) {
        sanitizedCount++;
      }
    });

    // Authoritative week cohort: walkin_week
    // Fallback to walkin_date or date only if walkin_week is present or parsable
    const rawWalkinWeek = r['walkin_week'] || r['Walkin_week'] || r['walkinWeek'];
    const walkinWeekParsed = toDate(rawWalkinWeek);

    if (!walkinWeekParsed) {
      excluded++;
      return;
    }

    const monday = getMondayOf(walkinWeekParsed);
    const dateDisplayParsed = toDate(r['date'] || r['walkin_date'] || r['date_of_walkin']) || monday;

    const identity = sanitizeValue(r['final_lead_mapping']) ||
                     sanitizeValue(r['lead_id']) ||
                     sanitizeValue(r['phone_number']) ||
                     `rec_${idx}`;

    const uniqueTag = toNumber(r['unique_walkin_tag'] ?? r['Unique_walkin_tag']);
    const dailyTag = toNumber(r['daily_tag'] ?? r['Daily_tag']);
    const sdAmount = toNumber(r['deposit_at_walkin'] ?? r['sd_amount'] ?? r['deposit']) || 0;
    const isAllocInWeek = toNumber(r['Is_Allocatted_In_walkin_week'] ?? r['is_allocated_in_walkin_week'] ?? r['is_alloc_week']) || 0;
    const isAllocInDay = toNumber(r['Is_Allocatted_In_walkin_day'] ?? r['is_allocated_in_walkin_day']) || 0;
    const allocLater = toNumber(r['Allocated_later'] ?? r['allocated_later']);
    const allocFinal = toNumber(r['Allocation_final'] ?? r['allocation_final']);

    records.push({
      city: sanitizeValue(r['final_city'] ?? r['city']),
      location: sanitizeValue(r['final_location'] ?? r['location']),
      hub: sanitizeValue(r['final_hub'] ?? r['hub']),
      leadType: sanitizeValue(r['category'] ?? r['lead_type']),
      sourceCategory: sanitizeValue(r['channel_category'] ?? r['source_category']),
      businessVertical: sanitizeValue(r['payment_model'] ?? r['business_vertical'] ?? r['vertical']),
      agent: sanitizeValue(r['agent_username'] ?? r['agent'] ?? r['Agent']) || 'Unassigned',
      identity: String(identity),
      uniqueTag,
      dailyTag,
      walkinWeek: monday,
      walkinDateDisplay: dateDisplayParsed,
      onboardingDate: toDate(r['modified_et_creation_date_date'] ?? r['et_creation_date']),
      drivingTestDate: toDate(r['modified_driving_test_pass_timestamp_date'] ?? r['driving_test_date']),
      documentationDate: toDate(r['modified_documentation_timestamp_date'] ?? r['documentation_date']),
      trainingDate: toDate(r['modified_training_complete_timestamp_date'] ?? r['training_date']),
      contractDate: toDate(r['modified_driver_contract_signed_timestamp_date'] ?? r['contract_date']),
      sdAmount,
      isAllocInWeek,
      isAllocInDay,
      allocLater,
      allocFinal,
    });
  });

  return {
    records,
    audit: {
      rawTotal: rows.length,
      rawUsable: records.length,
      rawExcluded: excluded,
      rawSanitizedNulls: sanitizedCount,
      allocTotal: 0,
      allocUsable: 0,
      allocExcluded: 0,
    },
  };
}

/**
 * Normalizes allocation raw rows
 */
export function normalizeAllocationData(rows: Record<string, any>[]): { records: AllocationRecord[]; usableCount: number; excludedCount: number } {
  let excluded = 0;
  const records: AllocationRecord[] = [];

  rows.forEach((r) => {
    const rawAllocWeek = r['alloc_week'] ?? r['Alloc_week'] ?? r['allocation_week'];
    const allocWeekParsed = toDate(rawAllocWeek);
    if (!allocWeekParsed) {
      excluded++;
      return;
    }

    const monday = getMondayOf(allocWeekParsed);
    const employeeId = sanitizeValue(r['employee_id'] ?? r['Employee_id'] ?? r['emp_id']);
    const driverUuid = sanitizeValue(r['driver_uuid'] ?? r['Driver_uuid']);
    const isConsidered = toNumber(r['is_considered'] ?? r['Is_considered']);
    const walkinDoneWeekly = toNumber(r['Walkin_Done_weekly'] ?? r['walkin_done_weekly']);
    const walkinDoneDaily = toNumber(r['Walkin_done_daily'] ?? r['walkin_done_daily']);

    records.push({
      city: sanitizeValue(r['city'] ?? r['City']),
      location: sanitizeValue(r['location'] ?? r['Location']),
      leadType: sanitizeValue(r['category'] ?? r['Category'] ?? r['lead_type']),
      allocWeek: monday,
      allocDate: toDate(r['allocation_date'] ?? r['Allocation_date']),
      employeeId: employeeId ? String(employeeId) : null,
      driverId: sanitizeValue(r['driver_id'] ?? r['Driver_id']),
      carNumber: sanitizeValue(r['car_number'] ?? r['Car_number']),
      revenueType: sanitizeValue(r['revenue_type'] ?? r['Revenue_type']),
      driverUuid: driverUuid !== null ? String(driverUuid) : null,
      walkinDoneWeekly,
      walkinDoneDaily,
      isConsidered,
      agent: sanitizeValue(r['Agnet'] ?? r['agent'] ?? r['Agent']),
    });
  });

  return {
    records,
    usableCount: records.length,
    excludedCount: excluded,
  };
}

export function formatDateDisplay(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}


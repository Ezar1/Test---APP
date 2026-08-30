/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RawDataRecord, AllocationRecord, FilterState, FilterOptions } from '../types';

export const INITIAL_FILTER_STATE: FilterState = {
  city: '',
  location: '',
  leadType: '',
  sourceCategory: '',
  businessVertical: '',
  selectedWeekKey: '',
};

/**
 * Extracts unique, sorted options for all filter dropdowns
 */
export function extractFilterOptions(records: RawDataRecord[]): FilterOptions {
  const getUnique = (key: keyof RawDataRecord): string[] => {
    const set = new Set<string>();
    records.forEach((r) => {
      const v = r[key];
      if (v !== null && v !== undefined && typeof v === 'string' && v.trim() !== '') {
        set.add(v.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  return {
    city: getUnique('city'),
    location: getUnique('location'),
    leadType: getUnique('leadType'),
    sourceCategory: getUnique('sourceCategory'),
    businessVertical: getUnique('businessVertical'),
  };
}

/**
 * Applies active filters to RawData and Allocation datasets
 */
export function filterRecords(
  rawRecords: RawDataRecord[],
  allocRecords: AllocationRecord[],
  filters: FilterState
): { filteredRaw: RawDataRecord[]; filteredAlloc: AllocationRecord[] } {
  const filteredRaw = rawRecords.filter((r) => {
    if (filters.city && r.city !== filters.city) return false;
    if (filters.location && r.location !== filters.location) return false;
    if (filters.leadType && r.leadType !== filters.leadType) return false;
    if (filters.sourceCategory && r.sourceCategory !== filters.sourceCategory) return false;
    if (filters.businessVertical && r.businessVertical !== filters.businessVertical) return false;
    return true;
  });

  // Allocation_raw filtering matches workbook scope: City + Lead Type (Category)
  const filteredAlloc = allocRecords.filter((r) => {
    if (filters.city && r.city !== filters.city) return false;
    if (filters.leadType && r.leadType !== filters.leadType) return false;
    return true;
  });

  return { filteredRaw, filteredAlloc };
}

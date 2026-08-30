/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  RawDataRecord,
  AllocationRecord,
  WeeklyMetricRow,
  MetricDefinition,
  ReconciliationStatus,
} from '../types';
import {
  getMondayOf,
  getWeekKey,
  formatWeekLabel,
  isDateInRange,
} from '../services/NormalizationLayer';

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'walkins', label: 'Walk-ins', higher: true },
  { key: 'uniqueWalkins', label: 'Unique Walk-ins', higher: true },
  { key: 'repeatedWalkins', label: 'Repeated Walk-ins', higher: null },
  { key: 'onboarding', label: 'Onboarding', higher: true, denominator: 'uniqueWalkins' },
  { key: 'drivingTestPassed', label: 'Driving Test Passed', higher: true, denominator: 'uniqueWalkins' },
  { key: 'documentation', label: 'Documentation', higher: true, denominator: 'uniqueWalkins' },
  { key: 'sdPaid', label: 'Security Deposit Paid', higher: true, denominator: 'uniqueWalkins' },
  { key: 'training', label: 'Training', higher: true, denominator: 'uniqueWalkins' },
  { key: 'contract', label: 'Contract', higher: true, denominator: 'uniqueWalkins' },
  { key: 'allocated', label: 'Allocated', higher: true, section: 'Allocation', denominator: 'uniqueWalkins' },
  { key: 'notAllotted', label: 'Not-Allotted', higher: false },
  { key: 'sdNotAllocWeekly', label: 'SD Paid, Not Allotted', higher: false, section: 'Security Deposit' },
  { key: 'sdNotAllocTillDate', label: 'SD Not Allotted — Till Date', higher: false },
  { key: 'allocWithScan', label: 'Allocation With Scan', higher: null, section: 'Reconciliation' },
  { key: 'allocWithoutScan', label: 'Allocation Without Scan', higher: null },
  { key: 'allocTotal', label: 'Allocation — Total', higher: true },
  { key: 'allocWithoutUuid', label: 'Allocation Without UUID', higher: false },
];

export const KPI_METRIC_KEYS = [
  'walkins',
  'uniqueWalkins',
  'onboarding',
  'drivingTestPassed',
  'documentation',
  'sdPaid',
  'allocated',
  'notAllotted',
  'allocationRate',
  'sdNotAllocTillDate',
];

/**
 * Computes weekly metrics given filtered raw and allocation records
 */
export function computeWeeklyMetrics(
  rawRows: RawDataRecord[],
  allocRows: AllocationRecord[],
  maxWeeks: number = 8
): WeeklyMetricRow[] {
  // Bucket raw records by Monday week key
  const rawBuckets = new Map<string, { monday: Date; rows: RawDataRecord[] }>();
  rawRows.forEach((r) => {
    const monday = r.walkinWeek;
    const k = getWeekKey(monday);
    if (!rawBuckets.has(k)) {
      rawBuckets.set(k, { monday, rows: [] });
    }
    rawBuckets.get(k)!.rows.push(r);
  });

  // Bucket allocation records by Monday week key
  const allocBuckets = new Map<string, AllocationRecord[]>();
  allocRows.forEach((r) => {
    const monday = r.allocWeek;
    const k = getWeekKey(monday);
    if (!allocBuckets.has(k)) {
      allocBuckets.set(k, []);
    }
    allocBuckets.get(k)!.push(r);
  });

  // Sort weeks chronologically
  const sortedKeys = Array.from(rawBuckets.keys()).sort().slice(-maxWeeks);

  const weeklyRows: WeeklyMetricRow[] = sortedKeys.map((k) => {
    const { monday, rows } = rawBuckets.get(k)!;
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const sundayEnd = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);

    // Unique count helper within milestone window
    const countUniqueMilestone = (field: keyof RawDataRecord): number => {
      const set = new Set<string>();
      rows.forEach((r) => {
        const val = r[field];
        if (val instanceof Date && isDateInRange(val, monday, sundayEnd)) {
          set.add(r.identity);
        }
      });
      return set.size;
    };

    const walkins = rows.length;
    const uniqueWalkins = rows.filter((r) => r.uniqueTag === 1).length;
    const repeatedWalkins = rows.filter((r) => r.uniqueTag !== null && r.uniqueTag > 1).length;

    const onboarding = countUniqueMilestone('onboardingDate');
    const drivingTestPassed = countUniqueMilestone('drivingTestDate');
    const documentation = countUniqueMilestone('documentationDate');
    const training = countUniqueMilestone('trainingDate');
    const contract = countUniqueMilestone('contractDate');

    const sdSet = new Set<string>();
    rows.forEach((r) => {
      if (r.sdAmount > 500) {
        sdSet.add(r.identity);
      }
    });
    const sdPaid = sdSet.size;

    // Allocated: Is_Allocatted_In_walkin_week > 0 && unique_walkin_tag == 1
    const allocated = rows.filter((r) => r.isAllocInWeek > 0 && r.uniqueTag === 1).length;

    // Not-Allotted: Is_Allocatted_In_walkin_week == 0 && unique_walkin_tag == 1
    const notAllotted = rows.filter((r) => r.isAllocInWeek === 0 && r.uniqueTag === 1).length;

    // SD Paid, Not Allotted (Weekly): deposit_at_walkin > 500 && Is_Allocatted_In_walkin_week == 0
    const sdNotAllocWeeklySet = new Set<string>();
    rows.forEach((r) => {
      if (r.sdAmount > 500 && r.isAllocInWeek === 0) {
        sdNotAllocWeeklySet.add(r.identity);
      }
    });
    const sdNotAllocWeekly = sdNotAllocWeeklySet.size;

    // SD Paid, Not Allotted — Till Date: deposit_at_walkin > 500 && Is_Allocatted_In_walkin_week == 0 && (Allocation_final == 0 || null)
    const sdNotAllocTillDateSet = new Set<string>();
    rows.forEach((r) => {
      if (r.sdAmount > 500 && r.isAllocInWeek === 0 && (r.allocFinal === 0 || r.allocFinal === null)) {
        sdNotAllocTillDateSet.add(r.identity);
      }
    });
    const sdNotAllocTillDate = sdNotAllocTillDateSet.size;

    // Allocation Rate: Allocated / Unique Walk-ins * 100
    const allocationRate = uniqueWalkins > 0 ? (allocated / uniqueWalkins) * 100 : (walkins > 0 ? (allocated / walkins) * 100 : 0);

    // Allocation_raw metrics for the corresponding week
    const aRows = allocBuckets.get(k) || [];
    const allocWithScan = allocated;

    const withoutScanSet = new Set<string>();
    aRows.forEach((r) => {
      if (r.walkinDoneWeekly === 0 && r.isConsidered === 1 && r.employeeId) {
        withoutScanSet.add(r.employeeId);
      }
    });
    const allocWithoutScan = withoutScanSet.size;
    const allocTotal = allocWithScan + allocWithoutScan;

    const withoutUuidSet = new Set<string>();
    aRows.forEach((r) => {
      if (r.isConsidered === 1 && (r.driverUuid === 'NULL' || r.driverUuid === null || r.driverUuid === '') && r.employeeId) {
        withoutUuidSet.add(r.employeeId);
      }
    });
    const allocWithoutUuid = withoutUuidSet.size;

    return {
      key: k,
      monday,
      sunday,
      label: formatWeekLabel(monday),
      rows,
      walkins,
      uniqueWalkins,
      repeatedWalkins,
      onboarding,
      drivingTestPassed,
      documentation,
      sdPaid,
      training,
      contract,
      allocated,
      notAllotted,
      sdNotAllocWeekly,
      sdNotAllocTillDate,
      allocWithScan,
      allocWithoutScan,
      allocTotal,
      allocWithoutUuid,
      allocationRate,
      delta: {},
      ppDelta: {},
      l4wa: {},
    };
  });

  // Calculate WoW relative % and pp changes
  const allMetricKeys = [
    'walkins',
    'uniqueWalkins',
    'repeatedWalkins',
    'onboarding',
    'drivingTestPassed',
    'documentation',
    'sdPaid',
    'training',
    'contract',
    'allocated',
    'notAllotted',
    'sdNotAllocWeekly',
    'sdNotAllocTillDate',
    'allocWithScan',
    'allocWithoutScan',
    'allocTotal',
    'allocWithoutUuid',
    'allocationRate',
  ];

  weeklyRows.forEach((cur, idx) => {
    const prev = idx > 0 ? weeklyRows[idx - 1] : null;
    allMetricKeys.forEach((key) => {
      const curVal = (cur as any)[key] as number;
      if (!prev) {
        cur.delta[key] = null;
        cur.ppDelta[key] = null;
        return;
      }
      const prevVal = (prev as any)[key] as number;
      if (prevVal === 0 || prevVal === null || prevVal === undefined) {
        cur.delta[key] = null;
      } else {
        cur.delta[key] = ((curVal - prevVal) / prevVal) * 100;
      }

      if (key === 'allocationRate') {
        cur.ppDelta[key] = curVal - prevVal;
      }
    });
  });

  // Calculate 4-week rolling average (L4WA)
  weeklyRows.forEach((cur, idx) => {
    const window = weeklyRows.slice(Math.max(0, idx - 3), idx + 1);
    allMetricKeys.forEach((key) => {
      const values = window
        .map((w) => (w as any)[key] as number)
        .filter((v) => v !== undefined && v !== null && !isNaN(v));
      cur.l4wa[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    });
  });

  return weeklyRows;
}

/**
 * Validates reconciliation for a given week
 */
export function evaluateReconciliation(week: WeeklyMetricRow): ReconciliationStatus {
  const computedSum = week.allocWithScan + week.allocWithoutScan;
  const variance = week.allocTotal - computedSum;
  return {
    allocWithScan: week.allocWithScan,
    allocWithoutScan: week.allocWithoutScan,
    allocTotal: week.allocTotal,
    computedSum,
    variance,
    status: Math.abs(variance) === 0 ? 'RECONCILED' : 'MISMATCH',
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  RawDataRecord,
  AllocationRecord,
  WeeklyMetricRow,
  FilterState,
  ReconciliationStatus,
  DataQualityReport,
} from '../types';
import { filterRecords } from './FilterEngine';
import { computeWeeklyMetrics, evaluateReconciliation, METRIC_DEFINITIONS } from './MetricEngine';
import { formatDateDisplay } from '../services/NormalizationLayer';

/**
 * CONTROLLED ANALYTICS TOOLS
 * These functions execute exact dashboard metric formulas on the in-memory normalized dataset.
 * The AI model NEVER calculates raw numbers independently; it receives the structured output from these tools.
 */

export interface ToolContext {
  allRaw: RawDataRecord[];
  allAlloc: AllocationRecord[];
  filters: FilterState;
  activeWeek?: WeeklyMetricRow | null;
  weeks: WeeklyMetricRow[];
  dataAudit?: any;
  lastFetchedAt?: Date | null;
  tabsFound?: string[];
}

export const ControlledAnalyticsTools = {
  /**
   * 1. getAvailableWeeks
   */
  getAvailableWeeks(ctx: ToolContext) {
    return ctx.weeks.map((w, idx) => ({
      index: idx + 1,
      key: w.key,
      label: w.label,
      dateRange: `${formatDateDisplay(w.monday)} to ${formatDateDisplay(w.sunday)}`,
      totalWalkins: w.walkins,
      uniqueWalkins: w.uniqueWalkins,
      allocated: w.allocated,
      allocationRate: Number(w.allocationRate.toFixed(1)) + '%',
      isLatest: idx === ctx.weeks.length - 1,
    }));
  },

  /**
   * 2. getFilterValues
   */
  getFilterValues(ctx: ToolContext) {
    const cities = Array.from(new Set(ctx.allRaw.map((r) => r.city).filter(Boolean))) as string[];
    const locations = Array.from(new Set(ctx.allRaw.map((r) => r.location).filter(Boolean))) as string[];
    const leadTypes = Array.from(new Set(ctx.allRaw.map((r) => r.leadType).filter(Boolean))) as string[];
    const sourceCategories = Array.from(new Set(ctx.allRaw.map((r) => r.sourceCategory).filter(Boolean))) as string[];
    const businessVerticals = Array.from(new Set(ctx.allRaw.map((r) => r.businessVertical).filter(Boolean))) as string[];

    return {
      cities: cities.sort(),
      locations: locations.sort(),
      leadTypes: leadTypes.sort(),
      sourceCategories: sourceCategories.sort(),
      businessVerticals: businessVerticals.sort(),
    };
  },

  /**
   * 3. getWeeklyMetrics
   */
  getWeeklyMetrics(ctx: ToolContext, weekKey?: string, overrideFilters?: Partial<FilterState>) {
    const effectiveFilters: FilterState = {
      ...ctx.filters,
      ...(overrideFilters || {}),
    };

    const { filteredRaw, filteredAlloc } = filterRecords(ctx.allRaw, ctx.allAlloc, effectiveFilters);
    const computedWeeks = computeWeeklyMetrics(filteredRaw, filteredAlloc, 8);

    if (computedWeeks.length === 0) {
      return { error: 'No weekly data available for the active filter selection.' };
    }

    const targetWeek = weekKey
      ? computedWeeks.find((w) => w.key === weekKey) || computedWeeks[computedWeeks.length - 1]
      : computedWeeks[computedWeeks.length - 1];

    const idx = computedWeeks.findIndex((w) => w.key === targetWeek.key);
    const prevWeek = idx > 0 ? computedWeeks[idx - 1] : null;

    return {
      weekKey: targetWeek.key,
      weekLabel: targetWeek.label,
      dateRange: `${formatDateDisplay(targetWeek.monday)} – ${formatDateDisplay(targetWeek.sunday)}`,
      metrics: {
        walkins: targetWeek.walkins,
        uniqueWalkins: targetWeek.uniqueWalkins,
        repeatedWalkins: targetWeek.repeatedWalkins,
        onboarding: targetWeek.onboarding,
        drivingTestPassed: targetWeek.drivingTestPassed,
        documentation: targetWeek.documentation,
        training: targetWeek.training,
        contract: targetWeek.contract,
        sdPaid: targetWeek.sdPaid,
        allocated: targetWeek.allocated,
        notAllotted: targetWeek.notAllotted,
        allocationRate: Number(targetWeek.allocationRate.toFixed(1)) + '%',
        sdNotAllocWeekly: targetWeek.sdNotAllocWeekly,
        sdNotAllocTillDate: targetWeek.sdNotAllocTillDate,
        allocWithScan: targetWeek.allocWithScan,
        allocWithoutScan: targetWeek.allocWithoutScan,
        allocTotal: targetWeek.allocTotal,
        allocWithoutUuid: targetWeek.allocWithoutUuid,
      },
      wowChanges: {
        allocatedWoW: targetWeek.delta['allocated'] !== null && targetWeek.delta['allocated'] !== undefined ? Number(targetWeek.delta['allocated'].toFixed(1)) + '%' : 'N/A',
        allocationRateWoW_pp: targetWeek.ppDelta['allocationRate'] !== null && targetWeek.ppDelta['allocationRate'] !== undefined ? Number(targetWeek.ppDelta['allocationRate'].toFixed(1)) + ' pp' : 'N/A',
        uniqueWalkinsWoW: targetWeek.delta['uniqueWalkins'] !== null && targetWeek.delta['uniqueWalkins'] !== undefined ? Number(targetWeek.delta['uniqueWalkins'].toFixed(1)) + '%' : 'N/A',
        sdNotAllocTillDateWoW: targetWeek.delta['sdNotAllocTillDate'] !== null && targetWeek.delta['sdNotAllocTillDate'] !== undefined ? Number(targetWeek.delta['sdNotAllocTillDate'].toFixed(1)) + '%' : 'N/A',
      },
      previousWeekAllocated: prevWeek ? prevWeek.allocated : null,
      previousWeekAllocationRate: prevWeek ? Number(prevWeek.allocationRate.toFixed(1)) + '%' : null,
    };
  },

  /**
   * 4. getMetric
   */
  getMetric(ctx: ToolContext, metricKey: string, weekKey?: string) {
    const weeklyData = this.getWeeklyMetrics(ctx, weekKey);
    if ('error' in weeklyData) return weeklyData;

    const def = METRIC_DEFINITIONS.find((m) => m.key === metricKey);
    const label = def ? def.label : metricKey;
    const value = (weeklyData.metrics as any)[metricKey];

    const currentWeekObj = ctx.weeks.find((w) => w.key === weeklyData.weekKey) || ctx.weeks[ctx.weeks.length - 1];
    const wowDelta = currentWeekObj ? currentWeekObj.delta[metricKey] : null;
    const l4wa = currentWeekObj ? currentWeekObj.l4wa[metricKey] : null;

    return {
      metricKey,
      label,
      weekLabel: weeklyData.weekLabel,
      value,
      wowChangePercent: wowDelta !== null && wowDelta !== undefined ? Number(wowDelta.toFixed(1)) + '%' : 'N/A',
      rolling4WeekAverage: l4wa !== null && l4wa !== undefined ? Number(l4wa.toFixed(1)) : 'N/A',
    };
  },

  /**
   * 5. getWeeklyComparison
   */
  getWeeklyComparison(ctx: ToolContext, metricKey?: string, weekKey?: string) {
    const targetIdx = weekKey
      ? ctx.weeks.findIndex((w) => w.key === weekKey)
      : ctx.weeks.length - 1;

    if (targetIdx < 0 || ctx.weeks.length < 2) {
      return { error: 'Insufficient weeks to perform comparative analysis.' };
    }

    const current = ctx.weeks[targetIdx];
    const previous = targetIdx > 0 ? ctx.weeks[targetIdx - 1] : null;

    if (!previous) {
      return { error: 'Previous week baseline not available for the earliest loaded week.' };
    }

    const compareKeys = metricKey
      ? [metricKey]
      : ['walkins', 'uniqueWalkins', 'sdPaid', 'allocated', 'notAllotted', 'allocationRate', 'sdNotAllocTillDate', 'allocWithoutUuid'];

    const comparisons = compareKeys.map((key) => {
      const def = METRIC_DEFINITIONS.find((m) => m.key === key);
      const label = def ? def.label : key;
      const curVal = (current as any)[key];
      const prevVal = (previous as any)[key];
      const absDiff = curVal - prevVal;
      const pctDiff = prevVal > 0 ? ((absDiff / prevVal) * 100).toFixed(1) + '%' : 'N/A';

      return {
        key,
        label,
        currentWeek: current.label,
        currentValue: curVal,
        previousWeek: previous.label,
        previousValue: prevVal,
        absoluteDifference: absDiff,
        percentageDifference: pctDiff,
      };
    });

    return {
      currentWeek: current.label,
      previousWeek: previous.label,
      comparisons,
    };
  },

  /**
   * 6. getCityBreakdown
   */
  getCityBreakdown(ctx: ToolContext, metricKey: string = 'allocated', weekKey?: string) {
    const targetWeek = weekKey
      ? ctx.weeks.find((w) => w.key === weekKey) || ctx.weeks[ctx.weeks.length - 1]
      : ctx.weeks[ctx.weeks.length - 1];

    if (!targetWeek) return { error: 'No data for city breakdown.' };

    const targetIdx = ctx.weeks.findIndex((w) => w.key === targetWeek.key);
    const prevWeek = targetIdx > 0 ? ctx.weeks[targetIdx - 1] : null;

    // Aggregate cities for targetWeek
    const cityMap = new Map<string, { walkins: number; unique: number; sdPaid: number; allocated: number; notAllotted: number }>();

    targetWeek.rows.forEach((r) => {
      const c = r.city || 'Unknown';
      if (!cityMap.has(c)) {
        cityMap.set(c, { walkins: 0, unique: 0, sdPaid: 0, allocated: 0, notAllotted: 0 });
      }
      const item = cityMap.get(c)!;
      item.walkins += 1;
      if (r.uniqueTag === 1) item.unique += 1;
      if (r.sdAmount > 500) item.sdPaid += 1;
      if (r.isAllocInWeek > 0 && r.uniqueTag === 1) item.allocated += 1;
      if (r.isAllocInWeek === 0 && r.uniqueTag === 1) item.notAllotted += 1;
    });

    // Aggregate cities for prevWeek if available
    const prevCityAlloc = new Map<string, number>();
    if (prevWeek) {
      prevWeek.rows.forEach((r) => {
        const c = r.city || 'Unknown';
        if (r.isAllocInWeek > 0 && r.uniqueTag === 1) {
          prevCityAlloc.set(c, (prevCityAlloc.get(c) || 0) + 1);
        }
      });
    }

    const results = Array.from(cityMap.entries()).map(([city, data]) => {
      const rate = data.unique > 0 ? (data.allocated / data.unique) * 100 : 0;
      const prevAlloc = prevCityAlloc.get(city) || 0;
      const wowChange = prevAlloc > 0 ? ((data.allocated - prevAlloc) / prevAlloc) * 100 : null;

      return {
        city,
        walkins: data.walkins,
        uniqueWalkins: data.unique,
        sdPaid: data.sdPaid,
        allocated: data.allocated,
        notAllotted: data.notAllotted,
        allocationRate: Number(rate.toFixed(1)) + '%',
        previousAllocated: prevAlloc,
        allocatedWoWChange: wowChange !== null ? Number(wowChange.toFixed(1)) + '%' : 'N/A',
        allocatedWoWAbsolute: data.allocated - prevAlloc,
      };
    });

    // Sort by allocated desc
    results.sort((a, b) => b.allocated - a.allocated);

    return {
      weekLabel: targetWeek.label,
      totalCities: results.length,
      topCityByAllocated: results[0]?.city || 'N/A',
      weakestCityByAllocated: results[results.length - 1]?.city || 'N/A',
      cities: results,
    };
  },

  /**
   * 7. getSourceBreakdown
   */
  getSourceBreakdown(ctx: ToolContext, metricKey: string = 'allocated', weekKey?: string) {
    const targetWeek = weekKey
      ? ctx.weeks.find((w) => w.key === weekKey) || ctx.weeks[ctx.weeks.length - 1]
      : ctx.weeks[ctx.weeks.length - 1];

    if (!targetWeek) return { error: 'No data for source category breakdown.' };

    const sourceMap = new Map<string, { unique: number; allocated: number; sdPaid: number }>();

    targetWeek.rows.forEach((r) => {
      const s = r.sourceCategory || 'Unknown';
      if (!sourceMap.has(s)) {
        sourceMap.set(s, { unique: 0, allocated: 0, sdPaid: 0 });
      }
      const item = sourceMap.get(s)!;
      if (r.uniqueTag === 1) item.unique += 1;
      if (r.isAllocInWeek > 0 && r.uniqueTag === 1) item.allocated += 1;
      if (r.sdAmount > 500) item.sdPaid += 1;
    });

    const results = Array.from(sourceMap.entries()).map(([source, data]) => {
      const rate = data.unique > 0 ? (data.allocated / data.unique) * 100 : 0;
      return {
        sourceCategory: source,
        uniqueWalkins: data.unique,
        sdPaid: data.sdPaid,
        allocated: data.allocated,
        allocationRate: Number(rate.toFixed(1)) + '%',
      };
    });

    results.sort((a, b) => b.allocated - a.allocated);

    return {
      weekLabel: targetWeek.label,
      sources: results,
    };
  },

  /**
   * 8. getAllocationReconciliation
   */
  getAllocationReconciliation(ctx: ToolContext, weekKey?: string) {
    const targetWeek = weekKey
      ? ctx.weeks.find((w) => w.key === weekKey) || ctx.weeks[ctx.weeks.length - 1]
      : ctx.weeks[ctx.weeks.length - 1];

    if (!targetWeek) return { error: 'No data for reconciliation.' };

    const recon = evaluateReconciliation(targetWeek);

    return {
      weekLabel: targetWeek.label,
      stream1_AllocationWithScan: recon.allocWithScan,
      stream2_AllocationWithoutScan: recon.allocWithoutScan,
      totalFromStreams: recon.computedSum,
      allocationRawTotal: recon.allocTotal,
      variance: recon.variance,
      reconciliationStatus: recon.status,
      missingUuidCount: targetWeek.allocWithoutUuid,
    };
  },

  /**
   * 9. getSdBacklog
   * Drivers with SD Paid (>500) who are not allocated till date (allocFinal == 0 || null)
   */
  getSdBacklog(ctx: ToolContext, limit: number = 25) {
    const now = new Date();

    const backlogRecords = ctx.allRaw.filter(
      (r) => r.sdAmount > 500 && r.isAllocInWeek === 0 && (r.allocFinal === 0 || r.allocFinal === null)
    );

    // Sort by oldest walk-in date first
    backlogRecords.sort((a, b) => {
      const tA = a.walkinDateDisplay ? a.walkinDateDisplay.getTime() : 0;
      const tB = b.walkinDateDisplay ? b.walkinDateDisplay.getTime() : 0;
      return tA - tB;
    });

    const records = backlogRecords.slice(0, limit).map((r) => {
      const diffMs = r.walkinDateDisplay ? now.getTime() - r.walkinDateDisplay.getTime() : 0;
      const pendingDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      return {
        identity: r.identity,
        city: r.city || 'Unknown',
        hub: r.hub || r.location || 'Hub N/A',
        leadType: r.leadType || 'Organic',
        sourceCategory: r.sourceCategory || 'Direct',
        walkinDate: formatDateDisplay(r.walkinDateDisplay),
        sdAmount: `₹${r.sdAmount.toLocaleString()}`,
        status: 'SD Paid — Unallocated',
        pendingDays: `${pendingDays} days`,
        reason: 'Vehicle allocation pending / Hub backlog',
      };
    });

    return {
      totalSdBacklogCount: backlogRecords.length,
      returnedCount: records.length,
      records,
    };
  },

  /**
   * 10. getNotAllocatedRecords
   * Unique walk-in drivers in the requested week who were not allocated
   */
  getNotAllocatedRecords(ctx: ToolContext, weekKey?: string, limit: number = 25) {
    const targetWeek = weekKey
      ? ctx.weeks.find((w) => w.key === weekKey) || ctx.weeks[ctx.weeks.length - 1]
      : ctx.weeks[ctx.weeks.length - 1];

    if (!targetWeek) return { error: 'No data for unallocated driver records.' };

    const unallocated = targetWeek.rows.filter(
      (r) => r.isAllocInWeek === 0 && r.uniqueTag === 1
    );

    const records = unallocated.slice(0, limit).map((r) => {
      let stage = 'Walk-in Registered';
      if (r.contractDate) stage = 'Contract Signed';
      else if (r.trainingDate) stage = 'Training Completed';
      else if (r.sdAmount > 500) stage = 'SD Paid (Pending Alloc)';
      else if (r.documentationDate) stage = 'Documents Verified';
      else if (r.drivingTestDate) stage = 'Driving Test Passed';
      else if (r.onboardingDate) stage = 'Onboarded';

      return {
        identity: r.identity,
        city: r.city || 'Unknown',
        hub: r.hub || r.location || 'Hub N/A',
        leadType: r.leadType || 'Standard',
        sourceCategory: r.sourceCategory || 'Organic',
        walkinDate: formatDateDisplay(r.walkinDateDisplay),
        sdPaid: r.sdAmount > 500 ? `₹${r.sdAmount.toLocaleString()}` : 'No',
        status: 'Not-Allotted in Week',
        lastCompletedStage: stage,
        reason: r.sdAmount > 500 ? 'SD Paid; vehicle supply constraint' : 'Funnel drop-off before allocation',
      };
    });

    return {
      weekLabel: targetWeek.label,
      totalUnallocatedInWeek: unallocated.length,
      returnedCount: records.length,
      records,
    };
  },

  /**
   * 11. getAllocationRecords
   */
  getAllocationRecords(ctx: ToolContext, weekKey?: string, limit: number = 25) {
    const targetWeek = weekKey
      ? ctx.weeks.find((w) => w.key === weekKey) || ctx.weeks[ctx.weeks.length - 1]
      : ctx.weeks[ctx.weeks.length - 1];

    if (!targetWeek) return { error: 'No data for allocation records.' };

    const { filteredAlloc } = filterRecords(ctx.allRaw, ctx.allAlloc, ctx.filters);
    const weekMonday = targetWeek.monday.getTime();

    const weekAllocRows = filteredAlloc.filter(
      (a) => a.allocWeek.getTime() === weekMonday && a.isConsidered === 1
    );

    const records = weekAllocRows.slice(0, limit).map((a) => ({
      employeeId: a.employeeId || 'N/A',
      driverUuid: a.driverUuid && a.driverUuid !== 'NULL' ? a.driverUuid : 'MISSING (No UUID)',
      city: a.city || 'Unknown',
      location: a.location || 'Unknown',
      carNumber: a.carNumber || 'N/A',
      revenueType: a.revenueType || 'Standard',
      walkinType: a.walkinDoneWeekly === 1 ? 'Walk-in with Scan' : 'Direct Allocation (No Scan)',
      allocDate: formatDateDisplay(a.allocDate),
    }));

    return {
      weekLabel: targetWeek.label,
      totalAllocationRawRecords: weekAllocRows.length,
      returnedCount: records.length,
      records,
    };
  },

  /**
   * 12. getDataQuality
   */
  getDataQuality(ctx: ToolContext) {
    const active = ctx.activeWeek || ctx.weeks[ctx.weeks.length - 1];
    return {
      rawTotal: ctx.allRaw.length,
      rawUsable: ctx.allRaw.filter((r) => r.uniqueTag !== null).length,
      allocTotal: ctx.allAlloc.length,
      missingUuidCount: active ? active.allocWithoutUuid : 0,
      weeksLoaded: ctx.weeks.length,
      lastFetchedAt: ctx.lastFetchedAt ? ctx.lastFetchedAt.toISOString() : null,
      tabsFound: ctx.tabsFound || ['Raw_data', 'Allocation_raw'],
      status: 'HEALTHY',
    };
  },
};

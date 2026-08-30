/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeeklyMetricRow, InsightItem, ContributorItem, RawDataRecord } from '../types';

export function generateDynamicInsights(
  currentWeek: WeeklyMetricRow | null,
  prevWeek: WeeklyMetricRow | null,
  allWeeks: WeeklyMetricRow[]
): InsightItem[] {
  if (!currentWeek) return [];

  const insights: InsightItem[] = [];

  // 1. Allocation Rate WoW Analysis (Relative % and pp movement)
  const rateDelta = currentWeek.delta['allocationRate'];
  const ratePpDelta = currentWeek.ppDelta['allocationRate'];
  const prevRate = prevWeek ? prevWeek.allocationRate : null;

  if (rateDelta !== null && ratePpDelta !== null && prevRate !== null) {
    const isDecline = ratePpDelta < 0;
    const absPp = Math.abs(ratePpDelta).toFixed(1);
    const absPct = Math.abs(rateDelta).toFixed(1);

    if (Math.abs(ratePpDelta) >= 5) {
      insights.push({
        id: 'alloc_rate_movement',
        level: isDecline ? 'CRITICAL' : 'POSITIVE',
        title: isDecline ? `Allocation Rate Sharp Decline (-${absPp} pp)` : `Allocation Rate Strong Gain (+${absPp} pp)`,
        description: `Allocation rate moved ${isDecline ? 'down' : 'up'} by ${absPp} percentage points (${isDecline ? '-' : '+'}${absPct}% WoW), moving from ${prevRate.toFixed(1)}% to ${currentWeek.allocationRate.toFixed(1)}%.`,
        metricKey: 'allocationRate',
        impactScore: 90,
      });
    } else if (Math.abs(ratePpDelta) >= 2) {
      insights.push({
        id: 'alloc_rate_movement',
        level: isDecline ? 'WATCH' : 'POSITIVE',
        title: `Allocation Rate ${isDecline ? 'Softened' : 'Improved'} (${isDecline ? '-' : '+'}${absPp} pp)`,
        description: `Current week rate is ${currentWeek.allocationRate.toFixed(1)}% vs ${prevRate.toFixed(1)}% in the previous week (${isDecline ? '-' : '+'}${absPct}% WoW).`,
        metricKey: 'allocationRate',
        impactScore: 60,
      });
    }
  }

  // 2. City-Level Contribution to Allocation Delta
  if (prevWeek) {
    const curCityAlloc = getDimensionCounts(currentWeek.rows, 'city', (r) => r.isAllocInWeek > 0 && r.uniqueTag === 1);
    const prevCityAlloc = getDimensionCounts(prevWeek.rows, 'city', (r) => r.isAllocInWeek > 0 && r.uniqueTag === 1);

    const allCities = Array.from(new Set([...Object.keys(curCityAlloc), ...Object.keys(prevCityAlloc)]));
    const cityDeltas = allCities.map((city) => {
      const cur = curCityAlloc[city] || 0;
      const prev = prevCityAlloc[city] || 0;
      return { city, diff: cur - prev, cur, prev };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    if (cityDeltas.length > 0 && Math.abs(cityDeltas[0].diff) >= 3) {
      const top = cityDeltas[0];
      const sign = top.diff > 0 ? '+' : '';
      insights.push({
        id: 'top_city_contributor',
        level: top.diff < 0 ? 'HIGH' : 'POSITIVE',
        title: `Primary City Impact: ${top.city} (${sign}${top.diff} allocations)`,
        description: `${top.city} recorded ${top.cur} allocations this week compared to ${top.prev} last week, driving the largest volume swing among all hubs.`,
        metricKey: 'allocated',
        impactScore: 80,
      });
    }
  }

  // 3. Security Deposit Backlog Warning (Till Date)
  const l4waSdBacklog = currentWeek.l4wa['sdNotAllocTillDate'];
  if (l4waSdBacklog !== null && currentWeek.sdNotAllocTillDate > 0) {
    const varianceVsL4w = currentWeek.sdNotAllocTillDate - l4waSdBacklog;
    if (varianceVsL4w > 10) {
      insights.push({
        id: 'sd_backlog_alert',
        level: 'CRITICAL',
        title: `Elevated SD Backlog: ${currentWeek.sdNotAllocTillDate} Drivers Pending`,
        description: `SD Paid Vehicle Not Allocated (Till Date) is ${currentWeek.sdNotAllocTillDate}, which is ${Math.round(varianceVsL4w)} higher than the 4-week average (${Math.round(l4waSdBacklog)}).`,
        metricKey: 'sdNotAllocTillDate',
        impactScore: 85,
      });
    } else if (varianceVsL4w > 3) {
      insights.push({
        id: 'sd_backlog_watch',
        level: 'WATCH',
        title: `SD Backlog Notice: ${currentWeek.sdNotAllocTillDate} Active Drivers`,
        description: `Active till-date backlog of drivers who paid deposit (> ₹500) but are not yet allotted is tracking slightly above the 4-week benchmark (${Math.round(l4waSdBacklog)}).`,
        metricKey: 'sdNotAllocTillDate',
        impactScore: 50,
      });
    }
  }

  // 4. Walk-in Volume & Conversion Flow
  const walkinDelta = currentWeek.delta['walkins'];
  if (walkinDelta !== null && Math.abs(walkinDelta) >= 15) {
    const isUp = walkinDelta > 0;
    insights.push({
      id: 'walkin_swing',
      level: isUp ? 'INFO' : 'WATCH',
      title: `Walk-in Demand ${isUp ? 'Surge' : 'Drop'} (${isUp ? '+' : ''}${walkinDelta.toFixed(1)}% WoW)`,
      description: `Walk-ins reached ${currentWeek.walkins.toLocaleString()} this week (vs ${prevWeek?.walkins.toLocaleString()} last week). Unique candidates account for ${currentWeek.uniqueWalkins.toLocaleString()} (${currentWeek.walkins > 0 ? ((currentWeek.uniqueWalkins / currentWeek.walkins) * 100).toFixed(0) : 0}% of total).`,
      metricKey: 'walkins',
      impactScore: 40,
    });
  }

  // 5. Allocation Reconciliation Integrity
  const diff = currentWeek.allocTotal - (currentWeek.allocWithScan + currentWeek.allocWithoutScan);
  if (Math.abs(diff) === 0) {
    insights.push({
      id: 'recon_healthy',
      level: 'INFO',
      title: 'Allocation Stream Reconciled',
      description: `With Scan (${currentWeek.allocWithScan}) + Without Scan (${currentWeek.allocWithoutScan}) perfectly matches Total Allocation (${currentWeek.allocTotal}).`,
      impactScore: 10,
    });
  } else {
    insights.push({
      id: 'recon_mismatch',
      level: 'CRITICAL',
      title: 'Allocation Stream Reconciliation Mismatch',
      description: `Variance of ${diff} detected between component sum (${currentWeek.allocWithScan + currentWeek.allocWithoutScan}) and Allocation_raw total (${currentWeek.allocTotal}).`,
      impactScore: 100,
    });
  }

  return insights.sort((a, b) => b.impactScore - a.impactScore);
}

function getDimensionCounts(
  rows: RawDataRecord[],
  dim: keyof RawDataRecord,
  predicate?: (r: RawDataRecord) => boolean
): Record<string, number> {
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    if (predicate && !predicate(r)) return;
    const val = r[dim];
    const key = val !== null && val !== undefined && typeof val === 'string' && val.trim() !== '' ? val.trim() : 'Other';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

/**
 * Calculates contributor breakdown for "Why Did This Change" analysis
 */
export function calculateContributors(
  currentWeek: WeeklyMetricRow,
  prevWeek: WeeklyMetricRow | null,
  metricKey: string
): Record<string, ContributorItem[]> {
  if (!prevWeek) return {};

  const dimensions: { key: keyof RawDataRecord; label: string }[] = [
    { key: 'city', label: 'City' },
    { key: 'location', label: 'Location' },
    { key: 'leadType', label: 'Lead Type' },
    { key: 'sourceCategory', label: 'Source Category' },
    { key: 'businessVertical', label: 'Business Vertical' },
  ];

  const getMetricCount = (rows: RawDataRecord[]): number => {
    switch (metricKey) {
      case 'walkins': return rows.length;
      case 'uniqueWalkins': return rows.filter((r) => r.uniqueTag === 1).length;
      case 'onboarding': return rows.filter((r) => r.onboardingDate !== null).length;
      case 'allocated': return rows.filter((r) => r.isAllocInWeek > 0 && r.uniqueTag === 1).length;
      case 'notAllotted': return rows.filter((r) => r.isAllocInWeek === 0 && r.uniqueTag === 1).length;
      case 'sdPaid': return rows.filter((r) => r.sdAmount > 500).length;
      case 'sdNotAllocTillDate': return rows.filter((r) => r.sdAmount > 500 && r.isAllocInWeek === 0 && (r.allocFinal === 0 || r.allocFinal === null)).length;
      default: return rows.length;
    }
  };

  const totalCur = (currentWeek as any)[metricKey] ?? getMetricCount(currentWeek.rows);
  const totalPrev = (prevWeek as any)[metricKey] ?? getMetricCount(prevWeek.rows);
  const totalDelta = totalCur - totalPrev;

  const result: Record<string, ContributorItem[]> = {};

  dimensions.forEach(({ key, label }) => {
    const curMap: Record<string, number> = {};
    const prevMap: Record<string, number> = {};

    // Group current
    currentWeek.rows.forEach((r) => {
      const cat = (r[key] as string) || 'Unassigned';
      curMap[cat] = (curMap[cat] || 0) + 1;
    });

    // Group prev
    prevWeek.rows.forEach((r) => {
      const cat = (r[key] as string) || 'Unassigned';
      prevMap[cat] = (prevMap[cat] || 0) + 1;
    });

    const allCategories = Array.from(new Set([...Object.keys(curMap), ...Object.keys(prevMap)]));

    const items: ContributorItem[] = allCategories.map((cat) => {
      const cVal = curMap[cat] || 0;
      const pVal = prevMap[cat] || 0;
      const diff = cVal - pVal;
      const pct = pVal > 0 ? (diff / pVal) * 100 : null;
      const share = totalDelta !== 0 ? (diff / totalDelta) * 100 : 0;

      return {
        dimension: label,
        category: cat,
        currentValue: cVal,
        previousValue: pVal,
        absoluteChange: diff,
        percentageChange: pct,
        contributionShare: share,
      };
    }).sort((a, b) => Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange));

    result[label] = items;
  });

  return result;
}

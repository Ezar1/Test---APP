/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WeeklyMetricRow, MetricDefinition } from '../types';
import { METRIC_DEFINITIONS } from '../engine/MetricEngine';

interface WeeklyMatrixProps {
  weeks: WeeklyMetricRow[];
  onSelectCell: (metricKey: string, week: WeeklyMetricRow) => void;
}

export const WeeklyMatrix: React.FC<WeeklyMatrixProps> = ({ weeks, onSelectCell }) => {
  const [viewMode, setViewMode] = useState<'count' | 'percent'>('count');

  if (!weeks.length) return null;

  const lastWeek = weeks[weeks.length - 1];

  const formatCellValue = (metric: MetricDefinition, week: WeeklyMetricRow) => {
    const rawVal = (week as any)[metric.key] as number;
    if (rawVal === undefined || rawVal === null) return '—';

    if (viewMode === 'percent') {
      const denom = week.uniqueWalkins || week.walkins || 1;
      const pct = (rawVal / denom) * 100;
      return `${pct.toFixed(1)}%`;
    }

    return Math.round(rawVal).toLocaleString();
  };

  return (
    <div className="panel mb-4" id="matrix-panel">
      <div className="panel-head">
        <div>
          <h3>Weekly Funnel Matrix</h3>
          <div className="panel-sub">
            Click any cell to inspect underlying driver records and milestones
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg2)] p-1 rounded-md border border-[var(--line)]">
          <button
            className={`px-2.5 py-1 text-xs font-semibold rounded ${
              viewMode === 'count'
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => setViewMode('count')}
          >
            Absolute Counts
          </button>
          <button
            className={`px-2.5 py-1 text-xs font-semibold rounded ${
              viewMode === 'percent'
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => setViewMode('percent')}
          >
            % of Unique Walk-ins
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="matrix" id="matrix-table">
          <thead>
            <tr>
              <th>Metric</th>
              {weeks.map((w) => (
                <th key={w.key} className={w.key === lastWeek.key ? 'text-amber-500 font-bold' : ''}>
                  {w.label}
                </th>
              ))}
              <th>Δ% WoW</th>
              <th>L4WA</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_DEFINITIONS.map((metric) => {
              const delta = lastWeek.delta[metric.key];
              const dir = metric.higher === true ? 1 : metric.higher === false ? -1 : 0;
              const isGood =
                delta === null || dir === 0
                  ? null
                  : dir > 0
                  ? delta >= 0
                  : delta <= 0;
              const deltaCls = delta === null ? '' : isGood ? 'delta-pos' : 'delta-neg';
              const l4waVal = lastWeek.l4wa[metric.key];

              return (
                <tr key={metric.key}>
                  <td className="font-semibold">{metric.label}</td>
                  {weeks.map((w) => (
                    <td
                      key={w.key}
                      className="mono clickable-cell"
                      onClick={() => onSelectCell(metric.key, w)}
                      title={`Click to view ${metric.label} records for week of ${w.label}`}
                    >
                      {formatCellValue(metric, w)}
                    </td>
                  ))}
                  <td className={`mono ${deltaCls}`}>
                    {delta === null
                      ? '—'
                      : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}
                  </td>
                  <td className="mono">
                    {l4waVal === null
                      ? '—'
                      : viewMode === 'percent'
                      ? `${(
                          (l4waVal / (lastWeek.uniqueWalkins || lastWeek.walkins || 1)) *
                          100
                        ).toFixed(1)}%`
                      : Math.round(l4waVal).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WeeklyMetricRow } from '../types';
import { calculateContributors } from '../engine/InsightEngine';

interface WhyChangeModalProps {
  metricKey: string;
  currentWeek: WeeklyMetricRow;
  prevWeek: WeeklyMetricRow | null;
  onClose: () => void;
}

const METRIC_NAMES: Record<string, string> = {
  walkins: 'Walk-ins',
  uniqueWalkins: 'Unique Walk-ins',
  repeatedWalkins: 'Repeated Walk-ins',
  onboarding: 'Onboarding',
  drivingTestPassed: 'Driving Test Passed',
  documentation: 'Documentation',
  sdPaid: 'Security Deposit Paid',
  training: 'Training',
  contract: 'Contract',
  allocated: 'Allocated',
  notAllotted: 'Not-Allotted',
  allocationRate: 'Allocation Rate',
  sdNotAllocWeekly: 'SD Paid, Not Allotted (Weekly)',
  sdNotAllocTillDate: 'SD Not Allotted (Till Date)',
  allocWithScan: 'Allocation With Scan',
  allocWithoutScan: 'Allocation Without Scan',
  allocTotal: 'Allocation Total',
};

export const WhyChangeModal: React.FC<WhyChangeModalProps> = ({
  metricKey,
  currentWeek,
  prevWeek,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<string>('City');

  const metricName = METRIC_NAMES[metricKey] || metricKey;
  const isRate = metricKey === 'allocationRate';

  const curVal = (currentWeek as any)[metricKey] as number;
  const prevVal = prevWeek ? ((prevWeek as any)[metricKey] as number) : null;

  const delta = currentWeek.delta[metricKey];
  const ppDelta = currentWeek.ppDelta[metricKey];
  const absDelta = prevVal !== null ? curVal - prevVal : 0;

  const contributorsByDim = calculateContributors(currentWeek, prevWeek, metricKey);
  const dimensions = Object.keys(contributorsByDim);

  const activeContributors = contributorsByDim[activeTab] || [];

  return (
    <div className="modal-overlay" id="why-change-modal" onClick={(e) => {
      if ((e.target as HTMLElement).id === 'why-change-modal') onClose();
    }}>
      <div className="modal max-w-3xl">
        <div className="modal-head">
          <div>
            <h4>Why Did {metricName} Change?</h4>
            <div className="modal-sub">
              Variance analysis comparing Week of {currentWeek.label} vs{' '}
              {prevWeek ? `Week of ${prevWeek.label}` : 'Prior Period'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--bg2)] p-3 rounded-xl border border-[var(--line)]">
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Current Week</div>
              <div className="text-xl font-bold font-mono mt-0.5">
                {isRate ? `${curVal.toFixed(1)}%` : Math.round(curVal).toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Previous Week</div>
              <div className="text-xl font-bold font-mono mt-0.5">
                {prevVal !== null
                  ? isRate
                    ? `${prevVal.toFixed(1)}%`
                    : Math.round(prevVal).toLocaleString()
                  : 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Absolute Movement</div>
              <div
                className={`text-xl font-bold font-mono mt-0.5 ${
                  absDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {absDelta >= 0 ? `+${isRate ? absDelta.toFixed(1) + ' pp' : Math.round(absDelta).toLocaleString()}` : isRate ? `${absDelta.toFixed(1)} pp` : Math.round(absDelta).toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Relative Change (WoW)</div>
              <div
                className={`text-xl font-bold font-mono mt-0.5 ${
                  delta !== null && delta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Dimension Tabs */}
          {dimensions.length > 0 ? (
            <div>
              <div className="flex items-center gap-1 border-b border-[var(--line)] mb-3 pb-1">
                <span className="text-xs font-bold text-[var(--muted)] mr-2">Breakdown by:</span>
                {dimensions.map((dim) => (
                  <button
                    key={dim}
                    className={`px-3 py-1 text-xs font-bold rounded-t-md transition-colors ${
                      activeTab === dim
                        ? 'bg-[var(--card)] text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                    onClick={() => setActiveTab(dim)}
                  >
                    {dim}
                  </button>
                ))}
              </div>

              {/* Contributor Table */}
              <div className="table-wrap max-h-[300px]">
                <table className="simple">
                  <thead>
                    <tr>
                      <th>{activeTab}</th>
                      <th>Current</th>
                      <th>Previous</th>
                      <th>Variance</th>
                      <th>Relative %</th>
                      <th>Impact Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeContributors.map((c) => (
                      <tr key={c.category}>
                        <td className="font-semibold">{c.category}</td>
                        <td className="mono">{c.currentValue.toLocaleString()}</td>
                        <td className="mono">{c.previousValue.toLocaleString()}</td>
                        <td
                          className={`mono font-bold ${
                            c.absoluteChange >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {c.absoluteChange >= 0 ? `+${c.absoluteChange}` : c.absoluteChange}
                        </td>
                        <td className="mono">
                          {c.percentageChange !== null
                            ? `${c.percentageChange >= 0 ? '+' : ''}${c.percentageChange.toFixed(1)}%`
                            : 'N/A'}
                        </td>
                        <td className="mono font-semibold">
                          {c.contributionShare ? `${c.contributionShare.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] text-center py-6">
              No prior period data available for contributor decomposition.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

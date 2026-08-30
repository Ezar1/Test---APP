/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { WeeklyMetricRow } from '../types';
import { evaluateReconciliation } from '../engine/MetricEngine';

interface ReconciliationSectionProps {
  currentWeek: WeeklyMetricRow | null;
}

export const ReconciliationSection: React.FC<ReconciliationSectionProps> = ({ currentWeek }) => {
  if (!currentWeek) return null;

  const recon = evaluateReconciliation(currentWeek);
  const isReconciled = recon.status === 'RECONCILED';

  return (
    <div className="panel mb-4" id="reconciliation-panel">
      <div className="panel-head">
        <div>
          <h3>Allocation Stream Reconciliation</h3>
          <div className="panel-sub">
            Validates: Allocation With Scan ({recon.allocWithScan}) + Allocation Without Scan ({recon.allocWithoutScan}) = Allocation Total ({recon.allocTotal})
          </div>
        </div>
        <span className={`badge ${isReconciled ? 'healthy' : 'attention'}`}>
          {recon.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">With Scan</div>
          <div className="text-xl font-bold font-mono mt-1">{recon.allocWithScan.toLocaleString()}</div>
        </div>

        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Without Scan</div>
          <div className="text-xl font-bold font-mono mt-1">{recon.allocWithoutScan.toLocaleString()}</div>
        </div>

        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Calculated Sum</div>
          <div className="text-xl font-bold font-mono mt-1 text-amber-600 dark:text-amber-400">
            {recon.computedSum.toLocaleString()}
          </div>
        </div>

        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Allocation_raw Total</div>
          <div className="text-xl font-bold font-mono mt-1">{recon.allocTotal.toLocaleString()}</div>
        </div>

        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Variance</div>
          <div className={`text-xl font-bold font-mono mt-1 ${recon.variance === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {recon.variance > 0 ? `+${recon.variance}` : recon.variance}
          </div>
        </div>
      </div>
    </div>
  );
};

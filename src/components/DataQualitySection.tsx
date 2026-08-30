/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DataQualityReport } from '../types';

interface DataQualitySectionProps {
  report: DataQualityReport;
}

export const DataQualitySection: React.FC<DataQualitySectionProps> = ({ report }) => {
  return (
    <div className="panel mb-4" id="data-quality-panel">
      <div className="panel-head">
        <div>
          <h3>Data Integrity & Audit Log</h3>
          <div className="panel-sub">
            Sanitization, row exclusion tracking, and source reconciliation status
          </div>
        </div>
        <span className={`badge ${report.status === 'HEALTHY' ? 'healthy' : report.status === 'WATCH' ? 'watch' : 'attention'}`}>
          {report.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-3">
        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Raw_data Records</div>
          <div className="text-lg font-bold font-mono mt-1 text-[var(--ink)]">
            {report.rawUsable.toLocaleString()} / {report.rawTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-1">
            {report.rawExcludedUnresolvedWeek.toLocaleString()} rows excluded (unresolved week)
          </div>
        </div>

        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Allocation_raw Records</div>
          <div className="text-lg font-bold font-mono mt-1 text-[var(--ink)]">
            {report.allocUsable.toLocaleString()} / {report.allocTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-1">
            {report.allocExcludedUnresolvedWeek.toLocaleString()} rows excluded (unresolved week)
          </div>
        </div>

        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Sanitized Null Sentinels</div>
          <div className="text-lg font-bold font-mono mt-1 text-amber-600 dark:text-amber-400">
            {report.rawSanitizedNulls.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-1">
            Normalized "NaN", "N/A", "-" to true nulls
          </div>
        </div>

        <div className="p-3 bg-[var(--bg2)] rounded-lg border border-[var(--line)]">
          <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Reporting Weeks Loaded</div>
          <div className="text-lg font-bold font-mono mt-1 text-[var(--ink)]">
            {report.weeksLoaded} Weeks
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-1">
            {report.lastFetchedAt ? `Synced ${report.lastFetchedAt.toLocaleTimeString()}` : 'Not synced'}
          </div>
        </div>
      </div>

      <div className="text-xs text-[var(--muted)] leading-relaxed border-t border-[var(--line)] pt-3 flex flex-wrap justify-between gap-2">
        <div>
          <b>Source Spreadsheet ID:</b> <code className="font-mono text-[var(--ink)] bg-[var(--bg2)] px-1.5 py-0.5 rounded">{report.sourceSheetId}</code>
        </div>
        <div>
          <b>Discovered Tabs:</b> {report.tabsFound.join(', ') || 'Raw_data, Allocation_raw'}
        </div>
      </div>
    </div>
  );
};

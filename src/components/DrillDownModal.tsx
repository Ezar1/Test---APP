/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WeeklyMetricRow, RawDataRecord } from '../types';
import { isDateInRange } from '../services/NormalizationLayer';

interface DrillDownModalProps {
  metricKey: string;
  week: WeeklyMetricRow;
  onClose: () => void;
}

const METRIC_LABELS: Record<string, string> = {
  walkins: 'Walk-ins',
  uniqueWalkins: 'Unique Walk-ins',
  repeatedWalkins: 'Repeated Walk-ins',
  onboarding: 'Onboarding',
  drivingTestPassed: 'Driving Test Passed',
  documentation: 'Documentation',
  sdPaid: 'Security Deposit Paid (> ₹500)',
  training: 'Training Completed',
  contract: 'Driver Contract Signed',
  allocated: 'Allocated (In Walk-in Week)',
  notAllotted: 'Not-Allotted',
  sdNotAllocWeekly: 'SD Paid, Not Allocated (Weekly)',
  sdNotAllocTillDate: 'SD Paid, Not Allocated (Till Date Backlog)',
};

export const DrillDownModal: React.FC<DrillDownModalProps> = ({
  metricKey,
  week,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const sundayEnd = new Date(week.sunday.getFullYear(), week.sunday.getMonth(), week.sunday.getDate(), 23, 59, 59, 999);

  // Filter records corresponding to this metric
  const filterPredicate = (r: RawDataRecord): boolean => {
    switch (metricKey) {
      case 'walkins':
        return true;
      case 'uniqueWalkins':
        return r.uniqueTag === 1;
      case 'repeatedWalkins':
        return r.uniqueTag !== null && r.uniqueTag > 1;
      case 'onboarding':
        return isDateInRange(r.onboardingDate, week.monday, sundayEnd);
      case 'drivingTestPassed':
        return isDateInRange(r.drivingTestDate, week.monday, sundayEnd);
      case 'documentation':
        return isDateInRange(r.documentationDate, week.monday, sundayEnd);
      case 'training':
        return isDateInRange(r.trainingDate, week.monday, sundayEnd);
      case 'contract':
        return isDateInRange(r.contractDate, week.monday, sundayEnd);
      case 'sdPaid':
        return r.sdAmount > 500;
      case 'allocated':
        return r.isAllocInWeek > 0 && r.uniqueTag === 1;
      case 'notAllotted':
        return r.isAllocInWeek === 0 && r.uniqueTag === 1;
      case 'sdNotAllocWeekly':
        return r.sdAmount > 500 && r.isAllocInWeek === 0;
      case 'sdNotAllocTillDate':
        return (
          r.sdAmount > 500 &&
          r.isAllocInWeek === 0 &&
          (r.allocFinal === 0 || r.allocFinal === null)
        );
      default:
        return true;
    }
  };

  let matchingRecords = week.rows.filter(filterPredicate);

  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    matchingRecords = matchingRecords.filter(
      (r) =>
        r.identity.toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.leadType && r.leadType.toLowerCase().includes(q)) ||
        (r.agent && r.agent.toLowerCase().includes(q))
    );
  }

  const label = METRIC_LABELS[metricKey] || metricKey;

  return (
    <div
      className="modal-overlay"
      id="drilldown-modal-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === 'drilldown-modal-overlay') onClose();
      }}
    >
      <div className="modal max-w-5xl">
        <div className="modal-head">
          <div>
            <h4>{label} — Detailed Records</h4>
            <div className="modal-sub">
              Week of {week.label} ({week.monday.toLocaleDateString()} – {week.sunday.toLocaleDateString()}) ·{' '}
              {matchingRecords.length.toLocaleString()} matching records{' '}
              {matchingRecords.length > 200 && '(showing first 200)'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="p-3 border-b border-[var(--line)] bg-[var(--bg2)] flex justify-between items-center gap-3">
          <input
            className="search-box w-full max-w-sm"
            placeholder="Search candidate ID, city, lead type, agent…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="text-xs text-[var(--muted)] whitespace-nowrap">
            Displaying {Math.min(matchingRecords.length, 200)} of {matchingRecords.length} records
          </span>
        </div>

        <div className="modal-body p-0">
          <div className="table-wrap max-h-[500px]">
            <table className="simple">
              <thead>
                <tr>
                  <th>Driver / Lead Mapping</th>
                  <th>City</th>
                  <th>Location</th>
                  <th>Lead Type</th>
                  <th>Walk-in Date</th>
                  <th>Onboarded</th>
                  <th>Driving Test</th>
                  <th>SD Deposit</th>
                  <th>Allocated (Wk)</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {matchingRecords.slice(0, 200).map((r, i) => (
                  <tr key={`${r.identity}_${i}`}>
                    <td className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {r.identity}
                    </td>
                    <td>{r.city || '—'}</td>
                    <td>{r.location || '—'}</td>
                    <td>{r.leadType || '—'}</td>
                    <td className="mono">{r.walkinDateDisplay.toLocaleDateString()}</td>
                    <td className="mono">{r.onboardingDate ? r.onboardingDate.toLocaleDateString() : '—'}</td>
                    <td className="mono">{r.drivingTestDate ? r.drivingTestDate.toLocaleDateString() : '—'}</td>
                    <td className="mono font-semibold">
                      {r.sdAmount > 500 ? `₹${r.sdAmount.toLocaleString()}` : r.sdAmount > 0 ? `₹${r.sdAmount}` : '—'}
                    </td>
                    <td>
                      {r.isAllocInWeek > 0 ? (
                        <span className="badge healthy">Yes</span>
                      ) : (
                        <span className="text-[var(--muted)]">No</span>
                      )}
                    </td>
                    <td className="text-xs text-[var(--muted)]">{r.agent || '—'}</td>
                  </tr>
                ))}

                {matchingRecords.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-[var(--muted)]">
                      No records matched this metric and search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

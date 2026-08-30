/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { WeeklyMetricRow } from '../types';

interface KPICardsProps {
  currentWeek: WeeklyMetricRow | null;
  weeks: WeeklyMetricRow[];
  onSelectMetric: (metricKey: string) => void;
}

const KPI_LABELS: Record<string, string> = {
  walkins: 'Walk-ins',
  uniqueWalkins: 'Unique Walk-ins',
  onboarding: 'Onboarding',
  drivingTestPassed: 'Driving Test Passed',
  documentation: 'Documentation',
  sdPaid: 'Security Deposit Paid',
  allocated: 'Allocated',
  notAllotted: 'Not-Allotted',
  allocationRate: 'Allocation Rate',
  sdNotAllocTillDate: 'SD Not Allotted (Till Date)',
};

const HIGHER_IS_BETTER: Record<string, number> = {
  walkins: 1,
  uniqueWalkins: 1,
  onboarding: 1,
  drivingTestPassed: 1,
  documentation: 1,
  sdPaid: 1,
  allocated: 1,
  notAllotted: -1,
  allocationRate: 1,
  sdNotAllocTillDate: -1,
};

function sparklinePath(values: number[], w: number, h: number, pad = 3): string {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    })
    .join(' ');
}

export const KPICards: React.FC<KPICardsProps> = ({
  currentWeek,
  weeks,
  onSelectMetric,
}) => {
  if (!currentWeek) return null;

  const kpiKeys = [
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

  return (
    <div className="kpi-row" id="kpi-row">
      {kpiKeys.map((key) => {
        const val = (currentWeek as any)[key] as number;
        const delta = currentWeek.delta[key];
        const ppDelta = currentWeek.ppDelta[key];
        const dir = HIGHER_IS_BETTER[key] || 0;
        const isGood =
          delta === null ? null : dir === 0 ? null : dir > 0 ? delta >= 0 : delta <= 0;
        const cls = isGood === null ? '' : isGood ? 'pos' : 'neg';
        const deltaCls = delta === null ? 'flat' : isGood ? 'pos' : 'neg';
        const isPct = key === 'allocationRate';

        let deltaTxt = '—';
        if (delta !== null) {
          deltaTxt = `${delta >= 0 ? '▲' : '▼'}${Math.abs(delta).toFixed(1)}%`;
          if (isPct && ppDelta !== null) {
            deltaTxt += ` (${ppDelta >= 0 ? '+' : ''}${ppDelta.toFixed(1)} pp)`;
          }
        }

        const l4wa = currentWeek.l4wa[key];
        const l4waTxt =
          l4wa === null
            ? '—'
            : isPct
            ? `${l4wa.toFixed(1)}%`
            : Math.round(l4wa).toLocaleString();

        const trail = weeks.map((w) => (w as any)[key] as number);
        const sparkD = sparklinePath(trail, 88, 34);
        const last = trail[trail.length - 1];
        const first = trail[0];
        const sparkColor = last >= first ? 'var(--pos)' : 'var(--neg)';

        return (
          <div
            key={key}
            id={`kpi-card-${key}`}
            className={`kpi-card ${cls}`}
            onClick={() => onSelectMetric(key)}
            title="Click to analyze why this changed or view underlying records"
          >
            <div className="kpi-label">{KPI_LABELS[key]}</div>
            <div className="kpi-value">
              {isPct ? `${val.toFixed(1)}%` : Math.round(val).toLocaleString()}
            </div>
            <div className="kpi-meta">
              <span className={`kpi-delta ${deltaCls}`}>{deltaTxt} WoW</span>
              <span className="kpi-l4wa">L4WA {l4waTxt}</span>
            </div>

            <svg className="kpi-spark" viewBox="0 0 88 34" preserveAspectRatio="none">
              <path
                d={sparkD}
                fill="none"
                stroke={sparkColor}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

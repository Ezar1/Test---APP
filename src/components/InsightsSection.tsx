/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { InsightItem } from '../types';

interface InsightsSectionProps {
  insights: InsightItem[];
  onSelectMetric?: (metricKey: string) => void;
}

export const InsightsSection: React.FC<InsightsSectionProps> = ({
  insights,
  onSelectMetric,
}) => {
  if (!insights.length) return null;

  return (
    <div className="panel mb-4" id="insights-panel">
      <div className="panel-head">
        <div>
          <h3>Executive Insights & Operational Alerts</h3>
          <div className="panel-sub">
            Real-time variance signals, contributor swings, and risk thresholds
          </div>
        </div>
      </div>

      <div className="space-y-2.5 mt-2">
        {insights.map((item) => {
          let badgeClass = 'info';
          let borderClass = 'info';
          if (item.level === 'CRITICAL') {
            badgeClass = 'attention';
            borderClass = 'critical';
          } else if (item.level === 'HIGH' || item.level === 'WATCH') {
            badgeClass = 'watch';
            borderClass = item.level === 'HIGH' ? 'high' : 'watch';
          } else if (item.level === 'POSITIVE') {
            badgeClass = 'healthy';
            borderClass = 'positive';
          }

          return (
            <div
              key={item.id}
              className={`insight-card ${borderClass} cursor-pointer transition-transform hover:translate-x-1`}
              onClick={() => item.metricKey && onSelectMetric && onSelectMetric(item.metricKey)}
              title={item.metricKey ? 'Click to inspect related metric details' : undefined}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${badgeClass}`}>{item.level}</span>
                  <h4 className="font-bold text-[13px] text-[var(--ink)]">{item.title}</h4>
                </div>
                <p className="text-[12px] text-[var(--muted)] leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

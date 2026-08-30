/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { WeeklyMetricRow } from '../types';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

interface ChartsSectionProps {
  weeks: WeeklyMetricRow[];
  currentWeek: WeeklyMetricRow | null;
}

const CH_COLORS = {
  amber: '#e8ab35',
  steel: '#5b8def',
  green: '#1f8a54',
  red: '#c33f34',
  slate: '#6d6659',
  violet: '#5b8def',
};

export const ChartsSection: React.FC<ChartsSectionProps> = ({ weeks, currentWeek }) => {
  const trendRef = useRef<HTMLCanvasElement | null>(null);
  const rateRef = useRef<HTMLCanvasElement | null>(null);
  const funnelRef = useRef<HTMLCanvasElement | null>(null);
  const sdRef = useRef<HTMLCanvasElement | null>(null);

  const trendChartInstance = useRef<Chart | null>(null);
  const rateChartInstance = useRef<Chart | null>(null);
  const funnelChartInstance = useRef<Chart | null>(null);
  const sdChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!weeks.length) return;

    const labels = weeks.map((w) => w.label);
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      elements: { point: { radius: 2.5, hoverRadius: 5, hitRadius: 10 } },
    };

    // 1. Weekly Funnel Trend Chart
    if (trendRef.current) {
      if (trendChartInstance.current) trendChartInstance.current.destroy();
      trendChartInstance.current = new Chart(trendRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Walk-ins',
              data: weeks.map((w) => w.walkins),
              borderColor: CH_COLORS.slate,
              backgroundColor: CH_COLORS.slate + '15',
              tension: 0.35,
              borderWidth: 2,
            },
            {
              label: 'Onboarding',
              data: weeks.map((w) => w.onboarding),
              borderColor: CH_COLORS.steel,
              backgroundColor: CH_COLORS.steel + '15',
              tension: 0.35,
              borderWidth: 2,
            },
            {
              label: 'Allocated',
              data: weeks.map((w) => w.allocated),
              borderColor: CH_COLORS.amber,
              backgroundColor: CH_COLORS.amber + '15',
              tension: 0.35,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          ...commonOptions,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 8, usePointStyle: true, padding: 14, font: { size: 11 } },
            },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.14)' } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // 2. Allocation Rate Chart
    if (rateRef.current) {
      if (rateChartInstance.current) rateChartInstance.current.destroy();
      rateChartInstance.current = new Chart(rateRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Allocation Rate %',
              data: weeks.map((w) => w.allocationRate),
              borderColor: CH_COLORS.amber,
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              backgroundColor: (ctx) => {
                const chart = ctx.chart;
                const { ctx: c, chartArea } = chart;
                if (!chartArea) return 'rgba(232,171,53,0.15)';
                const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                g.addColorStop(0, 'rgba(232,171,53,0.35)');
                g.addColorStop(1, 'rgba(232,171,53,0.0)');
                return g;
              },
            },
          ],
        },
        options: {
          ...commonOptions,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Rate: ${Number(ctx.parsed.y).toFixed(1)}%`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => `${v}%` },
              grid: { color: 'rgba(148,163,184,0.14)' },
            },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // 3. Funnel Conversion (Current Week)
    if (funnelRef.current && currentWeek) {
      if (funnelChartInstance.current) funnelChartInstance.current.destroy();
      const stages = [
        ['Walk-ins', currentWeek.walkins],
        ['Unique Walk-ins', currentWeek.uniqueWalkins],
        ['Onboarding', currentWeek.onboarding],
        ['Driving Test', currentWeek.drivingTestPassed],
        ['Documentation', currentWeek.documentation],
        ['SD Paid', currentWeek.sdPaid],
        ['Training', currentWeek.training],
        ['Contract', currentWeek.contract],
        ['Allocated', currentWeek.allocated],
      ];
      const maxVal = currentWeek.walkins || 1;

      funnelChartInstance.current = new Chart(funnelRef.current, {
        type: 'bar',
        data: {
          labels: stages.map((s) => s[0]),
          datasets: [
            {
              data: stages.map((s) => s[1] as number),
              borderRadius: 6,
              maxBarThickness: 40,
              backgroundColor: stages.map((s) => {
                const ratio = (s[1] as number) / maxVal;
                return `rgba(232,171,53,${(0.35 + ratio * 0.65).toFixed(2)})`;
              }),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (c) => {
                  const val = Number(c.parsed.y);
                  const pct = ((val / maxVal) * 100).toFixed(1);
                  return `${val.toLocaleString()} (${pct}% of walk-ins)`;
                },
              },
            },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.14)' } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // 4. SD Paid Not Allocated Chart
    if (sdRef.current) {
      if (sdChartInstance.current) sdChartInstance.current.destroy();
      sdChartInstance.current = new Chart(sdRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Weekly Cohort',
              data: weeks.map((w) => w.sdNotAllocWeekly),
              backgroundColor: CH_COLORS.steel,
              borderRadius: 4,
              maxBarThickness: 24,
            },
            {
              label: 'Till Date Backlog',
              data: weeks.map((w) => w.sdNotAllocTillDate),
              backgroundColor: CH_COLORS.red,
              borderRadius: 4,
              maxBarThickness: 24,
            },
          ],
        },
        options: {
          ...commonOptions,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 8, usePointStyle: true, padding: 14, font: { size: 11 } },
            },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.14)' } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    return () => {
      if (trendChartInstance.current) trendChartInstance.current.destroy();
      if (rateChartInstance.current) rateChartInstance.current.destroy();
      if (funnelChartInstance.current) funnelChartInstance.current.destroy();
      if (sdChartInstance.current) sdChartInstance.current.destroy();
    };
  }, [weeks, currentWeek]);

  return (
    <div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Weekly Funnel Trend</h3>
              <div className="panel-sub">Walk-ins, Onboarding, and Allocated over 8 weeks</div>
            </div>
          </div>
          <div className="h-[240px]">
            <canvas ref={trendRef} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Allocation Rate</h3>
              <div className="panel-sub">Allocated ÷ Unique Walk-ins (%)</div>
            </div>
          </div>
          <div className="h-[240px]">
            <canvas ref={rateRef} />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Funnel Conversion — Current Week</h3>
              <div className="panel-sub">
                {currentWeek ? `Week of ${currentWeek.label}` : 'Current Week'}
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            <canvas ref={funnelRef} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>SD Paid, Not Allocated</h3>
              <div className="panel-sub">Weekly cohort vs running backlog (till date)</div>
            </div>
          </div>
          <div className="h-[240px]">
            <canvas ref={sdRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

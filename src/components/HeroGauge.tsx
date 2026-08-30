/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { WeeklyMetricRow } from '../types';

interface HeroGaugeProps {
  currentWeek: WeeklyMetricRow | null;
  totalWeeksCount: number;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function valueToAngle(v: number) {
  return -120 + (Math.min(100, Math.max(0, v)) / 100) * 240;
}

function arcPath(cx: number, cy: number, r: number, fromV: number, toV: number) {
  const a1 = valueToAngle(fromV);
  const a2 = valueToAngle(toV);
  const p1 = polarPoint(cx, cy, r, a1);
  const p2 = polarPoint(cx, cy, r, a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)},${p1.y.toFixed(2)} A ${r},${r} 0 ${large} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
}

export const HeroGauge: React.FC<HeroGaugeProps> = ({ currentWeek, totalWeeksCount }) => {
  const needleRef = useRef<SVGLineElement | null>(null);

  if (!currentWeek) {
    return null;
  }

  const rate = currentWeek.allocationRate;
  const deltaRate = currentWeek.delta['allocationRate'];
  const ppDeltaRate = currentWeek.ppDelta['allocationRate'];

  const deltaTxt =
    deltaRate === null
      ? 'First reporting week'
      : `${deltaRate >= 0 ? '▲' : '▼'} ${Math.abs(deltaRate).toFixed(1)}% WoW (${ppDeltaRate !== null ? (ppDeltaRate >= 0 ? '+' : '') + ppDeltaRate.toFixed(1) + ' pp' : ''})`;

  const deltaColor =
    deltaRate === null ? '#918c7c' : deltaRate >= 0 ? 'var(--pos)' : 'var(--neg)';

  // Calculate ticks
  const cx = 75;
  const cy = 96;
  const rZone = 68;
  const rTickOut = 68;
  const rTickIn = 58;
  const rLabel = 46;

  const ticks: React.ReactNode[] = [];
  for (let v = 0; v <= 100; v += 5) {
    const major = v % 20 === 0;
    const a = valueToAngle(v);
    const p1 = polarPoint(cx, cy, rTickOut, a);
    const p2 = polarPoint(cx, cy, major ? rTickIn - 6 : rTickIn, a);
    ticks.push(
      <line
        key={`tick-${v}`}
        className={`dial-tick${major ? ' major' : ''}`}
        x1={p1.x.toFixed(1)}
        y1={p1.y.toFixed(1)}
        x2={p2.x.toFixed(1)}
        y2={p2.y.toFixed(1)}
      />
    );
    if (major) {
      const lp = polarPoint(cx, cy, rLabel, a);
      ticks.push(
        <text
          key={`lbl-${v}`}
          className="dial-label"
          x={lp.x.toFixed(1)}
          y={lp.y.toFixed(1)}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {v}
        </text>
      );
    }
  }

  const restTip = polarPoint(cx, cy, 62, valueToAngle(0));
  const sweepDeg = valueToAngle(rate) - valueToAngle(0);

  useEffect(() => {
    if (needleRef.current) {
      needleRef.current.style.transform = 'rotate(0deg)';
      const timer = setTimeout(() => {
        if (needleRef.current) {
          needleRef.current.style.transform = `rotate(${sweepDeg}deg)`;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [sweepDeg]);

  const l4waSd = currentWeek.l4wa['sdNotAllocTillDate'] || 0;
  const isBacklogHigh = currentWeek.sdNotAllocTillDate > l4waSd;

  return (
    <div className="hero-strip" id="hero-strip">
      <div className="hero-gauge-card" id="hero-gauge-card">
        <div className="dial-wrap">
          <svg viewBox="0 0 150 112">
            <path
              d={arcPath(cx, cy, rZone, 0, 35)}
              fill="none"
              stroke="var(--neg)"
              strokeWidth="6"
              opacity="0.55"
            />
            <path
              d={arcPath(cx, cy, rZone, 35, 55)}
              fill="none"
              stroke="var(--amber)"
              strokeWidth="6"
              opacity="0.6"
            />
            <path
              d={arcPath(cx, cy, rZone, 55, 100)}
              fill="none"
              stroke="var(--pos)"
              strokeWidth="6"
              opacity="0.6"
            />
            {ticks}
            <line
              ref={needleRef}
              className="dial-needle"
              x1={cx}
              y1={cy}
              x2={restTip.x.toFixed(1)}
              y2={restTip.y.toFixed(1)}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: `rotate(${sweepDeg}deg)`,
              }}
            />
            <circle className="dial-hub" cx={cx} cy={cy} r="5.5" />
          </svg>
        </div>

        <div className="dial-meta">
          <div className="lcd-screen">
            <div className="lcd-value gold-text">{rate.toFixed(1)}%</div>
            <div className="lcd-caption">
              Allocation Rate · Wk of {currentWeek.label}
            </div>
          </div>
          <div className="hero-meta">
            <div className="hval">
              {currentWeek.allocated.toLocaleString()} / {currentWeek.uniqueWalkins.toLocaleString()}{' '}
              allocated
            </div>
            <div className="hdelta" style={{ color: deltaColor }}>
              {deltaTxt}
            </div>
          </div>
        </div>
      </div>

      <div className="hero-facts" id="hero-facts-panel">
        <div className="hero-fact-row">
          <span>Walk-ins this week (Total / Unique)</span>
          <b>
            {currentWeek.walkins.toLocaleString()} / {currentWeek.uniqueWalkins.toLocaleString()}
          </b>
        </div>
        <div className="hero-fact-row">
          <span>Drivers Reached Contract</span>
          <b>{currentWeek.contract.toLocaleString()}</b>
        </div>
        <div className="hero-fact-row">
          <span>SD Paid, Not Yet Allocated (Till Date Backlog)</span>
          <b style={{ color: isBacklogHigh ? 'var(--neg)' : 'var(--ink)' }}>
            {currentWeek.sdNotAllocTillDate.toLocaleString()}{' '}
            {isBacklogHigh && <span className="text-xs font-normal text-red-500">(Above L4WA {Math.round(l4waSd)})</span>}
          </b>
        </div>
        <div className="hero-fact-row">
          <span>Reporting Weeks Loaded</span>
          <b>{totalWeeksCount} Weeks (Mon–Sun)</b>
        </div>
      </div>
    </div>
  );
};

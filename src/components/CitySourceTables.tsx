/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WeeklyMetricRow, RawDataRecord } from '../types';

interface CitySourceTablesProps {
  currentWeek: WeeklyMetricRow | null;
  onSelectCity: (city: string) => void;
}

export const CitySourceTables: React.FC<CitySourceTablesProps> = ({
  currentWeek,
  onSelectCity,
}) => {
  const [citySearch, setCitySearch] = useState('');
  const [citySortKey, setCitySortKey] = useState<string>('walkins');
  const [citySortDir, setCitySortDir] = useState<number>(-1);

  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceSortKey, setSourceSortKey] = useState<string>('walkins');
  const [sourceSortDir, setSourceSortDir] = useState<number>(-1);

  if (!currentWeek) return null;

  // 1. Group by City
  const cityMap = new Map<string, RawDataRecord[]>();
  currentWeek.rows.forEach((r) => {
    const c = r.city || 'Unassigned';
    if (!cityMap.has(c)) cityMap.set(c, []);
    cityMap.get(c)!.push(r);
  });

  let cityRows = Array.from(cityMap.entries()).map(([city, rows]) => {
    const walkins = rows.length;
    const uniqueWalkins = rows.filter((r) => r.uniqueTag === 1).length;
    const onboarding = rows.filter((r) => r.onboardingDate !== null).length;
    const allocated = rows.filter((r) => r.isAllocInWeek > 0 && r.uniqueTag === 1).length;
    const rate = uniqueWalkins > 0 ? (allocated / uniqueWalkins) * 100 : 0;
    const sdBacklog = rows.filter(
      (r) => r.sdAmount > 500 && r.isAllocInWeek === 0 && (r.allocFinal === 0 || r.allocFinal === null)
    ).length;

    return {
      city,
      walkins,
      uniqueWalkins,
      onboarding,
      allocated,
      rate,
      sdBacklog,
    };
  });

  if (citySearch.trim()) {
    const q = citySearch.toLowerCase();
    cityRows = cityRows.filter((r) => r.city.toLowerCase().includes(q));
  }

  cityRows.sort((a: any, b: any) => {
    const vA = a[citySortKey];
    const vB = b[citySortKey];
    if (typeof vA === 'string') {
      return citySortDir * vA.localeCompare(vB);
    }
    return citySortDir * (vA - vB);
  });

  // 2. Group by Source Category
  const sourceMap = new Map<string, RawDataRecord[]>();
  currentWeek.rows.forEach((r) => {
    const s = r.sourceCategory || 'Unassigned';
    if (!sourceMap.has(s)) sourceMap.set(s, []);
    sourceMap.get(s)!.push(r);
  });

  let sourceRows = Array.from(sourceMap.entries()).map(([source, rows]) => {
    const walkins = rows.length;
    const uniqueWalkins = rows.filter((r) => r.uniqueTag === 1).length;
    const onboarding = rows.filter((r) => r.onboardingDate !== null).length;
    const allocated = rows.filter((r) => r.isAllocInWeek > 0 && r.uniqueTag === 1).length;
    const rate = uniqueWalkins > 0 ? (allocated / uniqueWalkins) * 100 : 0;

    return {
      source,
      walkins,
      uniqueWalkins,
      onboarding,
      allocated,
      rate,
    };
  });

  if (sourceSearch.trim()) {
    const q = sourceSearch.toLowerCase();
    sourceRows = sourceRows.filter((r) => r.source.toLowerCase().includes(q));
  }

  sourceRows.sort((a: any, b: any) => {
    const vA = a[sourceSortKey];
    const vB = b[sourceSortKey];
    if (typeof vA === 'string') {
      return sourceSortDir * vA.localeCompare(vB);
    }
    return sourceSortDir * (vA - vB);
  });

  const getHealthBadge = (rate: number) => {
    if (rate >= 55) return <span className="badge healthy">Healthy</span>;
    if (rate >= 35) return <span className="badge watch">Watch</span>;
    return <span className="badge attention">Attention</span>;
  };

  const handleCitySort = (key: string) => {
    if (citySortKey === key) {
      setCitySortDir(citySortDir * -1);
    } else {
      setCitySortKey(key);
      setCitySortDir(-1);
    }
  };

  const handleSourceSort = (key: string) => {
    if (sourceSortKey === key) {
      setSourceSortDir(sourceSortDir * -1);
    } else {
      setSourceSortKey(key);
      setSourceSortDir(-1);
    }
  };

  return (
    <div className="grid-2 mb-4">
      {/* City Table */}
      <div className="panel" id="city-performance-panel">
        <div className="panel-head">
          <div>
            <h3>City Performance — Current Week</h3>
            <div className="panel-sub">Week of {currentWeek.label} · Click city to filter</div>
          </div>
          <input
            className="search-box"
            placeholder="Search city…"
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            id="city-search-input"
          />
        </div>

        <div className="table-wrap max-h-[360px]">
          <table className="simple" id="city-table">
            <thead>
              <tr>
                <th onClick={() => handleCitySort('city')} className={citySortKey === 'city' ? 'sorted' : ''}>
                  City <span className="sort-ic">{citySortKey === 'city' ? (citySortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleCitySort('walkins')} className={citySortKey === 'walkins' ? 'sorted' : ''}>
                  Walk-ins <span className="sort-ic">{citySortKey === 'walkins' ? (citySortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleCitySort('allocated')} className={citySortKey === 'allocated' ? 'sorted' : ''}>
                  Allocated <span className="sort-ic">{citySortKey === 'allocated' ? (citySortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleCitySort('rate')} className={citySortKey === 'rate' ? 'sorted' : ''}>
                  Rate <span className="sort-ic">{citySortKey === 'rate' ? (citySortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleCitySort('sdBacklog')} className={citySortKey === 'sdBacklog' ? 'sorted' : ''}>
                  SD Backlog <span className="sort-ic">{citySortKey === 'sdBacklog' ? (citySortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cityRows.length > 0 ? (
                cityRows.map((r) => (
                  <tr
                    key={r.city}
                    onClick={() => onSelectCity(r.city)}
                    title={`Click to filter by ${r.city}`}
                  >
                    <td className="font-semibold text-amber-600 dark:text-amber-400">{r.city}</td>
                    <td className="mono">{r.walkins.toLocaleString()}</td>
                    <td className="mono">{r.allocated.toLocaleString()}</td>
                    <td className="mono font-semibold">{r.rate.toFixed(1)}%</td>
                    <td className="mono text-red-600 dark:text-red-400">{r.sdBacklog.toLocaleString()}</td>
                    <td>{getHealthBadge(r.rate)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-[var(--muted)]">
                    No matching cities found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source Category Table */}
      <div className="panel" id="source-performance-panel">
        <div className="panel-head">
          <div>
            <h3>Source Category Performance</h3>
            <div className="panel-sub">Volume & conversion by lead acquisition channel</div>
          </div>
          <input
            className="search-box"
            placeholder="Search source…"
            value={sourceSearch}
            onChange={(e) => setSourceSearch(e.target.value)}
            id="source-search-input"
          />
        </div>

        <div className="table-wrap max-h-[360px]">
          <table className="simple" id="source-table">
            <thead>
              <tr>
                <th onClick={() => handleSourceSort('source')} className={sourceSortKey === 'source' ? 'sorted' : ''}>
                  Source <span className="sort-ic">{sourceSortKey === 'source' ? (sourceSortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleSourceSort('walkins')} className={sourceSortKey === 'walkins' ? 'sorted' : ''}>
                  Walk-ins <span className="sort-ic">{sourceSortKey === 'walkins' ? (sourceSortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleSourceSort('onboarding')} className={sourceSortKey === 'onboarding' ? 'sorted' : ''}>
                  Onboarded <span className="sort-ic">{sourceSortKey === 'onboarding' ? (sourceSortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleSourceSort('allocated')} className={sourceSortKey === 'allocated' ? 'sorted' : ''}>
                  Allocated <span className="sort-ic">{sourceSortKey === 'allocated' ? (sourceSortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
                <th onClick={() => handleSourceSort('rate')} className={sourceSortKey === 'rate' ? 'sorted' : ''}>
                  Rate <span className="sort-ic">{sourceSortKey === 'rate' ? (sourceSortDir === 1 ? '▲' : '▼') : '↕'}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.length > 0 ? (
                sourceRows.map((r) => (
                  <tr key={r.source}>
                    <td className="font-semibold">{r.source}</td>
                    <td className="mono">{r.walkins.toLocaleString()}</td>
                    <td className="mono">{r.onboarding.toLocaleString()}</td>
                    <td className="mono">{r.allocated.toLocaleString()}</td>
                    <td className="mono font-semibold">{r.rate.toFixed(1)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-[var(--muted)]">
                    No matching source channels found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

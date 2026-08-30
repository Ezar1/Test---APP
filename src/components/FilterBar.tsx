/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FilterState, FilterOptions, WeeklyMetricRow } from '../types';

interface FilterBarProps {
  filters: FilterState;
  options: FilterOptions;
  weeks: WeeklyMetricRow[];
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onClearFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  options,
  weeks,
  onFilterChange,
  onClearFilters,
}) => {
  const filterDefinitions: { key: keyof FilterOptions; label: string }[] = [
    { key: 'city', label: 'City' },
    { key: 'location', label: 'Location' },
    { key: 'leadType', label: 'Lead Type' },
    { key: 'sourceCategory', label: 'Source Category' },
    { key: 'businessVertical', label: 'Business Vertical' },
  ];

  const hasActiveFilters =
    Boolean(filters.city) ||
    Boolean(filters.location) ||
    Boolean(filters.leadType) ||
    Boolean(filters.sourceCategory) ||
    Boolean(filters.businessVertical) ||
    Boolean(filters.selectedWeekKey);

  const activeSummaries: string[] = [];
  if (filters.city) activeSummaries.push(`City: ${filters.city}`);
  if (filters.location) activeSummaries.push(`Location: ${filters.location}`);
  if (filters.leadType) activeSummaries.push(`Lead Type: ${filters.leadType}`);
  if (filters.sourceCategory) activeSummaries.push(`Source: ${filters.sourceCategory}`);
  if (filters.businessVertical) activeSummaries.push(`Vertical: ${filters.businessVertical}`);
  if (filters.selectedWeekKey) {
    const matched = weeks.find((w) => w.key === filters.selectedWeekKey);
    activeSummaries.push(`Week: ${matched ? matched.label : filters.selectedWeekKey}`);
  }

  return (
    <div>
      <div className="filterbar" id="filterbar">
        {/* Reporting Week selector */}
        <div className="f">
          <label htmlFor="filter-week">Reporting Week</label>
          <select
            id="filter-week"
            value={filters.selectedWeekKey}
            onChange={(e) => onFilterChange('selectedWeekKey', e.target.value)}
          >
            <option value="">Latest Week ({weeks[weeks.length - 1]?.label || 'Latest'})</option>
            {weeks.map((w) => (
              <option key={w.key} value={w.key}>
                Week of {w.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Category Selectors */}
        {filterDefinitions.map(({ key, label }) => (
          <div className="f" key={key}>
            <label htmlFor={`filter-${key}`}>{label}</label>
            <select
              id={`filter-${key}`}
              value={filters[key]}
              onChange={(e) => onFilterChange(key, e.target.value)}
            >
              <option value="">All {label}s</option>
              {options[key].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        ))}

        {hasActiveFilters && (
          <button className="f-clear" id="clear-filters-btn" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="filter-summary" id="filter-summary">
        {activeSummaries.length > 0
          ? activeSummaries.join('  •  ')
          : 'Showing All India, all locations, categories, sources, and verticals'}
      </div>
    </div>
  );
};

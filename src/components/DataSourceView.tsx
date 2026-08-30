/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { TARGET_SPREADSHEET_ID } from '../services/GoogleSheetDataService';

interface DataSourceViewProps {
  currentUser: User | null;
  onSignIn: () => void;
  onFetchLiveSheet: () => void;
  onFileUpload: (files: File[]) => void;
  isLoading: boolean;
  rawCount: number;
  allocCount: number;
  lastFetchedAt: Date | null;
  tabsFound: string[];
}

export const DataSourceView: React.FC<DataSourceViewProps> = ({
  currentUser,
  onSignIn,
  onFetchLiveSheet,
  onFileUpload,
  isLoading,
  rawCount,
  allocCount,
  lastFetchedAt,
  tabsFound,
}) => {
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [allocFiles, setAllocFiles] = useState<File[]>([]);

  const handleRawChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setRawFiles(Array.from(e.target.files));
    }
  };

  const handleAllocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAllocFiles(Array.from(e.target.files));
    }
  };

  const handleComputeLocal = () => {
    const combined = [...rawFiles, ...allocFiles];
    if (combined.length > 0) {
      onFileUpload(combined);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Live Google Sheet Connection Panel */}
      <div className="panel border-2 border-amber-500/30" id="live-sheet-panel">
        <div className="panel-head">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl font-bold font-serif">
              GS
            </div>
            <div>
              <h3>Live Google Sheets Connection (Primary Source)</h3>
              <div className="panel-sub">
                Official Google Workspace read-only integration
              </div>
            </div>
          </div>
          <span className="badge healthy">Read-Only</span>
        </div>

        <div className="bg-[var(--bg2)] p-4 rounded-xl border border-[var(--line)] space-y-2.5 my-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[var(--muted)] font-medium">Target Spreadsheet ID:</span>
            <code className="font-mono text-[var(--ink)] bg-[var(--card)] px-2 py-0.5 rounded border border-[var(--line)]">
              {TARGET_SPREADSHEET_ID}
            </code>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[var(--muted)] font-medium">Spreadsheet URL:</span>
            <a
              href={`https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-600 dark:text-amber-400 hover:underline break-all"
            >
              Open Live Spreadsheet in Google Sheets ↗
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[var(--muted)] font-medium">Authentication Status:</span>
            <span>
              {currentUser ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Signed in as {currentUser.email}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  ⚠️ Google Account sign-in required for private live sheet access
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          {currentUser ? (
            <button
              className="btn btn-teal"
              onClick={onFetchLiveSheet}
              disabled={isLoading}
            >
              {isLoading ? 'Fetching Live Sheet…' : '↻ Sync Live Google Sheet Now'}
            </button>
          ) : (
            <button className="btn btn-teal" onClick={onSignIn} disabled={isLoading}>
              Sign in with Google to Connect Live Sheet
            </button>
          )}
        </div>
      </div>

      {/* Local Workbook Upload Gate (Approved Design Fallback) */}
      <div className="panel" id="manual-upload-panel">
        <div className="panel-head">
          <div>
            <h3>Local Workbook Upload (Offline / Export Mode)</h3>
            <div className="panel-sub">
              Upload exported <code>Raw_data</code> and <code>Allocation_raw</code> workbooks or CSV files
            </div>
          </div>
        </div>

        <div className="drop-row mt-4">
          <div className={`dropzone ${rawFiles.length ? 'filled' : ''}`} id="dz-raw">
            <label htmlFor="file-raw-input">
              <div className="dz-title">Raw_data Workbook / CSV</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {rawFiles.length
                  ? rawFiles.map((f) => f.name).join(', ')
                  : 'Click or drop Raw_data file(s)'}
              </div>
            </label>
            <input
              type="file"
              id="file-raw-input"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={handleRawChange}
            />
          </div>

          <div className={`dropzone ${allocFiles.length ? 'filled' : ''}`} id="dz-alloc">
            <label htmlFor="file-alloc-input">
              <div className="dz-title">Allocation_raw Workbook / CSV</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {allocFiles.length
                  ? allocFiles.map((f) => f.name).join(', ')
                  : 'Click or drop Allocation_raw file(s)'}
              </div>
            </label>
            <input
              type="file"
              id="file-alloc-input"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={handleAllocChange}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            className="btn btn-ghost"
            onClick={handleComputeLocal}
            disabled={rawFiles.length === 0 && allocFiles.length === 0}
          >
            Compute Metrics from Uploaded Files
          </button>
        </div>
      </div>

      {/* Dataset Summary */}
      <div className="panel" id="current-dataset-status-panel">
        <h3>Current In-Memory Dataset Status</h3>
        <div className="text-xs text-[var(--muted)] mt-2 leading-relaxed space-y-1">
          <div>
            <b>Raw_data records:</b> {rawCount.toLocaleString()} usable candidates
          </div>
          <div>
            <b>Allocation_raw records:</b> {allocCount.toLocaleString()} usable records
          </div>
          <div>
            <b>Discovered Sheet Tabs:</b> {tabsFound.join(' · ') || 'None yet'}
          </div>
          <div>
            <b>Last Computed:</b> {lastFetchedAt ? lastFetchedAt.toLocaleString() : 'Never'}
          </div>
        </div>
      </div>
    </div>
  );
};

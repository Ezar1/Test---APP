/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  RawDataRecord,
  AllocationRecord,
  FilterState,
  FilterOptions,
  WeeklyMetricRow,
  DataQualityReport,
  InsightItem,
  ApprovedUserProfile,
  ProviderSettingsState,
  AIProviderId,
} from './types';
import { initAuth, googleSignIn, signInWithMobileOrEmail, logout } from './services/auth';
import { checkUserAccess, recordServerLogout } from './config/accessControl';
import { AIAnalystService } from './services/AIAnalystService';
import { ToolContext } from './engine/ControlledAnalyticsTools';
import {
  fetchLiveGoogleSheet,
  parseUploadedFiles,
  getActiveSpreadsheetId,
  setActiveSpreadsheetId,
} from './services/GoogleSheetDataService';
import {
  normalizeRawData,
  normalizeAllocationData,
} from './services/NormalizationLayer';
import {
  INITIAL_FILTER_STATE,
  extractFilterOptions,
  filterRecords,
} from './engine/FilterEngine';
import { computeWeeklyMetrics } from './engine/MetricEngine';
import { generateDynamicInsights } from './engine/InsightEngine';

import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { LoginPage } from './components/LoginPage';
import { UnauthorizedScreen } from './components/UnauthorizedScreen';
import { FilterBar } from './components/FilterBar';
import { HeroGauge } from './components/HeroGauge';
import { KPICards } from './components/KPICards';
import { ChartsSection } from './components/ChartsSection';
import { WeeklyMatrix } from './components/WeeklyMatrix';
import { CitySourceTables } from './components/CitySourceTables';
import { ReconciliationSection } from './components/ReconciliationSection';
import { DataQualitySection } from './components/DataQualitySection';
import { WhyChangeModal } from './components/WhyChangeModal';
import { DrillDownModal } from './components/DrillDownModal';
import { DataSourceView } from './components/DataSourceView';
import { SettingsView } from './components/SettingsView';
import { AIAnalystView } from './components/AIAnalystView';
import { TATReportSection } from './components/TATReportSection';
import { EverestLogo } from './components/EverestLogo';

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ef-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ef-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('weekly');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Authentication & Access Control state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<ApprovedUserProfile | null>(null);
  const [isAccessApproved, setIsAccessApproved] = useState<boolean | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // AI Provider state
  const [providerSettings, setProviderSettings] = useState<ProviderSettingsState>({
    activeProvider: 'gemini',
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      model: 'gemini-3.7-flash',
      configured: true,
      status: 'CONFIGURED',
      note: 'Native Google GenAI analytical function synthesis',
    },
    claude: {
      id: 'claude',
      name: 'Anthropic Claude',
      model: 'claude-3-5-sonnet-20241022',
      configured: false,
      status: 'NOT CONFIGURED',
      note: 'Claude unavailable — provider not configured.',
    },
  });

  // Refresh provider settings on mount
  const refreshProviderSettings = useCallback(async () => {
    const state = await AIAnalystService.checkProviders();
    setProviderSettings(state);
  }, []);

  useEffect(() => {
    refreshProviderSettings();
  }, [refreshProviderSettings]);

  // Loading & status state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [discoveredTabs, setDiscoveredTabs] = useState<string[]>([]);

  // Raw dataset state
  const [allRawRecords, setAllRawRecords] = useState<RawDataRecord[]>([]);
  const [allAllocRecords, setAllAllocRecords] = useState<AllocationRecord[]>([]);
  const [dataAudit, setDataAudit] = useState<{
    rawTotal: number;
    rawUsable: number;
    rawExcluded: number;
    rawSanitizedNulls: number;
    allocTotal: number;
    allocUsable: number;
    allocExcluded: number;
  }>({
    rawTotal: 0,
    rawUsable: 0,
    rawExcluded: 0,
    rawSanitizedNulls: 0,
    allocTotal: 0,
    allocUsable: 0,
    allocExcluded: 0,
  });

  // Filter state
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);

  // Modals state
  const [whyChangeMetricKey, setWhyChangeMetricKey] = useState<string | null>(null);
  const [drillDownState, setDrillDownState] = useState<{
    metricKey: string;
    week: WeeklyMetricRow;
  } | null>(null);

  // Ingestion: Live Google Sheets (Strict 2-sheet load for Raw_data + Allocation_raw)
  const loadFromGoogleSheets = useCallback(async (customSpreadsheetId?: string) => {
    setIsLoading(true);
    const targetId = customSpreadsheetId || getActiveSpreadsheetId();
    setLoadingMessage(`Connecting to operational Google Sheet (${targetId})…`);
    setErrorMessage('');

    try {
      const result = await fetchLiveGoogleSheet(targetId);
      setLoadingMessage('Normalizing raw records and computing milestone metrics…');

      const rawResult = normalizeRawData(result.rawRows);
      const allocResult = normalizeAllocationData(result.allocRows);

      setAllRawRecords(rawResult.records);
      setAllAllocRecords(allocResult.records);
      setDiscoveredTabs(result.tabsFound);
      setLastFetchedAt(result.lastFetchedAt);

      setDataAudit({
        rawTotal: rawResult.audit.rawTotal,
        rawUsable: rawResult.audit.rawUsable,
        rawExcluded: rawResult.audit.rawExcluded,
        rawSanitizedNulls: rawResult.audit.rawSanitizedNulls,
        allocTotal: result.allocRows.length,
        allocUsable: allocResult.usableCount,
        allocExcluded: allocResult.excludedCount,
      });

      setFilters(INITIAL_FILTER_STATE);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read operational data from Google Sheet.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Ingestion: Local file upload
  const loadFromUploadedFiles = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setLoadingMessage('Reading and parsing Excel/CSV files…');
    setErrorMessage('');

    try {
      const result = await parseUploadedFiles(files);
      setLoadingMessage('Normalizing raw dataset and building cohort weeks…');

      const rawResult = normalizeRawData(result.rawRows);
      const allocResult = normalizeAllocationData(result.allocRows);

      setAllRawRecords(rawResult.records);
      setAllAllocRecords(allocResult.records);
      setDiscoveredTabs(result.tabsFound);
      setLastFetchedAt(result.lastFetchedAt);

      setDataAudit({
        rawTotal: rawResult.audit.rawTotal,
        rawUsable: rawResult.audit.rawUsable,
        rawExcluded: rawResult.audit.rawExcluded,
        rawSanitizedNulls: rawResult.audit.rawSanitizedNulls,
        allocTotal: result.allocRows.length,
        allocUsable: allocResult.usableCount,
        allocExcluded: allocResult.excludedCount,
      });

      setFilters(INITIAL_FILTER_STATE);
      setActiveTab('weekly');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse workbook files.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auth Lifecycle & Access Validation Hook
  useEffect(() => {
    setIsAuthChecking(true);
    const unsubscribe = initAuth(
      async (user) => {
        setCurrentUser(user);
        if (user && user.email) {
          const check = await checkUserAccess(user.email);
          setIsAccessApproved(check.approved);
          setUserProfile({
            email: user.email,
            name: check.name || user.displayName || user.email.split('@')[0],
            role: check.role || 'Operations Analyst',
            photoUrl: user.photoURL,
            approved: check.approved,
          });

          if (check.approved) {
            loadFromGoogleSheets();
          }
        } else {
          setIsAccessApproved(false);
          setUserProfile(null);
        }
        setIsAuthChecking(false);
      },
      () => {
        setCurrentUser(null);
        setUserProfile(null);
        setIsAccessApproved(false);
        setIsAuthChecking(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadFromGoogleSheets]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Authenticating Google account…');
      const result = await googleSignIn();
      if (result && result.user) {
        setCurrentUser(result.user);
        const check = await checkUserAccess(result.user.email);
        setIsAccessApproved(check.approved);
        setUserProfile({
          email: result.user.email || '',
          name: check.name || result.user.displayName || 'Authorized User',
          role: check.role || 'Operations Analyst',
          photoUrl: result.user.photoURL,
          approved: check.approved,
        });

        if (check.approved) {
          await loadFromGoogleSheets();
        }
      }
    } catch (err: any) {
      setErrorMessage(`Sign-in failed: ${err.message || 'Authentication cancelled or failed.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMobileSignIn = async (identifier: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage('Verifying credentials…');
      setErrorMessage('');
      const user = await signInWithMobileOrEmail(identifier);
      setCurrentUser(user);
      const check = await checkUserAccess(user.email);
      setIsAccessApproved(check.approved);
      setUserProfile({
        email: user.email || '',
        name: check.name || user.displayName || 'Authorized User',
        role: check.role || 'Operations Analyst',
        photoUrl: user.photoURL,
        approved: check.approved,
      });

      if (check.approved) {
        await loadFromGoogleSheets();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (currentUser?.email) {
      await recordServerLogout(currentUser.email);
    }
    await logout();
    setCurrentUser(null);
    setUserProfile(null);
    setIsAccessApproved(false);
    setAllRawRecords([]);
    setAllAllocRecords([]);
  };

  // Extract unique options for filter dropdowns based on all loaded records
  const filterOptions: FilterOptions = useMemo(() => {
    return extractFilterOptions(allRawRecords);
  }, [allRawRecords]);

  // Apply active filters to in-memory datasets
  const { filteredRaw, filteredAlloc } = useMemo(() => {
    return filterRecords(allRawRecords, allAllocRecords, filters);
  }, [allRawRecords, allAllocRecords, filters]);

  // Compute Weekly Metrics (8 chronological weeks)
  const weeks: WeeklyMetricRow[] = useMemo(() => {
    return computeWeeklyMetrics(filteredRaw, filteredAlloc, 8);
  }, [filteredRaw, filteredAlloc]);

  // Active / selected reporting week
  const currentWeek: WeeklyMetricRow | null = useMemo(() => {
    if (!weeks.length) return null;
    if (filters.selectedWeekKey) {
      const found = weeks.find((w) => w.key === filters.selectedWeekKey);
      if (found) return found;
    }
    return weeks[weeks.length - 1]; // Default to latest week
  }, [weeks, filters.selectedWeekKey]);

  // Previous week for WoW comparisons
  const prevWeek: WeeklyMetricRow | null = useMemo(() => {
    if (!currentWeek || !weeks.length) return null;
    const idx = weeks.findIndex((w) => w.key === currentWeek.key);
    return idx > 0 ? weeks[idx - 1] : null;
  }, [weeks, currentWeek]);

  // Data Quality Report
  const dataQualityReport: DataQualityReport = useMemo(() => {
    let status: 'HEALTHY' | 'WATCH' | 'ERROR' = 'HEALTHY';
    if (dataAudit.rawExcluded > dataAudit.rawUsable * 0.1) status = 'WATCH';
    if (allRawRecords.length === 0) status = 'WATCH';

    return {
      rawTotal: dataAudit.rawTotal,
      rawUsable: dataAudit.rawUsable,
      rawExcludedUnresolvedWeek: dataAudit.rawExcluded,
      rawSanitizedNulls: dataAudit.rawSanitizedNulls,
      allocTotal: dataAudit.allocTotal,
      allocUsable: dataAudit.allocUsable,
      allocExcludedUnresolvedWeek: dataAudit.allocExcluded,
      missingUuidCount: currentWeek ? currentWeek.allocWithoutUuid : 0,
      weeksLoaded: weeks.length,
      lastFetchedAt,
      sourceSheetId: getActiveSpreadsheetId(),
      tabsFound: discoveredTabs,
      status,
    };
  }, [dataAudit, allRawRecords.length, currentWeek, weeks.length, lastFetchedAt, discoveredTabs]);

  // Tool Context for AI Analyst & Controlled Engine
  const toolContext: ToolContext = useMemo(() => {
    return {
      allRaw: allRawRecords,
      allAlloc: allAllocRecords,
      filters,
      activeWeek: currentWeek,
      weeks,
      dataAudit,
      lastFetchedAt,
      tabsFound: discoveredTabs,
    };
  }, [allRawRecords, allAllocRecords, filters, currentWeek, weeks, dataAudit, lastFetchedAt, discoveredTabs]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTER_STATE);
  };

  // AI Action link handler to jump to dashboard view
  const handleApplyActionLink = (filterType: string, filterValue: string) => {
    if (filterType === 'city') {
      handleFilterChange('city', filterValue);
    } else if (filterType === 'vertical') {
      handleFilterChange('businessVertical', filterValue);
    } else if (filterType === 'sourceCategory') {
      handleFilterChange('sourceCategory', filterValue);
    } else if (filterType === 'weekKey') {
      handleFilterChange('selectedWeekKey', filterValue);
    }
    setActiveTab('weekly');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Role verification for active tabs
  const userRole = (userProfile?.role || '').toUpperCase();
  const isAdmin = userRole.includes('ADMIN') || userRole === 'EXECUTIVE ADMINISTRATOR';
  const isViewer = userRole === 'VIEWER';

  // Guard tab navigation
  useEffect(() => {
    if (isViewer && (activeTab === 'analyst' || activeTab === 'settings')) {
      setActiveTab('weekly');
    }
    if (!isAdmin && activeTab === 'settings') {
      // Analysts can view Data tab instead
      setActiveTab('data');
    }
  }, [activeTab, isAdmin, isViewer]);

  // Authentication Gates
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8f6f0]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex justify-center">
            <EverestLogo size="lg" showText={true} />
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-4 h-4 border-2 border-[#d49b28] border-t-transparent rounded-full animate-spin" />
            <div className="text-xs font-mono font-medium text-[#736d5e] tracking-wide">
              Restoring verified Everest session…
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 1. If not logged in -> Show Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onMobileSignIn={handleMobileSignIn}
        isLoading={isLoading}
        loadingMessage={loadingMessage}
        errorMessage={errorMessage}
      />
    );
  }

  // 2. If logged in but NOT approved -> Show Unauthorized Screen
  if (isAccessApproved === false) {
    return <UnauthorizedScreen user={currentUser} onSignOut={handleSignOut} />;
  }

  const hasData = allRawRecords.length > 0;

  const topbarSubtitle = hasData
    ? `${allRawRecords.length.toLocaleString()} onboarding records · ${allAllocRecords.length.toLocaleString()} allocation records`
    : 'Connected to live operational data source';

  const lastComputedText = lastFetchedAt
    ? `Computed ${lastFetchedAt.toLocaleTimeString()}`
    : 'Ready';

  return (
    <div className="shell min-h-screen">
      {/* Sidebar with Role-Based Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lastLoadedText={
          lastFetchedAt
            ? `Synced ${lastFetchedAt.toLocaleTimeString()}`
            : 'Live Google Sheets'
        }
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        userProfile={userProfile}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="main flex-1 flex flex-col min-w-0">
        <Topbar
          activeTab={activeTab}
          subtitle={topbarSubtitle}
          lastComputedText={lastComputedText}
          isRefreshing={isLoading}
          onRefresh={() => loadFromGoogleSheets()}
          theme={theme}
          onToggleTheme={toggleTheme}
          currentUser={currentUser}
          userProfile={userProfile}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onNavigateToTab={(tab) => setActiveTab(tab)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        <div className="content flex-1">
          {/* Error Banner if any */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 p-4 rounded-xl mb-4 text-xs flex justify-between items-center gap-3">
              <div>
                <b>Connection Status:</b> {errorMessage}
              </div>
              <button
                className="text-red-500 hover:text-red-700 font-bold"
                onClick={() => setErrorMessage('')}
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: WEEKLY VIEW (Preserved, 100% Intact) */}
          {activeTab === 'weekly' && (
            <div>
              {!hasData ? (
                /* Connect Prompt when no data is loaded */
                <div className="upload-gate" id="upload-gate">
                  <div className="ic">⇪</div>
                  <h3>Connect Everest India Onboarding Data</h3>
                  <p>
                    Load live operational metrics from Google Sheets or
                    upload <code>Raw_data</code> + <code>Allocation_raw</code> workbooks. All calculations execute client-side with zero data modification.
                  </p>

                  <div className="space-y-3 mb-6">
                    <button
                      className="btn btn-teal w-full py-3.5 text-sm"
                      onClick={() => loadFromGoogleSheets()}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Connecting to Google Sheets…' : 'Sync Live Google Sheet (Primary Source)'}
                    </button>
                  </div>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-[var(--line)]"></div>
                    <span className="flex-shrink mx-4 text-xs font-mono text-[var(--muted)] uppercase">
                      or upload files locally
                    </span>
                    <div className="flex-grow border-t border-[var(--line)]"></div>
                  </div>

                  <div className="mt-4">
                    <button
                      className="btn btn-ghost w-full py-2.5 text-xs"
                      onClick={() => setActiveTab('data')}
                    >
                      Open File Upload Dropzone
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Weekly Non-Funnel Dashboard */
                <div id="dashboard-body" className="space-y-4">
                  {/* Global Dynamic Filter Bar */}
                  <FilterBar
                    filters={filters}
                    options={filterOptions}
                    weeks={weeks}
                    onFilterChange={handleFilterChange}
                    onClearFilters={handleClearFilters}
                  />

                  {/* Hero Gauge */}
                  <HeroGauge
                    currentWeek={currentWeek}
                    totalWeeksCount={weeks.length}
                  />

                  {/* KPI Command Center Cards */}
                  <KPICards
                    currentWeek={currentWeek}
                    weeks={weeks}
                    onSelectMetric={(mKey) => setWhyChangeMetricKey(mKey)}
                  />

                  {/* Interactive Chart Visualizations */}
                  <ChartsSection weeks={weeks} currentWeek={currentWeek} />

                  {/* Weekly 17-Metric Funnel Matrix */}
                  <WeeklyMatrix
                    weeks={weeks}
                    onSelectCell={(metricKey, week) =>
                      setDrillDownState({ metricKey, week })
                    }
                  />

                  {/* City & Source Performance Breakdown Tables */}
                  <CitySourceTables
                    currentWeek={currentWeek}
                    onSelectCity={(city) => handleFilterChange('city', city)}
                  />

                  {/* Allocation Stream Reconciliation */}
                  <ReconciliationSection currentWeek={currentWeek} />

                  {/* Data Quality and Sanitization Audit */}
                  <DataQualitySection report={dataQualityReport} />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI OPERATIONS ANALYST */}
          {activeTab === 'analyst' && !isViewer && (
            <div id="tab-analyst">
              <AIAnalystView
                toolContext={toolContext}
                userEmail={currentUser.email || ''}
                providerSettings={providerSettings}
                onSelectProvider={(p) => setProviderSettings((prev) => ({ ...prev, activeProvider: p }))}
                onApplyActionLink={handleApplyActionLink}
                onNavigateToTab={(tabId) => setActiveTab(tabId)}
              />
            </div>
          )}

          {/* TAB 3: DAILY VIEW */}
          {activeTab === 'daily' && (
            <div id="tab-daily">
              <div className="placeholder">
                <div className="ic">🗓</div>
                <h3>Daily View</h3>
                <p>
                  Day-by-day walk-in and conversion tracking, including same-weekday comparisons and daily allocation rhythms, will be enabled in a future version.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: AGENT PERFORMANCE */}
          {activeTab === 'agents' && (
            <div id="tab-agents">
              <div className="placeholder">
                <div className="ic">👥</div>
                <h3>Agent Performance</h3>
                <p>
                  Comprehensive agent scorecards — turnaround time (TAT), stage conversions by recruiter, and top performers — are slated for future module rollout.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: TAT REPORT (TURNAROUND TIME) */}
          {activeTab === 'insights' && (
            <div id="tab-insights">
              <TATReportSection
                weeks={weeks}
                currentWeek={currentWeek}
                rawRecords={allRawRecords}
                allocRecords={allAllocRecords}
                onSelectCity={(city) => handleFilterChange('city', city)}
              />
            </div>
          )}

          {/* TAB 6: DATA SOURCE & INTEGRATION */}
          {activeTab === 'data' && (
            <div id="tab-data">
              <DataSourceView
                currentUser={currentUser}
                onSignIn={handleSignIn}
                onFetchLiveSheet={() => loadFromGoogleSheets()}
                onFileUpload={loadFromUploadedFiles}
                isLoading={isLoading}
                rawCount={allRawRecords.length}
                allocCount={allAllocRecords.length}
                lastFetchedAt={lastFetchedAt}
                tabsFound={discoveredTabs}
              />
            </div>
          )}

          {/* TAB 7: SETTINGS & ACCESS CONTROL */}
          {activeTab === 'settings' && isAdmin && (
            <div id="tab-settings">
              <SettingsView
                currentUser={currentUser}
                userProfile={userProfile}
                providerSettings={providerSettings}
                onSelectProvider={(p) => setProviderSettings((prev) => ({ ...prev, activeProvider: p }))}
                onRefreshProviders={refreshProviderSettings}
                onSignOut={handleSignOut}
                lastFetchedAt={lastFetchedAt}
                rawCount={allRawRecords.length}
                allocCount={allAllocRecords.length}
                onManualDataRefresh={async () => {
                  await loadFromGoogleSheets();
                }}
                onUpdateSpreadsheetSource={async (newId) => {
                  setActiveSpreadsheetId(newId);
                  await loadFromGoogleSheets(newId);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay" id="loading-overlay">
          <div className="spinner" />
          <div className="font-mono text-xs">{loadingMessage || 'Processing…'}</div>
        </div>
      )}

      {/* "Why Did This Change" Contributor Analysis Modal */}
      {whyChangeMetricKey && currentWeek && (
        <WhyChangeModal
          metricKey={whyChangeMetricKey}
          currentWeek={currentWeek}
          prevWeek={prevWeek}
          onClose={() => setWhyChangeMetricKey(null)}
        />
      )}

      {/* Drill-down Record Inspector Modal */}
      {drillDownState && (
        <DrillDownModal
          metricKey={drillDownState.metricKey}
          week={drillDownState.week}
          onClose={() => setDrillDownState(null)}
        />
      )}
    </div>
  );
}

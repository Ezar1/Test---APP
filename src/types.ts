/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RawDataRecord {
  city: string | null;
  location: string | null;
  hub: string | null;
  leadType: string | null;
  sourceCategory: string | null;
  businessVertical: string | null;
  agent: string;
  identity: string;
  uniqueTag: number | null;
  dailyTag: number | null;
  walkinWeek: Date;
  walkinDateDisplay: Date;
  onboardingDate: Date | null;
  drivingTestDate: Date | null;
  documentationDate: Date | null;
  trainingDate: Date | null;
  contractDate: Date | null;
  sdAmount: number;
  isAllocInWeek: number;
  isAllocInDay: number;
  allocLater: number | null;
  allocFinal: number | null;
}

export interface AllocationRecord {
  city: string | null;
  location: string | null;
  leadType: string | null;
  allocWeek: Date;
  allocDate: Date | null;
  employeeId: string | null;
  driverId: string | null;
  carNumber: string | null;
  revenueType: string | null;
  driverUuid: string | null;
  walkinDoneWeekly: number | null;
  walkinDoneDaily: number | null;
  isConsidered: number | null;
  agent: string | null;
}

export interface FilterState {
  city: string;
  location: string;
  leadType: string;
  sourceCategory: string;
  businessVertical: string;
  selectedWeekKey: string; // '' means latest week
}

export interface FilterOptions {
  city: string[];
  location: string[];
  leadType: string[];
  sourceCategory: string[];
  businessVertical: string[];
}

export interface WeeklyMetricRow {
  key: string; // YYYY-MM-DD Monday
  monday: Date;
  sunday: Date;
  label: string; // e.g. "12 Feb"
  rows: RawDataRecord[];
  
  // 17 Weekly Non-Funnel Metrics
  walkins: number;
  uniqueWalkins: number;
  repeatedWalkins: number;
  onboarding: number;
  drivingTestPassed: number;
  documentation: number;
  sdPaid: number;
  training: number;
  contract: number;
  allocated: number;
  notAllotted: number;
  sdNotAllocWeekly: number;
  sdNotAllocTillDate: number;
  allocWithScan: number;
  allocWithoutScan: number;
  allocTotal: number;
  allocWithoutUuid: number;

  // Key Ratios
  allocationRate: number; // %

  // Dynamics
  delta: Record<string, number | null>; // WoW %
  ppDelta: Record<string, number | null>; // Percentage point delta for rates
  l4wa: Record<string, number | null>; // 4-week average
}

export interface MetricDefinition {
  key: string;
  label: string;
  higher: boolean | null; // true = higher is better, false = lower is better, null = neutral
  section?: string;
  isRate?: boolean;
  denominator?: string;
}

export interface ReconciliationStatus {
  allocWithScan: number;
  allocWithoutScan: number;
  allocTotal: number;
  computedSum: number;
  variance: number;
  status: 'RECONCILED' | 'MISMATCH';
}

export interface DataQualityReport {
  rawTotal: number;
  rawUsable: number;
  rawExcludedUnresolvedWeek: number;
  rawSanitizedNulls: number;
  allocTotal: number;
  allocUsable: number;
  allocExcludedUnresolvedWeek: number;
  missingUuidCount: number;
  weeksLoaded: number;
  lastFetchedAt: Date | null;
  sourceSheetId: string;
  tabsFound: string[];
  status: 'HEALTHY' | 'WATCH' | 'ERROR';
}

export type InsightLevel = 'CRITICAL' | 'HIGH' | 'WATCH' | 'POSITIVE' | 'INFO';

export interface InsightItem {
  id: string;
  level: InsightLevel;
  title: string;
  description: string;
  metricKey?: string;
  impactScore: number;
}

export interface ContributorItem {
  dimension: string;
  category: string;
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  percentageChange: number | null;
  contributionShare: number; // % of total net movement
}

export interface ValidationComparisonItem {
  metric: string;
  workbookValue: number | string | null;
  appValue: number | string | null;
  variance: number | null;
  status: 'MATCH' | 'MISMATCH' | 'NEEDS REVIEW';
  notes?: string;
}

// -------------------------------------------------------------
// Phase 4: Auth & Access Control Types
// -------------------------------------------------------------
export interface ApprovedUserProfile {
  email: string;
  name: string;
  role: string;
  photoUrl?: string | null;
  approved: boolean;
}

export interface AccessCheckResult {
  approved: boolean;
  email: string;
  role: string;
  name: string;
  message?: string;
}

// -------------------------------------------------------------
// Phase 4: AI Provider & Settings Types
// -------------------------------------------------------------
export type AIProviderId = 'gemini' | 'claude';

export interface AIProviderInfo {
  id: AIProviderId;
  name: string;
  model: string;
  configured: boolean;
  status: 'CONFIGURED' | 'NOT CONFIGURED';
  note: string;
}

export interface ProviderSettingsState {
  activeProvider: AIProviderId;
  gemini: AIProviderInfo;
  claude: AIProviderInfo;
  lastCheckedAt?: Date;
}

// -------------------------------------------------------------
// Phase 4: AI Agents & Chat Types
// -------------------------------------------------------------
export type AIAgentId = 'executive' | 'onboarding' | 'allocation' | 'sd_backlog';

export interface AIAgentDefinition {
  id: AIAgentId;
  name: string;
  badge: string;
  title: string;
  description: string;
  allowedTools: string[];
  suggestedQuestions: string[];
}

export type AIProcessingStage =
  | 'IDLE'
  | 'UNDERSTANDING_QUESTION'
  | 'CHECKING_DASHBOARD_CONTEXT'
  | 'RUNNING_ANALYTICS'
  | 'GENERATING_RESPONSE'
  | 'COMPLETE'
  | 'ERROR';

export interface AICitation {
  source: string;
  calculation: string;
  filters: string;
  week: string;
}

export interface AIActionLink {
  label: string;
  filterType: 'city' | 'vertical' | 'sourceCategory' | 'weekKey' | 'tab';
  filterValue: string;
}

export interface AIKeyFigure {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
}

export interface StructuredAIResponse {
  answer: string;
  keyFigures?: AIKeyFigure[];
  drivers?: string[];
  detail?: string;
  recommendation?: string;
  tableTitle?: string;
  tableColumns?: string[];
  tableRows?: (string | number)[][];
  citation?: AICitation;
  actionLink?: AIActionLink;
  error?: string;
  providerStatus?: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text?: string;
  response?: StructuredAIResponse;
  agentId: AIAgentId;
  provider: AIProviderId;
  timestamp: Date;
  status?: 'sending' | 'success' | 'error';
  errorMessage?: string;
  toolsExecuted?: string[];
}

export interface AIAuditLog {
  id: string;
  timestamp: string;
  user: string;
  agent: string;
  question: string;
  provider: AIProviderId;
  toolsUsed: string[];
  status: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE';
  error?: string;
  tokensEstimate?: number;
}

export interface AIUsageSummary {
  todayCount: number;
  totalLogs: number;
  recentLogs: AIAuditLog[];
}

// -------------------------------------------------------------
// Phase 5: Access Management & Admin Audit Types
// -------------------------------------------------------------
export type UserRole = 'EXECUTIVE ADMINISTRATOR' | 'OPERATIONS ANALYST' | 'VIEWER';
export type UserStatus = 'Active' | 'Disabled';

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export type AdminAuditEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'USER_ADDED'
  | 'USER_UPDATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_REMOVED'
  | 'DATA_SOURCE_CHANGED'
  | 'DATA_REFRESH'
  | 'AI_REQUEST'
  | 'PROVIDER_CHANGED';

export interface AdminAuditLogEntry {
  id: string;
  timestamp: string;
  admin: string;
  targetUser?: string;
  action: AdminAuditEventType;
  details?: string;
  result: 'SUCCESS' | 'DENIED' | 'ERROR';
}

export type OperationalCacheStatus = 'LIVE' | 'CACHED' | 'REFRESHING' | 'STALE' | 'ERROR';

export interface OperationalCacheMetadata {
  status: OperationalCacheStatus;
  lastFetchedAt: string | null;
  dataAgeMinutes: number;
  nextRefreshAt: string | null;
  spreadsheetId: string;
  spreadsheetUrl?: string;
  tabsFound: string[];
  refreshPolicy: 'every12Hours' | 'manual';
  rawCount: number;
  allocCount: number;
  lastRefreshedBy?: string;
}

export interface OperationalDataPayload {
  rawRows: Record<string, any>[];
  allocRows: Record<string, any>[];
  tabsFound: string[];
  lastFetchedAt: string;
  spreadsheetId: string;
  status: OperationalCacheStatus;
  dataAgeMinutes: number;
  nextRefreshAt: string;
  refreshPolicy: 'every12Hours' | 'manual';
}



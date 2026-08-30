/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Clean architectural interfaces prepared for future dashboard expansion phases
 * as requested in Section 57 of the architecture specification.
 */

export interface IDailyDataService {
  fetchDailyMetrics(startDate: Date, endDate: Date): Promise<any[]>;
  compareDayOfWeek(dayOfWeek: number): Promise<any>;
}

export interface IAgentPerformanceService {
  fetchAgentScorecards(weekKey: string): Promise<any[]>;
  fetchAgentTAT(agentId: string): Promise<any>;
}

export interface ITATService {
  calculateStageTAT(stageFrom: string, stageTo: string): Promise<any>;
  identifyBottlenecks(): Promise<any[]>;
}

export interface ICohortService {
  trackCohortRetention(cohortWeek: string): Promise<any>;
  analyzeSpillOver(): Promise<any>;
}

export interface IDriverSearchService {
  searchDriver(query: string): Promise<any[]>;
  getDriverTimeline(driverId: string): Promise<any>;
}

export interface IAIAnalystService {
  generateExecutiveSummary(weekKey: string): Promise<string>;
}

export interface ISupersetDataService {
  connectSupersetAPI(endpoint: string): Promise<boolean>;
}

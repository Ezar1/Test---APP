/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIAgentDefinition, AIAgentId } from '../types';

export const AI_AGENTS: Record<AIAgentId, AIAgentDefinition> = {
  executive: {
    id: 'executive',
    name: 'Executive Analyst',
    badge: 'Management & Strategy',
    title: 'Executive Intelligence Analyst',
    description: 'Summarizes leadership-level week-over-week performance, operational risks, city growth drivers, and strategic anomalies.',
    allowedTools: [
      'getWeeklyMetrics',
      'getWeeklyComparison',
      'getCityBreakdown',
      'getSourceBreakdown',
      'getDataQuality',
      'getAvailableWeeks',
    ],
    suggestedQuestions: [
      'Why did allocation change last week?',
      'Which city contributed most to the decline?',
      'Compare this week vs last week',
      'Summarize this week\'s onboarding performance',
    ],
  },
  onboarding: {
    id: 'onboarding',
    name: 'Onboarding Analyst',
    badge: 'Funnel & Conversion',
    title: 'Funnel Milestone & Lead Analyst',
    description: 'Specializes in walk-in volume, driving test pass rates, documentation throughput, training completion, and source conversion efficiency.',
    allowedTools: [
      'getWeeklyMetrics',
      'getWeeklyComparison',
      'getCityBreakdown',
      'getSourceBreakdown',
      'getFilterValues',
    ],
    suggestedQuestions: [
      'Why is onboarding conversion down?',
      'Which source category had the lowest allocation rate?',
      'Show walk-in to test completion drop-off',
      'Compare Bangalore and Hyderabad conversion',
    ],
  },
  allocation: {
    id: 'allocation',
    name: 'Allocation Analyst',
    badge: 'Dispatch & Reconciliation',
    title: 'Vehicle Allocation & Reconciliation Analyst',
    description: 'Audits vehicle allocation streams, walk-in scan vs non-scan reconciliation, missing UUID tracking, and dispatch exceptions.',
    allowedTools: [
      'getAllocationReconciliation',
      'getAllocationRecords',
      'getCityBreakdown',
      'getWeeklyComparison',
    ],
    suggestedQuestions: [
      'How many allocations were without UUID?',
      'Show allocation exceptions and scan variances',
      'Show allocation records with missing UUIDs',
      'Compare allocation stream 1 vs stream 2',
    ],
  },
  sd_backlog: {
    id: 'sd_backlog',
    name: 'SD Backlog Analyst',
    badge: 'Deposit & Aging',
    title: 'Security Deposit & Unallocated Driver Analyst',
    description: 'Identifies drivers who paid security deposit (>₹500) but remain unallocated, tracking aging cases and recovery opportunities.',
    allowedTools: [
      'getSdBacklog',
      'getNotAllocatedRecords',
      'getCityBreakdown',
      'getWeeklyMetrics',
    ],
    suggestedQuestions: [
      'Show SD-paid drivers still not allocated',
      'Show the oldest SD backlog cases',
      'Show me the drivers who were not allocated last week',
      'Which city has the largest unallocated SD backlog?',
    ],
  },
};

export const DEFAULT_AGENT_ID: AIAgentId = 'executive';

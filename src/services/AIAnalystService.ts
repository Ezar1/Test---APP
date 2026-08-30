/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AIProviderId,
  AIAgentId,
  StructuredAIResponse,
  AIChatMessage,
  AIProcessingStage,
  WeeklyMetricRow,
  FilterState,
  ProviderSettingsState,
} from '../types';
import { ControlledAnalyticsTools, ToolContext } from '../engine/ControlledAnalyticsTools';
import { AI_AGENTS } from '../engine/AgentDefinitions';
import { getFirebaseIdToken } from './auth';

export interface QueryPlanResult {
  toolsCalled: string[];
  toolData: Record<string, any>;
  effectiveWeekKey?: string;
  detectedCity?: string;
}

export class AIAnalystService {
  /**
   * Fetches provider status from the backend server
   */
  static async checkProviders(): Promise<ProviderSettingsState> {
    try {
      const res = await fetch('/api/ai/providers');
      if (res.ok) {
        const data = await res.json();
        return {
          activeProvider: data.gemini.configured ? 'gemini' : (data.claude.configured ? 'claude' : 'gemini'),
          gemini: data.gemini,
          claude: data.claude,
          lastCheckedAt: new Date(),
        };
      }
    } catch (err) {
      console.warn('Failed to query /api/ai/providers:', err);
    }

    // Default fallback state
    return {
      activeProvider: 'gemini',
      gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        model: 'gemini-3.7-flash',
        configured: true,
        status: 'CONFIGURED',
        note: 'Native Gemini 3.7 Flash server-side integration',
      },
      claude: {
        id: 'claude',
        name: 'Anthropic Claude',
        model: 'claude-3-5-sonnet-20241022',
        configured: false,
        status: 'NOT CONFIGURED',
        note: 'Claude unavailable — provider not configured.',
      },
      lastCheckedAt: new Date(),
    };
  }

  /**
   * Query Planner: Determines which controlled tools to execute based on the user's question,
   * active filters, agent capabilities, and recent conversation.
   */
  static planAndExecuteTools(
    question: string,
    agentId: AIAgentId,
    ctx: ToolContext,
    conversationHistory: AIChatMessage[] = []
  ): QueryPlanResult {
    const q = question.toLowerCase();
    const toolsCalled: string[] = [];
    const toolData: Record<string, any> = {};

    // 1. Interpret week context
    let targetWeekKey = ctx.activeWeek?.key || (ctx.weeks.length > 0 ? ctx.weeks[ctx.weeks.length - 1].key : undefined);

    const isAskingPreviousWeek =
      q.includes('last week') ||
      q.includes('previous week') ||
      q.includes('prior week') ||
      q.includes('w-1');

    if (isAskingPreviousWeek && ctx.weeks.length >= 2) {
      // Find the index of active week or latest
      const currentIdx = targetWeekKey
        ? ctx.weeks.findIndex((w) => w.key === targetWeekKey)
        : ctx.weeks.length - 1;
      if (currentIdx > 0) {
        targetWeekKey = ctx.weeks[currentIdx - 1].key;
      }
    }

    // 2. Interpret City Mention
    const allCities = ControlledAnalyticsTools.getFilterValues(ctx).cities;
    let detectedCity: string | undefined = undefined;
    for (const c of allCities) {
      if (q.includes(c.toLowerCase())) {
        detectedCity = c;
        break;
      }
    }

    // Check conversation history for follow-ups (e.g. "show me those cases" or "Show Bangalore")
    if (!detectedCity && conversationHistory.length > 0) {
      const lastUserMsg = [...conversationHistory].reverse().find((m) => m.sender === 'user');
      if (lastUserMsg && lastUserMsg.text) {
        for (const c of allCities) {
          if (lastUserMsg.text.toLowerCase().includes(c.toLowerCase())) {
            detectedCity = c;
            break;
          }
        }
      }
    }

    // Execute tools matching the query intent
    // A. Unallocated records query
    const isUnallocatedQuery =
      q.includes('not allocated') ||
      q.includes('unallocated') ||
      q.includes('not allotted') ||
      q.includes('not-allotted') ||
      q.includes('those cases') ||
      (q.includes('drivers') && q.includes('not'));

    // B. SD Backlog query
    const isSdBacklogQuery =
      q.includes('sd backlog') ||
      q.includes('sd paid') ||
      q.includes('security deposit') ||
      q.includes('deposit paid') ||
      q.includes('oldest sd') ||
      agentId === 'sd_backlog';

    // C. Allocation / Reconciliation / UUID query
    const isAllocReconQuery =
      q.includes('reconciliation') ||
      q.includes('without uuid') ||
      q.includes('missing uuid') ||
      q.includes('scan') ||
      q.includes('stream') ||
      agentId === 'allocation';

    // D. City breakdown or comparison query
    const isCityQuery =
      q.includes('city') ||
      q.includes('cities') ||
      q.includes('bangalore') ||
      q.includes('hyderabad') ||
      q.includes('delhi') ||
      q.includes('mumbai') ||
      q.includes('kolkata') ||
      q.includes('chennai') ||
      q.includes('compare');

    // E. Source breakdown
    const isSourceQuery =
      q.includes('source') ||
      q.includes('channel') ||
      q.includes('lead type') ||
      q.includes('lead category') ||
      agentId === 'onboarding';

    // Execute Baseline Weekly Metrics Tool
    toolData.weeklySummary = ControlledAnalyticsTools.getWeeklyMetrics(
      ctx,
      targetWeekKey,
      detectedCity ? { city: detectedCity } : undefined
    );
    toolsCalled.push('getWeeklyMetrics');

    // Execute Weekly Comparison Tool
    toolData.weeklyComparison = ControlledAnalyticsTools.getWeeklyComparison(
      ctx,
      undefined,
      targetWeekKey
    );
    toolsCalled.push('getWeeklyComparison');

    if (isCityQuery || agentId === 'executive') {
      toolData.cityBreakdown = ControlledAnalyticsTools.getCityBreakdown(
        ctx,
        'allocated',
        targetWeekKey
      );
      toolsCalled.push('getCityBreakdown');
    }

    if (isSourceQuery) {
      toolData.sourceBreakdown = ControlledAnalyticsTools.getSourceBreakdown(
        ctx,
        'allocated',
        targetWeekKey
      );
      toolsCalled.push('getSourceBreakdown');
    }

    if (isAllocReconQuery) {
      toolData.reconciliation = ControlledAnalyticsTools.getAllocationReconciliation(
        ctx,
        targetWeekKey
      );
      toolData.allocationRecords = ControlledAnalyticsTools.getAllocationRecords(
        ctx,
        targetWeekKey,
        20
      );
      toolsCalled.push('getAllocationReconciliation', 'getAllocationRecords');
    }

    if (isSdBacklogQuery) {
      toolData.sdBacklog = ControlledAnalyticsTools.getSdBacklog(ctx, 20);
      toolsCalled.push('getSdBacklog');
    }

    if (isUnallocatedQuery) {
      toolData.unallocatedRecords = ControlledAnalyticsTools.getNotAllocatedRecords(
        ctx,
        targetWeekKey,
        25
      );
      toolsCalled.push('getNotAllocatedRecords');
    }

    // Always include available weeks metadata
    toolData.availableWeeks = ControlledAnalyticsTools.getAvailableWeeks(ctx);

    return {
      toolsCalled,
      toolData,
      effectiveWeekKey: targetWeekKey,
      detectedCity,
    };
  }

  /**
   * Main chat invocation with real stage progress events
   */
  static async sendChatMessage(
    question: string,
    agentId: AIAgentId,
    provider: AIProviderId,
    ctx: ToolContext,
    userEmail: string,
    conversationHistory: AIChatMessage[] = [],
    onStageChange?: (stage: AIProcessingStage) => void
  ): Promise<{ response: StructuredAIResponse; toolsExecuted: string[] }> {
    try {
      // Stage 1: Understanding question
      if (onStageChange) onStageChange('UNDERSTANDING_QUESTION');
      await new Promise((r) => setTimeout(r, 120));

      // Stage 2: Checking dashboard context & planning
      if (onStageChange) onStageChange('CHECKING_DASHBOARD_CONTEXT');
      await new Promise((r) => setTimeout(r, 150));

      // Stage 3: Running analytics on in-memory domain engine
      if (onStageChange) onStageChange('RUNNING_ANALYTICS');
      const plan = this.planAndExecuteTools(question, agentId, ctx, conversationHistory);
      await new Promise((r) => setTimeout(r, 200));

      // Stage 4: Generating response via Server-side AI
      if (onStageChange) onStageChange('GENERATING_RESPONSE');

      const targetWeek = ctx.weeks.find((w) => w.key === plan.effectiveWeekKey) || ctx.activeWeek;

      const payload = {
        question,
        agentId,
        provider,
        filterContext: {
          city: plan.detectedCity || ctx.filters.city,
          location: ctx.filters.location,
          leadType: ctx.filters.leadType,
          sourceCategory: ctx.filters.sourceCategory,
          businessVertical: ctx.filters.businessVertical,
          selectedWeekKey: plan.effectiveWeekKey,
          selectedWeekLabel: targetWeek ? targetWeek.label : 'Current Week',
        },
        toolData: plan.toolData,
        userEmail,
        conversationHistory: conversationHistory.map((m) => ({
          sender: m.sender,
          text: m.text || m.response?.answer || '',
        })),
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      const token = await getFirebaseIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (onStageChange) onStageChange('ERROR');
        return {
          response: {
            answer: errorData.message || errorData.error || 'AI Analyst is currently unavailable.',
            error: errorData.error || 'Provider communication failure',
            providerStatus: errorData.providerStatus || 'UNAVAILABLE',
            citation: {
              source: 'Raw_data + Allocation_raw',
              calculation: 'Everest Metric Engine',
              filters: 'Active Filters',
              week: targetWeek ? targetWeek.label : 'Current',
            },
          },
          toolsExecuted: plan.toolsCalled,
        };
      }

      const response: StructuredAIResponse = await res.json();
      if (onStageChange) onStageChange('COMPLETE');

      return {
        response,
        toolsExecuted: plan.toolsCalled,
      };
    } catch (err: any) {
      if (onStageChange) onStageChange('ERROR');
      return {
        response: {
          answer: `Failed to communicate with the analytics engine: ${err.message || 'Network error'}`,
          error: err.message,
          citation: {
            source: 'Raw_data + Allocation_raw',
            calculation: 'Everest Metric Engine',
            filters: 'Active Filters',
            week: 'Current',
          },
        },
        toolsExecuted: [],
      };
    }
  }

  /**
   * Generates standardized Executive Management Summary
   */
  static async generateManagementSummary(
    ctx: ToolContext,
    provider: AIProviderId,
    userEmail: string,
    onStageChange?: (stage: AIProcessingStage) => void
  ): Promise<{ response: StructuredAIResponse; toolsExecuted: string[] }> {
    const summaryPrompt = `Generate a comprehensive Executive Management Summary for this reporting week. Detail: 1) What changed this week, 2) Why it changed (largest positive & negative drivers by city/source), 3) Main operational risk / bottleneck, and 4) Data quality and reconciliation status.`;
    return this.sendChatMessage(
      summaryPrompt,
      'executive',
      provider,
      ctx,
      userEmail,
      [],
      onStageChange
    );
  }
}

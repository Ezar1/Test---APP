/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  AIAgentId,
  AIProviderId,
  AIChatMessage,
  AIProcessingStage,
  StructuredAIResponse,
  ProviderSettingsState,
} from '../types';
import { AI_AGENTS } from '../engine/AgentDefinitions';
import { AIAnalystService } from '../services/AIAnalystService';
import { ToolContext } from '../engine/ControlledAnalyticsTools';

interface AIAnalystViewProps {
  toolContext: ToolContext;
  userEmail: string;
  providerSettings: ProviderSettingsState;
  onSelectProvider: (p: AIProviderId) => void;
  onApplyActionLink: (filterType: string, filterValue: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export const AIAnalystView: React.FC<AIAnalystViewProps> = ({
  toolContext,
  userEmail,
  providerSettings,
  onSelectProvider,
  onApplyActionLink,
  onNavigateToTab,
}) => {
  const [activeAgentId, setActiveAgentId] = useState<AIAgentId>('executive');
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<AIProcessingStage>('IDLE');
  const [copiedTableIndex, setCopiedTableIndex] = useState<number | null>(null);
  const [isSharingContext, setIsSharingContext] = useState<boolean>(true);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeAgent = AI_AGENTS[activeAgentId];
  const activeWeek = toolContext.activeWeek || toolContext.weeks[toolContext.weeks.length - 1];

  // Auto-scroll on new message or stage update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStage]);

  // Extract user's display name or nickname for greeting
  const userName = userEmail.split('@')[0].split('.')[0] || 'Sk';
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Stage display label mapping
  const stageLabels: Record<AIProcessingStage, string> = {
    IDLE: '',
    UNDERSTANDING_QUESTION: 'UNDERSTANDING QUESTION',
    CHECKING_DASHBOARD_CONTEXT: 'CHECKING DASHBOARD CONTEXT',
    RUNNING_ANALYTICS: 'RUNNING ANALYTICS (METRIC ENGINE)',
    GENERATING_RESPONSE: 'GENERATING RESPONSE',
    COMPLETE: 'COMPLETE',
    ERROR: 'PROCESSING ERROR',
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || (currentStage !== 'IDLE' && currentStage !== 'COMPLETE' && currentStage !== 'ERROR')) return;

    setInputValue('');

    const userMessage: AIChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text,
      agentId: activeAgentId,
      provider: providerSettings.activeProvider,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const { response, toolsExecuted } = await AIAnalystService.sendChatMessage(
        text,
        activeAgentId,
        providerSettings.activeProvider,
        toolContext,
        userEmail,
        messages,
        (stage) => setCurrentStage(stage)
      );

      const aiMessage: AIChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        response,
        agentId: activeAgentId,
        provider: providerSettings.activeProvider,
        timestamp: new Date(),
        status: response.error ? 'error' : 'success',
        errorMessage: response.error,
        toolsExecuted,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Error handling AI chat message:', err);
      const fallbackAiMessage: AIChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        response: {
          answer: `Analysis engine encountered an error: ${err.message || 'Please try again.'}`,
          error: err.message,
          citation: {
            source: 'Raw_data + Allocation_raw',
            calculation: 'Metric Engine',
            filters: 'Active Filters',
            week: 'Current',
          },
        },
        agentId: activeAgentId,
        provider: providerSettings.activeProvider,
        timestamp: new Date(),
        status: 'error',
        errorMessage: err.message,
      };
      setMessages((prev) => [...prev, fallbackAiMessage]);
    } finally {
      setCurrentStage('IDLE');
    }
  };

  const handleGenerateManagementSummary = async () => {
    if (currentStage !== 'IDLE' && currentStage !== 'COMPLETE' && currentStage !== 'ERROR') return;

    const userMessage: AIChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: 'Generate Executive Management Summary',
      agentId: 'executive',
      provider: providerSettings.activeProvider,
      timestamp: new Date(),
    };

    setActiveAgentId('executive');
    setMessages((prev) => [...prev, userMessage]);

    try {
      const { response, toolsExecuted } = await AIAnalystService.generateManagementSummary(
        toolContext,
        providerSettings.activeProvider,
        userEmail,
        (stage) => setCurrentStage(stage)
      );

      const aiMessage: AIChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        response,
        agentId: 'executive',
        provider: providerSettings.activeProvider,
        timestamp: new Date(),
        status: response.error ? 'error' : 'success',
        errorMessage: response.error,
        toolsExecuted,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Error generating management summary:', err);
      const fallbackAiMessage: AIChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        response: {
          answer: `Failed to generate executive summary: ${err.message || 'Please try again.'}`,
          error: err.message,
          citation: {
            source: 'Raw_data + Allocation_raw',
            calculation: 'Metric Engine',
            filters: 'Active Filters',
            week: 'Current',
          },
        },
        agentId: 'executive',
        provider: providerSettings.activeProvider,
        timestamp: new Date(),
        status: 'error',
        errorMessage: err.message,
      };
      setMessages((prev) => [...prev, fallbackAiMessage]);
    } finally {
      setCurrentStage('IDLE');
    }
  };

  // Quick Action Suggestion Prompts
  const quickPrompts = [
    { icon: '✦', text: 'What can you do?' },
    { icon: '📄', text: 'Explain Google Sheet connection requirements' },
    { icon: '📊', text: 'Why did allocation change last week?' },
    { icon: '⏱', text: 'Show TAT bottlenecks and dropoffs this week' },
    { icon: '👥', text: 'Show drivers with security deposit paid but not allocated' },
    { icon: '⚡', text: 'Generate Executive Management Summary' },
  ];

  // Helper to copy table data
  const handleCopyTable = (columns: string[], rows: (string | number)[][], idx: number) => {
    const header = columns.join('\t');
    const body = rows.map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
    setCopiedTableIndex(idx);
    setTimeout(() => setCopiedTableIndex(null), 2000);
  };

  // Helper to export table as CSV
  const handleExportCSV = (columns: string[], rows: (string | number)[][], title?: string) => {
    const csvContent = [
      columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(','),
      ...rows.map((r) =>
        r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'everest_analytics'}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto relative font-sans" id="ai-analyst-ask-gemini">
      {/* Settings / Agent Drawer Modal */}
      {showSettingsDrawer && (
        <div className="absolute top-0 inset-x-0 z-30 p-4 bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--line)]">
            <h4 className="font-bold text-sm text-[var(--fg)]">AI Analyst Configuration</h4>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="text-xs text-[var(--muted)] hover:text-[var(--fg)] px-2 py-1"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-[var(--fg)] block mb-1.5 font-mono">Specialized Agent:</label>
              <div className="space-y-1.5">
                {(Object.keys(AI_AGENTS) as AIAgentId[]).map((key) => {
                  const agent = AI_AGENTS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setActiveAgentId(key);
                        setShowSettingsDrawer(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg border transition-all ${
                        activeAgentId === key
                          ? 'bg-[var(--teal)]/15 border-[var(--teal)] text-[var(--fg)] font-semibold'
                          : 'bg-[var(--line)]/20 border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
                      }`}
                    >
                      <div className="font-bold">{agent.name}</div>
                      <div className="text-[10px] text-[var(--muted)] truncate">{agent.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-[var(--fg)] block mb-1.5 font-mono">LLM Provider:</label>
                <select
                  className="w-full bg-[var(--line)]/40 border border-[var(--line)] text-xs font-mono text-[var(--fg)] px-3 py-2 rounded-lg"
                  value={providerSettings.activeProvider}
                  onChange={(e) => onSelectProvider(e.target.value as AIProviderId)}
                >
                  <option value="gemini">Google Gemini (3.7 Flash)</option>
                  <option value="claude">Anthropic Claude</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[var(--line)]/20 text-[11px] font-mono space-y-1 text-[var(--muted)]">
                <div>Active Week: <b className="text-amber-300">{activeWeek ? activeWeek.label : 'Latest'}</b></div>
                <div>City Context: <b className="text-amber-300">{toolContext.filters.city || 'All Operating Cities'}</b></div>
                <div>Status: <b className="text-emerald-400">Ready</b></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty State matching "Ask Gemini" aesthetic */
          <div className="flex flex-col items-start justify-center min-h-[400px] max-w-xl mx-auto space-y-6 animate-fadeIn">
            {/* Big Greeting */}
            <div>
              <h1 className="text-3xl sm:text-4xl font-normal text-blue-600 dark:text-blue-400 font-sans tracking-tight">
                Hello, {formattedName}
              </h1>
              <h2 className="text-2xl sm:text-3xl font-normal text-[#1e293b] dark:text-[#f1f5f9] tracking-tight mt-1">
                Where should we start?
              </h2>
            </div>

            {/* Suggestion Prompts Pills */}
            <div className="space-y-2.5 w-full">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p.text)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--panel)] hover:bg-[var(--line)]/40 border border-[var(--line)] text-sm text-[var(--fg)] shadow-sm hover:shadow transition-all group"
                >
                  <span className="text-blue-500 text-base">{p.icon}</span>
                  <span className="flex-1 font-medium">{p.text}</span>
                  <span className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat History */
          messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow">
                    ✦
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-sm ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                      : 'bg-[var(--panel)] text-[var(--fg)] border border-[var(--line)] rounded-tl-none shadow-sm space-y-3'
                  }`}
                >
                  {isUser ? (
                    <div className="font-sans leading-relaxed">{msg.text}</div>
                  ) : msg.response ? (
                    <div className="space-y-3">
                      {/* Direct Answer */}
                      <div className="font-sans leading-relaxed whitespace-pre-wrap">
                        {msg.response.answer || (msg.response as any).directAnswer || 'Analysis complete.'}
                      </div>

                      {/* Highlight Key Figures */}
                      {((msg.response.keyFigures && msg.response.keyFigures.length > 0) ||
                        ((msg.response as any).highlightMetrics && (msg.response as any).highlightMetrics.length > 0)) && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                          {(msg.response.keyFigures || (msg.response as any).highlightMetrics || []).map((m: any, mIdx: number) => (
                            <div
                              key={mIdx}
                              className="p-2.5 rounded-lg bg-[var(--line)]/20 border border-[var(--line)] font-mono"
                            >
                              <div className="text-[10px] text-[var(--muted)] uppercase truncate">
                                {m.label}
                              </div>
                              <div className="text-base font-bold text-[var(--fg)] mt-0.5">
                                {m.value}
                              </div>
                              {(m.change || m.variance) && (
                                <div
                                  className={`text-[10px] font-semibold ${
                                    m.isPositive !== undefined
                                      ? m.isPositive
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                      : String(m.change || m.variance).startsWith('+')
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {m.change || m.variance}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Drivers / Key Insights */}
                      {msg.response.drivers && msg.response.drivers.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                            Operational Drivers:
                          </div>
                          <ul className="space-y-1">
                            {msg.response.drivers.map((d, dIdx) => (
                              <li key={dIdx} className="flex items-start gap-1.5 text-[var(--fg)]">
                                <span className="text-blue-400">●</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Supporting Data Table */}
                      {(() => {
                        const tableObj = (msg.response as any).table ||
                          (msg.response.tableColumns && msg.response.tableRows
                            ? {
                                title: msg.response.tableTitle,
                                columns: msg.response.tableColumns,
                                rows: msg.response.tableRows,
                              }
                            : null);

                        if (!tableObj || !tableObj.columns || !tableObj.rows || tableObj.rows.length === 0) {
                          return null;
                        }

                        return (
                          <div className="pt-2">
                            <div className="flex justify-between items-center mb-1 text-[11px] font-mono text-[var(--muted)]">
                              <span>{tableObj.title || 'Supporting Operations Data'}</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopyTable(tableObj.columns, tableObj.rows, index)}
                                  className="text-blue-400 hover:underline"
                                >
                                  {copiedTableIndex === index ? '✓ Copied' : 'Copy'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportCSV(tableObj.columns, tableObj.rows, tableObj.title)}
                                  className="text-blue-400 hover:underline"
                                >
                                  CSV ↗
                                </button>
                              </div>
                            </div>
                            <div className="overflow-x-auto border border-[var(--line)] rounded-lg">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-[var(--line)]/30 text-[var(--muted)] font-mono border-b border-[var(--line)]">
                                  <tr>
                                    {tableObj.columns.map((c: string, cIdx: number) => (
                                      <th key={cIdx} className="p-2 font-medium">
                                        {c}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--line)] font-mono">
                                  {tableObj.rows.map((r: (string | number)[], rIdx: number) => (
                                    <tr key={rIdx} className="hover:bg-[var(--line)]/10">
                                      {r.map((cell: any, cellIdx: number) => (
                                        <td key={cellIdx} className="p-2">
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Action Link button */}
                      {msg.response.actionLink && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (msg.response?.actionLink) {
                                onApplyActionLink(
                                  msg.response.actionLink.filterType,
                                  msg.response.actionLink.filterValue
                                );
                              }
                            }}
                            className="btn btn-teal text-xs py-1 px-3 flex items-center gap-1.5 font-semibold"
                          >
                            <span>↗</span>
                            <span>{msg.response.actionLink.label}</span>
                          </button>
                        </div>
                      )}

                      {/* Recommended Actions */}
                      {(msg.response.recommendation ||
                        ((msg.response as any).recommendations && (msg.response as any).recommendations.length > 0)) && (
                        <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                          <div className="text-[11px] font-mono font-bold uppercase text-[var(--muted)]">
                            Operational Next Steps:
                          </div>
                          <ul className="space-y-1 text-xs">
                            {((msg.response as any).recommendations || (msg.response.recommendation ? [msg.response.recommendation] : [])).map((rec: string, rIdx: number) => (
                              <li key={rIdx} className="flex items-start gap-2">
                                <span className="text-blue-500 font-bold">→</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Verified Citation / Data Source Stamp */}
                      {msg.response.citation && (
                        <div className="pt-2 text-[10px] font-mono text-[var(--muted)] flex items-center justify-between border-t border-[var(--line)]/40">
                          <span>Verified by: {msg.response.citation.calculation}</span>
                          <span>Week: {msg.response.citation.week}</span>
                        </div>
                      )}
                    </div>
                  ) : msg.errorMessage ? (
                    <div className="text-red-400 text-xs flex items-center gap-2">
                      <span>⚠</span>
                      <span>{msg.errorMessage}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {/* Processing Indicator */}
        {currentStage !== 'IDLE' && (
          <div className="flex gap-3 items-center text-xs text-[var(--muted)] animate-pulse px-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold">
              ✦
            </div>
            <div className="font-mono">{stageLabels[currentStage] || 'Analyzing operational data…'}</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Docked Context Pill & Floating Ask Gemini Input Box */}
      <div className="p-4 bg-[var(--bg)] border-t border-[var(--line)] space-y-2">
        {/* Context Attached Pill */}
        {isSharingContext && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--line)]/30 border border-[var(--line)] text-xs text-[var(--fg)] max-w-full truncate animate-fadeIn">
            <span className="text-emerald-500">📊</span>
            <span className="truncate font-medium">Sharing &apos;Everest India Onboarding Dashb | Google Sheets&apos;</span>
            <button
              type="button"
              onClick={() => setIsSharingContext(false)}
              className="text-[var(--muted)] hover:text-[var(--fg)] ml-1 font-bold text-xs"
              title="Remove shared context"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Floating Input Box */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-3 shadow-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about Everest fleet operations, allocation TAT, or dropoff bottlenecks…"
            className="w-full bg-transparent text-sm text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none resize-none"
            id="ai-analyst-prompt-input"
          />

          <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]/40 mt-1">
            {/* Left Tools */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSharingContext(true)}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--line)]/30 text-xs flex items-center gap-1 font-mono"
                title="Attach operational context"
              >
                <span>＋</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettingsDrawer((prev) => !prev)}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--line)]/30 text-xs flex items-center gap-1 font-mono"
                title="Configure Agent & Provider"
              >
                <span>⚙</span>
                <span className="hidden sm:inline text-[11px]">{activeAgent.name}</span>
              </button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-md bg-[var(--line)]/30 text-[10px] font-mono text-[var(--muted)] font-bold">
                Flash ▾
              </span>
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || currentStage !== 'IDLE'}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow"
                id="ai-analyst-send-btn"
                title="Send query"
              >
                <span className="text-xs">✦</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

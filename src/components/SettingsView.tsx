/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  AIProviderId,
  ProviderSettingsState,
  ApprovedUserProfile,
  AIUsageSummary,
  ManagedUser,
  UserRole,
  UserStatus,
  AdminAuditLogEntry,
} from '../types';
import {
  getActiveSpreadsheetId,
  setActiveSpreadsheetId,
} from '../services/GoogleSheetDataService';
import {
  fetchManagedUsers,
  addManagedUser,
  updateManagedUser,
  deleteManagedUser,
  fetchAdminAuditLogs,
  validateDataSource,
  updateDataSourceConfig,
  triggerAdminDataRefresh,
  updateRefreshPolicy,
  fetchDataStatus,
  resetBaselineOperationalDataset,
  uploadOperationalDataToServer,
} from '../config/accessControl';
import { parseUploadedFiles } from '../services/GoogleSheetDataService';

interface SettingsViewProps {
  currentUser: User | null;
  userProfile: ApprovedUserProfile | null;
  providerSettings: ProviderSettingsState;
  onSelectProvider: (providerId: AIProviderId) => void;
  onRefreshProviders: () => void;
  onSignOut: () => void;
  lastFetchedAt: Date | null;
  rawCount: number;
  allocCount: number;
  onUpdateSpreadsheetSource?: (newSpreadsheetId: string) => Promise<void>;
  onManualDataRefresh?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  userProfile,
  providerSettings,
  onSelectProvider,
  onRefreshProviders,
  onSignOut,
  lastFetchedAt,
  rawCount,
  allocCount,
  onUpdateSpreadsheetSource,
  onManualDataRefresh,
}) => {
  const [activeSection, setActiveSection] = useState<'account' | 'access' | 'provider' | 'data' | 'refresh' | 'usage'>('account');
  const [usageSummary, setUsageSummary] = useState<AIUsageSummary>({
    todayCount: 0,
    totalLogs: 0,
    recentLogs: [],
  });
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(false);

  // Access Management State
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userStats, setUserStats] = useState<{ total: number; activeCount: number; disabledCount: number }>({
    total: 0,
    activeCount: 0,
    disabledCount: 0,
  });
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState<string>('');
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data Source Form State (Admin)
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(getActiveSpreadsheetId());
  const [isValidatingSource, setIsValidatingSource] = useState<boolean>(false);
  const [isSavingSource, setIsSavingSource] = useState<boolean>(false);

  // Refresh Management State
  const [isTriggeringRefresh, setIsTriggeringRefresh] = useState<boolean>(false);
  const [refreshPolicy, setRefreshPolicy] = useState<'every12Hours' | 'manual'>('every12Hours');
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState<boolean>(false);
  const [serverDataStatus, setServerDataStatus] = useState<{
    status: string;
    lastFetchedAt: string | null;
    dataAgeMinutes: number;
    nextRefreshAt: string | null;
    rawCount: number;
    allocCount: number;
  } | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addForm, setAddForm] = useState<{ email: string; displayName: string; role: UserRole; status: UserStatus }>({
    email: '',
    displayName: '',
    role: 'OPERATIONS ANALYST',
    status: 'Active',
  });
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState<{ displayName: string; role: UserRole; status: UserStatus }>({
    displayName: '',
    role: 'OPERATIONS ANALYST',
    status: 'Active',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const [deleteConfirmUser, setDeleteConfirmUser] = useState<ManagedUser | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  const requesterEmail = currentUser?.email || 'sk.ezaruddin@everestfleet.com';
  const roleString = (userProfile?.role || '').toUpperCase();
  const isAdmin = roleString.includes('ADMIN') || roleString === 'EXECUTIVE ADMINISTRATOR';

  // Load Managed Users
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setIsLoadingUsers(true);
      const res = await fetchManagedUsers(requesterEmail);
      setManagedUsers(res.users);
      setUserStats({
        total: res.total,
        activeCount: res.activeCount,
        disabledCount: res.disabledCount,
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load user directory' });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [isAdmin, requesterEmail]);

  // Load Admin Audit Logs
  const loadAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setIsLoadingAudit(true);
      const res = await fetchAdminAuditLogs(requesterEmail);
      setAdminAuditLogs(res.logs);
    } catch (err: any) {
      console.warn('Could not load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [isAdmin, requesterEmail]);

  // Load Data Freshness Status
  const loadDataStatus = useCallback(async () => {
    try {
      const data = await fetchDataStatus();
      setServerDataStatus(data);
      if (data.refreshPolicy) {
        setRefreshPolicy(data.refreshPolicy);
      }
    } catch (err) {
      console.warn('Could not fetch server data status:', err);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'access') {
      loadUsers();
      loadAuditLogs();
    } else if (activeSection === 'refresh' || activeSection === 'data') {
      loadDataStatus();
    }
  }, [activeSection, loadUsers, loadAuditLogs, loadDataStatus]);

  useEffect(() => {
    async function fetchUsage() {
      try {
        setIsLoadingUsage(true);
        const res = await fetch('/api/ai/usage');
        if (res.ok) {
          const data = await res.json();
          setUsageSummary(data);
        }
      } catch (err) {
        console.warn('Failed to load usage statistics:', err);
      } finally {
        setIsLoadingUsage(false);
      }
    }
    if (activeSection === 'usage') {
      fetchUsage();
    }
  }, [activeSection]);

  // Clear toast feedback after 4 seconds
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Handle Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email || !addForm.email.includes('@')) {
      setActionFeedback({ type: 'error', message: 'Please provide a valid email address.' });
      return;
    }

    try {
      setIsSubmittingAdd(true);
      const res = await addManagedUser(requesterEmail, addForm);
      setManagedUsers(res.users);
      setUserStats((prev) => ({
        ...prev,
        total: res.users.length,
        activeCount: res.users.filter((u) => u.status === 'Active').length,
        disabledCount: res.users.filter((u) => u.status === 'Disabled').length,
      }));
      setIsAddModalOpen(false);
      setAddForm({ email: '', displayName: '', role: 'OPERATIONS ANALYST', status: 'Active' });
      setActionFeedback({ type: 'success', message: `User ${res.user.email} added successfully.` });
      loadAuditLogs();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to add user.' });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Edit User
  const handleOpenEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSubmittingEdit(true);
      const res = await updateManagedUser(requesterEmail, editingUser.email, editForm);
      setManagedUsers(res.users);
      setUserStats((prev) => ({
        ...prev,
        total: res.users.length,
        activeCount: res.users.filter((u) => u.status === 'Active').length,
        disabledCount: res.users.filter((u) => u.status === 'Disabled').length,
      }));
      setIsEditModalOpen(false);
      setEditingUser(null);
      setActionFeedback({ type: 'success', message: `Updated settings for ${editingUser.email}.` });
      loadAuditLogs();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to update user.' });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Quick Toggle Status
  const handleToggleStatus = async (user: ManagedUser) => {
    const newStatus: UserStatus = user.status === 'Active' ? 'Disabled' : 'Active';
    try {
      const res = await updateManagedUser(requesterEmail, user.email, { status: newStatus });
      setManagedUsers(res.users);
      setUserStats((prev) => ({
        ...prev,
        activeCount: res.users.filter((u) => u.status === 'Active').length,
        disabledCount: res.users.filter((u) => u.status === 'Disabled').length,
      }));
      setActionFeedback({
        type: 'success',
        message: `Account status for ${user.email} set to ${newStatus}.`,
      });
      loadAuditLogs();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to change user status.' });
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;

    try {
      setIsSubmittingDelete(true);
      const res = await deleteManagedUser(requesterEmail, deleteConfirmUser.email);
      setManagedUsers(res.users);
      setUserStats((prev) => ({
        ...prev,
        total: res.users.length,
        activeCount: res.users.filter((u) => u.status === 'Active').length,
        disabledCount: res.users.filter((u) => u.status === 'Disabled').length,
      }));
      setDeleteConfirmUser(null);
      setActionFeedback({ type: 'success', message: res.message });
      loadAuditLogs();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to remove user.' });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Handle Validate Source (Admin)
  const handleValidateSource = async () => {
    if (!spreadsheetInput.trim()) {
      setActionFeedback({ type: 'error', message: 'Please enter a Google Spreadsheet URL or ID.' });
      return;
    }

    try {
      setIsValidatingSource(true);
      const result = await validateDataSource(spreadsheetInput);
      setActionFeedback({
        type: 'success',
        message: `Valid Google Spreadsheet recognized (ID: ${result.spreadsheetId}). Click "Save & Reconnect" to apply.`,
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Invalid Google Spreadsheet URL or ID.' });
    } finally {
      setIsValidatingSource(false);
    }
  };

  // Handle Save & Reconnect Source (Admin)
  const handleSaveSource = async () => {
    try {
      setIsSavingSource(true);
      const res = await updateDataSourceConfig(requesterEmail, spreadsheetInput);
      setActiveSpreadsheetId(res.spreadsheetId);
      setActionFeedback({
        type: 'success',
        message: 'Data source successfully updated. Reloading operational metrics…',
      });

      if (onUpdateSpreadsheetSource) {
        await onUpdateSpreadsheetSource(res.spreadsheetId);
      }
      loadDataStatus();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to update data source.' });
    } finally {
      setIsSavingSource(false);
    }
  };

  // Handle Manual Refresh Now (Admin)
  const handleTriggerRefresh = async () => {
    try {
      setIsTriggeringRefresh(true);
      const res = await triggerAdminDataRefresh(requesterEmail);
      setActionFeedback({
        type: 'success',
        message: `Live data refreshed! Loaded ${res.rawCount.toLocaleString()} Raw rows and ${res.allocCount.toLocaleString()} Allocation rows.`,
      });
      if (onManualDataRefresh) {
        await onManualDataRefresh();
      }
      loadDataStatus();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to refresh operational data.' });
    } finally {
      setIsTriggeringRefresh(false);
    }
  };

  // Handle Reset to Built-in Everest Fleet Dataset (Admin / Analyst)
  const [isResettingDataset, setIsResettingDataset] = useState<boolean>(false);
  const handleResetBaselineDataset = async () => {
    try {
      setIsResettingDataset(true);
      const res = await resetBaselineOperationalDataset(requesterEmail);
      setActionFeedback({
        type: 'success',
        message: `High-fidelity Everest operational baseline dataset loaded (${res.rawCount.toLocaleString()} Raw, ${res.allocCount.toLocaleString()} Allocation rows).`,
      });
      if (onManualDataRefresh) {
        await onManualDataRefresh();
      }
      loadDataStatus();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load baseline dataset.' });
    } finally {
      setIsResettingDataset(false);
    }
  };

  // Handle Local Workbook File Ingestion & Server Cache Sync
  const [isUploadingWorkbook, setIsUploadingWorkbook] = useState<boolean>(false);
  const handleUploadLocalFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList: FileList = e.target.files;
    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const item = fileList.item(i);
      if (item) files.push(item);
    }
    try {
      setIsUploadingWorkbook(true);
      const parsed = await parseUploadedFiles(files);
      if (parsed.rawRows.length === 0 && parsed.allocRows.length === 0) {
        throw new Error('No readable data rows found in uploaded files. Please upload Excel (.xlsx) or CSV files with Raw_data or Allocation sheets.');
      }
      const res = await uploadOperationalDataToServer(requesterEmail, parsed.rawRows, parsed.allocRows, parsed.tabsFound);
      setActionFeedback({
        type: 'success',
        message: `Workbook uploaded and cached successfully (${res.rawCount.toLocaleString()} Raw, ${res.allocCount.toLocaleString()} Allocation records).`,
      });
      if (onManualDataRefresh) {
        await onManualDataRefresh();
      }
      loadDataStatus();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to parse and upload workbook files.' });
    } finally {
      setIsUploadingWorkbook(false);
      e.target.value = '';
    }
  };

  // Handle Update Refresh Policy (Admin)
  const handleUpdatePolicy = async (newPolicy: 'every12Hours' | 'manual') => {
    try {
      setIsUpdatingPolicy(true);
      await updateRefreshPolicy(requesterEmail, newPolicy);
      setRefreshPolicy(newPolicy);
      setActionFeedback({
        type: 'success',
        message: `Refresh schedule updated to ${newPolicy === 'every12Hours' ? 'Every 12 Hours (Automated)' : 'Manual Only'}.`,
      });
      loadDataStatus();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to update refresh schedule.' });
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  // Filter users by search
  const filteredUsers = managedUsers.filter((u) => {
    if (!userSearch.trim()) return true;
    const query = userSearch.toLowerCase();
    return (
      u.email.toLowerCase().includes(query) ||
      u.displayName.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query) ||
      u.status.toLowerCase().includes(query)
    );
  });

  const navItems = [
    { id: 'account', label: 'ACCOUNT', icon: '👤' },
    ...(isAdmin
      ? [
          { id: 'access', label: 'ACCESS MANAGEMENT', icon: '🛡' },
          { id: 'provider', label: 'AI PROVIDERS', icon: '✦' },
          { id: 'data', label: 'DATA SOURCE', icon: '🗄' },
          { id: 'refresh', label: 'DATA REFRESH', icon: '↻' },
          { id: 'usage', label: 'USAGE & AUDIT', icon: '📊' },
        ]
      : [
          { id: 'provider', label: 'AI PROVIDERS', icon: '✦' },
          { id: 'data', label: 'DATA SOURCE', icon: '🗄' },
          { id: 'usage', label: 'USAGE & AUDIT', icon: '📊' },
        ]),
  ];

  const effectiveStatus = serverDataStatus?.status || (lastFetchedAt ? 'LIVE' : 'CACHED');
  const dataAgeMinutes = serverDataStatus?.dataAgeMinutes ?? (lastFetchedAt ? Math.floor((Date.now() - lastFetchedAt.getTime()) / (60 * 1000)) : 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto" id="settings-view">
      {/* Toast Feedback Alert */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg transition-all animate-fadeIn ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{actionFeedback.type === 'success' ? '✓' : '⚠'}</span>
            <span className="font-mono">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Settings Navigation Bar */}
      <div className="flex border-b border-[var(--line)] gap-2 pb-2 overflow-x-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            id={`settings-tab-${item.id}`}
            className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSection === item.id
                ? 'bg-[var(--teal)]/15 text-[var(--teal)] border border-[var(--teal)]/40 shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--line)]/30'
            }`}
            onClick={() => setActiveSection(item.id as any)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* SECTION 1: ACCOUNT */}
      {activeSection === 'account' && (
        <div className="card space-y-6" id="settings-section-account">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-[var(--fg)]">
                User Profile & Operational Authorization
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Active session metadata and assigned role permissions
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase tracking-wider ${
                isAdmin
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
              }`}
            >
              {userProfile?.role || 'OPERATIONS ANALYST'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[var(--line)]/20 border border-[var(--line)] space-y-3">
              <div className="text-[10px] font-mono uppercase text-[var(--muted)]">User Identity</div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--fg)]">
                  {userProfile?.name || currentUser?.displayName || 'Authorized User'}
                </div>
                <div className="font-mono text-xs text-[var(--muted)]">
                  {userProfile?.email || currentUser?.email || 'user@everestfleet.com'}
                </div>
              </div>
              <div className="pt-2 border-t border-[var(--line)] text-[11px] text-[var(--muted)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Active Google OAuth Session (Firebase Verified)</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--line)]/20 border border-[var(--line)] space-y-3">
              <div className="text-[10px] font-mono uppercase text-[var(--muted)]">Access Permissions</div>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between items-center text-emerald-400">
                  <span>Weekly Non-Funnel View</span>
                  <span>GRANTED</span>
                </div>
                <div className="flex justify-between items-center text-emerald-400">
                  <span>AI Intelligence Analyst</span>
                  <span>{userProfile?.role === 'VIEWER' ? 'RESTRICTED' : 'GRANTED'}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-400">
                  <span>Advanced Insights Engine</span>
                  <span>GRANTED</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={isAdmin ? 'text-emerald-400' : 'text-slate-500'}>
                    User Directory & Admin Controls
                  </span>
                  <span className={isAdmin ? 'text-emerald-400' : 'text-slate-500'}>
                    {isAdmin ? 'GRANTED' : 'RESTRICTED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--line)] flex items-center justify-between">
            <span className="text-xs text-[var(--muted)] font-mono">
              Signed in via Google Workspace / Everest Fleet SSO
            </span>
            <button
              className="btn btn-ghost hover:bg-red-500/15 hover:text-red-300 text-xs text-red-400 flex items-center gap-2"
              onClick={onSignOut}
              id="settings-signout-btn"
            >
              <span>⇥</span>
              <span>Sign Out of Application</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 2: ACCESS MANAGEMENT (Executive Admin Only) */}
      {activeSection === 'access' && isAdmin && (
        <div className="space-y-6" id="settings-section-access">
          <div className="card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[var(--fg)] flex items-center gap-2">
                  <span>🛡</span>
                  <span>Access Management & User Directory</span>
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Server-enforced access registry, role permissions, and active authorization states
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost text-xs py-2 px-3"
                  onClick={loadUsers}
                  disabled={isLoadingUsers}
                >
                  {isLoadingUsers ? 'Syncing…' : '↻ Refresh'}
                </button>
                <button
                  className="btn btn-teal text-xs py-2 px-4 shadow-sm"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  + Add Authorized User
                </button>
              </div>
            </div>

            {/* Stats & Search */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--line)]/20 border border-[var(--line)]">
                <div className="text-[10px] font-mono uppercase text-[var(--muted)]">Total Registered</div>
                <div className="text-xl font-mono font-bold text-[var(--fg)]">{userStats.total}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] font-mono uppercase text-emerald-400">Active Approved</div>
                <div className="text-xl font-mono font-bold text-emerald-300">{userStats.activeCount}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="text-[10px] font-mono uppercase text-red-400">Disabled / Revoked</div>
                <div className="text-xl font-mono font-bold text-red-300">{userStats.disabledCount}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Filter users by email, name, role, or status…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="flex-1 bg-[var(--line)]/20 border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-[var(--fg)] focus:outline-none focus:border-[var(--teal)] font-mono"
              />
            </div>

            {/* User Directory Table */}
            <div className="overflow-x-auto border border-[var(--line)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--line)]/30 text-[var(--muted)] font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3">User & Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last Login</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[var(--muted)] font-mono">
                        {isLoadingUsers ? 'Loading user directory…' : 'No matching users found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[var(--line)]/10 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-[var(--fg)]">{user.displayName}</div>
                          <div className="text-[11px] font-mono text-[var(--muted)]">{user.email}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                              user.role === 'EXECUTIVE ADMINISTRATOR'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : user.role === 'OPERATIONS ANALYST'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              user.status === 'Active'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            ● {user.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-[var(--muted)]">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            className="text-xs text-[var(--teal)] hover:underline font-mono"
                            onClick={() => handleOpenEdit(user)}
                          >
                            Edit
                          </button>
                          <button
                            className={`text-xs hover:underline font-mono ${
                              user.status === 'Active' ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                            onClick={() => handleToggleStatus(user)}
                            disabled={user.email.toLowerCase() === requesterEmail.toLowerCase()}
                            title={user.email.toLowerCase() === requesterEmail.toLowerCase() ? 'Cannot toggle self' : ''}
                          >
                            {user.status === 'Active' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="text-xs text-red-400 hover:underline font-mono"
                            onClick={() => setDeleteConfirmUser(user)}
                            disabled={user.email.toLowerCase() === requesterEmail.toLowerCase()}
                            title={user.email.toLowerCase() === requesterEmail.toLowerCase() ? 'Cannot remove self' : ''}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin Audit Trail Card */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h4 className="text-sm font-serif font-bold text-[var(--fg)]">
                  Administrative Access Audit Log
                </h4>
                <p className="text-[11px] text-[var(--muted)]">
                  Cryptographic log of all user provisioning, role adjustments, and security state modifications
                </p>
              </div>
              <button
                className="btn btn-ghost text-xs py-1.5 px-3 font-mono"
                onClick={loadAuditLogs}
                disabled={isLoadingAudit}
              >
                {isLoadingAudit ? 'Syncing…' : '↻ Refresh Log'}
              </button>
            </div>

            <div className="overflow-x-auto border border-[var(--line)] rounded-xl max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[var(--line)]/30 text-[var(--muted)] uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Administrator</th>
                    <th className="p-2.5">Action</th>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5">Details</th>
                    <th className="p-2.5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {adminAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-[var(--muted)]">
                        No administrative audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    adminAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--line)]/10 text-[11px]">
                        <td className="p-2.5 text-[var(--muted)] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-2.5 text-[var(--fg)] truncate max-w-[120px]">{log.admin}</td>
                        <td className="p-2.5 text-amber-300 font-semibold">{log.action}</td>
                        <td className="p-2.5 text-[var(--muted)]">{log.targetUser || '-'}</td>
                        <td className="p-2.5 text-[var(--fg)] truncate max-w-[220px]" title={log.details}>
                          {log.details || '-'}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] ${
                              log.result === 'SUCCESS'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: AI PROVIDER */}
      {activeSection === 'provider' && (
        <div className="card space-y-6" id="settings-section-provider">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-[var(--fg)]">
                AI Synthesis Engine & LLM Providers
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Server-side LLM provider status, active models, and secure credential handling
              </p>
            </div>
            <button
              className="btn btn-ghost text-xs py-2 px-3 font-mono"
              onClick={onRefreshProviders}
            >
              ↻ Check Status
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Gemini Card */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                providerSettings.activeProvider === 'gemini'
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-lg'
                  : 'bg-[var(--line)]/20 border-[var(--line)]'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <span>✦ Google Gemini</span>
                    {providerSettings.activeProvider === 'gemini' && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                        ACTIVE DEFAULT
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--muted)]">Model: {providerSettings.gemini.model}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    providerSettings.gemini.configured
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  ● {providerSettings.gemini.status}
                </span>
              </div>

              <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
                {providerSettings.gemini.note}
              </p>

              <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] font-mono text-[11px] text-[var(--muted)] mb-4 flex justify-between items-center">
                <span>API Secret Key:</span>
                <span className="text-emerald-400 font-bold">•••••••••••••••• (Secured on Server)</span>
              </div>

              <button
                className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all ${
                  providerSettings.activeProvider === 'gemini'
                    ? 'btn btn-teal'
                    : 'btn btn-ghost hover:bg-[var(--line)]/40'
                }`}
                onClick={() => onSelectProvider('gemini')}
                disabled={!providerSettings.gemini.configured}
              >
                {providerSettings.activeProvider === 'gemini' ? '✓ Currently Selected' : 'Set as Active Provider'}
              </button>
            </div>

            {/* Anthropic Claude Card */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                providerSettings.activeProvider === 'claude'
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-lg'
                  : 'bg-[var(--line)]/20 border-[var(--line)]'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <span>⚡ Anthropic Claude</span>
                    {providerSettings.activeProvider === 'claude' && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                        ACTIVE DEFAULT
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--muted)]">Model: {providerSettings.claude.model}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    providerSettings.claude.configured
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  ● {providerSettings.claude.status}
                </span>
              </div>

              <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
                {providerSettings.claude.note}
              </p>

              <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] font-mono text-[11px] text-[var(--muted)] mb-4 flex justify-between items-center">
                <span>API Secret Key:</span>
                <span className={providerSettings.claude.configured ? 'text-emerald-400 font-bold' : 'text-[var(--muted)]'}>
                  {providerSettings.claude.configured ? '•••••••••••••••• (Secured on Server)' : 'Not Configured in Secrets'}
                </span>
              </div>

              <button
                className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all ${
                  providerSettings.activeProvider === 'claude'
                    ? 'btn btn-teal'
                    : 'btn btn-ghost hover:bg-[var(--line)]/40'
                }`}
                onClick={() => onSelectProvider('claude')}
                disabled={!providerSettings.claude.configured}
              >
                {providerSettings.activeProvider === 'claude'
                  ? '✓ Currently Selected'
                  : providerSettings.claude.configured
                  ? 'Set as Active Provider'
                  : 'Requires ANTHROPIC_API_KEY Secret'}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--line)]/10 border border-[var(--line)] text-xs text-[var(--muted)] space-y-1 font-mono">
            <div className="font-semibold text-[var(--fg)]">🛡 Server-Side Key Protection Policy</div>
            <p>
              AI API keys are strictly evaluated within the isolated Node.js container environment. No raw API tokens are ever broadcast or transmitted to the client browser.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 4: DATA SOURCE */}
      {activeSection === 'data' && (
        <div className="card space-y-6" id="settings-section-data">
          <div className="border-b border-[var(--line)] pb-4">
            <h3 className="text-base font-serif font-bold text-[var(--fg)]">
              Data Source & Spreadsheet Integration
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Operational Google Sheet connection status, sharing permissions, and local upload fallbacks
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Status overview */}
            <div className="p-4 rounded-xl bg-[var(--line)]/20 border border-[var(--line)] space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--fg)]">Connection Status</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  ● {effectiveStatus === 'LIVE' ? 'CONNECTED & SYNCED' : 'OPERATIONAL CACHE ACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Source Type</span>
                <span className="font-mono text-[var(--fg)]">Google Sheets (Direct Server Fetch + Memory Cache)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Permissions Enforced</span>
                <span className="font-mono text-emerald-400">READ ONLY · NO WRITE ACCESS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Last Live Sync</span>
                <span className="font-mono text-[var(--fg)]">
                  {lastFetchedAt ? lastFetchedAt.toLocaleString() : 'Active session cache'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Current In-Memory Cache</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {rawCount.toLocaleString()} Raw records · {allocCount.toLocaleString()} Allocation records
                </span>
              </div>
            </div>

            {/* Google Sheets Permission & Troubleshooting Assistant */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <span>ℹ</span>
                <span>Connecting to a Google Sheet? Ensure Link Sharing is Enabled</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                If your Google Sheet shows 0 records or connection errors, Google requires the spreadsheet permissions to allow read access:
              </p>
              <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-2 text-[11px] font-mono text-[var(--fg)]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Open your Google Sheet: <a href={`https://docs.google.com/spreadsheets/d/${getActiveSpreadsheetId()}/edit`} target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-amber-300">Open in Google Sheets ↗</a></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Click the blue <strong>Share</strong> button in the top right corner.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Under <strong>General access</strong>, change from <em>Restricted</em> to <strong>&quot;Anyone with the link&quot;</strong> (Role: <strong>Viewer</strong>).</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">4</span>
                  <span>Click <strong>Done</strong>, then click <strong>&quot;Save & Reconnect&quot;</strong> below or <strong>&quot;Refresh Now&quot;</strong> in Data Refresh.</span>
                </div>
              </div>
            </div>

            {/* Quick Ingestion Actions: Reset Baseline or Upload Local File */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Reset to Built-in High-Fidelity Dataset */}
              <div className="p-4 rounded-xl bg-[var(--line)]/20 border border-[var(--line)] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="font-semibold text-[var(--fg)] flex items-center gap-2">
                    <span>⚡ Load Built-in Everest Dataset</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-1">
                    Instantly load 3,400+ realistic Everest Fleet multi-city operational records across Mumbai, Delhi, Bangalore, Hyderabad, Pune, and Kolkata.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost py-2 px-3 text-xs w-full font-bold border border-[var(--line)] hover:bg-[var(--line)]/40 flex items-center justify-center gap-2"
                  onClick={handleResetBaselineDataset}
                  disabled={isResettingDataset}
                >
                  {isResettingDataset ? 'Loading Baseline…' : '↻ Load 3,400+ Baseline Records'}
                </button>
              </div>

              {/* Upload Local Workbook File */}
              <div className="p-4 rounded-xl bg-[var(--line)]/20 border border-[var(--line)] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="font-semibold text-[var(--fg)] flex items-center gap-2">
                    <span>📁 Upload Local Excel / CSV</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-1">
                    Directly upload your offline <code>.xlsx</code> or <code>.csv</code> files. The server will parse and sync the live cache.
                  </p>
                </div>
                <label className="btn btn-teal py-2 px-3 text-xs w-full font-bold text-center cursor-pointer flex items-center justify-center gap-2">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    multiple
                    onChange={handleUploadLocalFiles}
                    disabled={isUploadingWorkbook}
                    className="hidden"
                  />
                  <span>{isUploadingWorkbook ? 'Uploading & Syncing…' : '↑ Select Excel / CSV Files'}</span>
                </label>
              </div>
            </div>

            {/* Admin Source Configuration Tool */}
            {isAdmin ? (
              <div className="p-4 rounded-xl bg-[var(--line)]/20 border border-[var(--line)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[var(--fg)]">
                    Target Spreadsheet Configuration (Admin Only)
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-teal-500/15 text-teal-300 border border-teal-500/30">
                    Executive Access
                  </span>
                </div>

                <p className="text-[11px] text-[var(--muted)]">
                  Enter a Google Spreadsheet URL or 44-character Spreadsheet ID. The system validates the URL and updates the live operational stream.
                </p>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-[var(--muted)] font-semibold">
                    Spreadsheet URL or ID
                  </label>
                  <input
                    type="text"
                    value={spreadsheetInput}
                    onChange={(e) => setSpreadsheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1Ez_KbSH9hE2NCTrvOngxDfjf88KwAccgfpaJsVDFLgg/edit"
                    className="w-full bg-[var(--line)]/30 border border-[var(--line)] rounded-lg p-2.5 font-mono text-[var(--fg)] text-xs focus:outline-none focus:border-[var(--teal)]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="btn btn-ghost py-2 px-3 text-xs"
                    onClick={handleValidateSource}
                    disabled={isValidatingSource}
                  >
                    {isValidatingSource ? 'Validating…' : 'Validate Source'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-teal py-2 px-4 text-xs font-semibold shadow"
                    onClick={handleSaveSource}
                    disabled={isSavingSource}
                  >
                    {isSavingSource ? 'Saving…' : 'Save & Reconnect'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--line)]/10 border border-[var(--line)] text-xs text-[var(--muted)] space-y-1">
                <div className="font-semibold text-[var(--fg)]">Source Configuration Protected</div>
                <p>
                  Spreadsheet source endpoints and ingestion configurations are securely managed by Executive Administrators.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: DATA REFRESH (Executive Admin & Controls) */}
      {activeSection === 'refresh' && (
        <div className="card space-y-6" id="settings-section-refresh">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-[var(--fg)] flex items-center gap-2">
                <span>↻</span>
                <span>Operational Data Refresh & Sync Schedule</span>
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Centralized data synchronization, cache freshness monitor, and 12-hour background refresh policies
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold ${
                effectiveStatus === 'LIVE'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : effectiveStatus === 'REFRESHING'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              }`}
            >
              ● STATUS: {effectiveStatus}
            </span>
          </div>

          {/* Primary Refresh Action Block */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[var(--panel)] to-[var(--line)]/30 border border-[var(--line)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-[var(--fg)]">Manual On-Demand Refresh</div>
                <p className="text-xs text-[var(--muted)]">
                  Force an immediate live pull from Google Sheets to re-synchronize metrics and allocation cohorts.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-teal text-sm py-3 px-6 font-bold shadow-md flex items-center gap-2"
                onClick={handleTriggerRefresh}
                disabled={isTriggeringRefresh}
                id="admin-refresh-now-btn"
              >
                <span className={isTriggeringRefresh ? 'animate-spin inline-block' : ''}>↻</span>
                <span>{isTriggeringRefresh ? 'Fetching from Sheets…' : 'Refresh Now'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--line)] text-xs font-mono">
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <div className="text-[10px] uppercase text-[var(--muted)]">Last Live Refresh</div>
                <div className="font-bold text-[var(--fg)]">
                  {lastFetchedAt ? lastFetchedAt.toLocaleTimeString() : 'Not refreshed'}
                </div>
                <div className="text-[10px] text-[var(--muted)]">
                  {lastFetchedAt ? lastFetchedAt.toLocaleDateString() : '-'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <div className="text-[10px] uppercase text-[var(--muted)]">Data Age</div>
                <div className="font-bold text-amber-300">
                  {dataAgeMinutes < 60
                    ? `${dataAgeMinutes} min ago`
                    : `${Math.floor(dataAgeMinutes / 60)}h ${dataAgeMinutes % 60}m ago`}
                </div>
                <div className="text-[10px] text-emerald-400">
                  {dataAgeMinutes < 720 ? '● Within 12h threshold' : '⚠ Stale data cache'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <div className="text-[10px] uppercase text-[var(--muted)]">Next Auto Refresh</div>
                <div className="font-bold text-[var(--teal)]">
                  {serverDataStatus?.nextRefreshAt
                    ? new Date(serverDataStatus.nextRefreshAt).toLocaleTimeString()
                    : 'In ~12 hours'}
                </div>
                <div className="text-[10px] text-[var(--muted)]">
                  {refreshPolicy === 'every12Hours' ? 'Auto-scheduled' : 'Manual policy active'}
                </div>
              </div>
            </div>
          </div>

          {/* Sync Schedule Policy Section */}
          {isAdmin && (
            <div className="p-5 rounded-2xl bg-[var(--line)]/20 border border-[var(--line)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-xs text-[var(--fg)]">
                  Automated Background Synchronization Schedule
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Admin Policy
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label
                  className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    refreshPolicy === 'every12Hours'
                      ? 'bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--fg)]'
                      : 'bg-[var(--line)]/10 border-[var(--line)] text-[var(--muted)] hover:bg-[var(--line)]/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="refreshPolicy"
                    checked={refreshPolicy === 'every12Hours'}
                    onChange={() => handleUpdatePolicy('every12Hours')}
                    disabled={isUpdatingPolicy}
                    className="mt-0.5 text-[var(--teal)]"
                  />
                  <div className="space-y-1">
                    <div className="font-bold text-[var(--fg)]">Every 12 Hours (Automated Sync)</div>
                    <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                      Automatically queries Google Sheets in the background every 12 hours to maintain fresh cohorts without blocking analysts.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    refreshPolicy === 'manual'
                      ? 'bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--fg)]'
                      : 'bg-[var(--line)]/10 border-[var(--line)] text-[var(--muted)] hover:bg-[var(--line)]/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="refreshPolicy"
                    checked={refreshPolicy === 'manual'}
                    onChange={() => handleUpdatePolicy('manual')}
                    disabled={isUpdatingPolicy}
                    className="mt-0.5 text-[var(--teal)]"
                  />
                  <div className="space-y-1">
                    <div className="font-bold text-[var(--fg)]">Manual Refresh Only</div>
                    <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                      Only refreshes when explicitly triggered by an Executive Administrator via the Refresh button.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Dataset Quality & Verification Details */}
          <div className="p-4 rounded-xl bg-[var(--line)]/20 border border-[var(--line)] text-xs space-y-3 font-mono">
            <div className="flex justify-between items-center text-[var(--fg)] font-semibold">
              <span>Verified Operational Tab Data</span>
              <span className="text-emerald-400">✓ Strict Read-Only Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-[var(--bg)] border border-[var(--line)] flex justify-between">
                <span className="text-[var(--muted)]">Raw_data Records:</span>
                <span className="text-emerald-400 font-bold">{rawCount.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded bg-[var(--bg)] border border-[var(--line)] flex justify-between">
                <span className="text-[var(--muted)]">Allocation_Raw Records:</span>
                <span className="text-teal-400 font-bold">{allocCount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: USAGE & AUDIT */}
      {activeSection === 'usage' && (
        <div className="card space-y-6" id="settings-section-usage">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-[var(--fg)]">
                AI Usage & Analytics Audit Trail
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Request tracking and execution logs for operational queries
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--muted)] font-mono uppercase">AI Usage Today</div>
              <div className="text-xl font-mono font-bold text-amber-300">
                {usageSummary.todayCount} requests
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-[var(--muted)] uppercase font-semibold">
                Recent AI Analyst Invocations
              </span>
              {isLoadingUsage && <span className="text-[var(--teal)] text-[11px]">Syncing logs…</span>}
            </div>

            {usageSummary.recentLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--muted)] font-mono border border-dashed border-[var(--line)] rounded-xl">
                No AI queries executed in this session yet. Ask questions in the AI Analyst panel to view the audit log.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[var(--line)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--line)]/30 text-[var(--muted)] font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Agent</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Question</th>
                      <th className="p-3">Tools Used</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)] font-mono">
                    {usageSummary.recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--line)]/10">
                        <td className="p-3 text-[var(--muted)] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-3 font-semibold text-[var(--fg)] capitalize">
                          {log.agent}
                        </td>
                        <td className="p-3 text-[var(--teal)] uppercase">
                          {log.provider}
                        </td>
                        <td className="p-3 max-w-[200px] truncate text-[var(--fg)]" title={log.question}>
                          {log.question}
                        </td>
                        <td className="p-3 text-[var(--muted)] text-[10px]">
                          {log.toolsUsed.join(', ') || 'Direct'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD USER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h4 className="text-base font-serif font-bold text-[var(--fg)]">
                Add Authorized Everest User
              </h4>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-mono text-[var(--muted)] uppercase font-semibold">
                  Google Workspace Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="analyst@everestfleet.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full bg-[var(--line)]/20 border border-[var(--line)] rounded-lg p-2.5 text-[var(--fg)] font-mono focus:outline-none focus:border-[var(--teal)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[var(--muted)] uppercase font-semibold">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operations Specialist"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })}
                  className="w-full bg-[var(--line)]/20 border border-[var(--line)] rounded-lg p-2.5 text-[var(--fg)] focus:outline-none focus:border-[var(--teal)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-mono text-[var(--muted)] uppercase font-semibold">
                    Role
                  </label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value as UserRole })}
                    className="w-full bg-[var(--line)]/20 border border-[var(--line)] rounded-lg p-2.5 text-[var(--fg)] font-mono focus:outline-none focus:border-[var(--teal)]"
                  >
                    <option value="OPERATIONS ANALYST">OPERATIONS ANALYST</option>
                    <option value="EXECUTIVE ADMINISTRATOR">EXECUTIVE ADMINISTRATOR</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[var(--muted)] uppercase font-semibold">
                    Status
                  </label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value as UserStatus })}
                    className="w-full bg-[var(--line)]/20 border border-[var(--line)] rounded-lg p-2.5 text-[var(--fg)] font-mono focus:outline-none focus:border-[var(--teal)]"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  className="btn btn-ghost py-2 px-3.5"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-teal py-2 px-4 shadow"
                  disabled={isSubmittingAdd}
                >
                  {isSubmittingAdd ? 'Adding…' : 'Add to Access Registry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h4 className="text-base font-serif font-bold text-[var(--fg)]">
                Edit User: {editingUser.email}
              </h4>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-mono text-[var(--muted)] uppercase font-semibold">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full bg-[var(--line)]/20 border border-[var(--line)] rounded-lg p-2.5 text-[var(--fg)] focus:outline-none focus:border-[var(--teal)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-mono text-[var(--muted)] uppercase font-semibold">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full bg-[var(--line)]/20 border border-[var(--line)] rounded-lg p-2.5 text-[var(--fg)] font-mono focus:outline-none focus:border-[var(--teal)]"
                  >
                    <option value="OPERATIONS ANALYST">OPERATIONS ANALYST</option>
                    <option value="EXECUTIVE ADMINISTRATOR">EXECUTIVE ADMINISTRATOR</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[var(--muted)] uppercase font-semibold">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatus })}
                    className="w-full bg-[var(--line)]/20 border border-[var(--line)] rounded-lg p-2.5 text-[var(--fg)] font-mono focus:outline-none focus:border-[var(--teal)]"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  className="btn btn-ghost py-2 px-3.5"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-teal py-2 px-4 shadow"
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--panel)] border border-red-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 text-lg">
              ⚠
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-serif font-bold text-[var(--fg)]">
                Remove User Access?
              </h4>
              <p className="text-xs text-[var(--muted)]">
                Are you sure you want to remove <strong className="text-[var(--fg)]">{deleteConfirmUser.displayName}</strong> ({deleteConfirmUser.email}) from the approved Everest access list?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost py-2 px-4 text-xs font-mono"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={isSubmittingDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn bg-red-600 hover:bg-red-500 text-white py-2 px-4 text-xs font-mono font-bold shadow"
                onClick={handleDeleteUser}
                disabled={isSubmittingDelete}
              >
                {isSubmittingDelete ? 'Removing…' : 'Yes, Remove Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

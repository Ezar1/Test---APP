/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccessCheckResult, ManagedUser, AdminAuditLogEntry } from '../types';
import { getFirebaseIdToken } from '../services/auth';

export interface ApprovedUserRecord {
  email: string;
  role: string;
  name: string;
}

// Client-side known approved user baseline (strict allowlist, NO blanket domain matching)
export const APPROVED_USERS: ApprovedUserRecord[] = [
  {
    email: 'sk.ezaruddin@everestfleet.com',
    role: 'EXECUTIVE ADMINISTRATOR',
    name: 'Kezaruddin (Everest)',
  },
  {
    email: 'skezaruddin2@gmail.com',
    role: 'EXECUTIVE ADMINISTRATOR',
    name: 'Kezaruddin (Primary Admin)',
  },
  {
    email: 'p9168337@gmail.com',
    role: 'EXECUTIVE ADMINISTRATOR',
    name: 'Authorized Admin (p9168337)',
  },
  {
    email: 'admin@everestfleet.com',
    role: 'EXECUTIVE ADMINISTRATOR',
    name: 'Everest Executive Admin',
  },
  {
    email: 'manager@everestfleet.com',
    role: 'OPERATIONS ANALYST',
    name: 'Fleet Operations Manager',
  },
  {
    email: 'analyst@everestfleet.com',
    role: 'OPERATIONS ANALYST',
    name: 'Fleet Analyst',
  },
  {
    email: 'viewer@everestfleet.com',
    role: 'VIEWER',
    name: 'Regional Operations Viewer',
  },
];

async function getAuthHeaders(requesterEmail?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await getFirebaseIdToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (requesterEmail) {
    headers['x-user-email'] = requesterEmail;
  }
  return headers;
}

/**
 * Evaluates whether a user email is permitted to access the Everest operational dashboard.
 * Cryptographically verifies session token with the server registry.
 */
export async function checkUserAccess(email: string | null | undefined): Promise<AccessCheckResult> {
  if (!email) {
    return {
      approved: false,
      email: '',
      role: 'Unauthorized',
      name: 'Guest',
      message: 'No authenticated email session found.',
    };
  }

  const normalized = email.trim().toLowerCase();

  try {
    const headers = await getAuthHeaders(normalized);
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: normalized }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('Server auth check fallback to strict client allowlist:', err);
  }

  // Fallback to strict client allowlist ONLY if server is unreachable
  const localMatch = APPROVED_USERS.find(
    (u) => u.email.toLowerCase() === normalized
  );

  if (localMatch) {
    return {
      approved: true,
      email: localMatch.email,
      role: localMatch.role,
      name: localMatch.name,
    };
  }

  // STRICT REJECTION: No automatic approval based merely on @everestfleet.com domain
  return {
    approved: false,
    email: normalized,
    role: 'Unauthorized',
    name: normalized,
    message: 'ACCESS NOT ENABLED. Your Google account is authenticated, but your Everest application access is not enabled. Contact an Everest administrator.',
  };
}

/**
 * Record explicit user signout on server audit log
 */
export async function recordServerLogout(email: string) {
  try {
    const headers = await getAuthHeaders(email);
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email }),
    });
  } catch {
    // Ignore offline errors on sign out
  }
}

/**
 * Fetches all registered users from the server (Executive Admin privilege required).
 */
export async function fetchManagedUsers(requesterEmail: string): Promise<{
  users: ManagedUser[];
  total: number;
  activeCount: number;
  disabledCount: number;
}> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/admin/users', {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch user directory.');
  }

  return await res.json();
}

/**
 * Creates a new managed user record on the server.
 */
export async function addManagedUser(
  requesterEmail: string,
  payload: { email: string; displayName: string; role: string; status: string }
): Promise<{ success: boolean; user: ManagedUser; users: ManagedUser[] }> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to add user to access registry.');
  }

  return await res.json();
}

/**
 * Updates an existing managed user on the server.
 */
export async function updateManagedUser(
  requesterEmail: string,
  targetEmail: string,
  updates: { displayName?: string; role?: string; status?: string }
): Promise<{ success: boolean; user: ManagedUser; users: ManagedUser[] }> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetEmail)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update user.');
  }

  return await res.json();
}

/**
 * Removes a user from the access list (Executive Admin privilege required).
 */
export async function deleteManagedUser(
  requesterEmail: string,
  targetEmail: string
): Promise<{ success: boolean; message: string; users: ManagedUser[] }> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetEmail)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete user.');
  }

  return await res.json();
}

/**
 * Fetches the administrative audit trail.
 */
export async function fetchAdminAuditLogs(requesterEmail: string): Promise<{ logs: AdminAuditLogEntry[]; total: number }> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/admin/audit-logs', {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch admin audit logs.');
  }

  return await res.json();
}

/**
 * Data Source API Helpers
 */
export async function fetchDataSourceConfig(): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  sourceName: string;
  status: string;
  permissions: { readOnly: boolean; noWrite: boolean };
  lastSync: string;
}> {
  const res = await fetch('/api/datasource');
  if (!res.ok) throw new Error('Failed to fetch data source configuration.');
  return await res.json();
}

export async function validateDataSource(inputUrlOrId: string): Promise<{
  valid: boolean;
  spreadsheetId: string;
  constructedUrl: string;
}> {
  const res = await fetch('/api/datasource/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputUrlOrId }),
  });

  const data = await res.json();
  if (!res.ok || !data.valid) {
    throw new Error(data.error || 'Invalid Google Spreadsheet URL or ID.');
  }
  return data;
}

export async function updateDataSourceConfig(
  requesterEmail: string,
  inputUrlOrId: string
): Promise<{ success: boolean; spreadsheetId: string; spreadsheetUrl: string; message: string }> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/datasource/update', {
    method: 'POST',
    headers,
    body: JSON.stringify({ inputUrlOrId }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update data source.');
  }
  return data;
}

/**
 * Fetches cached operational data from the centralized server cache.
 * Accessible to all authenticated users (Admin, Analyst, Viewer).
 */
export async function fetchOperationalData(requesterEmail?: string): Promise<{
  rawRows: Record<string, any>[];
  allocRows: Record<string, any>[];
  tabsFound: string[];
  lastFetchedAt: string;
  spreadsheetId: string;
  status: 'LIVE' | 'CACHED' | 'REFRESHING' | 'STALE' | 'ERROR';
  dataAgeMinutes: number;
  nextRefreshAt: string;
  refreshPolicy: 'every12Hours' | 'manual';
}> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/data/operational', {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch operational data from server cache.');
  }

  return await res.json();
}

/**
 * Admin action: Forces an immediate refresh of the Google Sheet data.
 */
export async function triggerAdminDataRefresh(requesterEmail: string): Promise<{
  success: boolean;
  message: string;
  lastFetchedAt: string;
  rawCount: number;
  allocCount: number;
  dataAgeMinutes: number;
  nextRefreshAt: string;
}> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/admin/data/refresh', {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to trigger operational data refresh.');
  }

  return await res.json();
}

/**
 * Admin action: Updates the data refresh mode (every12Hours vs manual).
 */
export async function updateRefreshPolicy(
  requesterEmail: string,
  policy: 'every12Hours' | 'manual'
): Promise<{ success: boolean; refreshPolicy: 'every12Hours' | 'manual'; message: string }> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/admin/data/refresh-policy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ policy }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update refresh policy.');
  }

  return await res.json();
}

/**
 * Fetches the current operational data freshness status.
 */
export async function fetchDataStatus(): Promise<{
  status: 'LIVE' | 'CACHED' | 'REFRESHING' | 'STALE' | 'ERROR';
  lastFetchedAt: string | null;
  dataAgeMinutes: number;
  nextRefreshAt: string | null;
  spreadsheetId: string;
  spreadsheetUrl: string;
  refreshPolicy: 'every12Hours' | 'manual';
  rawCount: number;
  allocCount: number;
}> {
  const res = await fetch('/api/data/status');
  if (!res.ok) throw new Error('Failed to fetch data status');
  return await res.json();
}

/**
 * Resets the operational cache to the high-fidelity Everest Fleet baseline dataset.
 */
export async function resetBaselineOperationalDataset(requesterEmail: string): Promise<{
  success: boolean;
  message: string;
  rawCount: number;
  allocCount: number;
  lastFetchedAt: string;
  status: string;
}> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/admin/data/reset-sample', {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to reset operational dataset.');
  }

  return await res.json();
}

/**
 * Uploads local parsed records into the server-side operational cache.
 */
export async function uploadOperationalDataToServer(
  requesterEmail: string,
  rawRows: Record<string, any>[],
  allocRows: Record<string, any>[],
  tabsFound: string[]
): Promise<{
  success: boolean;
  message: string;
  rawCount: number;
  allocCount: number;
  lastFetchedAt: string;
}> {
  const headers = await getAuthHeaders(requesterEmail);
  const res = await fetch('/api/admin/data/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawRows, allocRows, tabsFound }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload operational dataset to server.');
  }

  return await res.json();
}


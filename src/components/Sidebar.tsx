/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ApprovedUserProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lastLoadedText: string;
  isOpen: boolean;
  onCloseMobile?: () => void;
  userProfile?: ApprovedUserProfile | null;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  lastLoadedText,
  isOpen,
  onCloseMobile,
  userProfile,
  onSignOut,
}) => {
  const roleString = (userProfile?.role || '').toUpperCase();
  const isAdmin = roleString.includes('ADMIN') || roleString === 'EXECUTIVE ADMINISTRATOR';
  const isViewer = roleString === 'VIEWER';

  // Base navigation items with updated TAT Report and strictly guarded Data Source tab
  const allNavItems = [
    { id: 'weekly', label: 'Weekly View', icon: '▤', soon: false, minRole: 'VIEWER' },
    { id: 'analyst', label: 'AI Analyst', icon: '✦', soon: false, minRole: 'OPERATIONS ANALYST' },
    { id: 'insights', label: 'TAT Report', icon: '⏱', soon: false, minRole: 'VIEWER' },
    { id: 'daily', label: 'Daily View', icon: '🗓', soon: true, minRole: 'VIEWER' },
    { id: 'agents', label: 'Agent Performance', icon: '👥', soon: true, minRole: 'VIEWER' },
    { id: 'data', label: 'Data Source', icon: '🗄', soon: false, minRole: 'EXECUTIVE ADMINISTRATOR' },
    { id: 'settings', label: 'Settings & Access', icon: '⚙', soon: false, minRole: 'EXECUTIVE ADMINISTRATOR' },
  ];

  // Filter based on strict RBAC (Data Source is strictly hidden for Operations Analyst & Viewers)
  const visibleNavItems = allNavItems.filter((item) => {
    if (item.minRole === 'EXECUTIVE ADMINISTRATOR') {
      return isAdmin;
    }
    if (item.minRole === 'OPERATIONS ANALYST') {
      return !isViewer;
    }
    return true;
  });

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
      <div className="brand">
        <div className="mark">Everest</div>
        <h1>
          Everest India
          <br />
          Onboarding Dashboard
        </h1>
        <p>Operations & Vehicle Allocation</p>
      </div>

      <nav className="nav" id="nav-list">
        {visibleNavItems.map((item) => (
          <div
            key={item.id}
            id={`nav-item-${item.id}`}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(item.id);
              if (onCloseMobile) onCloseMobile();
            }}
          >
            <span className="ic">{item.icon}</span>
            <span>{item.label}</span>
            {item.soon && <span className="soon">Soon</span>}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--line)] space-y-2 mt-auto">
        {onSignOut && (
          <button
            type="button"
            className="btn btn-ghost w-full text-xs py-2 px-3 text-red-400 hover:bg-red-500/10 border border-red-500/20 flex items-center justify-center gap-2 font-medium transition-colors"
            onClick={onSignOut}
            id="sidebar-logout-btn"
          >
            <span>⇥</span>
            <span>Log out</span>
          </button>
        )}

        <div className="sidebar-foot" id="sidebar-foot">
          <div className="live-dot" />
          <span className="truncate">{lastLoadedText || 'Live Google Sheets'}</span>
        </div>
      </div>
    </aside>
  );
};

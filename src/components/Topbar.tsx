/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { ApprovedUserProfile } from '../types';

interface TopbarProps {
  activeTab: string;
  subtitle: string;
  lastComputedText: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  currentUser: User | null;
  userProfile: ApprovedUserProfile | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onNavigateToTab: (tab: string) => void;
  onToggleMobileSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  subtitle,
  lastComputedText,
  isRefreshing,
  onRefresh,
  theme,
  onToggleTheme,
  currentUser,
  userProfile,
  onSignIn,
  onSignOut,
  onNavigateToTab,
  onToggleMobileSidebar,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const roleString = (userProfile?.role || '').toUpperCase();
  const isAdmin = roleString.includes('ADMIN') || roleString === 'EXECUTIVE ADMINISTRATOR';
  const isViewer = roleString === 'VIEWER';

  const titles: Record<string, string> = {
    weekly: 'Onboarding Dashboard',
    analyst: 'AI Operations Analyst',
    daily: 'Daily View',
    agents: 'Agent Performance',
    insights: 'Turnaround Time (TAT) Report',
    data: 'Data Source & Integration',
    settings: 'Settings & Access Management',
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMenuAction = (action: () => void) => {
    setIsMenuOpen(false);
    action();
  };

  return (
    <div className="topbar" id="topbar">
      <div className="flex items-center gap-3">
        <button
          className="btn btn-ghost btn-icon md:hidden"
          onClick={onToggleMobileSidebar}
          id="mobile-sidebar-toggle"
          title="Toggle Navigation Menu"
        >
          ☰
        </button>
        <div>
          <h2 id="topbar-title" className="gold-text">
            {titles[activeTab] || 'Onboarding Dashboard'}
          </h2>
          <div className="sub" id="topbar-sub">
            {subtitle || 'Connected to live operational data source'}
          </div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Quick AI Analyst Launcher Pill (Hidden for Viewers) */}
        {!isViewer && activeTab !== 'analyst' && (
          <button
            className="btn btn-teal text-xs py-1 px-3 flex items-center gap-1.5 font-semibold shadow-sm"
            onClick={() => onNavigateToTab('analyst')}
            id="topbar-ai-analyst-btn"
          >
            <span>✦</span>
            <span>AI Analyst</span>
          </button>
        )}

        {/* User Account Dropdown Menu */}
        {currentUser ? (
          <div className="flex items-center gap-2">
            <div className="relative" ref={menuRef}>
              <button
                className="pill cursor-pointer hover:border-amber-400/50 transition-colors flex items-center gap-2 text-left"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                id="user-account-pill"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Profile"
                    className="w-4 h-4 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                )}
                <span className="max-w-[130px] truncate font-medium text-xs">
                  {currentUser.displayName || userProfile?.name || currentUser.email}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  {isAdmin ? 'ADMIN' : isViewer ? 'VIEWER' : 'ANALYST'}
                </span>
                <span className="text-[10px] text-[var(--muted)]">▼</span>
              </button>

              {/* Floating Dropdown Menu */}
              {isMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl py-2 z-50 text-xs animate-fadeIn"
                  id="user-dropdown-menu"
                >
                  {/* User Identity Header */}
                  <div className="px-3.5 py-2.5 border-b border-[var(--line)] mb-1">
                    <div className="font-semibold text-[var(--fg)] truncate">
                      {currentUser.displayName || userProfile?.name || 'Authorized User'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] font-mono truncate">
                      {currentUser.email}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        ● {userProfile?.role || 'Operations Analyst'}
                      </span>
                    </div>
                  </div>

                  {/* Menu Options */}
                  {isAdmin && (
                    <button
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--line)]/30 text-[var(--fg)] flex items-center gap-2 transition-colors"
                      onClick={() => handleMenuAction(() => onNavigateToTab('settings'))}
                      id="menu-settings-btn"
                    >
                      <span>⚙</span>
                      <span>Settings & Access Control</span>
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--line)]/30 text-[var(--fg)] flex items-center gap-2 transition-colors"
                      onClick={() => handleMenuAction(() => onNavigateToTab('data'))}
                      id="menu-datasource-btn"
                    >
                      <span>🗄</span>
                      <span>Data Source Status</span>
                    </button>
                  )}

                  <div className="border-t border-[var(--line)] my-1"></div>

                  {/* Sign Out option */}
                  <button
                    className="w-full text-left px-3.5 py-2 hover:bg-red-500/15 text-red-400 hover:text-red-300 flex items-center gap-2 font-semibold transition-colors"
                    onClick={() => handleMenuAction(onSignOut)}
                    id="menu-signout-btn"
                  >
                    <span>⇥</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Direct Quick Logout Button on Tab Bar */}
            <button
              type="button"
              className="btn btn-ghost text-xs py-1 px-2.5 border border-red-500/30 text-red-400 hover:bg-red-500/15 hover:text-red-300 flex items-center gap-1 font-medium transition-colors"
              onClick={onSignOut}
              id="topbar-direct-logout-btn"
              title="Sign out of Everest Platform"
            >
              <span>⇥</span>
              <span>Log out</span>
            </button>
          </div>
        ) : (
          <button
            className="btn btn-teal"
            id="google-signin-topbar-btn"
            onClick={onSignIn}
            title="Connect Google Account"
          >
            Sign in with Google
          </button>
        )}

        <div className="pill" id="last-computed-pill">
          {lastComputedText || 'Ready'}
        </div>

        <button
          className="btn btn-ghost btn-icon"
          id="theme-toggle"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </div>
    </div>
  );
};

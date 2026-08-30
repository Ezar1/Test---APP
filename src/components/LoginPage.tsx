/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface LoginPageProps {
  onSignIn: () => void;
  onMobileSignIn?: (identifier: string) => void;
  isLoading: boolean;
  loadingMessage?: string;
  errorMessage?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSignIn,
  onMobileSignIn,
  isLoading,
  loadingMessage,
  errorMessage,
}) => {
  const [identifier, setIdentifier] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    if (onMobileSignIn) {
      onMobileSignIn(identifier.trim());
    } else {
      onSignIn();
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between items-center px-4 py-10 sm:py-16 selection:bg-[#0284c7]/20 selection:text-[#0f172a]"
      id="everest-login-page"
      style={{
        backgroundColor: '#FAF7F2',
        color: '#1e293b',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top spacer */}
      <div className="w-full h-2" />

      {/* Main Content matching Everest Fleet portal */}
      <div className="w-full max-w-[420px] flex flex-col items-center text-center animate-fadeIn" id="login-container">
        {/* Everest Fleet Official Brand Logo */}
        <div className="mb-6 flex flex-col items-center select-none" id="brand-logo">
          <div className="relative flex items-center justify-center mb-1">
            {/* EF Stylized Geometric Monogram */}
            <svg width="68" height="58" viewBox="0 0 100 85" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Left Navy / Dark Teal Angled Upward Wing */}
              <path d="M12 70L46 12L46 70H12Z" fill="#1e3a5f" />
              {/* Center divider white cut */}
              <path d="M46 12L46 70H40L40 22L46 12Z" fill="#1e3a5f" />
              {/* Right Teal Arrow Point */}
              <path d="M50 12L84 70H68L50 38L50 12Z" fill="#00a8b5" />
              {/* Horizontal Crossbars for E/F */}
              <rect x="22" y="38" width="46" height="7" rx="2" fill="#00a8b5" />
              <rect x="28" y="52" width="34" height="7" rx="2" fill="#00a8b5" />
            </svg>
          </div>
          {/* EVEREST FLEET teal banner badge */}
          <div className="bg-[#48b4bd] text-white px-4 py-1 rounded-[3px] text-[12px] font-extrabold tracking-[0.16em] uppercase shadow-xs">
            EVEREST FLEET
          </div>
        </div>

        {/* WELCOME BACK Title */}
        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0f2d4a] tracking-tight uppercase mb-8">
          WELCOME BACK
        </h1>

        {/* Error Notification */}
        {errorMessage && (
          <div
            className="w-full mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[#b91c1c] text-xs text-left flex items-start gap-2.5"
            role="alert"
          >
            <span className="font-bold flex-shrink-0 text-sm">⚠</span>
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Mobile Number / Email Form */}
        <form onSubmit={handleSubmit} className="w-full text-left space-y-4">
          <div>
            <label htmlFor="mobile-input" className="block text-[13px] font-semibold text-[#1e293b] mb-2">
              Mobile Number
            </label>
            <div className="relative">
              <input
                id="mobile-input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter 10 digits mobile number"
                className="w-full px-4 py-3 bg-white text-[#0f172a] placeholder-[#94a3b8] text-[14px] rounded-lg border border-[#cbd5e1] focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/30 outline-none transition-all duration-150 shadow-xs"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="mt-2 text-[12px] text-[#64748b]">
              <span>New to Everest Fleet? </span>
              <button
                type="button"
                onClick={() => setIdentifier('p9168337@gmail.com')}
                className="text-[#0284c7] hover:underline font-medium cursor-pointer"
              >
                Create an account here
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            id="mobile-signin-submit-btn"
            disabled={isLoading || !identifier.trim()}
            className="w-full py-3 px-4 bg-[#0f2d4a] hover:bg-[#163e63] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[14px] rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="text-xs">{loadingMessage || 'Signing in…'}</span>
              </>
            ) : (
              <span>Continue</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full flex items-center my-6">
          <div className="flex-1 border-t border-[#e2e8f0]" />
          <span className="px-3 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">or</span>
          <div className="flex-1 border-t border-[#e2e8f0]" />
        </div>

        {/* Secondary Google Sign-in */}
        <button
          id="google-signin-btn"
          type="button"
          onClick={onSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#fafafa] border border-[#d1d5db] hover:border-[#94a3b8] hover:shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] rounded-lg py-2.5 px-4 text-xs font-semibold text-[#0f172a] cursor-pointer transition-all duration-150 select-none disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          <span>Sign in with Google</span>
        </button>
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-[#94a3b8] select-none">
        <div className="font-medium text-[#64748b]">Everest Fleet India Private Limited</div>
        <div className="text-[10px] text-[#94a3b8] mt-0.5 font-mono">Driver Onboarding & Operations Platform</div>
      </footer>
    </div>
  );
};

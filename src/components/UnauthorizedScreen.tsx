/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User } from 'firebase/auth';

interface UnauthorizedScreenProps {
  user: User | null;
  onSignOut: () => void;
}

export const UnauthorizedScreen: React.FC<UnauthorizedScreenProps> = ({
  user,
  onSignOut,
}) => {
  const email = user?.email || 'Unknown User';

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-[#f4cf7c] selection:text-[#181510]"
      id="everest-unauthorized-screen"
      style={{
        color: '#181510',
        background: `
          radial-gradient(700px 420px at 18% 15%, rgba(232,171,53,0.14), transparent 60%),
          radial-gradient(600px 500px at 85% 90%, rgba(232,171,53,0.08), transparent 55%),
          linear-gradient(180deg, #f8f6f0, #eae3d2)
        `,
        fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Decorative Everest geometric mark watermark */}
      <div
        className="absolute -top-16 -right-16 w-72 h-72 opacity-35 pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <polygon points="100,0 200,0 100,100" fill="#f4cf7c" />
          <polygon points="200,0 200,100 100,100" fill="#c7d34a" />
          <polygon points="100,100 100,200 0,100" fill="#3a8fc7" />
          <polygon points="100,100 200,100 200,200" fill="#a24fa8" />
        </svg>
      </div>

      {/* Main Card */}
      <div
        className="relative z-10 w-full max-w-[420px] bg-[#fffdfa] border border-[#e2d8bd] rounded-[24px] p-8 sm:p-10 text-center animate-riseIn shadow-2xl"
        style={{
          boxShadow: '0 25px 60px -15px rgba(24,20,10,0.18), 0 4px 18px rgba(24,20,10,0.06)',
        }}
      >
        {/* Everest Brand Mark */}
        <div className="flex items-center justify-center gap-2.5 mb-5 select-none">
          <span
            className="text-[30px] font-extrabold text-[#181510] tracking-tight leading-none"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: '-0.03em' }}
          >
            Everest
          </span>
          <svg
            className="w-7 h-7 flex-shrink-0"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <polygon points="20,2 2,2 20,20" fill="#f4cf7c" />
            <polygon points="24,2 42,2 24,20" fill="#c7d34a" />
            <polygon points="2,24 20,42 2,42" fill="#3a8fc7" />
            <polygon points="24,24 42,42 24,42" fill="#a24fa8" />
          </svg>
        </div>

        {/* Warning Icon Badge */}
        <div className="w-12 h-12 mx-auto mb-3.5 rounded-full bg-amber-50 border border-amber-300 flex items-center justify-center text-[#c27803] text-xl font-bold">
          🔒
        </div>

        {/* Title */}
        <h2
          className="text-[20px] font-bold text-[#181510] mb-2 leading-tight tracking-tight"
          style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
        >
          ACCESS NOT ENABLED
        </h2>

        {/* Subtitle */}
        <p className="text-[13px] text-[#6d6659] mb-5 leading-relaxed">
          Your Google account is authenticated, but your Everest application access is not enabled. Contact an Everest administrator.
        </p>

        {/* User Box */}
        <div className="bg-[#f3efe5]/80 border border-[#e3dac0] rounded-[12px] p-3.5 mb-6 text-left text-xs space-y-1">
          <div className="text-[10px] text-[#8c8270] font-semibold uppercase tracking-wider">
            Authenticated Account
          </div>
          <div className="font-mono text-[#181510] truncate font-medium text-xs">
            {email}
          </div>
          <div className="text-[10.5px] text-amber-700 font-medium pt-1">
            Status: Pending Administrative Authorization
          </div>
        </div>

        {/* Sign out button */}
        <button
          id="unauthorized-signout-btn"
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 bg-[#181510] hover:bg-[#2b271f] text-white rounded-[12px] py-3 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-150 shadow-md active:scale-[0.98]"
        >
          Sign Out
        </button>

        {/* Footnote */}
        <div className="mt-6 pt-4 border-t border-[#e5dcbf] text-[10.5px] text-[#9c9384] leading-relaxed">
          Everest India Operations & Fleet Allocation Intelligence Portal
        </div>
      </div>
    </div>
  );
};

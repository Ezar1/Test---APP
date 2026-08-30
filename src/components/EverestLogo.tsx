/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface EverestLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const EverestLogo: React.FC<EverestLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const heights = {
    sm: 'h-6',
    md: 'h-9',
    lg: 'h-12',
    xl: 'h-16',
  };

  const fontSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const emblemSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {showText && (
        <span
          className={`font-sans font-bold tracking-tight text-[#171717] ${fontSizes[size]}`}
          style={{ letterSpacing: '-0.03em' }}
        >
          Everest
        </span>
      )}

      {/* Official 4-Color Pinwheel Geometric Mark */}
      <svg
        className={`${emblemSizes[size]} flex-shrink-0`}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Top-Left: Yellow (#E6C400) */}
        <polygon points="20,2 2,2 20,20" fill="#E6C400" />
        {/* Top-Right: Lime Green (#98C93C) */}
        <polygon points="24,2 42,2 24,20" fill="#98C93C" />
        {/* Bottom-Left: Electric Navy/Blue (#0076BA) */}
        <polygon points="2,24 20,42 2,42" fill="#0076BA" />
        {/* Bottom-Right: Rich Purple (#8C2D84) */}
        <polygon points="24,24 42,42 24,42" fill="#8C2D84" />
      </svg>
    </div>
  );
};

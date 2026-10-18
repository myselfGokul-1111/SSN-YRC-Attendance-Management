import React from 'react';

interface PcdEmblemProps {
  className?: string;
  size?: number;
}

// Pure color theme: displays only the signature PCD wing colors (YRC Red, NSS Blue, NSO Emerald) without any logo design
export const PcdEmblem: React.FC<PcdEmblemProps> = ({ className = '', size = 28 }) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-br from-red-600 via-red-700 to-red-800 shadow-xs border border-red-500/40 select-none ${className}`}
      title="SSN PCD Colour Theme: YRC (Red) · NSS (Blue) · NSO (Green)"
    >
      {/* Tri-color theme indicator dots */}
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" title="Red: YRC" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-300 shadow-xs" title="Blue: NSS" />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-xs" title="Green: NSO" />
      </div>
    </div>
  );
};

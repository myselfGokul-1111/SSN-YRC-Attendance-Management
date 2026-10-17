import React from 'react';

interface YrcEmblemProps {
  className?: string;
  size?: number;
}

export const YrcEmblem: React.FC<YrcEmblemProps> = ({ className = '', size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer White circular badge with crimson border */}
      <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#DC2626" strokeWidth="5" />
      <circle cx="50" cy="50" r="40" fill="#FEF2F2" stroke="#EF4444" strokeWidth="1.5" />
      
      {/* Official Youth Red Cross Greek Cross Emblem */}
      {/* Vertical beam */}
      <rect x="42" y="22" width="16" height="56" rx="2" fill="#DC2626" />
      {/* Horizontal beam */}
      <rect x="22" y="42" width="56" height="16" rx="2" fill="#DC2626" />
      
      {/* Inner highlight for crisp emblem feel */}
      <circle cx="50" cy="50" r="4" fill="#FFFFFF" opacity="0.3" />
    </svg>
  );
};

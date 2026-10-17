import React from 'react';

interface BarcodeVisualProps {
  value: string;
  className?: string;
  height?: number;
}

/**
 * Renders an authentic Code-128 styled barcode SVG pattern
 * deterministically calculated from the alphanumeric string.
 */
export const BarcodeVisual: React.FC<BarcodeVisualProps> = ({
  value,
  className = '',
  height = 42,
}) => {
  // Deterministic bar widths based on char codes
  const bars: { width: number; isBlack: boolean }[] = [];
  
  // Guard bars
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const pattern = [
      (code % 3) + 1,
      ((code >> 1) % 2) + 1,
      ((code >> 2) % 3) + 1,
      ((code >> 3) % 2) + 1,
    ];

    pattern.forEach((w, idx) => {
      bars.push({
        width: w,
        isBlack: idx % 2 === 0,
      });
    });
  }

  // End guard bars
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 3, isBlack: true });

  const totalWidth = bars.reduce((acc, b) => acc + b.width, 0);

  let currentX = 0;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full max-w-[220px]"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <rect width={totalWidth} height={height} fill="#ffffff" />
        {bars.map((bar, index) => {
          const x = currentX;
          currentX += bar.width;
          if (!bar.isBlack) return null;
          return (
            <rect
              key={index}
              x={x}
              y={0}
              width={bar.width}
              height={height}
              fill="#18181b"
            />
          );
        })}
      </svg>
      <span className="font-mono text-[10px] tracking-widest text-neutral-600 mt-1">
        *{value}*
      </span>
    </div>
  );
};

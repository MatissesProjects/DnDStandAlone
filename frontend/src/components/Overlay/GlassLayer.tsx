import React from 'react';
import { Ping } from '../../types/vtt';

interface GlassLayerProps {
  onPing: (x: number, y: number) => void;
  pings: Ping[];
  isGM: boolean;
}

const GlassLayer: React.FC<GlassLayerProps> = ({ onPing, pings, isGM }) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If GM, we might want to toggle this layer or handle it differently
    // For now, let's assume it's always active for pings
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onPing(x, y);
  };

  return (
    <div 
      className={`absolute inset-0 z-[100] cursor-crosshair ${isGM ? 'pointer-events-none' : 'pointer-events-auto'}`}
      onClick={isGM ? undefined : handleClick}
      onDoubleClick={isGM ? handleClick : undefined} // GM can double click to ping so they don't interfere with Excalidraw as much
    >
      {pings.map(ping => (
        <div 
          key={ping.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${ping.x}%`, top: `${ping.y}%` }}
        >
          <div className="relative flex items-center justify-center">
            <div 
              className="absolute w-8 h-8 rounded-full animate-ping opacity-75"
              style={{ backgroundColor: ping.color }}
            />
            <div 
              className="absolute w-12 h-12 rounded-full animate-ping opacity-40"
              style={{ backgroundColor: ping.color, animationDelay: '0.2s' }}
            />
            <div 
              className="w-3 h-3 rounded-full shadow-lg border border-white/50"
              style={{ backgroundColor: ping.color }}
            />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-gray-900/90 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border border-white/10 whitespace-nowrap text-white shadow-xl">
              {ping.username}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GlassLayer;

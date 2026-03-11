import React, { useState, useCallback, useEffect } from 'react';
import type { Ping } from '../../types/vtt';

interface FogZone {
  id: string;
  x: number;
  y: number;
  r: number;
}

interface GlassLayerProps {
  onPing: (x: number, y: number) => void;
  pings: Ping[];
  isGM: boolean;
  isFogActive: boolean;
  fogZones: FogZone[];
  onUpdateFog?: (zones: FogZone[]) => void;
}

const GlassLayer: React.FC<GlassLayerProps> = ({ onPing, pings, isGM, isFogActive, fogZones, onUpdateFog }) => {
  const [measurement, setMeasurement] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);
  const [isClearingFog, setIsClearingFog] = useState(false);

  const getCoords = (e: React.MouseEvent | MouseEvent, rect: DOMRect) => {
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = getCoords(e, rect);

    // Fog Clearing: Ctrl + Click (GM only)
    if (isGM && e.ctrlKey) {
      setIsClearingFog(true);
      const newZone: FogZone = { id: `fog-${Date.now()}`, x: coords.x, y: coords.y, r: 10 };
      onUpdateFog?.([...fogZones, newZone]);
      e.preventDefault();
      return;
    }

    // Measurement: Alt or Shift + Drag
    if (e.altKey || e.shiftKey) {
      setMeasurement({ start: coords, current: coords });
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = document.getElementById('glass-layer-container');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const coords = getCoords(e, rect);

    if (measurement) {
      setMeasurement(prev => prev ? { ...prev, current: coords } : null);
    }

    if (isClearingFog && isGM) {
      // Just add a new zone for now as a "brush" effect
      const newZone: FogZone = { id: `fog-${Date.now()}`, x: coords.x, y: coords.y, r: 10 };
      onUpdateFog?.([...fogZones, newZone]);
    }
  }, [measurement, isClearingFog, isGM, fogZones, onUpdateFog]);

  const handleMouseUp = useCallback(() => {
    setMeasurement(null);
    setIsClearingFog(false);
  }, []);

  useEffect(() => {
    if (measurement || isClearingFog) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [measurement, isClearingFog, handleMouseMove, handleMouseUp]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.altKey || e.shiftKey || e.ctrlKey) return;
    if (isGM) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = getCoords(e, rect);
    onPing(x, y);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isGM) return;
    if (e.ctrlKey) {
        // Reset fog zones
        onUpdateFog?.([]);
        return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = getCoords(e, rect);
    onPing(x, y);
  };

  const calculateDistance = () => {
    if (!measurement) return 0;
    const dx = measurement.current.x - measurement.start.x;
    const dy = measurement.current.y - measurement.start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.round(dist / 2); 
  };

  return (
    <div 
      id="glass-layer-container"
      className={`absolute inset-0 z-[100] ${isGM && !measurement && !isClearingFog ? 'pointer-events-none' : 'pointer-events-auto'} ${measurement ? 'cursor-none' : 'cursor-crosshair'}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Fog of War Overlay */}
      {isFogActive && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <mask id="fog-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {fogZones.map(zone => (
              <circle key={zone.id} cx={`${zone.x}%`} cy={`${zone.y}%`} r={`${zone.r}%`} fill="black" />
            ))}
          </mask>
          <rect 
            x="0" y="0" width="100%" height="100%" 
            fill="black" 
            mask="url(#fog-mask)" 
            className={`${isGM ? 'opacity-40' : 'opacity-100'} transition-opacity duration-1000`} 
          />
        </svg>
      )}

      {/* Measurements SVG */}
      {measurement && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <line x1={`${measurement.start.x}%`} y1={`${measurement.start.y}%`} x2={`${measurement.current.x}%`} y2={`${measurement.current.y}%`} stroke="#818cf8" strokeWidth="3" strokeDasharray="8 4" filter="url(#glow)" className="opacity-80" />
          <circle cx={`${measurement.start.x}%`} cy={`${measurement.start.y}%`} r="6" fill="#818cf8" filter="url(#glow)" />
          <circle cx={`${measurement.current.x}%`} cy={`${measurement.current.y}%`} r="6" fill="#818cf8" filter="url(#glow)" />
        </svg>
      )}

      {measurement && (
        <div 
          className="absolute pointer-events-none bg-indigo-600/90 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-2xl border border-indigo-400/50 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
          style={{ left: `${(measurement.start.x + measurement.current.x) / 2}%`, top: `${(measurement.start.y + measurement.current.y) / 2}%` }}
        >
          <span className="tracking-widest uppercase text-[8px] opacity-70">Distance</span>
          <span>{calculateDistance()} ft</span>
        </div>
      )}

      {/* Pings */}
      {pings.map(ping => (
        <div key={ping.id} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${ping.x}%`, top: `${ping.y}%` }}>
          <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 rounded-full animate-ping opacity-75" style={{ backgroundColor: ping.color }} />
            <div className="absolute w-12 h-12 rounded-full animate-ping opacity-40" style={{ backgroundColor: ping.color, animationDelay: '0.2s' }} />
            <div className="w-3 h-3 rounded-full shadow-lg border border-white/50" style={{ backgroundColor: ping.color }} />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-gray-900/90 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border border-white/10 whitespace-nowrap text-white shadow-xl">{ping.username}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GlassLayer;

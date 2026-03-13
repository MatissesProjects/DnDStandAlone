import React, { useState, useRef } from 'react';
import type { Handout } from '../../types/vtt';

interface HandoutItemProps {
  handout: Handout;
  isGM: boolean;
  onDelete: (id: number) => void;
  onMove: (id: number, x: number, y: number) => void;
  onClaim?: (id: number, content: string) => void;
}

const HandoutItem: React.FC<HandoutItemProps> = ({ handout, isGM, onDelete, onMove, onClaim }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: handout.x, y: handout.y });
  const [isDismissed, setIsDismissed] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isGM) return;
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !isGM) return;
    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;
    setCurrentPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (!isDragging || !isGM) return;
    setIsDragging(false);
    onMove(handout.id, currentPos.x, currentPos.y);
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Sync with prop updates
  React.useEffect(() => {
    if (!isDragging) {
      setCurrentPos({ x: handout.x, y: handout.y });
    }
  }, [handout.x, handout.y, isDragging]);

  if (isDismissed) return null;

  return (
    <div 
      className={`absolute z-50 p-4 rounded-2xl glass-panel shadow-2xl border border-indigo-500/30 group animate-in zoom-in-95 duration-300 max-w-xs ${isGM ? 'cursor-move' : ''}`}
      style={{ left: currentPos.x, top: currentPos.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex justify-between items-start mb-2 gap-4">
        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">{handout.title}</h4>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }}
                className="p-1 hover:bg-gray-800 text-gray-500 hover:text-white rounded-lg transition-all"
                title="Dismiss Locally"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            {isGM && (
            <button 
                onClick={(e) => { e.stopPropagation(); if (window.confirm("Obliterate for all?")) onDelete(handout.id); }}
                className="p-1 hover:bg-red-900/20 text-gray-500 hover:text-red-500 rounded-lg transition-all"
                title="Obliterate for ALL"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            )}
        </div>
      </div>
      
      {handout.type === 'image' ? (
        <img src={handout.content} alt={handout.title} className="w-full rounded-lg border border-white/5" />
      ) : (
        <div className="space-y-3">
            <p className="text-xs text-gray-200 leading-relaxed italic opacity-90">{handout.content}</p>
            {!isGM && onClaim && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onClaim(handout.id, handout.content); }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2 rounded-xl uppercase text-[8px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Claim Loot
                </button>
            )}
        </div>
      )}
    </div>
  );
};

export default HandoutItem;

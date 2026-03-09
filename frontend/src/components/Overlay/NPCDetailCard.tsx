import React from 'react';
import type { Entity } from '../../types/vtt';

interface NPCDetailCardProps {
  entity: Entity;
  isGM: boolean;
  onClose: () => void;
  onUpdateStats: (entityId: number, statsUpdate: any) => void;
  onRoll: (entityName: string, label: string, bonus?: number) => void;
}

const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", 
  "Incapacitated", "Invisible", "Paralyzed", "Petrified", 
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"
];

const NPCDetailCard: React.FC<NPCDetailCardProps> = ({ entity, isGM, onClose, onUpdateStats, onRoll }) => {
  const activeConditions = entity.stats?.conditions || [];

  const toggleCondition = (condition: string) => {
    if (!isGM) return;
    const newConditions = activeConditions.includes(condition)
      ? activeConditions.filter((c: string) => c !== condition)
      : [...activeConditions, condition];
    onUpdateStats(entity.id, { conditions: newConditions });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-indigo-500/30 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="relative h-32 bg-indigo-900/20 flex items-end p-8 border-b border-gray-800">
          <div className="absolute top-6 right-8">
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl border border-indigo-400/20">{entity.name.substring(0, 2).toUpperCase()}</div>
            <div>
              <h3 className="text-2xl font-black tracking-tighter uppercase text-gray-100">{entity.name}</h3>
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Manifested Presence</p>
            </div>
          </div>
        </div>
        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Conditions Section */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Status Conditions</h4>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map(condition => (
                <button
                  key={condition}
                  onClick={() => toggleCondition(condition)}
                  disabled={!isGM}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${
                    activeConditions.includes(condition)
                      ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/20'
                      : 'bg-gray-950 border-gray-800 text-gray-600 hover:border-gray-600'
                  }`}
                >
                  {condition}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Object.entries(entity.stats || {}).filter(([k]) => k.length === 3).map(([key, val]) => (
              <button key={key} onClick={() => onRoll(entity.name, key.toUpperCase(), Math.floor(((val as number) - 10) / 2))} className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center shadow-inner hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all active:scale-95 group">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-tighter mb-1 group-hover:text-indigo-400">{key}</p>
                <p className="text-lg font-black text-white leading-none">{val as number}</p>
                <p className="text-[8px] text-gray-500 font-bold mt-1">({Math.floor(((val as number) - 10) / 2) >= 0 ? '+' : ''}{Math.floor(((val as number) - 10) / 2)})</p>
              </button>
            ))}
          </div>
          {entity.stats?.actions && entity.stats.actions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Combat Maneuvers</h4>
              <div className="grid grid-cols-1 gap-2">
                {entity.stats.actions.map((action: string, i: number) => (
                  <button key={i} onClick={() => onRoll(entity.name, action, 0)} className="w-full text-left bg-gray-950 p-3 rounded-xl border border-gray-800 hover:border-blue-500/50 hover:bg-blue-900/10 transition-all flex justify-between items-center group">
                    <span className="text-xs font-bold text-gray-300 group-hover:text-blue-400">{action}</span>
                    <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded border border-gray-800 font-black">ROLL</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Narrative Essence</h4>
            <p className="text-sm text-gray-300 leading-relaxed italic opacity-90">"{entity.backstory}"</p>
          </div>
          <div className="flex gap-3 pt-2">
            <div className="flex-[2] bg-gray-950 p-4 rounded-3xl border border-gray-800 flex items-center justify-between shadow-inner">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-gray-600 uppercase">HP</p>
                <p className="text-2xl font-black text-red-500 leading-none">{entity.stats?.hp || 0}</p>
              </div>
              {isGM && (
                <div className="flex gap-2">
                  <button onClick={() => onUpdateStats(entity.id, { hp: (entity.stats?.hp || 0) - 1 })} className="w-10 h-10 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl flex items-center justify-center font-black transition-all active:scale-90">-</button>
                  <button onClick={() => onUpdateStats(entity.id, { hp: (entity.stats?.hp || 0) + 1 })} className="w-10 h-10 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl flex items-center justify-center font-black transition-all active:scale-90">+</button>
                </div>
              )}
            </div>
            <div className="flex-1 bg-gray-950 p-4 rounded-3xl border border-gray-800 text-center shadow-inner">
              <p className="text-[8px] font-black text-gray-600 uppercase mb-1">AC</p>
              <p className="text-2xl font-black text-blue-400 leading-none">{entity.stats?.ac || '??'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NPCDetailCard;

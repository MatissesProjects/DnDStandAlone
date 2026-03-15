import React from 'react';

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
}

interface InitiativeTrackerProps {
  combatants: Combatant[];
  currentTurnIndex: number;
  isGM: boolean;
  onAction: (action: any) => void;
  isPlayerInInitiative: boolean;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({ combatants, currentTurnIndex, isGM, onAction, isPlayerInInitiative }) => {
  const sortedCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const handleNextTurn = () => {
    if (!isGM) return;
    onAction({ type: 'next_turn' });
  };

  const handleRemove = (id: string) => {
    if (!isGM) return;
    onAction({ type: 'remove_initiative', target_id: id });
  };

  const handleJoin = () => {
    onAction({ type: 'join' }); // App.tsx will handle the actual roll and join_initiative message
  };

  const handleClear = () => {
    if (!isGM || !window.confirm("Clear all initiative?")) return;
    onAction({ type: 'clear_initiative' });
  };

  if (combatants.length === 0 && !isGM) return null;

  return (
    <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl overflow-x-auto max-w-[80vw] custom-scrollbar">
        {sortedCombatants.map((c, idx) => {
          const isCurrent = combatants[currentTurnIndex]?.id === c.id;
          return (
            <div 
              key={c.id} 
              className={`relative group flex flex-col items-center min-w-[80px] p-2 rounded-xl transition-all ${isCurrent ? 'bg-indigo-600 shadow-lg shadow-indigo-900/40 scale-110 z-10' : 'bg-gray-800/50 opacity-60 hover:opacity-100'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black border-2 mb-1 ${c.isPlayer ? 'border-blue-400 bg-blue-900/30' : 'border-red-400 bg-red-900/30'}`}>
                {c.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-[8px] font-black uppercase tracking-tighter truncate w-full text-center">{c.name}</span>
              <div className="absolute -top-1 -right-1 bg-gray-950 text-white text-[7px] font-bold px-1 rounded-md border border-white/10">{c.initiative}</div>
              {isGM && (
                <button 
                  onClick={() => handleRemove(c.id)}
                  className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
          );
        })}
        
        <div className="flex items-center gap-1 ml-2">
            {!isGM && !isPlayerInInitiative && (
                <button 
                    onClick={handleJoin}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all whitespace-nowrap"
                >
                    Roll Initiative
                </button>
            )}
            
            {isGM && (
                <>
                    <button 
                        onClick={handleNextTurn}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-all"
                        title="Next Turn"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                    </button>
                    <button 
                        onClick={handleClear}
                        className="bg-red-900/40 hover:bg-red-600 text-red-200 p-3 rounded-xl shadow-lg active:scale-95 transition-all border border-red-500/20"
                        title="Clear All"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default InitiativeTracker;

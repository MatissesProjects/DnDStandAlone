import React from 'react';
import { HistoryItem, UserPresence } from '../../types/vtt';

interface ChronicleSidebarProps {
  isConnected: boolean;
  onLogout: () => void;
  onLeave: () => void;
  rollRequirement: { die: string, label: string } | null;
  isGM: boolean;
  onRoll: (die: string, label?: string) => void;
  history: HistoryItem[];
  isSubtleMode: boolean;
  setIsSubtleMode: (val: boolean) => void;
}

const ChronicleSidebar: React.FC<ChronicleSidebarProps> = ({
  isConnected,
  onLogout,
  onLeave,
  rollRequirement,
  isGM,
  onRoll,
  history,
  isSubtleMode,
  setIsSubtleMode
}) => {
  return (
    <aside className="w-[340px] h-full flex-none border-r border-gray-800 p-5 flex flex-col bg-gray-950 z-20 overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center border-b border-gray-800 pb-4 shrink-0">
        <div>
          <h2 className="text-xl font-black tracking-tighter text-gray-100 uppercase italic">Chronicle</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.1em]">{isConnected ? 'Active' : 'Offline'}</span>
          </div>
        </div>
        <button onClick={onLeave} className="text-[10px] bg-gray-900 hover:bg-red-900/30 border border-gray-800 px-2 py-1 rounded transition-all uppercase font-bold tracking-tighter active:scale-95">Leave</button>
      </div>

      {!isGM && rollRequirement && (
        <div className="mt-4 p-4 bg-indigo-900/20 border border-indigo-500/40 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2.5 text-center">Injunction</p>
          <button onClick={() => onRoll(rollRequirement.die, rollRequirement.label)} className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider transition-all border border-indigo-400/20 active:scale-95">
            Roll {rollRequirement.die} <span className="opacity-60 ml-1">[{rollRequirement.label}]</span>
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 py-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {history.length === 0 ? (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-900/50 rounded-3xl text-center p-6 opacity-50">
              <p className="text-[10px] text-gray-700 font-black uppercase tracking-[0.2em]">History is yet unwritten</p>
            </div>
          ) : (
            history.map(item => (
              <div key={item.id} className={`p-4 rounded-2xl border transition-all ${item.type === 'story' ? 'bg-gray-900/60 border-indigo-900/30' : (item.isSubtle ? 'bg-purple-950/20 border-purple-900/50' : 'bg-gray-900/40 border-gray-800')} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${item.type === 'story' ? 'text-indigo-400' : (item.isSubtle ? 'text-purple-400' : 'text-blue-500')}`}>
                    {item.type.toUpperCase()} {item.isSubtle && '• Subtle'}
                  </span>
                  <span className="text-[8px] font-mono text-gray-600 font-bold">{item.timestamp}</span>
                </div>
                <p className={`text-white leading-relaxed ${item.type === 'roll' ? 'text-2xl font-black' : 'text-xs italic'}`}>{item.content}</p>
                <div className="text-[8px] text-gray-500 mt-2.5 font-black uppercase tracking-tighter truncate opacity-80">{item.user}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-4 border-t border-gray-800/50 shrink-0">
        <div className="flex justify-between items-center text-gray-100">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Action</h3>
          {isGM && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-[10px] font-bold text-gray-400 group-hover:text-gray-200 uppercase tracking-wider transition-colors">Subtle</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={isSubtleMode} onChange={(e) => setIsSubtleMode(e.target.checked)}/>
                <div className="w-9 h-5 bg-gray-800 rounded-full border border-gray-700 peer peer-checked:bg-purple-600 peer-checked:border-purple-400 after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 shadow-inner"></div>
              </div>
            </label>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(die => (
            <button key={die} onClick={() => onRoll(die)} className="bg-gray-900/50 hover:bg-gray-800 active:bg-gray-700 text-[10px] font-black py-2 rounded-lg border border-gray-800 hover:border-gray-600 transition-all shadow-sm active:scale-95 text-gray-200">{die}</button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default ChronicleSidebar;

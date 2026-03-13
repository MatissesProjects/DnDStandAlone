import React, { useState } from 'react';
import type { HistoryItem, UserPresence } from '../../types/vtt';

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
  onConsumeHistory: (id: string) => void;
  onDraftResponse?: (content: string) => void;
  onVfx?: (type: 'cheer' | 'boo') => void;
  activeUsers: UserPresence[];
  onWhisper: (targetId: string, msg: string) => void;
  currentScene?: string;
}

const ChronicleSidebar: React.FC<ChronicleSidebarProps> = ({
  isConnected,
  onLeave,
  rollRequirement,
  isGM,
  onRoll,
  history,
  isSubtleMode,
  setIsSubtleMode,
  onConsumeHistory,
  onDraftResponse,
  onVfx,
  activeUsers,
  onWhisper,
  currentScene = "main"
}) => {
  const [whisperTarget, setWhisperTarget] = useState<string>('');
  const [whisperMsg, setWhisperMsg] = useState<string>('');

  const handleSendWhisper = (e: React.FormEvent) => {
    e.preventDefault();
    if (whisperTarget && whisperMsg) {
      onWhisper(whisperTarget, whisperMsg);
      setWhisperMsg('');
    }
  };

  return (
    <aside className="w-[300px] max-w-[85vw] h-full flex-none border-r border-gray-800 p-4 flex flex-col bg-gray-950 absolute md:relative z-50 overflow-hidden shadow-2xl transition-all">
      <div className="flex justify-between items-center border-b border-gray-800 pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-tighter text-gray-100 uppercase italic">Chronicle</h2>
            <span className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded text-[7px] font-black text-indigo-400 uppercase tracking-widest">{currentScene}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`h-2 w-2 rounded-full transition-all duration-500 ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{isConnected ? 'Active' : 'Offline'}</span>
          </div>
        </div>
        <button onClick={onLeave} className="text-[9px] bg-gray-900 hover:bg-red-900/30 border border-gray-800 px-2 py-1 rounded-lg transition-all uppercase font-black tracking-tighter active:scale-95">Leave</button>
      </div>

      {!isGM && rollRequirement && (
        <div className="mt-3 p-3 bg-indigo-900/20 border border-indigo-500/40 rounded-xl animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2 text-center">Injunction</p>
          <button onClick={() => onRoll(rollRequirement.die, rollRequirement.label)} className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black py-2 rounded-lg uppercase text-[10px] tracking-wider transition-all border border-indigo-400/20 active:scale-95">
            Roll {rollRequirement.die} <span className="opacity-60 ml-1">[{rollRequirement.label}]</span>
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 py-3 overflow-hidden">
        {/* Audience Interaction Buttons */}
        <div className="flex gap-2 mb-3 shrink-0 px-1">
          <button 
            onClick={() => onVfx?.('cheer')}
            className="flex-1 bg-green-900/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 font-black py-2 rounded-xl text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span className="text-xs">👏</span> Cheer
          </button>
          <button 
            onClick={() => onVfx?.('boo')}
            className="flex-1 bg-red-900/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-black py-2 rounded-xl text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span className="text-xs">👎</span> Boo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {history.length === 0 ? (
            <div className="h-full flex items-center justify-center border border-dashed border-gray-900 rounded-2xl text-center p-4 opacity-30">
              <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest">Awaiting Fate</p>
            </div>
          ) : (
            history.map(item => {
              const isWhisper = item.content.includes('Whisper');
              return (
                <div key={item.id} className={`p-2.5 rounded-xl border transition-all relative group ${item.type === 'story' ? 'bg-gray-900/60 border-indigo-900/20' : (item.isSubtle ? 'bg-purple-950/20 border-purple-500/40 shadow-[inset_0_0_15px_rgba(168,85,247,0.05)]' : 'bg-gray-900/30 border-gray-800/50')} animate-in fade-in slide-in-from-bottom-1 duration-200`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] font-black uppercase tracking-widest ${item.type === 'story' ? 'text-indigo-500' : (item.isSubtle ? 'text-purple-400' : 'text-blue-600')}`}>
                        {item.isSubtle ? (isWhisper ? 'WHISPER' : 'HIDDEN ROLL') : item.type.toUpperCase()}
                      </span>
                      {item.isSubtle && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-mono text-gray-700 font-bold">{item.timestamp}</span>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isGM && isWhisper && onDraftResponse && (
                            <button 
                                onClick={() => onDraftResponse(item.content)}
                                className="p-0.5 hover:bg-white/5 rounded text-indigo-400 hover:text-indigo-300"
                                title="AI Draft Response"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </button>
                        )}
                        <button 
                            onClick={() => onConsumeHistory(item.id)}
                            className="p-0.5 hover:bg-white/5 rounded text-gray-600 hover:text-green-500"
                            title="Consume"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className={`text-gray-200 leading-snug ${item.type === 'roll' ? 'text-sm font-black' : 'text-[11px] italic leading-relaxed'}`}>
                    {item.content}
                  </p>
                  <div className="text-[7px] text-gray-600 mt-1 font-black uppercase tracking-tighter truncate opacity-60 italic">{item.user}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-gray-800/50 space-y-4 shrink-0">
        {/* Whisper Section */}
        <section className="space-y-2">
          <h3 className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Whisper Network</h3>
          <form onSubmit={handleSendWhisper} className="space-y-1.5">
            <select 
              value={whisperTarget} 
              onChange={e => setWhisperTarget(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-[10px] text-gray-400 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">Select Target...</option>
              {activeUsers.map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.role.toUpperCase()})</option>
              ))}
            </select>
            <div className="flex gap-1">
              <input 
                type="text" 
                placeholder="Type a secret..." 
                value={whisperMsg}
                onChange={e => setWhisperMsg(e.target.value)}
                className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-[10px] focus:outline-none focus:border-indigo-500/50"
              />
              <button 
                type="submit" 
                disabled={!whisperTarget || !whisperMsg}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:grayscale px-3 py-1.5 rounded-lg transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </form>
        </section>

        {/* Dice Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-gray-100">
            <h3 className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Fate</h3>
            <div className="flex p-0.5 bg-gray-900 rounded-lg border border-gray-800">
              <button 
                onClick={() => setIsSubtleMode(false)}
                className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${!isSubtleMode ? 'bg-gray-800 text-blue-400 shadow-sm' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Public
              </button>
              <button 
                onClick={() => setIsSubtleMode(true)}
                className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${isSubtleMode ? 'bg-purple-900/40 text-purple-400 shadow-sm border border-purple-500/20' : 'text-gray-600 hover:text-gray-400'}`}
              >
                {isGM ? 'Hidden' : 'Secret'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(die => (
              <button key={die} onClick={() => onRoll(die)} className={`bg-gray-950 hover:bg-gray-800 active:bg-gray-700 text-[9px] font-black py-1.5 rounded-lg border transition-all shadow-sm active:scale-95 ${isSubtleMode ? 'border-purple-900/50 hover:border-purple-500/50 text-purple-300/70' : 'border-gray-800 hover:border-gray-600 text-gray-400'}`}>
                {die}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChronicleSidebar;

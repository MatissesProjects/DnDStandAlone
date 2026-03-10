import React, { useState } from 'react';
import type { UserPresence, MoveProposal, EnemyData, Location, Entity } from '../../types/vtt';

interface GMToolboxProps {
  isGM: boolean;
  user: any;
  isAuthenticated: boolean;
  pendingProposals: MoveProposal[];
  onApproveProposal: (prop: MoveProposal) => void;
  onRejectProposal: (prop: MoveProposal) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  activeUsers: UserPresence[];
  onRequestRoll: (targetId: string, die: string, label: string) => void;
  onGenerateEnemy: () => void;
  onGenerateLore: () => void;
  isGenerating: boolean;
  generatedEnemy: EnemyData | null;
  generatedLore: string | null;
  onManifestEntity: () => void;
  onManifestLore?: (content: string) => void;
  onDismissEnemy: () => void;
  onDismissLore: () => void;
  onUpdateGeneratedEnemy?: (enemy: EnemyData) => void;
  onUpdateGeneratedLore?: (lore: string) => void;
  activeEntities: Entity[];
  onSelectEntity: (ent: Entity) => void;
  activeLocation: Location | null;
  activeCampaign: { id: number, roomId: string };
  onOpenDashboard: () => void;
  playerClass: string;
  playerLevel: number;
  isEditingProfile: boolean;
  setIsEditingProfile: (val: boolean) => void;
  setPlayerClass: (val: string) => void;
  setPlayerLevel: (val: number) => void;
  onUpdateProfile: () => void;
  onSummarize: () => void;
  isSummarizing: boolean;
  onClearHistory: () => void;
}

const SHAPES = {
  TOKEN_NPC: {
    type: "excalidraw/clipboard",
    elements: [
      {
        id: "npc_bg",
        type: "ellipse",
        width: 100,
        height: 100,
        strokeColor: "#e03131",
        backgroundColor: "#ffc9c9",
        fillStyle: "hachure",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        roundness: { type: 2 },
        groupIds: ["npc_token_group"],
        index: "a1"
      },
      {
        id: "npc_txt",
        type: "text",
        text: "NPC",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        width: 40,
        height: 25,
        strokeColor: "#e03131",
        x: 30,
        y: 37,
        groupIds: ["npc_token_group"],
        index: "a2"
      }
    ],
    appState: { viewBackgroundColor: "#ffffff" }
  },
  TOKEN_PC: {
    type: "excalidraw/clipboard",
    elements: [
      {
        id: "pc_bg",
        type: "ellipse",
        width: 100,
        height: 100,
        strokeColor: "#1971c2",
        backgroundColor: "#a5d8ff",
        fillStyle: "hachure",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        roundness: { type: 2 },
        groupIds: ["pc_token_group"],
        index: "b1"
      },
      {
        id: "pc_txt",
        type: "text",
        text: "PC",
        fontSize: 20,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        width: 40,
        height: 25,
        strokeColor: "#1971c2",
        x: 30,
        y: 37,
        groupIds: ["pc_token_group"],
        index: "b2"
      }
    ],
    appState: { viewBackgroundColor: "#ffffff" }
  },
  AOE_ZONE: {
    type: "excalidraw/clipboard",
    elements: [
      {
        id: "aoe_rect",
        type: "rectangle",
        width: 200,
        height: 200,
        strokeColor: "#f08c00",
        backgroundColor: "#fff3bf",
        fillStyle: "cross-hatch",
        strokeWidth: 1,
        strokeStyle: "dashed",
        roughness: 2,
        opacity: 50,
        index: "c1"
      }
    ]
  },
  FOG: {
    type: "excalidraw/clipboard",
    elements: [
      {
        id: "fog_rect",
        type: "rectangle",
        width: 300,
        height: 200,
        strokeColor: "#000000",
        backgroundColor: "#000000",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        index: "d1"
      }
    ]
  }
};

const GMToolbox: React.FC<GMToolboxProps> = ({
  isGM, user, isAuthenticated, pendingProposals, onApproveProposal, onRejectProposal,
  isRecording, onToggleRecording, activeUsers, onRequestRoll, onGenerateEnemy, onGenerateLore,
  isGenerating, generatedEnemy, generatedLore, onManifestEntity, onManifestLore, 
  onDismissEnemy, onDismissLore, onUpdateGeneratedEnemy, onUpdateGeneratedLore,
  activeEntities, onSelectEntity, 
  activeLocation, activeCampaign, onOpenDashboard, playerClass, playerLevel, isEditingProfile,
  setIsEditingProfile, setPlayerClass, setPlayerLevel, onUpdateProfile, onSummarize, isSummarizing,
  onClearHistory
}) => {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const copyShape = (key: keyof typeof SHAPES) => {
    const json = JSON.stringify(SHAPES[key]);
    navigator.clipboard.writeText(json).then(() => {
      setCopyStatus(key);
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(activeCampaign.room_id).then(() => {
      setCopyStatus('room_code');
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  return (
    <aside className="w-[320px] h-full flex-none border-l border-gray-800 p-5 flex flex-col bg-gray-950 z-20 overflow-hidden shadow-2xl">
      <h2 className="text-xl font-black border-b border-gray-800 pb-4 shrink-0 tracking-tighter text-gray-100 uppercase italic">
        {isGM ? 'Grand Master' : 'Adventurer'}
      </h2>
      
      <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
        {isGM && pendingProposals.length > 0 && (
          <div className="space-y-4 pt-4">
            <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Pending Manuevers</h3>
            <div className="space-y-3">
              {pendingProposals.map(prop => (
                <div key={prop.elementId} className="bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/30 animate-in slide-in-from-right duration-300">
                  <p className="text-[10px] font-black text-gray-300 uppercase mb-3"><span className="text-indigo-400">{prop.username}</span> suggests move</p>
                  <div className="flex gap-2">
                    <button onClick={() => onApproveProposal(prop)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[9px] font-black py-2 rounded-lg uppercase tracking-tighter">Approve</button>
                    <button onClick={() => onRejectProposal(prop)} className="flex-1 bg-gray-800 hover:bg-red-900/40 text-[9px] font-black py-2 rounded-lg uppercase tracking-tighter border border-gray-700">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isGM ? (
          <>
            <div className="space-y-4 pt-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">World Tools</h3>
              <div className="grid gap-2">
                <button onClick={onOpenDashboard} className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95"> Manage Manifest </button>
                <button 
                  onClick={onSummarize} 
                  disabled={isSummarizing}
                  className="w-full bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-500/20 text-indigo-300 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
                > 
                  {isSummarizing ? 'Recounting...' : "Chronicler's Summary"} 
                </button>
                <button 
                  onClick={onClearHistory}
                  className="w-full bg-red-900/10 hover:bg-red-900/30 border border-red-900/20 text-red-400 font-black py-2 rounded-lg uppercase text-[8px] tracking-[0.2em] transition-all"
                >
                  Wipe Chronicle
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Quick Forge (Copy & Paste)</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => copyShape('TOKEN_NPC')} 
                  className={`py-2 rounded-lg border font-black uppercase text-[8px] tracking-widest transition-all ${copyStatus === 'TOKEN_NPC' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-red-500/50 hover:text-red-400'}`}
                >
                  {copyStatus === 'TOKEN_NPC' ? 'Copied!' : 'NPC Token'}
                </button>
                <button 
                  onClick={() => copyShape('TOKEN_PC')} 
                  className={`py-2 rounded-lg border font-black uppercase text-[8px] tracking-widest transition-all ${copyStatus === 'TOKEN_PC' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-blue-500/50 hover:text-blue-400'}`}
                >
                  {copyStatus === 'TOKEN_PC' ? 'Copied!' : 'Player Token'}
                </button>
                <button 
                  onClick={() => copyShape('AOE_ZONE')} 
                  className={`py-2 rounded-lg border font-black uppercase text-[8px] tracking-widest transition-all ${copyStatus === 'AOE_ZONE' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-yellow-500/50 hover:text-yellow-400'}`}
                >
                  {copyStatus === 'AOE_ZONE' ? 'Copied!' : 'AoE Zone'}
                </button>
                <button 
                  onClick={() => copyShape('FOG')} 
                  className={`py-2 rounded-lg border font-black uppercase text-[8px] tracking-widest transition-all ${copyStatus === 'FOG' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                >
                  {copyStatus === 'FOG' ? 'Copied!' : 'Fog Layer'}
                </button>
              </div>
              <p className="text-[7px] text-gray-600 italic text-center uppercase tracking-tighter">Click to copy, then Ctrl+V in Map</p>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Narration</h3>
              <button onClick={onToggleRecording} className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border ${isRecording ? 'bg-red-600 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-pulse' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}>
                <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-600'}`}></div>
                {isRecording ? 'Narration Active' : 'Start Chronicle'}
              </button>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Adventurers</h3>
              <div className="space-y-3">
                {activeUsers.filter(u => u.role !== 'gm').map(u => (
                  <div key={u.id} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-black text-gray-100 uppercase tracking-tighter">{u.username}</p>
                        <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">{u.class_name || 'Class Unknown'} • Lvl {u.level || 1}</p>
                      </div>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onRequestRoll(u.id, 'd20', 'Perception')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase transition-all"> Perception </button>
                      <button onClick={() => onRequestRoll(u.id, 'd20', 'Stealth')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase transition-all"> Stealth </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">AI Weaver</h3>
              <div className="grid gap-3">
                <button onClick={onGenerateEnemy} disabled={isGenerating} className="w-full bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-blue-500/20 text-xs uppercase tracking-widest shadow-blue-900/20"> Manifest Enemy </button>
                <button onClick={onGenerateLore} disabled={isGenerating} className="w-full bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-indigo-500/20 text-xs uppercase tracking-widest shadow-indigo-900/20"> Script Lore </button>
              </div>
              
              {(generatedEnemy || generatedLore) && (
                <div className="mt-4 p-5 bg-gray-900 rounded-[1.5rem] border border-indigo-500/30 shadow-2xl animate-in zoom-in-95 duration-300 relative group/weave">
                  <button 
                    onClick={() => { onDismissEnemy(); onDismissLore(); }}
                    className="absolute -top-2 -right-2 bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-500 rounded-full p-1.5 border border-gray-700 transition-all opacity-0 group-hover/weave:opacity-100 z-10"
                    title="Dismiss weave"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>

                  {generatedLore && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Whispered Lore</h4>
                        <button 
                          onClick={() => onManifestLore?.(generatedLore)}
                          className="text-[8px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-full border border-indigo-400/30 font-black uppercase tracking-widest transition-all"
                        >
                          Manifest
                        </button>
                      </div>
                      <textarea 
                        value={generatedLore}
                        onChange={(e) => onUpdateGeneratedLore?.(e.target.value)}
                        className="w-full bg-gray-950 border border-indigo-500/20 rounded-xl p-3 text-xs text-gray-200 leading-relaxed italic focus:outline-none focus:border-indigo-500/50 resize-none h-32"
                      />
                    </div>
                  )}
                  {generatedEnemy && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Entity Manifest</h4>
                        <button onClick={onManifestEntity} className="text-[8px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded-full border border-blue-400/30 font-black uppercase tracking-widest transition-all">Materialize</button>
                      </div>
                      <div className="space-y-3">
                        <input 
                          type="text"
                          value={generatedEnemy.name}
                          onChange={(e) => onUpdateGeneratedEnemy?.({ ...generatedEnemy, name: e.target.value })}
                          className="w-full bg-gray-950 border border-blue-500/20 rounded-lg px-3 py-2 text-sm font-black text-gray-100 uppercase tracking-tight focus:outline-none focus:border-blue-500/50"
                        />
                        <textarea 
                          value={generatedEnemy.backstory}
                          onChange={(e) => onUpdateGeneratedEnemy?.({ ...generatedEnemy, backstory: e.target.value })}
                          className="w-full bg-gray-950 border border-blue-500/20 rounded-lg px-3 py-2 text-[10px] text-gray-400 leading-relaxed italic focus:outline-none focus:border-blue-500/50 resize-none h-20"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {Object.entries(generatedEnemy.stats || {}).filter(([k]) => k.length === 3).map(([key, val]) => (
                          <div key={key} className="bg-gray-950 p-2 rounded-xl border border-gray-800 text-center shadow-inner relative group/stat">
                            <p className="text-[8px] font-black text-gray-600 uppercase tracking-tighter mb-0.5">{key}</p>
                            <input 
                              type="number"
                              value={val as number}
                              onChange={(e) => onUpdateGeneratedEnemy?.({ 
                                ...generatedEnemy, 
                                stats: { ...generatedEnemy.stats, [key]: parseInt(e.target.value) || 0 } 
                              })}
                              className="w-full bg-transparent text-center text-xs font-black text-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="pt-4 space-y-6">
            <div className="bg-gray-900/40 p-8 rounded-3xl border border-gray-800 text-center shadow-inner">
              <div className="w-20 h-20 bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-5 border border-indigo-500/30 shadow-2xl relative group">
                <span className="text-2xl font-black text-indigo-300 relative z-10">{user ? user.username.substring(0, 2).toUpperCase() : '??'}</span>
              </div>
              
              {isEditingProfile ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <input type="text" placeholder="Class" value={playerClass} onChange={e => setPlayerClass(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500/50" />
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Level</span>
                    <input type="number" min="1" max="20" value={playerLevel} onChange={e => setPlayerLevel(Number(e.target.value))} className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500/50" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={onUpdateProfile} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Save</button>
                    <button onClick={() => setIsEditingProfile(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-gray-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setIsEditingProfile(true)} className="cursor-pointer group">
                  <h3 className="font-black text-gray-100 uppercase tracking-tighter mb-1 text-xl group-hover:text-indigo-400 transition-colors">{user?.username}</h3>
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-8">{playerClass || 'Class Unknown'} • Level {playerLevel}</p>
                </div>
              )}
              
              <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent w-full my-8 shadow-inner"></div>
              <p className="text-[10px] text-gray-500 font-bold leading-relaxed italic px-4 uppercase tracking-widest opacity-60">Suggestions are sent to the Master for arbitration.</p>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Active NPCs</h3>
          <div className="space-y-2">
            {activeEntities.map(ent => (
              <div key={ent.id} onClick={() => onSelectEntity(ent)} className="bg-gray-900/40 p-3 rounded-xl border border-gray-800 flex items-center gap-3 cursor-pointer hover:bg-indigo-900/10 hover:border-indigo-500/30 transition-all group">
                <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-[10px] font-black group-hover:bg-indigo-600 transition-colors">{ent.name.substring(0, 2).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-black truncate text-gray-100 uppercase">{ent.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-red-500">{ent.stats?.hp || 0} HP</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(ent.stats?.conditions || []).map((c: string) => (
                      <span key={c} className="text-[7px] bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/20 font-black uppercase tracking-tighter">{c}</span>
                    ))}
                    {(!ent.stats?.conditions || ent.stats.conditions.length === 0) && (
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter truncate italic">Manifested NPC</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-800/50">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">World Manifest</h3>
          <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-2xl space-y-6">
            <div>
              <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Room Code</p>
              <div className="flex items-center justify-between bg-gray-950 p-3 rounded-xl border border-gray-800 group/code relative">
                <p className="text-sm font-black tracking-tight text-indigo-400 font-mono">{activeCampaign.room_id}</p>
                <button 
                  onClick={copyRoomCode}
                  className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-all ${copyStatus === 'room_code' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                  {copyStatus === 'room_code' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Current Locale</p>
              <p className="text-sm font-black tracking-tight text-gray-100 uppercase truncate">{activeLocation?.name || 'Unknown Wilds'}</p>
              {activeLocation && <p className="text-[10px] text-gray-500 italic mt-1 leading-relaxed opacity-80 truncate">"{activeLocation.description}"</p>}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default GMToolbox;

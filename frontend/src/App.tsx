import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginCallback from "./components/LoginCallback";
import SetupScreen from "./components/SetupScreen";

interface DiceRoll {
  id: string;
  die: string;
  result: number;
  timestamp: string;
  isSubtle: boolean;
  user: string;
}

interface UserPresence {
  id: string;
  username: string;
  role: string;
}

interface EnemyStats {
  hp?: number;
  ac?: number;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  actions?: string[];
}

interface EnemyData {
  name: string;
  stats: EnemyStats;
  backstory: string;
}

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token } = useAuth();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  // Room State
  const [activeCampaign, setActiveCampaign] = useState<{id: number, roomId: string} | null>(null);
  const [activeLocationId] = useState(1);
  
  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    activeCampaign ? `ws://localhost:8000/ws/${activeCampaign.roomId}/${clientId}?role=${isGM ? 'gm' : 'player'}&username=${user?.username || 'Guest'}` : ''
  );
  
  const [recentRolls, setRecentRolls] = useState<DiceRoll[]>([]);
  const [isSubtleMode, setIsSubtleMode] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEnemy, setGeneratedEnemy] = useState<EnemyData | null>(null);
  const [generatedLore, setGeneratedLore] = useState<string | null>(null);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        if (data.type === "presence") {
          setActiveUsers(data.users);
        } else if (data.type === "request_roll") {
          setRollRequirement({ die: data.die, label: data.label });
        } else if (data.result && data.die) {
          setRecentRolls(prev => [data, ...prev].slice(0, 50));
        }
      } catch (e) {}
    }
  }, [lastMessage]);

  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [rollRequirement, setRollRequirement] = useState<{die: string, label: string} | null>(null);

  const handleLogin = () => {
    fetch('http://localhost:8000/auth/login')
      .then(res => res.json())
      .then(data => {
        window.location.href = data.url;
      });
  };

  const rollDie = (die: string, label?: string) => {
    const sides = parseInt(die.substring(1));
    const result = Math.floor(Math.random() * sides) + 1;
    const newRoll: DiceRoll = {
      id: Math.random().toString(36).substring(7),
      die: label ? `${die} (${label})` : die,
      result,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isSubtle: isSubtleMode,
      user: user ? user.username : `Player ${clientId.substring(0, 4)}`
    };
    sendMessage(JSON.stringify(newRoll));
    if (rollRequirement) setRollRequirement(null);
  };

  const requestPlayerRoll = (targetId: string, die: string, label: string) => {
    sendMessage(JSON.stringify({ type: "request_roll", target_id: targetId, die, label }));
  };

  const handleGenerateEnemy = async () => {
    if (!token || !activeCampaign) return;
    setIsGenerating(true);
    setGeneratedLore(null);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-enemy?location_id=${activeLocationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!data.stats) data.stats = {};
      setGeneratedEnemy(data);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleGenerateLore = async () => {
    if (!token || !activeCampaign) return;
    setIsGenerating(true);
    setGeneratedEnemy(null);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-lore?location_id=${activeLocationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setGeneratedLore(data.lore);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  // 1. If not authenticated, show login UI
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-black italic tracking-tighter text-gray-100">DND STANDALONE</h1>
          <button 
            onClick={handleLogin}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest transition-all shadow-2xl shadow-indigo-900/40"
          >
            Authenticate with Discord
          </button>
        </div>
      </div>
    );
  }

  // 2. If authenticated but no room joined, show setup
  if (!activeCampaign) {
    return <SetupScreen onJoin={(id, roomId) => setActiveCampaign({id, roomId})} />;
  }

  // 3. Main App
  return (
    <div className="flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none">
      {/* Left Sidebar: Dice & Presence */}
      <aside className="w-[300px] h-full flex-none border-r border-gray-800 p-5 flex flex-col bg-gray-950 z-20 overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-black tracking-tighter text-gray-100 uppercase italic">DND Master</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.1em]">{isConnected ? 'Link Active' : 'Link Severed'}</span>
            </div>
          </div>
          <button onClick={() => {logout(); setActiveCampaign(null);}} className="text-[10px] bg-gray-900 hover:bg-red-900/30 border border-gray-800 px-2 py-1 rounded transition-all uppercase font-bold tracking-tighter active:scale-95">Logout</button>
        </div>

        {/* Dynamic Roll Requirement for Players */}
        {!isGM && rollRequirement && (
          <div className="mt-4 p-4 bg-indigo-900/20 border border-indigo-500/40 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2.5 text-center">Injunction from the Master</p>
            <button 
              onClick={() => rollDie(rollRequirement.die, rollRequirement.label)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black py-3.5 rounded-xl shadow-lg uppercase text-xs tracking-wider transition-all border border-indigo-400/20 active:scale-95"
            >
              Roll {rollRequirement.die} <span className="opacity-60 ml-1">[{rollRequirement.label}]</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4 py-6 shrink-0">
          <div className="flex justify-between items-center text-gray-100">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Dice Roller</h3>
            {isGM && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-[10px] font-bold text-gray-400 group-hover:text-gray-200 uppercase tracking-wider transition-colors">Subtle</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={isSubtleMode} onChange={() => setIsSubtleMode(!isSubtleMode)}/>
                  <div className="w-9 h-5 bg-gray-800 rounded-full border border-gray-700 peer peer-checked:bg-purple-600 peer-checked:border-purple-400 after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 shadow-inner"></div>
                </div>
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map(die => (
              <button
                key={die}
                onClick={() => rollDie(die)}
                className="bg-gray-900/50 hover:bg-gray-800 active:bg-gray-700 text-sm font-bold py-3.5 px-3 rounded-xl border border-gray-800 hover:border-gray-600 transition-all shadow-sm active:scale-95 text-gray-200"
              >
                {die}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 pt-4 border-t border-gray-800/50">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4 shrink-0">Chronicle</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {recentRolls.length === 0 ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-900/50 rounded-3xl text-center p-6">
                <p className="text-[10px] text-gray-700 font-black uppercase tracking-[0.2em] leading-relaxed">The history is yet unwritten</p>
              </div>
            ) : (
              recentRolls.map(roll => (
                <div key={roll.id} className={`p-4 rounded-2xl border transition-all ${roll.isSubtle ? 'bg-purple-950/20 border-purple-900/50' : 'bg-gray-900/40 border-gray-800'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${roll.isSubtle ? 'text-purple-400' : 'text-blue-500'}`}>
                      {roll.die} {roll.isSubtle && '• Subtle'}
                    </span>
                    <span className="text-[9px] font-mono text-gray-600 font-bold">{roll.timestamp}</span>
                  </div>
                  <div className="text-3xl font-black text-white leading-none tracking-tighter drop-shadow-sm">{roll.result}</div>
                  <div className="text-[9px] text-gray-500 mt-2.5 font-black uppercase tracking-tighter truncate opacity-80">{roll.user}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Area: Excalidraw */}
      <main className="flex-1 h-full min-w-0 bg-[#121212] z-10 overflow-hidden relative">
          <Excalidraw 
            theme="dark" 
            UIOptions={{
              canvasActions: { toggleTheme: false, export: false, loadScene: false, saveToActiveFile: false }
            }}
          />
      </main>

      {/* Right Sidebar: GM Toolbox or Player Info */}
      <aside className="w-[320px] h-full flex-none border-l border-gray-800 p-5 flex flex-col bg-gray-950 z-20 overflow-hidden shadow-2xl">
        <h2 className="text-xl font-black border-b border-gray-800 pb-4 shrink-0 tracking-tighter text-gray-100 uppercase italic">
          {isGM ? 'Grand Master' : 'Adventurer'}
        </h2>
        
        <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
          {isGM ? (
            <>
              {/* Active Adventurers List for GM */}
              <div className="space-y-4 pt-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Active Adventurers</h3>
                <div className="space-y-3">
                  {activeUsers.filter(u => u.role !== 'gm').map(u => (
                    <div key={u.id} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 group transition-all hover:border-indigo-500/30 shadow-inner">
                      <div className="flex items-center justify-between mb-3.5">
                        <p className="text-sm font-black text-gray-100 uppercase tracking-tighter">{u.username}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Active</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => requestPlayerRoll(u.id, 'd20', 'Perception')}
                          className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-2 rounded-lg font-black uppercase transition-all tracking-tighter border border-gray-700 active:scale-95"
                        > Perception </button>
                        <button 
                          onClick={() => requestPlayerRoll(u.id, 'd20', 'Stealth')}
                          className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-2 rounded-lg font-black uppercase transition-all tracking-tighter border border-gray-700 active:scale-95"
                        > Stealth </button>
                      </div>
                    </div>
                  ))}
                  {activeUsers.filter(u => u.role !== 'gm').length === 0 && (
                    <p className="text-[10px] text-gray-600 font-bold italic text-center py-6 bg-gray-900/20 rounded-2xl border-2 border-dashed border-gray-900">No other players in room</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">AI Weaver</h3>
                <div className="grid gap-3">
                  <button onClick={handleGenerateEnemy} disabled={isGenerating} className="w-full bg-blue-700 hover:bg-blue-600 active:bg-blue-800 active:scale-[0.98] disabled:opacity-50 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-blue-500/20 text-xs uppercase tracking-widest shadow-blue-900/20">
                    {isGenerating ? 'Weaving...' : 'Manifest Enemy'}
                  </button>
                  <button onClick={handleGenerateLore} disabled={isGenerating} className="w-full bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 active:scale-[0.98] disabled:opacity-50 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-indigo-500/20 text-xs uppercase tracking-widest shadow-indigo-900/20">
                    {isGenerating ? 'Channeling...' : 'Script Lore'}
                  </button>
                </div>
                
                {(generatedEnemy || generatedLore) && (
                  <div className="mt-4 p-5 bg-gray-900 rounded-[1.5rem] border border-indigo-500/30 shadow-2xl animate-in zoom-in-95 duration-300">
                    {generatedLore && (
                      <div className="space-y-2.5">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Whispered Lore</h4>
                        <p className="text-xs text-gray-200 leading-relaxed italic opacity-90">"{generatedLore}"</p>
                      </div>
                    )}
                    {generatedEnemy && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Entity Manifest</h4>
                          <span className="text-[9px] bg-blue-900/40 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/30 font-black tracking-widest uppercase">HP {generatedEnemy.stats?.hp || '??'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-100 tracking-tight mb-1 uppercase">{generatedEnemy.name}</p>
                          <p className="text-[10px] text-gray-400 leading-relaxed italic border-l-2 border-gray-800 pl-3">"{generatedEnemy.backstory}"</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {Object.entries(generatedEnemy.stats || {}).filter(([k]) => k.length === 3).map(([key, val]) => (
                            <div key={key} className="bg-gray-950 p-2 rounded-xl border border-gray-800 text-center shadow-inner">
                              <p className="text-[8px] font-black text-gray-600 uppercase tracking-tighter mb-0.5">{key}</p>
                              <p className="text-xs font-black text-white">{val as number}</p>
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
                <div className="w-20 h-20 bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-5 border border-indigo-500/30 shadow-2xl relative">
                  <div className="absolute inset-0 rounded-full animate-pulse bg-indigo-500/5 blur-xl"></div>
                  <span className="text-2xl font-black text-indigo-300 drop-shadow-sm relative z-10">{user ? user.username.substring(0, 2).toUpperCase() : '??'}</span>
                </div>
                <h3 className="font-black text-gray-100 uppercase tracking-tighter mb-1.5 text-xl">
                  {isAuthenticated ? user?.username : 'Wanderer'}
                </h3>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mb-8">Party Member • LVL 5</p>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent w-full mb-8"></div>
                <p className="text-[10px] text-gray-500 font-bold leading-relaxed italic px-4 uppercase tracking-widest opacity-60">
                  Maintain your vigil.<br/>The Master will signal.
                </p>
              </div>
            </div>
          )}

          {/* Persistent World Status section */}
          <div className="space-y-4 pt-4 border-t border-gray-800/50">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">World Manifest</h3>
            <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-2xl space-y-6 text-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Room Code</p>
                  <p className="text-sm font-black tracking-tight text-indigo-400 font-mono">{activeCampaign.roomId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Threat</p>
                  <div className="flex gap-1 justify-end">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= 3 ? 'bg-red-600 shadow-[0_0_5px_rgba(220,38,38,0.4)]' : 'bg-gray-800'}`}></div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Current Locale</p>
                <p className="text-sm font-black tracking-tight text-gray-100 uppercase truncate">The Dark Forest</p>
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1 opacity-90">Whispering Grove</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<VTTApp />} />
          <Route path="/auth/callback" element={<LoginCallback />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

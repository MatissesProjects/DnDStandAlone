import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginCallback from "./components/LoginCallback";

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
  hp: number;
  ac: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  actions: string[];
}

interface EnemyData {
  name: string;
  stats: EnemyStats;
  backstory: string;
}

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token } = useAuth();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  const [activeCampaignId] = useState(1);
  const [activeLocationId] = useState(1);
  
  // Presence and Roll Requirement state
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [rollRequirement, setRollRequirement] = useState<{die: string, label: string} | null>(null);
  
  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    `ws://localhost:8000/ws/ROOM1/${clientId}?role=${isGM ? 'gm' : 'player'}&username=${user?.username || 'Guest'}`
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
        
        // Handle Presence updates
        if (data.type === "presence") {
          setActiveUsers(data.users);
        } 
        // Handle GM Roll Requests
        else if (data.type === "request_roll") {
          setRollRequirement({ die: data.die, label: data.label });
        }
        // Handle Dice Rolls
        else if (data.result && data.die) {
          setRecentRolls(prev => [data, ...prev].slice(0, 50));
        }
      } catch (e) {
        // Not JSON or other message type
      }
    }
  }, [lastMessage]);

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
    sendMessage(JSON.stringify({
      type: "request_roll",
      target_id: targetId,
      die,
      label
    }));
  };

  const handleGenerateEnemy = async () => {
    if (!token) return;
    setIsGenerating(true);
    setGeneratedLore(null);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaignId}/generate-enemy?location_id=${activeLocationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setGeneratedEnemy(data);
    } catch (e) {
      console.error("AI Generation failed", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateLore = async () => {
    if (!token) return;
    setIsGenerating(true);
    setGeneratedEnemy(null);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaignId}/generate-lore?location_id=${activeLocationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setGeneratedLore(data.lore);
    } catch (e) {
      console.error("AI Generation failed", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none">
      {/* Left Sidebar: Dice & Presence */}
      <aside className="w-[300px] h-full flex-none border-r border-gray-800 p-5 flex flex-col bg-gray-950 z-20 overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-black tracking-tighter text-gray-100 uppercase italic">DND Master</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`h-2 w-2 rounded-full transition-all duration-500 ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{isConnected ? 'Link Active' : 'Link Severed'}</span>
            </div>
          </div>
          {isAuthenticated ? (
            <button onClick={logout} className="text-[10px] bg-gray-900 hover:bg-red-900/30 border border-gray-800 px-2 py-1 rounded transition-colors uppercase font-bold">Logout</button>
          ) : (
            <button onClick={handleLogin} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded transition-colors uppercase font-bold">Login</button>
          )}
        </div>

        {/* Dynamic Roll Requirement for Players */}
        {!isGM && rollRequirement && (
          <div className="mt-4 p-4 bg-indigo-900/40 border border-indigo-500/50 rounded-2xl animate-pulse">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2 text-center">GM Requests Roll</p>
            <button 
              onClick={() => rollDie(rollRequirement.die, rollRequirement.label)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl shadow-lg uppercase text-xs tracking-tighter"
            >
              Roll {rollRequirement.die} for {rollRequirement.label}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4 py-6 shrink-0">
          <div className="flex justify-between items-center text-gray-100">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Dice Roller</h3>
            {isGM && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-[10px] font-bold text-gray-400 group-hover:text-gray-200 uppercase tracking-wider transition-colors">Subtle Mode</span>
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
                className="bg-gray-900/50 hover:bg-gray-800 active:bg-gray-700 text-sm font-bold py-3 px-3 rounded-xl border border-gray-800 hover:border-gray-600 transition-all shadow-sm active:scale-95 text-gray-200"
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
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-900/50 rounded-2xl text-center p-4">
                <p className="text-xs text-gray-800 font-bold uppercase tracking-widest leading-relaxed">The history is yet unwritten</p>
              </div>
            ) : (
              recentRolls.map(roll => (
                <div key={roll.id} className={`p-4 rounded-xl border transition-all ${roll.isSubtle ? 'bg-purple-950/20 border-purple-900/50' : 'bg-gray-900/40 border-gray-800'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${roll.isSubtle ? 'text-purple-400' : 'text-blue-500'}`}>
                      {roll.die} {roll.isSubtle && '• Subtle'}
                    </span>
                    <span className="text-[9px] font-mono text-gray-600">{roll.timestamp}</span>
                  </div>
                  <div className="text-3xl font-black text-white leading-none tracking-tighter">{roll.result}</div>
                  <div className="text-[9px] text-gray-500 mt-2 font-bold uppercase tracking-tight truncate">{roll.user}</div>
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
                    <div key={u.id} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 group transition-all hover:border-indigo-500/30">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-black text-gray-100 uppercase tracking-tighter">{u.username}</p>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => requestPlayerRoll(u.id, 'd20', 'Perception')}
                          className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase transition-all tracking-tighter"
                        >
                          Perception
                        </button>
                        <button 
                          onClick={() => requestPlayerRoll(u.id, 'd20', 'Stealth')}
                          className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase transition-all tracking-tighter"
                        >
                          Stealth
                        </button>
                      </div>
                    </div>
                  ))}
                  {activeUsers.filter(u => u.role !== 'gm').length === 0 && (
                    <p className="text-[10px] text-gray-600 font-bold italic text-center py-4">No other players in room</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">AI Weaver</h3>
                <div className="grid gap-3">
                  <button onClick={handleGenerateEnemy} disabled={isGenerating} className="w-full bg-blue-700 hover:bg-blue-600 active:bg-blue-800 active:scale-[0.98] disabled:opacity-50 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-blue-500/20 text-xs uppercase tracking-widest">
                    {isGenerating ? 'Weaving...' : 'Manifest Enemy'}
                  </button>
                  <button onClick={handleGenerateLore} disabled={isGenerating} className="w-full bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 active:scale-[0.98] disabled:opacity-50 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-indigo-500/20 text-xs uppercase tracking-widest">
                    {isGenerating ? 'Channeling...' : 'Script Lore'}
                  </button>
                </div>
                
                {(generatedEnemy || generatedLore) && (
                  <div className="mt-4 p-4 bg-gray-900 rounded-2xl border border-indigo-500/30">
                    {generatedLore && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Whispered Lore</h4>
                        <p className="text-xs text-gray-300 leading-relaxed italic">"{generatedLore}"</p>
                      </div>
                    )}
                    {generatedEnemy && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Entity Manifest</h4>
                          <span className="text-[10px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold">HP {generatedEnemy.stats.hp}</span>
                        </div>
                        <p className="text-sm font-black text-gray-100 tracking-tight">{generatedEnemy.name}</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed italic">"{generatedEnemy.backstory}"</p>
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          {Object.entries(generatedEnemy.stats).filter(([k]) => k.length === 3).map(([key, val]) => (
                            <div key={key} className="bg-gray-950 p-1.5 rounded-lg border border-gray-800 text-center">
                              <p className="text-[8px] font-black text-gray-600 uppercase tracking-tighter">{key}</p>
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
              <div className="bg-gray-900/40 p-6 rounded-2xl border border-gray-800 text-center">
                <div className="w-16 h-16 bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                  <span className="text-xl font-black text-indigo-300">{user ? user.username.substring(0, 2).toUpperCase() : '??'}</span>
                </div>
                <h3 className="font-black text-gray-100 uppercase tracking-tighter mb-1 text-lg">
                  {isAuthenticated ? user?.username : 'Wanderer'}
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-6">Party Member • LVL 5</p>
                <div className="h-px bg-gray-800 w-full mb-6 shadow-inner"></div>
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic px-2">
                  Maintain your vigil. The Game Master will signal when a roll is required.
                </p>
              </div>
            </div>
          )}

          {/* Persistent World Status section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">World Manifest</h3>
            <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 shadow-inner space-y-5 text-gray-100">
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-1.5 tracking-tighter">Current Locale</p>
                <p className="text-sm font-black tracking-tight text-gray-200">The Dark Forest</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic opacity-80 mt-0.5">Whispering Grove, Tier 2</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-2.5 tracking-tighter">Threat Intensity</p>
                <div className="flex gap-1.5 h-1.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`flex-1 rounded-full ${i <= 3 ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)]' : 'bg-gray-800'}`}></div>
                  ))}
                </div>
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

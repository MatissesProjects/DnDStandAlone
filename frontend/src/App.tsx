import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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

interface HistoryItem {
  id: string;
  type: 'roll' | 'story' | 'ai';
  content: string;
  user: string;
  timestamp: string;
  isSubtle?: boolean;
}

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token } = useAuth();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  const [activeCampaign, setActiveCampaign] = useState<{id: number, roomId: string} | null>(null);
  const [activeLocationId] = useState(1);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isRemoteUpdate = useRef(false);
  const lastSyncTime = useRef(0);

  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    activeCampaign ? `ws://localhost:8000/ws/${activeCampaign.roomId}/${clientId}?role=${isGM ? 'gm' : 'player'}&username=${user?.username || 'Guest'}` : ''
  );
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSubtleMode, setIsSubtleMode] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [rollRequirement, setRollRequirement] = useState<{die: string, label: string} | null>(null);
  
  // AI and Voice State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEnemy, setGeneratedEnemy] = useState<EnemyData | null>(null);
  const [generatedLore, setGeneratedLore] = useState<string | null>(null);
  const [isRecording, setIsIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  // Speech Recognition Setup
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          const storyItem: HistoryItem = {
            id: Math.random().toString(36).substring(7),
            type: 'story',
            content: final,
            user: user?.username || "GM",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          sendMessage(JSON.stringify(storyItem));
          // Save to backend chronicle
          if (activeCampaign && token) {
            fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ event_type: 'story', content: final, campaign_id: activeCampaign.id })
            });
          }
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, [user, sendMessage, activeCampaign, token]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsIsRecording(false);
      setInterimTranscript("");
    } else {
      recognitionRef.current?.start();
      setIsIsRecording(true);
    }
  };

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        
        if (data.type === "canvas_update" && data.senderId !== clientId) {
          if (excalidrawAPI) {
            isRemoteUpdate.current = true;
            excalidrawAPI.updateScene({
              elements: data.elements,
              appState: { ...data.appState },
              commitToHistory: false,
            });
          }
        } 
        else if (data.type === "presence") {
          setActiveUsers(data.users);
        } 
        else if (data.type === "request_roll") {
          setRollRequirement({ die: data.die, label: data.label });
        }
        else if (data.type === 'story' || (data.result && data.die)) {
          const item: HistoryItem = data.type === 'story' ? data : {
            id: data.id,
            type: 'roll',
            content: `${data.die}: ${data.result}`,
            user: data.user,
            timestamp: data.timestamp,
            isSubtle: data.isSubtle
          };
          setHistory(prev => [item, ...prev].slice(0, 100));
        }
      } catch (e) {}
    }
  }, [lastMessage, excalidrawAPI, clientId]);

  const handleCanvasChange = useCallback((elements: any, appState: any) => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastSyncTime.current > 150) {
      lastSyncTime.current = now;
      sendMessage(JSON.stringify({
        type: "canvas_update",
        senderId: clientId,
        elements,
        appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize }
      }));
    }
  }, [sendMessage, clientId]);

  const rollDie = (die: string, label?: string) => {
    const sides = parseInt(die.substring(1));
    const result = Math.floor(Math.random() * sides) + 1;
    const newRoll = {
      id: Math.random().toString(36).substring(7),
      die: label ? `${die} (${label})` : die,
      result,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans">
        <div className="text-center space-y-8 p-12 bg-gray-900 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h1 className="text-5xl font-black italic tracking-tighter text-gray-100 uppercase">DND Master</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-4 mb-10">The Digital Forge Awaits</p>
            <button onClick={() => { fetch('http://localhost:8000/auth/login').then(res => res.json()).then(data => { window.location.href = data.url; }); }} className="group relative px-10 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest transition-all shadow-2xl shadow-indigo-900/40 active:scale-95">
              <span className="relative z-10">Authenticate via Discord</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeCampaign) {
    return <SetupScreen onJoin={(id, roomId) => setActiveCampaign({id, roomId})} />;
  }

  return (
    <div className="flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none">
      {/* Left Sidebar: Chronicle & Dice */}
      <aside className="w-[340px] h-full flex-none border-r border-gray-800 p-5 flex flex-col bg-gray-950 z-20 overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-black tracking-tighter text-gray-100 uppercase italic">Chronicle</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.1em]">{isConnected ? 'Active' : 'Offline'}</span>
            </div>
          </div>
          <button onClick={() => {logout(); setActiveCampaign(null);}} className="text-[10px] bg-gray-900 hover:bg-red-900/30 border border-gray-800 px-2 py-1 rounded transition-all uppercase font-bold tracking-tighter active:scale-95">Leave</button>
        </div>

        {!isGM && rollRequirement && (
          <div className="mt-4 p-4 bg-indigo-900/20 border border-indigo-500/40 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2.5 text-center text-center">Injunction</p>
            <button onClick={() => rollDie(rollRequirement.die, rollRequirement.label)} className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider transition-all border border-indigo-400/20 active:scale-95">
              Roll {rollRequirement.die} <span className="opacity-60 ml-1">[{rollRequirement.label}]</span>
            </button>
          </div>
        )}

        {/* Interim Voice Feedback */}
        {isRecording && interimTranscript && (
          <div className="mt-4 p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl animate-pulse">
            <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Narration in progress...</p>
            <p className="text-xs text-indigo-200 italic leading-relaxed">{interimTranscript}</p>
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
                <div key={item.id} className={`p-4 rounded-2xl border transition-all ${item.type === 'story' ? 'bg-gray-900/60 border-indigo-900/30' : (item.isSubtle ? 'bg-purple-950/20 border-purple-900/50' : 'bg-gray-900/40 border-gray-800')}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${item.type === 'story' ? 'text-indigo-400' : (item.isSubtle ? 'text-purple-400' : 'text-blue-500')}`}>
                      {item.type.toUpperCase()} {item.isSubtle && '• Subtle'}
                    </span>
                    <span className="text-[8px] font-mono text-gray-600 font-bold">{item.timestamp}</span>
                  </div>
                  <p className={`text-white leading-relaxed ${item.type === 'roll' ? 'text-2xl font-black' : 'text-xs italic'}`}>
                    {item.content}
                  </p>
                  <div className="text-[8px] text-gray-500 mt-2 font-black uppercase tracking-tighter truncate opacity-80">{item.user}</div>
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
                  <input type="checkbox" className="sr-only peer" checked={isSubtleMode} onChange={() => setIsSubtleMode(!isSubtleMode)}/>
                  <div className="w-9 h-5 bg-gray-800 rounded-full border border-gray-700 peer peer-checked:bg-purple-600 peer-checked:border-purple-400 after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 shadow-inner"></div>
                </div>
              </label>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(die => (
              <button key={die} onClick={() => rollDie(die)} className="bg-gray-900/50 hover:bg-gray-800 active:bg-gray-700 text-[10px] font-black py-2 rounded-lg border border-gray-800 hover:border-gray-600 transition-all shadow-sm active:scale-95 text-gray-200">
                {die}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Area: Excalidraw */}
      <main className="flex-1 h-full min-w-0 bg-[#121212] z-10 overflow-hidden relative">
          <Excalidraw excalidrawRef={(api) => setExcalidrawAPI(api)} onChange={handleCanvasChange} theme="dark" UIOptions={{ canvasActions: { toggleTheme: false, export: false, loadScene: false, saveToActiveFile: false } }} />
      </main>

      {/* Right Sidebar: GM Toolbox */}
      <aside className="w-[320px] h-full flex-none border-l border-gray-800 p-5 flex flex-col bg-gray-950 z-20 overflow-hidden shadow-2xl">
        <h2 className="text-xl font-black border-b border-gray-800 pb-4 shrink-0 tracking-tighter text-gray-100 uppercase italic">
          {isGM ? 'Grand Master' : 'Adventurer'}
        </h2>
        
        <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
          {isGM ? (
            <>
              {/* Voice Storytelling Toggle */}
              <div className="space-y-4 pt-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Narration</h3>
                <button 
                  onClick={toggleRecording}
                  className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border ${isRecording ? 'bg-red-600 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-pulse' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)]'}`}></div>
                  {isRecording ? 'Transcribing Story' : 'Start Voice Chronicle'}
                </button>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Active Adventurers</h3>
                <div className="space-y-3">
                  {activeUsers.filter(u => u.role !== 'gm').map(u => (
                    <div key={u.id} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 group transition-all hover:border-indigo-500/30 shadow-inner">
                      <div className="flex items-center justify-between mb-3.5">
                        <p className="text-sm font-black text-gray-100 uppercase tracking-tighter">{u.username}</p>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => requestPlayerRoll(u.id, 'd20', 'Perception')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-2 rounded-lg font-black uppercase transition-all tracking-tighter border border-gray-700 active:scale-95"> Perception </button>
                        <button onClick={() => requestPlayerRoll(u.id, 'd20', 'Stealth')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-2 rounded-lg font-black uppercase transition-all tracking-tighter border border-gray-700 active:scale-95"> Stealth </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">AI Weaver</h3>
                <div className="grid gap-3">
                  <button onClick={handleGenerateEnemy} disabled={isGenerating} className="w-full bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-blue-500/20 text-xs uppercase tracking-widest shadow-blue-900/20"> Manifest Enemy </button>
                  <button onClick={handleGenerateLore} disabled={isGenerating} className="w-full bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-indigo-500/20 text-xs uppercase tracking-widest shadow-indigo-900/20"> Script Lore </button>
                </div>
              </div>
            </>
          ) : (
            <div className="pt-4 space-y-6">
              <div className="bg-gray-900/40 p-8 rounded-3xl border border-gray-800 text-center shadow-inner">
                <div className="w-20 h-20 bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-5 border border-indigo-500/30 shadow-2xl relative">
                  <span className="text-2xl font-black text-indigo-300 drop-shadow-sm relative z-10">{user ? user.username.substring(0, 2).toUpperCase() : '??'}</span>
                </div>
                <h3 className="font-black text-gray-100 uppercase tracking-tighter mb-1.5 text-xl">{isAuthenticated ? user?.username : 'Wanderer'}</h3>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mb-8">Party Member • LVL 5</p>
                <p className="text-[10px] text-gray-500 font-bold leading-relaxed italic px-4 uppercase tracking-widest opacity-60">Maintain your vigil.<br/>The Master will signal.</p>
              </div>
            </div>
          )}

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
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= 3 ? 'bg-red-600' : 'bg-gray-800'}`}></div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Current Locale</p>
                <p className="text-sm font-black tracking-tight text-gray-100 uppercase truncate">{activeCampaign.id === 1 ? 'The Dark Forest' : 'New Realm'}</p>
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

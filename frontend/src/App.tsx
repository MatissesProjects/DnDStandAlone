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

interface EnemyData {
  name: string;
  stats: any;
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

interface MoveProposal {
  elementId: string;
  x: number;
  y: number;
  senderId: string;
  username: string;
  originalX: number;
  originalY: number;
}

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token } = useAuth();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  const [activeCampaign, setActiveCampaign] = useState<{id: number, roomId: string, canvas_state?: any} | null>(null);
  const [activeLocationId] = useState(1);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isRemoteUpdate = useRef(false);
  const lastSyncTime = useRef(0);
  const saveTimeout = useRef<any>(null);

  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    activeCampaign ? `ws://localhost:8000/ws/${activeCampaign.roomId}/${clientId}?role=${isGM ? 'gm' : 'player'}&username=${user?.username || 'Guest'}` : ''
  );
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSubtleMode, setIsSubtleMode] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [rollRequirement, setRollRequirement] = useState<{die: string, label: string} | null>(null);
  
  // Suggestion State
  const [pendingProposals, setPendingProposals] = useState<MoveProposal[]>([]);
  const localElementsRef = useRef<any[]>([]);

  // AI and Voice State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEnemy, setGeneratedEnemy] = useState<EnemyData | null>(null);
  const [generatedLore, setGeneratedLore] = useState<string | null>(null);
  const [isRecording, setIsIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<any>(null);

  // Initial Scene Load
  useEffect(() => {
    if (excalidrawAPI && activeCampaign?.canvas_state) {
      isRemoteUpdate.current = true;
      excalidrawAPI.updateScene({
        elements: activeCampaign.canvas_state.elements || [],
        appState: activeCampaign.canvas_state.appState || {},
        commitToHistory: false
      });
      localElementsRef.current = activeCampaign.canvas_state.elements || [];
    }
  }, [excalidrawAPI, activeCampaign]);

  // Handle incoming WebSocket messages
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
            localElementsRef.current = data.elements;
          }
        } 
        else if (data.type === "move_proposal" && isGM) {
          setPendingProposals(prev => {
            // Remove existing proposal for this element if it exists
            const filtered = prev.filter(p => p.elementId !== data.elementId);
            return [...filtered, data];
          });
        }
        else if (data.type === "move_rejected" && data.targetId === clientId) {
          // Revert the element locally
          if (excalidrawAPI) {
            isRemoteUpdate.current = true;
            const updated = localElementsRef.current.map(el => {
              if (el.id === data.elementId) {
                return { ...el, x: data.originalX, y: data.originalY, opacity: 100 };
              }
              return el;
            });
            excalidrawAPI.updateScene({ elements: updated, commitToHistory: false });
          }
        }
        else if (data.type === "presence") setActiveUsers(data.users);
        else if (data.type === "request_roll") setRollRequirement({ die: data.die, label: data.label });
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
  }, [lastMessage, excalidrawAPI, clientId, isGM]);

  const handleCanvasChange = useCallback((elements: any, appState: any) => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    if (!isGM) {
      // Find moved elements
      elements.forEach((el: any) => {
        const prev = localElementsRef.current.find(p => p.id === el.id);
        if (prev && (prev.x !== el.x || prev.y !== el.y)) {
          // Send proposal
          sendMessage(JSON.stringify({
            type: "move_proposal",
            elementId: el.id,
            x: el.x,
            y: el.y,
            originalX: prev.x,
            originalY: prev.y,
            senderId: clientId,
            username: user?.username || "Guest"
          }));
          
          // Visually mark as pending locally
          el.opacity = 50; 
        }
      });
      localElementsRef.current = elements;
      return; // Players don't broadcast full updates
    }

    // GM Logic: Full broadcast
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

    // Database Persistence (Debounced)
    if (isGM && activeCampaign && token) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/canvas`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canvas_state: {
              elements,
              appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize }
            }
          })
        });
      }, 3000);
    }
    localElementsRef.current = elements;
  }, [sendMessage, clientId, isGM, activeCampaign, token, user]);

  const approveProposal = (prop: MoveProposal) => {
    if (excalidrawAPI) {
      const updatedElements = localElementsRef.current.map(el => {
        if (el.id === prop.elementId) {
          return { ...el, x: prop.x, y: prop.y, opacity: 100 };
        }
        return el;
      });
      
      isRemoteUpdate.current = false; // Trigger a broadcast
      excalidrawAPI.updateScene({ elements: updatedElements });
      setPendingProposals(prev => prev.filter(p => p.elementId !== prop.elementId));
    }
  };

  const rejectProposal = (prop: MoveProposal) => {
    sendMessage(JSON.stringify({
      type: "move_rejected",
      targetId: prop.senderId,
      elementId: prop.elementId,
      originalX: prop.originalX,
      originalY: prop.originalY
    }));
    setPendingProposals(prev => prev.filter(p => p.elementId !== prop.elementId));
  };

  // ... (Speech recognition and AI methods remain the same) ...
  const handleLogin = () => {
    fetch('http://localhost:8000/auth/login')
      .then(res => res.json())
      .then(data => { window.location.href = data.url; });
  };

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
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-black italic tracking-tighter text-gray-100">DND STANDALONE</h1>
          <button onClick={handleLogin} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest transition-all shadow-2xl shadow-indigo-900/40">
            Authenticate with Discord
          </button>
        </div>
      </div>
    );
  }

  if (!activeCampaign) {
    return <SetupScreen onJoin={(id, roomId, campaign) => setActiveCampaign({id, roomId, canvas_state: campaign?.canvas_state})} />;
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

        <div className="flex-1 flex flex-col min-h-0 py-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {history.map(item => (
              <div key={item.id} className={`p-4 rounded-2xl border transition-all ${item.type === 'story' ? 'bg-gray-900/60 border-indigo-900/30' : (item.isSubtle ? 'bg-purple-950/20 border-purple-900/50' : 'bg-gray-900/40 border-gray-800')}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${item.type === 'story' ? 'text-indigo-400' : (item.isSubtle ? 'text-purple-400' : 'text-blue-500')}`}>
                    {item.type.toUpperCase()} {item.isSubtle && '• Subtle'}
                  </span>
                  <span className="text-[8px] font-mono text-gray-600 font-bold">{item.timestamp}</span>
                </div>
                <p className={`text-white leading-relaxed ${item.type === 'roll' ? 'text-2xl font-black' : 'text-xs italic'}`}>{item.content}</p>
                <div className="text-[8px] text-gray-500 mt-2 font-black uppercase tracking-tighter truncate opacity-80">{item.user}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-4 border-t border-gray-800/50 shrink-0">
          <div className="grid grid-cols-4 gap-2">
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].map(die => (
              <button key={die} onClick={() => rollDie(die)} className="bg-gray-900/50 hover:bg-gray-800 active:bg-gray-700 text-[10px] font-black py-2 rounded-lg border border-gray-800 hover:border-gray-600 transition-all shadow-sm active:scale-95 text-gray-200">{die}</button>
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
          {isGM && pendingProposals.length > 0 && (
            <div className="space-y-4 pt-4">
              <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Pending Manuevers</h3>
              <div className="space-y-3">
                {pendingProposals.map(prop => (
                  <div key={prop.elementId} className="bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/30 animate-in slide-in-from-right duration-300">
                    <p className="text-[10px] font-black text-gray-300 uppercase mb-3"><span className="text-indigo-400">{prop.username}</span> suggests move</p>
                    <div className="flex gap-2">
                      <button onClick={() => approveProposal(prop)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[9px] font-black py-2 rounded-lg uppercase tracking-tighter">Approve</button>
                      <button onClick={() => rejectProposal(prop)} className="flex-1 bg-gray-800 hover:bg-red-900/40 text-[9px] font-black py-2 rounded-lg uppercase tracking-tighter border border-gray-700">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isGM ? (
            <>
              <div className="space-y-4 pt-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Narration</h3>
                <button onClick={() => { if(isRecording) { recognitionRef.current?.stop(); setIsIsRecording(false); setInterimTranscript(""); } else { recognitionRef.current?.start(); setIsIsRecording(true); } }} className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border ${isRecording ? 'bg-red-600 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-pulse' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-600'}`}></div>
                  {isRecording ? 'Narration Active' : 'Start Chronicle'}
                </button>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Adventurers</h3>
                <div className="space-y-3">
                  {activeUsers.filter(u => u.role !== 'gm').map(u => (
                    <div key={u.id} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 group">
                      <p className="text-sm font-black text-gray-100 uppercase mb-3">{u.username}</p>
                      <div className="flex gap-2">
                        <button onClick={() => requestPlayerRoll(u.id, 'd20', 'Perception')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase border border-gray-700"> Perception </button>
                        <button onClick={() => requestPlayerRoll(u.id, 'd20', 'Stealth')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase border border-gray-700"> Stealth </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="pt-4 text-center">
              <div className="bg-gray-900/40 p-8 rounded-3xl border border-gray-800 shadow-inner">
                <div className="w-20 h-20 bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-5 border border-indigo-500/30">
                  <span className="text-2xl font-black text-indigo-300">{user ? user.username.substring(0, 2).toUpperCase() : '??'}</span>
                </div>
                <h3 className="font-black text-gray-100 uppercase tracking-tighter mb-1.5 text-xl">{user?.username}</h3>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mb-8">Adventurer • Level 5</p>
                <div className="h-px bg-gray-800 w-full mb-8"></div>
                <p className="text-[10px] text-gray-500 font-bold leading-relaxed italic px-4 uppercase tracking-widest opacity-60">Suggestions are sent to the Master for arbitration.</p>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-4 border-t border-gray-800/50">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">World Manifest</h3>
            <div className="bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-2xl space-y-6">
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Room Code</p>
                <p className="text-sm font-black tracking-tight text-indigo-400 font-mono">{activeCampaign.roomId}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-2 tracking-tighter opacity-80">Current Locale</p>
                <p className="text-sm font-black tracking-tight text-gray-100 uppercase truncate">The Dark Forest</p>
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

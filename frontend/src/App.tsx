import { Excalidraw, getSceneVersion } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginCallback from "./components/LoginCallback";
import SetupScreen from "./components/SetupScreen";
import WorldDashboard from "./components/WorldDashboard";
import ChronicleSidebar from "./components/Sidebar/ChronicleSidebar";
import GMToolbox from "./components/Sidebar/GMToolbox";
import NPCDetailCard from "./components/Overlay/NPCDetailCard";
import HandoutItem from "./components/Overlay/HandoutItem";
import type { HistoryItem, UserPresence, MoveProposal, EnemyData, Location, Entity, Campaign, Handout } from "./types/vtt";

const API_BASE = "http://192.168.4.150:8000";
const WS_BASE = "ws://192.168.4.150:8000";

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(() => {
    try {
      const saved = localStorage.getItem("vtt_active_campaign");
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [activeLocation, setActiveLocation] = useState<Location | null>(() => {
    try {
      const saved = localStorage.getItem("vtt_active_location");
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Periodic health check to confirm connectivity
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        setBackendOnline(res.ok);
      } catch (e) {
        setBackendOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Persist campaign/location to localStorage
  useEffect(() => {
    if (activeCampaign) localStorage.setItem("vtt_active_campaign", JSON.stringify(activeCampaign));
    else localStorage.removeItem("vtt_active_campaign");
  }, [activeCampaign]);

  useEffect(() => {
    if (activeLocation) {
      localStorage.setItem("vtt_active_location", JSON.stringify(activeLocation));
      // BRIDGE: Tell the extension to move the camera in the iframe
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: "VTT_BRIDGE_MOVE",
          x: activeLocation.x,
          y: activeLocation.y,
          zoom: activeLocation.zoom
        }, "*");
      }
    }
    else localStorage.removeItem("vtt_active_location");
  }, [activeLocation]);

  useEffect(() => {
    if (activeCampaign) {
      const excalidrawRoom = (activeCampaign.room_id + "00000000000000000000").substring(0, 20);
      const excalidrawKey = (activeCampaign.room_id + "0000000000000000000000").substring(0, 22);
      console.log("[Excalidraw] Shared Room URL:", `https://excalidraw.com/#room=${excalidrawRoom},${excalidrawKey}`);
    }
  }, [activeCampaign?.room_id]);

  const [activeEntities, setActiveEntities] = useState<Entity[]>([]);
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const processedMessages = useRef<Set<string>>(new Set());
  
  const [playerClass, setPlayerClass] = useState(user?.class_name || "");
  const [playerLevel, setPlayerLevel] = useState(user?.level || 1);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [vfxRoll, setVfxRoll] = useState<{ id: string, result: number, isCrit: boolean, isFail: boolean } | null>(null);
  
  const [campaignSummary, setCampaignSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // BRIDGE: Listen for capture results from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "VTT_BRIDGE_CAPTURE_RESULT") {
        window.dispatchEvent(new CustomEvent("VTT_CAMERA_CAPTURED", { detail: event.data }));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Link Interceptor: Open NPC cards when clicking entity:ID links
  useEffect(() => {
    const path = location.pathname;
    if (path.includes("entity:")) {
      const entityId = parseInt(path.split("entity:")[1]);
      const entity = activeEntities.find(e => e.id === entityId);
      if (entity) {
        setSelectedEntity(entity);
        navigate("/", { replace: true });
      }
    }
  }, [location.pathname, activeEntities, navigate]);

  const fetchHistory = useCallback(() => {
    if (!activeCampaign || !token) return;
    fetch(`${API_BASE}/campaigns/${activeCampaign.id}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const formattedHistory: HistoryItem[] = data.map((item: any) => ({
            id: item.id.toString(),
            type: item.event_type === 'dice_roll' ? 'roll' : (item.event_type === 'lore_update' ? 'ai' : 'story'),
            content: item.content,
            user: "Chronicle",
            timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSubtle: item.is_private
          }));
          setHistory(formattedHistory);
        }
      })
      .catch(err => console.error("[Chronicle] Fetch History Failed:", err));
  }, [activeCampaign, token]);

  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    activeCampaign ? `${WS_BASE}/ws/${activeCampaign.room_id}/${clientId}?role=${isGM ? 'gm' : 'player'}&username=${user?.username || 'Guest'}` : ''
  );
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSubtleMode, setIsSubtleMode] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [rollRequirement, setRollRequirement] = useState<{die: string, label: string} | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEnemy, setGeneratedEnemy] = useState<EnemyData | null>(null);
  const [generatedLore, setGeneratedLore] = useState<string | null>(null);

  const fetchEntities = useCallback(async (locId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/locations/${locId}/entities`);
      if (res.ok) {
        const data = await res.json();
        setActiveEntities(data);
        if (selectedEntity) {
            const updated = data.find((e: Entity) => e.id === selectedEntity.id);
            if (updated) setSelectedEntity(updated);
        }
      }
    } catch (e) { console.error("[Entities] Fetch Failed:", e); }
  }, [token, selectedEntity]);

  const fetchHandouts = useCallback(async () => {
    if (!activeCampaign || !token) return;
    try {
      const res = await fetch(`${API_BASE}/campaigns/${activeCampaign.id}/handouts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHandouts(data);
      }
    } catch (e) { console.error("[Handouts] Fetch Failed:", e); }
  }, [activeCampaign, token]);

  useEffect(() => {
    if (activeCampaign && token) {
      fetchHistory();
      fetchHandouts();
      fetch(`${API_BASE}/campaigns/${activeCampaign.id}/locations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => { if (Array.isArray(data) && data.length > 0) {
            const current = data.find((l: any) => l.id === activeLocation?.id) || data[0];
            setActiveLocation(current);
        }})
        .catch(err => console.error("[World] Fetch Locations Failed:", err));
    }
  }, [activeCampaign, token]);

  useEffect(() => {
    if (activeLocation && token) fetchEntities(activeLocation.id);
  }, [activeLocation?.id, token]);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        const msgId = data.id || `${data.type}-${data.timestamp}-${data.senderId}`;
        if (processedMessages.current.has(msgId)) return;
        processedMessages.current.add(msgId);

        if (data.type === "presence") setActiveUsers(data.users);
        else if (data.type === "request_roll") setRollRequirement({ die: data.die, label: data.label });
        else if (data.type === "location_update") setActiveLocation(data.location);
        else if (data.type === "entities_update") {
            if (activeLocation?.id === data.locationId) fetchEntities(data.locationId);
        }
        else if (data.type === 'story' || (data.result && data.die)) {
          if (data.result && data.die && !data.isSubtle) {
            const isD20 = data.die.includes('d20');
            setVfxRoll({ 
              id: data.id || Math.random().toString(), 
              result: data.result, 
              isCrit: data.result === 20 && isD20,
              isFail: data.result === 1 && isD20
            });
            setTimeout(() => setVfxRoll(null), 800);
          }
          const item: HistoryItem = data.type === 'story' ? data : { id: data.id, type: 'roll' as const, content: `${data.die}: ${data.result}`, user: data.user, timestamp: data.timestamp, isSubtle: data.isSubtle };
          setHistory(prev => [item, ...prev].slice(0, 100));
        }
      } catch (e) {}
    }
  }, [lastMessage, clientId, isGM, activeLocation?.id, fetchEntities]);

  const handleConsumeHistory = async (logId: string) => {
    if (!token || !activeCampaign) return;
    try {
      const res = await fetch(`${API_BASE}/campaigns/${activeCampaign.id}/history/${logId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { fetchHistory(); }
    } catch (e) { console.error(e); }
  };

  const handleClearHistory = async () => {
    if (!isGM || !token || !activeCampaign || !window.confirm("Clear entire chronicle history?")) return;
    try { sendMessage(JSON.stringify({ type: "history_cleared" })); setHistory([]); } catch (e) { console.error(e); }
  };

  const rollDie = (die: string, label?: string) => {
    const sides = parseInt(die.substring(1));
    const result = Math.floor(Math.random() * sides) + 1;
    const content = `${label ? `${die} (${label})` : die}: ${result}${isSubtleMode ? ' (Subtle)' : ''}`;
    
    if (activeCampaign && token) {
      console.log("[Dice] Rolling:", { die, result, isSubtle: isSubtleMode });
      fetch(`${API_BASE}/campaigns/${activeCampaign.id}/history`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          event_type: 'dice_roll', 
          content: `${user?.username || 'Guest'} rolled ${content}`, 
          campaign_id: activeCampaign.id,
          is_private: isSubtleMode 
        }) 
      })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Server error saving roll");
        return data;
      })
      .then(savedLog => {
        const newRoll = { 
          id: savedLog.id.toString(), 
          type: 'roll' as const, 
          die, 
          result, 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
          isSubtle: isSubtleMode, 
          user: user ? user.username : `Player ${clientId.substring(0, 4)}`, 
          senderId: clientId 
        };
        sendMessage(JSON.stringify(newRoll));
      })
      .catch(err => {
        console.error("[Dice] Roll Save Failed:", err);
        // Fallback: Send roll via websocket even if DB fails (so it's not "stuck")
        const fallbackRoll = { 
            id: Math.random().toString(),
            type: 'roll' as const, 
            die, result, 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            isSubtle: isSubtleMode, 
            user: user ? user.username : "Guest", 
            senderId: clientId 
        };
        sendMessage(JSON.stringify(fallbackRoll));
      });
    }
  };

  const handleGuestLogin = async () => {
    console.log("[Auth] Attempting guest login to:", `${API_BASE}/auth/guest`);
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/auth/guest`);
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
      } else {
        throw new Error(data.detail || "Guest login failed");
      }
    } catch (e: any) {
      console.error("[Auth] Guest login error:", e);
      alert(`Login failed. Check console. Is backend running at ${API_BASE}?`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans text-center">
        <div className="space-y-8 p-12 bg-gray-900 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/5 animate-pulse pointer-events-none"></div>
          
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${backendOnline === true ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : backendOnline === false ? 'bg-red-500' : 'bg-gray-600'}`}></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">
              {backendOnline === true ? 'Signal Strong' : backendOnline === false ? 'Signal Lost' : 'Seeking Signal...'}
            </span>
          </div>

          <h1 className="text-5xl font-black italic tracking-tighter text-gray-100 uppercase relative z-10 pt-4">DND Master</h1>
          
          <div className="flex flex-col gap-4 relative z-10">
            <a 
              href={`${API_BASE}/auth/login`} 
              className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-950/40 block text-center"
            >
              Authenticate via Discord
            </a>
            <button 
              onClick={handleGuestLogin} 
              disabled={isLoggingIn}
              className="px-10 py-4 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:opacity-50 text-gray-400 hover:text-white rounded-2xl font-black uppercase tracking-widest transition-all border border-gray-700 active:scale-95"
            >
              {isLoggingIn ? "Generating Soul..." : "Join as Guest"}
            </button>
          </div>
          
          <div className="pt-4 relative z-10">
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }} 
              className="text-[10px] text-gray-600 hover:text-red-400 uppercase font-black tracking-widest transition-all"
            >
              Clear Session & Reset
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeCampaign) {
    return <SetupScreen onJoin={(id, roomId, campaign) => setActiveCampaign({id, room_id: roomId, canvas_state: campaign?.canvas_state})} />;
  }

  return (
    <div className={`flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none transition-all duration-300 ${(vfxRoll?.isCrit || vfxRoll?.isFail) ? 'animate-big-shake' : vfxRoll ? 'animate-shake' : ''}`}>
      {isDashboardOpen && <WorldDashboard 
        campaignId={activeCampaign.id} 
        onClose={() => setIsDashboardOpen(false)} 
        onSetActive={(loc) => { 
          setActiveLocation(loc); 
          sendMessage(JSON.stringify({ type: "location_update", location: loc, senderId: clientId })); 
        }} 
        activeLocationId={activeLocation?.id} 
      />}
      
      {selectedEntity && (
        <NPCDetailCard 
          entity={selectedEntity} 
          isGM={isGM} 
          onClose={() => setSelectedEntity(null)} 
          onUpdateStats={async (id, upd) => {
            const current = activeEntities.find(e => e.id === id);
            if (!current) return;
            const res = await fetch(`${API_BASE}/entities/${id}`, { 
                method: 'PATCH', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ stats: { ...current.stats, ...upd } }) 
            });
            if (res.ok) { 
                sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation?.id, senderId: clientId }));
                fetchEntities(activeLocation?.id || 0); 
            }
          }} 
          onUpdateEntity={async (id, upd) => {
            const res = await fetch(`${API_BASE}/entities/${id}`, { 
                method: 'PATCH', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify(upd) 
            });
            if (res.ok) { 
                sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation?.id, senderId: clientId }));
                fetchEntities(activeLocation?.id || 0); 
            }
          }} 
          onRoll={(name, lbl, bonus) => {
            const res = Math.floor(Math.random() * 20) + 1;
            const content = `${name} rolled d20 (${lbl}): ${res + (bonus||0)}${isSubtleMode ? ' (Subtle)' : ''}`;
            if (activeCampaign && token) {
                fetch(`${API_BASE}/campaigns/${activeCampaign.id}/history`, { 
                    method: 'POST', 
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        event_type: 'dice_roll', 
                        content, 
                        campaign_id: activeCampaign.id, 
                        is_private: isSubtleMode 
                    }) 
                })
                .then(r => r.json())
                .then(saved => {
                    sendMessage(JSON.stringify({ 
                        id: saved.id.toString(), 
                        type: 'roll', 
                        die: 'd20', 
                        result: res + (bonus||0), 
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                        isSubtle: isSubtleMode, 
                        user: name, 
                        senderId: clientId 
                    }));
                })
                .catch(err => console.error("[NPC Roll] Failed:", err));
            }
          }} 
        />
      )}

      {vfxRoll && (
        <div className="fixed inset-0 z-[150] pointer-events-none flex flex-col items-center justify-center animate-in fade-in zoom-in-125 duration-300">
          <div className={`text-[8rem] font-black italic tracking-tighter opacity-20 ${vfxRoll.isCrit ? 'text-indigo-400' : vfxRoll.isFail ? 'text-red-500' : 'text-gray-400'}`}>{vfxRoll.result}</div>
          {vfxRoll.isCrit && <div className="text-2xl font-black text-indigo-400 uppercase tracking-[0.5em] animate-bounce">Critical Success</div>}
          {vfxRoll.isFail && <div className="text-2xl font-black text-red-500 uppercase tracking-[0.5em] animate-pulse">Critical Failure</div>}
        </div>
      )}

      <div className="fixed inset-0 pointer-events-none z-40">
        {handouts.map(h => (
          <div key={h.id} className="pointer-events-auto">
            <HandoutItem handout={h} isGM={isGM} onDelete={async (id) => { if (!isGM) return; const res = await fetch(`${API_BASE}/handouts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { fetchHandouts(); } }} onMove={async (id, x, y) => { if (!isGM) return; await fetch(`${API_BASE}/handouts/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }); }} />
          </div>
        ))}
      </div>

      <button onClick={() => setLeftSidebarOpen(!leftSidebarOpen)} className={`fixed bottom-8 left-8 z-[60] p-4 glass-panel rounded-2xl text-gray-400 hover:text-indigo-400 transition-all shadow-xl border border-white/5 active:scale-95 ${!leftSidebarOpen ? 'translate-x-0' : 'translate-x-[340px]'}`}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{leftSidebarOpen ? <polyline points="15 18 9 12 15 6"></polyline> : <polyline points="9 18 15 12 9 6"></polyline>}</svg></button>
      <button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className={`fixed bottom-8 right-8 z-[60] p-4 glass-panel rounded-2xl text-gray-400 hover:text-indigo-400 transition-all shadow-xl border border-white/5 active:scale-95 ${!rightSidebarOpen ? 'translate-x-0' : 'translate-x-[-320px]'}`}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{rightSidebarOpen ? <polyline points="9 18 15 12 9 6"></polyline> : <polyline points="15 18 9 12 15 6"></polyline>}</svg></button>

      {leftSidebarOpen && <ChronicleSidebar isConnected={isConnected} onLogout={logout} onLeave={() => setActiveCampaign(null)} rollRequirement={rollRequirement} isGM={isGM} onRoll={rollDie} history={history} isSubtleMode={isSubtleMode} setIsSubtleMode={setIsSubtleMode} onConsumeHistory={handleConsumeHistory} />}

      <main className="flex-1 h-full min-w-0 bg-[#121212] z-10 overflow-hidden relative">
          <iframe 
            src={`https://excalidraw.com/#room=${(activeCampaign.room_id + "00000000000000000000").substring(0, 20)},${(activeCampaign.room_id + "0000000000000000000000").substring(0, 22)}`} 
            className="w-full h-full border-none bg-white block"
            style={{ width: '100%', height: '100%', minHeight: '100vh' }}
            title="Excalidraw Canvas"
            allow="clipboard-read; clipboard-write"
          />
      </main>

      {rightSidebarOpen && (
        <GMToolbox 
          isGM={isGM} user={user} isAuthenticated={isAuthenticated} pendingProposals={[]} onApproveProposal={()=>{}} onRejectProposal={()=>{}}
          isRecording={false} onToggleRecording={()=>{}}
          activeUsers={activeUsers} onRequestRoll={(targetId, die, lbl) => sendMessage(JSON.stringify({ type: "request_roll", target_id: targetId, die, label: lbl }))}
          onGenerateEnemy={async () => { 
            if (!token || !activeCampaign) return; 
            setIsGenerating(true); 
            try { 
              const locId = activeLocation?.id || 1;
              const url = `${API_BASE}/campaigns/${activeCampaign.id}/generate-enemy?location_id=${locId}`;
              const res = await fetch(url, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({}) 
              }); 
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              setGeneratedEnemy(await res.json()); 
            } catch (e) { 
              console.error("[AI Weaver] Generate Enemy Failed:", e);
              alert("AI Generation failed. Check console.");
            } finally { 
              setIsGenerating(false); 
            } 
          }} 
          onGenerateLore={async () => { 
            if (!token || !activeCampaign) return; 
            setIsGenerating(true); 
            try { 
              const locId = activeLocation?.id || 1;
              const res = await fetch(`${API_BASE}/campaigns/${activeCampaign.id}/generate-lore?location_id=${locId}`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({}) 
              }); 
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              setGeneratedLore((await res.json()).lore); 
            } catch (e) { 
              console.error("[AI Weaver] Generate Lore Failed:", e);
            } finally { 
              setIsGenerating(false); 
            } 
          }} 
          isGenerating={isGenerating} generatedEnemy={generatedEnemy} generatedLore={generatedLore}
          onManifestEntity={async () => { 
            console.log("[Materialize] Attempting to manifest:", { generatedEnemy, hasToken: !!token, activeLocationId: activeLocation?.id });
            if (!activeLocation) {
              alert("Please create or select a Location in the Dashboard first!");
              return;
            }
            if (!generatedEnemy || !token) {
              console.warn("[Materialize] Aborting: Missing enemy or token");
              return;
            }
            try {
              const res = await fetch(`${API_BASE}/entities`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                  name: generatedEnemy.name, 
                  location_id: activeLocation.id, 
                  stats: generatedEnemy.stats, 
                  backstory: generatedEnemy.backstory 
                }) 
              }); 
              console.log("[Materialize] Response status:", res.status);
              if (res.ok) { 
                setGeneratedEnemy(null); 
                sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation.id, senderId: clientId })); 
                fetchEntities(activeLocation.id); 
              } else {
                const err = await res.json();
                console.error("[Materialize] Server error:", err);
                alert("Materialization failed: " + (err.detail || "Unknown error"));
              }
            } catch (e) {
              console.error("[Materialize] Fetch exception:", e);
              alert("Network error during materialization.");
            }
          }} 
          activeEntities={activeEntities} onSelectEntity={setSelectedEntity} activeLocation={activeLocation} activeCampaign={activeCampaign}
          onOpenDashboard={() => setIsDashboardOpen(true)} playerClass={playerClass} playerLevel={playerLevel} isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile}
          setPlayerClass={setPlayerClass} setPlayerLevel={setPlayerLevel} onUpdateProfile={async () => { if (!token) return; const res = await fetch(`${API_BASE}/users/me`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ class_name: playerClass, level: playerLevel }) }); if (res.ok) { setIsEditingProfile(false); sendMessage(JSON.stringify({ type: "user_update", class_name: playerClass, level: playerLevel })); } }}
          onSummarize={async () => { if (!token || !activeCampaign) return; setIsSummarizing(true); try { const res = await fetch(`${API_BASE}/campaigns/${activeCampaign.id}/summarize`, { headers: { 'Authorization': `Bearer ${token}` } }); setCampaignSummary((await res.json()).summary); } catch (e) { console.error(e); } finally { setIsSummarizing(false); } }} 
          isSummarizing={isSummarizing}
          onClearHistory={handleClearHistory}
          onDismissEnemy={() => setGeneratedEnemy(null)}
          onDismissLore={() => setGeneratedLore(null)}
          onUpdateGeneratedEnemy={(enemy) => setGeneratedEnemy(enemy)}
          onUpdateGeneratedLore={(lore) => setGeneratedLore(lore)}
          onManifestLore={async (c) => { if (!token || !activeCampaign) return; const res = await fetch(`${API_BASE}/handouts`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: "Whispered Lore", content: c, type: "text", campaign_id: activeCampaign.id, x: 400, y: 300 }) }); if (res.ok) { fetchHandouts(); setGeneratedLore(null); } }}
          />      )}
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

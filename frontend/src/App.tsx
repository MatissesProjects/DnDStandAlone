import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginCallback from "./components/LoginCallback";
import SetupScreen from "./components/SetupScreen";
import WorldDashboard from "./components/WorldDashboard";

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
  class_name?: string;
  level?: number;
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

interface Location {
  id: number;
  name: string;
  description: string;
  danger_level: number;
}

interface Entity {
  id: number;
  name: string;
  stats: any;
  backstory: string;
  location_id: number;
}

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token } = useAuth();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  const [activeCampaign, setActiveCampaign] = useState<{id: number, roomId: string, canvas_state?: any} | null>(null);
  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [activeEntities, setActiveEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  // Player Profile State
  const [playerClass, setPlayerClass] = useState(user?.class_name || "");
  const [playerLevel, setPlayerLevel] = useState(user?.level || 1);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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

  // Load History and Current Location on Join
  useEffect(() => {
    if (activeCampaign && token) {
      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const formattedHistory: HistoryItem[] = data.map((item: any) => ({
              id: item.id.toString(),
              type: item.event_type === 'dice_roll' ? 'roll' : (item.event_type === 'lore_update' ? 'ai' : 'story'),
              content: item.content,
              user: "Chronicle",
              timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));
            setHistory(formattedHistory);
          }
        });

      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/locations`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setActiveLocation(data[data.length - 1]);
          }
        });
    }
  }, [activeCampaign, token]);

  // Fetch Entities for Active Location
  const fetchEntities = useCallback(async (locId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8000/locations/${locId}/entities`);
      if (res.ok) {
        const data = await res.json();
        setActiveEntities(data);
        // If the selected entity is one of these, update it to refresh HP etc.
        if (selectedEntity && data.find((e: Entity) => e.id === selectedEntity.id)) {
          setSelectedEntity(data.find((e: Entity) => e.id === selectedEntity.id));
        }
      }
    } catch (e) { console.error(e); }
  }, [token, selectedEntity]);

  useEffect(() => {
    if (activeLocation && token) {
      fetchEntities(activeLocation.id);
    }
  }, [activeLocation, token]);

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
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
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
        else if (data.type === "location_update") {
          setActiveLocation(data.location);
        }
        else if (data.type === "entities_update") {
          if (activeLocation && data.locationId === activeLocation.id) {
            fetchEntities(activeLocation.id);
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
  }, [lastMessage, excalidrawAPI, clientId, isGM, activeLocation, token, fetchEntities]);

  const handleUpdateProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:8000/users/me', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ class_name: playerClass, level: playerLevel })
      });
      if (res.ok) {
        setIsEditingProfile(false);
        sendMessage(JSON.stringify({ type: "user_update", class_name: playerClass, level: playerLevel }));
      }
    } catch (e) { console.error(e); }
  };

  const persistCanvas = useCallback((elements: any, appState: any) => {
    if (!isGM || !activeCampaign || !token) return;
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
  }, [isGM, activeCampaign, token]);

  const handleCanvasChange = useCallback((elements: any, appState: any) => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    if (!isGM) {
      elements.forEach((el: any) => {
        const prev = localElementsRef.current.find(p => p.id === el.id);
        if (prev && (prev.x !== el.x || prev.y !== el.y)) {
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
          el.opacity = 50; 
        }
      });
      localElementsRef.current = elements;
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
    persistCanvas(elements, appState);
    localElementsRef.current = elements;
  }, [sendMessage, clientId, isGM, persistCanvas, user]);

  const approveProposal = (prop: MoveProposal) => {
    if (excalidrawAPI) {
      const updatedElements = localElementsRef.current.map(el => {
        if (el.id === prop.elementId) return { ...el, x: prop.x, y: prop.y, opacity: 100 };
        return el;
      });
      isRemoteUpdate.current = false;
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
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-enemy?location_id=${activeLocation?.id || 1}`, {
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
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-lore?location_id=${activeLocation?.id || 1}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setGeneratedLore(data.lore);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleManifestEntity = async () => {
    if (!generatedEnemy || !token || !activeLocation) return;
    try {
      const res = await fetch(`http://localhost:8000/entities`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: generatedEnemy.name,
          location_id: activeLocation.id,
          stats: generatedEnemy.stats,
          backstory: generatedEnemy.backstory
        })
      });
      if (res.ok) {
        setGeneratedEnemy(null);
        sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation.id }));
        fetchEntities(activeLocation.id);
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateNPCStats = async (entityId: number, statsUpdate: any) => {
    if (!token || !activeLocation) return;
    try {
      const currentEntity = activeEntities.find(e => e.id === entityId);
      if (!currentEntity) return;
      
      const newStats = { ...currentEntity.stats, ...statsUpdate };
      const res = await fetch(`http://localhost:8000/entities/${entityId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats: newStats })
      });
      if (res.ok) {
        sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation.id }));
        fetchEntities(activeLocation.id);
      }
    } catch (e) { console.error(e); }
  };

  const handleSetActiveLocation = (loc: Location) => {
    setActiveLocation(loc);
    sendMessage(JSON.stringify({ type: "location_update", location: loc }));
  };

  const rollForNPC = (entityName: string, label: string, bonus: number = 0) => {
    const result = Math.floor(Math.random() * 20) + 1;
    const finalResult = result + bonus;
    const newRoll = {
      id: Math.random().toString(36).substring(7),
      die: `d20 (${label})`,
      result: finalResult,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSubtle: isSubtleMode,
      user: entityName
    };
    sendMessage(JSON.stringify(newRoll));
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
    return <SetupScreen onJoin={(id, roomId, campaign) => setActiveCampaign({id, roomId, canvas_state: campaign?.canvas_state})} />;
  }

  return (
    <div className="flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none">
      {isDashboardOpen && (
        <WorldDashboard 
          campaignId={activeCampaign.id} 
          onClose={() => setIsDashboardOpen(false)}
          onSetActive={handleSetActiveLocation}
          activeLocationId={activeLocation?.id}
        />
      )}

      {selectedEntity && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedEntity(null)}>
          <div className="bg-gray-900 border border-indigo-500/30 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="relative h-32 bg-indigo-900/20 flex items-end p-8 border-b border-gray-800">
              <div className="absolute top-6 right-8">
                <button onClick={() => setSelectedEntity(null)} className="text-gray-500 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl border border-indigo-400/20">{selectedEntity.name.substring(0, 2).toUpperCase()}</div>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase text-gray-100">{selectedEntity.name}</h3>
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Manifested Presence</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(selectedEntity.stats || {}).filter(([k]) => k.length === 3).map(([key, val]) => (
                  <button key={key} onClick={() => rollForNPC(selectedEntity.name, key.toUpperCase(), Math.floor(((val as number) - 10) / 2))} className="bg-gray-950 p-3 rounded-2xl border border-gray-800 text-center shadow-inner hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all active:scale-95 group">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-tighter mb-1 group-hover:text-indigo-400">{key}</p>
                    <p className="text-lg font-black text-white leading-none">{val as number}</p>
                    <p className="text-[8px] text-gray-500 font-bold mt-1">({Math.floor(((val as number) - 10) / 2) >= 0 ? '+' : ''}{Math.floor(((val as number) - 10) / 2)})</p>
                  </button>
                ))}
              </div>
              {selectedEntity.stats?.actions && selectedEntity.stats.actions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Combat Maneuvers</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedEntity.stats.actions.map((action: string, i: number) => (
                      <button key={i} onClick={() => rollForNPC(selectedEntity.name, action, 0)} className="w-full text-left bg-gray-950 p-3 rounded-xl border border-gray-800 hover:border-blue-500/50 hover:bg-blue-900/10 transition-all flex justify-between items-center group">
                        <span className="text-xs font-bold text-gray-300 group-hover:text-blue-400">{action}</span>
                        <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded border border-gray-800 font-black">ROLL</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Narrative Essence</h4>
                <p className="text-sm text-gray-300 leading-relaxed italic opacity-90">"{selectedEntity.backstory}"</p>
              </div>
              
              {/* HP Tracking Section */}
              <div className="flex gap-3 pt-2">
                <div className="flex-[2] bg-gray-950 p-4 rounded-3xl border border-gray-800 flex items-center justify-between shadow-inner">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-600 uppercase">Health Points</p>
                    <p className="text-2xl font-black text-red-500 leading-none">{selectedEntity.stats?.hp || 0}</p>
                  </div>
                  {isGM && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleUpdateNPCStats(selectedEntity.id, { hp: (selectedEntity.stats?.hp || 0) - 1 })}
                        className="w-10 h-10 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl flex items-center justify-center font-black transition-all active:scale-90"
                      >-</button>
                      <button 
                        onClick={() => handleUpdateNPCStats(selectedEntity.id, { hp: (selectedEntity.stats?.hp || 0) + 1 })}
                        className="w-10 h-10 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl flex items-center justify-center font-black transition-all active:scale-90"
                      >+</button>
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-gray-950 p-4 rounded-3xl border border-gray-800 text-center shadow-inner">
                  <p className="text-[8px] font-black text-gray-600 uppercase mb-1">AC</p>
                  <p className="text-2xl font-black text-blue-400 leading-none">{selectedEntity.stats?.ac || '??'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2.5 text-center">Injunction</p>
            <button onClick={() => rollDie(rollRequirement.die, rollRequirement.label)} className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider transition-all border border-indigo-400/20 active:scale-95">
              Roll {rollRequirement.die} <span className="opacity-60 ml-1">[{rollRequirement.label}]</span>
            </button>
          </div>
        )}

        {isRecording && interimTranscript && (
          <div className="mt-4 p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl animate-pulse">
            <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Narration in progress...</p>
            <p className="text-xs text-indigo-200 italic leading-relaxed">{interimTranscript}</p>
          </div>
        )}

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
          <Excalidraw excalidrawRef={(api) => setExcalidrawAPI(api)} onChange={handleCanvasChange} theme="dark" UIOptions={{ canvasActions: { toggleTheme: false, export: false, loadScene: false, saveToActive_File: false } }} />
      </main>

      {/* Right Sidebar */}
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
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">World Tools</h3>
                <button onClick={() => setIsDashboardOpen(true)} className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95"> Manage World Manifest </button>
              </div>

              <div className="space-y-4 pt-2">
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
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-black text-gray-100 uppercase tracking-tighter">{u.username}</p>
                          <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">{u.class_name || 'Class Unknown'} • Lvl {u.level || 1}</p>
                        </div>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => requestPlayerRoll(u.id, 'd20', 'Perception')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase transition-all"> Perception </button>
                        <button onClick={() => requestPlayerRoll(u.id, 'd20', 'Stealth')} className="flex-1 text-[9px] bg-gray-800 hover:bg-indigo-600 py-1.5 rounded-lg font-black uppercase transition-all"> Stealth </button>
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
                          <button onClick={handleManifestEntity} className="text-[8px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded-full border border-blue-400/30 font-black uppercase tracking-widest transition-all">Save to World</button>
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
                      <button onClick={handleUpdateProfile} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Save</button>
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
                <div key={ent.id} onClick={() => setSelectedEntity(ent)} className="bg-gray-900/40 p-3 rounded-xl border border-gray-800 flex items-center gap-3 cursor-pointer hover:bg-indigo-900/10 hover:border-indigo-500/30 transition-all group">
                  <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-[10px] font-black group-hover:bg-indigo-600 transition-colors">{ent.name.substring(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-black truncate text-gray-100 uppercase">{ent.name}</p>
                      <span className="text-[10px] font-black text-red-500">{ent.stats?.hp || 0} HP</span>
                    </div>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter truncate italic">Manifested NPC</p>
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
                <p className="text-sm font-black tracking-tight text-indigo-400 font-mono">{activeCampaign.roomId}</p>
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

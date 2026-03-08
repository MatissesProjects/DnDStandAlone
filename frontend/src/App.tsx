import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginCallback from "./components/LoginCallback";
import SetupScreen from "./components/SetupScreen";
import WorldDashboard from "./components/WorldDashboard";
import ChronicleSidebar from "./components/Sidebar/ChronicleSidebar";
import GMToolbox from "./components/Sidebar/GMToolbox";
import NPCDetailCard from "./components/Overlay/NPCDetailCard";
import { HistoryItem, UserPresence, MoveProposal, EnemyData, Location, Entity, Campaign } from "./types/vtt";

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token } = useAuth();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [activeEntities, setActiveEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  const [playerClass, setPlayerClass] = useState(user?.class_name || "");
  const [playerLevel, setPlayerLevel] = useState(user?.level || 1);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Summary State
  const [campaignSummary, setCampaignSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const isRemoteUpdate = useRef(false);
  const lastSyncTime = useRef(0);
  const saveTimeout = useRef<any>(null);

  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    activeCampaign ? `ws://localhost:8000/ws/${activeCampaign.room_id}/${clientId}?role=${isGM ? 'gm' : 'player'}&username=${user?.username || 'Guest'}` : ''
  );
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSubtleMode, setIsSubtleMode] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [rollRequirement, setRollRequirement] = useState<{die: string, label: string} | null>(null);
  const [pendingProposals, setPendingProposals] = useState<MoveProposal[]>([]);
  const localElementsRef = useRef<any[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEnemy, setGeneratedEnemy] = useState<EnemyData | null>(null);
  const [generatedLore, setGeneratedLore] = useState<string | null>(null);
  const [isRecording, setIsIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const fetchEntities = useCallback(async (locId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8000/locations/${locId}/entities`);
      if (res.ok) {
        const data = await res.json();
        setActiveEntities(data);
        if (selectedEntity && data.find((e: Entity) => e.id === selectedEntity.id)) {
          setSelectedEntity(data.find((e: Entity) => e.id === selectedEntity.id));
        }
      }
    } catch (e) { console.error(e); }
  }, [token, selectedEntity]);

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

  const fetchHistory = useCallback(() => {
    if (!activeCampaign || !token) return;
    fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const formattedHistory: HistoryItem[] = data.map((item: any) => ({
            id: item.id.toString(),
            type: item.event_type === 'dice_roll' ? 'roll' : (item.event_type === 'lore_update' ? 'ai' : 'story'),
            content: item.content,
            user: "Chronicle",
            timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSubtle: item.content.includes("(Subtle)")
          }));
          setHistory(formattedHistory);
        }
      });
  }, [activeCampaign, token]);

  useEffect(() => {
    if (activeCampaign && token) {
      fetchHistory();
      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/locations`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) setActiveLocation(data[data.length - 1]);
        });
    }
  }, [activeCampaign, token, fetchHistory]);

  useEffect(() => {
    if (activeLocation && token) fetchEntities(activeLocation.id);
  }, [activeLocation, token, fetchEntities]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        let interim = "", final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        if (final) {
          const storyItem: HistoryItem = { id: Math.random().toString(36).substring(7), type: 'story', content: final, user: user?.username || "GM", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
          sendMessage(JSON.stringify(storyItem));
          if (activeCampaign && token) fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'story', content: final, campaign_id: activeCampaign.id }) });
        }
        setInterimTranscript(interim);
      };
      recognition.onerror = () => setIsIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, [user, sendMessage, activeCampaign, token]);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        if (data.type === "canvas_update" && data.senderId !== clientId) {
          if (excalidrawAPI) {
            isRemoteUpdate.current = true;
            excalidrawAPI.updateScene({ elements: data.elements, appState: { ...data.appState }, commitToHistory: false });
            localElementsRef.current = data.elements;
          }
        } 
        else if (data.type === "location_update") setActiveLocation(data.location);
        else if (data.type === "entities_update") { if (activeLocation && data.locationId === activeLocation.id) fetchEntities(activeLocation.id); }
        else if (data.type === "history_consumed") { fetchHistory(); }
        else if (data.type === "presence") setActiveUsers(data.users);
        else if (data.type === "request_roll") setRollRequirement({ die: data.die, label: data.label });
        else if (data.type === 'story' || (data.result && data.die)) {
          const item: HistoryItem = data.type === 'story' ? data : { id: data.id, type: 'roll', content: `${data.die}: ${data.result}`, user: data.user, timestamp: data.timestamp, isSubtle: data.isSubtle };
          setHistory(prev => [item, ...prev].slice(0, 100));
        }
      } catch (e) {}
    }
  }, [lastMessage, excalidrawAPI, clientId, isGM, activeLocation, token, fetchEntities, fetchHistory]);

  const handleConsumeHistory = async (logId: string) => {
    if (!token || !activeCampaign) return;
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history/${logId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        sendMessage(JSON.stringify({ type: "history_consumed", logId }));
        fetchHistory();
      }
    } catch (e) { console.error(e); }
  };

  const persistCanvas = useCallback((elements: any, appState: any) => {
    if (!isGM || !activeCampaign || !token) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/canvas`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ canvas_state: { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize } } }) });
    }, 3000);
  }, [isGM, activeCampaign, token]);

  const handleCanvasChange = useCallback((elements: any, appState: any) => {
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    if (!isGM) {
      elements.forEach((el: any) => {
        const prev = localElementsRef.current.find(p => p.id === el.id);
        if (prev && (prev.x !== el.x || prev.y !== el.y)) {
          sendMessage(JSON.stringify({ type: "move_proposal", elementId: el.id, x: el.x, y: el.y, originalX: prev.x, originalY: prev.y, senderId: clientId, username: user?.username || "Guest" }));
          el.opacity = 50; 
        }
      });
      localElementsRef.current = elements;
      return;
    }
    const now = Date.now();
    if (now - lastSyncTime.current > 150) {
      lastSyncTime.current = now;
      sendMessage(JSON.stringify({ type: "canvas_update", senderId: clientId, elements, appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize } }));
    }
    persistCanvas(elements, appState);
    localElementsRef.current = elements;
  }, [sendMessage, clientId, isGM, persistCanvas, user]);

  const approveProposal = (prop: MoveProposal) => {
    if (excalidrawAPI) {
      const updatedElements = localElementsRef.current.map(el => { if (el.id === prop.elementId) return { ...el, x: prop.x, y: prop.y, opacity: 100 }; return el; });
      isRemoteUpdate.current = false;
      excalidrawAPI.updateScene({ elements: updatedElements });
      setPendingProposals(prev => prev.filter(p => p.elementId !== prop.elementId));
    }
  };

  const rejectProposal = (prop: MoveProposal) => {
    sendMessage(JSON.stringify({ type: "move_rejected", targetId: prop.senderId, elementId: prop.elementId, originalX: prop.originalX, originalY: prop.originalY }));
    setPendingProposals(prev => prev.filter(p => p.elementId !== prop.elementId));
  };

  const rollDie = (die: string, label?: string) => {
    const sides = parseInt(die.substring(1));
    const result = Math.floor(Math.random() * sides) + 1;
    const content = `${label ? `${die} (${label})` : die}: ${result}${isSubtleMode ? ' (Subtle)' : ''}`;
    if (activeCampaign && token) {
      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'dice_roll', content: `${user?.username || 'Guest'} rolled ${content}`, campaign_id: activeCampaign.id }) }).then(res => res.json()).then(savedLog => {
        const newRoll = { id: savedLog.id.toString(), type: 'roll', content: `${label ? `${die} (${label})` : die}: ${result}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSubtle: isSubtleMode, user: user ? user.username : `Player ${clientId.substring(0, 4)}` };
        sendMessage(JSON.stringify(newRoll));
      });
    }
    if (rollRequirement) setRollRequirement(null);
  };

  const handleGenerateEnemy = async () => {
    if (!token || !activeCampaign) return;
    setIsGenerating(true); setGeneratedLore(null);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-enemy?location_id=${activeLocation?.id || 1}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.stats) data.stats = {};
      setGeneratedEnemy(data);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleGenerateLore = async () => {
    if (!token || !activeCampaign) return;
    setIsGenerating(true); setGeneratedEnemy(null);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-lore?location_id=${activeLocation?.id || 1}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      setGeneratedLore(data.lore);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleSummarizeCampaign = async () => {
    if (!token || !activeCampaign) return;
    setIsSummarizing(true);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/summarize`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setCampaignSummary(data.summary);
    } catch (e) { console.error(e); } finally { setIsSummarizing(false); }
  };

  const handleManifestEntity = async () => {
    if (!generatedEnemy || !token || !activeLocation) return;
    try {
      const res = await fetch(`http://localhost:8000/entities`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: generatedEnemy.name, location_id: activeLocation.id, stats: generatedEnemy.stats, backstory: generatedEnemy.backstory }) });
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
      const res = await fetch(`http://localhost:8000/entities/${entityId}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ stats: newStats }) });
      if (res.ok) { sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation.id })); fetchEntities(activeLocation.id); }
    } catch (e) { console.error(e); }
  };

  const handleUpdateProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:8000/users/me', { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ class_name: playerClass, level: playerLevel }) });
      if (res.ok) { setIsEditingProfile(false); sendMessage(JSON.stringify({ type: "user_update", class_name: playerClass, level: playerLevel })); }
    } catch (e) { console.error(e); }
  };

  const handleSetActiveLocation = (loc: Location) => {
    setActiveLocation(loc);
    sendMessage(JSON.stringify({ type: "location_update", location: loc }));
  };

  const rollForNPC = (entityName: string, label: string, bonus: number = 0) => {
    const result = Math.floor(Math.random() * 20) + 1;
    if (activeCampaign && token) {
      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'dice_roll', content: `${entityName} rolled d20 (${label}): ${result + bonus}${isSubtleMode ? ' (Subtle)' : ''}`, campaign_id: activeCampaign.id }) }).then(res => res.json()).then(savedLog => {
        const newRoll = { id: savedLog.id.toString(), type: 'roll' as const, content: `d20 (${label}): ${result + bonus}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSubtle: isSubtleMode, user: entityName };
        sendMessage(JSON.stringify(newRoll));
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans text-center">
        <div className="space-y-8 p-12 bg-gray-900 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden">
          <h1 className="text-5xl font-black italic tracking-tighter text-gray-100 uppercase">DND Master</h1>
          <button onClick={() => { fetch('http://localhost:8000/auth/login').then(res => res.json()).then(data => { window.location.href = data.url; }); }} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95">Authenticate via Discord</button>
        </div>
      </div>
    );
  }

  if (!activeCampaign) {
    return <SetupScreen onJoin={(id, roomId, campaign) => setActiveCampaign({id, room_id: roomId, canvas_state: campaign?.canvas_state})} />;
  }

  return (
    <div className="flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none">
      {isDashboardOpen && <WorldDashboard campaignId={activeCampaign.id} onClose={() => setIsDashboardOpen(false)} onSetActive={handleSetActiveLocation} activeLocationId={activeLocation?.id} />}
      {selectedEntity && <NPCDetailCard entity={selectedEntity} isGM={isGM} onClose={() => setSelectedEntity(null)} onUpdateStats={handleUpdateNPCStats} onRoll={rollForNPC} />}

      {/* Summary Overlay */}
      {campaignSummary && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={() => setCampaignSummary(null)}>
          <div className="bg-gray-900 border border-indigo-500/30 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-10 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tighter uppercase italic text-indigo-400">The Chronicler's Recap</h2>
                <button onClick={() => setCampaignSummary(null)} className="text-gray-500 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="h-px bg-indigo-500/20 w-full"></div>
              <div className="max-h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                <p className="text-lg text-gray-200 leading-relaxed font-serif whitespace-pre-wrap">{campaignSummary}</p>
              </div>
              <div className="pt-4 flex justify-center">
                <button onClick={() => setCampaignSummary(null)} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Dismiss Tome</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChronicleSidebar isConnected={isConnected} onLogout={logout} onLeave={() => setActiveCampaign(null)} rollRequirement={rollRequirement} isGM={isGM} onRoll={rollDie} history={history} isSubtleMode={isSubtleMode} setIsSubtleMode={setIsSubtleMode} onConsumeHistory={handleConsumeHistory} />

      <main className="flex-1 h-full min-w-0 bg-[#121212] z-10 overflow-hidden relative">
          <Excalidraw excalidrawRef={(api) => setExcalidrawAPI(api)} onChange={handleCanvasChange} theme="dark" UIOptions={{ canvasActions: { toggleTheme: false, export: false, loadScene: false, saveToActiveFile: false } }} />
      </main>

      <GMToolbox 
        isGM={isGM} user={user} isAuthenticated={isAuthenticated} pendingProposals={pendingProposals} onApproveProposal={approveProposal} onRejectProposal={rejectProposal}
        isRecording={isRecording} onToggleRecording={() => { if(isRecording) { recognitionRef.current?.stop(); setIsIsRecording(false); setInterimTranscript(""); } else { recognitionRef.current?.start(); setIsIsRecording(true); } }}
        activeUsers={activeUsers} onRequestRoll={(targetId, die, label) => sendMessage(JSON.stringify({ type: "request_roll", target_id: targetId, die, label }))}
        onGenerateEnemy={handleGenerateEnemy} onGenerateLore={handleGenerateLore} isGenerating={isGenerating} generatedEnemy={generatedEnemy} generatedLore={generatedLore}
        onManifestEntity={handleManifestEntity} activeEntities={activeEntities} onSelectEntity={setSelectedEntity} activeLocation={activeLocation} activeCampaign={activeCampaign}
        onOpenDashboard={() => setIsDashboardOpen(true)} playerClass={playerClass} playerLevel={playerLevel} isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile}
        setPlayerClass={setPlayerClass} setPlayerLevel={setPlayerLevel} onUpdateProfile={handleUpdateProfile}
        onSummarize={handleSummarizeCampaign} isSummarizing={isSummarizing}
      />
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

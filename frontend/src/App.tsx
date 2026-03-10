import { Excalidraw } from "@excalidraw/excalidraw";
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

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clientId = useMemo(() => user?.discord_id || Math.random().toString(36).substring(7), [user]);
  
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [activeEntities, setActiveEntities] = useState<Entity[]>([]);
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const lastClosedEntityId = useRef<{id: number, time: number} | null>(null);
  const processedMessages = useRef<Set<string>>(new Set());
  
  const [playerClass, setPlayerClass] = useState(user?.class_name || "");
  const [playerLevel, setPlayerLevel] = useState(user?.level || 1);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [vfxRoll, setVfxRoll] = useState<{ id: string, result: number, isCrit: boolean, isFail: boolean } | null>(null);
  const [collaborators, setCollaborators] = useState<Map<string, any>>(new Map());

  const [campaignSummary, setCampaignSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Stable API access
  const excalidrawAPI = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  // Redundant since switching to iframe
  /*
  const isRemoteUpdate = useRef(false);
  const lastSyncTime = useRef(0);
  const saveTimeout = useRef<any>(null);
  */
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Link Interceptor: Open NPC cards when clicking entity:ID links
  useEffect(() => {
    const path = location.pathname;
    if (path.includes("entity:")) {
      const entityId = parseInt(path.split("entity:")[1]);
      const entity = activeEntities.find(e => e.id === entityId);
      if (entity) {
        console.log("[Link] Navigating to entity:", entity.name);
        setSelectedEntity(entity);
        // Clean up URL without reload
        navigate("/", { replace: true });
      }
    }
  }, [location.pathname, activeEntities, navigate]);

  // Debug API Access
  useEffect(() => {
    if (excalidrawAPI.current) {
      (window as any).excalidrawAPI = excalidrawAPI.current;
    }
  }, [apiReady]);

  const fetchHistory = useCallback(() => {
    if (!activeCampaign || !token) return;
    fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`, {
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
            isSubtle: item.content.includes("(Subtle)")
          }));
          setHistory(formattedHistory);
        }
      });
  }, [activeCampaign, token]);

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
        setSelectedEntity(prev => {
          if (!prev) return null;
          return data.find((e: Entity) => e.id === prev.id) || null;
        });
      }
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchHandouts = useCallback(async () => {
    if (!activeCampaign || !token) return;
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/handouts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHandouts(data);
      }
    } catch (e) { console.error(e); }
  }, [activeCampaign, token]);

  useEffect(() => {
    if (excalidrawAPI.current && activeLocation) {
      console.log(`[Canvas] Loading state for location ${activeLocation.id}`);
      isRemoteUpdate.current = true;
      
      const localElements = localStorage.getItem(`vtt_elements_${activeLocation.id}`);
      const localLibrary = localStorage.getItem("vtt_library_items");
      
      let elements = activeLocation.canvas_state?.elements || [];
      let appState = activeLocation.canvas_state?.appState || {};
      let libraryItems = activeLocation.canvas_state?.libraryItems || [];

      if (isGM && localElements) {
        try {
          elements = JSON.parse(localElements);
          console.log("[Canvas] Restored elements from local storage");
        } catch (e) { console.error(e); }
      }

      excalidrawAPI.current.updateScene({ 
        elements, 
        appState: { ...appState, collaborators: new Map() }, 
        commitToHistory: false 
      });

      const finalLibraryItems = [...libraryItems];
      if (localLibrary) {
        try {
          const parsedLocal = JSON.parse(localLibrary);
          if (Array.isArray(parsedLocal)) {
            parsedLocal.forEach(item => {
              if (!finalLibraryItems.find(i => i.id === item.id)) finalLibraryItems.push(item);
            });
          }
        } catch (e) { console.error(e); }
      }

      if (finalLibraryItems.length > 0) {
        excalidrawAPI.current.updateLibrary({ libraryItems: finalLibraryItems, merge: true });
      }

      localElementsRef.current = elements;
      setTimeout(() => { isRemoteUpdate.current = false; }, 150);
    }
  }, [apiReady, activeLocation?.id, isGM]);

  useEffect(() => {
    if (activeCampaign && token) {
      fetchHistory();
      fetchHandouts();
      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/locations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => { if (Array.isArray(data) && data.length > 0) setActiveLocation(data[data.length - 1]); });
    }
  }, [activeCampaign, token]);

  useEffect(() => {
    if (activeLocation && token) fetchEntities(activeLocation.id);
  }, [activeLocation, token]);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        const msgId = data.id || `${data.type}-${data.timestamp}-${data.senderId}`;
        if (processedMessages.current.has(msgId)) return;
        processedMessages.current.add(msgId);
        if (processedMessages.current.size > 200) {
          const first = processedMessages.current.values().next().value;
          if (first) processedMessages.current.delete(first);
        }

        if (data.type === "canvas_update") {
          if (data.senderId === clientId) return;
          if (excalidrawAPI.current) {
            isRemoteUpdate.current = true;
            excalidrawAPI.current.updateScene({ elements: data.elements, appState: { ...data.appState }, commitToHistory: false });
            if (data.libraryItems && data.libraryItems.length > 0) {
              excalidrawAPI.current.updateLibrary({ libraryItems: data.libraryItems, merge: true });
            }
            localElementsRef.current = data.elements;
            setTimeout(() => { isRemoteUpdate.current = false; }, 100);
          }
        } 
        else if (data.type === "presence") setActiveUsers(data.users);
        else if (data.type === "request_roll") setRollRequirement({ die: data.die, label: data.label });
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
  }, [lastMessage, clientId, isGM, activeLocation, token]);

  const persistCanvas = useCallback((elements: any, appState: any, immediate: boolean = false) => {
    if (!isGM || !activeLocation || !token || !excalidrawAPI.current) return;
    
    localStorage.setItem(`vtt_elements_${activeLocation.id}`, JSON.stringify(elements));
    
    const fetchAndSave = async () => {
      let currentLibrary = excalidrawAPI.current.getLibraryItems();
      if (currentLibrary instanceof Promise) currentLibrary = await currentLibrary;
      if (Array.isArray(currentLibrary)) localStorage.setItem("vtt_library_items", JSON.stringify(currentLibrary));

      const saveFunc = async () => {
        let libraryItems = excalidrawAPI.current.getLibraryItems();
        if (libraryItems instanceof Promise) libraryItems = await libraryItems;

        try {
          const res = await fetch(`http://localhost:8000/locations/${activeLocation.id}`, { 
            method: 'PATCH', 
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              canvas_state: { 
                elements, 
                appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize },
                libraryItems: Array.isArray(libraryItems) ? libraryItems : []
              } 
            }) 
          });
          if (res.ok) {
            const updatedLoc = await res.json();
            setActiveLocation(updatedLoc);
            setSaveStatus("Synced");
            setTimeout(() => setSaveStatus(null), 2000);
          }
        } catch (e) { console.error("[Canvas] Failed to persist", e); }
      };

      if (immediate) saveFunc();
      else {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(saveFunc, 3000);
      }
    };
    fetchAndSave();
  }, [isGM, activeLocation, token]);

  const approveProposal = (prop: MoveProposal) => {
    if (excalidrawAPI.current) {
      const updatedElements = localElementsRef.current.map(el => { if (el.id === prop.elementId) return { ...el, x: prop.x, y: prop.y, opacity: 100 }; return el; });
      isRemoteUpdate.current = true;
      excalidrawAPI.current.updateScene({ elements: updatedElements });
      localElementsRef.current = updatedElements;
      setTimeout(() => { isRemoteUpdate.current = false; }, 100);
      setPendingProposals(prev => prev.filter(p => p.elementId !== prop.elementId));
      persistCanvas(updatedElements, excalidrawAPI.current.getAppState(), true);
    }
  };

  const handleConsumeHistory = async (logId: string) => {
    if (!token || !activeCampaign) return;
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history/${logId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { sendMessage(JSON.stringify({ type: "history_consumed", logId, senderId: clientId })); fetchHistory(); }
    } catch (e) { console.error(e); }
  };

  const handleClearHistory = async () => {
    if (!isGM || !token || !activeCampaign || !window.confirm("Clear entire chronicle history?")) return;
    try { sendMessage(JSON.stringify({ type: "history_cleared" })); setHistory([]); } catch (e) { console.error(e); }
  };

  const handleBindEntity = useCallback((entityId: number) => {
    if (!excalidrawAPI.current) return;
    const allElements = excalidrawAPI.current.getSceneElements();
    const selectedIds = excalidrawAPI.current.getAppState().selectedElementIds;
    
    const updatedElements = allElements.map((el: any) => {
      if (selectedIds[el.id]) {
        return { 
          ...el, 
          link: `entity:${entityId}`,
          customData: { ...el.customData, entityId } 
        };
      }
      return el;
    });

    excalidrawAPI.current.updateScene({ elements: updatedElements });
    localElementsRef.current = updatedElements;
    sendMessage(JSON.stringify({ 
      type: "canvas_update", 
      senderId: clientId, 
      elements: updatedElements, 
      appState: excalidrawAPI.current.getAppState() 
    }));
    persistCanvas(updatedElements, excalidrawAPI.current.getAppState(), true);
  }, [clientId, sendMessage, persistCanvas]);

  const handleCanvasChange = useCallback((elements: any, appState: any) => {
    const selectedIds = Object.keys(appState.selectedElementIds);
    if (selectedIds.length === 1) {
      const selectedEl = elements.find((el: any) => el.id === selectedIds[0]);
      if (selectedEl?.customData?.entityId) {
        const entityId = Number(selectedEl.customData.entityId);
        const isRecentlyClosed = lastClosedEntityId.current?.id === entityId && (Date.now() - lastClosedEntityId.current.time < 1500);
        if (!isRecentlyClosed) {
          const entity = activeEntities.find(e => e.id === entityId);
          if (entity && (!selectedEntity || selectedEntity.id !== entity.id)) setSelectedEntity(entity);
        }
      }
    }

    if (isRemoteUpdate.current) return;
    localElementsRef.current = elements;

    if (!isGM) {
      elements.forEach((el: any) => {
        const prev = localElementsRef.current.find(p => p.id === el.id);
        if (prev && (prev.x !== el.x || prev.y !== el.y)) {
          sendMessage(JSON.stringify({ type: "move_proposal", elementId: el.id, x: el.x, y: el.y, originalX: prev.x, originalY: prev.y, senderId: clientId, username: user?.username || "Guest" }));
          el.opacity = 50; 
        }
      });
      return;
    }

    const now = Date.now();
    if (now - lastSyncTime.current > 150) {
      lastSyncTime.current = now;
      sendMessage(JSON.stringify({ 
        type: "canvas_update", senderId: clientId, elements, 
        appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize }
      }));
    }
    persistCanvas(elements, appState);
  }, [sendMessage, clientId, isGM, persistCanvas, user, activeEntities, selectedEntity]);

  const handleLibraryChange = useCallback(async (items: any[]) => {
    if (!isGM || !excalidrawAPI.current) return;
    localStorage.setItem("vtt_library_items", JSON.stringify(items));
    persistCanvas(excalidrawAPI.current.getSceneElements(), excalidrawAPI.current.getAppState());
    try {
      await fetch("http://localhost:8000/save-library", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ libraryItems: items })
      });
    } catch (e) { console.error("[Library] FS sync failed", e); }
  }, [isGM, persistCanvas, token]);

  const handleStoreMapInLibrary = useCallback(async () => {
    console.log("[ToLib] Button clicked. API available:", !!excalidrawAPI.current, "isGM:", isGM);
    if (!excalidrawAPI.current || !isGM) {
      console.warn("[ToLib] Aborting: API or GM check failed");
      return;
    }

    const elements = excalidrawAPI.current.getSceneElements();
    console.log("[ToLib] Current elements count:", elements.length);
    if (elements.length === 0) {
      console.warn("[ToLib] Aborting: No elements to store");
      return;
    }

    const libraryItem = {
      id: Date.now().toString(),
      status: "published" as const,
      elements: JSON.parse(JSON.stringify(elements)),
      created: Date.now(),
    };

    console.log("[ToLib] Updating Excalidraw library...");
    excalidrawAPI.current.updateLibrary({ libraryItems: [libraryItem], merge: true });
    
    let currentItems = excalidrawAPI.current.getLibraryItems();
    if (currentItems instanceof Promise) currentItems = await currentItems;
    try {
      await fetch("http://localhost:8000/save-library", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ libraryItems: [...(currentItems || []), libraryItem] })
      });
    } catch (e) { console.error(e); }

    setSaveStatus("Map added to Library & FS");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [isGM, token]);

  const [isAnchoring, setIsAnchoring] = useState(false);

  const forceSaveCanvas = async () => {
    if (!excalidrawAPI.current || !isGM || !activeLocation || !token) return;
    setIsAnchoring(true);
    const elements = excalidrawAPI.current.getSceneElements();
    const appState = excalidrawAPI.current.getAppState();
    let libraryItems = excalidrawAPI.current.getLibraryItems();
    if (libraryItems instanceof Promise) libraryItems = await libraryItems;

    try {
      const res = await fetch(`http://localhost:8000/locations/${activeLocation.id}`, { 
        method: 'PATCH', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          canvas_state: { 
            elements, 
            appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize },
            libraryItems
          } 
        }) 
      });
      if (res.ok) setActiveLocation(await res.json());
    } catch (e) { console.error("[Canvas] Failed to force save", e); }
    finally { setIsAnchoring(false); }
  };

  const rollDie = (die: string, label?: string) => {
    const sides = parseInt(die.substring(1));
    const result = Math.floor(Math.random() * sides) + 1;
    const content = `${label ? `${die} (${label})` : die}: ${result}${isSubtleMode ? ' (Subtle)' : ''}`;
    if (activeCampaign && token) {
      fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          event_type: 'dice_roll', 
          content: `${user?.username || 'Guest'} rolled ${content}`, 
          campaign_id: activeCampaign.id,
          is_private: isSubtleMode 
        }) 
      }).then(res => res.json()).then(savedLog => {
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
    <div className={`flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none transition-all duration-300 ${(vfxRoll?.isCrit || vfxRoll?.isFail) ? 'animate-big-shake' : vfxRoll ? 'animate-shake' : ''}`}>
      {isDashboardOpen && <WorldDashboard campaignId={activeCampaign.id} onClose={() => setIsDashboardOpen(false)} onSetActive={(loc) => { setActiveLocation(loc); sendMessage(JSON.stringify({ type: "location_update", location: loc, senderId: clientId })); sendMessage(JSON.stringify({ type: "entities_update", locationId: loc.id, senderId: clientId })); }} activeLocationId={activeLocation?.id} />}
      
      {saveStatus && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600/90 backdrop-blur-md px-6 py-2 rounded-full border border-indigo-400/30 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          {saveStatus}
        </div>
      )}

      {selectedEntity && (
        <NPCDetailCard 
          entity={selectedEntity} 
          isGM={isGM} 
          onClose={() => {
            if (!selectedEntity) return;
            if (excalidrawAPI.current) excalidrawAPI.current.updateScene({ appState: { ...excalidrawAPI.current.getAppState(), selectedElementIds: {} } });
            lastClosedEntityId.current = { id: selectedEntity.id, time: Date.now() };
            setSelectedEntity(null);
          }} 
          onUpdateStats={async (id, upd) => {
            const current = activeEntities.find(e => e.id === id);
            if (!current) return;
            const res = await fetch(`http://localhost:8000/entities/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ stats: { ...current.stats, ...upd } }) });
            if (res.ok) { sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation?.id, senderId: clientId })); fetchEntities(activeLocation?.id || 0); }
          }} 
          onUpdateEntity={async (id, upd) => {
            const res = await fetch(`http://localhost:8000/entities/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(upd) });
            if (res.ok) { sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation?.id, senderId: clientId })); fetchEntities(activeLocation?.id || 0); }
          }} 
          onRoll={(name, lbl, bonus) => {
            const res = Math.floor(Math.random() * 20) + 1;
            if (activeCampaign && token) fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/history`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'dice_roll', content: `${name} rolled d20 (${lbl}): ${res + (bonus||0)}${isSubtleMode ? ' (Subtle)' : ''}`, campaign_id: activeCampaign.id }) }).then(r => r.json()).then(saved => sendMessage(JSON.stringify({ id: saved.id.toString(), type: 'roll', die: 'd20', result: res + (bonus||0), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSubtle: isSubtleMode, user: name, senderId: clientId })));
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
            <HandoutItem handout={h} isGM={isGM} onDelete={async (id) => { if (!isGM) return; const res = await fetch(`http://localhost:8000/handouts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { sendMessage(JSON.stringify({ type: "handouts_update", senderId: clientId })); fetchHandouts(); } }} onMove={async (id, x, y) => { if (!isGM) return; const res = await fetch(`http://localhost:8000/handouts/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }); if (res.ok) sendMessage(JSON.stringify({ type: "handouts_update", senderId: clientId })); }} />
          </div>
        ))}
      </div>

      <button onClick={() => setLeftSidebarOpen(!leftSidebarOpen)} className={`fixed bottom-8 left-8 z-[60] p-4 glass-panel rounded-2xl text-gray-400 hover:text-indigo-400 transition-all shadow-xl border border-white/5 active:scale-95 ${!leftSidebarOpen ? 'translate-x-0' : 'translate-x-[340px]'}`}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{leftSidebarOpen ? <polyline points="15 18 9 12 15 6"></polyline> : <polyline points="9 18 15 12 9 6"></polyline>}</svg></button>
      <button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className={`fixed bottom-8 right-8 z-[60] p-4 glass-panel rounded-2xl text-gray-400 hover:text-indigo-400 transition-all shadow-xl border border-white/5 active:scale-95 ${!rightSidebarOpen ? 'translate-x-0' : 'translate-x-[-320px]'}`}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{rightSidebarOpen ? <polyline points="9 18 15 12 9 6"></polyline> : <polyline points="15 18 9 12 15 6"></polyline>}</svg></button>

      {leftSidebarOpen && <ChronicleSidebar isConnected={isConnected} onLogout={logout} onLeave={() => setActiveCampaign(null)} rollRequirement={rollRequirement} isGM={isGM} onRoll={rollDie} history={history} isSubtleMode={isSubtleMode} setIsSubtleMode={setIsSubtleMode} onConsumeHistory={handleConsumeHistory} />}

      <main className="flex-1 h-full min-w-0 bg-[#121212] z-10 overflow-hidden relative">
          {/* 
            Switching to an iframe to leverage Excalidraw's native room persistence and history.
            Note: This breaks the direct integration with AI 'materialize' and 'persist' functions.
            Deriving a 22-character key from the room_id to avoid encryption alerts.
          */}
          <iframe 
            src={`https://excalidraw.com/#room=${activeCampaign.room_id},${(activeCampaign.room_id + "0000000000000000000000").substring(0, 22)}`} 
            className="w-full h-full border-none bg-white"
            title="Excalidraw Canvas"
            allow="clipboard-read; clipboard-write"
          />
      </main>

      {rightSidebarOpen && (
        <GMToolbox 
          isGM={isGM} user={user} isAuthenticated={isAuthenticated} pendingProposals={pendingProposals} onApproveProposal={approveProposal} onRejectProposal={(p) => { sendMessage(JSON.stringify({ type: "move_rejected", targetId: p.senderId, elementId: p.elementId, originalX: p.originalX, originalY: p.originalY })); setPendingProposals(prev => prev.filter(pr => pr.elementId !== p.elementId)); }}
          isRecording={isRecording} onToggleRecording={() => { if(isRecording) { recognitionRef.current?.stop(); setIsIsRecording(false); setInterimTranscript(""); } else { recognitionRef.current?.start(); setIsIsRecording(true); } }}
          activeUsers={activeUsers} onRequestRoll={(targetId, die, lbl) => sendMessage(JSON.stringify({ type: "request_roll", target_id: targetId, die, label: lbl }))}
          onGenerateEnemy={async () => { if (!token || !activeCampaign) return; setIsGenerating(true); try { const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-enemy?location_id=${activeLocation?.id || 1}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); setGeneratedEnemy(await res.json()); } catch (e) { console.error(e); } finally { setIsGenerating(false); } }} 
          onGenerateLore={async () => { if (!token || !activeCampaign) return; setIsGenerating(true); try { const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/generate-lore?location_id=${activeLocation?.id || 1}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); setGeneratedLore((await res.json()).lore); } catch (e) { console.error(e); } finally { setIsGenerating(false); } }} 
          isGenerating={isGenerating} generatedEnemy={generatedEnemy} generatedLore={generatedLore}
          onManifestEntity={async () => { if (!generatedEnemy || !token || !activeLocation) return; const res = await fetch(`http://localhost:8000/entities`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: generatedEnemy.name, location_id: activeLocation.id, stats: generatedEnemy.stats, backstory: generatedEnemy.backstory }) }); if (res.ok) { setGeneratedEnemy(null); sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation.id, senderId: clientId })); fetchEntities(activeLocation.id); } }} 
          activeEntities={activeEntities} onSelectEntity={setSelectedEntity} activeLocation={activeLocation} activeCampaign={activeCampaign}
          onOpenDashboard={() => setIsDashboardOpen(true)} playerClass={playerClass} playerLevel={playerLevel} isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile}
          setPlayerClass={setPlayerClass} setPlayerLevel={setPlayerLevel} onUpdateProfile={async () => { if (!token) return; const res = await fetch('http://localhost:8000/users/me', { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ class_name: playerClass, level: playerLevel }) }); if (res.ok) { setIsEditingProfile(false); sendMessage(JSON.stringify({ type: "user_update", class_name: playerClass, level: playerLevel })); } }}
          onSummarize={async () => { if (!token || !activeCampaign) return; setIsSummarizing(true); try { const res = await fetch(`http://localhost:8000/campaigns/${activeCampaign.id}/summarize`, { headers: { 'Authorization': `Bearer ${token}` } }); setCampaignSummary((await res.json()).summary); } catch (e) { console.error(e); } finally { setIsSummarizing(false); } }} 
          isSummarizing={isSummarizing}
          onClearHistory={handleClearHistory}
          onManifestLore={async (c) => { if (!token || !activeCampaign) return; const res = await fetch(`http://localhost:8000/handouts`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: "Whispered Lore", content: c, type: "text", campaign_id: activeCampaign.id, x: 400, y: 300 }) }); if (res.ok) { sendMessage(JSON.stringify({ type: "handouts_update", senderId: clientId })); fetchHandouts(); setGeneratedLore(null); } }}
          onDismissEnemy={() => setGeneratedEnemy(null)}
          onDismissLore={() => setGeneratedLore(null)}
          onUpdateGeneratedEnemy={setGeneratedEnemy}
          onUpdateGeneratedLore={setGeneratedLore}
          onBindEntity={handleBindEntity}
          onForceSaveCanvas={forceSaveCanvas}
          onStoreMap={handleStoreMapInLibrary}
          isAnchoring={isAnchoring}
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

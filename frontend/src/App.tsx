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
import GlassLayer from "./components/Overlay/GlassLayer";
import AmbientPlayer from "./components/Overlay/AmbientPlayer";
import InitiativeTracker from "./components/Overlay/InitiativeTracker";
import AccountLogin from "./components/Overlay/AccountLogin";
import FateSpinner from "./components/Overlay/FateSpinner";
import type { HistoryItem, UserPresence, MoveProposal, EnemyData, Location, Entity, Campaign, Handout, Ping } from "./types/vtt";
import { resolveConfig, currentConfig } from "./config";

function VTTApp() {
  const { user, isAuthenticated, logout, isGM, token, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isConfiguring, setIsConfiguring] = useState(true);

  useEffect(() => {
    resolveConfig().then(() => setIsConfiguring(false));
  }, []);
  
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(() => {
    try {
      const saved = localStorage.getItem("vtt_active_campaign");
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLocation, setActiveLocation] = useState<Location | null>(() => {
    try {
      const saved = localStorage.getItem("vtt_active_location");
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const clientId = useMemo(() => {
    let cid = user?.discord_id;
    if (!cid) {
      cid = localStorage.getItem("vtt_guest_id");
      if (!cid) {
        cid = "guest_" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem("vtt_guest_id", cid);
      }
    }
    return cid;
  }, [user?.discord_id]);

  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    activeCampaign ? `${currentConfig.WS_BASE}/ws/${activeCampaign.room_id}/${clientId}?role=${isGM ? 'gm' : 'player'}&username=${user?.username || 'Guest'}` : ''
  );

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [activeEntities, setActiveEntities] = useState<Entity[]>([]);
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(!isMobile);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(!isMobile);
  
  const processedMessages = useRef<Set<string>>(new Set());
  const [playerClass, setPlayerClass] = useState(user?.class_name || "");
  const [playerLevel, setPlayerLevel] = useState(user?.level || 1);
  const [playerStats, setPlayerStats] = useState<Record<string, number>>(user?.stats || { hp: 10, ac: 10, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const [playerInventory, setPlayerInventory] = useState(user?.inventory || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [vfxRoll, setVfxRoll] = useState<{ id: string, result: number, isCrit: boolean, isFail: boolean } | null>(null);
  const [vfxTrigger, setVfxTrigger] = useState<{ type: 'cheer' | 'boo', timestamp: number } | null>(null);
  const [luckModifier, setLuckModifier] = useState(0);

  useEffect(() => {
    if (vfxTrigger) {
      const timer = setTimeout(() => setVfxTrigger(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [vfxTrigger]);
  const [campaignSummary, setCampaignSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const handleArchiveSummary = async () => {
    if (!campaignSummary || !activeCampaign || !token) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            event_type: 'lore_update', 
            content: `SESSION RECAP: ${campaignSummary}`, 
            campaign_id: activeCampaign.id,
            is_private: false
        })
      });
      if (res.ok) {
        setCampaignSummary(null);
        fetchHistory();
        sendMessage(JSON.stringify({ type: "history_updated" }));
      }
    } catch (e) { console.error(e); }
  };
  const [showSpinner, setShowSpinner] = useState(false);
  const [targetScene, setTargetScene] = useState<string>("main"); // For GM projection
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSubtleMode, setIsSubtleMode] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [rollRequirement, setRollRequirement] = useState<{die: string, label: string} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEnemy, setGeneratedEnemy] = useState<EnemyData | null>(null);
  const [generatedLore, setGeneratedLore] = useState<string | null>(null);
  const [generatedLoot, setGeneratedLoot] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [streamImage, setStreamImage] = useState<string | null>(null);
  const [streamAspectRatio, setStreamAspectRatio] = useState<number | null>(null);
  const [spinnerData, setSpinnerState] = useState<{ options: string[], resultIndex: number } | null>(null);
  const [hitZones, setHitZones] = useState<any[]>([]);
  const [pings, setPings] = useState<any[]>([]);
  const [audioChannels, setAudioChannels] = useState<{id: string, url: string | null, volume: number}[]>([
    { id: 'Atmosphere', url: null, volume: 0.5 },
    { id: 'Music', url: null, volume: 0.5 }
  ]);
  const [combatants, setCombatants] = useState<any[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [customForge, setCustomForge] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("vtt_custom_forge");
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    localStorage.setItem("vtt_custom_forge", JSON.stringify(customForge));
  }, [customForge]);

  const excalidrawRoomUrl = useMemo(() => {
    if (!activeCampaign) return "";
    // Excalidraw expects a 20-char room ID and a 22-char key
    // We create a stable but long enough seed from our room_id
    const seed = activeCampaign.room_id.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const longSeed = (seed + seed + seed + seed + "VTTMASTER").substring(0, 32);
    
    const room = longSeed.substring(0, 20);
    const key = longSeed.substring(0, 22);
    
    const url = `https://excalidraw.com/#room=${room},${key}`;
    console.log("[Excalidraw] Generated URL:", url);
    return url;
  }, [activeCampaign?.room_id]);

  const fetchHistory = useCallback(() => {
    if (!activeCampaign || !token) return;
    fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(data => {
        if (Array.isArray(data)) {
          const formatted = data.map((item: any) => ({ id: item.id.toString(), type: item.event_type === 'dice_roll' ? 'roll' : (item.event_type === 'lore_update' ? 'ai' : 'story'), content: item.content, user: "Chronicle", timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSubtle: item.is_private }));
          setHistory(formatted);
        }
      }).catch(err => console.error(err));
  }, [activeCampaign, token]);

  const handleConsumeHistory = useCallback(async (logId: string) => {
    if (!token || !activeCampaign) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history/${logId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        sendMessage(JSON.stringify({ type: "history_updated", campaignId: activeCampaign.id }));
        fetchHistory();
      }
    } catch (e) { console.error(e); }
  }, [token, activeCampaign, fetchHistory, sendMessage]);

  const handleClearHistory = useCallback(async () => {
    if (!isGM || !token || !activeCampaign || !window.confirm("Clear entire chronicle history?")) return;
    try { sendMessage(JSON.stringify({ type: "history_cleared" })); setHistory([]); } catch (e) { console.error(e); }
  }, [isGM, token, activeCampaign, sendMessage]);

  const handlePing = useCallback((x: number, y: number) => {
    const ping: Ping = {
      id: `ping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      color: isGM ? '#818cf8' : '#fb7185', // Indigo for GM, Rose for Players
      username: user?.username || 'Guest',
      timestamp: Date.now()
    };
    sendMessage(JSON.stringify({ type: 'player_ping', ...ping }));
    // Optimistic update
    setPings(prev => [...prev, ping]);
  }, [isGM, user, sendMessage]);

  const handleUpdateFog = useCallback(async (zones: any[]) => {
    if (!isGM || !activeLocation || !token) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/locations/${activeLocation.id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fog_data: zones }) });
      if (res.ok) {
        const updated = { ...activeLocation, fog_data: zones };
        setActiveLocation(updated);
        sendMessage(JSON.stringify({ type: "location_update", location: updated, senderId: clientId }));
      }
    } catch (e) { console.error(e); }
  }, [isGM, activeLocation, token, clientId, sendMessage]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPings(prev => prev.filter(p => now - p.timestamp < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchEntities = useCallback(async (locId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/locations/${locId}/entities`);
      if (res.ok) {
        const data = await res.json();
        setActiveEntities(data);
        setSelectedEntity(prev => {
          if (!prev) return null;
          return data.find((e: Entity) => e.id === prev.id) || prev;
        });
      }
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchHandouts = useCallback(async () => {
    if (!activeCampaign || !token) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/handouts`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setHandouts(await res.json());
    } catch (e) { console.error(e); }
  }, [activeCampaign, token]);

  const rollDie = useCallback((die: string, label?: string) => {
    const sides = parseInt(die.substring(1));
    const result = Math.floor(Math.random() * sides) + 1;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = `${label ? `${die} (${label})` : die}: ${result}${isSubtleMode ? ' (Subtle)' : ''}`;
    
    if (activeCampaign && token) {
      fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'dice_roll', content: `${user?.username || 'Guest'} rolled ${content}`, campaign_id: activeCampaign.id, is_private: isSubtleMode }) })
      .then(r => r.json()).then(saved => {
        sendMessage(JSON.stringify({ id: saved.id.toString(), type: 'roll', die, result, timestamp, isSubtle: isSubtleMode, user: user?.username || "Guest", senderId: clientId, unique_key: Date.now() }));
      }).catch(() => { sendMessage(JSON.stringify({ id: `fallback-${Date.now()}`, type: 'roll', die, result, timestamp, isSubtle: isSubtleMode, user: user?.username || "Guest", senderId: clientId, unique_key: Date.now() })); });
    }
  }, [activeCampaign, token, user, isSubtleMode, clientId, sendMessage]);

  useEffect(() => {
    const check = async () => {
      try { const res = await fetch(`${currentConfig.API_BASE}/health`); setBackendOnline(res.ok); } catch (e) { setBackendOnline(false); }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeCampaign) localStorage.setItem("vtt_active_campaign", JSON.stringify(activeCampaign));
    else localStorage.removeItem("vtt_active_campaign");
  }, [activeCampaign]);

  useEffect(() => {
    if (activeLocation) {
      localStorage.setItem("vtt_active_location", JSON.stringify(activeLocation));
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: "VTT_BRIDGE_MOVE", x: activeLocation.x, y: activeLocation.y, zoom: activeLocation.zoom }, "*");
      }
    }
    else localStorage.removeItem("vtt_active_location");
  }, [activeLocation]);

  useEffect(() => {
    if (activeCampaign?.id) setIframeKey(prev => prev + 1);
  }, [activeCampaign?.id]);

  useEffect(() => {
    if (!isGM) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "VTT_BRIDGE_CAPTURE_RESULT") {
        window.dispatchEvent(new CustomEvent("VTT_CAMERA_CAPTURED", { detail: event.data }));
      }
      if (event.data.type === "VTT_BRIDGE_STREAM_RESULT") {
        sendMessage(JSON.stringify({ 
          type: "canvas_stream", 
          image: event.data.image, 
          hitZones: event.data.hitZones,
          timestamp: Date.now(),
          scene_id: targetScene // Consistently use scene_id
        }));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isGM, sendMessage, targetScene, customForge.length]); // targetScene is critical here

  useEffect(() => {
    if (!isGM || !activeCampaign) return;
    const interval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: "VTT_BRIDGE_STREAM_REQUEST" }, "*");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isGM, activeCampaign]);

  useEffect(() => {
    const path = location.pathname;
    if (path.includes("entity:")) {
      const entityId = parseInt(path.split("entity:")[1]);
      const entity = activeEntities.find(e => e.id === entityId);
      if (entity) { setSelectedEntity(entity); navigate("/", { replace: true }); }
    }
  }, [location.pathname, activeEntities, navigate]);

  const fetchLocations = useCallback(async () => {
    if (!activeCampaign || !token) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/locations`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setLocations(data);
        // Also auto-select the current one if not set
        if (data.length > 0 && !activeLocation) {
            setActiveLocation(data.find((l: any) => l.id === activeLocation?.id) || data[0]);
        }
      }
    } catch (e) { console.error(e); }
  }, [activeCampaign, token, activeLocation?.id]);

  useEffect(() => {
    if (activeCampaign && token) { 
        fetchHistory(); 
        fetchHandouts(); 
        fetchLocations();
    }
  }, [activeCampaign, token]); // Remove fetchLocations from deps to avoid loop if using activeLocation

  useEffect(() => { if (activeLocation && token) fetchEntities(activeLocation.id); }, [activeLocation?.id, token, fetchEntities]);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        const msgId = data.id || `${data.type}-${data.timestamp}-${data.unique_key || ''}`;
        if (processedMessages.current.has(msgId)) return;
        processedMessages.current.add(msgId);
        if (data.type === "presence") setActiveUsers(data.users);
        else if (data.type === "location_update") {
          const myUser = data.users?.find((u: any) => u.id === clientId) || activeUsers.find(u => u.id === clientId);
          const myScene = myUser?.scene_id || "main";
          const targetSid = data.scene_id || data.target_scene;
          if (data.global || !targetSid || targetSid === myScene || isGM) {
            setActiveLocation(data.location);
            // Sync Atmosphere channel automatically
            setAudioChannels(prev => prev.map(c => 
              c.id === 'Atmosphere' ? { ...c, url: data.location.ambient_audio || null } : c
            ));
          }
        }
        else if (data.type === "entities_update") {
 if (activeLocation?.id === data.locationId) fetchEntities(data.locationId); }
        else if (data.type === "history_updated") { fetchHistory(); }
        else if (data.type === "handouts_update") { fetchHandouts(); }
        else if (data.type === "spinner_trigger") {
          setSpinnerState({ options: data.options, resultIndex: data.resultIndex });
        }
        else if (data.type === "canvas_stream") { 
          const myUser = data.users?.find((u: any) => u.id === clientId) || activeUsers.find(u => u.id === clientId);
          const myScene = myUser?.scene_id || "main";
          const targetSid = data.scene_id || data.target_scene;
          if (!targetSid || targetSid === myScene || isGM) {
            setStreamImage(data.image); 
            if (data.hitZones) setHitZones(data.hitZones);
          }
        }
        else if (data.type === "player_ping") {
          setPings(prev => {
            if (prev.some(p => p.id === data.id)) return prev;
            return [...prev, { ...data, timestamp: data.timestamp || Date.now() }];
          });
        }
        else if (data.type === "initiative_update") {
          setCombatants(data.combatants || []);
          setCurrentTurn(data.currentTurn || 0);
        }
        else if (data.type === "whisper") {
          const isFromMe = data.senderId === clientId;
          const targetName = activeUsers.find(u => u.id === data.target_id)?.username || "Unknown";
          setHistory(prev => [{ 
            id: data.id, 
            type: 'story' as const, 
            content: `${isFromMe ? `Whisper to ${targetName}` : `Whisper from ${data.user}`}: ${data.content}`, 
            user: data.user, 
            timestamp: data.timestamp,
            isSubtle: true // Whispers are always private
          }, ...prev].slice(0, 100));
        }
        else if (data.type === "vfx_trigger") {
            if (data.vfxType === 'sound' && data.soundUrl && data.senderId !== clientId) {
                const audio = new Audio(data.soundUrl);
                audio.play().catch(e => console.warn("Auto-play blocked", e));
            } else {
                setVfxTrigger({ type: data.vfxType, timestamp: Date.now() });
            }
        }
        else if (data.type === "luck_update") {
            setLuckModifier(data.modifier);
        }
        else if (data.type === 'story' || (data.result && data.die)) {
          if (data.result && data.die && !data.isSubtle) { const isD20 = data.die.includes('d20'); setVfxRoll({ id: data.id || Math.random().toString(), result: data.result, isCrit: data.result === 20 && isD20, isFail: data.result === 1 && isD20 }); setTimeout(() => setVfxRoll(null), 800); }
          setHistory(prev => [{ id: data.id, type: 'roll' as const, content: `${data.die}: ${data.result}`, user: data.user, timestamp: data.timestamp, isSubtle: data.isSubtle }, ...prev].slice(0, 100));
        }
      } catch (e) {}
    }
  }, [lastMessage, activeLocation?.id, fetchEntities, fetchHistory, activeUsers, clientId, isGM]); // Crucial dependencies for scene-aware logic

  const handleAddToInitiative = useCallback((name: string, isPlayer: boolean) => {
    if (!isGM) return;
    const initiative = Math.floor(Math.random() * 20) + 1;
    sendMessage(JSON.stringify({ 
      type: 'join_initiative', 
      id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name, 
      initiative, 
      isPlayer 
    }));
  }, [isGM, sendMessage]);

  const handleInsertElements = useCallback((elements: any[]) => {
    if (!isGM || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      type: "VTT_INTERNAL_INJECTED_REQUEST",
      subType: "INSERT",
      payload: { elements }
    }, "*");
  }, [isGM]);

  const handleJoinInitiative = useCallback(() => {
    const initiative = Math.floor(Math.random() * 20) + 1;
    sendMessage(JSON.stringify({ 
      type: 'join_initiative', 
      id: clientId,
      name: user?.username || 'Guest', 
      initiative, 
      isPlayer: true 
    }));
  }, [clientId, user, sendMessage]);

  const handleClaimLoot = useCallback(async (id: number, content: string) => {
    if (isGM || !token) return;
    const newInventory = playerInventory ? `${playerInventory}, ${content}` : content;
    setPlayerInventory(newInventory);
    try {
      const res = await fetch(`${currentConfig.API_BASE}/users/me`, { 
        method: 'PATCH', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ inventory: newInventory }) 
      });
      if (res.ok) {
        await fetch(`${currentConfig.API_BASE}/handouts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        sendMessage(JSON.stringify({ type: "handouts_update" }));
        sendMessage(JSON.stringify({ type: "user_update", inventory: newInventory }));
        fetchHandouts();
        alert(`Looted: ${content}`);
      }
    } catch (e) { console.error(e); }
  }, [isGM, token, playerInventory, sendMessage, fetchHandouts]);

  const handlePromote = useCallback(async (key: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/auth/promote`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key })
      });
      if (res.ok) {
        const data = await res.json();
        login(data.token, data.user);
        alert("Elevation successful. You are now a Master.");
      } else {
        const err = await res.json();
        alert("Elevation failed: " + (err.detail || "Invalid Key"));
      }
    } catch (e) { console.error(e); }
  }, [token, login]);

  const handleUpdateAudioVolume = useCallback((id: string, volume: number) => {
    setAudioChannels(prev => prev.map(c => c.id === id ? { ...c, volume } : c));
  }, []);

  if (isConfiguring) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans text-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-t-indigo-500 border-gray-800 animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Synchronizing Reality...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AccountLogin onLogin={login} onGuest={() => { setIsLoggingIn(true); fetch(`${currentConfig.API_BASE}/auth/guest`).then(r => r.json()).then(d => login(d.token, d.user)).catch(() => alert(`Backend unreachable at ${currentConfig.API_BASE}`)).finally(() => setIsLoggingIn(false)); }} isLoggingIn={isLoggingIn} backendOnline={backendOnline} />;
  }

  if (!activeCampaign) return <SetupScreen onJoin={(id, roomId, campaign) => setActiveCampaign({id, room_id: roomId, canvas_state: campaign?.canvas_state})} />;

  return (
    <div className={`flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none transition-all duration-300 ${(vfxRoll?.isCrit || vfxRoll?.isFail) ? 'animate-big-shake' : vfxRoll ? 'animate-shake' : ''}`}>
      {isDashboardOpen && <WorldDashboard 
        campaignId={activeCampaign.id} 
        onClose={() => {
            setIsDashboardOpen(false);
            fetchLocations(); // Refresh when closing manifest
        }} 
        currentTargetScene={targetScene} 
        onSetActive={(loc, sid) => { 
            if (sid === "global") {
                setActiveLocation(loc); 
                setTargetScene("main"); 
                sendMessage(JSON.stringify({ type: "location_update", location: loc, global: true })); 
            } else {
                if (sid === targetScene) setActiveLocation(loc);
                else setTargetScene(sid);
                sendMessage(JSON.stringify({ type: "location_update", location: loc, scene_id: sid })); 
            }
        }} 
        activeLocationId={activeLocation?.id} 
      />}
      
      {spinnerData && (
        <FateSpinner 
          options={spinnerData.options} 
          resultIndex={spinnerData.resultIndex} 
          onFinished={() => setSpinnerState(null)} 
        />
      )}

      {campaignSummary && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-500">
          <div className="bg-gray-900 border border-indigo-500/30 w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden relative">
            <div className="p-10 border-b border-gray-800 bg-indigo-900/10 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter uppercase italic text-gray-100">The Bard's Recap</h2>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.3em] mt-1">Chronicle of the Infinite</p>
                </div>
                <button onClick={() => setCampaignSummary(null)} className="p-3 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-gray-950/50">
                <div className="prose prose-invert max-w-none">
                    {campaignSummary.split('\n').map((para, i) => (
                        <p key={i} className="text-gray-300 leading-relaxed italic text-lg mb-6 last:mb-0 first-letter:text-4xl first-letter:font-black first-letter:text-indigo-500 first-letter:mr-1 first-letter:float-left">
                            {para}
                        </p>
                    ))}
                </div>
            </div>
            <div className="p-10 bg-gray-900/80 border-t border-gray-800 flex gap-4">
                {isGM && (
                    <button 
                        onClick={handleArchiveSummary}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95"
                    >
                        Archive to Chronicle
                    </button>
                )}
                <button 
                    onClick={() => setCampaignSummary(null)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all active:scale-95 border border-gray-700"
                >
                    Dismiss Recap
                </button>
            </div>
          </div>
        </div>
      )}

      {selectedEntity && (
        <NPCDetailCard entity={selectedEntity} isGM={isGM} onClose={() => setSelectedEntity(null)} onUpdateStats={async (id, upd) => {
            const current = activeEntities.find(e => e.id === id); if (!current) return;
            const res = await fetch(`${currentConfig.API_BASE}/entities/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ stats: { ...current.stats, ...upd } }) });
            if (res.ok) { sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation?.id, senderId: clientId })); fetchEntities(activeLocation?.id || 0); }
          }} 
          onUpdateEntity={async (id, upd) => {
            const res = await fetch(`${currentConfig.API_BASE}/entities/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(upd) });
            if (res.ok) { sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation?.id, senderId: clientId })); fetchEntities(activeLocation?.id || 0); }
          }} 
          onRoll={(name, lbl, bonus) => {
            const res = Math.floor(Math.random() * 20) + 1;
            const content = `${name} rolled d20 (${lbl}): ${res + (bonus||0)}${isSubtleMode ? ' (Subtle)' : ''}`;
            if (activeCampaign && token) {
                fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'dice_roll', content, campaign_id: activeCampaign.id, is_private: isSubtleMode }) }).then(r => r.json()).then(saved => {
                    sendMessage(JSON.stringify({ id: saved.id.toString(), type: 'roll', die: 'd20', result: res + (bonus||0), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSubtle: isSubtleMode, user: name, senderId: clientId }));
                });
            }
          }} 
          onAddToInitiative={handleAddToInitiative}
        />
      )}

      {vfxRoll && (
        <div className="fixed inset-0 z-[150] pointer-events-none flex flex-col items-center justify-center animate-in fade-in zoom-in-125 duration-300">
          <div className={`text-[8rem] font-black italic tracking-tighter opacity-20 ${vfxRoll.isCrit ? 'text-indigo-400' : vfxRoll.isFail ? 'text-red-500' : 'text-gray-400'}`}>{vfxRoll.result}</div>
          {vfxRoll.isCrit && <div className="text-2xl font-black text-indigo-400 uppercase tracking-[0.5em] animate-bounce">Critical Success</div>}
          {vfxRoll.isFail && <div className="text-2xl font-black text-red-500 uppercase tracking-[0.5em] animate-pulse">Critical Failure</div>}
        </div>
      )}

      <InitiativeTracker 
        combatants={combatants} 
        currentTurnIndex={currentTurn} 
        isGM={isGM} 
        isPlayerInInitiative={combatants.some(c => c.id === clientId)}
        onAction={(action) => {
          if (action.type === 'join') {
            handleJoinInitiative();
          } else {
            sendMessage(JSON.stringify(action));
          }
        }} 
      />

      <div className="fixed inset-0 pointer-events-none z-40">
        {handouts.map(h => (
          <div key={h.id} className="pointer-events-auto">
            <HandoutItem handout={h} isGM={isGM} onDelete={async (id) => { if (!isGM) return; const res = await fetch(`${currentConfig.API_BASE}/handouts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { fetchHandouts(); } }} onMove={async (id, x, y) => { if (!isGM) return; await fetch(`${currentConfig.API_BASE}/handouts/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }); }} />
          </div>
        ))}
      </div>

      <button onClick={() => setLeftSidebarOpen(!leftSidebarOpen)} className={`fixed bottom-4 md:bottom-8 left-4 md:left-8 z-[60] p-3 md:p-4 glass-panel rounded-2xl text-gray-400 hover:text-indigo-400 transition-all shadow-xl border border-white/5 active:scale-95 ${!leftSidebarOpen ? 'translate-x-0' : 'translate-x-[80vw] md:translate-x-[340px]'}`}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{leftSidebarOpen ? <polyline points="15 18 9 12 15 6"></polyline> : <polyline points="9 18 15 12 9 6"></polyline>}</svg></button>
      <button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className={`fixed bottom-4 md:bottom-8 right-4 md:right-8 z-[60] p-3 md:p-4 glass-panel rounded-2xl text-gray-400 hover:text-indigo-400 transition-all shadow-xl border border-white/5 active:scale-95 ${!rightSidebarOpen ? 'translate-x-0' : '-translate-x-[80vw] md:-translate-x-[320px]'}`}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{rightSidebarOpen ? <polyline points="9 18 15 12 9 6"></polyline> : <polyline points="15 18 9 12 15 6"></polyline>}</svg></button>

      {leftSidebarOpen && <ChronicleSidebar 
        isConnected={isConnected} 
        onLogout={logout} 
        onLeave={() => setActiveCampaign(null)} 
        rollRequirement={rollRequirement} 
        isGM={isGM} 
        onRoll={rollDie} 
        history={history} 
        isSubtleMode={isSubtleMode} 
        setIsSubtleMode={setIsSubtleMode} 
        onConsumeHistory={handleConsumeHistory} 
        onDraftResponse={(c) => {
            setGeneratedLore(c);
            setRightSidebarOpen(true);
        }}
        onVfx={(type) => sendMessage(JSON.stringify({ type: 'vfx_trigger', vfxType: type, global: true }))}
        luckModifier={luckModifier}
        activeUsers={activeUsers} 
        currentScene={activeUsers.find(u => u.id === clientId)?.scene_id || "main"}
        onWhisper={(targetId, msg) => sendMessage(JSON.stringify({ type: 'whisper', target_id: targetId, content: msg, user: user?.username || 'Guest', senderId: clientId, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), id: `whisper-${Date.now()}` }))} 
      />}

      <AmbientPlayer channels={audioChannels} onUpdateVolume={handleUpdateAudioVolume} />

      {vfxTrigger && (
        <div className="fixed inset-0 pointer-events-none z-[200] flex items-center justify-center overflow-hidden">
          <div 
            key={vfxTrigger.timestamp}
            className={`w-40 h-40 rounded-full border-8 animate-ripple absolute ${vfxTrigger.type === 'cheer' ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}
          />
          <div className="relative flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <span className="text-8xl mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">{vfxTrigger.type === 'cheer' ? '✨' : '💀'}</span>
            <span className={`text-6xl font-black uppercase tracking-[0.3em] italic drop-shadow-2xl ${vfxTrigger.type === 'cheer' ? 'text-green-400' : 'text-red-500'}`}>{vfxTrigger.type === 'cheer' ? 'HUZZAH!' : 'DOOM!'}</span>
          </div>
        </div>
      )}

      <main className="flex-1 h-full min-w-0 bg-[#121212] z-10 overflow-hidden relative">
          {isGM ? (
            <div className="w-full h-full relative">
              <iframe 
                key={iframeKey}
                ref={iframeRef}
                src={excalidrawRoomUrl} 
                className="w-full h-full border-none bg-white block"
                style={{ width: '100%', height: '100%', minHeight: '100vh' }}
                title="Excalidraw Canvas"
                allow="clipboard-read; clipboard-write; storage-access"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <GlassLayer onPing={handlePing} pings={pings} isGM={isGM} isFogActive={activeLocation?.is_fog_active || false} fogZones={activeLocation?.fog_data || []} mapScale={activeLocation?.map_scale} onUpdateFog={handleUpdateFog} />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] relative overflow-hidden">
              {streamImage ? (
                <div className="relative inline-block max-w-full max-h-full pointer-events-none">
                  <img src={streamImage} alt="GM Canvas Stream" className="max-w-full max-h-full object-contain pointer-events-none block" />
                  <div className="absolute inset-0 pointer-events-none">
                    <GlassLayer onPing={handlePing} pings={pings} isGM={isGM} isFogActive={activeLocation?.is_fog_active || false} fogZones={activeLocation?.fog_data || []} mapScale={activeLocation?.map_scale} />
                    {hitZones.map((zone, idx) => {
                      const entity = activeEntities.find(e => e.id.toString() === zone.id.toString());
                      return (
                        <button
                          key={idx}
                          onClick={() => entity && setSelectedEntity(entity)}
                          onMouseEnter={(e) => {
                              const tooltip = e.currentTarget.querySelector('.vtt-tooltip');
                              if (tooltip) (tooltip as HTMLElement).style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                              const tooltip = e.currentTarget.querySelector('.vtt-tooltip');
                              if (tooltip) (tooltip as HTMLElement).style.opacity = '0';
                          }}
                          className="absolute pointer-events-auto group"
                          style={{
                            left: `${zone.left}%`,
                            top: `${zone.top}%`,
                            width: `${zone.width}%`,
                            height: `${zone.height}%`,
                            background: 'transparent',
                            border: '1px solid transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <div className="vtt-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-500/30 whitespace-nowrap opacity-0 transition-opacity pointer-events-none shadow-xl shadow-black/50">
                              {entity?.name || "Unknown Soul"}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-indigo-500/30"></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 font-bold uppercase tracking-widest animate-pulse">Awaiting GM Vision...</div>
              )}
            </div>
          )}
      </main>

      {rightSidebarOpen && (
        <GMToolbox 
          isGM={isGM} user={user} isAuthenticated={isAuthenticated} pendingProposals={[]} onApproveProposal={()=>{}} onRejectProposal={()=>{}}
          isRecording={false} onToggleRecording={()=>{}}
          activeUsers={activeUsers} onRequestRoll={(targetId, die, lbl) => sendMessage(JSON.stringify({ type: "request_roll", target_id: targetId, die, label: lbl }))}
          onWhisper={(targetId, msg) => sendMessage(JSON.stringify({ type: 'whisper', target_id: targetId, content: msg, user: user?.username || 'Guest', senderId: clientId, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), id: `whisper-${Date.now()}` }))}
          onGenerateEnemy={async () => { 
            if (!token || !activeCampaign) return; 
            
            const triggerEnemyGen = async () => {
                setIsGenerating(true); 
                try { 
                  const locId = activeLocation?.id || 1;
                  const url = `${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/generate-enemy?location_id=${locId}`;
                  const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); 
                  setGeneratedEnemy(await res.json()); 
                } catch (e) { alert("AI Generation failed."); } finally { setIsGenerating(false); } 
            };

            if (showSpinner) {
                const options = ["Minion", "Elite", "Boss", "Legendary", "Cursed", "Ancient"];
                const resultIndex = Math.floor(Math.random() * options.length);
                sendMessage(JSON.stringify({ type: 'spinner_trigger', options, resultIndex }));
                // Local optimistic trigger
                setSpinnerState({ options, resultIndex });
                // Delay generation until spin finished (approx 4s + buffer)
                setTimeout(triggerEnemyGen, 5000);
            } else {
                triggerEnemyGen();
            }
          }} 
          onGenerateLore={async () => { 
            if (!token || !activeCampaign) return; 
            setIsGenerating(true); 
            try { 
              const locId = activeLocation?.id || 1;
              const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/generate-lore?location_id=${locId}`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ context: generatedLore }) // Pass current draft as context
              }); 
              setGeneratedLore((await res.json()).lore); 
            } catch (e) { console.error(e); } finally { setIsGenerating(false); } 
          }} 
          isGenerating={isGenerating} generatedEnemy={generatedEnemy} generatedLore={generatedLore}
          onManifestEntity={async () => { 
            if (!activeLocation) { alert("Please create or select a Location in the Dashboard first!"); return; }
            if (!generatedEnemy || !token) return;
            try {
              const res = await fetch(`${currentConfig.API_BASE}/entities`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: generatedEnemy.name, location_id: activeLocation.id, stats: generatedEnemy.stats, backstory: generatedEnemy.backstory }) }); 
              if (res.ok) { setGeneratedEnemy(null); sendMessage(JSON.stringify({ type: "entities_update", locationId: activeLocation.id, senderId: clientId })); fetchEntities(activeLocation.id); } 
              else { const err = await res.json(); alert("Materialization failed: " + (err.detail || "Unknown error")); }
            } catch (e) { alert("Network error."); }
          }} 
          activeEntities={activeEntities} onSelectEntity={setSelectedEntity} activeLocation={activeLocation} activeCampaign={activeCampaign}
          onOpenDashboard={() => setIsDashboardOpen(true)} playerClass={playerClass} playerLevel={playerLevel} playerInventory={playerInventory} 
          playerStats={playerStats} setPlayerStats={setPlayerStats}
          isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile}
          setPlayerClass={setPlayerClass} setPlayerLevel={setPlayerLevel} setPlayerInventory={setPlayerInventory} 
          onUpdateProfile={async () => { 
            if (!token) return; 
            const res = await fetch(`${currentConfig.API_BASE}/users/me`, { 
                method: 'PATCH', 
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ class_name: playerClass, level: playerLevel, inventory: playerInventory, stats: playerStats }) 
            }); 
            if (res.ok) { 
                setIsEditingProfile(false); 
                sendMessage(JSON.stringify({ type: "user_update", class_name: playerClass, level: playerLevel, inventory: playerInventory, stats: playerStats })); 
            } 
          }}
          onSummarize={async () => { if (!token || !activeCampaign) return; setIsSummarizing(true); try { const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/summarize`, { headers: { 'Authorization': `Bearer ${token}` } }); setCampaignSummary((await res.json()).summary); } catch (e) { console.error(e); } finally { setIsSummarizing(false); } }} 
          isSummarizing={isSummarizing}
          onClearHistory={handleClearHistory}
          onMoveToScene={(userId, sceneId) => sendMessage(JSON.stringify({ type: 'move_to_scene', target_id: userId, scene_id: sceneId }))}
          onAddToInitiative={handleAddToInitiative}
          onPromote={handlePromote}
          targetScene={targetScene}
          onSetTargetScene={setTargetScene}
          locations={locations}
          onToggleFog={async () => {
            if (!isGM || !activeLocation || !token) return;
            const newState = !activeLocation.is_fog_active;
            const res = await fetch(`${currentConfig.API_BASE}/locations/${activeLocation.id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ is_fog_active: newState }) });
            if (res.ok) {
                const updated = { ...activeLocation, is_fog_active: newState };
                setActiveLocation(updated);
                sendMessage(JSON.stringify({ type: "location_update", location: updated, senderId: clientId }));
            }
          }}
          onGenerateLoot={async () => {
            if (!token || !activeCampaign) return;
            setIsGenerating(true);
            try {
              const locId = activeLocation?.id || 1;
              const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/generate-loot?location_id=${locId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
              setGeneratedLoot((await res.json()).loot);
            } catch (e) { console.error(e); } finally { setIsGenerating(false); }
          }}
          onManifestLoot={async (c) => { 
            if (!token || !activeCampaign) return; 
            const x = Math.round(300 + Math.random() * 200);
            const y = Math.round(200 + Math.random() * 200);
            try {
              const res = await fetch(`${currentConfig.API_BASE}/handouts`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: "Found Loot", content: c, type: "text", campaign_id: activeCampaign.id, x, y }) }); 
              if (res.ok) { fetchHandouts(); sendMessage(JSON.stringify({ type: "handouts_update" })); setGeneratedLoot(null); } 
              else { 
                const err = await res.json(); 
                const errMsg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
                alert("Loot manifestation failed: " + (errMsg || "Unknown error")); 
              }
            } catch (e) { alert("Network error manifested."); }
          }}
          onDismissLoot={() => setGeneratedLoot(null)}
          generatedLoot={generatedLoot}
          onDismissEnemy={() => setGeneratedEnemy(null)}

          onDismissLore={() => setGeneratedLore(null)}
          showSpinner={showSpinner}
          onToggleSpinner={setShowSpinner}
          onUpdateGeneratedEnemy={(enemy) => setGeneratedEnemy(enemy)}
          onUpdateGeneratedLore={(lore) => setGeneratedLore(lore)}
          onManifestLore={async (c) => { 
            if (!token || !activeCampaign) return; 
            const x = Math.round(200 + Math.random() * 200);
            const y = Math.round(150 + Math.random() * 200);
            try {
              const res = await fetch(`${currentConfig.API_BASE}/handouts`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: "Whispered Lore", content: c, type: "text", campaign_id: activeCampaign.id, x, y }) }); 
              if (res.ok) { fetchHandouts(); sendMessage(JSON.stringify({ type: "handouts_update" })); setGeneratedLore(null); } 
              else {
                const err = await res.json();
                const errMsg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
                alert("Lore manifestation failed: " + (errMsg || "Unknown error"));
              }
            } catch (e) { alert("Network error manifested."); }
          }}
          customForge={customForge}
          onDeleteCustomToken={(id) => setCustomForge(prev => prev.filter(t => t.id !== id))}
          onRenameCustomToken={(id, name) => setCustomForge(prev => prev.map(t => t.id === id ? { ...t, name } : t))}
          onInsertElements={handleInsertElements}
          clientId={clientId}
          onPlaySound={(url) => {
            // Play locally
            const audio = new Audio(url);
            audio.play().catch(e => console.warn("Local play failed", e));
            // Broadcast to everyone
            sendMessage(JSON.stringify({ type: 'vfx_trigger', vfxType: 'sound', soundUrl: url, global: true }));
          }}
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

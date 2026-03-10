import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Location, Entity } from '../types/vtt';

interface WorldDashboardProps {
  campaignId: number;
  onClose: () => void;
  onSetActive: (loc: Location) => void;
  activeLocationId?: number;
}

const WorldDashboard: React.FC<WorldDashboardProps> = ({ campaignId, onClose, onSetActive, activeLocationId }) => {
  const { token } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [activeTab, setActiveTab] = useState<'locations' | 'entities'>('locations');
  
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocX, setNewLocX] = useState(0);
  const [newLocY, setNewLocY] = useState(0);
  const [newLocZoom, setNewLocZoom] = useState(1);

  const [newEntityName, setNewEntityName] = useState('');
  const [selectedLocId, setSelectedLocId] = useState<number | null>(null);

  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // BRIDGE: Listen for capture results from the extension
  useEffect(() => {
    const handleCapture = (e: any) => {
      const { x, y, zoom } = e.detail;
      console.log("[Dashboard] Captured camera:", { x, y, zoom });
      if (editingLocation) {
        setEditingLocation(prev => prev ? { ...prev, x, y, zoom } : null);
      } else {
        setNewLocX(x);
        setNewLocY(y);
        setNewLocZoom(zoom);
      }
    };
    window.addEventListener("VTT_CAMERA_CAPTURED" as any, handleCapture);
    return () => window.removeEventListener("VTT_CAMERA_CAPTURED" as any, handleCapture);
  }, [editingLocation]);

  const syncCurrentView = () => {
    console.log("[Dashboard] Requesting camera capture from bridge...");
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "VTT_BRIDGE_CAPTURE" }, "*");
    } else {
      console.warn("[Dashboard] Excalidraw iframe not found for capture.");
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [campaignId]);

  useEffect(() => {
    if (selectedLocId) {
      fetchEntities(selectedLocId);
    } else {
      setEntities([]);
    }
  }, [selectedLocId]);

  const fetchLocations = async () => {
    try {
      const res = await fetch(`http://192.168.4.150:8000/campaigns/${campaignId}/locations`);
      const data = await res.json();
      setLocations(data);
      if (data.length > 0 && !selectedLocId) setSelectedLocId(data[0].id);
    } catch (e) {
      console.error("Failed to fetch locations", e);
    }
  };

  const fetchEntities = async (locId: number) => {
    try {
      const res = await fetch(`http://192.168.4.150:8000/locations/${locId}/entities`);
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (e) {
      console.error("Failed to fetch entities", e);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await fetch('http://192.168.4.150:8000/locations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newLocName, 
          description: newLocDesc, 
          campaign_id: campaignId,
          x: newLocX,
          y: newLocY,
          zoom: newLocZoom
        })
      });
      setNewLocName(''); setNewLocDesc(''); setNewLocX(0); setNewLocY(0); setNewLocZoom(1);
      fetchLocations();
    } catch (e) { console.error(e); }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingLocation) return;
    try {
      const res = await fetch(`http://192.168.4.150:8000/locations/${editingLocation.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editingLocation.name, 
          description: editingLocation.description,
          x: editingLocation.x,
          y: editingLocation.y,
          zoom: editingLocation.zoom
        })
      });
      if (res.ok) {
        setEditingLocation(null);
        fetchLocations();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!token || !window.confirm("Are you sure?")) return;
    try {
      await fetch(`http://192.168.4.150:8000/locations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (selectedLocId === id) setSelectedLocId(null);
      fetchLocations();
    } catch (e) { console.error(e); }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedLocId) return;
    try {
      const res = await fetch('http://192.168.4.150:8000/entities', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEntityName, location_id: selectedLocId, stats: {}, backstory: "New entity established." })
      });
      if (res.ok) {
        setNewEntityName('');
        fetchEntities(selectedLocId);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteEntity = async (id: number) => {
    if (!token || !window.confirm("Delete entity?")) return;
    try {
      await fetch(`http://192.168.4.150:8000/entities/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (selectedLocId) fetchEntities(selectedLocId);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-white">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <div><h2 className="text-3xl font-black tracking-tighter uppercase italic text-gray-100">World Manifest</h2><p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Campaign Orchestration Unit</p></div>
          <button onClick={onClose} className="p-3 hover:bg-gray-800 rounded-full transition-all text-gray-500 hover:text-white border border-transparent hover:border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r border-gray-800 p-6 space-y-3 bg-gray-950/20 text-gray-100">
            <button onClick={() => setActiveTab('locations')} className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeTab === 'locations' ? 'bg-indigo-600 border-indigo-400/30 text-white shadow-xl shadow-indigo-900/40' : 'text-gray-500 border-transparent hover:bg-gray-800 hover:text-gray-300'}`}>Locales</button>
            <button onClick={() => setActiveTab('entities')} className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeTab === 'entities' ? 'bg-indigo-600 border-indigo-400/30 text-white shadow-xl shadow-indigo-900/40' : 'text-gray-500 border-transparent hover:bg-gray-800 hover:text-gray-300'}`}>NPCs & Enemies</button>
          </div>
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-gray-950/40">
            {activeTab === 'locations' ? (
              <div className="space-y-12">
                <section className="bg-gray-900/60 p-8 rounded-3xl border border-gray-800 shadow-inner">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">{editingLocation ? 'Refine Locale' : 'Establish New Locale'}</h3>
                    <button 
                      type="button"
                      onClick={syncCurrentView}
                      className="bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 text-purple-400 font-black px-4 py-2 rounded-xl uppercase text-[8px] tracking-widest transition-all flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                      Capture Camera
                    </button>
                  </div>
                  <form onSubmit={editingLocation ? handleUpdateLocation : handleCreateLocation} className="grid grid-cols-1 gap-5">
                    <div className="grid grid-cols-3 gap-4 mb-2">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-gray-600 uppercase ml-2">X Coord</p>
                        <input type="number" value={editingLocation ? editingLocation.x : newLocX} onChange={e => editingLocation ? setEditingLocation({...editingLocation, x: Number(e.target.value)}) : setNewLocX(Number(e.target.value))} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-gray-600 uppercase ml-2">Y Coord</p>
                        <input type="number" value={editingLocation ? editingLocation.y : newLocY} onChange={e => editingLocation ? setEditingLocation({...editingLocation, y: Number(e.target.value)}) : setNewLocY(Number(e.target.value))} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-gray-600 uppercase ml-2">Zoom</p>
                        <input type="number" step="0.1" value={editingLocation ? editingLocation.zoom : newLocZoom} onChange={e => editingLocation ? setEditingLocation({...editingLocation, zoom: Number(e.target.value)}) : setNewLocZoom(Number(e.target.value))} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500/50" />
                      </div>
                    </div>
                    <input type="text" placeholder="Location Name" value={editingLocation ? editingLocation.name : newLocName} onChange={e => editingLocation ? setEditingLocation({...editingLocation, name: e.target.value}) : setNewLocName(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-indigo-500/50 shadow-inner" />
                    <textarea placeholder="Atmospheric Description" value={editingLocation ? editingLocation.description : newLocDesc} onChange={e => editingLocation ? setEditingLocation({...editingLocation, description: e.target.value}) : setNewLocDesc(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-indigo-500/50 h-28 resize-none shadow-inner" />
                    <div className="flex gap-3"><button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-indigo-900/20 active:scale-95">{editingLocation ? 'Commit Changes' : 'Add to Manifest'}</button>{editingLocation && <button type="button" onClick={() => setEditingLocation(null)} className="px-8 bg-gray-800 hover:bg-gray-700 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest border border-gray-700 transition-all active:scale-95">Cancel</button>}</div>
                  </form>
                </section>
                <section>
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">World Manifest</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {locations.map(loc => (
                      <div key={loc.id} className={`p-6 rounded-3xl border transition-all flex justify-between items-start group ${activeLocationId === loc.id ? 'bg-indigo-900/10 border-indigo-500/40 shadow-xl' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-4 mb-2">
                            <h4 className="font-black text-gray-100 uppercase text-lg tracking-tight truncate">{loc.name}</h4>
                            {activeLocationId === loc.id && <span className="text-[8px] bg-green-900/30 text-green-400 px-3 py-1 rounded-full border border-green-500/20 font-black tracking-widest uppercase shadow-sm">ACTIVE</span>}
                            <span className="text-[7px] text-gray-600 font-mono">X:{loc.x} Y:{loc.y}</span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed italic opacity-80 line-clamp-2">"{loc.description}"</p>
                        </div>
                        <div className="flex gap-2 shrink-0">{activeLocationId !== loc.id && <button onClick={() => onSetActive(loc)} className="bg-gray-800 hover:bg-indigo-600 text-[9px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700 transition-all">Set Active</button>}<button onClick={() => setEditingLocation(loc)} className="p-2 hover:bg-gray-800 rounded-xl text-gray-500 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/20"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button onClick={() => handleDeleteLocation(loc.id)} className="p-2 hover:bg-red-900/20 rounded-xl text-gray-500 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-12">
                <section className="bg-gray-900/60 p-8 rounded-3xl border border-gray-800 shadow-inner">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">Manifest Entity</h3>
                  <form onSubmit={handleCreateEntity} className="grid grid-cols-1 gap-5">
                    <div className="grid grid-cols-2 gap-5">
                      <input type="text" placeholder="Entity Name" value={newEntityName} onChange={e => setNewEntityName(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-indigo-500/50 shadow-inner" />
                      <select value={selectedLocId || ''} onChange={e => setSelectedLocId(Number(e.target.value))} className="bg-gray-950 border border-gray-800 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-indigo-500/50 text-gray-400 shadow-inner"><option value="" disabled>Target Locale</option>{locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}</select>
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95">Materialize NPC</button>
                  </form>
                </section>
                <section>
                  <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Manifested Entities</h3><select value={selectedLocId || ''} onChange={e => setSelectedLocId(Number(e.target.value))} className="bg-transparent border-none text-[10px] font-black text-indigo-400 uppercase tracking-widest focus:outline-none cursor-pointer">{locations.map(loc => (<option key={loc.id} value={loc.id} className="bg-gray-900">{loc.name}</option>))}</select></div>
                  <div className="grid grid-cols-2 gap-4">
                    {entities.map(ent => (
                      <div key={ent.id} className="p-5 rounded-3xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all flex flex-col group">
                        <div className="flex justify-between items-start mb-3"><h4 className="font-black text-gray-100 uppercase tracking-tight truncate flex-1">{ent.name}</h4><button onClick={() => handleDeleteEntity(ent.id)} className="p-1.5 opacity-0 group-hover:opacity-100 bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900/40 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>
                        <p className="text-xs text-gray-400 italic opacity-80 leading-relaxed line-clamp-2">"{ent.backstory}"</p>
                        <div className="mt-4 pt-4 border-t border-gray-800/50 flex justify-between items-center"><span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">Health: <span className="text-red-500">{ent.stats?.hp || 0}</span></span><span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">AC: <span className="text-blue-400">{ent.stats?.ac || 0}</span></span></div>
                      </div>
                    ))}
                    {entities.length === 0 && (<div className="col-span-2 py-16 text-center border-2 border-dashed border-gray-800 rounded-[2.5rem] opacity-20"><p className="font-black uppercase text-xs tracking-[0.4em]">Locale is currently unpopulated</p></div>)}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldDashboard;

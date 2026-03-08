import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

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

interface WorldDashboardProps {
  campaignId: number;
  onClose: () => void;
}

const WorldDashboard: React.FC<WorldDashboardProps> = ({ campaignId, onClose }) => {
  const { token } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [activeTab, setActiveTab] = useState<'locations' | 'entities'>('locations');
  
  // Form states
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [selectedLocId, setSelectedLocId] = useState<number | null>(null);

  useEffect(() => {
    fetchLocations();
  }, [campaignId]);

  useEffect(() => {
    if (selectedLocId) {
      fetchEntities(selectedLocId);
    }
  }, [selectedLocId]);

  const fetchLocations = async () => {
    try {
      const res = await fetch(`http://localhost:8000/campaigns/${campaignId}/locations`);
      const data = await res.json();
      setLocations(data);
      if (data.length > 0 && !selectedLocId) setSelectedLocId(data[0].id);
    } catch (e) {
      console.error("Failed to fetch locations", e);
    }
  };

  const fetchEntities = async (locId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/locations/${locId}/entities`);
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
      await fetch('http://localhost:8000/locations', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newLocName,
          description: newLocDesc,
          campaign_id: campaignId
        })
      });
      setNewLocName('');
      setNewLocDesc('');
      fetchLocations();
    } catch (e) {
      console.error("Failed to create location", e);
    }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedLocId) return;
    try {
      await fetch('http://localhost:8000/entities', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newEntityName,
          location_id: selectedLocId,
          stats: {},
          backstory: "A new entity established in the chronicle."
        })
      });
      setNewEntityName('');
      fetchEntities(selectedLocId);
    } catch (e) {
      console.error("Failed to create entity", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-4xl h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic">World Manifest</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">GM Administrative Interface</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-800 p-4 space-y-2">
            <button 
              onClick={() => setActiveTab('locations')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'locations' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
            >
              Locations
            </button>
            <button 
              onClick={() => setActiveTab('entities')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'entities' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
            >
              NPCs & Enemies
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-950/20">
            {activeTab === 'locations' ? (
              <div className="space-y-8">
                <section>
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Establish New Locale</h3>
                  <form onSubmit={handleCreateLocation} className="grid grid-cols-1 gap-4 bg-gray-900/40 p-6 rounded-2xl border border-gray-800">
                    <input 
                      type="text" 
                      placeholder="Location Name"
                      value={newLocName}
                      onChange={e => setNewLocName(e.target.value)}
                      className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50"
                    />
                    <textarea 
                      placeholder="Atmospheric Description"
                      value={newLocDesc}
                      onChange={e => setNewLocDesc(e.target.value)}
                      className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 h-24"
                    />
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-indigo-900/20">
                      Add to Chronicle
                    </button>
                  </form>
                </section>

                <section>
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Current Manifest</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {locations.map(loc => (
                      <div key={loc.id} className="p-4 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all flex justify-between items-center group">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-black text-gray-100 uppercase tracking-tight">{loc.name}</h4>
                            <span className="text-[8px] bg-red-900/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-black tracking-widest uppercase">Tier {loc.danger_level}</span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed italic opacity-80">"{loc.description}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-8">
                <section>
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Manifest Entity</h3>
                  <form onSubmit={handleCreateEntity} className="grid grid-cols-1 gap-4 bg-gray-900/40 p-6 rounded-2xl border border-gray-800">
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="text" 
                        placeholder="Entity Name"
                        value={newEntityName}
                        onChange={e => setNewEntityName(e.target.value)}
                        className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50"
                      />
                      <select 
                        value={selectedLocId || ''} 
                        onChange={e => setSelectedLocId(Number(e.target.value))}
                        className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 text-gray-400"
                      >
                        <option value="" disabled>Select Location</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-blue-900/20">
                      Materialize NPC
                    </button>
                  </form>
                </section>

                <section>
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4">Known Entities</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {entities.map(ent => (
                      <div key={ent.id} className="p-4 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all">
                        <h4 className="font-black text-gray-100 uppercase tracking-tight mb-1">{ent.name}</h4>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2">Location ID: {ent.location_id}</p>
                        <p className="text-xs text-gray-400 italic opacity-80 leading-relaxed">"{ent.backstory}"</p>
                      </div>
                    ))}
                    {entities.length === 0 && (
                      <div className="col-span-2 py-12 text-center border-2 border-dashed border-gray-800 rounded-3xl opacity-30">
                        <p className="font-black uppercase text-xs tracking-[0.3em]">No entities manifested in this locale</p>
                      </div>
                    )}
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

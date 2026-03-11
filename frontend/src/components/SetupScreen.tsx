import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface SetupScreenProps {
  onJoin: (campaignId: number, roomId: string, campaign?: any) => void;
}

import { currentConfig } from '../config';

const SetupScreen: React.FC<SetupScreenProps> = ({ onJoin }) => {
  const { isGM, token, logout, user } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isGM && token) {
      fetchMyCampaigns();
    }
  }, [isGM, token]);

  const fetchMyCampaigns = async () => {
    try {
      const res = await fetch(`${currentConfig.API_BASE}/users/me/campaigns`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyCampaigns(data);
      }
    } catch (e) {
      console.error("Failed to fetch campaigns", e);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: campaignName })
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Session expired. Please logout and login again.");
        throw new Error("Failed to create campaign");
      }
      const data = await res.json();
      onJoin(data.id, data.room_id, data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!token || !window.confirm("Are you sure? This will delete all history and locations for this campaign.")) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMyCampaigns();
      }
    } catch (e) {
      console.error("Failed to delete campaign", e);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode) return;
    setLoading(true);
    setError(null);
    try {
      const code = roomCode.trim().toUpperCase();
      console.log(`[Setup] Joining room: ${code}`);
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/join/${code}`);
      if (!res.ok) throw new Error("Room not found");
      const data = await res.json();
      onJoin(data.id, data.room_id, data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans relative">
      <div className="absolute top-8 right-8 z-20">
        <button 
          onClick={logout}
          className="text-[10px] bg-gray-900 hover:bg-red-900/30 border border-gray-800 px-3 py-1.5 rounded-xl transition-all uppercase font-black tracking-widest active:scale-95"
        >
          Logout
        </button>
      </div>

      <div className="max-w-2xl w-full p-10 bg-gray-900 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden flex flex-col gap-10">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl"></div>
        
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-gray-100 drop-shadow-2xl">DND Master</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-2 opacity-60">The Interface has synchronized</p>
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-2xl text-[10px] text-red-400 font-black uppercase text-center leading-relaxed">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {isGM ? (
            <>
              {/* Existing Chronicles */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 bg-indigo-500 rounded-full"></span>
                  Resume Chronicle
                </h2>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {myCampaigns.map(camp => (
                    <div key={camp.id} className="group relative">
                      <button 
                        onClick={() => onJoin(camp.id, camp.room_id, camp)}
                        className="w-full text-left bg-gray-950/50 hover:bg-indigo-900/10 border border-gray-800 hover:border-indigo-500/30 p-5 rounded-3xl transition-all group active:scale-[0.98]"
                      >
                        <p className="text-sm font-black text-gray-200 uppercase group-hover:text-white transition-colors">{camp.name}</p>
                        <p className="text-[10px] font-mono text-indigo-400 font-bold mt-1 tracking-widest uppercase opacity-80">{camp.room_id}</p>
                      </button>
                      <button 
                        onClick={(e) => handleDeleteCampaign(e, camp.id)}
                        className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-900/20 text-gray-600 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                        title="Obliterate Session"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  ))}
                  {myCampaigns.length === 0 && (
                    <div className="py-16 text-center border-2 border-dashed border-gray-800/50 rounded-[2.5rem] opacity-30">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] italic">No previous tales</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Create New */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="h-1 w-1 bg-indigo-500 rounded-full"></span>
                  Forge New Realm
                </h2>
                <div className="space-y-4 bg-gray-950/30 p-6 rounded-[2.5rem] border border-gray-800/50 shadow-inner">
                  <input 
                    type="text" 
                    placeholder="Campaign Name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner placeholder:text-gray-700"
                  />
                  <button 
                    onClick={handleCreateCampaign}
                    disabled={loading || !campaignName}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-2xl uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 shadow-indigo-900/20 border border-indigo-400/20"
                  >
                    {loading ? 'Forging...' : 'Initialize'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-2 space-y-8 max-w-sm mx-auto w-full py-10 animate-in fade-in zoom-in-95 duration-500">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Enter the Fray</h2>
                  <p className="text-[9px] text-indigo-400/60 font-bold uppercase tracking-widest italic">Seek the Master's Code</p>
                </div>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="XJ92LK"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-[2rem] py-6 px-4 text-3xl focus:outline-none focus:border-indigo-500/50 transition-all text-center uppercase font-mono tracking-[0.5em] shadow-inner text-indigo-400 placeholder:text-gray-900"
                  />
                  <button 
                    onClick={handleJoinRoom}
                    disabled={loading || !roomCode}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl shadow-2xl uppercase text-xs tracking-[0.3em] transition-all active:scale-95 shadow-blue-900/20 border border-blue-400/20"
                  >
                    {loading ? 'Traveling...' : 'Join Session'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 text-center border-t border-gray-800/50">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.4em] leading-relaxed opacity-50">
            Synchronized as <span className="text-indigo-400 italic opacity-100">{user?.username}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;

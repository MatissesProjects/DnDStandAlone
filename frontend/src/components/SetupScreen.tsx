import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface SetupScreenProps {
  onJoin: (campaignId: number, roomId: string, campaign?: any) => void;
}

interface Campaign {
  id: number;
  name: string;
  room_id: string;
  canvas_state?: any;
}

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
      const res = await fetch('http://localhost:8000/users/me/campaigns', {
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
      const res = await fetch('http://localhost:8000/campaigns', {
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

  const handleJoinRoom = async () => {
    if (!roomCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/campaigns/join/${roomCode.toUpperCase()}`);
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

      <div className="max-w-xl w-full p-10 bg-gray-900 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden flex flex-col gap-10">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl"></div>
        
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-gray-100">DND Master</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-2">The Interface has synchronized</p>
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
                <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Resume Chronicle</h2>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {myCampaigns.map(camp => (
                    <button 
                      key={camp.id}
                      onClick={() => onJoin(camp.id, camp.room_id, camp)}
                      className="w-full text-left bg-gray-950/50 hover:bg-indigo-900/10 border border-gray-800 hover:border-indigo-500/30 p-4 rounded-2xl transition-all group"
                    >
                      <p className="text-sm font-black text-gray-200 uppercase group-hover:text-white transition-colors">{camp.name}</p>
                      <p className="text-[10px] font-mono text-indigo-400 font-bold mt-1 tracking-widest uppercase">{camp.room_id}</p>
                    </button>
                  ))}
                  {myCampaigns.length === 0 && (
                    <div className="py-10 text-center border-2 border-dashed border-gray-800 rounded-3xl opacity-20">
                      <p className="text-[10px] font-black uppercase tracking-widest">No previous tales</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Create New */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Forge New Realm</h2>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Campaign Name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                  />
                  <button 
                    onClick={handleCreateCampaign}
                    disabled={loading || !campaignName}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-xl uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 shadow-indigo-900/20"
                  >
                    {loading ? 'Forging...' : 'Initialize'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-2 space-y-6 max-w-sm mx-auto w-full">
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] text-center">Enter the Fray</h2>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Enter Room Code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl py-4 px-4 text-lg focus:outline-none focus:border-indigo-500/50 transition-all text-center uppercase font-mono tracking-[0.4em] shadow-inner text-indigo-400"
                  />
                  <button 
                    onClick={handleJoinRoom}
                    disabled={loading || !roomCode}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs tracking-[0.2em] transition-all active:scale-95 shadow-blue-900/20"
                  >
                    {loading ? 'Traveling...' : 'Join Session'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 text-center border-t border-gray-800/50">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em] leading-relaxed">
            Synchronized as <span className="text-indigo-400 italic">{user?.username}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;

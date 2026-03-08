import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface SetupScreenProps {
  onJoin: (campaignId: number, roomId: string) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onJoin }) => {
  const { isGM, token } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) throw new Error("Failed to create campaign");
      const data = await res.json();
      onJoin(data.id, data.room_id);
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
      onJoin(data.id, data.room_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans">
      <div className="max-w-md w-full p-8 bg-gray-900 rounded-[2.5rem] border border-gray-800 shadow-2xl relative overflow-hidden">
        {/* Decorative Background Element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-gray-100">DND Master</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-2">Virtual Tabletop Interface</p>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-xl text-[10px] text-red-400 font-bold uppercase text-center">
              {error}
            </div>
          )}

          {isGM ? (
            <div className="space-y-4">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Establish New Chronicle</h2>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Campaign Name (e.g. Lost Mines)"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button 
                  onClick={handleCreateCampaign}
                  disabled={loading || !campaignName}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-lg uppercase text-xs tracking-widest transition-all active:scale-95"
                >
                  {loading ? 'Forging...' : 'Initialize Realm'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Enter the Fray</h2>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Room Code (e.g. XJ92LK)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all text-center uppercase font-mono tracking-widest"
                />
                <button 
                  onClick={handleJoinRoom}
                  disabled={loading || !roomCode}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-lg uppercase text-xs tracking-widest transition-all active:scale-95"
                >
                  {loading ? 'Traveling...' : 'Join Session'}
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 text-center">
            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
              Authenticated as <span className="text-gray-400 italic">matissetec</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;

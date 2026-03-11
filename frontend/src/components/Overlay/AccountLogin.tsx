import React, { useState, useEffect } from 'react';
import { currentConfig } from '../../config';

interface Character {
  id: number;
  username: string;
  avatar_url?: string;
  class_name?: string;
  level?: number;
}

interface AccountLoginProps {
  onLogin: (token: string, user: any) => void;
  onGuest: () => void;
  isLoggingIn: boolean;
  backendOnline: boolean | null;
}

const AccountLogin: React.FC<AccountLoginProps> = ({ onLogin, onGuest, isLoggingIn, backendOnline }) => {
  const [username, setUsername] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingChars, setIsLoadingChars] = useState(false);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    setIsLoadingChars(true);
    try {
      const res = await fetch(`${currentConfig.API_BASE}/characters`);
      if (res.ok) {
        setCharacters(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch characters", e);
    } finally {
      setIsLoadingChars(false);
    }
  };

  const handleSimpleLogin = async (e?: React.FormEvent, selectedName?: string) => {
    if (e) e.preventDefault();
    const nameToUse = selectedName || username;
    if (!nameToUse) return;

    try {
      const res = await fetch(`${currentConfig.API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nameToUse })
      });
      if (res.ok) {
        const data = await res.json();
        onLogin(data.token, data.user);
      } else {
        alert("Login failed");
      }
    } catch (e) {
      alert("Network error during login");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans text-center overflow-y-auto py-12">
      <div className="space-y-8 p-12 bg-gray-900 rounded-[3rem] border border-gray-800 shadow-2xl relative overflow-hidden max-w-2xl w-full mx-4">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${backendOnline === true ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : backendOnline === false ? 'bg-red-500' : 'bg-gray-600'}`}></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{backendOnline === true ? 'Signal Strong' : backendOnline === false ? 'Signal Lost' : 'Checking...'}</span>
        </div>
        
        <div className="pt-4">
          <h1 className="text-5xl font-black italic tracking-tighter text-gray-100 uppercase relative z-10">DND Master</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 mt-2">The Digital Grimoire</p>
        </div>

        {/* Character Selection */}
        {characters.length > 0 && (
          <div className="space-y-4 relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 text-left px-2">Manifested Souls</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {characters.map(char => (
                <button 
                  key={char.id}
                  onClick={() => handleSimpleLogin(undefined, char.username)}
                  className="flex flex-col items-center gap-3 p-4 bg-gray-950/50 hover:bg-indigo-900/20 border border-gray-800 hover:border-indigo-500/50 rounded-2xl transition-all group"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 group-hover:border-indigo-500 transition-all overflow-hidden flex items-center justify-center shadow-lg">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-gray-600 group-hover:text-indigo-400">{char.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-black uppercase tracking-tighter text-gray-200">{char.username}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500/70">{char.class_name || 'Level'} • {char.level || 1}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New Login Form */}
        <div className="space-y-6 relative z-10 pt-4">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-800"></div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">New Incarnation</span>
            <div className="h-px flex-1 bg-gray-800"></div>
          </div>

          <form onSubmit={handleSimpleLogin} className="flex flex-col gap-3">
            <input 
              type="text" 
              placeholder="ENTER CHARACTER NAME..." 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-6 py-4 text-center font-black uppercase tracking-widest text-sm focus:outline-none focus:border-indigo-500/50 shadow-inner"
            />
            <button 
              type="submit"
              disabled={!username || isLoggingIn}
              className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-950/40"
            >
              {isLoggingIn ? "Manifesting..." : "Forge Soul"}
            </button>
          </form>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onGuest} 
              className="px-10 py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white rounded-2xl font-black uppercase tracking-widest transition-all border border-gray-700 active:scale-95"
            >
              Continue as Guest
            </button>
            <div className="h-4"></div>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }} 
              className="text-[10px] text-gray-600 hover:text-red-400 uppercase font-black tracking-widest transition-all"
            >
              Clear Session & Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountLogin;

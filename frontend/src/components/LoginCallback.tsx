import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginCallback: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const username = params.get('username');
    const role = params.get('role');
    const discord_id = params.get('discord_id');

    if (token && username && role && discord_id) {
      processed.current = true;
      console.log("Success! Persisting session for:", username);
      login(token, {
        username,
        role,
        discord_id
      });
      
      navigate('/');
    } else {
      const missing = [];
      if (!token) missing.push("token");
      if (!username) missing.push("username");
      if (!role) missing.push("role");
      if (!discord_id) missing.push("discord_id");
      
      if (missing.length > 0) {
        console.error("Missing expected parameters:", missing);
        setError(`Missing data: ${missing.join(', ')}`);
      }
    }
  }, [login, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white font-sans">
      <div className="text-center p-10 bg-gray-900 rounded-[2rem] border border-indigo-500/20 shadow-2xl max-w-md w-full mx-4">
        {error ? (
          <div className="space-y-4">
            <div className="h-16 w-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-lg font-black uppercase tracking-widest text-red-400">Connection Failed</p>
            <p className="text-xs text-gray-500 font-bold leading-relaxed">{error}</p>
            <button 
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              Return to Gates
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-indigo-500 mx-auto opacity-20"></div>
              <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                <div className="h-10 w-10 bg-indigo-500/20 rounded-full blur-xl"></div>
                <div className="h-2 w-2 bg-indigo-400 rounded-full shadow-[0_0_15px_rgba(129,140,248,0.8)]"></div>
              </div>
            </div>
            <div>
              <p className="text-lg font-black uppercase tracking-[0.2em] text-indigo-300 drop-shadow-sm">Synchronizing</p>
              <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest">Reading the Great Chronicle...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginCallback;

import React, { useEffect, useRef, useState } from 'react';
import { currentConfig } from '../../config';

interface AudioChannel {
  id: string;
  url: string | null;
  volume: number;
}

interface AmbientPlayerProps {
  channels: AudioChannel[];
  onUpdateVolume: (id: string, volume: number) => void;
}

const AmbientPlayer: React.FC<AmbientPlayerProps> = ({ channels, onUpdateVolume }) => {
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  const activeChannels = channels.filter(c => c.url);

  const getFullUrl = (url: string | null) => {
    if (!url) return "";
    if (url.startsWith('http')) return url;
    return `${currentConfig.API_BASE}${url}`;
  };

  useEffect(() => {
    if (!hasInteracted) return;

    channels.forEach(channel => {
      const el = audioRefs.current[channel.id];
      if (el) {
        if (channel.url) {
          const fullUrl = getFullUrl(channel.url);
          if (el.src !== fullUrl) {
            el.src = fullUrl;
            el.load();
          }
          el.volume = channel.volume;
          el.play().catch(err => console.error(`Audio ${channel.id} play failed:`, err));
        } else {
          el.pause();
          el.src = "";
        }
      }
    });
  }, [channels, hasInteracted]);

  const handleInitialClick = () => {
    setHasInteracted(true);
  };

  if (!hasInteracted && activeChannels.length > 0) {
    return (
      <div className="fixed bottom-24 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={handleInitialClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-2xl border border-indigo-400/30 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          Unmute Atmosphere
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 right-8 z-[100] flex flex-col gap-2 pointer-events-none items-end">
      {channels.map(channel => (
        <div key={channel.id} className="pointer-events-none">
          <audio 
            ref={el => audioRefs.current[channel.id] = el} 
            loop 
            muted={!hasInteracted}
          />
          {channel.url && (
            <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full pointer-events-auto shadow-2xl animate-in slide-in-from-right-4 duration-300">
              <div className="flex gap-0.5 items-end h-3 w-4">
                 <div className="w-0.5 bg-indigo-500 animate-[bounce_1s_infinite_0ms]" style={{ height: '60%' }}></div>
                 <div className="w-0.5 bg-indigo-500 animate-[bounce_1s_infinite_200ms]" style={{ height: '100%' }}></div>
                 <div className="w-0.5 bg-indigo-500 animate-[bounce_1s_infinite_400ms]" style={{ height: '40%' }}></div>
              </div>
              <span className="text-[7px] font-black uppercase tracking-widest text-gray-400 min-w-[40px]">{channel.id}</span>
              
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={channel.volume} 
                onChange={(e) => onUpdateVolume(channel.id, parseFloat(e.target.value))}
                className="w-16 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />

              <button 
                onClick={() => onUpdateVolume(channel.id, channel.volume > 0 ? 0 : 0.5)}
                className="hover:text-white text-gray-500 transition-colors"
              >
                {channel.volume > 0 ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v6a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path></svg>
                )}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AmbientPlayer;

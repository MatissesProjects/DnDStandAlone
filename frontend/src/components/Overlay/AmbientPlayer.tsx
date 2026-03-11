import React, { useEffect, useRef, useState } from 'react';

interface AmbientPlayerProps {
  url: string | null;
  volume?: number;
}

const AmbientPlayer: React.FC<AmbientPlayerProps> = ({ url, volume = 0.5 }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!audioRef.current) return;
    
    if (url) {
      audioRef.current.src = url;
      audioRef.current.load();
      if (hasInteracted) {
        audioRef.current.play().catch(err => console.error("Audio play failed:", err));
        setIsPlaying(true);
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [url, hasInteracted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleInitialClick = () => {
    setHasInteracted(true);
    if (url && audioRef.current) {
      audioRef.current.play().catch(err => console.error("Audio play failed:", err));
      setIsPlaying(true);
    }
  };

  if (!hasInteracted && url) {
    return (
      <div className="fixed bottom-24 right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={handleInitialClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-2xl border border-indigo-400/30 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          Enable Ambience
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 right-8 z-[100] pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
      <audio ref={audioRef} loop />
      {url && isPlaying && (
        <div className="flex items-center gap-1.5 bg-gray-900/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full pointer-events-auto">
          <div className="flex gap-0.5 items-end h-3">
             <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite_0ms]" style={{ height: '60%' }}></div>
             <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite_200ms]" style={{ height: '100%' }}></div>
             <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite_400ms]" style={{ height: '40%' }}></div>
             <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite_600ms]" style={{ height: '80%' }}></div>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Ambience Active</span>
          <button 
            onClick={() => {
              if (audioRef.current) {
                if (isPlaying) audioRef.current.pause();
                else audioRef.current.play();
                setIsPlaying(!isPlaying);
              }
            }}
            className="ml-2 hover:text-white text-gray-500 transition-colors"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default AmbientPlayer;

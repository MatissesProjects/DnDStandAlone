import { useState, useCallback } from 'react';
import type { AudioChannel } from '../types/vtt';
import { currentConfig } from '../config';

interface UseVttAudioProps {
  sendMessage: (msg: string) => void;
  clientId: string;
  targetScene: string;
}

export const useVttAudio = ({ sendMessage, clientId, targetScene }: UseVttAudioProps) => {
  const [audioChannels, setAudioChannels] = useState<AudioChannel[]>([
    { id: 'Atmosphere', url: null, volume: 0.5 },
    { id: 'Music', url: null, volume: 0.5 }
  ]);

  const getProxiedUrl = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') 
      ? `${currentConfig.API_BASE}/proxy-audio?url=${encodeURIComponent(url)}` 
      : url;
  };

  const handlePlaySound = useCallback((url: string) => {
    const finalUrl = getProxiedUrl(url);
    if (!finalUrl) return;

    const audio = new Audio(finalUrl);
    audio.crossOrigin = "anonymous";
    audio.load();
    audio.play().catch(e => console.warn("[Audio] Local play failed", e));

    sendMessage(JSON.stringify({ 
      type: 'vfx_trigger', 
      vfxType: 'sound', 
      soundUrl: finalUrl, 
      senderId: clientId, 
      scene_id: targetScene,
      global: targetScene === "main" || targetScene === "global"
    }));
  }, [sendMessage, clientId, targetScene]);

  const handleUpdateChannelAudio = useCallback((id: string, url: string | null) => {
    const finalUrl = getProxiedUrl(url);
    setAudioChannels(prev => prev.map(c => c.id === id ? { ...c, url: finalUrl } : c));
    
    sendMessage(JSON.stringify({ 
      type: 'music_update', 
      channelId: id, 
      url: finalUrl, 
      scene_id: targetScene,
      global: targetScene === "main" || targetScene === "global"
    }));
  }, [sendMessage, targetScene]);

  const handleUpdateMusic = useCallback((url: string | null) => {
    handleUpdateChannelAudio('Music', url);
  }, [handleUpdateChannelAudio]);

  const handleUpdateVolume = useCallback((id: string, volume: number) => {
    setAudioChannels(prev => prev.map(c => c.id === id ? { ...c, volume } : c));
  }, []);

  const syncAtmosphere = useCallback((url: string | null) => {
    setAudioChannels(prev => prev.map(c => 
      c.id === 'Atmosphere' ? { ...c, url: getProxiedUrl(url) } : c
    ));
  }, []);

  const handleExternalMusicUpdate = useCallback((channelId: string, url: string | null) => {
    setAudioChannels(prev => prev.map(c => c.id === channelId ? { ...c, url } : c));
  }, []);

  return {
    audioChannels,
    handlePlaySound,
    handleUpdateMusic,
    handleUpdateChannelAudio,
    handleUpdateVolume,
    syncAtmosphere,
    handleExternalMusicUpdate
  };
};

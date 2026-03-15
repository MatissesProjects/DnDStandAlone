import { useState, useCallback } from 'react';
import type { HistoryItem, Campaign } from '../types/vtt';
import { currentConfig } from '../config';

interface UseVttHistoryProps {
  activeCampaign: Campaign | null;
  token: string | null;
  sendMessage: (msg: string) => void;
}

export const useVttHistory = ({ activeCampaign, token, sendMessage }: UseVttHistoryProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [campaignSummary, setCampaignSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const fetchHistory = useCallback(() => {
    if (!activeCampaign || !token) return;
    fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const formatted = data.map((item: any) => ({ 
            id: item.id.toString(), 
            type: item.event_type === 'dice_roll' ? 'roll' : (item.event_type === 'lore_update' ? 'ai' : 'story'), 
            content: item.content, 
            user: "Chronicle", 
            timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            isSubtle: item.is_private 
          }));
          setHistory(formatted);
        }
      })
      .catch(err => console.error("[History] Fetch failed", err));
  }, [activeCampaign, token]);

  const handleArchiveSummary = async () => {
    if (!campaignSummary || !activeCampaign || !token) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            event_type: 'lore_update', 
            content: `SESSION RECAP: ${campaignSummary}`, 
            campaign_id: activeCampaign.id,
            is_private: false
        })
      });
      if (res.ok) {
        setCampaignSummary(null);
        fetchHistory();
        sendMessage(JSON.stringify({ type: "history_updated" }));
      }
    } catch (e) { console.error("[History] Archive failed", e); }
  };

  const handleConsumeHistory = useCallback(async (logId: string) => {
    if (!token || !activeCampaign) return;
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/history/${logId}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) {
        sendMessage(JSON.stringify({ type: "history_updated", campaignId: activeCampaign.id }));
        fetchHistory();
      }
    } catch (e) { console.error("[History] Delete failed", e); }
  }, [token, activeCampaign, fetchHistory, sendMessage]);

  const handleClearHistory = useCallback(async (isGM: boolean) => {
    if (!isGM || !token || !activeCampaign || !window.confirm("Clear entire chronicle history?")) return;
    try { 
      // We don't have a bulk delete endpoint yet, but we can clear local state and notify others
      sendMessage(JSON.stringify({ type: "history_cleared" })); 
      setHistory([]); 
    } catch (e) { console.error("[History] Clear failed", e); }
  }, [token, activeCampaign, sendMessage]);

  const handleSummarize = async () => {
    if (!token || !activeCampaign) return;
    setIsSummarizing(true);
    try {
      const res = await fetch(`${currentConfig.API_BASE}/campaigns/${activeCampaign.id}/summarize`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      const data = await res.json();
      setCampaignSummary(data.summary);
    } catch (e) { 
      console.error("[History] Summarize failed", e); 
    } finally { 
      setIsSummarizing(false); 
    }
  };

  return {
    history,
    setHistory,
    campaignSummary,
    setCampaignSummary,
    isSummarizing,
    fetchHistory,
    handleArchiveSummary,
    handleConsumeHistory,
    handleClearHistory,
    handleSummarize
  };
};

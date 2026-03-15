import { useState, useCallback } from 'react';
import type { Poll } from '../types/vtt';

interface UseVttPollsProps {
  sendMessage: (msg: string) => void;
  clientId: string;
}

export const useVttPolls = ({ sendMessage, clientId }: UseVttPollsProps) => {
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [pollDismissed, setPollDismissed] = useState(false);

  const handleStartPoll = useCallback((question: string, options: string[]) => {
    const newPoll: Poll = {
      id: `poll-${Date.now()}`,
      question,
      options,
      votes: {},
      isActive: true
    };
    setActivePoll(newPoll);
    setPollDismissed(false);
    sendMessage(JSON.stringify({ type: 'poll_update', poll: newPoll, global: true }));
  }, [sendMessage]);

  const handleEndPoll = useCallback(() => {
    if (!activePoll) return;
    
    // Calculate winner
    const voteCounts: Record<number, number> = {};
    Object.values(activePoll.votes).forEach(v => {
      voteCounts[v] = (voteCounts[v] || 0) + 1;
    });
    
    let winnerIdx = -1;
    let maxVotes = -1;
    activePoll.options.forEach((_, idx) => {
      if ((voteCounts[idx] || 0) > maxVotes) {
        maxVotes = voteCounts[idx] || 0;
        winnerIdx = idx;
      }
    });

    if (winnerIdx !== -1) {
      const msg = `THE WORLD HAS SPOKEN: ${activePoll.options[winnerIdx].toUpperCase()} manifests!`;
      sendMessage(JSON.stringify({ 
        type: 'story', 
        content: msg, 
        user: "Chronicle", 
        timestamp: new Date().toLocaleTimeString(), 
        isSubtle: false, 
        global: true 
      }));
      sendMessage(JSON.stringify({ type: 'vfx_trigger', vfxType: 'cheer', global: true }));
    }

    setActivePoll(null);
    sendMessage(JSON.stringify({ type: 'poll_update', poll: null, global: true }));
  }, [activePoll, sendMessage]);

  const handleVote = useCallback((idx: number) => {
    if (!activePoll) return;
    sendMessage(JSON.stringify({ type: 'poll_vote', pollId: activePoll.id, clientId, optionIndex: idx, global: true }));
    
    // Optimistic local update
    setActivePoll(prev => {
      if (!prev) return null;
      return { ...prev, votes: { ...prev.votes, [clientId]: idx } };
    });
  }, [activePoll, clientId, sendMessage]);

  const handleReceivePollUpdate = useCallback((poll: Poll | null) => {
    setActivePoll(poll);
    if (poll) setPollDismissed(false);
  }, []);

  const handleReceiveVote = useCallback((pollId: string, voterId: string, optionIndex: number) => {
    setActivePoll(prev => {
      if (!prev || prev.id !== pollId) return prev;
      return {
        ...prev,
        votes: { ...prev.votes, [voterId]: optionIndex }
      };
    });
  }, []);

  return {
    activePoll,
    pollDismissed,
    setPollDismissed,
    handleStartPoll,
    handleEndPoll,
    handleVote,
    handleReceivePollUpdate,
    handleReceiveVote
  };
};

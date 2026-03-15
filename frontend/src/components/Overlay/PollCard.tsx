import React from 'react';
import type { Poll } from '../../types/vtt';

interface PollCardProps {
  poll: Poll;
  onVote: (optionIndex: number) => void;
  myVote?: number;
  onDismiss: () => void;
}

const PollCard: React.FC<PollCardProps> = ({ poll, onVote, myVote, onDismiss }) => {
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-gray-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative">
        <button 
            onClick={onDismiss}
            className="absolute top-4 right-4 p-2 text-gray-600 hover:text-gray-400 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">The World Asks...</h3>
        </div>
        <p className="text-lg font-black text-white mb-6 leading-tight italic">"{poll.question}"</p>
        
        <div className="space-y-3">
          {poll.options.map((option, idx) => {
            const isSelected = myVote === idx;
            return (
              <button
                key={idx}
                onClick={() => onVote(idx)}
                className={`w-full p-4 rounded-2xl border font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 text-left flex justify-between items-center ${
                  isSelected 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/40' 
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-indigo-500/30 hover:text-gray-200'
                }`}
              >
                <span>{option}</span>
                {isSelected && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
              </button>
            );
          })}
        </div>
        
        <p className="text-[8px] text-gray-600 font-bold text-center mt-6 uppercase tracking-widest italic opacity-60">Your choice manifests the path ahead</p>
      </div>
    </div>
  );
};

export default PollCard;

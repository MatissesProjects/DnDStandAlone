import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PollCard from '../PollCard';
import type { Poll } from '../../../types/vtt';

describe('PollCard', () => {
  const mockPoll: Poll = {
    id: 'test-poll',
    question: 'Where to go?',
    options: ['Forest', 'Dungeon'],
    votes: {},
    isActive: true
  };

  it('renders the question and options', () => {
    render(<PollCard poll={mockPoll} onVote={() => {}} onDismiss={() => {}} />);
    
    expect(screen.getByText(/"Where to go\?"/i)).toBeInTheDocument();
    expect(screen.getByText(/Forest/i)).toBeInTheDocument();
    expect(screen.getByText(/Dungeon/i)).toBeInTheDocument();
  });

  it('calls onVote when an option is clicked', () => {
    const onVote = vi.fn();
    render(<PollCard poll={mockPoll} onVote={onVote} onDismiss={() => {}} />);
    
    fireEvent.click(screen.getByText(/Forest/i));
    expect(onVote).toHaveBeenCalledWith(0);
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<PollCard poll={mockPoll} onVote={() => {}} onDismiss={onDismiss} />);
    
    const closeButton = screen.getByRole('button', { name: '' }); // It's an icon button
    fireEvent.click(closeButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows visual feedback for my vote', () => {
    render(<PollCard poll={mockPoll} onVote={() => {}} onDismiss={() => {}} myVote={1} />);
    
    // The selected button should have specific classes (e.g., bg-indigo-600)
    const dungeonButton = screen.getByText(/Dungeon/i).closest('button');
    expect(dungeonButton).toHaveClass('bg-indigo-600');
  });
});

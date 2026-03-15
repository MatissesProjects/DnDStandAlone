import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InitiativeTracker from '../InitiativeTracker';

describe('InitiativeTracker', () => {
  const mockCombatants = [
    { id: '1', name: 'Valerius', initiative: 20, isPlayer: true },
    { id: '2', name: 'Goblin', initiative: 15, isPlayer: false },
  ];

  it('renders nothing if no combatants', () => {
    const { container } = render(<InitiativeTracker combatants={[]} currentTurnIndex={0} isGM={false} isPlayerInInitiative={false} onAction={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders combatants in order', () => {
    render(<InitiativeTracker combatants={mockCombatants} currentTurnIndex={0} isGM={false} isPlayerInInitiative={true} onAction={() => {}} />);
    
    expect(screen.getByText(/Valerius/i)).toBeInTheDocument();
    expect(screen.getByText(/Goblin/i)).toBeInTheDocument();
  });

  it('shows next turn and clear buttons only for GM', () => {
    const { rerender } = render(<InitiativeTracker combatants={mockCombatants} currentTurnIndex={0} isGM={false} isPlayerInInitiative={true} onAction={() => {}} />);
    
    // Icon buttons for next and trash should not exist
    let buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0); // Only "Roll Initiative" would show if player not in list

    rerender(<InitiativeTracker combatants={mockCombatants} currentTurnIndex={0} isGM={true} isPlayerInInitiative={true} onAction={() => {}} />);
    buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls onAction with next type when advancement button clicked', () => {
    const onAction = vi.fn();
    render(<InitiativeTracker combatants={mockCombatants} currentTurnIndex={0} isGM={true} isPlayerInInitiative={true} onAction={onAction} />);
    
    // Use the title attribute to find the correct button
    const nextButton = screen.getByTitle(/Next Turn/i);
    fireEvent.click(nextButton);
    
    expect(onAction).toHaveBeenCalledWith({ type: 'next_turn' });
  });

  it('shows "Roll Initiative" if player is not in the list', () => {
    render(<InitiativeTracker combatants={mockCombatants} currentTurnIndex={0} isGM={false} isPlayerInInitiative={false} onAction={() => {}} />);
    expect(screen.getByText(/Roll Initiative/i)).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GMToolbox from '../GMToolbox';

describe('GMToolbox', () => {
  const mockProps = {
    isGM: true,
    user: { username: 'GM Matisse' },
    isAuthenticated: true,
    activeEntities: [],
    activeLocation: { id: 1, name: 'Dungeon', description: 'Dark', x: 0, y: 0, zoom: 1 },
    activeCampaign: { id: 1, room_id: 'ROOM1' },
    onOpenDashboard: vi.fn(),
    playerClass: 'Wizard',
    playerLevel: 1,
    isEditingProfile: false,
    setIsEditingProfile: vi.fn(),
    setPlayerClass: vi.fn(),
    setPlayerLevel: vi.fn(),
    onUpdateProfile: vi.fn(),
    onSummarize: vi.fn(),
    isSummarizing: false,
    onClearHistory: vi.fn(),
    targetScene: 'main',
    onSetTargetScene: vi.fn(),
    locations: [],
    showSpinner: false,
    onToggleSpinner: vi.fn(),
    clientId: 'client1',
    activeUsers: [],
    customForge: [],
    generatedLore: null,
    generatedEnemy: null,
    activePoll: null,
  };

  it('renders GM-only tools when isGM is true', () => {
    render(<GMToolbox {...mockProps} />);
    expect(screen.getByText(/Manage Manifest/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Weaver/i)).toBeInTheDocument();
    expect(screen.getByText(/Voice of the World/i)).toBeInTheDocument();
  });

  it('renders limited tools when isGM is false', () => {
    render(<GMToolbox {...mockProps} isGM={false} />);
    expect(screen.queryByText(/Manage Manifest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI Weaver/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Wizard • Level 1/i)).toBeInTheDocument();
  });

  it('toggles sound categories', () => {
    render(<GMToolbox {...mockProps} />);
    
    // Combat is collapsed by default? Let's check based on state. 
    // Alerts is expanded by default.
    expect(screen.getByText(/🌟 Success/i)).toBeInTheDocument();
    
    // Click Combat header
    const combatHeader = screen.getByRole('button', { name: /Combat/i });
    fireEvent.click(combatHeader);
    
    expect(screen.getByText(/⚔️ Sword/i)).toBeInTheDocument();
  });

  it('calls onUpdateChannelAudio when background track changes', () => {
    const onUpdateChannelAudio = vi.fn();
    render(<GMToolbox {...mockProps} onUpdateChannelAudio={onUpdateChannelAudio} />);
    
    const atmosphereSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(atmosphereSelect, { target: { value: 'https://www.soundjay.com/ambient_c2026/sounds/dungeon-ambience-1.mp3' } });
    
    expect(onUpdateChannelAudio).toHaveBeenCalledWith('Atmosphere', expect.stringContaining('dungeon-ambience-1.mp3'));
  });
});

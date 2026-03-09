export interface DiceRoll {
  id: string;
  die: string;
  result: number;
  timestamp: string;
  isSubtle: boolean;
  user: string;
}

export interface UserPresence {
  id: string;
  username: string;
  role: string;
  class_name?: string;
  level?: number;
}

export interface EnemyStats {
  hp?: number;
  ac?: number;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  actions?: string[];
}

export interface EnemyData {
  name: string;
  stats: EnemyStats;
  backstory: string;
}

export interface HistoryItem {
  id: string;
  type: 'roll' | 'story' | 'ai';
  content: string;
  user: string;
  timestamp: string;
  isSubtle?: boolean;
}

export interface MoveProposal {
  elementId: string;
  x: number;
  y: number;
  senderId: string;
  username: string;
  originalX: number;
  originalY: number;
}

export interface Location {
  id: number;
  name: string;
  description: string;
  danger_level: number;
}

export interface Entity {
  id: number;
  name: string;
  stats: any;
  backstory: string;
  notes?: string;
  location_id: number;
}

export interface Campaign {
  id: number;
  name: string;
  room_id: string;
  canvas_state?: any;
}

export interface Handout {
  id: number;
  type: 'text' | 'image';
  title: string;
  content: string;
  x: number;
  y: number;
  campaign_id: number;
}

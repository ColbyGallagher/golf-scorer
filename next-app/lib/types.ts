export type PlayerId = 'colby' | 'mitch' | 'dave' | 'scott';
export type Team = 'A' | 'B';
export type WolfMode = 'solo' | 'partner' | 'blind' | 'alone';

export interface Player {
  id: PlayerId;
  name: string;
  team: Team;
  color: string;
}

export interface HoleData {
  par: number;
  idx: number;
}

export interface WolfHole {
  mode: WolfMode | null;
  partnerId: PlayerId | null;
}

export interface CompWinner {
  ctp: string;
  ld: string;
}

export interface ActiveGames {
  teamMultiplier: boolean;
  skins: boolean;
  nassau: boolean;
  ctp: boolean;
  longDrive: boolean;
  wolf: boolean;
  gross: boolean;
  net: boolean;
}

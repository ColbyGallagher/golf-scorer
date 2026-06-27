'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  PlayerId, Team, Player, HoleData, WolfHole, CompWinner, ActiveGames,
} from '../lib/types';

export type { PlayerId, Team, Player, HoleData, WolfHole, CompWinner, ActiveGames };
export type { WolfMode } from '../lib/types';

export const PLAYERS: Player[] = [
  { id: 'colby', name: 'Colby', team: 'A', color: '#4eba7a' },
  { id: 'mitch', name: 'Mitch', team: 'A', color: '#84d4a4' },
  { id: 'dave',  name: 'Dave',  team: 'B', color: '#5599cc' },
  { id: 'scott', name: 'Scott', team: 'B', color: '#88bbee' },
];

export const DEFAULT_HOLE_DATA: HoleData[] = [
  { par: 5, idx: 10 }, // H1
  { par: 3, idx:  8 }, // H2
  { par: 4, idx: 14 }, // H3
  { par: 3, idx:  4 }, // H4
  { par: 5, idx: 11 }, // H5
  { par: 4, idx: 15 }, // H6
  { par: 4, idx:  9 }, // H7
  { par: 5, idx: 17 }, // H8
  { par: 4, idx:  1 }, // H9
  { par: 4, idx: 16 }, // H10
  { par: 3, idx: 12 }, // H11
  { par: 4, idx:  5 }, // H12
  { par: 5, idx:  7 }, // H13
  { par: 3, idx: 18 }, // H14
  { par: 4, idx:  3 }, // H15
  { par: 4, idx:  2 }, // H16
  { par: 3, idx:  6 }, // H17
  { par: 4, idx: 13 }, // H18
];

type PlayerScores = Record<PlayerId, number[]>;
type PlayerThreePutts = Record<PlayerId, boolean[]>;
type PlayerHandicaps = Record<PlayerId, number>;
type TeamAssignments = Record<PlayerId, Team>;

interface GameState {
  handicaps: PlayerHandicaps;
  dailyHandicapOverrides: Partial<PlayerHandicaps>;
  pars: number[];
  indices: number[];
  scores: PlayerScores;
  compWinners: Record<number, CompWinner>;
  currentHole: number;
  courseName: string;
  selectedTee: string;
  teeApplied: boolean;
  holesConfirmed: boolean;
  courseRating: number;
  slopeRating: number;
  teamAssignments: TeamAssignments;
  activeGames: ActiveGames;
  wolfOrder: PlayerId[];
  wolfHoles: WolfHole[];
  wolfOverrides: Record<number, PlayerId>;
  gameActive: boolean;
  setupStep: number;
  threePutts: PlayerThreePutts;
}

interface GameActions {
  setHandicap: (playerId: PlayerId, value: number) => void;
  setDailyHandicapOverride: (playerId: PlayerId, value: number | null) => void;
  setScore: (playerId: PlayerId, hole: number, value: number) => void;
  setThreePutt: (playerId: PlayerId, hole: number, value: boolean) => void;
  setCurrentHole: (hole: number) => void;
  setCourseName: (name: string) => void;
  setSelectedTee: (tee: string) => void;
  setTeeApplied: (applied: boolean) => void;
  setHolesConfirmed: (confirmed: boolean) => void;
  setCourseRating: (rating: number) => void;
  setSlopeRating: (slope: number) => void;
  setPars: (pars: number[]) => void;
  setIndices: (indices: number[]) => void;
  setTeamAssignment: (playerId: PlayerId, team: Team) => void;
  setActiveGames: (games: Partial<ActiveGames>) => void;
  setWolfOrder: (order: PlayerId[]) => void;
  setWolfHole: (hole: number, data: Partial<WolfHole>) => void;
  setWolfOverride: (hole: number, playerId: PlayerId) => void;
  setCompWinner: (hole: number, data: Partial<CompWinner>) => void;
  setGameActive: (active: boolean) => void;
  setSetupStep: (step: number) => void;
  resetGame: () => void;
}

function initScores(): PlayerScores {
  return Object.fromEntries(
    PLAYERS.map(p => [p.id, Array(18).fill(0)])
  ) as PlayerScores;
}

function initThreePutts(): PlayerThreePutts {
  return Object.fromEntries(
    PLAYERS.map(p => [p.id, Array(18).fill(false)])
  ) as PlayerThreePutts;
}

function initCompWinners(): Record<number, CompWinner> {
  return Object.fromEntries(
    Array.from({ length: 18 }, (_, i) => [i, { ctp: '', ld: '' }])
  );
}

const defaultState: GameState = {
  handicaps: { colby: 18, mitch: 14, dave: 16, scott: 0 },
  dailyHandicapOverrides: {},
  pars: DEFAULT_HOLE_DATA.map(h => h.par),
  indices: DEFAULT_HOLE_DATA.map(h => h.idx),
  scores: initScores(),
  compWinners: initCompWinners(),
  currentHole: 0,
  courseName: '',
  selectedTee: 'yellow',
  teeApplied: false,
  holesConfirmed: false,
  courseRating: 71.0,
  slopeRating: 113,
  teamAssignments: { colby: 'A', mitch: 'A', dave: 'B', scott: 'B' },
  activeGames: { teamMultiplier: true, bestBall: false, skins: false, nassau: false, ctp: true, longDrive: true, wolf: false, gross: false, net: false },
  wolfOrder: PLAYERS.map(p => p.id),
  wolfHoles: Array(18).fill(null).map(() => ({ mode: null, partnerId: null })),
  wolfOverrides: {},
  gameActive: false,
  setupStep: 1,
  threePutts: initThreePutts(),
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set) => ({
  ...defaultState,

  setHandicap: (playerId, value) =>
    set(s => ({ handicaps: { ...s.handicaps, [playerId]: value } })),

  setDailyHandicapOverride: (playerId, value) =>
    set(s => {
      const next = { ...s.dailyHandicapOverrides };
      if (value === null) delete next[playerId];
      else next[playerId] = value;
      return { dailyHandicapOverrides: next };
    }),

  setScore: (playerId, hole, value) =>
    set(s => {
      const next = [...s.scores[playerId]];
      next[hole] = value;
      return { scores: { ...s.scores, [playerId]: next } };
    }),

  setThreePutt: (playerId, hole, value) =>
    set(s => {
      const next = [...s.threePutts[playerId]];
      next[hole] = value;
      return { threePutts: { ...s.threePutts, [playerId]: next } };
    }),

  setCurrentHole: (hole) => set({ currentHole: hole }),
  setCourseName: (name) => set({ courseName: name }),
  setSelectedTee: (tee) => set({ selectedTee: tee }),
  setTeeApplied: (applied) => set({ teeApplied: applied }),
  setHolesConfirmed: (confirmed) => set({ holesConfirmed: confirmed }),
  setCourseRating: (rating) => set({ courseRating: rating }),
  setSlopeRating: (slope) => set({ slopeRating: slope }),
  setPars: (pars) => set({ pars }),
  setIndices: (indices) => set({ indices }),

  setTeamAssignment: (playerId, team) =>
    set(s => ({ teamAssignments: { ...s.teamAssignments, [playerId]: team } })),

  setActiveGames: (games) =>
    set(s => ({ activeGames: { ...s.activeGames, ...games } })),

  setWolfOrder: (order) => set({ wolfOrder: order }),

  setWolfHole: (hole, data) =>
    set(s => {
      const next = [...s.wolfHoles];
      next[hole] = { ...next[hole], ...data };
      return { wolfHoles: next };
    }),

  setWolfOverride: (hole, playerId) =>
    set(s => ({ wolfOverrides: { ...s.wolfOverrides, [hole]: playerId } })),

  setCompWinner: (hole, data) =>
    set(s => ({
      compWinners: { ...s.compWinners, [hole]: { ...s.compWinners[hole], ...data } },
    })),

  setGameActive: (active) => set({ gameActive: active }),
  setSetupStep: (step) => set({ setupStep: step }),

  resetGame: () => set({
    ...defaultState,
    scores: initScores(),
    threePutts: initThreePutts(),
    compWinners: initCompWinners(),
    wolfHoles: Array(18).fill(null).map(() => ({ mode: null, partnerId: null })),
    wolfOverrides: {},
    dailyHandicapOverrides: {},
  }),
}),
    {
      name: 'golf-game-state',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

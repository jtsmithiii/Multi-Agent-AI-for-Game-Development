/**
 * Game-state sheet: the shared contract between client and server.
 * Owned by the Game Logic Agent (GL-1). Fields are documented in docs/game-state.md.
 * docs/GDD.md is canonical. Ask GL through the Lead Agent for any change.
 */

export type TeamColor = 'blue' | 'red' | 'white' | 'gray';

/** Terrain underfoot. Each team crosses only its own element. */
export type Terrain = 'grass' | 'dirt' | 'water' | 'fire' | 'ice' | 'rock' | 'wall';

export interface Position {
  x: number;
  y: number;
}

/** Human player, or one of the three AI kinds (GDD section 3). */
export type TankRole = 'player' | 'wrecker' | 'auxiliary' | 'raider';

/** Cells per color (the color of the depot a Cell came from). Missing key means 0. */
export type CellColors = Partial<Record<TeamColor, number>>;

export interface TankState {
  id: string;
  role: TankRole;
  /** Team color; null for Wreckers (they belong to no team). */
  team: TeamColor | null;
  position: Position;
  /** Facing angle in radians. The barrel points the same way. */
  angle: number;
  /** Signed speed in px/s along `angle` (negative = reversing; 0 when stopped). Needed to replay and reconcile eased motion. */
  speed: number;
  /** Display name (humans); empty for AI tanks. */
  name: string;
  /** Energy bars left (0 to 5). Derived from hitsTaken; 3 hits drain one bar. */
  energyBars: number;
  /** Hits taken this round (up to the role's hits-to-destroy). */
  hitsTaken: number;
  /** True once destroyed; stays out until the next round (Raiders never return). */
  destroyed: boolean;
  /** Unstored Cells carried (human cap 5, Raider cap 6). */
  cellsCarried: number;
  /** Color breakdown of the carried Cells; counts sum to cellsCarried. Only non-own-color Cells count as stolen on store. */
  carriedColors: CellColors;
  /** Server time (seconds) when this tank may refuel again; 0 if ready. Wreckers never refuel. */
  refuelReadyAtSeconds: number;
  /** Humans only: false when disconnected; offline humans cannot refuel. AI tanks are always true. */
  online: boolean;
  /** Terrain underfoot. */
  terrain: Terrain;
  /** Server time (seconds) until which this tank is seen through an element after firing from inside it; 0 = not revealed. */
  revealedUntilSeconds: number;
  /**
   * Id of the tank this Wrecker hunts, or null (no target). Written by the Wrecker AI; null for every other role.
   * Optional in the type only so existing spawners and test factories still compile; readers treat undefined as null.
   * Spawners should set it to null explicitly (see docs/game-state.md).
   */
  huntTargetId: string | null;
}

/** A pile of Cells on the ground (dropped by a destroyed carrier or spilled by a depot). Any tank can pick them up. */
export interface CellPile {
  id: string;
  position: Position;
  cells: number;
  /** Color breakdown; counts sum to cells. Spilled and dropped Cells keep their color. */
  colors: CellColors;
}

export interface RefuelStationState {
  id: string;
  position: Position;
}

/** Per-team bookkeeping for elimination, scoring and the leaderboard. */
export interface TeamState {
  team: TeamColor;
  /** True if the team had at least one human when the round began (elimination needs this). */
  hadHumanAtRoundStart: boolean;
  /** Removed from the match (all humans destroyed by the end of a round). */
  eliminated: boolean;
  /** Cells stolen from enemy depots and stored (GDD 2.7 leaderboard). */
  cellsStolen: number;
}

/** Output of round scoring. */
export interface TeamScore {
  team: TeamColor;
  /** Cells in the team's depot (0 if the depot is destroyed). */
  score: number;
  cellsStolen: number;
  /** True for every top-scoring team (a tie is a shared win, GDD 1). */
  winner: boolean;
}

/** One scored round, kept in `GameState.roundHistory` for the results screens (GDD 2.5). Same data as the `round-scored` event plus the round and map. */
export interface RoundResult {
  /** Round number, 1 to 5. */
  round: number;
  mapName: string;
  scores: TeamScore[];
  winners: TeamColor[];
}

export interface DepotState {
  team: TeamColor;
  position: Position;
  cells: number;
  /** Hits left (starts at TUNING.depotHp; only Wreckers damage it). */
  hp: number;
  /** GDD: a destroyed depot scores nothing until a teammate delivers a Cell to rebuild it. */
  destroyed: boolean;
}

export interface RoundTimer {
  /** Round number, 1 to 5. */
  round: number;
  /** Phase: 'playing' (a round), 'break' (between rounds) or 'match-over' (results screen). secondsLeft counts down the current phase. */
  phase: RoundPhase;
  /** Seconds left in the current phase. */
  secondsLeft: number;
}

export type RoundPhase = 'playing' | 'break' | 'match-over';

/** 'practice' when fewer than two teams have a human at round start (GDD 2.7). */
export type GameMode = 'public' | 'practice';

/** A shell in flight. */
export interface ShellState {
  id: string;
  ownerId: string;
  /** Owner's team at fire time (null for a Wrecker). Kept so no-friendly-fire survives the owner's death. */
  ownerTeam: TeamColor | null;
  position: Position;
  angle: number;
  /** Distance flown so far; the shell is removed at TUNING.shellRangePx. */
  distancePx: number;
}

export interface WreckerSpawn {
  /** Seconds until the next Wrecker arrives. */
  nextSpawnSeconds: number;
  alive: number;
  cap: number;
}

export interface GameState {
  tanks: TankState[];
  depots: DepotState[];
  stations: RefuelStationState[];
  piles: CellPile[];
  teams: TeamState[];
  timer: RoundTimer;
  wreckers: WreckerSpawn;
  /** Server game clock in seconds; only rises. Used for refuel cooldowns and reveal timers. */
  timeSeconds: number;
  /** Name of the current map. */
  mapName: string;
  mode: GameMode;
  shells: ShellState[];
  /**
   * One entry per scored (public) round of the current match, oldest first. Appended where `round-scored` is emitted,
   * kept across rounds, cleared when a new match starts. Optional in the type only so existing state factories still
   * compile; readers treat undefined as []. The server creates it as [].
   */
  roundHistory?: RoundResult[];
}

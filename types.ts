
export enum GameMode {
  REFLEX = 'REFLEX',
  AIM = 'AIM',
  IDLE = 'IDLE'
}

export enum ReflexState {
  START = 'START',
  WAITING = 'WAITING',
  READY = 'READY',
  RESULT = 'RESULT',
  TOO_EARLY = 'TOO_EARLY'
}

export interface Score {
  value: number;
  timestamp: number;
  mode: GameMode;
  rank: string;
}

export interface CoachFeedback {
  comment: string;
  rankName: string;
}

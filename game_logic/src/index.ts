export interface Message {
  lobbyId: string;
  player: string;
  type: string;
  content: string;
}

export interface MessageBoard {
  messages: Message[];
}

export interface LobbyGameInfo {
  maxChipsInPot: number;
  bigBlind: number;
  curPlayer: number;
  numInPot: number;
  numPlayedThisRound: number;
  curRound: number;
  gameStarted: boolean;
  dealerChip: number;
  curRaise: number;
  maxChipsThisRound: number;
  totalPot: number;
}

export interface Lobby {
  _id: string;
  date: Date;
  players: Player[];
  seats: number[];
  gameInfo: LobbyGameInfo;
}

export interface Card {
  num: number;
  suit: string;
  numDisplay: string;
}
export interface PlayerGameInfo {
  stack: number;
  chipsInPot: number;
  chipsThisRound: number;
  inPot: boolean;
  card1: Card;
  card2: Card;
  fullHand: Card[];
  curBestHand: Card[];
  curHandStrength: number;
}

export interface Player {
  _id: string; //database id, will be given to backend to verify if this person is allowed to play right now, other players shouldn't ever know
  lobbyId: string;
  inGameId: number; //should be the number of players before this player joined, remembered by frontend so it knows what person it is playing and to fill in data easily
  name: string;
  seat: number;
  gameInfo: PlayerGameInfo;
}

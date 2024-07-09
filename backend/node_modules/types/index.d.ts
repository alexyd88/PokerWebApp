export interface Lobby {
  _id: string;
  date: Date;
  players: Player[];
  seats: number[];
}

export interface Message {
  lobbyId: string;
  player: string;
  type: string;
  content: string;
}

export interface MessageBoard {
  messages: Message[];
}

export interface Player {
  _id: string; //database id, will be given to backend to verify if this person is allowed to play right now, other players shouldn't ever know
  lobbyId: string;
  inGameId: number; //should be the number of players before this player joined, remembered by frontend so it knows what person it is playing and to fill in data easily
  name: string;
  seat: number;
}

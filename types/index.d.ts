export interface Lobby {
  _id: string;
  date: Date;
  players: string[];
}

export interface Message {
  lobbyId: string;
  player: string;
  content: string;
}

export interface MessageBoard {
  messages: Message[];
}

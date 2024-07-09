export interface Lobby {
  _id: string;
  date: Date;
  players: string[];
}

export interface Message {
  player: string;
  content: string;
}

export interface MessageBoard {
  messages: Message[];
}

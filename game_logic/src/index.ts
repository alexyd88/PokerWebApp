import { v4 as uuidv4 } from "uuid";

type MessageCommon = {
  playerId: PlayerId;
  id: number;
};

type MessageChat = {
  type: "chat";
  text: string;
};

type MessageAction = {
  type: "action";
  action: string;
  content: number;
};

type MessageAddPlayer = {
  type: "addPlayer";
  name: string;
};

export type Message = MessageCommon &
  (MessageAction | MessageChat | MessageAddPlayer);

export function messageToString(message: Message): string {
  let x: string =
    message.id + ": " + message.type + ": " + message.playerId.name;
  if (message.type == "chat") x += ": " + message.text;
  if (message.type == "action")
    x += ": " + message.action + " " + message.content;
  return x;
}

//remove playerid, verify playername
export function prepareMessageForClient(
  lobby: Lobby,
  message: Message
): Message {
  const newMessage: Message = JSON.parse(JSON.stringify(message));
  console.log("lobby", lobby);
  if (
    lobby.players[message.playerId.inGameId].playerId.id != message.playerId.id
  ) {
    console.log("id doesn't match hacker");
    console.log(
      lobby.players[message.playerId.inGameId].playerId.id,
      message.playerId.id
    );
    newMessage.playerId.name = "UNKNOWN NAME";
  } else {
    newMessage.playerId.name =
      lobby.players[newMessage.playerId.inGameId].playerId.name;
  }
  newMessage.playerId.id = "UNKNOWN ID";
  return newMessage;
}

export function sit(lobby: Lobby, playerId: PlayerId, seat: number): void {
  if (playerId.seat != -1) {
    console.log("seat not -1 hacker");
    return;
  }
  if (lobby.seats[seat] != -1) {
    console.log("seat full hacker");
    return;
  }
  console.log("SHOULD SET ");
  lobby.seats[seat] = playerId.inGameId;
  playerId.seat = seat;
}

export function validateSeat(
  lobby: Lobby,
  playerId: PlayerId,
  seat: number
): boolean {
  console.log("seat", seat);
  console.log(
    seat >= 0,
    seat <= 9,
    Number.isInteger(seat),
    lobby.seats[seat] == -1,
    lobby.players[playerId.inGameId].playerId.seat == -1
  );
  return (
    seat >= 0 &&
    seat <= 9 &&
    Number.isInteger(seat) &&
    lobby.seats[seat] == -1 &&
    lobby.players[playerId.inGameId].playerId.seat == -1
  );
  // return true;
}

export function createChat(playerId: PlayerId, text: string): Message {
  return {
    type: "chat",
    id: -1,
    text: text,
    playerId: playerId,
  };
}

export function createAction(
  playerId: PlayerId,
  action: string,
  content: number
): Message {
  return {
    type: "action",
    id: -1,
    action: action,
    content: content,
    playerId: playerId,
  };
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
export function createLobbyGameInfo() {
  return {
    maxChipsInPot: 0,
    bigBlind: 2,
    curPlayer: 0,
    numInPot: 0,
    numPlayedThisRound: 0,
    curRound: 0,
    gameStarted: false,
    dealerChip: 0,
    curRaise: 2,
    maxChipsThisRound: 2,
    totalPot: 3,
  };
}

export interface Lobby {
  id: string;
  date: Date;
  players: Player[];
  seats: number[];
  gameInfo: LobbyGameInfo;
  messages: Message[];
}

export function createLobbyServer(): Lobby {
  const seats: number[] = [];
  for (let i = 0; i < 10; i++) seats.push(-1);
  return {
    id: uuidv4(),
    date: new Date(),
    players: [],
    seats: seats,
    messages: [],
    gameInfo: createLobbyGameInfo(),
  };
}

export function createLobbyClient(id: string): Lobby {
  const seats: number[] = [];
  for (let i = 0; i < 10; i++) seats.push(-1);
  return {
    id: id,
    date: new Date(),
    players: [],
    seats: seats,
    messages: [],
    gameInfo: createLobbyGameInfo(),
  };
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

export function createPlayerGameInfo(): PlayerGameInfo {
  return {
    stack: 1000,
    chipsInPot: 0,
    chipsThisRound: 0,
    inPot: false,
    card1: { num: -1, suit: "oops", numDisplay: "oops2" },
    card2: { num: -1, suit: "oops", numDisplay: "oops2" },
    fullHand: [],
    curBestHand: [],
    curHandStrength: -1,
  };
}

export interface PlayerId {
  id: string; //uuid, will be given to backend to verify if this person is allowed to play right now, other players shouldn't ever know
  inGameId: number; //should be the number of players before this player joined, remembered by frontend so it knows what person it is playing and to fill in data easily
  name: string;
  seat: number;
  lobbyId: string;
}
export function createPlayerId(lobby: Lobby, name: string): PlayerId {
  return {
    id: uuidv4(),
    inGameId: lobby.players.length,
    name: name,
    seat: -1,
    lobbyId: lobby.id,
  };
}

export interface Player {
  playerId: PlayerId;
  gameInfo: PlayerGameInfo;
}
export function addExistingPlayer(lobby: Lobby, playerId: PlayerId): Player {
  const newPlayer: Player = {
    playerId: playerId,
    gameInfo: createPlayerGameInfo(),
  };
  lobby.players.push(newPlayer);
  return newPlayer;
}

export function addPlayer(lobby: Lobby, name: string): Player {
  const newPlayer: Player = {
    playerId: createPlayerId(lobby, name),
    gameInfo: createPlayerGameInfo(),
  };
  lobby.players.push(newPlayer);
  return newPlayer;
}

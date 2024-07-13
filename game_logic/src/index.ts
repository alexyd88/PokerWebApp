import { v4 as uuidv4 } from "uuid";
import {
  call,
  endRound,
  findNext,
  isValidRaise,
  raise,
  resetHand,
  takeFromPot,
} from "./logic";
import { strengthToString } from "./handEval";
import { Socket } from "socket.io";

export * from "./logic";
export * from "./handEval";

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

type MessageNewCards = {
  type: "newCards";
  id: number;
  cards: Card[];
  isCommunity: boolean;
};

export function createMessageAction(
  playerId: PlayerId,
  action: string,
  content: number
): Message {
  return {
    playerId: playerId,
    id: -1,
    type: "action",
    action: action,
    content: content,
  };
}

type MessageAddPlayer = {
  type: "addPlayer";
};

type MessageSetPlayer = {
  type: "setPlayerName";
};

type MessageSit = {
  type: "sit";
  location: number;
};

type MessageStart = {
  type: "start";
};

export type Message = MessageCommon &
  (
    | MessageAction
    | MessageChat
    | MessageAddPlayer
    | MessageSetPlayer
    | MessageSit
    | MessageStart
    | MessageNewCards
  );

function cardsToString(cards: Card[]): string {
  let s: string = "";
  for (let i = 0; i < cards.length; i++)
    s += cards[i].numDisplay + cards[i].suit;
  return s;
}

export function messageToString(message: Message): string {
  if (message.type == "newCards") {
    return message.id + ": server sent: " + cardsToString(message.cards);
  }
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
  if (message.type == "newCards") {
    newMessage.playerId.id = "UNKNOWN ID";
    return message;
  }
  //console.log("lobby", lobby);
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
  lobby.players[playerId.inGameId].playerId.seat = seat;
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
  deck: Card[];
  board: Card[];
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
    deck: [],
    board: [],
  };
}

export interface Lobby {
  id: string;
  date: Date;
  players: Player[];
  seats: number[];
  host: number; //player ingameid
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
    host: 0,
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
    host: 0,
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
  away: boolean;
}

export function playerGameInfoToString(lobby: Lobby, player: Player) {
  const gameInfo: PlayerGameInfo = player.gameInfo;
  return (
    "stack: " +
    gameInfo.stack +
    " | inPot: " +
    gameInfo.inPot +
    " | chips in pot: " +
    gameInfo.chipsThisRound +
    " | " +
    gameInfo.card1.numDisplay +
    gameInfo.card1.suit +
    gameInfo.card2.numDisplay +
    gameInfo.card2.suit +
    " | " +
    strengthToString(gameInfo.curHandStrength)
  );
  // (player.playerId.seat == lobby.gameInfo.curPlayer)
  // ? "<-- this guy's turn"
  // : "";
}

export function lobbyInfoToString(lobby: LobbyGameInfo) {
  return (
    "curPlayer: " +
    lobby.curPlayer +
    " | " +
    // numInPot: number;
    // numPlayedThisRound: number;
    // curRound: number;
    // gameStarted: boolean;
    "dealer chip: " +
    lobby.dealerChip +
    " | " +
    "total pot: " +
    lobby.totalPot +
    " | "
  );
  // curRaise: number;
  // maxChipsThisRound: number;
  // totalPot: number;
  // deck: Card[];
  // board: Card[];
  // )
}

export function createPlayerGameInfo(): PlayerGameInfo {
  return {
    stack: 1000,
    chipsInPot: 0,
    chipsThisRound: 0,
    inPot: false,
    card1: { num: 999, suit: "oops", numDisplay: "oops2" },
    card2: { num: 999, suit: "oops", numDisplay: "oops2" },
    fullHand: [],
    curBestHand: [],
    curHandStrength: -1,
    away: false,
  };
}

export interface PlayerId {
  id: string; //uuid, will be given to backend to verify if this person is allowed to play right now, other players shouldn't ever know
  inGameId: number; //should be the number of players before this player joined, remembered by frontend so it knows what person it is playing and to fill in data easily
  name: string;
  seat: number;
  lobbyId: string;
}

export function createPlayerId(
  lobby: Lobby,
  name: string,
  id: null | string
): PlayerId {
  return {
    id: id == null ? uuidv4() : id,
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

export function setPlayerNameServer(lobby: Lobby, playerId: PlayerId): void {
  for (let i = 0; i < lobby.players.length; i++)
    if (lobby.players[i].playerId.inGameId == playerId.inGameId)
      lobby.players[i].playerId.name = playerId.name;
}

export function setPlayerNameClient(lobby: Lobby, playerId: PlayerId): void {
  lobby.players[playerId.inGameId].playerId.name = playerId.name;
}

export function getErrorFromAction(lobby: Lobby, message: Message): string {
  if (message.type != "action") {
    console.log("PLEASE HOW ARE U HERE");
    return "WTF";
  }
  let lg: LobbyGameInfo = lobby.gameInfo;
  let curPlayer: PlayerGameInfo =
    lobby.players[lobby.seats[lg.curPlayer]].gameInfo;
  switch (message.action) {
    case "raise": {
      if (!isValidRaise(lobby, message.content)) {
        return (
          "Invalid Raise, must raise to at least " +
          Math.max(lg.maxChipsThisRound + lg.curRaise, lg.bigBlind) +
          " and up to idk"
        );
      }
      break;
    }
    case "check":
      {
        if (
          curPlayer.chipsThisRound != lg.maxChipsThisRound &&
          curPlayer.stack != 0
        ) {
          lg.numPlayedThisRound--;
          return "Cannot check";
        }
      }
      break;
  }
  return "success";
}

export interface ActionResult {
  cards: Card[]; // community cards
  calledReset: boolean;
}

export function runAction(
  lobby: Lobby,
  message: Message,
  isClient: boolean
): ActionResult | null {
  if (message.type != "action") {
    console.log("PLEASE HOW ARE U HERE");
    return null;
  }
  let lg: LobbyGameInfo = lobby.gameInfo;
  let curPlayer: PlayerGameInfo =
    lobby.players[lobby.seats[lg.curPlayer]].gameInfo;
  lg.numPlayedThisRound++;
  switch (message.action) {
    case "raise": {
      if (isValidRaise(lobby, message.content)) {
        lg.curRaise = Math.max(
          lg.curRaise,
          message.content - lg.maxChipsThisRound
        );
        raise(curPlayer, lg, message.content - curPlayer.chipsThisRound);
      } else {
        lg.numPlayedThisRound--;
        console.log("PLEASE HOW ARE U HERE");
        return null;
      }
      break;
    }
    case "call": {
      call(curPlayer, lobby.gameInfo);
      break;
    }
    case "fold": {
      curPlayer.inPot = false;
      lg.numInPot--;
      if (lg.numInPot == 1) {
        for (let i = 0; i < lobby.players.length; i++)
          if (lobby.players[i].gameInfo.inPot) {
            takeFromPot(lg, lobby.players[i].gameInfo, lg.totalPot);
          }
        resetHand(lobby, isClient);
        return { cards: [], calledReset: true };
      }
      break;
    }
    case "check":
      {
        if (
          curPlayer.chipsThisRound != lg.maxChipsThisRound &&
          curPlayer.stack != 0
        ) {
          lg.numPlayedThisRound--;
          return null;
        }
      }
      break;
  }
  let doneRound = true;
  if (lg.numPlayedThisRound < lg.numInPot) doneRound = false;
  else {
    for (let i = 0; i < lobby.players.length; i++) {
      if (
        lobby.players[i].gameInfo.stack != 0 &&
        lobby.players[i].gameInfo.inPot &&
        lobby.players[i].gameInfo.chipsThisRound != lg.maxChipsThisRound
      ) {
        doneRound = false;
      }
    }
  }
  let actionResult: ActionResult | null = null;
  if (doneRound) actionResult = endRound(lobby, isClient);
  lg.curPlayer = findNext(lobby, lg.curPlayer);
  curPlayer = lobby.players[lobby.seats[lg.curPlayer]].gameInfo;
  //implement autocheck if only one person has chips
  return actionResult;
}

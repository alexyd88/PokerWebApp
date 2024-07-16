import { v4 as uuidv4 } from "uuid";
import {
  call,
  endRound,
  findNext,
  isValidRaise,
  raise,
  resetHand,
  showdown,
  takeFromPot,
} from "./logic";
import { strengthToString } from "./handEval";
import { Socket } from "socket.io";

export * from "./logic";
export * from "./handEval";

type MessageCommon = {
  id: number;
  lobbyId: string;
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

type MessageNewCommunityCards = {
  type: "newCommunityCards";
  cards: Card[];
};

export type ShowCards = {
  inGameId: number;
  card1: Card;
  card2: Card;
};

type MessageShowCards = {
  type: "showCards";
  cardsShown: ShowCards[];
};

type MessageReset = {
  type: "reset";
  cards: Card[];
};

export function createMessageAction(
  playerId: PlayerId,
  action: string,
  content: number,
  lobbyId: string
): Message {
  return {
    playerId: playerId,
    lobbyId: lobbyId,
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

export type MessageWithPlayerId = { playerId: PlayerId } & (
  | MessageAction
  | MessageChat
  | MessageAddPlayer
  | MessageSetPlayer
  | MessageSit
  | MessageReset
);

export type Message = MessageCommon &
  (
    | MessageWithPlayerId
    | ({ playerId: null } & (
        | MessageStart
        | MessageNewCommunityCards
        | MessageShowCards
      ))
  );

export function cardsToString(cards: Card[]): string {
  let s: string = "";
  for (let i = 0; i < cards.length; i++)
    s += cards[i].numDisplay + cards[i].suit;
  return s;
}

export function messageToString(message: Message): string {
  if (message.type == "newCommunityCards") {
    return message.id + ": server sent: " + cardsToString(message.cards);
  }
  let x: string =
    message.id +
    ": " +
    message.type +
    ": " +
    (message.playerId != null ? message.playerId.name + ": " : "");
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
  //console.log("lobby", lobby);
  if (newMessage.playerId == null) return newMessage;
  if (
    lobby.players[newMessage.playerId.inGameId].playerId.id !=
    newMessage.playerId.id
  ) {
    console.log(
      "id doesn't match hacker",
      newMessage.playerId,
      lobby.players[newMessage.playerId.inGameId].playerId
    );
    // console.log(
    //   lobby.players[newMessage.playerId.inGameId].playerId.id,
    //   newMessage.playerId.id
    // );
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
  lobby.seats[seat] = playerId.inGameId;
  lobby.players[playerId.inGameId].playerId.seat = seat;
  playerId.seat = seat;
}

export function validateSeat(
  lobby: Lobby,
  playerId: PlayerId,
  seat: number
): boolean {
  // console.log("seat", seat);
  // console.log(
  //   seat >= 0,
  //   seat <= 9,
  //   Number.isInteger(seat),
  //   lobby.seats[seat] == -1,
  //   lobby.players[playerId.inGameId].playerId.seat == -1
  // );
  return (
    seat >= 0 &&
    seat <= 9 &&
    Number.isInteger(seat) &&
    lobby.seats[seat] == -1 &&
    lobby.players[playerId.inGameId].playerId.seat == -1
  );
  // return true;
}

export function createChat(
  playerId: PlayerId,
  lobbyId: string,
  text: string
): Message {
  return {
    type: "chat",
    id: -1,
    text: text,
    playerId: playerId,
    lobbyId: lobbyId,
  };
}

export function createAction(
  playerId: PlayerId,
  lobbyId: string,
  action: string,
  content: number
): Message {
  return {
    type: "action",
    id: -1,
    action: action,
    content: content,
    playerId: playerId,
    lobbyId: lobbyId,
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
  lastAggressivePerson: number; //seat of last aggressive person
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
    lastAggressivePerson: -1,
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

export function playerGameInfoToString(player: Player, isUser: boolean) {
  const gameInfo: PlayerGameInfo = player.gameInfo;
  let s =
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
    gameInfo.card2.suit;
  if (isUser)
    s +=
      " | " +
      cardsToString(gameInfo.curBestHand) +
      " | " +
      strengthToString(gameInfo.curHandStrength);
  return s;
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
  let curPlayer: PlayerGameInfo = createPlayerGameInfo();
  if (message.action != "start")
    curPlayer = lobby.players[lobby.seats[lg.curPlayer]].gameInfo;
  switch (message.action) {
    case "start": {
      let numPlayers = 0;
      for (let i = 0; i < 10; i++) {
        if (lobby.seats[i] == -1) continue;
        let player = lobby.players[lobby.seats[i]].gameInfo;
        if (!player.away && player.stack != 0) numPlayers++;
      }
      if (numPlayers < 2) return "Not enough players";
      if (lg.gameStarted) return "Already started";
      break;
    }
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
        // console.log(
        //   lg.curPlayer,
        //   lobby.seats[lg.curPlayer],
        //   lobby.players[lobby.seats[lg.curPlayer]],
        //   curPlayer,
        //   curPlayer.chipsThisRound,
        //   lg.maxChipsThisRound
        // );
        if (
          curPlayer.chipsThisRound != lg.maxChipsThisRound &&
          curPlayer.stack != 0
        ) {
          console.log("chis", curPlayer.chipsThisRound, lg.maxChipsThisRound);
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
  calledHandEnd: boolean;
  cardsShown: ShowCards[];
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

  lg.numPlayedThisRound++;
  let curPlayer: PlayerGameInfo = createPlayerGameInfo();
  if (message.action != "start")
    curPlayer = lobby.players[lobby.seats[lg.curPlayer]].gameInfo;
  switch (message.action) {
    case "start": {
      if (!isClient) resetHand(lobby, isClient);
      return {
        cards: [],
        calledHandEnd: false,
        cardsShown: [],
      };
    }
    case "raise": {
      lg.lastAggressivePerson = lg.curPlayer;
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
        if (!isClient) return showdown(lobby);
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
  let actionResult: ActionResult = {
    cards: [],
    calledHandEnd: false,
    cardsShown: [],
  };
  lg.curPlayer = findNext(lobby, lg.curPlayer);
  if (doneRound) actionResult = endRound(lobby, isClient);
  //implement autocheck if only one person has chips
  return actionResult;
}

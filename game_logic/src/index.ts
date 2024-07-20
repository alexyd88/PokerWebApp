import { v4 as uuidv4 } from "uuid";
import {
  call,
  endRound,
  findNext,
  getRandInt,
  isLeaving,
  isValidRaise,
  raise,
  resetHand,
  showdown,
  takeFromPot,
} from "./logic";
import { strengthToString } from "./handEval";
import { Socket } from "socket.io";
import { SEATS_NUMBER } from "./constants";

export * from "./logic";
export * from "./handEval";
export * from "./constants";

type MessageCommon = {
  id: number;
  lobbyId: string;
  date: number;
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

type MessageShowdown = {
  type: "showdown";
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
  dealerChip: number;
};

type MessageSetHost = {
  type: "setHost";
  inGameId: number;
};

export function createMessageAction(
  playerId: PlayerId,
  action: string,
  content: number,
  lobbyId: string
): Message {
  return {
    date: Date.now(),
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

type MessagePauseToggle = {
  type: "pauseToggle";
};

type MessageShowMyCards = {
  type: "showMyCards";
};

type MessageEndGameToggle = {
  type: "endGameToggle";
};

type MessageEndGame = {
  type: "end";
};

type MessageAwayToggle = {
  type: "awayToggle";
  inGameId: number; //host might send diff person's ingameid
};

type MessageLeavingToggle = {
  type: "leavingToggle";
  inGameId: number;
};

type MessageKickingToggle = {
  type: "kickingToggle";
  inGameId: number;
};

type MessageChangeChips = {
  type: "changeChips";
  inGameId: number;
  changeChips: ChangeChips;
};

export type MessageWithPlayerId = { playerId: PlayerId } & (
  | MessageAction
  | MessageChat
  | MessageAddPlayer
  | MessageSetPlayer
  | MessageSit
  | MessagePauseToggle
  | MessageShowMyCards
  | MessageEndGameToggle
  | MessageAwayToggle
  | MessageSetHost
  | MessageLeavingToggle
  | MessageKickingToggle
  | MessageChangeChips
);

export type MessageWithoutPlayerId = { playerId: null } & (
  | MessageStart
  | MessageNewCommunityCards
  | MessageShowCards
  | MessageReset
  | MessageShowdown
  | MessageEndGame
);

export type Message = MessageCommon &
  (MessageWithoutPlayerId | MessageWithPlayerId);

export function cardsToString(cards: Card[]): string {
  let s: string = "";
  for (let i = 0; i < cards.length; i++)
    s += cards[i].numDisplay + cards[i].suit;
  return s;
}

export function messageToString(message: Message): string {
  if (message.playerId == null) {
    return message.id + ": server sent: " + message.type;
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
  if (lobby.seats[seat] != -1) {
    console.log("seat full hacker");
    return;
  }
  lobby.seats[seat] = playerId.inGameId;
  lobby.players[playerId.inGameId].gameInfo.seat = seat;
  let pg = lobby.players[playerId.inGameId].gameInfo;
  pg.kicking = false;
  pg.leaving = false;
  pg.startedInPot = false;
  pg.inPot = false;
  pg.away = false;
}

export function leaveSeat(lobby: Lobby, inGameId: number) {
  let seat = lobby.players[inGameId].gameInfo.seat;
  console.log("I LEFT", seat);
  lobby.players[inGameId].gameInfo.seat = -1;
  lobby.seats[seat] = -1;
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
    lobby.players[playerId.inGameId].gameInfo.seat == -1
  );
  // return true;
}

export function createChat(
  playerId: PlayerId,
  lobbyId: string,
  text: string
): Message {
  return {
    date: Date.now(),
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
    date: Date.now(),
    type: "action",
    id: -1,
    action: action,
    content: content,
    playerId: playerId,
    lobbyId: lobbyId,
  };
}

type stateTypes = "waitingForAction" | "dealing" | "showdown" | "nothing";

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

export interface Lobby {
  id: string;
  players: Player[];
  seats: number[];
  host: number; //player ingameid
  gameInfo: LobbyGameInfo;
  messages: Message[];
  isPaused: boolean;
  isEnding: boolean;
  state: stateTypes;
}

export interface LobbyServer extends Lobby {
  socketList: string[];
  messageList: Message[];
  timeout: number;
  queuedMessage: Message | null;
}

export interface LobbyClient extends Lobby {
  canShowHoleCards: boolean;
}

export function createLobbyGameInfo(): LobbyGameInfo {
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

export function createLobbyServer(): LobbyServer {
  const seats: number[] = [];
  for (let i = 0; i < 10; i++) seats.push(-1);
  return {
    id: uuidv4(),
    players: [],
    seats: seats,
    host: 0,
    messages: [],
    gameInfo: createLobbyGameInfo(),
    socketList: [],
    messageList: [],
    timeout: -1,
    isPaused: false,
    state: "nothing",
    queuedMessage: null,
    isEnding: false,
  };
}

export function createLobbyClient(id: string): LobbyClient {
  const seats: number[] = [];
  for (let i = 0; i < 10; i++) seats.push(-1);
  return {
    id: id,
    players: [],
    host: 0,
    seats: seats,
    messages: [],
    gameInfo: createLobbyGameInfo(),
    isPaused: false,
    state: "nothing",
    canShowHoleCards: true,
    isEnding: false,
  };
}

export interface Card {
  num: number;
  suit: string;
  numDisplay: string;
}

export interface ChangeChips {
  modifier: "add" | "remove" | "set";
  amount: number;
}

export interface PlayerGameInfo {
  stack: number;
  chipsInPot: number;
  chipsThisRound: number;
  inPot: boolean;
  startedInPot: boolean;
  hasHoleCards: boolean;
  card1: Card;
  card2: Card;
  fullHand: Card[];
  curBestHand: Card[];
  curHandStrength: number;
  away: boolean;
  leaving: boolean;
  kicking: boolean;
  seat: number;
  changeChips: ChangeChips;
}

export function playerGameInfoToString(player: Player, lobby: Lobby) {
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
  if (gameInfo.hasHoleCards)
    s +=
      " | " +
      cardsToString(gameInfo.fullHand) +
      " | " +
      cardsToString(gameInfo.curBestHand) +
      " | " +
      strengthToString(gameInfo.curHandStrength);
  if (
    lobby.state == "waitingForAction" &&
    lobby.gameInfo.curPlayer == player.gameInfo.seat
  )
    s += " <---- this guys turn";
  if (gameInfo.away) s += "<-- THIS GUY IS AWAY";
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
    hasHoleCards: false,
    card1: { num: 999, suit: "?", numDisplay: "?" },
    card2: { num: 999, suit: "?", numDisplay: "?" },
    fullHand: [],
    curBestHand: [],
    curHandStrength: -1,
    away: false,
    startedInPot: false,
    kicking: false,
    leaving: false,
    seat: -1,
    changeChips: { modifier: "add", amount: 0 },
  };
}

export interface PlayerId {
  id: string; //uuid, will be given to backend to verify if this person is allowed to play right now, other players shouldn't ever know
  inGameId: number; //should be the number of players before this player joined, remembered by frontend so it knows what person it is playing and to fill in data easily
  name: string;
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

//only should be called when round is not active
export function getNumInPot(lobby: Lobby): number {
  let np: number = 0;
  for (let i = 0; i < SEATS_NUMBER; i++) {
    if (lobby.seats[i] == -1) continue;
    let player = lobby.players[lobby.seats[i]].gameInfo;
    if (player.stack == 0 || isLeaving(player)) player.away = true;
    if (!player.away) np++;
  }
  return np;
}

export function noActionsLeft(lobby: Lobby): boolean {
  let np: number = 0;
  for (let i = 0; i < lobby.players.length; i++) {
    let player: PlayerGameInfo = lobby.players[i].gameInfo;
    if (player.inPot && player.stack != 0) {
      if (player.chipsInPot != lobby.gameInfo.maxChipsInPot) return false;
      np++;
    }
  }
  return np < 2;
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
  if (lobby.isPaused) return "Lobby is paused";
  switch (message.action) {
    case "start": {
      let numPlayers = getNumInPot(lobby);
      if (numPlayers < 2) {
        console.log(numPlayers);
        return "Not enough players";
      }
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
  isWaitingForAction: boolean;
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
  if (message.action != "start") {
    // console.log(lg.curPlayer);
    // console.log(lobby.seats);
    // console.log(lobby.players);
    // console.log(lobby.players[lobby.seats[lg.curPlayer]].gameInfo);
    curPlayer = lobby.players[lobby.seats[lg.curPlayer]].gameInfo;

    //console.log(lobby.players, lobby.seats, lg.curPlayer);
  }

  switch (message.action) {
    case "start": {
      lobby.isEnding = false;
      return {
        isWaitingForAction: false,
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
          console.log("PLEASE HOW ARE U HERE");
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
    isWaitingForAction: true,
    cards: [],
    calledHandEnd: false,
    cardsShown: [],
  };
  lg.curPlayer = findNext(lobby, lg.curPlayer);
  lobby.state = "waitingForAction";
  if (doneRound) actionResult = endRound(lobby, isClient);
  //implement autocheck if only one person has chips
  console.log("game info", lg.numPlayedThisRound, lg.numInPot, doneRound);
  return actionResult;
}

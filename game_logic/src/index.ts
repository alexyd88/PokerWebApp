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
  setChips,
  showdown,
  takeFromPot,
} from "./logic";
import { strengthToString } from "./handEval";
import { Socket } from "socket.io";
import { SEATS_NUMBER, SIMULATE_SHOWDOWN_TIMES } from "./constants";
import { z } from "zod";

export * from "./logic";
export * from "./handEval";
export * from "./constants";

const messageCommon = z.object({
  id: z.number().int(),
  lobbyId: z.string(),
  date: z.number().int(),
});

const playerIdSchema = z.object({
  playerId: z.object({
    id: z.string(),
    inGameId: z.number().int(),
    name: z.string(),
  }),
});

const messageCommonWithoutPlayerIdSchema = z
  .object({ playerId: z.null() })
  .merge(messageCommon);

const messageCommonWithPlayerIdSchema = playerIdSchema.merge(messageCommon);

const cardSchema = z.object({
  num: z.number().int(),
  suit: z.string(),
  numDisplay: z.string(),
});

const showCardsSchema = z.object({
  inGameId: z.number().int(),
  card1: cardSchema,
  card2: cardSchema,
});

export type ShowCards = z.infer<typeof showCardsSchema>;

const chipsModifierSchema = z.union([
  z.literal("add"),
  z.literal("remove"),
  z.literal("set"),
]);

const changeChipsSchema = z.object({
  modifier: chipsModifierSchema,
  amount: z.number().int(),
});

export const messageSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("chat"), text: z.string() })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({
      type: z.literal("action"),
      action: z.string(),
      content: z.number().int(),
      auto: z.boolean(),
    })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({
      type: z.literal("newCommunityCards"),
      cards: z.array(cardSchema),
    })
    .merge(messageCommonWithoutPlayerIdSchema),
  z
    .object({ type: z.literal("showdown") })
    .merge(messageCommonWithoutPlayerIdSchema),
  z
    .object({
      type: z.literal("showCards"),
      cardsShown: z.array(showCardsSchema),
      public: z.boolean(),
      receiver: z.number().int(),
    })
    .merge(messageCommonWithoutPlayerIdSchema),
  z
    .object({ type: z.literal("reset"), dealerChip: z.number().int() })
    .merge(messageCommonWithoutPlayerIdSchema),
  z
    .object({ type: z.literal("setHost"), inGameId: z.number().int() })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("addPlayer") })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({
      type: z.literal("sitRequest"),
      name: z.string(),
      seat: z.number().int(),
      chips: z.number().int(),
    })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("cancelSitRequest") })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({
      type: z.literal("approveSitRequest"),
      requestId: z.number().int(),
    })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("start") })
    .merge(messageCommonWithoutPlayerIdSchema),
  z
    .object({ type: z.literal("pauseToggle") })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("showMyCards") })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("endGameToggle") })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("end") })
    .merge(messageCommonWithoutPlayerIdSchema),
  z
    .object({ type: z.literal("awayToggle"), inGameId: z.number().int() })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("leavingToggle"), inGameId: z.number().int() })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("kickingToggle"), inGameId: z.number().int() })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("setBigBlind"), bigBlind: z.number().int() })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("straddleToggle") })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({ type: z.literal("setAnte"), ante: z.number().int() })
    .merge(messageCommonWithPlayerIdSchema),
  z
    .object({
      type: z.literal("changeChips"),
      inGameId: z.number().int(),
      changeChips: changeChipsSchema,
    })
    .merge(messageCommonWithPlayerIdSchema),
]);

export type Message = z.infer<typeof messageSchema>;

export function validateMessage(
  message: Message,
  lobbies: Map<string, LobbyServer>
): boolean {
  const lobbyId = message.lobbyId;
  if (!lobbies.has(lobbyId)) return false;
  const lobby = lobbies.get(lobbyId);
  if (lobby == undefined) return false;
  let result = messageSchema.safeParse(message);
  if (!result.success) {
    console.log("EW HACKER NICE TRY FAKE MESSAGE");
    return false;
  }
  if (message.playerId == null) return true;
  if (
    !(message.playerId.inGameId in lobby.players) ||
    lobby.players[message.playerId.inGameId].playerId.id != message.playerId.id
  ) {
    console.log("WRONG PLAYER ID HACKER");
    return false;
  }
  if (message.type == "sitRequest" && !(message.seat in lobby.seats)) {
    console.log("WHERE IS BLUD SITTING?");
    return false;
  }
  if (
    message.type == "approveSitRequest" &&
    !(message.requestId in lobby.seatRequests)
  ) {
    console.log("WHAT ARE U APPROVING?");
    return false;
  }
  if (
    (message.type == "awayToggle" ||
      message.type == "leavingToggle" ||
      message.type == "kickingToggle" ||
      message.type == "changeChips") &&
    !(message.inGameId in lobby.players)
  ) {
    console.log("WHO IS THIS GUY BRO");
    return false;
  }
  return true;
}

export function createMessageAction(
  playerId: PlayerId,
  action: string,
  content: number,
  lobbyId: string,
  auto: boolean
): Message {
  return {
    date: Date.now(),
    playerId: playerId,
    lobbyId: lobbyId,
    id: -1,
    type: "action",
    action: action,
    content: content,
    auto: auto,
  };
}

export function cardsToString(cards: Card[]): string {
  let s: string = "";
  for (let i = 0; i < cards.length; i++)
    s += cards[i].numDisplay + cards[i].suit;
  return s;
}

export function messageToString(message: Message): string {
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

  if (newMessage.playerId == null && newMessage.type != "showCards")
    return newMessage;

  if (newMessage.type == "showCards") {
    if (newMessage.public) return newMessage;
    let newCardsShown: ShowCards[] = [];
    for (let i = 0; i < newMessage.cardsShown.length; i++)
      if (newMessage.cardsShown[i].inGameId == newMessage.receiver)
        newCardsShown = [newMessage.cardsShown[i]];
    newMessage.cardsShown = newCardsShown;
    return newMessage;
  }

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

export function sitRequest(
  lobby: Lobby,
  seat: number,
  name: string,
  chips: number,
  inGameId: number
) {
  lobby.seatRequests.push({
    seat: seat,
    name: name,
    chips: chips,
    inGameId: inGameId,
  });
}

export function cancelSitRequest(lobby: Lobby, inGameId: number) {
  for (let i = 0; i < lobby.seatRequests.length; i++) {
    if (lobby.seatRequests[i].inGameId == inGameId) {
      lobby.seatRequests.splice(i, 1);
      i--;
    }
  }
}

export function getNextEmptySeat(lobby: Lobby, seat: number): number {
  for (let i = seat + 1; i < SEATS_NUMBER; i++)
    if (lobby.seats[i] == -1) return i;
  for (let i = 0; i < seat; i++) if (lobby.seats[i] == -1) return i;
  return -1;
}

export function approveSitRequest(lobby: Lobby, requestId: number) {
  const request: SeatRequest = lobby.seatRequests[requestId];
  sit(lobby, request.inGameId, request.seat, request.name, request.chips);
  lobby.seatRequests.splice(requestId, 1);
  for (let i = 0; i < lobby.seatRequests.length; i++) {
    if (request.seat == lobby.seatRequests[i].seat) {
      let nextSeat = getNextEmptySeat(lobby, lobby.seatRequests[i].seat);
      if (nextSeat == -1) {
        lobby.seatRequests.splice(i, 1);
        i--;
      } else {
        lobby.seatRequests[i].seat = nextSeat;
      }
    }
  }
}

export function seatRequestToString(seatRequest: SeatRequest): string {
  return (
    seatRequest.name +
    " wants to sit at " +
    seatRequest.seat +
    " with " +
    seatRequest.chips +
    " chips"
  );
}

export function sit(
  lobby: Lobby,
  inGameId: number,
  seat: number,
  name: string,
  chips: number
): void {
  if (lobby.seats[seat] != -1) {
    console.log("seat full hacker");
    return;
  }
  let player = lobby.players[inGameId];
  player.playerId.name = name;
  lobby.seats[seat] = inGameId;
  let pg = player.gameInfo;
  setChips(pg, chips);
  pg.seat = seat;
  pg.kicking = false;
  pg.leaving = false;
  pg.startedInPot = false;
  pg.inPot = false;
  pg.away = false;
  pg.timeoutCount = 0;
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

export function getLedgerEntry(player: Player): string {
  const pg = player.gameInfo;
  return (
    player.playerId.name +
    ": " +
    pg.buyIn +
    " " +
    pg.buyOut +
    " " +
    (pg.stack - pg.buyIn + pg.buyOut)
  );
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
  isAllIn: boolean;
  setAllIn: boolean;
  ante: number;
  straddle: boolean;
  sevenDeuce: boolean;
  deck: Card[];
  board: Card[];
}

export interface SeatRequest {
  name: string;
  chips: number;
  seat: number;
  inGameId: number;
}

export interface Lobby {
  id: string;
  players: Player[];
  seats: number[];
  seatRequests: SeatRequest[];
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
    ante: 0,
    straddle: false,
    isAllIn: false,
    setAllIn: false,
    sevenDeuce: false,
    deck: [],
    board: [],
  };
}

export function createLobbyServer(): LobbyServer {
  const seats: number[] = [];
  for (let i = 0; i < SEATS_NUMBER; i++) seats.push(-1);
  return {
    id: uuidv4(),
    players: [],
    seats: seats,
    seatRequests: [],
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
  for (let i = 0; i < SEATS_NUMBER; i++) seats.push(-1);
  return {
    id: id,
    players: [],
    host: 0,
    seats: seats,
    seatRequests: [],
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
  buyIn: number;
  buyOut: number;
  timeoutCount: number; //number of consecutive timeouts
  chipsWon: number; // doesn't include bonuses
  chipsLost: number;
  sevenDeuceNet: number;
  //net is stack - buyIn + buyOut
  probability: number;
}

export function playerGameInfoToString(player: Player, lobby: Lobby) {
  const gameInfo: PlayerGameInfo = player.gameInfo;
  let s = "stack: " + (gameInfo.stack - gameInfo.chipsWon);
  if (gameInfo.chipsWon != 0) s += " + " + gameInfo.chipsWon;
  if (gameInfo.sevenDeuceNet != 0)
    s +=
      " " + (gameInfo.sevenDeuceNet > 0 ? "+ " : "- ") + gameInfo.sevenDeuceNet;
  s +=
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
  let percent = (gameInfo.probability / SIMULATE_SHOWDOWN_TIMES) * 100;
  let percentString = percent.toFixed(1);
  if (percent < 1 && percent != 0) percentString = "<1";
  percentString += "%";
  if (gameInfo.probability != -1) s += " | PROBABILITY:" + percentString;
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
    stack: 0,
    buyIn: 0,
    buyOut: 0,
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
    timeoutCount: 0,
    probability: -1,
    chipsWon: 0,
    chipsLost: 0,
    sevenDeuceNet: 0,
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
  setAllIn: boolean;
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
  if (message.auto && !isClient) curPlayer.timeoutCount++;
  else curPlayer.timeoutCount = 0;
  switch (message.action) {
    case "start": {
      lobby.isEnding = false;
      return {
        isWaitingForAction: false,
        cards: [],
        calledHandEnd: false,
        cardsShown: [],
        setAllIn: false,
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
    setAllIn: false,
  };
  lg.curPlayer = findNext(lobby, lg.curPlayer);
  lobby.state = "waitingForAction";
  if (doneRound) actionResult = endRound(lobby, isClient);
  //implement autocheck if only one person has chips
  console.log("game info", lg.numPlayedThisRound, lg.numInPot, doneRound);
  return actionResult;
}

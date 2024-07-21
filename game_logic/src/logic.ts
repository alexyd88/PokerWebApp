import { Socket } from "socket.io";
import { compareHands, findBestHand, getStrength } from "./handEval";
import {
  ActionResult,
  Card,
  cardsToString,
  ChangeChips,
  leaveSeat,
  Lobby,
  LobbyGameInfo,
  Player,
  PlayerGameInfo,
  SEATS_NUMBER,
  ShowCards,
} from "./index";

export function getRandInt(min: number, max: number) {
  const minCeil = Math.ceil(min);
  const maxFloor = Math.floor(max);
  return Math.floor(Math.random() * (maxFloor - minCeil) + minCeil);
}

export function createCard(num: number, suit: string): Card {
  let card: Card = { num: num, suit: suit, numDisplay: "" };
  if (num < 11) card.numDisplay = "" + num;
  else {
    if (num == 11) card.numDisplay = "J";
    else if (num == 12) card.numDisplay = "Q";
    else if (num == 13) card.numDisplay = "K";
    else if (num == 14) card.numDisplay = "A";
    else card.numDisplay = "?";
  }
  return card;
}

export function updateHoleCards(
  playerInfo: PlayerGameInfo,
  card1: Card,
  card2: Card
) {
  playerInfo.hasHoleCards = true;
  playerInfo.card1 = card1;
  playerInfo.card2 = card2;
  playerInfo.fullHand.push(playerInfo.card1);
  playerInfo.fullHand.push(playerInfo.card2);
}

export function shuffleAndDeal(lobby: Lobby) {
  const deck = lobby.gameInfo.deck;
  const players = lobby.players;
  deck.length = 0;
  for (let i = 2; i <= 14; i++)
    for (let j = 0; j < 4; j++) {
      let suit = "d";
      if (j == 1) suit = "c";
      if (j == 2) suit = "h";
      if (j == 3) suit = "s";
      deck.push(createCard(i, suit));
    }
  for (let i = 0; i < deck.length - 1; i++) {
    const j = getRandInt(i, deck.length);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  for (let i = 0; i < players.length; i++) {
    const card1: Card | undefined = deck.pop();
    const card2: Card | undefined = deck.pop();
    if (card1 == undefined || card2 == undefined) {
      console.log("ran out of cards?? how tf");
      return;
    }
    updateHoleCards(players[i].gameInfo, card1, card2);
  }
}

export function deal(lobby: Lobby, card: Card | null): Card {
  //sleep(500);
  let lg = lobby.gameInfo;
  const newCard = card == null ? (lg.deck.pop() as Card) : card;
  lg.board.push(newCard);
  for (let i = 0; i < lobby.players.length; i++) {
    let player = lobby.players[i].gameInfo;
    if (player.startedInPot) player.fullHand.push(newCard);
  }
  return newCard;
}

export function findNext(lobby: Lobby, position: number) {
  for (let i = position + 1; i < SEATS_NUMBER; i++)
    if (lobby.seats[i] != -1 && lobby.players[lobby.seats[i]].gameInfo.inPot)
      return i;
  for (let i = 0; i < position; i++)
    if (lobby.seats[i] != -1 && lobby.players[lobby.seats[i]].gameInfo.inPot)
      return i;
  return position;
}

export function updatePlayerBestHand(lobby: Lobby) {
  for (let i = 0; i < lobby.players.length; i++) {
    let player = lobby.players[i].gameInfo;
    //console.log("length", player.fullHand.length);
    if (player.fullHand.length >= 5) {
      player.curBestHand = findBestHand(player.fullHand);
      //console.log("set curbesthand to", cardsToString(player.curBestHand));
      player.curHandStrength = getStrength(player.curBestHand);
    } else {
      //console.log("HOW ARE U HERE U HAVE " + cardsToString(player.fullHand));
    }
  }
}

function checkIfShouldShow(
  lobby: Lobby,
  player: PlayerGameInfo,
  bestHand: Card[],
  cardsShown: ShowCards[],
  seat: number
) {
  if (player.inPot && player.fullHand.length == 7) {
    console.log(
      "myhand:",
      cardsToString(player.curBestHand),
      "besthand:",
      cardsToString(bestHand)
    );
    if (compareHands(player.curBestHand, bestHand) != -1) {
      console.log(
        "adding bc",
        bestHand.length == 0,
        compareHands(player.curBestHand, bestHand)
      );
      cardsShown.push({
        inGameId: lobby.players[lobby.seats[seat]].playerId.inGameId,
        card1: player.card1,
        card2: player.card2,
      });
      return player.curBestHand;
    }
  }
  return bestHand;
}

function findShowCards(lobby: Lobby): ActionResult {
  let cardsShown: ShowCards[] = [];
  let lg = lobby.gameInfo;
  if (lg.numInPot < 2) {
    console.log("SHOULDN'T BE POSSIBLE");
    return {
      isWaitingForAction: false,
      cards: [],
      calledHandEnd: true,
      cardsShown: cardsShown,
    };
  }
  let bestHand: Card[] = [];
  if (lg.lastAggressivePerson == -1)
    lg.lastAggressivePerson = findNext(lobby, lg.dealerChip);
  const start = lg.lastAggressivePerson;
  let seat = start;
  let player = lobby.players[lobby.seats[seat]].gameInfo;
  bestHand = checkIfShouldShow(lobby, player, bestHand, cardsShown, seat);
  seat = findNext(lobby, seat);
  while (seat != start) {
    player = lobby.players[lobby.seats[seat]].gameInfo;
    bestHand = checkIfShouldShow(lobby, player, bestHand, cardsShown, seat);
    seat = findNext(lobby, seat);
  }
  return {
    isWaitingForAction: false,
    cards: [],
    calledHandEnd: true,
    cardsShown: cardsShown,
  };
}

export function showdown(lobby: Lobby): ActionResult {
  lobby.state = "showdown";
  let lg = lobby.gameInfo;
  if (lg.numInPot == 1) {
    for (let i = 0; i < lobby.players.length; i++)
      if (lobby.players[i].gameInfo.inPot) {
        takeFromPot(lg, lobby.players[i].gameInfo, lg.totalPot);
      }
    return {
      isWaitingForAction: false,
      cards: [],
      calledHandEnd: true,
      cardsShown: [],
    };
  }

  let actionResult = findShowCards(lobby);

  while (lg.numInPot > 0) {
    let bestHand: Card[] = [];
    let lowestAmt = -1;
    for (let j = 0; j < lobby.players.length; j++) {
      let player = lobby.players[j].gameInfo;
      if (player.inPot) {
        if (lowestAmt == -1) lowestAmt = player.chipsInPot;
        lowestAmt = Math.min(lowestAmt, player.chipsInPot);
        console.log(
          "HEY BRO",
          cardsToString(player.curBestHand),
          cardsToString(bestHand)
        );
        if (compareHands(player.curBestHand, bestHand) == 1)
          bestHand = player.curBestHand;
      }
    }
    console.log("HI");
    const winners: number[] = [];
    let totalPayout = 0;
    for (let j = 0; j < lobby.players.length; j++) {
      let player = lobby.players[j].gameInfo;
      console.log("YO IM HERE PLEASE");
      if (player.inPot) {
        const amt = Math.min(lowestAmt, player.chipsInPot);
        player.chipsInPot -= amt;
        totalPayout += amt;
        // console.log(
        //   bestHand,
        //   player.curBestHand,
        //   compareHands(bestHand, player.curBestHand) == 0
        // );
        if (compareHands(bestHand, player.curBestHand) == 0) winners.push(j);
        if (player.chipsInPot == 0 && player.inPot) {
          lg.numInPot--;
          player.inPot = false;
        }
      }
    }
    const singlePayout = Math.floor(totalPayout / winners.length);
    //console.log(totalPayout, winners.length, singlePayout);
    for (let j = 0; j < winners.length; j++) {
      //console.log(winners[j]);
      let player = lobby.players[winners[j]].gameInfo;
      takeFromPot(lg, player, singlePayout);
      totalPayout -= singlePayout;
    }

    let seat = findNext(lobby, lg.dealerChip);
    let start = seat;
    let player = lobby.players[lobby.seats[seat]].gameInfo;
    const isInWinner = (element: number) => element == lobby.seats[seat];
    if (totalPayout > 0 && winners.findIndex(isInWinner) != -1) {
      takeFromPot(lg, player, totalPayout);
      totalPayout = 0;
    }
    seat = findNext(lobby, seat);
    while (seat != start) {
      player = lobby.players[lobby.seats[seat]].gameInfo;
      if (totalPayout > 0 && winners.findIndex(isInWinner) != -1) {
        takeFromPot(lg, player, totalPayout);
        totalPayout = 0;
      }
      seat = findNext(lobby, seat);
    }
  }

  if (lg.totalPot != 0) {
    console.log("YOOO THERES STILL SHIT IN HERE");
  }
  return actionResult;
}

export function endRound(lobby: Lobby, isClient: boolean): ActionResult {
  let lg = lobby.gameInfo;
  lobby.state = "dealing";
  lg.numPlayedThisRound = 0;
  lg.curRound++;
  lg.curRaise = -1;
  lg.maxChipsThisRound = 0;
  const cards: Card[] = [];
  for (let i = 0; i < lobby.players.length; i++)
    lobby.players[i].gameInfo.chipsThisRound = 0;
  if (!isClient) {
    if (lg.curRound == 1) {
      for (let i = 0; i < 3; i++) cards.push(deal(lobby, null));
      updatePlayerBestHand(lobby);
    } else if (lg.curRound < 4) {
      cards.push(deal(lobby, null));
      updatePlayerBestHand(lobby);
      lg.lastAggressivePerson = -1;
    } else {
      return showdown(lobby);
    }
    if (lg.curRound == 3) lg.lastAggressivePerson = -1;
  }
  return {
    isWaitingForAction: false,
    cards: cards,
    calledHandEnd: false,
    cardsShown: [],
  };
}

export function raise(
  player: PlayerGameInfo,
  lobby: LobbyGameInfo,
  x: number
): void {
  player.chipsThisRound += +x;
  lobby.maxChipsThisRound = Math.max(
    lobby.maxChipsThisRound,
    player.chipsThisRound
  );
  player.stack -= x;
  lobby.totalPot += x;
  player.chipsInPot += +x;
  lobby.maxChipsInPot = Math.max(lobby.maxChipsInPot, player.chipsInPot);
}

export function call(player: PlayerGameInfo, lobby: LobbyGameInfo): void {
  const amt = Math.min(player.stack, lobby.maxChipsInPot - player.chipsInPot);
  player.chipsInPot += +amt;
  player.chipsThisRound += +amt;
  lobby.totalPot += +amt;
  player.stack -= +amt;
}

export function isValidRaise(lobby: Lobby, a: number) {
  let players: Player[] = lobby.players;
  let lg = lobby.gameInfo;
  let player: PlayerGameInfo = players[lobby.seats[lg.curPlayer]].gameInfo;
  if (a - player.chipsThisRound > player.stack) return false;
  if (a - player.chipsThisRound == player.stack) return true;
  if (lg.curRaise == -1) {
    return a >= lg.bigBlind;
  }
  return (
    Number.isInteger(a) &&
    a >= Math.max(lg.maxChipsThisRound + +lg.curRaise, lg.bigBlind)
  );
  //idk if this logic is real tbh
}

export function takeFromPot(
  lobby: LobbyGameInfo,
  player: PlayerGameInfo,
  x: number
) {
  player.stack += +x;
  lobby.totalPot -= +x;
}

export function endGame(lobby: Lobby) {
  endHand(lobby);
  lobby.state = "nothing";
  lobby.gameInfo.gameStarted = false;
}

export function isLeaving(player: PlayerGameInfo): boolean {
  return player.leaving || player.kicking;
}

export function isLeavingString(player: PlayerGameInfo): string {
  if (player.kicking) {
    return "kicked";
  }
  if (player.leaving) {
    return "leaving";
  }
  return "playing";
}

export function updateChips(player: PlayerGameInfo) {
  const amt: number = player.changeChips.amount;
  switch (player.changeChips.modifier) {
    case "add": {
      player.stack += amt;
      player.buyIn += amt;
      break;
    }
    case "remove": {
      player.stack -= amt;
      player.buyOut += amt;
      break;
    }
    case "set": {
      const dif = player.stack - amt;
      player.stack = amt;
      if (dif > 0) player.buyOut += dif;
      else player.buyIn -= dif;
      break;
    }
  }
  player.changeChips = { modifier: "add", amount: 0 };
}

export function setChips(player: PlayerGameInfo, chips: number) {
  player.changeChips = { modifier: "set", amount: chips };
  updateChips(player);
}

export function endHand(lobby: Lobby) {
  let players: Player[] = lobby.players;
  let lg = lobby.gameInfo;
  lobby.state = "waitingForAction";
  lg.numInPot = 0;
  lg.board.length = 0;
  lg.totalPot = 0;
  for (let i = 0; i < lobby.players.length; i++) {
    let player = players[i].gameInfo;
    let seat: number = -1;
    player.chipsInPot = 0;
    player.fullHand.length = 0;
    player.curHandStrength = -1;
    player.curBestHand.length = 0;
    player.chipsThisRound = 0;
    player.hasHoleCards = false;
    updateChips(player);
    player.card1 = { num: 0, numDisplay: "?", suit: "?" };
    player.card2 = { num: 0, numDisplay: "?", suit: "?" };
    for (let j = 0; j < SEATS_NUMBER; j++) if (lobby.seats[j] == i) seat = j;
    if (seat == -1) player.inPot = false;
    if (player.stack == 0) player.leaving = true;
    if (isLeaving(player) && seat != -1) {
      leaveSeat(lobby, i);
    }
    player.inPot = !isLeaving(player);
    player.startedInPot = player.inPot;
    if (player.inPot) lobby.gameInfo.numInPot++;
  }
}

export function resetHand(lobby: Lobby, isClient: boolean, dealerChip: number) {
  console.log("called reset yo");
  lobby.gameInfo.gameStarted = true;
  let players: Player[] = lobby.players;
  let lg = lobby.gameInfo;
  endHand(lobby);
  if (lg.numInPot < 2) {
    endGame(lobby);
    return;
  }
  if (!isClient) {
    lg.dealerChip = findNext(lobby, lg.dealerChip);
  } else {
    lg.dealerChip = dealerChip;
  }
  lg.board.length = 0;
  const sb = findNext(lobby, lg.dealerChip);
  raise(
    players[lobby.seats[sb]].gameInfo,
    lg,
    Math.min(lg.bigBlind / 2, players[lobby.seats[sb]].gameInfo.stack)
  );
  const bb = findNext(lobby, sb);
  raise(
    players[lobby.seats[bb]].gameInfo,
    lg,
    Math.min(lg.bigBlind, players[lobby.seats[bb]].gameInfo.stack)
  );
  lg.curPlayer = findNext(lobby, bb);
  lg.maxChipsInPot = lg.bigBlind;
  lg.maxChipsThisRound = lg.bigBlind;
  lg.curRound = 0;
  lg.curRaise = lg.bigBlind;
  lg.numPlayedThisRound = 0;
  lobby.isEnding = false;
  if (!isClient) shuffleAndDeal(lobby);
}

export function getRandSeat(lobby: Lobby) {
  let numPlayers: number = 0;
  for (let i = 0; i < SEATS_NUMBER; i++) {
    if (lobby.seats[i] != -1 && !lobby.players[lobby.seats[i]].gameInfo.away) {
      numPlayers++;
    }
  }
  let randSeat = getRandInt(0, numPlayers);
  for (let i = 0; i < SEATS_NUMBER; i++) {
    if (lobby.seats[i] != -1 && !lobby.players[lobby.seats[i]].gameInfo.away) {
      if (randSeat == 0) return i;
      randSeat--;
    }
  }
}

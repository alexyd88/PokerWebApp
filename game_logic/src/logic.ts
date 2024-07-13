import { compareHands, findBestHand, getStrength } from "./handEval";
import { Card, Lobby, LobbyGameInfo, Player, PlayerGameInfo } from "./index";

function getRandInt(min: number, max: number) {
  const minCeil = Math.ceil(min);
  const maxFloor = Math.floor(max);
  return Math.floor(Math.random() * (maxFloor - minCeil) + minCeil);
}

function createCard(num: number, suit: string): Card {
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
    const playerInfo: PlayerGameInfo = players[i].gameInfo;
    if (playerInfo.away) continue;
    playerInfo.card1 = card1;
    playerInfo.card2 = card2;
    playerInfo.fullHand.push(playerInfo.card1);
    playerInfo.fullHand.push(playerInfo.card2);

    console.log("dealt");
  }
}

function deal(lobby: Lobby) {
  //sleep(500);
  let lg = lobby.gameInfo;
  const newCard = lg.deck.pop() as Card;
  lg.board.push(newCard);
  for (let i = 0; i < lobby.players.length; i++) {
    lobby.players[i].gameInfo.fullHand.push(newCard);
  }
}

export function findNext(lobby: Lobby, position: number) {
  for (let i = position + 1; i < 10; i++)
    if (lobby.seats[i] != -1 && lobby.players[lobby.seats[i]].gameInfo.inPot)
      return i;
  for (let i = 0; i < position; i++)
    if (lobby.seats[i] != -1 && lobby.players[lobby.seats[i]].gameInfo.inPot)
      return i;
  console.log("u seriously fucked up theres only one person in this lobby");
  return position;
}

function updatePlayerBestHand(lobby: Lobby) {
  for (let i = 0; i < lobby.players.length; i++) {
    let player = lobby.players[i].gameInfo;
    player.curBestHand = findBestHand(player.fullHand);
    player.curHandStrength = getStrength(player.curBestHand);
  }
}

function showdown(lobby: Lobby) {
  let lg = lobby.gameInfo;
  while (lg.numInPot > 0) {
    let bestHand: Card[] = [];
    let lowestAmt = -1;
    for (let j = 0; j < lobby.players.length; j++) {
      let player = lobby.players[j].gameInfo;
      if (player.inPot) {
        if (lowestAmt == -1) lowestAmt = player.chipsInPot;
        lowestAmt = Math.min(lowestAmt, player.chipsInPot);
        if (bestHand.length == 0) bestHand = player.curBestHand;
        if (compareHands(player.curBestHand, bestHand) == 1)
          bestHand = player.curBestHand;
      }
    }

    const winners: number[] = [];
    let totalPayout = 0;
    for (let j = 0; j < lobby.players.length; j++) {
      let player = lobby.players[j].gameInfo;
      const amt = Math.min(lowestAmt, player.chipsInPot);
      player.chipsInPot -= amt;
      totalPayout += amt;
      if (player.inPot && compareHands(bestHand, player.curBestHand) == 0)
        winners.push(j);
      if (player.chipsInPot == 0 && player.inPot) {
        lg.numInPot--;
        player.inPot = false;
      }
    }
    const singlePayout = Math.floor(totalPayout / winners.length);
    console.log(totalPayout, winners.length, singlePayout);
    for (let j = 0; j < winners.length; j++) {
      let player = lobby.players[winners[j]].gameInfo;
      takeFromPot(lg, player, singlePayout);
      totalPayout -= singlePayout;
    }
    for (let j = lg.dealerChip + 1; j < lobby.players.length; j++) {
      const isInWinner = (element: number) => element == j;
      let player = lobby.players[winners[j]].gameInfo;
      if (totalPayout > 0 && winners.findIndex(isInWinner) != -1) {
        takeFromPot(lg, player, totalPayout);
        totalPayout = 0;
      }
    }
    for (let j = 0; j < lg.dealerChip + 1; j++) {
      const isInWinner = (element: number) => element == j;
      if (totalPayout > 0 && winners.findIndex(isInWinner) != -1) {
        let player = lobby.players[winners[j]].gameInfo;
        takeFromPot(lg, player, totalPayout);
        totalPayout = 0;
      }
    }
  }
}

export function endRound(lobby: Lobby) {
  let lg = lobby.gameInfo;
  lg.numPlayedThisRound = 0;
  lg.curRound++;
  lg.curRaise = -1;
  lg.maxChipsThisRound = 0;
  for (let i = 0; i < lobby.players.length; i++)
    lobby.players[i].gameInfo.chipsThisRound = 0;
  if (lg.curRound == 1) {
    for (let i = 0; i < 3; i++) deal(lobby);
    updatePlayerBestHand(lobby);
  } else if (lg.curRound < 4) {
    deal(lobby);
    updatePlayerBestHand(lobby);
  } else {
    showdown(lobby);
    resetHand(lobby);
  }
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

export function resetHand(lobby: Lobby) {
  let players: Player[] = lobby.players;
  let lg = lobby.gameInfo;
  lg.numInPot = 0;
  for (let i = 0; i < lobby.players.length; i++) {
    let player = players[i].gameInfo;
    player.away = player.stack == 0;
    player.inPot = !player.away;
    if (player.inPot) lobby.gameInfo.numInPot++;
    player.chipsInPot = 0;
    player.fullHand.length = 0;
    player.curHandStrength = -1;
    player.curBestHand.length = 0;
    player.chipsThisRound = 0;
  }
  if (lg.numInPot == 1) {
    // end game or something
  }
  lg.dealerChip = findNext(lobby, lg.dealerChip);
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
  lg.curRound = 0;
  lg.curRaise = lg.bigBlind;
  shuffleAndDeal(lobby);
}

export function startLobby(lobby: Lobby) {
  lobby.gameInfo.gameStarted = true;
  resetHand(lobby);
}

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
  const card1: Card | undefined = deck.pop();
  const card2: Card | undefined = deck.pop();
  if (card1 == undefined || card2 == undefined) {
    console.log("ran out of cards?? how tf");
    return;
  }
  for (let i = 0; i < players.length; i++) {
    const playerInfo: PlayerGameInfo = players[i].gameInfo;
    if (playerInfo.away) continue;
    playerInfo.card1 = card1;
    playerInfo.card2 = card2;
    playerInfo.fullHand.push(playerInfo.card1);
    playerInfo.fullHand.push(playerInfo.card2);
  }
}

function findNext(lobby: Lobby, position: number) {
  for (let i = position + 1; i < 10; i++)
    if (lobby.seats[i] != -1 && lobby.players[lobby.seats[i]].gameInfo.inPot)
      return i;
  for (let i = 0; i < position; i++)
    if (lobby.seats[i] != -1 && lobby.players[lobby.seats[i]].gameInfo.inPot)
      return i;
  console.log("u seriously fucked up theres only one person in this lobby");
  return position;
}

function raise(player: PlayerGameInfo, lobby: LobbyGameInfo, x: number): void {
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

function call(player: PlayerGameInfo, lobby: LobbyGameInfo): void {
  const amt = Math.min(player.stack, lobby.maxChipsInPot - player.chipsInPot);
  player.chipsInPot += +amt;
  player.chipsThisRound += +amt;
  lobby.totalPot += +amt;
  player.stack -= +amt;
}

function resetHand(lobby: Lobby) {
  let players: Player[] = lobby.players;
  let lg = lobby.gameInfo;
  lg.numInPot = 0;
  for (let i = 0; i < lobby.players.length; i++) {
    let player = players[i].gameInfo;
    player.inPot = player.stack != 0 && !player.away;
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
    players[sb].gameInfo,
    lg,
    Math.min(lg.bigBlind / 2, players[sb].gameInfo.stack)
  );
  const bb = findNext(lobby, sb);
  raise(
    players[bb].gameInfo,
    lg,
    Math.min(lg.bigBlind, players[bb].gameInfo.stack)
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

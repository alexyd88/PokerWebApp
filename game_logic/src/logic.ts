import { Card, Lobby, LobbyGameInfo, PlayerGameInfo } from "./index";

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

import { Socket } from "socket.io";
import { compareHands, findBestHand, getStrength } from "./handEval";
import {
  ActionResult,
  Card,
  cardsToString,
  ChangeChips,
  getMaxBounty,
  leaveSeat,
  Lobby,
  LobbyGameInfo,
  noActionsLeft,
  Player,
  PlayerGameInfo,
  SEATS_NUMBER,
  ShowCards,
  SIMULATE_SHOWDOWN_TIMES,
  STAND_UP_PAYOUT_PER_BUTTON_BIG_BLINDS,
} from "./index";
import { MersenneTwister19937, Random } from "random-js";

const random = new Random(MersenneTwister19937.autoSeed());

export function getRandInt(min: number, max: number) {
  return random.integer(min, max - 1);
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
  lobby.gameInfo.deck = createDeck();
  const deck = lobby.gameInfo.deck;
  const players = lobby.players;
  shuffle(deck);
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
      setAllIn: false,
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
    setAllIn: false,
  };
}

export function isSevenDeuce(gameInfo: PlayerGameInfo): boolean {
  return (
    (gameInfo.card1.num == 7 && gameInfo.card2.num == 2) ||
    (gameInfo.card2.num == 7 && gameInfo.card1.num == 2)
  );
}

export function handleSevenDeuce(lobby: Lobby, index: number) {
  for (let i = 0; i < lobby.players.length; i++) {
    if (lobby.players[i].gameInfo.startedInPot && i != index) {
      let amt = Math.min(
        lobby.players[i].gameInfo.stack,
        lobby.gameInfo.bigBlind
      );
      lobby.players[i].gameInfo.sevenDeuceNet -= amt;
      lobby.players[index].gameInfo.sevenDeuceNet += amt;
    }
  }
}

export function updateStackWithSevenDeuce(lobby: Lobby) {
  for (let i = 0; i < lobby.players.length; i++)
    lobby.players[i].gameInfo.bountyStack +=
      lobby.players[i].gameInfo.sevenDeuceNet;
}

export function updateStackWithStandUp(lobby: Lobby) {
  for (let i = 0; i < lobby.players.length; i++)
    lobby.players[i].gameInfo.bountyStack +=
      lobby.players[i].gameInfo.standUpNet;
}

export function handleStandUp(lobby: Lobby) {
  let payoutPerButton = 0;
  for (let i = 0; i < lobby.players.length; i++) {
    if (lobby.players[i].gameInfo.standUpButtons == 0) {
      payoutPerButton +=
        STAND_UP_PAYOUT_PER_BUTTON_BIG_BLINDS * lobby.gameInfo.bigBlind;
      lobby.players[i].gameInfo.standUpNet -=
        STAND_UP_PAYOUT_PER_BUTTON_BIG_BLINDS *
        lobby.gameInfo.bigBlind *
        (lobby.gameInfo.standUpPlayers - 1);
    }
  }
  for (let i = 0; i < lobby.players.length; i++) {
    lobby.players[i].gameInfo.standUpNet +=
      payoutPerButton * lobby.players[i].gameInfo.standUpButtons;
    lobby.players[i].gameInfo.inStandUp = false;
    lobby.players[i].gameInfo.standUpButtons = 0;
  }
  updateStackWithStandUp(lobby);
  lobby.gameInfo.standUpButtons = 0;
}

function addButton(lobby: Lobby, id: number) {
  lobby.players[id].gameInfo.standUpButtons++;
  lobby.gameInfo.standUpButtons++;
  if (lobby.gameInfo.standUpButtons == lobby.gameInfo.standUpPlayers - 1)
    handleStandUp(lobby);
}

export function showdown(lobby: Lobby): ActionResult {
  lobby.state = "showdown";
  let lg = lobby.gameInfo;
  if (lg.numInPot == 1) {
    let cardsShown: ShowCards[] = [];
    for (let i = 0; i < lobby.players.length; i++)
      if (lobby.players[i].gameInfo.inPot) {
        if (lobby.gameInfo.standUp) addButton(lobby, i);
        if (
          isSevenDeuce(lobby.players[i].gameInfo) &&
          lobby.gameInfo.sevenDeuce
        ) {
          handleSevenDeuce(lobby, i);
          let gameInfo = lobby.players[i].gameInfo;
          cardsShown = [
            { inGameId: i, card1: gameInfo.card1, card2: gameInfo.card2 },
          ];
        }

        takeFromPot(lg, lobby.players[i].gameInfo, lg.totalPot);
      }
    updateStackWithSevenDeuce(lobby);
    return {
      isWaitingForAction: false,
      cards: [],
      calledHandEnd: true,
      cardsShown: cardsShown,
      setAllIn: false,
    };
  }

  let actionResult = findShowCards(lobby);

  for (let i = 0; i < lobby.players.length; i++) {
    let player = lobby.players[i].gameInfo;
    if (player.inPot) player.chipsLost = player.chipsInPot;
  }
  let isMainPot = true;
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
    const winners: number[] = [];
    let totalPayout = 0;
    for (let j = 0; j < lobby.players.length; j++) {
      let player = lobby.players[j].gameInfo;
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
    if (isMainPot && winners.length == 1) {
      addButton(lobby, winners[0]);
    }
    const singlePayout = Math.floor(totalPayout / winners.length);
    //console.log(totalPayout, winners.length, singlePayout);
    for (let j = 0; j < winners.length; j++) {
      //console.log(winners[j]);
      let player = lobby.players[winners[j]].gameInfo;
      takeFromPot(lg, player, singlePayout);
      totalPayout -= singlePayout;
    }

    updateStackWithSevenDeuce(lobby);
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
    isMainPot = false;
  }
  for (let i = 0; i < lobby.players.length; i++) {
    let player = lobby.players[i].gameInfo;
    if (
      player.chipsWon > player.chipsLost &&
      isSevenDeuce(player) &&
      lobby.gameInfo.sevenDeuce
    ) {
      handleSevenDeuce(lobby, i);
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
  let setAllIn = false;
  if (noActionsLeft(lobby) && !lg.isAllIn && lg.numInPot != 1) {
    setAllIn = true;
    lg.setAllIn = true;
    lg.isAllIn = true;
  }
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
    setAllIn: setAllIn,
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
  player.chipsWon += +x;
  lobby.totalPot -= +x;
}

export function endGame(lobby: Lobby) {
  lobby.state = "nothing";
  lobby.gameInfo.gameStarted = false;
}

export function isLeaving(player: PlayerGameInfo): boolean {
  return player.leaving || player.kicking;
}

export function isLeavingString(player: PlayerGameInfo): string {
  if (player.kicking) {
    return "getting kicked";
  }
  if (player.leaving) {
    return "leaving";
  }
  return "playing";
}

export function updateChips(player: PlayerGameInfo, lobby: Lobby) {
  player.stack += player.bountyStack;
  player.bountyStack = 0;
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
  splitStacks(lobby);
}

export function setChips(player: PlayerGameInfo, chips: number, lobby: Lobby) {
  player.changeChips = { modifier: "set", amount: chips };
  updateChips(player, lobby);
}

export function splitStacks(lobby: Lobby) {
  for (let i = 0; i < lobby.players.length; i++) {
    let player = lobby.players[i].gameInfo;
    const bountyChange = Math.min(
      getMaxBounty(lobby) - player.bountyStack,
      player.stack
    );
    player.bountyStack += bountyChange;
    player.stack -= bountyChange;
  }
}

export function startStandUp(lobby: Lobby) {
  lobby.gameInfo.standUpPlayers = 0;
  for (let i = 0; i < lobby.players.length; i++) {
    let player = lobby.players[i].gameInfo;
    if (!player.away) {
      player.inStandUp = true;
      lobby.gameInfo.standUpPlayers++;
    }
    player.standUpButtons = 0;
  }
}

export function endHand(lobby: Lobby): number[] {
  let players: Player[] = lobby.players;
  let lg = lobby.gameInfo;
  let usersShouldToggleAway = [];
  lobby.state = "waitingForAction";
  lg.numInPot = 0;
  lg.board.length = 0;
  lg.totalPot = 0;
  lg.sevenDeuce = lg.setSevenDeuce;
  let startedStandUp = !lg.standUp && lg.setStandUp;
  lg.standUp = lg.setStandUp;
  lg.isAllIn = false;
  splitStacks(lobby);
  for (let i = 0; i < lobby.players.length; i++) {
    let player = players[i].gameInfo;
    let seat: number = -1;
    player.chipsInPot = 0;
    player.fullHand.length = 0;
    player.curHandStrength = -1;
    player.curBestHand.length = 0;
    player.chipsThisRound = 0;
    player.hasHoleCards = false;
    player.probability = -1;
    player.chipsWon = 0;
    player.chipsLost = 0;
    player.sevenDeuceNet = 0;
    player.standUpNet = 0;
    updateChips(player, lobby);
    player.card1 = { num: 0, numDisplay: "?", suit: "?" };
    player.card2 = { num: 0, numDisplay: "?", suit: "?" };
    for (let j = 0; j < SEATS_NUMBER; j++) if (lobby.seats[j] == i) seat = j;
    if (seat == -1) player.inPot = false;
    if (player.stack <= 0) player.away = true;

    if (player.timeoutCount >= 4) {
      if (!player.away) usersShouldToggleAway.push(i);
      player.away = true;
    }

    if (isLeaving(player) && seat != -1) {
      leaveSeat(lobby, i);
    }
    player.inPot = !isLeaving(player) && !player.away;
    player.startedInPot = player.inPot;
    if (player.inPot) {
      lobby.gameInfo.numInPot++;
    }
  }
  if (startedStandUp) {
    startStandUp(lobby);
  }
  return usersShouldToggleAway;
}

export function resetHand(lobby: Lobby, isClient: boolean, dealerChip: number) {
  console.log("called reset yo");
  lobby.gameInfo.gameStarted = true;
  let players: Player[] = lobby.players;
  let lg = lobby.gameInfo;
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
  let sb = findNext(lobby, lg.dealerChip);
  if (lg.numInPot == 2) sb = lg.dealerChip;
  for (let i = 0; i < SEATS_NUMBER; i++)
    if (lobby.seats[i] != -1 && players[lobby.seats[i]].gameInfo.inPot)
      raise(
        players[lobby.seats[i]].gameInfo,
        lg,
        Math.min(lg.ante, players[lobby.seats[i]].gameInfo.stack)
      );
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
  const straddle = findNext(lobby, bb);
  if (lg.straddle && sb != straddle) {
    raise(
      players[lobby.seats[straddle]].gameInfo,
      lg,
      Math.min(lg.bigBlind * 2, players[lobby.seats[straddle]].gameInfo.stack)
    );
    lg.curPlayer = findNext(lobby, straddle);
  } else lg.curPlayer = findNext(lobby, bb);
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

export function createDeck(): Card[] {
  let deck: Card[] = [];
  for (let i = 2; i <= 14; i++)
    for (let j = 0; j < 4; j++) {
      let suit = "d";
      if (j == 1) suit = "c";
      if (j == 2) suit = "h";
      if (j == 3) suit = "s";
      deck.push(createCard(i, suit));
    }
  return deck;
}

function rigDeck(deck: Card[]) {
  deck[deck.length - 1].num = 7;
  deck[deck.length - 1].numDisplay = "7";
  deck[deck.length - 2].num = 2;
  deck[deck.length - 2].numDisplay = "2";
}

export function shuffle(deck: Card[]) {
  for (let i = 0; i < deck.length - 1; i++) {
    const j = getRandInt(i, deck.length);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  //rigDeck(deck);
}

export function cardsEqual(card1: Card, card2: Card): boolean {
  return card1.num == card2.num && card1.suit == card2.suit;
}

export function updateProbabilities(lobby: Lobby) {
  let deck: Card[] = createDeck();
  let remainingDeck: Card[] = [];
  let players = lobby.players;
  for (let i = 0; i < 52; i++) {
    let shouldRemove = false;
    for (let j = 0; j < players.length; j++) {
      if (players[j].gameInfo.inPot) {
        if (!players[j].gameInfo.hasHoleCards) {
          console.log("NAH WTF");
        }
        if (
          cardsEqual(players[j].gameInfo.card1, deck[i]) ||
          cardsEqual(players[j].gameInfo.card2, deck[i])
        )
          shouldRemove = true;
      }
    }
    for (let j = 0; j < lobby.gameInfo.board.length; j++) {
      if (cardsEqual(lobby.gameInfo.board[j], deck[i])) shouldRemove = true;
    }
    if (!shouldRemove) {
      remainingDeck.push(deck[i]);
    }
  }
  shuffle(remainingDeck);
  let fullHands: Card[][] = [];
  for (let i = 0; i < players.length; i++) {
    if (players[i].gameInfo.inPot) {
      fullHands.push(JSON.parse(JSON.stringify(players[i].gameInfo.fullHand)));
      players[i].gameInfo.probability = 0;
    } else fullHands.push([]);
  }
  const numCardsNeeded = 5 - lobby.gameInfo.board.length;
  for (let i = 0; i < SIMULATE_SHOWDOWN_TIMES; i++) {
    let newCardIndices = [];
    while (newCardIndices.length < numCardsNeeded) {
      const index = getRandInt(0, remainingDeck.length);
      let good = true;
      for (let i = 0; i < newCardIndices.length; i++)
        if (newCardIndices[i] == index) good = false;
      if (good) newCardIndices.push(index);
    }
    let newCards = [];
    for (let i = 0; i < numCardsNeeded; i++)
      newCards.push(remainingDeck[newCardIndices[i]]);
    let bestHands = [];
    for (let i = 0; i < fullHands.length; i++) {
      for (let j = 0; j < newCards.length; j++) fullHands[i].push(newCards[j]);
      if (fullHands[i].length == 7) bestHands.push(findBestHand(fullHands[i]));
      else bestHands.push([]);
    }
    let winners = 0;
    let cb = -1;
    for (let i = 0; i < bestHands.length; i++) {
      if (bestHands[i].length == 5) {
        if (cb == -1) {
          cb = i;
          continue;
        }
        let cH = compareHands(bestHands[cb], bestHands[i]);
        if (cH == -1) cb = i;
      }
    }
    for (let i = 0; i < bestHands.length; i++) {
      if (bestHands[i].length == 5) {
        let cH = compareHands(bestHands[cb], bestHands[i]);
        if (cH == 0) winners++;
      }
    }
    if (cb != -1 && winners == 1) players[cb].gameInfo.probability++;
    else {
      console.log("BRO WHAT");
    }

    for (let i = 0; i < fullHands.length; i++) {
      fullHands[i].length = Math.min(fullHands[i].length, 7 - numCardsNeeded);
    }
  }
}

export function toggleSevenDeuce(lobby: Lobby) {
  let lg = lobby.gameInfo;
  lg.setSevenDeuce = !lg.setSevenDeuce;
  if (!lg.gameStarted) {
    lg.sevenDeuce = lg.setSevenDeuce;
  }
}

export function toggleStandUp(lobby: Lobby) {
  let lg = lobby.gameInfo;
  lg.setStandUp = !lg.setStandUp;
  if (!lg.gameStarted) {
    lg.standUp = lg.setStandUp;
    startStandUp(lobby);
    splitStacks(lobby);
  }
}

export function handleJoin(lobby: Lobby, id: number) {
  let player = lobby.players[id].gameInfo;
  if (lobby.gameInfo.standUp) {
    if (!player.inStandUp) {
      player.inStandUp = true;
      lobby.gameInfo.standUpPlayers++;
    }
  }
  splitStacks(lobby);
}

export function toggleAway(lobby: Lobby, id: number) {
  lobby.players[id].gameInfo.away = !lobby.players[id].gameInfo.away;
  if (!lobby.players[id].gameInfo.away) handleJoin(lobby, id);
}

import { Card } from "./index";

const strengths = {
  "": -1,
  "HIGH CARD": 0,
  PAIR: 1,
  "TWO PAIR": 2,
  "THREE OF A KIND": 3,
  STRAIGHT: 4,
  FLUSH: 5,
  "FULL HOUSE": 6,
  "FOUR OF A KIND": 7,
  "STRAIGHT FLUSH": 8,
};

export function strengthToString(strength: number): string {
  for (const [key, value] of Object.entries(strengths)) {
    if (value == strength) return key;
  }
  throw new Error("no strength found");
}

function boolToInt(x: boolean) {
  if (x) return 1;
  return -1;
}

function isFlush(hand: Card[]) {
  for (let i = 1; i < 5; i++) {
    if (hand[i].suit != hand[0].suit) return false;
  }
  return true;
}

function isStraight(hand: Card[]) {
  for (let i = 1; i < 5; i++) {
    if (hand[i].num != hand[i - 1].num + 1) return false;
  }
  return true;
}

function isStraightFlush(hand: Card[]) {
  return isFlush(hand) && isStraight(hand);
}

function isQuads(hand: Card[]) {
  let c = 0;
  for (let i = 0; i < 5; i++) if (hand[2].num == hand[i].num) c++;
  return c == 4;
}

function getQuadKicker(hand: Card[]): number {
  if (hand[0] != hand[1]) return hand[0].num;
  return hand[4].num;
}

function isFullHouse(hand: Card[]) {
  return (
    hand[0].num == hand[1].num &&
    hand[3].num == hand[4].num &&
    (hand[2].num == hand[0].num || hand[2].num == hand[4].num)
  );
}

function getFullHousePair(hand: Card[]): number {
  if (hand[2].num == hand[0].num) return hand[4].num;
  return hand[0].num;
}

function isTrips(hand: Card[]) {
  let c = 0;
  for (let i = 0; i < 5; i++) if (hand[2].num == hand[i].num) c++;
  return c == 3;
}

function getTripsKickers(hand: Card[]): number[] {
  const k: number[] = [];
  for (let i = 0; i < 5; i++)
    if (hand[i].num != hand[2].num) k.push(hand[i].num);
  return k;
}

function isTwoPair(hand: Card[]) {
  let c = 0;
  for (let i = 1; i < 5; i++) if (hand[i].num == hand[i - 1].num) c++;
  return c == 2;
}

function getTwoPairHigh(hand: Card[]): number {
  for (let i = 4; i > 0; i--)
    if (hand[i].num == hand[i - 1].num) return hand[i].num;
  console.log("TWO PAIR FUCKED UP");
  return -1;
}

function getTwoPairLow(hand: Card[]): number {
  for (let i = 1; i < 5; i++)
    if (hand[i].num == hand[i - 1].num) return hand[i].num;
  console.log("TWO PAIR FUCKED UP");
  return -1;
}

function getTwoPairKicker(hand: Card[]): number {
  if (hand[0].num != hand[1].num) return hand[0].num;
  if (hand[2].num != hand[3].num) return hand[2].num;
  return hand[4].num;
}

function isPair(hand: Card[]) {
  let c = 0;
  for (let i = 1; i < 5; i++) if (hand[i].num == hand[i - 1].num) c++;
  return c == 1;
}

function getPair(hand: Card[]): number {
  for (let i = 1; i < 5; i++)
    if (hand[i].num == hand[i - 1].num) return hand[i].num;
  console.log("PAIR FUCKED UP");
  return -1;
}

function getPairKickers(hand: Card[]): number[] {
  const p = getPair(hand);
  const k: number[] = [];
  for (let i = 0; i < 5; i++) if (hand[i].num != p) k.push(hand[i].num);
  return k;
}

function sortBy(a: Card, b: Card) {
  return a.num - b.num;
}

//assumes sorted 5 cards, 1 if a is better, -1 if b is better, 0 for tie
export function compareHands(hand1: Card[], hand2: Card[]) {
  const a = [...hand1];
  const b = [...hand2];
  a.sort(sortBy);
  b.sort(sortBy);
  if (isStraightFlush(a) != isStraightFlush(b))
    return boolToInt(isStraightFlush(a));
  if (isStraightFlush(a) && isStraightFlush(b)) {
    if (a[4].num === b[4].num) return 0;
    return boolToInt(a[4].num > b[4].num);
  }
  if (isQuads(a) != isQuads(b)) return boolToInt(isQuads(a));
  if (isQuads(a) && isQuads(b)) {
    if (a[1].num != b[1].num) return boolToInt(a[1].num > b[1].num);
    if (getQuadKicker(a) != getQuadKicker(b))
      return boolToInt(getQuadKicker(a) > getQuadKicker(b));
    return 0;
  }
  if (isFullHouse(a) != isFullHouse(b)) return boolToInt(isFullHouse(a));
  if (isFullHouse(a) && isFullHouse(b)) {
    if (a[2].num != b[2].num) return boolToInt(a[2].num > b[2].num);
    if (getFullHousePair(a) != getFullHousePair(b))
      return boolToInt(getFullHousePair(a) > getFullHousePair(b));
    return 0;
  }
  if (isFlush(a) != isFlush(b)) return boolToInt(isFlush(a));
  if (isFlush(a) && isFlush(b)) {
    for (let i = 4; i >= 0; i--) {
      if (a[i].num != b[i].num) return boolToInt(a[i].num > b[i].num);
    }
    return 0;
  }
  if (isStraight(a) != isStraight(b)) return boolToInt(isStraight(a));
  if (isStraight(a) && isStraight(b)) {
    if (a[4].num != b[4].num) return boolToInt(a[4].num > b[4].num);
    return 0;
  }
  if (isTrips(a) != isTrips(b)) return boolToInt(isTrips(a));
  if (isTrips(a) && isTrips(b)) {
    if (a[2].num != b[2].num) return boolToInt(a[2].num > b[2].num);
    const ak = getTripsKickers(a);
    const bk = getTripsKickers(b);
    if (ak[1] != bk[1]) return boolToInt(ak[1] > bk[1]);
    if (ak[0] != bk[0]) return boolToInt(ak[0] > bk[0]);
    return 0;
  }
  if (isTwoPair(a) != isTwoPair(b)) return boolToInt(isTwoPair(a));
  if (isTwoPair(a) && isTwoPair(b)) {
    if (getTwoPairHigh(a) != getTwoPairHigh(b))
      return boolToInt(getTwoPairHigh(a) > getTwoPairHigh(b));
    if (getTwoPairLow(a) != getTwoPairLow(b))
      return boolToInt(getTwoPairLow(a) > getTwoPairLow(b));
    if (getTwoPairKicker(a) != getTwoPairKicker(b))
      return boolToInt(getTwoPairKicker(a) > getTwoPairKicker(b));
    return 0;
  }
  if (isPair(a) != isPair(b)) return boolToInt(isPair(a));
  if (isPair(a) && isPair(b)) {
    if (getPair(a) != getPair(b)) return boolToInt(getPair(a) > getPair(b));
    const ak = getPairKickers(a);
    const bk = getPairKickers(b);
    for (let i = 2; i >= 0; i--)
      if (ak[i] != bk[i]) return boolToInt(ak[i] > bk[i]);
    return 0;
  }
  for (let i = 4; i >= 0; i--)
    if (a[i].num != b[i].num) return boolToInt(a[i].num > b[i].num);
  return 0;
}

function findBestHandRecursive(
  fullHand: Card[],
  curBest: Card[],
  index: number,
  curHand: Card[]
): Card[] {
  if (index == fullHand.length) return curBest;
  curHand.push(fullHand[index]);
  if (curHand.length == 5) {
    if (compareHands(curHand, curBest) == 1) curBest = [...curHand];
  } else {
    curBest = findBestHandRecursive(fullHand, curBest, index + 1, curHand);
  }
  curHand.pop();
  curBest = findBestHandRecursive(fullHand, curBest, index + 1, curHand);
  return curBest;
}

export function findBestHand(hand: Card[]): Card[] {
  let curBest: Card[] = [];
  for (let i = 0; i < 5; i++) curBest.push(hand[i]);
  const curHand: Card[] = [];
  curBest = findBestHandRecursive(hand, curBest, 0, curHand);
  return curBest;
}

export function getStrength(h: Card[]): number {
  const hand = [...h];
  hand.sort(sortBy);
  if (isStraightFlush(hand)) return strengths["STRAIGHT FLUSH"];
  if (isQuads(hand)) return strengths["FOUR OF A KIND"];
  if (isFullHouse(hand)) return strengths["FULL HOUSE"];
  if (isFlush(hand)) return strengths["FLUSH"];
  if (isStraight(hand)) return strengths["STRAIGHT"];
  if (isTrips(hand)) return strengths["THREE OF A KIND"];
  if (isTwoPair(hand)) return strengths["TWO PAIR"];
  if (isPair(hand)) return strengths["PAIR"];
  return strengths["HIGH CARD"];
}

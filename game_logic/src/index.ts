export type Foo = 0 | 1;

export function bar(baz: string) {
  return 7;
}

// import from "types"
// function gameMove(lobby: Lobby, a: Action) {
//     if (!gameStarted) {
//       displayWarning("Game hasn't started!");
//       return;
//     }
//     numPlayedThisRound++;
//     curPlayer %= players.length;
//     const p = players[curPlayer];
//     if (a.type == "raise") {
//       if (isValidRaise(a.value, p.stack)) {
//         curRaise = Math.max(curRaise, a.value - maxChipsThisRound);
//         p.raise(a.value - players[curPlayer].chipsThisRound);
//       } else {
//         numPlayedThisRound--;
//         displayWarning(
//           "Invalid Raise, must raise to at least " +
//             Math.max(maxChipsThisRound + curRaise, bigBlind) +
//             " and up to "
//         );
//         return;
//       }
//     }
//     if (a.type == "call") {
//       p.call();
//     }
//     if (a.type == "check") {
//       if (
//         players[curPlayer].chipsThisRound != maxChipsThisRound &&
//         players[curPlayer].stack != 0
//       ) {
//         numPlayedThisRound--;
//         displayWarning("Cannot check");
//         return;
//       }
//     }
//     if (a.type == "fold") {
//       players[curPlayer].inPot = false;
//       numInPot--;
//       if (numInPot == 1) {
//         for (let i = 0; i < players.length; i++)
//           if (players[i].inPot) {
//             players[i].takeFromPot(totalPot);
//           }
//         resetHand();
//       }
//     }

//     let doneRound = true;
//     if (numPlayedThisRound < numInPot) doneRound = false;
//     else {
//       for (let i = 0; i < players.length; i++) {
//         if (
//           players[i].stack != 0 &&
//           players[i].inPot &&
//           players[i].chipsThisRound != maxChipsThisRound
//         ) {
//           doneRound = false;
//         }
//       }
//     }
//     if (doneRound) endRound();
//     resetControls();
//     changeToNextPlayer();
//     updateMisc();
//     if (players[curPlayer].stack == 0)
//       gameMove(new Action("check", 0, curPlayer, actions.length));
//   }

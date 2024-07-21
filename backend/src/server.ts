/**
 * Initializes mongoose and express.
 */

import "module-alias/register";
import mongoose, { Schema } from "mongoose";
import app from "./app";
import env from "./util/validateEnv";
import { Server } from "socket.io";
import { createServer } from "node:http";
import type {
  ActionResult,
  Lobby,
  LobbyServer,
  Message,
  Player,
  ShowCards,
} from "game_logic";
import {
  approveSitRequest,
  cancelSitRequest,
  createChat,
  createMessageAction,
  createPlayerGameInfo,
  createPlayerId,
  endGame,
  endHand,
  getErrorFromAction,
  getNumInPot,
  getRandSeat,
  isLeaving,
  leaveSeat,
  messageToString,
  NEW_CARD_TIME,
  noActionsLeft,
  prepareMessageForClient,
  resetHand,
  runAction,
  setPlayerNameServer,
  SHOWDOWN_TIME,
  sit,
  sitRequest,
  TURN_TIME,
  updateChips,
} from "game_logic";
import { lobbies } from "./controllers/lobbies";
import { send } from "node:process";

const MONGODB_URI = env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Mongoose connected!");
    app.listen(env.DATABASE_PORT, () => {
      console.log(`Database server running on ${env.DATABASE_PORT}.`);
    });
  })
  .catch(console.error);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN,
  },
});

function addMessage(message: Message) {
  const lobby = lobbies.get(message.lobbyId);
  message.id = lobby.messages.length;
  lobby.messages.push(message);
  console.log(messageToString(message));
  lobby.messageList.push(prepareMessageForClient(lobby, message));
}

function addAndReturn(
  message: Message,
  location: string | null,
  except: string | null,
  wantAdd: boolean
) {
  if (message.date == undefined) console.log(message);
  message.date = Date.now();
  if (location == null) location = message.lobbyId;
  if (wantAdd) addMessage(message);
  else message.id = lobbies.get(message.lobbyId).messages.length;
  if (except == null) {
    io.in(location).emit(
      "message",
      prepareMessageForClient(lobbies.get(message.lobbyId), message)
    );
  } else {
    io.in(location)
      .except(except)
      .emit(
        "message",
        prepareMessageForClient(lobbies.get(message.lobbyId), message)
      );
  }
  console.log(message.type, "WILL SEND TO", location, "EXCEPT", except);
}

function createResetMessage(lobby: LobbyServer): Message {
  let cardMessage: Message = {
    date: Date.now(),
    playerId: null,
    type: "reset",
    lobbyId: lobby.id,
    dealerChip: lobby.gameInfo.dealerChip,
    id: -1,
  };
  return cardMessage;
}

function sendReset(lobby: LobbyServer) {
  resetHand(lobby, false, -1);
  let cardMessage: Message = createResetMessage(lobby);
  addAndReturn(cardMessage, null, null, true);
  cardMessage = {
    date: Date.now(),
    playerId: null,
    type: "showCards",
    cardsShown: [
      {
        inGameId: 0,
        card1: lobby.players[0].gameInfo.card1,
        card2: lobby.players[0].gameInfo.card2,
      },
    ],
    lobbyId: lobby.id,
    id: -1,
  };
  for (let i = 0; i < lobby.players.length; i++) {
    if (lobby.players[i].gameInfo.inPot) {
      cardMessage.cardsShown = [
        {
          inGameId: i,
          card1: lobby.players[i].gameInfo.card1,
          card2: lobby.players[i].gameInfo.card2,
        },
      ];
      addAndReturn(
        cardMessage,
        lobby.socketList[lobby.players[i].playerId.inGameId],
        null,
        false
      );
      cardMessage.cardsShown = [];
      addAndReturn(
        cardMessage,
        lobby.id,
        lobby.socketList[lobby.players[i].playerId.inGameId],
        true
      );
    }
  }
  expectAction(lobby);
}

function sendEndGame(lobby: Lobby) {
  endGame(lobby);
  let endMessage: Message = {
    type: "end",
    date: Date.now(),
    playerId: null,
    lobbyId: lobby.id,
    id: -1,
  };
  addAndReturn(endMessage, null, null, true);
}

function sendEndHand(lobby: LobbyServer) {
  if (lobby.isEnding || getNumInPot(lobby) < 2) {
    sendEndGame(lobby);
    console.log("SENT END GAME");
    return;
  }
  sendReset(lobby);
  console.log("SENT RESET");
}

function sendCardsShown(lobby: Lobby, cardsShown: ShowCards[]) {
  let cardMessage: Message = {
    date: Date.now(),
    type: "showCards",
    cardsShown: cardsShown,
    lobbyId: lobby.id,
    id: -1,
    playerId: null,
  };
  addAndReturn(cardMessage, lobby.id, null, true);
}

//expects curplayer to be real player
function expectAction(lobby: LobbyServer) {
  if (shouldAutoAction(lobby)) {
    handleAutoAction(lobby);
    return;
  }
  clearTimeout(lobby.timeout);
  lobby.state = "waitingForAction";

  let message: Message = getAutoAction(
    lobby,
    lobby.players[lobby.seats[lobby.gameInfo.curPlayer]]
  );

  lobby.timeout = setTimeout(
    handleMessage,
    TURN_TIME,
    message
  ) as unknown as number;
  lobby.queuedMessage = message;
}

function sendCommunityCards(lobby: LobbyServer, message: Message) {
  addAndReturn(message, lobby.id, null, true);
  expectAction(lobby);
}

function getAutoAction(lobby: Lobby, player: Player): Message {
  if (lobby.seats[lobby.gameInfo.curPlayer] != player.playerId.inGameId) {
    console.log("somehow this mf beat the clock barely??");
    return;
  }
  let message: Message = createMessageAction(
    player.playerId,
    "check",
    0,
    lobby.id
  );
  if (message.type != "action") {
    console.log("WTF");
    return;
  }
  let error: string = getErrorFromAction(lobby, message);
  if (error != "success") message.action = "fold";
  error = getErrorFromAction(lobby, message);
  if (error != "success") {
    console.log("how can this guy not do anything??", error);
    return;
  }
  return message;
}

function requeueMessage(lobby: LobbyServer) {
  clearTimeout(lobby.timeout);
  if (lobby.queuedMessage == null) return;
  if (lobby.queuedMessage.type == "action") {
    lobby.timeout = setTimeout(
      handleMessage,
      TURN_TIME,
      lobby.queuedMessage
    ) as unknown as number;
  } else if (lobby.queuedMessage.type == "newCommunityCards") {
    lobby.timeout = setTimeout(
      sendCommunityCards,
      NEW_CARD_TIME,
      lobby,
      lobby.queuedMessage
    ) as unknown as number;
  } else if (lobby.queuedMessage.type == "reset") {
    lobby.timeout = setTimeout(
      sendEndHand,
      SHOWDOWN_TIME,
      lobby
    ) as unknown as number;
  } else {
    console.log("how are u here?", lobby.queuedMessage);
  }
}

function shouldAutoAction(lobby: Lobby) {
  let curPlayer = lobby.players[lobby.seats[lobby.gameInfo.curPlayer]].gameInfo;
  return (
    curPlayer.away ||
    curPlayer.leaving ||
    curPlayer.kicking ||
    noActionsLeft(lobby)
  );
}

function handleAutoAction(lobby: Lobby) {
  if (!lobby.gameInfo.gameStarted) return;
  if (shouldAutoAction(lobby)) {
    handleMessage(
      getAutoAction(lobby, lobby.players[lobby.seats[lobby.gameInfo.curPlayer]])
    );
  }
}

function handleMessage(message: Message) {
  addAndReturn(message, null, null, true);
  const lobby = lobbies.get(message.lobbyId);
  switch (message.type) {
    case "chat": {
      //nothing special
      break;
    }
    case "setPlayerName": {
      setPlayerNameServer(lobby, message.playerId);
      break;
    }
    case "sitRequest": {
      sitRequest(
        lobby,
        message.seat,
        message.name,
        message.chips,
        message.playerId.inGameId
      );
      if (message.playerId.inGameId == lobby.host) {
        let newMessage: Message = {
          type: "approveSitRequest",
          id: -1,
          lobbyId: lobby.id,
          date: Date.now(),
          playerId: message.playerId,
          requestId: lobby.seatRequests.length - 1,
        };
        handleMessage(newMessage);
      }
      break;
    }
    case "cancelSitRequest": {
      cancelSitRequest(lobby, message.playerId.inGameId);
      break;
    }
    case "approveSitRequest": {
      approveSitRequest(lobby, message.requestId);
      break;
    }
    case "pauseToggle": {
      if (lobby.isPaused) {
        lobby.isPaused = false;
        requeueMessage(lobby);
      } else {
        lobby.isPaused = true;
        clearTimeout(lobby.timeout);
      }
      break;
    }
    case "endGameToggle": {
      lobby.isEnding = !lobby.isEnding;
      break;
    }
    case "setHost": {
      lobby.host = message.inGameId;
      break;
    }
    case "awayToggle": {
      lobby.players[message.inGameId].gameInfo.away =
        !lobby.players[message.inGameId].gameInfo.away;
      if (
        lobby.players[message.inGameId].gameInfo.away &&
        message.inGameId == lobby.seats[lobby.gameInfo.curPlayer]
      )
        handleAutoAction(lobby);
      break;
    }
    case "leavingToggle": {
      lobby.players[message.inGameId].gameInfo.leaving =
        !lobby.players[message.inGameId].gameInfo.leaving;
      handleAutoAction(lobby);
      if (
        lobby.players[message.inGameId].gameInfo.leaving &&
        !lobby.gameInfo.gameStarted
      )
        leaveSeat(lobby, message.inGameId);
      break;
    }
    case "kickingToggle": {
      lobby.players[message.inGameId].gameInfo.kicking =
        !lobby.players[message.inGameId].gameInfo.kicking;
      handleAutoAction(lobby);
      if (
        lobby.players[message.inGameId].gameInfo.kicking &&
        !lobby.gameInfo.gameStarted
      )
        leaveSeat(lobby, message.inGameId);
      break;
    }
    case "changeChips": {
      lobby.players[message.inGameId].gameInfo.changeChips =
        message.changeChips;
      if (!lobby.gameInfo.gameStarted)
        updateChips(lobby.players[message.inGameId].gameInfo);
      break;
    }
    case "showMyCards": {
      let cardsShown: ShowCards[] = [];
      cardsShown.push({
        inGameId: message.playerId.inGameId,
        card1: lobby.players[message.playerId.inGameId].gameInfo.card1,
        card2: lobby.players[message.playerId.inGameId].gameInfo.card2,
      });
      sendCardsShown(lobby, cardsShown);
      break;
    }
    case "action": {
      if (message.type != "action") {
        console.log("WTF");
        return;
      }
      let lobby = lobbies.get(message.lobbyId);
      if (
        (lobby.seats[lobby.gameInfo.curPlayer] != message.playerId.inGameId &&
          message.action != "start") ||
        getErrorFromAction(lobby, message) != "success"
      ) {
        console.log(
          lobby.seats[lobby.gameInfo.curPlayer],
          message.playerId.inGameId,
          getErrorFromAction(lobby, message)
        );
        console.log("U ARE TROLLING ME");
        return;
      }
      const actionResult: ActionResult = runAction(lobby, message, false);

      if (actionResult == null) {
        console.log("WHAT THE FUCK");
        return;
      }
      if (message.action == "start") {
        lobby.gameInfo.dealerChip = getRandSeat(lobby);
        sendEndHand(lobby);
      }

      // new cards
      if (actionResult.cards.length != 0) {
        console.log("NEW CARDS INCOMING");
        const cardMessage: Message = {
          date: Date.now(),
          type: "newCommunityCards",
          playerId: null,
          lobbyId: message.lobbyId,
          id: -1,
          cards: actionResult.cards,
        };
        clearTimeout(lobby.timeout);
        lobby.timeout = setTimeout(
          sendCommunityCards,
          NEW_CARD_TIME,
          lobby,
          cardMessage
        ) as unknown as number;
        lobby.queuedMessage = cardMessage;
      }
      // end of hand
      else if (actionResult.calledHandEnd) {
        let lobby = lobbies.get(message.lobbyId);
        sendCardsShown(lobby, actionResult.cardsShown);
        const showdownMessage: Message = {
          date: Date.now(),
          type: "showdown",
          playerId: null,
          lobbyId: message.lobbyId,
          id: -1,
        };
        addAndReturn(showdownMessage, null, null, true);
        clearTimeout(lobby.timeout);
        lobby.timeout = setTimeout(
          sendEndHand,
          SHOWDOWN_TIME,
          lobby
        ) as unknown as number;
        lobby.queuedMessage = createResetMessage(lobby);
      }
      // just regular move??
      else {
        expectAction(lobby);
      }
      break;
    }
  }
  // console.log(lobby.gameInfo.dealerChip);
  // console.log(lobby.state);
}

io.on("connection", (socket) => {
  console.log("user connected", Date.now());
  socket.on("getMessages", async (lobbyId: string, callback) => {
    //console.log(lobbyId, messageLists.get(lobbyId));
    callback({
      messages: lobbies.get(lobbyId).messageList,
    });
  });
  socket.on("joinLobby", (room: string) => {
    console.log("socket joined:", room);
    socket.join(room);
  });
  socket.on("addPlayer", async (message: Message, callback) => {
    if (message.type != "addPlayer") {
      console.log("how did u get here bro");
      return;
    }
    if (!lobbies.has(message.lobbyId)) {
      console.log("how was lobby not created yet");
      return;
    }
    const lobby = lobbies.get(message.lobbyId);
    let player: Player = {
      playerId: createPlayerId(lobby, "GUEST", message.playerId.id),
      gameInfo: createPlayerGameInfo(),
    };
    let err: boolean = false;
    if (lobby.players.length != message.playerId.inGameId) {
      console.log("RACE CONDITION OMG");
      err = true;
    } else {
      lobby.players.push(player);
      lobby.socketList.push(socket.id);
      addAndReturn(message, null, null, true);
    }

    callback({
      err: err,
    });
  });

  socket.on("message", (message: Message) => {
    message.date = Date.now();
    handleMessage(message);
  });
});

server.listen(env.SOCKET_PORT, () => {
  console.log(`Socket server running on ${env.SOCKET_PORT}.`);
});

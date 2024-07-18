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
  createChat,
  createMessageAction,
  createPlayerGameInfo,
  createPlayerId,
  getErrorFromAction,
  messageToString,
  NEW_CARD_TIME,
  prepareMessageForClient,
  resetHand,
  runAction,
  setPlayerNameServer,
  SHOWDOWN_TIME,
  sit,
  TURN_TIME,
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

function sendReset(lobby: LobbyServer, message: Message) {
  let cardMessage: Message = {
    date: Date.now(),
    playerId: null,
    type: "reset",
    lobbyId: message.lobbyId,
    id: -1,
  };
  addAndReturn(cardMessage, null, null, true);
  cardMessage = {
    date: Date.now(),
    playerId: JSON.parse(JSON.stringify(message.playerId)),
    type: "showCards",
    cardsShown: [
      {
        inGameId: 0,
        card1: lobby.players[0].gameInfo.card1,
        card2: lobby.players[0].gameInfo.card2,
      },
    ],
    lobbyId: message.lobbyId,
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
  clearTimeout(lobby.timeout);
  lobby.timeout = setTimeout(
    autoAction,
    TURN_TIME,
    lobby,
    lobby.players[lobby.seats[lobby.gameInfo.curPlayer]]
  ) as unknown as number;
}

function sendCommunityCards(lobby: LobbyServer, message: Message) {
  addAndReturn(message, lobby.id, null, true);
  expectAction(lobby);
}

function autoAction(lobby: Lobby, player: Player) {
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
  handleMessage(message);
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
    case "sit": {
      sit(lobbies.get(message.lobbyId), message.playerId, message.location);
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
        sendReset(lobby, message);
      }

      // new cards
      if (actionResult.cards.length != 0) {
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
          cardMessage
        );
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
        resetHand(lobby, false);
        clearTimeout(lobby.timeout);
        lobby.timeout = setTimeout(
          sendReset,
          SHOWDOWN_TIME,
          lobby,
          message
        ) as unknown as number;
      }
      // just regular move??
      else {
        expectAction(lobby);
      }
      break;
    }
  }
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

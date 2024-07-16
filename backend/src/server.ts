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
  Message,
  Player,
  ShowCards,
} from "game_logic";
import {
  createChat,
  createPlayerGameInfo,
  createPlayerId,
  getErrorFromAction,
  messageToString,
  prepareMessageForClient,
  resetHand,
  runAction,
  setPlayerNameServer,
  sit,
} from "game_logic";
import { lobbies, messageLists, socketList } from "./controllers/lobbies";
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
  messageLists
    .get(message.lobbyId)
    .push(prepareMessageForClient(lobby, message));
}

function addAndReturn(
  message: Message,
  location: string | null,
  except: string | null,
  wantAdd: boolean
) {
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

function sendReset(lobby: Lobby, message: Message) {
  let cardMessage: Message = {
    playerId: null,
    type: "reset",
    lobbyId: message.lobbyId,
    id: -1,
  };
  addAndReturn(cardMessage, null, null, true);
  cardMessage = {
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
        socketList.get(lobby.id)[lobby.players[i].playerId.inGameId],
        null,
        false
      );
      cardMessage.cardsShown = [];
      addAndReturn(
        cardMessage,
        lobby.id,
        socketList.get(lobby.id)[lobby.players[i].playerId.inGameId],
        true
      );
    }
  }
}

function sendCardsShown(lobby: Lobby, cardsShown: ShowCards[]) {
  let cardMessage: Message = {
    type: "showCards",
    cardsShown: cardsShown,
    lobbyId: lobby.id,
    id: -1,
    playerId: null,
  };
  addAndReturn(cardMessage, lobby.id, null, true);
}

io.on("connection", (socket) => {
  console.log("user connected", Date.now());
  socket.on("getMessages", async (lobbyId: string, callback) => {
    let messages: Message[] = messageLists.get(lobbyId);
    //console.log(lobbyId, messageLists.get(lobbyId));
    callback({
      messages: messages,
    });
  });
  socket.on("joinLobby", (room: string) => {
    console.log("socket joined:", room);
    socket.join(room);
  });
  socket.on("chat", async (message: Message) => {
    if (!lobbies.has(message.lobbyId)) {
      console.log("how was lobby not created yet");
    }
    //console.log(lobbies.get(message.playerId.lobbyId).players);
    addAndReturn(message, null, null, true);
  });
  socket.on("setPlayerName", async (message: Message) => {
    const lobby = lobbies.get(message.lobbyId);
    //console.log(lobby);
    setPlayerNameServer(lobby, message.playerId);
    addAndReturn(message, null, null, true);
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
    //console.log(lobby.players);
    // let alrAdded: boolean = false;
    // for (let i = 0; i < lobby.players.length; i++) {
    //   if (lobby.players[i].playerId.name == message.playerId.name) {
    //     console.log("BIG WARNING WHY MULTIPLE ADDS");
    //     alrAdded = true;
    //   }
    // }
    let err: boolean = false;
    if (lobby.players.length != message.playerId.inGameId) {
      console.log("RACE CONDITION OMG");
      err = true;
    } else {
      lobby.players.push(player);
      socketList.get(message.lobbyId).push(socket.id);
      addAndReturn(message, null, null, true);
    }

    callback({
      err: err,
    });
  });
  socket.on("sit", async (message: Message) => {
    //console.log(message);
    if (message.type != "sit") return;
    sit(lobbies.get(message.lobbyId), message.playerId, message.location);

    addAndReturn(message, null, null, true);
  });
  socket.on("action", async (message: Message) => {
    let lobby = lobbies.get(message.lobbyId);
    if (message.type != "action") {
      console.log("WTF");
      return;
    }
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
    addAndReturn(message, null, null, true);
    if (actionResult.cards.length != 0) {
      const cardMessage: Message = {
        type: "newCommunityCards",
        playerId: null,
        lobbyId: message.lobbyId,
        id: -1,
        cards: actionResult.cards,
      };
      addAndReturn(cardMessage, null, null, true);
    }
    if (message.action == "start") {
      sendReset(lobby, message);
    }
    if (actionResult.calledHandEnd) {
      let lobby = lobbies.get(message.lobbyId);
      sendCardsShown(lobby, actionResult.cardsShown);
      const showdownMessage: Message = {
        type: "showdown",
        playerId: null,
        lobbyId: message.lobbyId,
        id: -1,
      };
      addAndReturn(showdownMessage, null, null, true);
      resetHand(lobby, false);
      setTimeout(sendReset, 3000, lobby, message);
    }
  });
});

server.listen(env.SOCKET_PORT, () => {
  console.log(`Socket server running on ${env.SOCKET_PORT}.`);
});

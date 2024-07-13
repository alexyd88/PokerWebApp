/**
 * Initializes mongoose and express.
 */

import "module-alias/register";
import mongoose, { Schema } from "mongoose";
import app from "./app";
import env from "./util/validateEnv";
import { Server } from "socket.io";
import { createServer } from "node:http";
import type { ActionResult, Lobby, Message, Player } from "game_logic";
import {
  createChat,
  createPlayerGameInfo,
  createPlayerId,
  getErrorFromAction,
  messageToString,
  prepareMessageForClient,
  runAction,
  setPlayerNameServer,
  sit,
  startLobby,
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
  const lobby = lobbies.get(message.playerId.lobbyId);
  message.id = lobby.messages.length;
  lobby.messages.push(message);
  messageLists
    .get(message.playerId.lobbyId)
    .push(prepareMessageForClient(lobby, message));
  console.log(
    "gonna add",
    message.playerId.lobbyId,
    messageToString(prepareMessageForClient(lobby, message))
  );
}

function addAndReturn(
  message: Message,
  location: string | null,
  except: string | null
) {
  if (except == null)
    //this is the main one with the info
    addMessage(message);
  if (location == null) location = message.playerId.lobbyId;
  if (except != null) {
    io.in(location)
      .except(except)
      .emit(
        "message",
        prepareMessageForClient(lobbies.get(message.playerId.lobbyId), message)
      );
  } else {
    io.in(location).emit(
      "message",
      prepareMessageForClient(lobbies.get(message.playerId.lobbyId), message)
    );
  }

  console.log(
    "WILL SEND TO",
    location,
    "EXCEPT",
    location,
    prepareMessageForClient(lobbies.get(message.playerId.lobbyId), message)
  );
}

function sendUpdateHoleCards(lobby: Lobby, message: Message) {
  for (let i = 0; i < lobby.players.length; i++) {
    if (lobby.players[i].gameInfo.fullHand.length != 0) {
      const cardMessage: Message = {
        playerId: message.playerId,
        type: "newCards",
        id: -1,
        cards: lobby.players[i].gameInfo.fullHand,
        isCommunity: false,
      };
      cardMessage.playerId.inGameId = i;
      addAndReturn(
        cardMessage,
        socketList.get(lobby.id)[lobby.players[i].playerId.inGameId],
        null
      );
      cardMessage.cards = [];
      addAndReturn(
        cardMessage,
        null,
        socketList.get(lobby.id)[lobby.players[i].playerId.inGameId]
      );
    }
  }
}

io.on("connection", (socket) => {
  console.log("user connected", Date.now());
  socket.on("getMessages", async (lobbyId: string, callback) => {
    let messages: Message[] = messageLists.get(lobbyId);
    console.log(lobbyId, messageLists.get(lobbyId));
    callback({
      messages: messages,
    });
  });
  socket.on("joinLobby", (room: string) => {
    console.log("socket joined:", room);
    socket.join(room);
  });
  socket.on("chat", async (message: Message) => {
    if (!lobbies.has(message.playerId.lobbyId)) {
      console.log("how was lobby not created yet");
    }
    //console.log(lobbies.get(message.playerId.lobbyId).players);
    addAndReturn(message, null, null);
  });
  socket.on("setPlayerName", async (message: Message) => {
    const lobby = lobbies.get(message.playerId.lobbyId);
    console.log(lobby);
    setPlayerNameServer(lobby, message.playerId);
    addAndReturn(message, null, null);
  });
  socket.on("addPlayer", async (message: Message, callback) => {
    if (message.type != "addPlayer") {
      console.log("how did u get here bro");
      return;
    }
    if (!lobbies.has(message.playerId.lobbyId)) {
      console.log("how was lobby not created yet");
      return;
    }
    const lobby = lobbies.get(message.playerId.lobbyId);
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
      socketList.get(message.playerId.lobbyId).push(socket.id);
      addAndReturn(message, null, null);
    }

    callback({
      err: err,
    });
  });
  socket.on("sit", async (message: Message) => {
    //console.log(message);
    if (message.type != "sit") return;
    sit(
      lobbies.get(message.playerId.lobbyId),
      message.playerId,
      message.location
    );

    addAndReturn(message, null, null);
  });
  socket.on("start", async (message: Message) => {
    let lobby = lobbies.get(message.playerId.lobbyId);
    startLobby(lobby, false);
    addAndReturn(message, null, null);
    sendUpdateHoleCards(lobby, message);
  });
  socket.on("action", async (message: Message) => {
    let lobby = lobbies.get(message.playerId.lobbyId);
    if (
      lobby.seats[lobby.gameInfo.curPlayer] != message.playerId.inGameId ||
      getErrorFromAction(lobby, message) != "success"
    ) {
      console.log("U ARE TROLLING ME");
      return;
    }
    addAndReturn(message, null, null);
    const actionResult: ActionResult = runAction(lobby, message, false);
    if (actionResult == null) {
      console.log("WHAT THE FUCK");
      return;
    }
    if (actionResult.cards.length != 0) {
      const cardMessage: Message = {
        playerId: message.playerId,
        type: "newCards",
        id: -1,
        cards: actionResult.cards,
        isCommunity: true,
      };
      addAndReturn(cardMessage, null, null);
    }
    if (actionResult.calledReset) {
      let lobby = lobbies.get(message.playerId.lobbyId);
      sendUpdateHoleCards(lobby, message);
    }
  });
});

server.listen(env.SOCKET_PORT, () => {
  console.log(`Socket server running on ${env.SOCKET_PORT}.`);
});

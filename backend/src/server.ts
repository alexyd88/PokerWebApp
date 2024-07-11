/**
 * Initializes mongoose and express.
 */

import "module-alias/register";
import mongoose, { Schema } from "mongoose";
import app from "./app";
import env from "./util/validateEnv";
import { Server } from "socket.io";
import { createServer } from "node:http";
import type { Lobby, Message, Player } from "game_logic";
import {
  addPlayer,
  createChat,
  prepareMessageForClient,
  sit,
} from "game_logic";
import { lobbies } from "./controllers/lobbies";
import { bool } from "envalid";

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

function copyMessage(message: Message): Message {
  return JSON.parse(JSON.stringify(message));
}

io.on("connection", (socket) => {
  console.log("user connected", Date.now());
  socket.on("joinLobby", (room: string) => {
    console.log("socket joined:", room);
    socket.join(room);
  });
  socket.on("chat", async (message: Message) => {
    message = copyMessage(message);
    if (!lobbies.has(message.playerId.lobbyId)) {
      console.log("how was lobby not created yet");
    }
    console.log(lobbies.get(message.playerId.lobbyId).players);
    lobbies.get(message.playerId.lobbyId).messages.push(message);
    io.in(message.playerId.lobbyId).emit(
      "message",
      prepareMessageForClient(lobbies.get(message.playerId.lobbyId), message)
    );
  });
  socket.on("addPlayer", async (message: Message, callback) => {
    message = copyMessage(message);
    console.log("gona ad payer");
    if (message.type != "addPlayer") {
      console.log("how did u get here bro");
      return;
    }
    if (!lobbies.has(message.playerId.lobbyId)) {
      console.log("how was lobby not created yet");
      return;
    }
    const newPlayer: Player = addPlayer(
      lobbies.get(message.playerId.lobbyId),
      message.name
    );
    const lobby = lobbies.get(message.playerId.lobbyId);
    console.log(lobby.players);
    let alrAdded: boolean = false;
    for (let i = 0; i < lobby.players.length; i++) {
      if (lobby.players[i].playerId.name == message.name) alrAdded = true;
    }
    if (!alrAdded)
      lobbies.get(message.playerId.lobbyId).players.push(newPlayer);
    const newMessage: Message = JSON.parse(JSON.stringify(message));
    newMessage.playerId = newPlayer.playerId;
    io.in(newMessage.playerId.lobbyId).emit(
      "message",
      prepareMessageForClient(
        lobbies.get(newMessage.playerId.lobbyId),
        newMessage
      )
    );
    console.log(newPlayer);
    callback({
      player: newPlayer,
    });
  });
  socket.on("sit", async (message: Message) => {
    message = copyMessage(message);
    console.log(message);
    if (message.type != "action") return;
    sit(
      lobbies.get(message.playerId.lobbyId),
      message.playerId,
      message.content
    );

    io.in(message.playerId.lobbyId).emit(
      "message",
      prepareMessageForClient(lobbies.get(message.playerId.lobbyId), message)
    );
  });
});

server.listen(env.SOCKET_PORT, () => {
  console.log(`Socket server running on ${env.SOCKET_PORT}.`);
});

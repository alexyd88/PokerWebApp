/**
 * Initializes mongoose and express.
 */

import "module-alias/register";
import mongoose from "mongoose";
import app from "./app";
import env from "./util/validateEnv";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { createMessage } from "./controllers/message";
import { createPlayer } from "./controllers/player";
import type { Message } from "game_logic";
import Player from "./models/player";
import Lobby from "./models/lobby";

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

io.on("connection", (socket) => {
  console.log("user connected");
  socket.on("joinLobby", (room: string) => {
    console.log("socket joined:", room);
    socket.join(room);
  });
  socket.on("message", async (arg: Message) => {
    if (arg.type == "chat") {
      if (arg.player != "GUEST")
        arg.player = (await Player.findById(arg.player)).name;
      console.log("emitting to:" + arg.lobbyId);
      createMessage(arg);
      io.in(arg.lobbyId).emit("message", arg);
    }
  });
  socket.on("createPlayer", async (arg: Message, callback) => {
    createMessage(arg);
    const player = await createPlayer(arg.lobbyId, arg.content);
    //console.log("MY PLAYER WAS CREATED", player._id);
    io.in(arg.lobbyId).emit("message", arg);
    callback({
      player: player,
    });
  });
  socket.on(
    "sit",
    async (gameId: number, seatNumber: number, lobbyId: string) => {
      //do some checking int between 0 and 9 and seat not taken
      const lobby = await Lobby.findById(lobbyId);
      if (lobby.seats[seatNumber] != -1) {
        console.log("someone sitting here");
        return;
      }
      lobby.seats[seatNumber] = gameId;
      await lobby.save();
    }
  );
});

server.listen(env.SOCKET_PORT, () => {
  console.log(`Socket server running on ${env.SOCKET_PORT}.`);
});

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
import type { Message } from "types";

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
  socket.on("message", (arg: Message) => {
    io.in(arg.lobbyId).emit("message", arg);
    console.log("emitting to:" + arg.lobbyId);
    createMessage(arg);
  });
  socket.on("joinLobby", (room: string) => {
    console.log("socket joined:", room);
    socket.join(room);
  });
});

server.listen(env.SOCKET_PORT, () => {
  console.log(`Socket server running on ${env.SOCKET_PORT}.`);
});

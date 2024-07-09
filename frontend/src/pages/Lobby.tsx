import { useParams } from "react-router-dom";
import { getLobby, getMessageBoard } from "../api/lobbies";
import { useEffect, useState } from "react";
import type { Lobby, MessageBoard } from "types";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [haveSetSocket, setHaveSetSocket] = useState<boolean>(false);
  const [messageBoard, setMessageBoard] = useState<MessageBoard | null>(null);
  const handleSubmit = () => {
    socket?.emit("message", lobbyId, "myself", "hello");
    console.log("pushed button, messageBoard: ", messageBoard);
  };

  useEffect(() => {
    if (!haveSetSocket) {
      const socket = io("localhost:3002");
      socket.on("connect", () => {
        console.log(socket.id);
      });
      if (lobbyId != undefined && lobby == null) {
        getLobby(lobbyId).then((result) => {
          setLobby(null);
          if (result.success) {
            setLobby(result.data);
          }
        });
        getMessageBoard(lobbyId).then((result) => {
          setMessageBoard(null);
          if (result.success) {
            setMessageBoard(result.data);
          }
        });
      }

      setSocket(socket);
      setHaveSetSocket(true);
    }
  }, []);
  useEffect(() => {
    const eventListener = (args: unknown[]) => {
      console.log("new message", args[0], args[1], args[2]);
    };
    socket?.on("message", eventListener);
    return () => {
      socket?.off("message", eventListener);
    };
  }, [lobby, lobbyId, socket]);

  return (
    <div>
      {lobby != null ? lobby._id : "loading"}
      <div>
        {messageBoard?.messages.map((message) => {
          return (
            <div>
              {message.player}: {message.content}
            </div>
          );
        })}
      </div>
      <button onClick={handleSubmit}> Say Hi </button>
    </div>
  );
}

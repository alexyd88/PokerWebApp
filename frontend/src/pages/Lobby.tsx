import { useParams } from "react-router-dom";
import { getLobby } from "../api/lobbies";
import { useEffect, useState } from "react";
import type { Lobby } from "types";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const handleSubmit = () => {
    socket?.emit("message", lobbyId, "myself", "hello");
  };

  useEffect(() => {
    const socket = io("localhost:3002");
    socket.on("connect", () => {
      console.log(socket.id);
    });
    setSocket(socket);
  }, []);
  useEffect(() => {
    if (lobbyId != undefined && lobby == null)
      getLobby(lobbyId).then((result) => {
        setLobby(null);
        if (result.success) {
          setLobby(result.data);
        }
      });
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
      <button onClick={handleSubmit}> Say Hi </button>
    </div>
  );
}

import { useParams } from "react-router-dom";
import { getLobby } from "../api/lobbies";
import { useEffect, useState } from "react";
import type { Lobby } from "types";
import { io } from "socket.io-client";

const socket = io("localhost:3002");

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [lobby, setLobby] = useState<Lobby | null>(null);
  useEffect(() => {
    if (socket != null) {
      socket.on("connect", () => {
        console.log(socket.id); // x8WIv7-mJelg7on_ALbx
      });
    }

    if (lobbyId != undefined && lobby == null)
      getLobby(lobbyId).then((result) => {
        setLobby(null);
        if (result.success) {
          setLobby(result.data);
        }
      });
  });

  return <div>{lobby != null ? lobby._id : "loading"}</div>;
}

import { useParams } from "react-router-dom";
import { getLobby } from "../api/lobbies";
import { useEffect, useState } from "react";
import type { Lobby } from "../api/lobbies";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [lobby, setLobby] = useState<Lobby | null>(null);
  useEffect(() => {
    if (lobbyId != undefined)
      getLobby(lobbyId).then((result) => {
        setLobby(null);
        if (result.success) {
          setLobby(result.data);
        }
      });
  });

  return <div>{lobby != null ? lobby._id : "loading"}</div>;
}

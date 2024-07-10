import { useParams } from "react-router-dom";
import { getLobby, getMessageBoard } from "../api/lobbies";
import { useEffect, useState } from "react";
import type { Lobby, MessageBoard, Message, Player } from "game_logic";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [haveSetSocket, setHaveSetSocket] = useState<boolean>(false);
  const [messageBoard, setMessageBoard] = useState<MessageBoard | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  function sendMessage(type: string, content: string) {
    if (lobbyId == null) {
      console.log("how tf is lobbyid null in lobby.tsx");
      return;
    }
    const message: Message = {
      lobbyId: lobbyId,
      player: player == null || player._id == null ? "GUEST" : player._id,
      type: type,
      content: content,
    };
    socket?.emit("message", message);
    if (type == "createPlayer" && player == null) {
      socket?.emit("createPlayer", message, (response: { player: Player }) => {
        setPlayer(response.player);
        console.log("I SET MY PLAYER ", response.player?.seat);
      });
    }
  }
  const sayHiSubmit = () => {
    sendMessage("chat", "hi from " + String(player?._id));
    console.log("lobby: ", lobby?.seats);
  };

  const playerNameSubmit = () => {
    const name: HTMLInputElement = document.getElementById(
      "name"
    ) as HTMLInputElement;
    sendMessage("createPlayer", name.value);
  };

  const sitSubmit = () => {
    if (player == null || player.seat != -1) return;
    const seat: HTMLInputElement = document.getElementById(
      "seat"
    ) as HTMLInputElement;
    const seatNum: number = Number(seat.value);
    // some input validation idk
    if (lobby?.seats[seatNum] != -1) return;
    socket?.emit("sit", player.inGameId, seatNum, lobbyId);
    sendMessage("chat", "im sitting here at seat " + seatNum);
    const newPlayer = JSON.parse(JSON.stringify(player));
    newPlayer.seat = seatNum;
    setPlayer(newPlayer);
  };

  useEffect(() => {
    if (!haveSetSocket) {
      const socket = io("localhost:3002");
      socket.emit("joinLobby", lobbyId);
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
    const eventListener = (arg: Message) => {
      const newMessageBoard: MessageBoard = { messages: [] };
      if (messageBoard != null)
        newMessageBoard.messages = messageBoard?.messages;
      newMessageBoard.messages.push(arg);
      setMessageBoard(newMessageBoard);
      if (lobbyId != undefined)
        getLobby(lobbyId).then((result) => {
          setLobby(null);
          if (result.success) {
            setLobby(result.data);
          }
        });
      console.log("new message", arg.player, arg.content);
    };
    socket?.on("message", eventListener);
    return () => {
      socket?.off("message", eventListener);
    };
  }, [lobby, lobbyId, socket, messageBoard, haveSetSocket]);

  return (
    <div>
      {player != null
        ? "name: " + player.name + " seat: " + player.seat
        : "placeholder, join below"}
      <div>
        {messageBoard?.messages.map((message, index) => {
          return (
            <div key={index}>
              {message.player}: {message.type}: {message.content}
            </div>
          );
        })}
      </div>
      {lobby?.seats.map((user, index) => {
        return <li key={index}>{user}</li>;
      })}

      <input type="text" id="name" />
      <button onClick={playerNameSubmit}>join</button>
      <button onClick={sayHiSubmit}> Say Hi </button>
      <input type="text" id="seat" />
      <button onClick={sitSubmit}>sit</button>
    </div>
  );
}

import { useParams } from "react-router-dom";
import { getLobby, getMessageBoard } from "../api/lobbies";
import { SetStateAction, useEffect, useState } from "react";
import type { Lobby, MessageBoard, Message, Player } from "types";
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
    if (type == "createPlayer") {
      socket?.emit("createPlayer", message, (response: { player: Player }) => {
        setPlayer(response.player);
        console.log("I SET MY PLAYER ", player?._id);
      });
    }
  }
  const sayHiSubmit = () => {
    sendMessage("chat", "hi from " + String(player?._id));
    console.log("lobby: ", lobby?.players);
  };

  const playerNameSubmit = () => {
    const name: HTMLInputElement = document.getElementById(
      "name"
    ) as HTMLInputElement;
    sendMessage("createPlayer", name.value);
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
      console.log(newMessageBoard?.messages);
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
      {lobby != null ? lobby._id : "loading"}
      <div>
        {messageBoard?.messages.map((message, index) => {
          return (
            <div key={index}>
              {message.player}: {message.type}: {message.content}
            </div>
          );
        })}
      </div>
      <input type="text" id="name" />
      <button onClick={playerNameSubmit}>join</button>
      <button onClick={sayHiSubmit}> Say Hi </button>
    </div>
  );
}

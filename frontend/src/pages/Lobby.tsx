import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Lobby, Message, Player, PlayerId } from "game_logic";
import {
  createLobbyClient,
  addPlayer,
  createChat,
  createAction,
  validateSeat,
  sit,
  addExistingPlayer,
  messageToString,
  createPlayerId,
} from "game_logic";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [reactLobby, setLobby] = useState<Lobby | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  function playerNameSubmit() {
    handleButton("playerSubmit");
  }
  function sayHiSubmit() {
    handleButton("sayHi");
  }
  function sitSubmit() {
    handleButton("sitSubmit");
  }
  function handleButton(button: string) {
    const lobby = JSON.parse(JSON.stringify(reactLobby));
    console.log("playerId", playerId);
    console.log("lobby", lobby);
    switch (button) {
      case "sayHi": {
        if (playerId != null && lobby != null) {
          const message: Message = createChat(playerId, "hi");
          socket?.emit("chat", message);
        }
        break;
      }
      case "playerSubmit": {
        const name: HTMLInputElement = document.getElementById(
          "name"
        ) as HTMLInputElement;
        if (name.value.length > 0 && playerId == null && lobby != null) {
          const message: Message = {
            type: "addPlayer",
            id: -1,
            name: name.value,
            playerId: createPlayerId(lobby, name.value),
          };
          socket?.emit(
            "addPlayer",
            message,
            (response: { playerId: PlayerId }) => {
              setPlayerId(response.playerId);
            }
          );
        } else {
          console.log(
            "something wrong player submit",
            name.value.length > 0,
            playerId == null,
            lobby != null
          );
        }
        break;
      }
      case "sitSubmit": {
        const seat: HTMLInputElement = document.getElementById(
          "seat"
        ) as HTMLInputElement;
        const seatNum = Number(seat.value);
        if (
          playerId != null &&
          lobby != null &&
          validateSeat(lobby, playerId, seatNum)
        ) {
          const message: Message = createAction(playerId, "sit", seatNum);
          socket?.emit("sit", message);
        }
        break;
      }
    }
    setLobby(lobby);
  }

  useEffect(() => {
    function replay(socket: Socket | null): void {
      console.log("gonna replay");
      if (lobbyId == undefined) {
        console.log("how tf");
        return;
      }
      socket?.emit(
        "getMessages",
        lobbyId,
        (response: { messages: Message[] }) => {
          let lobby: Lobby = createLobbyClient(lobbyId, response.messages);
          for (let i = 0; i < response.messages.length; i++)
            handleMessage(response.messages[i], lobby);
          setLobby(lobby);
        }
      );
    }

    if (lobbyId != undefined && reactLobby == null) {
      console.log(new Date());
      const socket = io("localhost:3002");
      socket.emit("joinLobby", lobbyId);
      replay(socket);
      setSocket(socket);
    }

    function handleMessage(message: Message, lobby: Lobby) {
      console.log("received", message);
      switch (message.type) {
        case "chat": {
          //nothing special really
          break;
        }
        case "action": {
          switch (message.action) {
            case "sit": {
              console.log(message.playerId.inGameId, lobby.players);
              sit(
                lobby,
                lobby.players[message.playerId.inGameId].playerId,
                message.content
              );
              break;
            }
          }
          break;
        }
        case "addPlayer": {
          addExistingPlayer(lobby, message.playerId);
          break;
        }
      }
    }

    function handleNewMessage(message: Message) {
      const lobby = JSON.parse(JSON.stringify(reactLobby));
      if (message.id != lobby.messages.length) replay(socket);
      handleMessage(message, lobby);
      lobby.messages.push(message);
      setLobby(lobby);
    }
    const eventListener = (message: Message) => {
      if (reactLobby == null) {
        console.log("BROTHER HOW IS LOBBY NULL");
        return;
      }
      handleNewMessage(message);
      console.log("recieved", message);
    };
    socket?.on("message", eventListener);
    return () => {
      socket?.off("message", eventListener);
    };
  }, [lobbyId, reactLobby]);

  return (
    <div>
      yo
      {playerId != null
        ? "name: " + playerId.name + " seat: " + playerId.seat
        : "placeholder, join below"}
      <div>
        <div>hello?</div>
        {reactLobby?.messages.map((message, index) => {
          return <div key={index}>{messageToString(message)}</div>;
        })}
      </div>
      {reactLobby?.seats.map((user, index) => {
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

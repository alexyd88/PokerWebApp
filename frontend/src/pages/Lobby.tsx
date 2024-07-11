import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Lobby, Message, Player } from "game_logic";
import {
  createLobbyClient,
  addPlayer,
  createChat,
  createAction,
  validateSeat,
  sit,
  addExistingPlayer,
  messageToString,
} from "game_logic";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [reactLobby, setLobby] = useState<Lobby | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
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
    console.log("player", player);
    console.log("lobby", lobby);
    switch (button) {
      case "sayHi": {
        if (player != null && lobby != null) {
          const message: Message = createChat(player.playerId, "hi");
          socket?.emit("chat", message);
        }
        break;
      }
      case "playerSubmit": {
        const name: HTMLInputElement = document.getElementById(
          "name"
        ) as HTMLInputElement;
        if (
          name.value.length > 0 &&
          player == null &&
          lobby != null &&
          lobbyId != null
        ) {
          let player: Player = addPlayer(lobby, name.value);
          const message: Message = {
            type: "addPlayer",
            id: -1,
            name: name.value,
            playerId: player.playerId,
          };
          console.log("gonna addplayer");
          socket?.emit("addPlayer", message, (response: { player: Player }) => {
            player = response.player;
            console.log("SET PLAYER", response.player);
            setPlayer(player);
            console.log("set player");
          });
        } else {
          console.log("something wrong player submit");
        }
        break;
      }
      case "sitSubmit": {
        const seat: HTMLInputElement = document.getElementById(
          "seat"
        ) as HTMLInputElement;
        const seatNum = Number(seat.value);
        if (
          player != null &&
          lobby != null &&
          validateSeat(lobby, player.playerId, seatNum)
        ) {
          const message: Message = createAction(
            player.playerId,
            "sit",
            seatNum
          );
          socket?.emit("sit", message);
        }
        break;
      }
    }
    setLobby(lobby);
  }
  useEffect(() => {
    if (lobbyId != undefined && reactLobby == null) {
      console.log(new Date());
      const socket = io("localhost:3002");
      socket.emit("joinLobby", lobbyId);
      socket?.emit(
        "getMessages",
        lobbyId,
        (response: { messages: Message[] }) => {
          setLobby(createLobbyClient(lobbyId, response.messages));
        }
      );
      setSocket(socket);
    }
    function handleMessage(message: Message) {
      const lobby = JSON.parse(JSON.stringify(reactLobby));
      lobby.messages.push(message);
      console.log("received", message);
      switch (message.type) {
        case "chat": {
          //nothing special really
          break;
        }
        case "action": {
          switch (message.action) {
            case "sit": {
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
          if (message.playerId.inGameId == lobby.players.length - 1) break;
          const player: Player = addExistingPlayer(lobby, message.playerId);
          lobby.players.push(player);
          break;
        }
      }
      setLobby(lobby);
    }
    const eventListener = (message: Message) => {
      if (reactLobby == null) {
        console.log("BROTHER HOW IS LOBBY NULL");
        return;
      }
      handleMessage(message);
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
      {player != null
        ? "name: " + player.playerId.name + " seat: " + player.playerId.seat
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

import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Lobby, Message, PlayerId } from "game_logic";
import {
  playerGameInfoToString,
  createLobbyClient,
  createChat,
  validateSeat,
  sit,
  addExistingPlayer,
  messageToString,
  createPlayerId,
  startLobby,
  setPlayerNameClient,
  createMessageAction,
  runAction,
  getErrorFromAction,
} from "game_logic";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [reactLobby, setReactLobby] = useState<Lobby | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [reactPlayerId, setPlayerId] = useState<PlayerId | null>(null);
  let lobby: Lobby = createLobbyClient("LMAO DUMBASS");
  let playerId: PlayerId | null = null;
  if (lobbyId != null) lobby = createLobbyClient(lobbyId);
  function displayWarning(warning: string) {
    const illegalWarning = document.getElementById("illegal");
    if (illegalWarning !== null) {
      illegalWarning.textContent = warning;
      console.log("SET WARNING");
    }
  }
  function playerNameSubmit() {
    handleButton("playerSubmit");
  }
  function sayHiSubmit() {
    handleButton("sayHi");
  }
  function sitSubmit() {
    handleButton("sitSubmit");
  }
  function startSubmit() {
    handleButton("startSubmit");
  }
  function raise() {
    handleButton("raise");
  }
  function call() {
    handleButton("call");
  }
  function fold() {
    handleButton("fold");
  }
  function check() {
    handleButton("check");
  }

  function handleButton(button: string) {
    lobby = JSON.parse(JSON.stringify(reactLobby));
    playerId = JSON.parse(JSON.stringify(reactPlayerId));
    console.log("playerId", playerId);
    console.log("lobby", lobby);
    if (playerId == null) {
      console.log("HOWTF");
      return;
    }
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
        if (name.value.length > 0 && playerId != null) {
          playerId.name = name.value;
          const message: Message = {
            type: "setPlayerName",
            id: -1,
            playerId: playerId,
          };
          socket?.emit("setPlayerName", message);
        } else {
          console.log(
            "something wrong player submit",
            name.value.length > 0,
            playerId != null,
            lobby != null
          );
          displayWarning("couldn't change name");
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
          const message: Message = {
            type: "sit",
            location: seatNum,
            id: -1,
            playerId: playerId,
          };
          socket?.emit("sit", message);
        } else {
          displayWarning("can't sit there");
        }
        break;
      }
      case "startSubmit": {
        const message: Message = {
          type: "start",
          id: -1,
          playerId: playerId,
        };
        socket?.emit("start", message);
        break;
      }
      case "raise":
      case "call":
      case "fold":
      case "check": {
        if (lobby.seats[lobby.gameInfo.curPlayer] != playerId.inGameId) {
          displayWarning("not your turn lmao");
          return;
        }
        const amt = document.getElementById("raise_size") as HTMLInputElement;
        const message: Message = createMessageAction(
          playerId,
          button,
          button == "raise" ? Number(amt.value) : 0
        );
        const error: string = getErrorFromAction(lobby, message);
        if (error != "success") {
          displayWarning(error);
        } else {
          socket?.emit("action", message);
        }
        break;
      }
    }
    setReactLobby(lobby);
    console.log("gonna set pid to ", playerId);
    setPlayerId(playerId);
  }

  function emitRetryAddPlayer(socket: Socket, message: Message) {
    const id: string = message.playerId.id;
    socket.emit("addPlayer", message, (response: { err: boolean }) => {
      if (response == null) {
        console.log("how the fuck");
      }
      if (response.err) {
        message.playerId.inGameId++;
        emitRetryAddPlayer(socket, message);
      } else {
        if (lobbyId == null) {
          console.log("TROLL");
          return;
        }
        playerId = {
          lobbyId: lobbyId,
          id: id,
          inGameId: message.playerId.inGameId,
          seat: -1,
          name: "GUEST",
        };
        console.log("gonna set pid to ", playerId);
        setPlayerId(playerId);
        console.log("MY ACTUALY PID", playerId);
      }
    });
  }

  function handleMessage(message: Message) {
    if (reactPlayerId != null)
      playerId = JSON.parse(JSON.stringify(reactPlayerId));
    if (lobby == null) return;
    console.log("received", message);
    switch (message.type) {
      case "chat": {
        //nothing special really
        break;
      }
      case "sit": {
        console.log(message.playerId.inGameId, lobby.players);
        sit(
          lobby,
          lobby.players[message.playerId.inGameId].playerId,
          message.location
        );
        if (playerId?.inGameId == message.playerId.inGameId)
          playerId.seat = message.location;
        console.log("gonna set pid to ", playerId);
        setPlayerId(playerId);
        break;
      }
      case "addPlayer": {
        addExistingPlayer(lobby, message.playerId);
        break;
      }
      case "setPlayerName": {
        setPlayerNameClient(lobby, message.playerId);
        break;
      }
      case "start": {
        startLobby(lobby);
        break;
      }
      case "action": {
        runAction(lobby, message);
        break;
      }
    }
  }

  function replay(socket: Socket | null, wantAddPlayer: boolean) {
    if (lobby == null) return;
    console.log("gonna replay");
    if (lobbyId == undefined) {
      console.log("how tf");
      return;
    }
    socket?.emit(
      "getMessages",
      lobbyId,
      (response: { messages: Message[] }) => {
        lobby.messages = response.messages;
        for (let i = 0; i < response.messages.length; i++)
          handleMessage(response.messages[i]);
        if (wantAddPlayer) {
          const message: Message = {
            type: "addPlayer",
            id: -1,
            playerId: createPlayerId(lobby, "GUEST", null),
          };
          emitRetryAddPlayer(socket, message);
        }
      }
    );
  }

  const handleNewMessage = (message: Message) => {
    lobby = JSON.parse(JSON.stringify(lobby));
    if (message.id != lobby.messages.length) {
      console.log("I MISSED A MESSAGE");
      replay(socket, false);
    } else {
      handleMessage(message);
    }
    lobby.messages.push(message);
    console.log(lobby.messages);
    setReactLobby(lobby);
  };

  useEffect(() => {
    const socket = io("localhost:3002");
    socket.emit("joinLobby", lobbyId);
    replay(socket, true);
    console.log(new Date());
    socket?.on("message", (message: Message) => {
      handleNewMessage(message);
    });
    setSocket(socket);
    setReactLobby(lobby);
  }, []);

  return (
    <div>
      {reactLobby?.players.map((Player, index) => (
        <li key={index}>
          <div>
            stack: {Player.gameInfo.stack}; | inPot:{" "}
            {String(Player.gameInfo.inPot)}| chips in pot:{" "}
            {Player.gameInfo.chipsThisRound}| {Player.gameInfo.card1.numDisplay}
            {Player.gameInfo.card1.suit} {Player.gameInfo.card2.numDisplay}
            {Player.gameInfo.card2.suit}|{" "}
            {/* {strengthToString(Player.gameInfo.curHandStrength)}|{" "} */}
            <div>
              {Player.gameInfo.fullHand.map(
                (Card) => Card.numDisplay + Card.suit
              )}{" "}
            </div>
          </div>
        </li>
      ))}

      {reactPlayerId != null
        ? "name: " + reactPlayerId.name + " seat: " + reactPlayerId.seat
        : "placeholder, join below"}
      {reactLobby?.messages.map((message, index) => {
        return <div key={index}>{messageToString(message)}</div>;
      })}
      {reactLobby?.seats.map((user, index) => {
        return (
          <li key={index}>
            {user == -1
              ? "empty"
              : reactLobby.players[user].playerId.name +
                playerGameInfoToString(reactLobby.players[user].gameInfo)}
          </li>
        );
      })}
      <input type="text" id="name" />
      <button onClick={playerNameSubmit}>join</button>
      <button onClick={sayHiSubmit}> Say Hi </button>
      <input type="text" id="seat" />
      <button onClick={sitSubmit}>sit</button>
      <div id="illegal"></div>
      <input
        type="number"
        id="raise_size"
        placeholder="raise size"
        min="1"
      ></input>
      <div></div>
      <button onClick={raise}>raise</button>
      <button onClick={fold}>fold</button>
      <button onClick={call}>call</button>
      <button onClick={check}>check</button>
      <div></div>
      {reactLobby?.host == reactPlayerId?.inGameId ? (
        <button onClick={startSubmit}>start</button>
      ) : (
        <div> you are not host </div>
      )}
      <ul></ul>
    </div>
  );
}

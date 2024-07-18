import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import type {
  Lobby,
  Message,
  MessageWithPlayerId,
  PlayerId,
  ShowCards,
} from "game_logic";
import {
  playerGameInfoToString,
  createLobbyClient,
  createChat,
  validateSeat,
  sit,
  addExistingPlayer,
  messageToString,
  createPlayerId,
  setPlayerNameClient,
  createMessageAction,
  runAction,
  getErrorFromAction,
  lobbyInfoToString,
  updateHoleCards,
  deal,
  updatePlayerBestHand,
  resetHand,
  showdown,
  cardsToString,
  TURN_TIME,
} from "game_logic";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [reactLobby, setReactLobby] = useState<Lobby | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [reactPlayerId, setPlayerId] = useState<PlayerId | null>(null);
  const [lastActionTime, setLastActionTime] = useState<number | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
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
  function start() {
    handleButton("start");
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
    if (playerId == null || lobbyId == null) {
      console.log("HOWTF");
      return;
    }
    switch (button) {
      case "sayHi": {
        if (playerId != null && lobby != null) {
          const message: Message = createChat(playerId, lobbyId, "hi");
          socket?.emit("message", message);
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
            date: Date.now(),
            type: "setPlayerName",
            lobbyId: lobbyId,
            id: -1,
            playerId: playerId,
          };
          socket?.emit("message", message);
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
        console.log(lobby.players, playerId.inGameId);
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
            date: Date.now(),
            lobbyId: lobbyId,
            type: "sit",
            location: seatNum,
            id: -1,
            playerId: playerId,
          };
          socket?.emit("message", message);
        } else {
          displayWarning("can't sit there");
        }
        break;
      }
      case "start":
      case "raise":
      case "call":
      case "fold":
      case "check": {
        if (
          button != "start" &&
          lobby.seats[lobby.gameInfo.curPlayer] != playerId.inGameId
        ) {
          displayWarning("not your turn lmao");
          return;
        }
        const amt = document.getElementById("raise_size") as HTMLInputElement;
        const message: Message = createMessageAction(
          playerId,
          button,
          button == "raise" ? Number(amt.value) : 0,
          lobbyId
        );
        const error: string = getErrorFromAction(lobby, message);
        if (error != "success") {
          displayWarning(error);
        } else {
          socket?.emit("message", message);
        }
        break;
      }
    }
    setReactLobby(lobby);
    console.log("gonna set pid to ", playerId);
    setPlayerId(playerId);
  }

  function emitRetryAddPlayer(socket: Socket, message: MessageWithPlayerId) {
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
    console.log("received", message);
    if (reactPlayerId != null)
      playerId = JSON.parse(JSON.stringify(reactPlayerId));
    if (lobby == null) return;
    console.log("setlat", message.date);
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
        if (playerId?.inGameId == message.playerId.inGameId) {
          playerId.seat = message.location;
          console.log("gonna set pid to ", playerId);
          setPlayerId(playerId);
        }
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
        console.log("SENT START");
        //resetHand(lobby, true);
        break;
      }
      case "action": {
        if (runAction(lobby, message, true)?.isWaitingForAction) {
          updateIsWaiting(message.date);
        }
        break;
      }
      case "newCommunityCards": {
        for (let i = 0; i < message.cards.length; i++) {
          deal(lobby, message.cards[i]);
        }
        updatePlayerBestHand(lobby);
        updateIsWaiting(message.date);
        lobby.gameInfo.isWaitingForAction = true;
        break;
      }
      case "showCards": {
        for (let i = 0; i < message.cardsShown.length; i++) {
          const showCards: ShowCards = message.cardsShown[i];
          if (!lobby.players[showCards.inGameId].gameInfo.hasHoleCards)
            updateHoleCards(
              lobby.players[showCards.inGameId].gameInfo,
              showCards.card1,
              showCards.card2
            );
        }
        updatePlayerBestHand(lobby);
        for (let i = 0; i < lobby.players.length; i++)
          console.log(
            i,
            cardsToString(lobby.players[i].gameInfo.fullHand),
            cardsToString(lobby.players[i].gameInfo.curBestHand)
          );
        break;
      }
      case "showdown": {
        updatePlayerBestHand(lobby);
        showdown(lobby);
        break;
      }
      case "reset": {
        resetHand(lobby, true);
        updateIsWaiting(message.date);
        break;
      }
    }
  }

  function updateIsWaiting(time: number) {
    lobby.gameInfo.isWaitingForAction = true;
    setLastActionTime(time);
    setTimer(TURN_TIME - (Date.now() - time));
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
            date: Date.now(),
            lobbyId: lobbyId,
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
      console.log(lobby.messages);
      replay(socket, false);
    } else {
      handleMessage(message);
    }
    lobby.messages.push(message);
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

  useEffect(() => {
    function updateTimer() {
      console.log("set time?");
      if (lastActionTime != null) {
        setTimer(TURN_TIME - (Date.now() - lastActionTime));
        console.log("set time", Date.now() - lastActionTime);
      }
    }
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [lastActionTime, timer]);

  return (
    <div>
      {reactPlayerId != null
        ? "name: " +
          reactPlayerId.name +
          " seat: " +
          reactPlayerId.seat +
          "ingameid: " +
          reactPlayerId.inGameId
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
                playerGameInfoToString(reactLobby.players[user], reactLobby)}
          </li>
        );
      })}
      <div>isWaitingForAction:{reactLobby?.gameInfo.isWaitingForAction}</div>
      <div>
        time{" "}
        {reactLobby?.gameInfo.isWaitingForAction && timer != null ? timer : ""}
      </div>
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
        <button onClick={start}>start</button>
      ) : (
        <div> you are not host </div>
      )}
      <div>
        {reactLobby?.gameInfo != null
          ? lobbyInfoToString(reactLobby?.gameInfo)
          : ""}
      </div>
      <ul></ul>
    </div>
  );
}

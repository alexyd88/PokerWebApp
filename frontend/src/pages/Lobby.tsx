import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  Lobby,
  LobbyClient,
  Message,
  PlayerId,
  ShowCards,
} from "game_logic";
import {
  playerGameInfoToString,
  createLobbyClient,
  validateSeat,
  addExistingPlayer,
  messageToString,
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
  endGame,
  leaveSeat,
  updateChips,
  approveSitRequest,
  sitRequest,
  seatRequestToString,
  cancelSitRequest,
  getLedgerEntry,
  endHand,
  updateProbabilities,
  toggleSevenDeuce,
  toggleStandUp,
  gameModifiersToString,
  toggleAway,
} from "game_logic";
import { io, Socket } from "socket.io-client";

export function Lobby() {
  const lobbyId = useParams().lobbyId;
  const [reactLobby, setReactLobby] = useState<LobbyClient | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [reactPlayerId, setPlayerId] = useState<PlayerId | null>(null);
  const [lastActionTime, setLastActionTime] = useState<number | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [hasSeatRequest, setHasSeatRequest] = useState<boolean>(false);
  const [disconnected, setDisconnected] = useState<boolean>(false);
  let lobby: LobbyClient = createLobbyClient("LMAO DUMBASS");
  let playerId: PlayerId | null = null;
  const navigate = useNavigate();
  if (lobbyId != null) lobby = createLobbyClient(lobbyId);
  function displayWarning(warning: string) {
    const illegalWarning = document.getElementById("illegal");
    if (illegalWarning !== null) {
      illegalWarning.textContent = warning;
      console.log("SET WARNING");
    }
  }
  function sayHiSubmit() {
    handleButton("sayHi");
  }
  function sitSubmit() {
    handleButton("sitSubmit");
  }
  function cancelSit() {
    handleButton("cancelSit");
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
  function pauseToggle() {
    handleButton("pauseToggle");
  }
  function showCards() {
    handleButton("showMyCards");
  }
  function endGameToggle() {
    handleButton("endGameToggle");
  }
  function awayToggle() {
    handleButton("awayToggle");
  }
  function leavingToggle() {
    handleButton("leavingToggle");
  }
  function setHost() {
    handleButton("setHost");
  }
  function kickingToggle() {
    handleButton("kickingToggle");
  }
  function addChips() {
    handleButton("add");
  }
  function removeChips() {
    handleButton("remove");
  }
  function setChips() {
    handleButton("set");
  }
  function approve() {
    handleButton("approve");
  }
  function reload() {
    handleButton("reload");
  }
  function straddleToggle() {
    handleButton("straddleToggle");
  }
  function sevenDeuceToggle() {
    handleButton("sevenDeuceToggle");
  }
  function standUpToggle() {
    handleButton("standUpToggle");
  }
  function setBigBlind() {
    handleButton("setBigBlind");
  }
  function setAnte() {
    handleButton("setAnte");
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
      case "reload": {
        window.location.reload();
        break;
      }
      case "sayHi": {
        if (playerId != null && lobby != null) {
          const message: Message = {
            playerId: playerId,
            lobbyId: lobbyId,
            date: Date.now(),
            id: -1,
            type: "sitRequest",
            name: "YO",
            seat: 10,
            chips: -1,
          };
          socket?.emit("message", message);
        }
        break;
      }
      case "approve": {
        const approveId: HTMLInputElement = document.getElementById(
          "approveId"
        ) as HTMLInputElement;
        const message: Message = {
          date: Date.now(),
          lobbyId: lobbyId,
          type: "approveSitRequest",
          requestId: Number(approveId.value),
          id: -1,
          playerId: playerId,
        };
        socket?.emit("message", message);
        break;
      }
      case "sitSubmit": {
        console.log(lobby.players, playerId.inGameId);
        const nameInput: HTMLInputElement = document.getElementById(
          "name"
        ) as HTMLInputElement;
        const seatInput: HTMLInputElement = document.getElementById(
          "seat"
        ) as HTMLInputElement;
        const chipsInput: HTMLInputElement = document.getElementById(
          "chips"
        ) as HTMLInputElement;
        const seat = Number(seatInput.value);
        const chips = Number(chipsInput.value);
        let name = nameInput.value;
        if (name == "") name = "GUEST";
        if (
          playerId != null &&
          lobby != null &&
          validateSeat(lobby, playerId, seat)
        ) {
          setHasSeatRequest(true);
          const message: Message = {
            date: Date.now(),
            lobbyId: lobbyId,
            type: "sitRequest",
            seat: seat,
            name: name,
            chips: chips,
            id: -1,
            playerId: playerId,
          };
          socket?.emit("message", message);
        } else {
          displayWarning("can't sit there");
        }
        break;
      }
      case "cancelSit": {
        setHasSeatRequest(false);
        const message: Message = {
          date: Date.now(),
          lobbyId: lobbyId,
          type: "cancelSitRequest",
          id: -1,
          playerId: playerId,
        };
        socket?.emit("message", message);
        break;
      }
      case "pauseToggle": {
        const message: Message = {
          id: -1,
          type: "pauseToggle",
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        console.log("clicked pause");
        break;
      }
      case "endGameToggle": {
        const message: Message = {
          id: -1,
          type: "endGameToggle",
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "awayToggle": {
        const message: Message = {
          id: -1,
          type: "awayToggle",
          playerId: playerId,
          inGameId: playerId.inGameId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "leavingToggle": {
        //not from host
        const message: Message = {
          id: -1,
          type: "leavingToggle",
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "setHost": {
        const inGameId: HTMLInputElement = document.getElementById(
          "player_id"
        ) as HTMLInputElement;
        const message: Message = {
          id: -1,
          type: "setHost",
          playerId: playerId,
          inGameId: Number(inGameId.value),
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "kickingToggle": {
        const inGameId: HTMLInputElement = document.getElementById(
          "player_id"
        ) as HTMLInputElement;
        const message: Message = {
          id: -1,
          type: "kickingToggle",
          playerId: playerId,
          inGameId: Number(inGameId.value),
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "add":
      case "remove":
      case "set": {
        const inGameId: HTMLInputElement = document.getElementById(
          "player_id"
        ) as HTMLInputElement;
        const modifyAmount: HTMLInputElement = document.getElementById(
          "modifyAmount"
        ) as HTMLInputElement;
        const message: Message = {
          id: -1,
          type: "changeChips",
          changeChips: { modifier: button, amount: Number(modifyAmount.value) },
          playerId: playerId,
          inGameId: Number(inGameId.value),
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "showMyCards": {
        const message: Message = {
          id: -1,
          type: "showMyCards",
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "straddleToggle": {
        const message: Message = {
          id: -1,
          type: "straddleToggle",
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "sevenDeuceToggle": {
        const message: Message = {
          id: -1,
          type: "sevenDeuceToggle",
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "standUpToggle": {
        const message: Message = {
          id: -1,
          type: "standUpToggle",
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "setBigBlind": {
        const bigBlindAmount: HTMLInputElement = document.getElementById(
          "bigBlind"
        ) as HTMLInputElement;
        const message: Message = {
          id: -1,
          type: "setBigBlind",
          bigBlind: Number(bigBlindAmount.value),
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "setAnte": {
        const anteAmount: HTMLInputElement = document.getElementById(
          "ante"
        ) as HTMLInputElement;
        const message: Message = {
          id: -1,
          type: "setAnte",
          ante: Number(anteAmount.value),
          playerId: playerId,
          lobbyId: lobbyId,
          date: Date.now(),
        };
        socket?.emit("message", message);
        break;
      }
      case "start":
      case "raise":
      case "call":
      case "fold":
      case "check": {
        if (
          button != "start" &&
          (lobby.seats[lobby.gameInfo.curPlayer] != playerId.inGameId ||
            lobby.state != "waitingForAction")
        ) {
          displayWarning("not your turn lmao");
          return;
        }
        const amt = document.getElementById("raise_size") as HTMLInputElement;
        const message: Message = createMessageAction(
          playerId,
          button,
          button == "raise" ? Number(amt.value) : 0,
          lobbyId,
          false
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

  function emitRetryAddPlayer(
    socket: Socket,
    lobbyId: string,
    inGameId: number,
    uuid: string
  ) {
    socket.emit(
      "addPlayer",
      lobbyId,
      inGameId,
      uuid,
      (response: { err: boolean }) => {
        if (response == null) {
          console.log("how the fuck");
        }
        if (response.err) {
          console.log("COULDN'T");
          inGameId++;
          emitRetryAddPlayer(socket, lobbyId, inGameId, uuid);
        } else {
          if (lobbyId == null) {
            console.log("TROLL");
            return;
          }
          playerId = {
            id: uuid,
            inGameId: inGameId,
            name: "GUEST",
          };
          setPlayerId(playerId);
          console.log("MY PID", playerId);
          console.log("MY LOBBY", lobby);
          localStorage.setItem(lobbyId, uuid);
          console.log("LOCALSET", lobbyId, uuid);
        }
      }
    );
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
      case "setBigBlind": {
        lobby.gameInfo.bigBlind = message.bigBlind;
        break;
      }
      case "straddleToggle": {
        lobby.gameInfo.straddle = !lobby.gameInfo.straddle;
        break;
      }
      case "sevenDeuceToggle": {
        toggleSevenDeuce(lobby);
        break;
      }
      case "standUpToggle": {
        toggleStandUp(lobby);
        break;
      }
      case "setAnte": {
        lobby.gameInfo.ante = message.ante;
        break;
      }
      case "addPlayer": {
        addExistingPlayer(lobby, message.playerId);
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
        if (lobby.gameInfo.isAllIn) updateProbabilities(lobby);
        else lobby.state = "waitingForAction";
        break;
      }
      case "showCards": {
        for (let i = 0; i < message.cardsShown.length; i++) {
          const showCards: ShowCards = message.cardsShown[i];
          console.log(showCards.inGameId + " JUST SHOWED HIS CARDS");
          if (!lobby.players[showCards.inGameId].gameInfo.hasHoleCards) {
            updateHoleCards(
              lobby.players[showCards.inGameId].gameInfo,
              showCards.card1,
              showCards.card2
            );
          } else {
            lobby.canShowHoleCards = false;
          }
        }
        updatePlayerBestHand(lobby);
        for (let i = 0; i < lobby.players.length; i++)
          console.log(
            i,
            cardsToString(lobby.players[i].gameInfo.fullHand),
            cardsToString(lobby.players[i].gameInfo.curBestHand)
          );
        if (lobby.gameInfo.curRound < 4 && lobby.gameInfo.setAllIn) {
          updateProbabilities(lobby);
          lobby.gameInfo.setAllIn = false;
        }
        break;
      }
      case "showdown": {
        updatePlayerBestHand(lobby);
        showdown(lobby);
        break;
      }
      case "reset": {
        endHand(lobby);
        resetHand(lobby, true, message.dealerChip);
        lobby.canShowHoleCards = true;
        updateIsWaiting(message.date);
        break;
      }
      case "end": {
        endHand(lobby);
        endGame(lobby);
        break;
      }
      case "pauseToggle": {
        if (lobby.isPaused) {
          lobby.isPaused = false;
          if (lobby.state == "waitingForAction") updateIsWaiting(message.date);
        } else {
          lobby.isPaused = true;
        }
        console.log("paused: ", lobby.isPaused);
        break;
      }
      case "awayToggle": {
        toggleAway(lobby, message.inGameId);
        break;
      }
      case "leavingToggle": {
        const gameId: number = message.playerId.inGameId;
        lobby.players[gameId].gameInfo.leaving =
          !lobby.players[gameId].gameInfo.leaving;
        if (
          lobby.players[gameId].gameInfo.leaving &&
          !lobby.gameInfo.gameStarted
        ) {
          leaveSeat(lobby, gameId);
        }
        break;
      }
      case "kickingToggle": {
        lobby.players[message.inGameId].gameInfo.kicking =
          !lobby.players[message.inGameId].gameInfo.kicking;
        if (
          lobby.players[message.inGameId].gameInfo.kicking &&
          !lobby.gameInfo.gameStarted
        ) {
          leaveSeat(lobby, message.inGameId);
        }
        break;
      }
      case "changeChips": {
        lobby.players[message.inGameId].gameInfo.changeChips =
          message.changeChips;
        if (!lobby.gameInfo.gameStarted)
          updateChips(lobby.players[message.inGameId].gameInfo, lobby);
        break;
      }
      case "endGameToggle": {
        lobby.isEnding = !lobby.isEnding;
        break;
      }
      case "setHost": {
        lobby.host = message.inGameId;
        break;
      }
      case "sitRequest": {
        sitRequest(
          lobby,
          message.seat,
          message.name,
          message.chips,
          message.playerId.inGameId
        );
        break;
      }
      case "approveSitRequest": {
        approveSitRequest(lobby, message.requestId);
        if (message.playerId.inGameId == playerId?.inGameId)
          setHasSeatRequest(false);
        break;
      }
      case "cancelSitRequest": {
        cancelSitRequest(lobby, message.playerId.inGameId);
        break;
      }
    }
  }

  function updateIsWaiting(time: number) {
    lobby.state = "waitingForAction";
    setLastActionTime(time);
    setTimer(TURN_TIME - (Date.now() - time));
  }

  function replay(
    socket: Socket | null,
    wantAddPlayer: boolean,
    playerId: string
  ) {
    if (lobby == null) return;
    console.log("gonna replay");
    if (lobbyId == undefined) {
      console.log("how tf");
      return;
    }
    socket?.emit(
      "getMessages",
      lobbyId,
      playerId,
      (response: { messages: Message[]; exists: boolean }) => {
        lobby.messages = response.messages;
        if (!response.exists) {
          console.log("WHY NOT EXIST?", lobby.messages);
          navigate("/");
        }
        for (let i = 0; i < response.messages.length; i++)
          handleMessage(response.messages[i]);
        if (wantAddPlayer) {
          emitRetryAddPlayer(socket, lobbyId, lobby.players.length, uuidv4());
        }
      }
    );
  }

  const handleNewMessage = (message: Message) => {
    lobby = JSON.parse(JSON.stringify(lobby));
    if (message.id != lobby.messages.length) {
      console.log("I MISSED A MESSAGE");
      console.log(lobby.messages);
      replay(socket, false, playerId == null ? "" : playerId.id);
    } else {
      handleMessage(message);
    }
    lobby.messages.push(message);
    setReactLobby(lobby);
  };

  useEffect(() => {
    const socket = io("https://urchin-app-k7nvc.ondigitalocean.app");
    socket.emit("joinLobby", lobbyId);
    if (lobbyId == undefined) return;
    const pid = localStorage.getItem(lobbyId);
    console.log("LOCAL", pid);
    if (pid != null) {
      replay(socket, false, pid);
      socket.emit(
        "getPlayer",
        pid,
        lobbyId,
        (response: { playerId: PlayerId | null }) => {
          if (response.playerId == null) console.log("U LIED BRO");
          console.log(response.playerId);
          setPlayerId(response.playerId);
        }
      );
    } else {
      replay(socket, true, "");
    }
    console.log(new Date());
    socket?.on("message", (message: Message) => {
      handleNewMessage(message);
    });
    socket?.on("disconnect", async () => {
      setDisconnected(true);
      console.log("GET DISCONNECTED LOSER");
    });
    setSocket(socket);
    setReactLobby(lobby);
  }, []);

  useEffect(() => {
    function updateTimer() {
      if (lastActionTime != null) {
        setTimer(TURN_TIME - (Date.now() - lastActionTime));
      }
    }
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [lastActionTime, timer]);

  return disconnected ? (
    <div>
      Disconnected, click here to reload{" "}
      <button onClick={reload}>reload</button>
    </div>
  ) : (
    <div>
      {reactPlayerId != null
        ? "id: " +
          reactPlayerId.id +
          "name: " +
          reactPlayerId.name +
          " seat: " +
          reactLobby?.players[reactPlayerId.inGameId].gameInfo.seat +
          "ingameid: " +
          reactPlayerId.inGameId
        : "placeholder, join below"}
      {reactLobby?.messages.map((message, index) => {
        return <div key={index}>{messageToString(message)}</div>;
      })}
      {reactLobby?.gameInfo.board != null
        ? cardsToString(reactLobby?.gameInfo.board)
        : ""}
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
      <div>{gameModifiersToString(reactLobby)}</div>
      <div>state:{reactLobby?.state}</div>
      <div>
        time{" "}
        {reactLobby?.state == "waitingForAction" &&
        timer != null &&
        !reactLobby.isPaused
          ? timer
          : ""}
      </div>
      <div>
        {reactPlayerId?.inGameId != undefined &&
        reactLobby?.players[reactPlayerId?.inGameId].gameInfo.seat == -1 ? (
          !hasSeatRequest ? (
            <div>
              <input type="text" id="name" placeholder="name" />
              <input type="number" id="seat" placeholder="seat" />
              <input type="number" id="chips" placeholder="chips" />
              <button onClick={sitSubmit}>sit</button>
            </div>
          ) : (
            <div>
              <button onClick={cancelSit}>cancel sit</button>
            </div>
          )
        ) : (
          ""
        )}

        <button onClick={sayHiSubmit}> say hi </button>
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
        {reactLobby?.canShowHoleCards && reactLobby?.state == "showdown" ? (
          <button onClick={showCards}>show cards</button>
        ) : (
          ""
        )}
        {reactPlayerId?.inGameId != undefined &&
        reactLobby?.players[reactPlayerId.inGameId].gameInfo.seat != -1 ? (
          <div>
            <button onClick={awayToggle}>
              {reactLobby?.players[reactPlayerId?.inGameId].gameInfo.away
                ? "I'm back"
                : "away"}
            </button>
            <button onClick={leavingToggle}>
              {!reactLobby?.players[reactPlayerId?.inGameId].gameInfo.leaving
                ? "leave"
                : "cancel leave"}
            </button>
          </div>
        ) : (
          ""
        )}
        {reactLobby?.host == reactPlayerId?.inGameId ? (
          <div>
            <input type="number" id="player_id"></input>
            <button onClick={setHost}>set host</button>
            <button onClick={kickingToggle}>kick</button>
            <input type="number" id="modifyAmount"></input>
            <button onClick={addChips}>add chips</button>
            <button onClick={removeChips}>remove chips</button>
            <button onClick={setChips}>set chips</button>
            <div></div>
            <button onClick={start}>start</button>
            <button onClick={straddleToggle}>toggle straddle</button>
            <input type="number" id="bigBlind" placeholder="big blind"></input>
            <button onClick={setBigBlind}>set big blind</button>
            <input type="number" id="ante" placeholder="ante"></input>
            <button onClick={setAnte}>set ante</button>
            <button onClick={sevenDeuceToggle}>toggle seven deuce game</button>
            <button onClick={standUpToggle}>toggle stand up game</button>

            {reactLobby?.gameInfo.gameStarted ? (
              <div>
                <button onClick={pauseToggle}>
                  {reactLobby?.isPaused ? "resume" : "pause"}
                </button>
                <button onClick={endGameToggle}>
                  {reactLobby?.isEnding ? "cancel end game" : "end game"}
                </button>
              </div>
            ) : (
              ""
            )}
          </div>
        ) : (
          <div> you are not host </div>
        )}
        <div>
          {reactLobby?.gameInfo != null
            ? lobbyInfoToString(reactLobby?.gameInfo)
            : ""}
        </div>
        <div>
          {reactLobby?.host == reactPlayerId?.inGameId ? (
            <div>
              <input type="number" id="approveId" placeholder="approve index" />
              <button onClick={approve}>approve</button>
            </div>
          ) : (
            ""
          )}
        </div>
        <div>
          {reactLobby?.seatRequests.map((seatRequest, index) => {
            return (
              <div key={index}>
                {index + " " + seatRequestToString(seatRequest)}
              </div>
            );
          })}
        </div>
        <div>
          ledger
          <div></div>
          buy in, buy out, net
          {reactLobby?.players.map((player, index) => {
            return (
              <div key={index}>{index + " " + getLedgerEntry(player)}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

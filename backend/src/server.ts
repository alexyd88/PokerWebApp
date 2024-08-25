/**
 * Initializes mongoose and express.
 */

import "module-alias/register";
import { Server } from "socket.io";
import { createServer } from "node:http";
import type {
  ActionResult,
  Lobby,
  LobbyServer,
  Message,
  Player,
  PlayerId,
  ShowCards,
} from "game_logic";
import {
  approveSitRequest,
  messageSchema,
  cancelSitRequest,
  createChat,
  validateMessage,
  createPlayerGameInfo,
  createPlayerId,
  endGame,
  endHand,
  getErrorFromAction,
  getNumInPot,
  getRandSeat,
  createMessageAction,
  isLeaving,
  leaveSeat,
  messageToString,
  NEW_CARD_TIME,
  noActionsLeft,
  prepareMessageForClient,
  resetHand,
  runAction,
  setPlayerNameServer,
  SHOWDOWN_TIME,
  sit,
  sitRequest,
  TURN_TIME,
  updateChips,
  NEW_CARD_TIME_ALLIN,
  toggleSevenDeuce,
  getStartError,
  isHost,
  toggleStandUp,
  createLobbyServer,
} from "game_logic";
let lobbies = new Map<string, LobbyServer>();

function deleteOld() {
  for (const [key, lobby] of lobbies.entries()) {
    if (
      Date.now() - lobby.messageList[lobby.messageList.length - 1].date >
      172800000
    ) {
      lobbies.delete(key);
    }
  }
}

setInterval(deleteOld, 3600000);

const SOCKET_PORT = 8080;

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

function addMessage(message: Message) {
  const lobby = lobbies.get(message.lobbyId);
  message.id = lobby.messages.length;
  lobby.messages.push(message);
  console.log(messageToString(message));
  lobby.messageList.push(message);
}

function addAndReturn(message: Message) {
  if (message.date == undefined) console.log(message);
  message.date = Date.now();
  let location = message.lobbyId;
  addMessage(message);
  let lobby = lobbies.get(message.lobbyId);
  if (message.type == "showCards" && !message.public) {
    let haveSentMessage: boolean[] = [];
    for (let i = 0; i < lobby.players.length; i++) haveSentMessage.push(false);
    for (let i = 0; i < message.cardsShown.length; i++) {
      message.receiver = message.cardsShown[i].inGameId;
      haveSentMessage[message.receiver] = true;
      console.log("gonna send ", "to " + message.receiver, message.id);
      io.in(lobby.socketList[message.receiver]).emit(
        "message",
        prepareMessageForClient(lobby, message)
      );
    }
    message.receiver = -1;
    for (let i = 0; i < lobby.players.length; i++) {
      if (!haveSentMessage[i]) {
        io.in(lobby.socketList[i]).emit(
          "message",
          prepareMessageForClient(lobby, message)
        );
      }
    }
    return;
  }
  io.in(location).emit("message", prepareMessageForClient(lobby, message));
}

function createResetMessage(lobby: LobbyServer): Message {
  let cardMessage: Message = {
    date: Date.now(),
    playerId: null,
    type: "reset",
    lobbyId: lobby.id,
    dealerChip: lobby.gameInfo.dealerChip,
    id: -1,
  };
  return cardMessage;
}

function sendReset(lobby: LobbyServer) {
  resetHand(lobby, false, -1);
  let resetMessage: Message = createResetMessage(lobby);
  addAndReturn(resetMessage);
  const cardsShown: ShowCards[] = [];
  for (let i = 0; i < lobby.players.length; i++) {
    if (lobby.players[i].gameInfo.startedInPot) {
      cardsShown.push({
        inGameId: i,
        card1: lobby.players[i].gameInfo.card1,
        card2: lobby.players[i].gameInfo.card2,
      });
    }
  }
  let cardMessage: Message = {
    type: "showCards",
    cardsShown: cardsShown,
    date: Date.now(),
    playerId: null,
    lobbyId: lobby.id,
    id: -1,
    public: false,
    receiver: -1,
  };
  addAndReturn(cardMessage);
  expectAction(lobby);
}

function sendEndGame(lobby: Lobby) {
  endGame(lobby);
  let endMessage: Message = {
    type: "end",
    date: Date.now(),
    playerId: null,
    lobbyId: lobby.id,
    id: -1,
  };
  addAndReturn(endMessage);
}

function sendEndHand(lobby: LobbyServer) {
  let awayMessages = endHand(lobby);
  for (let i = 0; i < awayMessages.length; i++) {
    addAndReturn({
      id: -1,
      type: "awayToggle",
      playerId: lobby.players[awayMessages[i]].playerId,
      inGameId: lobby.players[awayMessages[i]].playerId.inGameId,
      lobbyId: lobby.id,
      date: Date.now(),
    });
  }
  if (lobby.isEnding || getStartError(lobby) != "success") {
    console.log(getStartError(lobby));
    sendEndGame(lobby);
    return;
  }
  sendReset(lobby);
  console.log("SENT RESET");
}

function sendCardsShown(lobby: Lobby, cardsShown: ShowCards[]) {
  let cardMessage: Message = {
    date: Date.now(),
    type: "showCards",
    cardsShown: cardsShown,
    lobbyId: lobby.id,
    id: -1,
    playerId: null,
    public: true,
    receiver: -1,
  };
  addAndReturn(cardMessage);
}

//expects curplayer to be real player
function expectAction(lobby: LobbyServer) {
  if (shouldAutoAction(lobby)) {
    handleAutoAction(lobby, true);
    return;
  }
  clearTimeout(lobby.timeout);
  lobby.state = "waitingForAction";

  let message: Message = getAutoAction(
    lobby,
    lobby.players[lobby.seats[lobby.gameInfo.curPlayer]],
    true
  );

  lobby.timeout = setTimeout(
    handleMessage,
    TURN_TIME,
    message
  ) as unknown as number;
  lobby.queuedMessage = message;
}

function sendCommunityCards(lobby: LobbyServer, message: Message) {
  addAndReturn(message);
  expectAction(lobby);
}

function getAutoAction(
  lobby: LobbyServer,
  player: Player,
  wasTimeout: boolean
): Message {
  if (lobby.seats[lobby.gameInfo.curPlayer] != player.playerId.inGameId) {
    console.log("somehow this mf beat the clock barely??");
    return;
  }
  let message: Message = createMessageAction(
    player.playerId,
    "check",
    0,
    lobby.id,
    wasTimeout
  );
  if (message.type != "action") {
    console.log("WTF");
    return;
  }
  let error: string = getErrorFromAction(lobby, message);
  if (error == "Lobby is paused") {
    return message;
  }
  if (error != "success") message.action = "fold";
  error = getErrorFromAction(lobby, message);
  if (error == "Lobby is paused") {
    return message;
  }
  if (error != "success") {
    console.log("HOW CAN THIS GUY NOT DO ANYTHING?");
    return null;
  }
  return message;
}

function requeueMessage(lobby: LobbyServer) {
  clearTimeout(lobby.timeout);
  if (lobby.queuedMessage == null) return;
  if (lobby.queuedMessage.type == "action") {
    lobby.timeout = setTimeout(
      handleMessage,
      TURN_TIME,
      lobby.queuedMessage
    ) as unknown as number;
  } else if (lobby.queuedMessage.type == "newCommunityCards") {
    lobby.timeout = setTimeout(
      sendCommunityCards,
      lobby.gameInfo.isAllIn ? NEW_CARD_TIME_ALLIN : NEW_CARD_TIME,
      lobby,
      lobby.queuedMessage
    ) as unknown as number;
  } else if (lobby.queuedMessage.type == "reset") {
    lobby.timeout = setTimeout(
      sendEndHand,
      SHOWDOWN_TIME,
      lobby
    ) as unknown as number;
  } else {
    console.log("how are u here?", lobby.queuedMessage);
  }
}

function shouldAutoAction(lobby: Lobby) {
  let curPlayer = lobby.players[lobby.seats[lobby.gameInfo.curPlayer]].gameInfo;
  return (
    curPlayer.away ||
    curPlayer.leaving ||
    curPlayer.kicking ||
    noActionsLeft(lobby)
  );
}

function handleAutoAction(lobby: LobbyServer, wasTimeout: boolean) {
  if (!lobby.gameInfo.gameStarted) return;
  if (shouldAutoAction(lobby)) {
    handleMessage(
      getAutoAction(
        lobby,
        lobby.players[lobby.seats[lobby.gameInfo.curPlayer]],
        wasTimeout
      )
    );
  }
}

function handleMessage(message: Message) {
  addAndReturn(message);
  const lobby = lobbies.get(message.lobbyId);
  switch (message.type) {
    case "chat": {
      //nothing special
      break;
    }
    case "setBigBlind": {
      if (!isHost(message.playerId, lobby)) return;
      lobby.gameInfo.bigBlind = message.bigBlind;
      break;
    }
    case "straddleToggle": {
      if (!isHost(message.playerId, lobby)) return;
      lobby.gameInfo.straddle = !lobby.gameInfo.straddle;
      break;
    }
    case "sevenDeuceToggle": {
      if (!isHost(message.playerId, lobby)) return;
      toggleSevenDeuce(lobby);
      break;
    }
    case "standUpToggle": {
      if (!isHost(message.playerId, lobby)) return;
      toggleStandUp(lobby);
      break;
    }
    case "setAnte": {
      if (!isHost(message.playerId, lobby)) return;
      lobby.gameInfo.ante = message.ante;
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
      if (message.playerId.inGameId == lobby.host) {
        let newMessage: Message = {
          type: "approveSitRequest",
          id: -1,
          lobbyId: lobby.id,
          date: Date.now(),
          playerId: message.playerId,
          requestId: lobby.seatRequests.length - 1,
        };
        handleMessage(newMessage);
      }
      break;
    }
    case "cancelSitRequest": {
      cancelSitRequest(lobby, message.playerId.inGameId);
      break;
    }
    case "approveSitRequest": {
      if (!isHost(message.playerId, lobby)) return;
      approveSitRequest(lobby, message.requestId);
      break;
    }
    case "pauseToggle": {
      if (!isHost(message.playerId, lobby)) return;
      if (lobby.isPaused) {
        lobby.isPaused = false;
        requeueMessage(lobby);
      } else {
        lobby.isPaused = true;
        clearTimeout(lobby.timeout);
      }
      break;
    }
    case "endGameToggle": {
      if (!isHost(message.playerId, lobby)) return;
      lobby.isEnding = !lobby.isEnding;
      break;
    }
    case "setHost": {
      if (!isHost(message.playerId, lobby)) return;
      lobby.host = message.inGameId;
      break;
    }
    case "awayToggle": {
      lobby.players[message.inGameId].gameInfo.away =
        !lobby.players[message.inGameId].gameInfo.away;
      if (
        lobby.players[message.inGameId].gameInfo.away &&
        message.inGameId == lobby.seats[lobby.gameInfo.curPlayer]
      )
        handleAutoAction(lobby, false);
      break;
    }
    case "leavingToggle": {
      const gameId: number = message.playerId.inGameId;
      lobby.players[gameId].gameInfo.leaving =
        !lobby.players[gameId].gameInfo.leaving;
      handleAutoAction(lobby, false);
      if (
        lobby.players[gameId].gameInfo.leaving &&
        !lobby.gameInfo.gameStarted
      ) {
        leaveSeat(lobby, gameId);
      }
      break;
    }
    case "kickingToggle": {
      if (!isHost(message.playerId, lobby)) return;
      lobby.players[message.inGameId].gameInfo.kicking =
        !lobby.players[message.inGameId].gameInfo.kicking;
      handleAutoAction(lobby, false);
      if (
        lobby.players[message.inGameId].gameInfo.kicking &&
        !lobby.gameInfo.gameStarted
      )
        leaveSeat(lobby, message.inGameId);
      break;
    }
    case "changeChips": {
      if (!isHost(message.playerId, lobby)) return;
      lobby.players[message.inGameId].gameInfo.changeChips =
        message.changeChips;
      if (!lobby.gameInfo.gameStarted)
        updateChips(lobby.players[message.inGameId].gameInfo, lobby);
      break;
    }
    case "showMyCards": {
      let cardsShown: ShowCards[] = [];
      cardsShown.push({
        inGameId: message.playerId.inGameId,
        card1: lobby.players[message.playerId.inGameId].gameInfo.card1,
        card2: lobby.players[message.playerId.inGameId].gameInfo.card2,
      });
      sendCardsShown(lobby, cardsShown);
      break;
    }
    case "action": {
      if (message.type != "action") {
        console.log("WTF");
        return;
      }
      let lobby = lobbies.get(message.lobbyId);
      if (
        (lobby.seats[lobby.gameInfo.curPlayer] != message.playerId.inGameId &&
          message.action != "start") ||
        (getErrorFromAction(lobby, message) != "success" &&
          getErrorFromAction(lobby, message) != "Lobby is paused")
      ) {
        console.log(
          lobby.seats[lobby.gameInfo.curPlayer],
          message.playerId.inGameId,
          getErrorFromAction(lobby, message)
        );
        console.log("U ARE TROLLING ME");
        return;
      }
      const actionResult: ActionResult = runAction(lobby, message, false);
      if (actionResult == null) {
        console.log("WHAT THE FUCK");
        return;
      }
      if (message.action == "start") {
        lobby.gameInfo.dealerChip = getRandSeat(lobby);
        sendEndHand(lobby);
      }
      if (actionResult.setAllIn) {
        let showCards: ShowCards[] = [];
        for (let i = 0; i < lobby.players.length; i++) {
          let pg = lobby.players[i].gameInfo;
          if (pg.inPot) {
            showCards.push({ inGameId: i, card1: pg.card1, card2: pg.card2 });
          }
        }
        sendCardsShown(lobby, showCards);
      }

      // new cards
      if (actionResult.cards.length != 0) {
        console.log("NEW CARDS INCOMING");
        const cardMessage: Message = {
          date: Date.now(),
          type: "newCommunityCards",
          playerId: null,
          lobbyId: message.lobbyId,
          id: -1,
          cards: actionResult.cards,
        };
        clearTimeout(lobby.timeout);
        lobby.timeout = setTimeout(
          sendCommunityCards,
          lobby.gameInfo.isAllIn ? NEW_CARD_TIME_ALLIN : NEW_CARD_TIME,
          lobby,
          cardMessage
        ) as unknown as number;
        lobby.queuedMessage = cardMessage;
      }
      // end of hand
      else if (actionResult.calledHandEnd) {
        let lobby = lobbies.get(message.lobbyId);
        sendCardsShown(lobby, actionResult.cardsShown);
        const showdownMessage: Message = {
          date: Date.now(),
          type: "showdown",
          playerId: null,
          lobbyId: message.lobbyId,
          id: -1,
        };
        addAndReturn(showdownMessage);
        clearTimeout(lobby.timeout);
        lobby.timeout = setTimeout(
          sendEndHand,
          SHOWDOWN_TIME,
          lobby
        ) as unknown as number;
        lobby.queuedMessage = createResetMessage(lobby);
      }
      // just regular move??
      else {
        expectAction(lobby);
      }
      break;
    }
  }
  // console.log(lobby.gameInfo.dealerChip);
  // console.log(lobby.state);
}

io.on("connection", (socket) => {
  console.log("user connected", Date.now());
  socket.on(
    "getMessages",
    async (lobbyId: string, playerId: string, callback) => {
      //console.log(lobbyId, messageLists.get(lobbyId));
      let newMessages = [];
      if (!lobbies.has(lobbyId)) {
        console.log("LOBBY DOESN'T EXIST");
        callback({
          messages: newMessages,
          exists: false,
        });
        return;
      }
      let lobby = lobbies.get(lobbyId);
      let messages = lobby.messageList;
      let inGameId = -1;

      for (let i = 0; i < lobby.players.length; i++)
        if (playerId == lobby.players[i].playerId.id) inGameId = i;
      for (let i = 0; i < messages.length; i++) {
        let message = messages[i];
        if (message.type == "showCards") message.receiver = inGameId;
        newMessages.push(prepareMessageForClient(lobby, message));
      }
      callback({
        messages: newMessages,
        exists: true,
      });
    }
  );
  socket.on("createLobby", async (callback) => {
    let lobby = createLobbyServer();
    lobbies.set(lobby.id, lobby);
    callback({
      id: lobby.id,
    });
  });

  socket.on("joinLobby", (room: string) => {
    console.log("socket joined:", room);
    socket.join(room);
  });
  socket.on(
    "getPlayer",
    async (playerId: string, lobbyId: string, callback) => {
      if (!lobbies.has(lobbyId)) {
        console.log("how was lobby not created yet");
        return;
      }
      let lobby = lobbies.get(lobbyId);
      let oldPlayerId: PlayerId | null = null;
      for (let i = 0; i < lobby.players.length; i++)
        if (lobby.players[i].playerId.id == playerId)
          oldPlayerId = lobby.players[i].playerId;
      if (oldPlayerId == null) {
        console.log("U LIED BRO THIS PERSON ISN'T REAL");
        return;
      }
      io.in(lobby.socketList[oldPlayerId.inGameId]).disconnectSockets(true);
      lobby.socketList[oldPlayerId.inGameId] = socket.id;
      callback({
        playerId: oldPlayerId,
      });
    }
  );
  socket.on(
    "addPlayer",
    async (lobbyId: string, inGameId: number, id: string, callback) => {
      if (!lobbies.has(lobbyId)) {
        console.log("how was lobby not created yet");
        return;
      }
      const lobby = lobbies.get(lobbyId);
      let player: Player = {
        playerId: createPlayerId(lobby, "GUEST", id),
        gameInfo: createPlayerGameInfo(),
      };
      let err: boolean = false;
      if (lobby.players.length != inGameId) {
        console.log("RACE CONDITION OMG");
        err = true;
      } else {
        lobby.players.push(player);
        lobby.socketList.push(socket.id);
        let message: Message = {
          type: "addPlayer",
          id: -1,
          lobbyId: lobbyId,
          playerId: { inGameId: inGameId, id: id, name: "GUEST" },
          date: Date.now(),
        };
        addAndReturn(message);
      }

      callback({
        err: err,
      });
    }
  );

  socket.on("message", (message: Message) => {
    if (!validateMessage(message, lobbies)) {
      console.log("DUMBASS HACKER LMFAO");
      return;
    }
    message.date = Date.now();
    //if (!isValidMessage(message, lobbies.get(message.lobbyId))) return;
    handleMessage(message);
  });
});

server.listen(SOCKET_PORT, () => {
  console.log(`Socket server running on ${SOCKET_PORT}.`);
});

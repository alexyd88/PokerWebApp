/**
 * Functions that process Lobby route requests.
 */

import MessageModel from "../models/message";
import Lobby from "../models/lobby";
import MessageBoard from "../models/messageBoard";

export async function createMessage(
  lobbyId: any,
  player: any,
  content: any
): Promise<null> {
  const message = await MessageModel.create({
    lobbyId: lobbyId,
    player: player,
    content: content,
  });
  const lobby = await Lobby.findById(lobbyId);
  const messageBoard = await MessageBoard.findById(lobby.messageBoard);
  messageBoard.messages.push(message);
  await messageBoard.save();
  return null;
}

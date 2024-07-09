/**
 * Functions that process Lobby route requests.
 */

import MessageModel from "../models/message";
import Lobby from "../models/lobby";
import MessageBoard from "../models/messageBoard";
import type { Message } from "types";

export async function createMessage(args: Message): Promise<null> {
  const message = await MessageModel.create({
    lobbyId: args.lobbyId,
    player: args.player,
    type: args.type,
    content: args.content,
  });
  const lobby = await Lobby.findById(args.lobbyId);
  const messageBoard = await MessageBoard.findById(lobby.messageBoard);
  messageBoard.messages.push(message);
  await messageBoard.save();
  return null;
}

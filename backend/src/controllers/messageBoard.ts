import { RequestHandler } from "express";
import * as createHttpError from "http-errors";
import MessageBoard from "../models/messageBoard";
import Lobby from "../models/lobby";

export const getMessageBoard: RequestHandler = async (req, res, next) => {
  console.log("in getmessageboard");
  const { id } = req.params;
  try {
    const lobby = await Lobby.findById(id);
    const messageBoard = await MessageBoard.findById(lobby.messageBoard);
    console.log("hello bro", messageBoard);
    if (messageBoard === null) {
      throw createHttpError(404, "Message board not found.");
    }
    res.status(200).json(messageBoard);
  } catch (error) {
    next(error);
  }
};

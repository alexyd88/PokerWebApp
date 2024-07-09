import { RequestHandler } from "express";
import * as createHttpError from "http-errors";
import MessageBoard from "../models/messageBoard";

export const getMessageBoard: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const messageBoard = await MessageBoard.find({ lobbyId: id });

    if (messageBoard === null) {
      throw createHttpError(404, "Message board not found.");
    }
    res.status(200).json(messageBoard);
  } catch (error) {
    next(error);
  }
};

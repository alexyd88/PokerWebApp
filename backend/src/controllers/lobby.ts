/**
 * Functions that process Lobby route requests.
 */

import { RequestHandler } from "express";
import * as createHttpError from "http-errors";
import LobbyModel from "../models/lobby";

export const getLobby: RequestHandler = async (req, res, next) => {
  const { id } = req.params;

  try {
    // if the ID doesn't exist, then findById returns null
    const Lobby = await LobbyModel.findById(id);

    if (Lobby === null) {
      throw createHttpError(404, "Lobby not found.");
    }

    // Set the status code (200) and body (the Lobby object as JSON) of the response.
    // Note that you don't need to return anything, but you can still use a return
    // statement to exit the function early.
    res.status(200).json(Lobby);
  } catch (error) {
    // pass errors to the error handler
    next(error);
  }
};

export const createLobby: RequestHandler = async (req, res, next) => {
  // extract any errors that were found by the validator
  const { players } = req.body;
  // if there are errors, then this function throws an exception
  try {
    console.log(players, Date.now());
    const Lobby = await LobbyModel.create({
      players: players,
      dateCreated: Date.now(),
    });
    res.status(201).json(Lobby);
  } catch (error) {
    next(error);
  }
};

export const removeLobby: RequestHandler = async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await LobbyModel.deleteOne({ _id: id });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

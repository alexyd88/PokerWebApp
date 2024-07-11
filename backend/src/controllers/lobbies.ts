import { RequestHandler } from "express";
import { Lobby, Message, createLobbyServer } from "game_logic";

export let lobbies = new Map<string, Lobby>();

export function getLobby(id: string): Lobby {
  if (!lobbies.has(id)) return null;
  return lobbies.get(id);
}

export interface CreateLobbyRequest {
  id: string;
}

export const addLobby: RequestHandler = async (req, res, next) => {
  try {
    let lobby = createLobbyServer();
    lobbies.set(lobby.id, lobby);

    res.status(201).json({ id: lobby.id });
  } catch (error) {
    next(error);
  }
};

export function removeLobby(id: string) {
  lobbies.delete(id);
}

export function getMessages(id: string): Message[] {
  if (!lobbies.has(id)) return null;
  return lobbies.get(id).messages;
}

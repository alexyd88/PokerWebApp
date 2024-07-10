import { get, handleAPIError, post } from "./requests";

import type { APIResult } from "./requests";
import type { Lobby, MessageBoard, Player } from "game_logic";

/**
 * The expected inputs when we want to create a new Lobby object. In the MVP, we only
 * need to provide the title and optionally the description, but in the course of
 * this tutorial you'll likely want to add more fields here.
 */
export interface CreateLobbyRequest {
  players: Player[];
}

/**
 * The implementations of these API client functions are provided as part of the
 * MVP. You can use them as a guide for writing the other client functions.
 */
export async function createLobby(
  lobby: CreateLobbyRequest
): Promise<APIResult<Lobby>> {
  try {
    const response = await post("/api/lobby", lobby);
    const json = (await response.json()) as Lobby;
    return { success: true, data: json };
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function getLobby(id: string): Promise<APIResult<Lobby>> {
  try {
    const response = await get(`/api/lobby/${id}`);
    const json = (await response.json()) as Lobby;
    return { success: true, data: json };
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function getMessageBoard(
  id: string
): Promise<APIResult<MessageBoard>> {
  try {
    const response = await get(`/api/lobby/messages/${id}`);
    const json = (await response.json()) as MessageBoard;
    return { success: true, data: json };
  } catch (error) {
    return handleAPIError(error);
  }
}

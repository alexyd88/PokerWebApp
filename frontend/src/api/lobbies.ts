import { get, handleAPIError, post } from "./requests";

import type { APIResult } from "./requests";

/**
 * Defines the "shape" of a Lobby object (what fields are present and their types) for
 * frontend components to use. This will be the return type of most functions in this
 * file.
 */
export interface Lobby {
  _id: string;
  title: string;
  description?: string;
  isChecked: boolean;
  dateCreated: Date;
}

/**
 * Defines the shape of JSON that we'll receive from the backend when we ask the API
 * for a Lobby object. That is, when the backend sends us a JSON object representing a
 * Lobby, we expect it to match these fields and types.
 *
 * The difference between this type and `Lobby` above is that `dateCreated` is a string
 * instead of a Date object. This is because JSON doesn't support Dates, so we use a
 * date-formatted string in requests and responses.
 */
interface LobbyJSON {
  _id: string;
  title: string;
  description?: string;
  isChecked: boolean;
  dateCreated: string;
}

/**
 * Converts a Lobby from JSON that only contains primitive types to our custom
 * Lobby interface.
 *
 * @param lobby The JSON representation of the lobby
 * @returns The parsed Lobby object
 */
function parseLobby(lobby: LobbyJSON): Lobby {
  return {
    _id: lobby._id,
    title: lobby.title,
    description: lobby.description,
    isChecked: lobby.isChecked,
    dateCreated: new Date(lobby.dateCreated),
  };
}

/**
 * The expected inputs when we want to create a new Lobby object. In the MVP, we only
 * need to provide the title and optionally the description, but in the course of
 * this tutorial you'll likely want to add more fields here.
 */
export interface CreateLobbyRequest {
  title: string;
  description?: string;
}

/**
 * The expected inputs when we want to update an existing Lobby object. Similar to
 * `CreateLobbyRequest`.
 */
export interface UpdateLobbyRequest {
  _id: string;
  title: string;
  description?: string;
  isChecked: boolean;
  dateCreated: Date;
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
    const json = (await response.json()) as LobbyJSON;
    return { success: true, data: parseLobby(json) };
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function getLobby(id: string): Promise<APIResult<Lobby>> {
  try {
    const response = await get(`/api/lobby/${id}`);
    const json = (await response.json()) as LobbyJSON;
    return { success: true, data: parseLobby(json) };
  } catch (error) {
    return handleAPIError(error);
  }
}

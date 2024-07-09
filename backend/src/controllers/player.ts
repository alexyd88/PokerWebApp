import PlayerModel from "../models/player";
import Lobby from "../models/lobby";
import MessageBoard from "../models/messageBoard";
import type { Player } from "types";

export async function createPlayer(
  lobbyId: string,
  name: string
): Promise<Player> {
  const lobby = await Lobby.findById(lobbyId);
  const player = await PlayerModel.create({
    lobbyId: lobbyId,
    inGameId: lobby.players.length,
    name: name,
    seat: -1,
  });
  lobby.players.push(player);
  await lobby.save();
  return {
    _id: String(player._id),
    lobbyId: String(player.lobbyId),
    inGameId: player.inGameId,
    name: player.name,
    seat: -1,
  };
}

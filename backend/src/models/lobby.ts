import { InferSchemaType, Schema, model } from "mongoose";
import { Player } from "types";

const lobbySchema = new Schema({
  players: { type: Array<Player>, required: true },
  date: { type: Date, required: true },
  messageBoard: { type: Schema.Types.ObjectId, required: false },
  seats: { type: Array<Number>, required: true },
});

type LobbyModel = InferSchemaType<typeof lobbySchema>;
export default model<LobbyModel>("Lobby", lobbySchema);

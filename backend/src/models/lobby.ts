import { InferSchemaType, Schema, model } from "mongoose";

const lobbySchema = new Schema({
  players: { type: Array<{ name: string }>, required: true },
  date: { type: Date, required: true },
  messageBoard: { type: Schema.Types.ObjectId, required: false },
});

type LobbyModel = InferSchemaType<typeof lobbySchema>;
export default model<LobbyModel>("Lobby", lobbySchema);

import { InferSchemaType, Schema, model } from "mongoose";

const playerSchema = new Schema({
  lobbyId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  inGameId: { type: Number, required: true },
  seat: { type: Number, required: true },
});

type PlayerModel = InferSchemaType<typeof playerSchema>;
export default model<PlayerModel>("Player", playerSchema);

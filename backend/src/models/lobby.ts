import { InferSchemaType, Schema, model } from "mongoose";

const lobbySchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  isChecked: { type: Boolean, default: false },
  dateCreated: { type: Date, required: true },
});

type Lobby = InferSchemaType<typeof lobbySchema>;

export default model<Lobby>("Lobby", lobbySchema);

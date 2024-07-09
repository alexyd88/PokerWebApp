import { InferSchemaType, Schema, model } from "mongoose";

const messageSchema = new Schema({
  lobbyId: { type: Schema.Types.ObjectId, required: true },
  player: { type: String, required: true },
  type: { type: String, required: true },
  content: { type: String, required: true },
});

type MessageModel = InferSchemaType<typeof messageSchema>;
export default model<MessageModel>("Message", messageSchema);

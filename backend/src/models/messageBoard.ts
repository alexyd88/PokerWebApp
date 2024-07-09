import { InferSchemaType, Schema, model } from "mongoose";
import MessageModel from "./message";

const messageBoardSchema = new Schema({
  lobbyId: { type: String, required: true },
  messages: { type: Array<typeof MessageModel>, required: true },
});

type MessageBoardModel = InferSchemaType<typeof messageBoardSchema>;
export default model<MessageBoardModel>("MessageBoard", messageBoardSchema);

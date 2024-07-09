/**
 * Task route requests.
 */

import * as express from "express";
import * as LobbyController from "../controllers/lobby";
import * as MessageBoard from "../controllers/messageBoard";

const router = express.Router();

router.get("/:id", LobbyController.getLobby);
router.get("/messages/:id", MessageBoard.getMessageBoard);
router.post("/", LobbyController.createLobby);
router.delete("/:id", LobbyController.removeLobby);

export default router;

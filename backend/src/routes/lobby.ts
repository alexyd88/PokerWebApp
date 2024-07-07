/**
 * Task route requests.
 */

import * as express from "express";
import * as LobbyController from "../controllers/lobby";

const router = express.Router();

router.get("/:id", LobbyController.getLobby);
router.post("/", LobbyController.createLobby);
router.delete("/:id", LobbyController.removeLobby);

export default router;

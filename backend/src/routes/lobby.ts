/**
 * Task route requests.
 */

import * as express from "express";
import * as LobbiesController from "../controllers/lobbies";

const router = express.Router();

router.get("/messages/:id", LobbiesController.getMessages);
router.post("/", LobbiesController.addLobby);
router.delete("/:id", LobbiesController.removeLobby);

export default router;

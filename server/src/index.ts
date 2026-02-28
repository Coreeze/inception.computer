import "dotenv/config";

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { connectToDB } from "./database/connection";
import {
  registerPlayerSocket,
  unregisterPlayerSocket,
  getPlayerSession,
} from "./socket/sessionManager";
import { runtimeRouter } from "./api/runtime/routes";
import { getterRouter } from "./api/getters/routes";

const app = express();
const PORT = process.env.PORT || 8080;

export let io: SocketIOServer;
export const playerSocketMap = new Map<string, string>();

async function start() {
  await connectToDB();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.use("/api/v1", runtimeRouter);
  app.use("/api/v1", getterRouter);

  app.get("/", (_req, res) => {
    res.json({ status: "alive", engine: "inception.computer" });
  });

  const server = createServer(app);

  io = new SocketIOServer(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    const { playerID } = socket.handshake.query;
    if (typeof playerID === "string") {
      const { replacedSocketId } = registerPlayerSocket(playerID, socket.id);
      if (replacedSocketId && io) {
        io.to(replacedSocketId).emit("session_replaced", {
          message: "Your session was replaced by a newer connection.",
        });
        io.sockets.sockets.get(replacedSocketId)?.disconnect(true);
      }
      playerSocketMap.set(playerID, socket.id);

      const session = getPlayerSession(playerID);
      if (session?.characterID) {
        socket.emit("runtime_status", {
          characterId: session.characterID,
          runtimeState: session.isPlaying ? "playing" : "paused",
        });
      }
    }

    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
      if (
        typeof playerID === "string" &&
        playerSocketMap.has(playerID) &&
        playerSocketMap.get(playerID) === socket.id
      ) {
        playerSocketMap.delete(playerID);
      }
      if (typeof playerID === "string") {
        const { shouldPause, characterID } = unregisterPlayerSocket(
          playerID,
          socket.id
        );
        if (shouldPause && characterID) {
          // TODO: stopHeartbeatScheduler(characterID);
        }
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`✅ inception.computer server on port ${PORT}`);
  });
}

start().catch(console.error);

import { Router } from "express";
import {
  generateChatImagePreviewEndpoint,
  heartbeatEndpoint,
  resolveChoiceEndpoint,
  sendChatMessageEndpoint,
  travelCharacterEndpoint,
  whatsHereEndpoint,
} from "./controllers";
import { initializeEndpoint } from "./initialize";

const runtimeRouter = Router();

runtimeRouter.post("/sandbox-runtime/heartbeat", heartbeatEndpoint);
runtimeRouter.post("/sandbox-runtime/resolve-choice", resolveChoiceEndpoint);
runtimeRouter.post("/sandbox-runtime/initialize", initializeEndpoint);
runtimeRouter.post("/sandbox-runtime/chat/image-preview", generateChatImagePreviewEndpoint);
runtimeRouter.post("/sandbox-runtime/chat", sendChatMessageEndpoint);
runtimeRouter.post("/sandbox-runtime/travel", travelCharacterEndpoint);
runtimeRouter.post("/sandbox-runtime/whats-here", whatsHereEndpoint);

export { runtimeRouter };

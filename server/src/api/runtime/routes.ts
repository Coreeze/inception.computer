import { Router } from "express";
import {
  doStuffSelectEndpoint,
  doStuffSuggestEndpoint,
  generateBeingImageEndpoint,
  generateChatImagePreviewEndpoint,
  generatePlaceImageEndpoint,
  heartbeatEndpoint,
  resolveChoiceEndpoint,
  sendChatMessageEndpoint,
  setFreeWillEndpoint,
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
runtimeRouter.post("/sandbox-runtime/being/image", generateBeingImageEndpoint);
runtimeRouter.post("/sandbox-runtime/place/image", generatePlaceImageEndpoint);
runtimeRouter.post("/sandbox-runtime/travel", travelCharacterEndpoint);
runtimeRouter.post("/sandbox-runtime/whats-here", whatsHereEndpoint);
runtimeRouter.post("/sandbox-runtime/free-will", setFreeWillEndpoint);
runtimeRouter.post("/sandbox-runtime/do-stuff/suggest", doStuffSuggestEndpoint);
runtimeRouter.post("/sandbox-runtime/do-stuff/select", doStuffSelectEndpoint);

export { runtimeRouter };

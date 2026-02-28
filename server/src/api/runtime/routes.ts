import { Router } from "express";
import { heartbeatEndpoint, resolveChoiceEndpoint } from "./controllers";
import { initializeEndpoint } from "./initialize";

const runtimeRouter = Router();

runtimeRouter.post("/sandbox-runtime/heartbeat", heartbeatEndpoint);
runtimeRouter.post("/sandbox-runtime/resolve-choice", resolveChoiceEndpoint);
runtimeRouter.post("/sandbox-runtime/initialize", initializeEndpoint);

export { runtimeRouter };

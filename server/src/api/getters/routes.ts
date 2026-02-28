import { Router } from "express";
import { Request, Response } from "express";
import { Being } from "../../database/models/being";
import { Sandbox } from "../../database/models/sandbox";
import { Places } from "../../database/models/places";
import { Entity } from "../../database/models/entity";
import { Edge } from "../../database/models/edge";
import { Event } from "../../database/models/event";
import { Chat } from "../../database/models/chat";
import { Notification } from "../../database/models/notification";
import { WorldHistory } from "../../database/models/worldHistory";

const getterRouter = Router();

getterRouter.get("/sandbox/character/:characterID", async (req: Request, res: Response) => {
  try {
    const character = await Being.findById(req.params.characterID);
    if (!character) return res.status(404).json({ error: "Not found" });
    const sandbox = await Sandbox.findById(character.sandbox);
    const npcs = await Being.find({
      main_character: character._id,
      is_deleted: { $ne: true },
    });
    const places = await Places.find({
      main_character: character._id,
    });
    const entities = await Entity.find({ sandbox: character.sandbox });
    const edges = await Edge.find({
      sandbox: character.sandbox,
      is_active: true,
    });

    return res.json({
      character,
      sandbox,
      npcs,
      places,
      entities,
      edges,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

getterRouter.get("/sandbox/events/:characterID", async (req: Request, res: Response) => {
  try {
    const events = await Event.find({
      character: req.params.characterID,
    })
      .sort({ sim_year: -1, sim_month: -1, sim_day: -1 })
      .limit(50);
    return res.json({ events });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

getterRouter.get("/sandbox/chat/:characterID/:npcID", async (req: Request, res: Response) => {
  try {
    const chats = await Chat.find({
      main_character: req.params.characterID,
      sender_id: req.params.npcID,
      sender: { $in: ["user", "npc"] },
      channel: "texting",
    })
      .sort({ createdAt: -1 })
      .limit(50);
    chats.reverse();
    return res.json({ chats });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

getterRouter.get("/sandbox/memories/:characterID", async (req: Request, res: Response) => {
  try {
    const character = await Being.findById(req.params.characterID);
    const memories = character?.life_md
      ? [{ content: character.life_md }]
      : [];
    return res.json({ memories });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

getterRouter.get("/sandbox/notifications/:characterID", async (req: Request, res: Response) => {
  try {
    const notifications = await Notification.find({
      main_character: req.params.characterID,
      read: false,
    })
      .sort({ createdAt: -1 })
      .limit(20);
    return res.json({ notifications });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

getterRouter.get("/sandbox/history/:sandboxID", async (req: Request, res: Response) => {
  try {
    const history = await WorldHistory.find({
      sandbox: req.params.sandboxID,
    })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json({ history });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export { getterRouter };

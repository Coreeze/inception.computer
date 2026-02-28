import { ObjectId } from "mongodb";
import { Being, Places, Event } from "../../database/models";
import { Sandbox } from "../../database/models/sandbox";

export async function getSandboxContext(sandboxID: string, mainCharacterID: string): Promise<any> {
  const sandbox = await Sandbox.findById(sandboxID);

  if (!sandbox) {
    throw new Error("Sandbox not found");
  }

  const [places, beings, events] = await Promise.all([
    Places.findOne({ sandbox: sandboxID }).select("name type longitude latitude").lean(),
    Being.find({ sandbox: sandboxID }).select("first_name last_name occupation").lean(),
    Event.find({ character: new ObjectId(mainCharacterID) })
      .select("title sim_year sim_month sim_day")
      .lean(),
  ]);

  const context = {
    sandbox,
    places,
    beings,
    events,
  };

  return context;
}

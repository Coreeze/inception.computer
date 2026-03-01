import { Being, Places } from "../../database/models";
import { Sandbox } from "../../database/models/sandbox";

export async function getSandboxContext(sandboxID: string, _mainCharacterID?: string): Promise<any> {
  const sandbox = await Sandbox.findById(sandboxID);

  if (!sandbox) {
    throw new Error("Sandbox not found");
  }

  const [places, beings] = await Promise.all([
    Places.find({ sandbox: sandboxID }).select("name").limit(5).lean(),
    Being.find({ sandbox: sandboxID }).select("first_name last_name").limit(5).lean(),
  ]);

  return { sandbox, places, beings };
}

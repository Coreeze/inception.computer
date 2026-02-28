import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { Process } from "../database/models/process";
import { Being } from "../database/models/being";
import { Entity } from "../database/models/entity";
import { Places } from "../database/models/places";
import { Edge } from "../database/models/edge";

interface SimDate {
  year: number;
  month: number;
  day: number;
}

interface ProcessAction {
  op: string;
  model: string;
  filter?: Record<string, unknown>;
  field?: string;
  value?: number;
  min?: number;
  max?: number;
  source?: { model: string; filter: Record<string, unknown> };
  groupBy?: string;
  sum?: string;
  target?: { model: string; field: string };
}

const MODELS: Record<string, mongoose.Model<unknown>> = {
  Being: Being as mongoose.Model<unknown>,
  Entity: Entity as mongoose.Model<unknown>,
  Place: Places as mongoose.Model<unknown>,
  Edge: Edge as mongoose.Model<unknown>,
};

function simDateToDate(simDate: SimDate): Date {
  return new Date(simDate.year, simDate.month - 1, simDate.day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function runDueProcesses(
  sandboxId: string | ObjectId,
  currentSimDate: SimDate
): Promise<void> {
  const currentDate = simDateToDate(currentSimDate);

  const dueProcesses = await Process.find({
    sandbox: sandboxId,
    is_active: true,
    $or: [
      { next_run_at: { $lte: currentDate } },
      { next_run_at: null },
    ],
  });

  for (const process of dueProcesses) {
    try {
      await executeProcessAction(
        process.action as unknown as ProcessAction,
        sandboxId.toString()
      );
      process.last_run_at = currentDate;
      process.next_run_at = addDays(currentDate, process.interval_days);
      await process.save();
    } catch (error) {
      console.error(`Process ${process.name} failed:`, error);
    }
  }
}

async function executeProcessAction(
  action: ProcessAction,
  sandboxId: string
): Promise<void> {
  const { op, model, filter = {}, field, value, min, max } = action;
  const sandboxFilter = { ...filter, sandbox: sandboxId };

  switch (op) {
    case "increment":
      if (!field || value === undefined) throw new Error("increment requires field and value");
      await MODELS[model]?.updateMany(sandboxFilter, { $inc: { [field]: value } });
      if (max !== undefined) {
        await MODELS[model]?.updateMany(
          { ...sandboxFilter, [field]: { $gt: max } },
          { $set: { [field]: max } }
        );
      }
      break;

    case "decrement":
      if (!field || value === undefined) throw new Error("decrement requires field and value");
      await MODELS[model]?.updateMany(sandboxFilter, { $inc: { [field]: -value } });
      if (min !== undefined) {
        await MODELS[model]?.updateMany(
          { ...sandboxFilter, [field]: { $lt: min } },
          { $set: { [field]: min } }
        );
      }
      break;

    case "set":
      if (!field || value === undefined) throw new Error("set requires field and value");
      await MODELS[model]?.updateMany(sandboxFilter, { $set: { [field]: value } });
      break;

    case "aggregate_update":
      await executeAggregateUpdate(action, sandboxId);
      break;

    default:
      throw new Error(`Unknown process operation: ${op}`);
  }
}

async function executeAggregateUpdate(
  action: ProcessAction,
  sandboxId: string
): Promise<void> {
  const { source, groupBy, sum, target } = action;
  if (!source || !groupBy || !sum || !target) {
    throw new Error("aggregate_update requires source, groupBy, sum, and target");
  }

  const SourceModel = MODELS[source.model];
  const TargetModel = MODELS[target.model];
  if (!SourceModel || !TargetModel) throw new Error("Invalid model in aggregate_update");

  const aggregation = await SourceModel.aggregate([
    {
      $match: {
        ...source.filter,
        sandbox: new mongoose.Types.ObjectId(sandboxId),
      },
    },
    { $group: { _id: `$${groupBy}`, total: { $sum: `$${sum}` } } },
  ]);

  if (aggregation.length > 0) {
    const bulkOps = aggregation.map((item) => ({
      updateOne: {
        filter: { _id: item._id, sandbox: sandboxId },
        update: { $set: { [target.field]: item.total } },
      },
    }));
    await TargetModel.bulkWrite(bulkOps);
  }
}

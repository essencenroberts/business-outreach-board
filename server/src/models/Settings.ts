import { Schema, model } from "mongoose";
import { DEFAULT_STAGES, type Stage } from "../lib/constants.js";

const settingsSchema = new Schema({
  key: { type: String, unique: true, default: "main" },
  stages: {
    type: [{ id: String, label: String, color: String, _id: false }],
    default: DEFAULT_STAGES,
  },
});

export const Settings = model("Settings", settingsSchema);

export async function getStages(): Promise<Stage[]> {
  const doc = await Settings.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main", stages: DEFAULT_STAGES } },
    { upsert: true, new: true },
  ).lean();
  return (doc?.stages ?? DEFAULT_STAGES) as Stage[];
}

import { Schema, model } from "mongoose";
import { DEFAULT_STAGES, type Stage } from "../lib/constants.js";

const settingsSchema = new Schema({
  key: { type: String, unique: true, default: "main" },
  stages: {
    type: [{ id: String, label: String, color: String, _id: false }],
    default: DEFAULT_STAGES,
  },
  // Your details, used to sign email pitches.
  profile: {
    name: { type: String, default: "" },
    businessName: { type: String, default: "" },
    website: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    offer: { type: String, default: "" },
    bookingLink: { type: String, default: "" },
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

export interface Profile {
  name: string;
  businessName: string;
  website: string;
  phone: string;
  email: string;
  offer: string;
  bookingLink: string;
}

const EMPTY_PROFILE: Profile = { name: "", businessName: "", website: "", phone: "", email: "", offer: "", bookingLink: "" };

export async function getProfile(): Promise<Profile> {
  const doc = await Settings.findOne({ key: "main" }).lean();
  return { ...EMPTY_PROFILE, ...(doc?.profile ?? {}) } as Profile;
}

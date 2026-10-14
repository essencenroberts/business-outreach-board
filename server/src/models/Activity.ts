import { Schema, model, Types } from "mongoose";

export const ACTIVITY_TYPES = [
  "note",
  "status_change",
  "created",
  "email",
  "call",
  "meeting",
  "audit",
] as const;

const activitySchema = new Schema(
  {
    business: { type: Types.ObjectId, ref: "Business", required: true, index: true },
    type: { type: String, enum: ACTIVITY_TYPES, default: "note" },
    text: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed },
    author: { type: String, default: "you" },
  },
  { timestamps: true },
);

export const Activity = model("Activity", activitySchema);

export async function logActivity(
  businessId: Types.ObjectId | string,
  type: (typeof ACTIVITY_TYPES)[number],
  text: string,
  author = "you",
  meta?: Record<string, unknown>,
) {
  return Activity.create({ business: businessId, type, text, author, meta });
}

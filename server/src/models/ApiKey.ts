import { Schema, model } from "mongoose";

const apiKeySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    prefix: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

export const ApiKey = model("ApiKey", apiKeySchema);

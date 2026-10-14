import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

/** Accepts "https://foo.com", "foo.com" or a comma-separated list of either. */
function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .map((s) => (/^https?:\/\//.test(s) ? s : `https://${s}`));
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  adminEmail: required("ADMIN_EMAIL").trim().toLowerCase(),
  adminPassword: required("ADMIN_PASSWORD"),
  clientOrigins: [
    ...parseOrigins(process.env.CLIENT_ORIGIN),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  claudeModel: process.env.CLAUDE_MODEL || "claude-opus-5-5",
};

# Business Outreach Board

A lead tracker for finding and pitching St. Louis small businesses that have no website, or a weak one (not mobile friendly, poor SEO, no customer journey, no lead magnet or email capture), and that could use help with marketing, social media and content.

- Live app: https://business-outreach-board.onrender.com
- API: https://business-outreach-board-api.onrender.com
- Code: `client/` (Vite + React + Tailwind), `server/` (Express + MongoDB). Pushing to `main` on GitHub redeploys both on Render.

## Working the board for the user

The user asks in plain English: "find 10 nail salons in North City with no website", "move El Bronco to Emailed and set a follow-up for Friday", "what follow-ups are due?". Do the work through the agent API.

**Auth:** read the key from `.agent-key` in this folder and send it as `Authorization: Bearer <key>`. The file is git-ignored; never commit it, print it, or paste it into chat. If the user says "save this agent key…", write the key they give into `.agent-key` (replace any old one, `chmod 600`). If the file is missing or a call returns 401, ask the user to create a new key in the app under **Settings → AI agent access** and give it to you.

**Endpoints** (base `https://business-outreach-board-api.onrender.com/api/agent`). The free Render instance sleeps when idle, so the first call can take ~50 seconds; use a generous timeout.

| Call | Use |
| --- | --- |
| `GET /` | Self-describing docs: fields, services, stages |
| `GET /stages` | Stage ids to use as `status` (researching, contacted_email, contacted_phone, no_response, responded, discovery_call, proposal_sent, contract_signed, onboarding, won, lost) |
| `GET /leads?q=&status=` | Search leads |
| `GET /leads/:id` | One lead plus its activity log |
| `POST /leads` | One lead, or `{ "leads": [...] }` for many. Duplicates (same name, phone or website) are skipped and reported. |
| `PATCH /leads/:id` | Update fields or move stages, e.g. `{"status":"contacted_email","followUpDate":"2026-10-20"}` |
| `POST /leads/:id/notes` | `{ "text": "...", "type": "note" | "email" | "call" | "meeting" }` |

Lead fields: `name` (required), `category`, `contactName`, `phone`, `email`, `address`, `neighborhood`, `zip`, `website`, `socials{facebook,instagram,tiktok,linkedin,youtube,googleBusiness,yelp}`, `researchNotes`, `services[]` (Website build, Website redesign, SEO, Email marketing, Lead magnet, Social media, Content creation, Google Business Profile, Branding), `tags[]`, `priority` (low|medium|high), `followUpDate`, and `audit{hasWebsite, mobileResponsive, ssl, seoBasics, customerJourney, leadMagnet, emailCapture, socialMedia, contentQuality, googleProfile}` with each `yes` (they have it), `no` (missing, which is the opportunity) or `unknown`. The opportunity score is computed from the audit.

## Finding leads: how to research

1. Search the web for independent, locally owned businesses in the requested area and category. Skip chains and franchises.
2. For each one, check whether they have their own website. If they do, fetch it and check: HTTPS, a mobile viewport tag, title/meta description/H1, a clear call to action (book, call, order, quote), an email signup, a lead magnet, an outdated copyright year, and DIY builders.
3. Only report what you actually saw. Never invent phone numbers, addresses or URLs. If you couldn't confirm a website exists or doesn't, set `hasWebsite: "unknown"` and say so in `researchNotes`.
4. Skip businesses that already have a strong website, unless the user asks otherwise.
5. In `researchNotes`, write: what the business is, what you found (with the check date), a one-line pitch idea, and the source sites you used.
6. Before adding, `GET /leads` to avoid repeats, then `POST /leads` in one batch. Tell the user what you added and what needs verifying.

The user prefers plain language and wants to be told clearly what is verified versus a guess.

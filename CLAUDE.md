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
| `GET /profile` | The user's own details (name, business, website, phone, email, booking link, offer) for signing pitches |

Lead fields: `name` (required), `category`, `contactName`, `phone`, `email`, `address`, `neighborhood`, `zip`, `website`, `socials{facebook,instagram,tiktok,linkedin,youtube,googleBusiness,yelp}`, `researchNotes`, `services[]` (Website build, Website redesign, SEO, Email marketing, Lead magnet, Social media, Content creation, Google Business Profile, Branding), `tags[]`, `priority` (low|medium|high), `followUpDate`, and `audit{hasWebsite, mobileResponsive, ssl, seoBasics, customerJourney, leadMagnet, emailCapture, socialMedia, contentQuality, googleProfile}` with each `yes` (they have it), `no` (missing, which is the opportunity) or `unknown`. The opportunity score is computed from the audit.

## Finding leads: how to research

1. Search the web for independent, locally owned businesses in the requested area and category. Skip chains and franchises.
2. For each one, check whether they have their own website. If they do, fetch it and check: HTTPS, a mobile viewport tag, title/meta description/H1, a clear call to action (book, call, order, quote), an email signup, a lead magnet, an outdated copyright year, and DIY builders.
3. Only report what you actually saw. Never invent phone numbers, addresses or URLs. If you couldn't confirm a website exists or doesn't, set `hasWebsite: "unknown"` and say so in `researchNotes`.
4. Skip businesses that already have a strong website, unless the user asks otherwise.
5. In `researchNotes`, write: what the business is, what you found (with the check date), a one-line pitch idea, and the source sites you used.
6. Before adding, `GET /leads` to avoid repeats, then `POST /leads` in one batch. Tell the user what you added and what needs verifying.

### Service providers (chefs, home bakers, real estate agents, makeup artists, loc stylists, wig installers, lash techs, personal trainers, etc.)

Many are individuals who work from home, a salon suite, or on the go, so they rarely show up as storefronts.

- Find them where they actually market themselves: Instagram, Facebook, TikTok, StyleSeat, Booksy, Vagaro, GlossGenius, Square/Acuity booking pages, Linktree, Thumbtack, Google Business listings, local press, and brokerage or salon-suite rosters (Salons by JC, MY SALON Suite, Sola).
- **A booking page, Linktree or social profile is not a website of their own.** Set `hasWebsite: "no"` and put the link in `socials` (Instagram, Facebook, etc.) or `researchNotes` (booking pages). Note what the profile does well, such as photos or reviews, and what's missing: no branded site, no email list, no lead magnet, nothing ranking on Google.
- Real estate agents and loan officers usually have a brokerage profile page. That counts as a weak website (generic template, no personal brand or lead capture), not a strong one. Prioritize agents who rely on it alone.
- Use the person's business name if they have one, otherwise their name plus specialty (e.g. "Jasmine Carter, Loc Stylist"), and fill in `contactName`.
- For home-based providers, use the neighborhood or service area, not a home address, even if you find one.

## Drafting email pitches

When asked to draft a pitch (the app's "Draft with Claude" button gives a request naming the lead and its id):

1. `GET /leads/:id` for the research notes, audit, audit summary, services and activity. `GET /profile` for the sender's details.
2. Write a short, personal cold email from the user to the business owner:
   - 110–170 words, warm and plain, no hype or jargon. Address the owner by first name if known.
   - Open with something specific and genuine about their business, taken from the research.
   - Name 1–3 concrete gaps you actually found (no website, not mobile friendly, no online booking or ordering, no email list), framed as missed customers, never as insults.
   - One clear next step: a free 15-minute call (include the booking link if the profile has one) or a quick mockup.
   - Sign with the profile details. Leave out anything that's empty; never use "[Your name]" placeholders or invent details.
   - Subject line under 60 characters, specific to them, not salesy.
3. Save it with `PATCH /leads/:id` `{ "pitchSubject": "...", "pitchEmail": "..." }` (plain text with line breaks). This also logs "Drafted an email pitch" in their activity.
4. Show the user the pitch in your reply and point out anything they should check (e.g. if the profile is empty, tell them to fill in **Settings → Your info for email pitches**).

For batch requests ("draft pitches for everything in Researching that's been audited"), skip leads with no research notes and no audit, and list which ones you skipped.

The user prefers plain language and wants to be told clearly what is verified versus a guess.

# Business Outreach Board

A private lead tracker for finding and pitching St. Louis small businesses that have no website, or a website that's missing mobile design, SEO, a clear customer journey, lead magnets or email capture.

- **Drag-and-drop pipeline**: Researching → Emailed → Called → No Response → Responded → Discovery Call Set → Proposal Sent → Contract Signed → Onboarding → Won / Lost. You can rename, recolor, reorder and add stages in Settings.
- **Business details**: contact info, website and social links, services to pitch, tags, priority and follow-up dates.
- **Website audit checklist** with an **opportunity score** (0–100, higher means more you can help with):
  - **Quick site check** (free): checks HTTPS, the mobile viewport tag, SEO tags, email signup forms, lead-magnet keywords and social links.
  - **Audit with Claude**: Claude reads the site, searches for their Google, Facebook, Instagram and Yelp presence, fills in the checklist and writes a pitch angle.
- **Notes**: long-form research notes plus a timestamped activity log for emails, calls and meetings. Status changes are logged automatically.
- **Find leads with Claude**: pick a business type and area. Claude searches the web live and you pick which results to add.
- **Paste & let Claude fill it**: paste a Google or Yelp listing, an Instagram bio or rough notes, and Claude fills in the form.
- **AI agent API**: create an API key in Settings so Claude Code, Claude Desktop or any agent can add leads, move them between stages and log notes.

**Stack:** Vite, React 19, TypeScript, Tailwind CSS v4 (glassmorphism UI), dnd-kit, Express 5, Mongoose (MongoDB Atlas), and the Anthropic SDK. Both the frontend and the API deploy on Render.

```
business-outreach-board/
├── client/        Vite + React frontend (Render static site)
├── server/        Express + TypeScript API (Render web service)
└── render.yaml    Render Blueprint that deploys both
```

---

## Deploy today

### 1. MongoDB Atlas
1. In Atlas, create a free **M0** cluster (or use an existing one).
2. Go to **Database Access** and add a database user with a password.
3. Go to **Network Access** and add `0.0.0.0/0`. Render's free tier doesn't have fixed IPs, so this is needed.
4. Click **Connect → Drivers** and copy the connection string. Replace `<password>`, and put a database name before the `?`, like this:
   `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/business-outreach-board?retryWrites=true&w=majority`

### 2. GitHub
Create an empty repo (private is fine), then push this folder to it:
```bash
git init && git add . && git commit -m "Business Outreach Board"
git branch -M main
git remote add origin https://github.com/<you>/business-outreach-board.git
git push -u origin main
```

### 3. Render
1. In Render, go to **New → Blueprint** and pick your repo. Render reads `render.yaml` and sets up two services.
2. Fill in the values it asks for:

| Key | Service | Value |
| --- | --- | --- |
| `MONGODB_URI` | API | Your Atlas connection string |
| `ADMIN_EMAIL` | API | The email you'll log in with |
| `ADMIN_PASSWORD` | API | A long password |
| `CLIENT_ORIGIN` | API | `https://business-outreach-board.onrender.com` |
| `ANTHROPIC_API_KEY` | API | Your key from console.anthropic.com. You can leave this empty and add it later. |
| `VITE_API_URL` | Frontend | `https://business-outreach-board-api.onrender.com` |

`JWT_SECRET` is generated for you.

3. Click **Apply**. When both services show "Live", open the frontend URL and sign in.

> If Render gives either service a different URL (for example with a random suffix because the name is taken), update `CLIENT_ORIGIN` and `VITE_API_URL` to the real URLs. Then go to the frontend and choose **Manual Deploy → Clear build cache & deploy**, because Vite bakes `VITE_API_URL` in when it builds.

**Free tier note:** the free API service goes to sleep after about 15 minutes idle, so the first request after that takes around 30 seconds. Upgrade the API to the Starter plan ($7/month) if that gets annoying.

---

## Run locally

```bash
npm run install:all
cp server/.env.example server/.env   # then fill it in
npm run dev:server                   # API on http://localhost:4000
npm run dev:client                   # app on http://localhost:5173 (proxies /api to the server)
```

---

## Connect an AI agent

1. Go to **Settings → AI agent access → Create API key** and copy the key. It's only shown once.
2. Copy the **instructions** block shown under it into your agent (a Claude Project, Claude Code, a custom GPT-style agent, etc.).
3. Your agent can now do things like *"Add Sweet Soulard Bakery, 1912 S 12th St, 314-555-0142, they only have Instagram"*. The lead appears in **Researching**, marked with a bot icon.

Endpoints (all need `Authorization: Bearer <key>`):

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/agent` | Self-describing docs: fields, services, stages |
| GET | `/api/agent/stages` | Pipeline stages (use `id` as `status`) |
| GET | `/api/agent/leads?q=&status=` | Search leads |
| GET | `/api/agent/leads/:id` | One lead plus its activity log |
| POST | `/api/agent/leads` | Create one lead, or `{ "leads": [...] }` for many. Duplicates are skipped. |
| PATCH | `/api/agent/leads/:id` | Update fields or move stages (`{"status":"contacted_email"}`) |
| POST | `/api/agent/leads/:id/notes` | `{ "text": "...", "type": "note" \| "email" \| "call" \| "meeting" }` |

Revoke a key at any time in Settings.

---

## Claude usage and cost

Claude features use `claude-opus-5-5` by default. You can change it with the `CLAUDE_MODEL` env var. They're only called when you click **Find leads**, **Extract details** or **Audit with Claude**. A lead search with web search typically costs a few cents to a few tens of cents, depending on how many sites Claude opens. If Claude declines a request, the API automatically retries it on a fallback model.

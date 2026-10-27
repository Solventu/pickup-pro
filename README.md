# PickupPro

**Find your next game.** PickupPro is a web app for discovering pickup sports games around the world, joining them, and connecting with other athletes.

Live demo: [pickup-pro-one.vercel.app](https://pickup-pro-one.vercel.app)

## Features

- **Events map** – browse casual and official games on an interactive Mapbox map, with filters for 18 sports (basketball, football, tennis, padel, climbing and more) and event type.
- **Join games** – sign up for an event, see how many spots are left and who else is going.
- **Athlete profiles** – username, bio, favourite sport, avatar, and public or private accounts with follow requests.
- **Social feed** – posts with photos and an optional map location, likes, comments, and a "following" feed.
- **Notifications** – follow requests, new followers and moderation notices.
- **AI assistant** – a chatbot (powered by Claude) that recommends upcoming events based on what you ask for.
- **AI moderation** – every post is checked on the server before it is published.
- **Admin tools** – the admin can create events and remove posts or events.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org) (App Router), [React 19](https://react.dev) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com), [Framer Motion](https://www.framer.com/motion/), [Lenis](https://lenis.darkroom.engineering/) |
| Backend | [Supabase](https://supabase.com) – auth, Postgres with Row Level Security, storage, realtime |
| Maps | [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) |
| AI | [Anthropic API](https://docs.claude.com) (Claude) |
| Hosting | [Vercel](https://vercel.com) |

## Getting started

### 1. Requirements

- Node.js 20 or newer
- A Supabase project, a Mapbox account and an Anthropic API key

### 2. Install

```bash
git clone https://github.com/Solventu/pickup-pro.git
cd pickup-pro
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Where it is used | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server | No (protected by RLS) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Browser (map) | No – restrict it to your domain in the Mapbox dashboard |
| `ANTHROPIC_API_KEY` | Server only (chatbot, moderation) | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (admin actions, saving posts) | **Yes** |
| `ADMIN_UID` | Server only – the Supabase user id of the admin | Keep private |

Set the same variables in your Vercel project settings for production. Never commit `.env.local` (it is already in `.gitignore`) and never prefix a secret with `NEXT_PUBLIC_`.

### 4. Database

In the Supabase dashboard open **SQL editor** and run these files in order:

1. `supabase-rls.sql` – Row Level Security policies
2. `supabase-schema-fixes.sql` – optional columns and cascading deletes
3. `supabase-security.sql` – security hardening (see below)
4. `supabase-seed-events.sql` – optional sample events

In `supabase-rls.sql`, replace the admin user id with your own before running it.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with ESLint |

## Project structure

```
app/
  page.js               # home: events map, filters, event list
  feed/                 # social feed
  athletes/[id]/        # athlete profile
  post-event/           # create an event (admin)
  login/, signup/       # authentication
  api/
    posts/              # create a post (validation + AI moderation)
    moderate-post/      # live moderation check for the composer
    chat/               # AI event assistant
    admin/              # admin-only actions (verified on the server)
components/             # UI components (map, cards, modals, chatbot, ...)
lib/                    # Supabase clients, auth, helpers, rate limiting
supabase-*.sql          # database policies and migrations
```

## Security

- **Row Level Security** on every table: users can only change their own data, private accounts are only visible to accepted followers, and only the admin can create or delete events.
- **Server-side checks**: admin actions, the chatbot and post creation verify the user's Supabase token on the server. Nothing relies on flags sent by the browser.
- **AI moderation runs on the server** in `/api/posts`. After `SUPABASE_SERVICE_ROLE_KEY` is set, run the optional last step in `supabase-security.sql` so posts can only be created through that route.
- **Database limits** on text length, username format, coordinates, URLs, one like and one sign-up per user, and no joining past or full events.
- **Storage**: users can only upload into their own folder; images only, up to 5 MB.
- **Rate limiting** per IP and per account on all AI endpoints, plus input size limits.
- **Safe links**: only `http(s)` URLs are ever rendered as links.
- **Security headers**: HSTS, no framing, no MIME sniffing, strict referrer policy.

Found a security issue? Please contact the author privately instead of opening a public issue.

## Author

**Erik** – [@Solventu](https://github.com/Solventu)

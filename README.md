<div align="center">

# RTM Frontend

React 19 + TypeScript SPA for [RTM](https://rtm.developermajd.com), a
real-time messaging app. See the [root README](https://github.com/DeveloperMajd/rtm_frontend/blob/main/../README.md)
for the project overview, or the [backend repo](https://github.com/DeveloperMajd/rtm_backend)
for the Laravel API this talks to.

**Live**: [rtm.developermajd.com](https://rtm.developermajd.com)

</div>

## Stack

- **React 19** + **TypeScript**, **Vite 8**
- **TanStack Query v5** — server state, cache invalidation, optimistic UI
- **React Router v7**
- **Laravel Echo** + **pusher-js** — talks to the backend's self-hosted
  Reverb WebSocket server (Pusher-protocol compatible)
- **Tailwind CSS v4** (`@theme`) for utilities + a **Sass** token layer
  (`src/styles/`) for hand-authored component styles — not one or the
  other; utilities for layout/spacing, Sass partials for anything with
  real structure (bubbles, modals, the reaction picker)
- **@mdi/js** — Material Design Icons as raw SVG path data (tree-shaken,
  only the ~20 icons actually used ship in the bundle), rendered through a
  one-file `Icon` wrapper — no icon-font, no per-icon npm packages

## Feature overview

- Direct + group messaging with live delivery, typing indicators, and
  read receipts — no polling
- Message grouping (consecutive messages from the same sender sit tight
  together, but **every message still shows its own timestamp** — a
  five-minute-apart pair from the same sender doesn't get visually
  collapsed into looking simultaneous)
- Reactions: a WhatsApp-style floating add-button beside the bubble
  (vertically centered, on the side toward the center of the screen so it
  never runs off-edge), placed reactions rendered below the bubble
- Left/kicked group members see their history exactly as it was, frozen,
  with the composer replaced by an explanatory banner — not just silently
  removed from the list
- A profile page with avatar upload, and a password-strength meter with a
  live rules checklist on registration
- **Accessibility**: skip-to-content link, `<main>`/landmark structure,
  a real WAI-ARIA tabs pattern (arrow-key navigation between Chats/
  Contacts, not just `role` attributes with no keyboard support), a focus
  trap + Escape-to-close on every modal, `aria-live` announcements for
  incoming messages and typing, and `prefers-reduced-motion` respected
  throughout
- **Responsive**: single-pane mobile layout (list *or* room, never both)
  driven by a CSS breakpoint + the current route, not JS width polling
- Light/dark theme via CSS custom properties, following the OS preference
  by default with a manual override that persists

## Project structure

```
src/
├── components/    # Conversations, ConversationRoom, MessageForm, etc.
│   ├── conversations/
│   └── ui/        # Avatar, Modal, Button, Icon — hand-rolled primitives, no UI kit
├── context/       # AuthContext
├── hooks/         # useConversations, useMessages, useEcho, useConnectionStatus…
├── layouts/       # ConversationsLayout (the two-pane shell), RequireAuth
├── pages/         # LoginPage, RegisterPage, ProfilePage, …
├── services/api/  # one Axios wrapper per resource (conversations.ts, messages.ts, …)
├── styles/        # Sass tokens + component partials (see below)
└── utils/         # baseTypes.ts, systemMessageText.ts, passwordRules.ts
```

`src/styles/` is organized as: `abstracts/` (Sass-only tokens — breakpoints,
z-index, easing — things Tailwind's `@theme` can't express), `base.scss`
(reset + global rules), and `components/*.scss` (one partial per UI
pattern). `tailwind.css` is the one plain-CSS file in the tree, out of
necessity — Sass can't resolve `@import "tailwindcss"`, so the Tailwind
layer and the color tokens it maps from live there, and everything
hand-authored lives in Sass.

## Local setup

```bash
cp .env.example .env   # points at localhost:8000 by default — matches the backend's Sail setup
npm install
npm run dev
```

Requires the backend running locally first (see
[`rtm_backend`](https://github.com/DeveloperMajd/rtm_backend)) — this is a
pure API client, there's nothing to mock.

```bash
npm run build     # tsc -b && vite build
npm run lint       # ESLint (hooks rules + fast-refresh compatibility enforced)
npm run preview    # serve the production build locally
```

### Environment reference

| Variable | Local dev | Production |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | `https://api.rtm.developermajd.com/api` |
| `VITE_BACKEND_URL` | `http://localhost:8000` | `https://api.rtm.developermajd.com` |
| `VITE_REVERB_APP_KEY` | matches the backend's local `.env` | a separate, production-only value — never reuse local-dev Reverb credentials |
| `VITE_REVERB_HOST` | `localhost` | `ws.rtm.developermajd.com` |
| `VITE_REVERB_PORT` | `8080` | `443` |
| `VITE_REVERB_SCHEME` | `http` | `https` |

The Reverb *app key* is public by design (identical model to Pusher) — it's
safe to ship in a client bundle. It identifies which app to connect to,
not a secret; the matching `REVERB_APP_SECRET` stays backend-only and is
what actually authenticates private-channel subscriptions.

## Deployment

**Vercel**, connected directly to this repo — push to `main` and it
redeploys automatically, no separate CI file needed for that part.

Two things beyond the default Vite-project import:
- `vercel.json` — a catch-all rewrite to `index.html`. Without it, a fresh
  page load on any route other than `/` (a direct link to `/register`, a
  refresh on `/conversations/:id`) 404s at Vercel's edge before the SPA's
  own router ever gets a chance to run — this bit us on the very first
  deploy.
- **CORS**: the backend's `CORS_ALLOWED_ORIGINS_PATTERN` is locked to the
  exact production origin (`https://rtm.developermajd.com`), not a
  wildcard — so a fresh Vercel deployment's default `*.vercel.app` URL
  will correctly fail CORS until the custom domain is attached. That's
  the security boundary working as intended, not a bug to route around.

## License

MIT — see `LICENSE`.

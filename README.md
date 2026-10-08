<div align="center">

# RTM Frontend

React 19 + TypeScript SPA for [RTM](https://rtm.developermajd.com), a
real-time messaging app. See the [root README](https://github.com/DeveloperMajd/rtm_frontend/blob/main/../README.md)
for the project overview, or the [backend repo](https://github.com/DeveloperMajd/rtm_backend)
for the Laravel API this talks to.

**Live**: [rtm.developermajd.com](https://rtm.developermajd.com)

</div>

## Stack

- **React 19** + **TypeScript** (strict), **Vite 8**
- **TanStack Query v5** for server state; live events patch its cache
- **React Router v7** (data router)
- **Laravel Echo** + **pusher-js**, talking to the backend's self-hosted
  Reverb WebSocket server (Pusher-protocol compatible)
- **Sass** for every hand-written style, on design tokens that are CSS
  custom properties in `src/styles/tailwind.css` (Tailwind v4 is loaded
  there too, though the components don't lean on utility classes)
- **Geist** and **Geist Mono**, self-hosted, and a hand-drawn 24px stroke
  icon set in `src/components/ui/icons.tsx`: no icon font, no UI kit
- **Vitest** + Testing Library + jsdom for the tests

The interface follows **Signal**, the app's own design system (dark
"Obsidian" and light "Porcelain" themes with a violet accent), designed
board by board for desktop, tablet and phone.

## Feature overview

- **Messaging**:
  - Direct and group conversations, delivered live over WebSockets with
    typing indicators, above the composer and on the chat's row in the
    list ("typing…", "Sam is typing…", "2 people typing…").
  - Replies, reactions, editing in the composer, and deletion after a
    confirmation.
  - Attachments (images and PDFs), with a lightbox for images.
  - An unread divider where you left off, and older history that loads as
    you scroll up.
- **Presence**: a dot on each person's avatar, in the design's shapes:
  filled when they're online, half-filled when they're away, a hollow
  ring when they're offline. Under their name it says "Online", "Away", or
  when they were last seen. You're away once the app has gone five minutes
  without a touch in any of its tabs, and back at the next one.
- **Search**: a ⌘K / Ctrl+K palette with recent searches, results grouped
  by conversation and the matching words marked. A result opens at the
  message itself. Inside a conversation, the palette can search just that
  one.
- **Search within a conversation**: the magnifier in the conversation's
  header opens a search bar. It marks the words in the messages and steps
  through the matches, newest first. Enter or ↑ goes to an older match,
  Shift+Enter or ↓ to a newer one, and Esc closes the bar.
- **Pin, mute and archive**, from a chat's row in the list or its info
  panel:
  - Pinned chats sit at the top under their own heading.
  - Muted chats keep their unread count on their row, in grey, but drop out
    of the badges that add them up.
  - Archived chats move to Archived, under the list. Archiving shows a
    toast with Undo, and a new message brings the chat back unless it's
    muted.
  - Your other tabs follow along.
- **Read receipts**: your newest message says "Sent" until it has been
  read, then "Seen" in a direct conversation or "Seen by N" in a group,
  which lists who has read it and who hasn't. It updates live.
  Conversations are marked as read only while you're looking: the tab is
  visible and the window focused. A read shows only if both people had read
  receipts on when it was made, so switching either way only affects reads
  from then on: turning them on doesn't reveal what was read while they were
  off, and turning them off doesn't hide what was already shown.
- **Message info**: the More menu's "Message info" shows when a message was
  sent and edited and, on your own, who has seen it and who hasn't yet. It
  updates live, and says so if you've turned your own read receipts off.
  Anyone who has turned theirs off shows as "Not yet".
- **Jump to a message**: a reply's quote and a search result both jump to
  the message, loading the history around it if it isn't on screen, with a
  brief highlight. From there, history loads both ways as you scroll, and
  "Jump to latest" goes back to the newest messages.
- **Copy link**: "Copy link", in the More menu or the long-press sheet,
  copies a link to a message, yours or anyone's. The link jumps to it,
  through sign-in first if needed (Google included). Someone who isn't in
  the conversation is told just that, rather than that it's gone.
- **Saved messages**: "Save message", in the same menu and sheet, keeps a
  message to find again, yours or anyone's. Saved, beside Chats and
  Contacts in the navigation, lists them, most recently saved first; each
  opens its conversation at the message, and its bookmark takes it off the
  list. Only you see what you save. Nothing shows from a group you've left
  or that's been deleted, nor a message deleted since.
- **Groups**: an info panel with members and admin roles. Members who leave
  or are removed keep their history, read-only and frozen at that point.
- **Shared media**: a chat's info panel shows its newest photos, three to
  a row, and its newest files, each counted. See all swaps the panel for
  all of them, a page at a time, and a photo opens in the viewer with who
  sent it and when. Someone who left a group sees what was sent while
  they were in it.
- **Account**: sign-in, registration with a live password-rules checklist,
  password reset, and Google sign-in. The profile page has an avatar
  upload and a bio, which anyone you share a chat with sees in your
  contact panel, under your name.
- **Settings**:
  - Theme: Light, Dark, or System (the default).
  - Notifications, for messages in chats you're not looking at:
    - a soft tone, made with the Web Audio API, so there's no sound file;
    - desktop notifications, asked for only from their switch. If the
      browser has blocked them, the switch says so and where to change it.
    - Neither goes off for your own messages, group events or muted chats.
  - Privacy:
    - read receipts, which work both ways;
    - who sees when you were last online: everyone, your contacts, or
      nobody;
    - typing indicators.
    - The server enforces all three.
- **When things go wrong**, nothing typed is lost:
  - Drafts are kept on the device.
  - An expired session asks you to sign in again, then returns you to the
    same chat.
  - A failed or rate-limited send stays in the composer with Retry.
  - Offline, sending pauses and the draft waits.
  - The connection state shows in the conversation, and is announced.
- **Phones and tablets**:
  - Up to 768px, one screen at a time, with a bottom tab bar.
  - From 768px, the rail and list sit beside the conversation.
  - From 1280px, the info panel docks as a third column.
  - On touch screens:
    - a long press on a message opens its actions;
    - swiping a message right starts a reply;
    - the paperclip offers the photo library, the camera or a file.
  - The composer stays above the on-screen keyboard.
- **Accessibility**:
  - Landmarks and a skip link.
  - Keyboard access to every control, including a one-stop toolbar per
    message.
  - Focus trapped in dialogs and sheets, and Escape closes them.
  - Live regions for new messages, typing and connection changes.
  - Visible focus throughout, and reduced motion respected.
  - Text contrast checked with axe in both themes.

## Project structure

```
src/
├── components/
│   ├── auth/           # sign-in layout, session-expired dialog
│   ├── conversations/  # list, room, messages, composer, search, info panels
│   ├── settings/       # settings page header, the /me settings list
│   └── ui/             # primitives: Button, Modal, BottomSheet, Menu, Avatar, EmptyState…
├── context/            # AuthContext
├── hooks/              # useConversations, useMessages, useEcho, gestures, viewport…
├── layouts/            # AppShell (rail / tab bar), ConversationsLayout, SettingsLayout
├── pages/              # sign-in pages, profile, settings, 404
├── services/api/       # one Axios wrapper per resource
├── styles/             # tokens, Sass partials (see below)
└── utils/              # pure helpers, each with its own tests
```

`src/styles/` holds:
- `abstracts/`: Sass-only constants and mixins (breakpoints, z-index,
  easing, the `touch` media query);
- `_base.scss`: the reset and global rules;
- `components/*.scss`: one partial per UI pattern.

`tailwind.css` is the one plain-CSS file, because Sass can't resolve
`@import "tailwindcss"`. It holds the Tailwind layer and the Signal tokens
(`--c-*` colours for both themes, `--r-*` radii, `--fs-*` type sizes).

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
npm test            # Vitest, once (npm run test:watch to keep it running)
npm run typecheck   # tsc -b
npm run lint        # ESLint (hooks rules + fast-refresh compatibility enforced)
npm run build       # tsc -b && vite build
npm run preview     # serve the production build locally
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

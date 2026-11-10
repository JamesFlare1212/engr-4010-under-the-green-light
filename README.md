# Under the Green Light

English | [简体中文](README.zh-CN.md)

A multiplayer Guardians rescue scenario app for play across multiple devices. Built with **Bun, Svelte 5, Vite 8, TypeScript, SQLite, and Tailwind CSS 4**, with Docker Compose for self-hosting.

Twelve maintenance workers are trapped in a tidal pump station outside The Shell. Seawater is flooding in, but the screen still shows a green safety signal. The team must investigate evidence, coordinate with other guilds, choose a route, and complete three objectives: establish access, evacuate the workers, and isolate the hazards.

## Run locally

Local development has been validated with Bun 1.4.4; the Dockerfile still defaults to Bun 1.4.2. Exact dependency versions are pinned in `bun.lock`; the ranges in `package.json` are not the installed versions. See [dependency versions and compatibility notes](docs/DEPENDENCIES.md) (Chinese) and the [QA record](docs/QA.md).

Frontend libraries are bundled during the build and listed with development dependencies. The production server only installs Zod and uses Bun's built-in HTTP, WebSocket, and SQLite support.

```bash
bun install --frozen-lockfile
bun run dev
```

Open the address printed by Vite, normally `http://localhost:5173`. The development script starts both Bun (port 3000) and Vite (port 5173, or the next available port). To connect from a phone, use your computer's LAN IP address. Both devices must be on the same network, with the relevant ports accessible.

Restart `bun run dev` after updating the Vite proxy configuration. If an older server reports that the request origin does not match the room address, restart the server and refresh the page; there is no need to delete the room or database.

In production, one Bun process serves static assets, the HTTP API, and WebSocket connections:

```bash
bun run build
bun start
```

## Docker Compose

```bash
docker compose up -d
```

Before the first launch, push this configuration to `main`, wait for GitHub Actions to publish the image successfully, and set the image visibility to Public in GitHub Packages. Subsequent pushes to `main` run checks and publish amd64 / arm64 images; Watchtower checks for updates every 60 seconds by default and updates the app. Pull requests only validate the build. Open `http://localhost:3000`. SQLite data remains in the existing named volume, `green-light-data`.

Optionally copy `.env.example` to `.env` to configure `APP_PORT`, `PUBLIC_ORIGIN` behind a reverse proxy, `APP_IMAGE`, and the update interval. When migrating an existing server to this configuration, run the command above from the original deployment directory and keep the original Compose project name to reuse its data volume. To build locally from source:

```bash
docker compose -f compose.yaml -f compose.build.yaml up -d --build app
```

This mode does not update the app automatically. See the [deployment guide](docs/DEPLOYMENT.md) (Chinese) for initial deployment, HTTPS, backups, rollbacks, and the single-instance requirement.

## How to play

1. Create a room and choose the full or short scenario, 1–4 GM seats, and physical or virtual dice. Two GM seats provide a Co-GM setup.
2. Share the four-digit room code, link, or QR code. The host assigns GM, player, and observer permissions; members choose their own team roles.
3. The GM starts the mission. The app synchronizes the briefing, evidence, NPC messages, and objective prompts, with read-aloud support on demand. The full scenario has three preparation checks; the short scenario skips preparation rolls.
4. Negotiation, route selection, and remediation use preset ballots. The GM closes each ballot manually and reveals the tally. Choices remain hidden until then, players can change their votes, and voting does not close automatically when everyone has voted. The GM resolves ties and records the reason.
5. The GM announces a preset or custom action, fallback plan, justification, and DC. Players volunteer to lead or assist; the app randomly selects one volunteer to lead. Only that player can roll virtual dice; for physical dice, the GM enters a result from 1–20.
6. The app resolves five outcome tiers. A failed execution check automatically opens a remediation ballot if supplies remain. Each check can improve by at most one tier, and retries do not consume either of the two emergency kits twice. The three objectives can be completed in a different order.
7. All members, including players and observers, can edit the handover, generate a factual draft, and save unfinished work. Once the actual public statement, named owner, and next update time are complete, the GM opens the shared debrief. The app supports handover text export, full JSON archive export for GMs, and creating a new room from an archive.

Appearance follows the browser's light or dark preference and updates immediately when it changes. Each device also follows its browser's preferred supported language (English or Chinese; otherwise English). Browser language changes update the interface immediately. The language button provides a temporary override until the next browser language change or page reload; older saved language choices no longer override the browser.

UI layouts, responsive behavior, and state styling use Tailwind CSS 4 utilities in the Svelte components. `src/app.css` retains theme tokens, Tailwind base/shared utilities, and dice keyframes rather than page-specific CSS. See the [styling guide](docs/STYLING.md) (Chinese).

Interface icons use locally bundled Font Awesome Free solid SVGs, imported individually through `src/components/Icon.svelte`. The brand mark and favicon use its shield-heart icon. Virtual rolls animate the D20 icon for 700 ms while the result stays still; connection spinners appear only while connecting. Reduced-motion preferences disable animations. Attribution and license: [Font Awesome Free](public/licenses/Font-Awesome-Free.txt).

Both languages synchronize through the same content IDs. Custom plans, notes, statements, and reflections retain their original input language. Players do not receive private GM context or notes. Classroom timing is tracked separately from the story's twelve-minute window.

## Synchronization and recovery

SQLite is the authoritative save store. WebSocket connections deliver complete snapshots filtered by each member's permissions. The browser saves its credentials and latest snapshot so refreshing or reconnecting restores the same identity. During a disconnection, reading remains available and writes pause; reconnecting fetches the current server state. The app includes heartbeats, reconnect backoff, synchronization when returning to the foreground, HTTP snapshot recovery, and presence tracking across browser tabs.

Write commands have unique IDs. Database transactions save progress and deduplication records together. GM actions check the state version and return the latest state on a conflict; player votes and applications bind to specific IDs and can be submitted concurrently. Reopening recruitment issues a new check ID so delayed commands cannot enter the new round. See [architecture and protocol](docs/ARCHITECTURE.md) (Chinese).

The app retains the latest 300 voting rounds and 1,500 log entries. Local drafts survive room-tab and chapter changes, keep their original state version, and can be reviewed or exported from the draft tray. Save or export before leaving or reloading: these local drafts are not cross-device or persistent saves.

Archives export as `green-light-save` v2 and import v1/v2. Recovery creates a new owner; historical identities keep their names and records without using any of the 40 active seats. Save files have a 32 MiB UTF-8 budget, including headroom for recovery metadata; ordinary write requests remain limited to 1 MiB. Over-budget changes are rejected without partial saves or silent text deletion. Keep database backups; see the [state-machine fixes and validation boundaries](docs/STATE_MACHINE_AUDIT.md) (Chinese).

## Checks

```bash
bun run check
bun test tests
bun run build
# Or run all of the above
bun run verify
```

Tests cover rules, idempotent resource use, permissions, ballot secrecy, SQLite restarts, complete playthroughs over HTTP, and real WebSocket disconnection and reconnection. Isolated client and Svelte-script tests also cover delayed responses, reconnect lifetimes, draft remounts and save races. Recovery tests cover full rooms, legacy archives, large HTTP/WebSocket snapshots and UTF-8 byte boundaries; they do not replace browser interaction tests. The [QA record](docs/QA.md) (Chinese) distinguishes automated tests, browser checks, and environment checks that have not been performed.

## Repository layout and development references

```text
src/                         Svelte UI, language switching, browser synchronization
shared/                      Public bilingual scenario, protocol types, outcome presentation
server/                      Bun server, state machine, SQLite, private GM context
tests/                       Rules, persistence, permissions, protocol, multiplayer tests
public/                      Selected public assets and font licenses
content/scenario.zh-CN.json   Structured scenario reference used by content regression tests
docs/                        Architecture, rules, scenario, deployment and validation guides
docs/scenario/               Readable GM script and English player packet
tools/dev.ts                 Development server startup
```

The bilingual game content is version 1.0.0 in `shared/content.ts`; GM-only context is in `server/private-content.ts`. The [GM script](docs/scenario/gm-script.md), [English player packet](docs/scenario/player-packet.md), and structured scenario reference support development. The scripts describe the original session; [adaptation decisions](docs/DECISIONS.md) explain differences in the online game. These references are excluded from public assets and runtime images.

Further documentation is currently in Chinese: [scenario and world](docs/SCENARIO.md), [development handoff](docs/DEVELOPMENT_HANDOFF.md), and [sources and licenses](docs/SOURCES.md). Course rules, established world canon, this scenario's fictional facts, and session conventions are recorded separately. The game does not generate an aggregate ethics score or course grade. Development requires Bun; there is no Python or Office toolchain.

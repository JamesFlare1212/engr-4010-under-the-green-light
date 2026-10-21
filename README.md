# Under the Green Light

English | [简体中文](README.zh-CN.md)

A multiplayer Guardians rescue scenario app for play across multiple devices. Built with **Bun, Svelte 5, Vite, TypeScript, SQLite, and Tailwind CSS**, with Docker Compose for self-hosting.

Twelve maintenance workers are trapped in a tidal pump station outside The Shell. Seawater is flooding in, but the screen still shows a green safety signal. The team must investigate evidence, coordinate with other guilds, choose a route, and complete three objectives: establish access, evacuate the workers, and isolate the hazards.

## Run locally

Use Bun 1.4.2. Dependencies are pinned in `bun.lock`.

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

Each device can switch between English and Chinese while synchronizing through the same content IDs. Custom plans, notes, statements, and reflections retain their original input language. Players do not receive private GM context or notes. Classroom timing is tracked separately from the story's twelve-minute window.

## Synchronization and recovery

SQLite is the authoritative save store. WebSocket connections deliver complete snapshots filtered by each member's permissions. The browser saves its credentials and latest snapshot so refreshing or reconnecting restores the same identity. During a disconnection, reading remains available and writes pause; reconnecting fetches the current server state. The app includes heartbeats, reconnect backoff, synchronization when returning to the foreground, HTTP snapshot recovery, and presence tracking across browser tabs.

Write commands have unique IDs. Database transactions save progress and deduplication records together. GM actions check the state version and return the latest state on a conflict; player votes and applications bind to specific IDs and can be submitted concurrently. See [architecture and protocol](docs/ARCHITECTURE.md) (Chinese).

## Checks

```bash
bun run check
bun test tests
bun run build
# Or run all of the above
bun run verify
```

Tests cover rules, idempotent resource use, permissions, ballot secrecy, SQLite restarts, complete playthroughs over HTTP, and real WebSocket disconnection and reconnection. The [QA record](docs/QA.md) (Chinese) distinguishes automated tests, browser checks, and environment checks that have not been performed.

## Repository layout and materials

```text
src/                         Svelte UI, language switching, browser synchronization
shared/                      Public bilingual scenario, protocol types, outcome presentation
server/                      Bun server, state machine, SQLite, private GM context
tests/                       Rules, persistence, permissions, protocol, multiplayer tests
public/                      Selected public assets and font licenses
content/scenario.zh-CN.json   Original development seed, preserving the draft's scope
docs/                        World background, rules handoff, implementation and deployment guides
materials/                   Reference originals and scenario drafts; excluded from runtime images and public assets
tools/                       Document tools and development startup scripts
```

The bilingual web adaptation is version 1.0.0 in `shared/content.ts`. The original Word files, player packet, flowchart, and development seed are preserved. See the adaptation mapping in the [decision log](docs/DECISIONS.md) (Chinese).

Further documentation is currently in Chinese: [project brief](docs/PROJECT_BRIEF.md), [world and course background](docs/WORLD_AND_COURSE.md), [development handoff](docs/DEVELOPMENT_HANDOFF.md), and [sources and usage scope](docs/SOURCES.md). Course rules, established world canon, this scenario's fictional facts, and session conventions are recorded separately. The game does not generate an aggregate ethics score or course grade.

Document maintenance uses `requirements-docs.txt`:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-docs.txt
python tools/extract_materials.py
python tools/build_documents.py --output /tmp/under-the-green-light-docs
```

`build_documents.py` reproduces the authored draft and does not import later manual Word edits. Its default output location is a temporary directory.

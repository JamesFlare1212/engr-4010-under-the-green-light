# Developer handoff

仓库维护 Bun / Svelte / SQLite 联机游戏；运行、验证与部署从 README 开始。公共剧情在 shared/，GM 私密内容在 server/，可读剧本与开发参考在 docs/ 和 content/。

## Read first

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DEVELOPMENT_HANDOFF.md`
4. `docs/SCENARIO.md`
5. `docs/DECISIONS.md`

## Working conventions

- Use Chinese for project discussions and handoff prose; preserve English read-aloud dialogue and player-facing terms where supplied.
- Distinguish course rules, the Guardians' world canon, this scenario's fiction, and proposed session conventions. `docs/DECISIONS.md` records that boundary.
- Select public game content deliberately. Keep GM scripts and development references out of public assets and runtime images; keep server modules and credentials out of client bundles.
- For gameplay implementation, begin with explicit state transitions and rule behavior in `docs/DEVELOPMENT_HANDOFF.md`. Let the GM enter or adjust fictional outcomes and choose custom routes.
- Keep important evidence accessible after failed checks. Track people, isolation and truthfulness separately. Do not infer ethical quality or course grades from dice totals.
- Keep dependencies scoped to the game and its build, checks and tests. Document commands in README; the project does not require Python or Office tooling.
- When editing scenario content, reconcile `shared/content.ts`, `server/private-content.ts`, GM/player references in `docs/scenario/` and `content/scenario.zh-CN.json` intentionally. Runtime behavior follows the implemented state machine; reference scripts retain their original session conventions where documented.
- Preserve English read-aloud dialogue and stable evidence, NPC, route and objective IDs. Verify changes with `bun run check`, `bun test tests` and `bun run build`.

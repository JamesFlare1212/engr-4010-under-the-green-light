# Developer handoff

This repository currently contains project preparation, not an implemented web app.

## Read first

1. `README.md`
2. `docs/PROJECT_BRIEF.md`
3. `docs/WORLD_AND_COURSE.md`
4. `docs/DEVELOPMENT_HANDOFF.md`
5. `content/scenario.zh-CN.json`

## Working conventions

- Use Chinese for project discussions and handoff prose; preserve English read-aloud dialogue and player-facing terms where supplied.
- Treat `materials/**/originals/` as reference originals. Store subsequent adaptations as separate versions.
- Distinguish course rules, the Guardians' world canon, this scenario's fiction, and proposed session conventions. `docs/DECISIONS.md` records that boundary.
- Do not copy the entire materials directory into publicly served application assets. Select game content deliberately; course handouts and student work retain their original ownership.
- The flowchart HTML is a standalone reference, not the application's architecture or a selected UI framework.
- For gameplay implementation, begin with explicit state transitions and rule behavior in `docs/DEVELOPMENT_HANDOFF.md`. Let the GM enter or adjust fictional outcomes and choose custom routes.
- Keep important evidence accessible after failed checks. Track people, isolation and truthfulness separately. Do not infer ethical quality or course grades from dice totals.
- Material tools use `requirements-docs.txt`. Application dependencies, build commands and meaningful tests should be documented when an application is created.
- When editing scenario content, reconcile JSON, GM/player texts and diagrams intentionally. The current JSON is a development seed, not an automated rendering of the Word files.
- `tools/build_documents.py` reproduces the authored draft. It does not import later manual Word edits. Generate to a temporary directory unless intentionally replacing the draft.

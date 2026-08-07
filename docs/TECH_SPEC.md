# coolmathgames2.0 — Technical Spec

Covers: Anon/Student/Tutor frontends, Editor runtime, Catalog/Marketplace, Analytics, Mod lineage. Scoped to what's mocked; Profile stays display-only per spec (no CRUD).

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript | Two full theme systems (student/tutor) + a live-iframe editor pane wants component reuse and typed props more than Angular's DI ceremony buys you here. Not your day-job stack (AngularJS) — deliberate: this is greenfield SPA-with-heavy-client-state, React's ecosystem for that (react-query, iframe messaging patterns) is just deeper. |
| API | Node/Express or Python/FastAPI, pick one | Either is fine; FastAPI if you want pydantic schema validation to double as the cartridge JSON-schema validator (§4). Not Flask/Mojolicious — no reason to fork your day-job stack across two codebases unless you want the context-switch. |
| Primary DB | PostgreSQL | Mod lineage (§3.3) is a self-referential FK tree with integrity constraints you want the DB to enforce, not application code. Mongo (your day-job DB) is a worse fit here specifically — lineage queries and leaderboard aggregation are relational problems. |
| Cache/Leaderboard | Redis | Sorted sets are the correct data structure for Rankings (§3.5) — `ZADD`/`ZREVRANGE`/`ZRANK` give you top-N and "your rank" in O(log N) for free instead of `ORDER BY` over the whole XP table. |
| Object storage | S3-compatible (S3, R2, MinIO for local dev) | Cartridge engine bundles (compiled JS) and any thumbnail/media assets. |
| Realtime | SSE for chat streaming, `postMessage` for iframe (no WebSocket infra needed) | Chat is server→client streaming (LLM tokens), not bidirectional low-latency — SSE is simpler ops than WS. Editor↔preview is same-origin-adjacent iframe messaging, not a network protocol at all. |
| Auth | JWT, short-lived access + refresh, anon = no token issued | Anon mode literally has no session — see §5. |
| CI/CD | GitLab CI, Docker | Matches your existing tooling; nothing about this app resists it. |
| LLM | Anthropic API, tool-constrained generation (see §4.2) | Cartridge fill-only constraint enforced at the schema layer, not just prompt instruction. |

---

## 2. Core data model

```
User
  id, role: enum(student, tutor), display_name, avatar_url,
  created_at
  # anon has no User row — see §5

Cartridge                          # the mechanic/engine — non-transferable
  id, name, slug, author_id (User, FK, NEVER reassigned),
  schema_json,                     # JSON Schema the LLM must fill
  engine_bundle_url,               # compiled JS, served to iframe
  status: enum(draft, published),
  created_at, updated_at

Game                               # an instance — a filled schema
  id, cartridge_id (FK),
  owner_id (User, FK),             # who's editing/publishing THIS instance
  modded_from_id (Game, FK, nullable, self-ref),  # mod lineage, §3.3
  title, instance_data_json,       # validated against cartridge.schema_json
  visibility: enum(private, public),
  status: enum(draft, published, sent_to_student),
  target_student_id (User, FK, nullable),  # for "sent to student" cards
  created_at, updated_at

PlaySession
  id, game_id (FK), player_id (User, FK, nullable for anon),
  started_at, ended_at, completed: bool, score

XPEvent                            # append-only ledger, never mutate totals in place
  id, user_id (FK), delta: int, reason: enum(played, new_record, daily_login),
  game_id (FK, nullable), created_at
  # user's total XP = SUM(delta) — recompute or cache, never store as mutable field

Review
  id, game_id (FK), user_id (FK), rating: 1-5, body, created_at
```

Key integrity rules, enforced at the DB level:

- `Cartridge.author_id` is set once, no update path exists in the API — authorship immutability is a missing PUT/PATCH field, not a permission check.
- `Game.modded_from_id` self-references `Game`, not `Cartridge` — mods are of games (per your call), never of engines directly.
- Deleting a `User` who authored a `Cartridge` still in use: soft-delete only (`deleted_at` on User), never hard-delete — the FK chain depends on that row existing for attribution.

## 3. Screen → API mapping

### 3.1 Arcade (Anon / Student, shared)

```
GET /api/games?visibility=public&status=published
  -> list of Game + joined Cartridge.name for the "fmt:" meta line
  anon: no target_student_id filtering (no FOR YOU! cards, as designed)
  student: also returns games where target_student_id = current user
```

### 3.2 XP

```
POST /api/xp/events        { reason, game_id? }   # server computes delta, not client
GET  /api/xp/summary        -> { total, streak, recent: XPEvent[] }
```

`daily_login` reason fires once server-side on first authenticated request of the calendar day (server TZ or user TZ — pick one, document it, this is a real bug source if unspecified). New-record detection: compare submitted `PlaySession.score` against `MAX(score) WHERE game_id, player_id` before insert — do this in the same transaction as the XPEvent write, or a race lets two rapid plays both claim "new record."

### 3.3 Rankings

```
GET /api/rankings/{scope}   scope: local | country | global
  -> top 10 from Redis ZREVRANGE coolmath:xp:{scope}:{region_key}
  -> + caller's own rank via ZRANK, always appended even if outside top 10
```

XP write path (§3.2) also does `ZINCRBY` on all three sorted sets (global always, country by user's stored country, local by user's stored metro/region — needs one profile field even though Profile is otherwise display-only). Postgres XPEvent table is the source of truth; Redis is a derived cache — rebuildable from the event ledger if it drifts.

### 3.4 Profile (mockup-only, per spec)

```
GET /api/profile/{user_id}  -> denormalized read: user + xp summary + badge list (static, hardcoded badge defs for MVP)
# no PATCH/PUT — display-only means no write endpoint exists, not just no UI for it
```

### 3.5 Editor — cartridge insert / game load

```
GET  /api/cartridges?scope=mine|library|marketplace
POST /api/games                          { cartridge_id, modded_from_id? }
  -> creates draft Game, empty instance_data_json
  -> if modded_from_id set: copies source instance_data_json as starting point
POST /api/cartridges                     { name, schema_draft }
  -> only reachable via "+ Build New Cartridge", sets author_id = caller, permanent
```

Access check on load (the instance-locked vs full-access split from your permissions model):

```
access_level(user, cartridge) =
  FULL   if cartridge.author_id == user.id
  INSTANCE_ONLY otherwise
```

This one function gates whether the Editor UI shows schema/engine-edit controls at all — check it server-side too, not just client-side hiding, since `PATCH /api/cartridges/{id}/schema` must 403 for non-authors regardless of what the UI renders.

### 3.6 Editor — chat + generation

```
POST /api/games/{id}/chat    { message }   (SSE response, streamed tokens)
```

Server-side flow per message:

1. Load `Cartridge.schema_json` for this game.
2. Call LLM with schema as a **tool definition** (structured output / tool-use, not "please return JSON" in the prompt) — this is the actual enforcement of "LLM fills, never designs": the model can only emit arguments matching the schema, full stop, not a request to be well-behaved.
3. Validate returned JSON against schema server-side anyway (defense in depth — tool-use compliance isn't a hard guarantee).
4. On valid: write `Game.instance_data_json`, emit `{status: "VALID ✓"}` to the chat stream, push updated payload to preview pane.
5. On invalid: do not write; return validation errors as the assistant's next message, retry loop stays in chat, preview pane keeps last-valid state.

### 3.7 Editor — live preview

The iframe always runs the **same** engine bundle for a given cartridge (from `Cartridge.engine_bundle_url`), fed instance data via `postMessage`, not a new bundle per game. That's the "one runtime, hot-swappable disks" property from the design discussion — implement it literally:

```js
// parent (editor)
previewFrame.contentWindow.postMessage(
  { type: 'LOAD_INSTANCE', data: instanceDataJson }, targetOrigin
);
// iframe (engine bundle, shared across all games of this cartridge)
window.addEventListener('message', (e) => {
  if (e.data.type === 'LOAD_INSTANCE') engine.load(e.data.data);
});
```

Preview iframe is sandboxed (`sandbox="allow-scripts"`, no `allow-same-origin`) — cartridge engines are semi-trusted (tutor-authored code, per the FULL-access permission tier), sandbox it like third-party content regardless of who wrote it.

### 3.8 Catalog (Mine / Marketplace toggle)

```
GET /api/games?owner_id=me                         # Mine
GET /api/games?visibility=public&sort=top           # Marketplace
POST /api/games/{id}/mod                            # -> creates new Game, modded_from_id set, owner=me, status=draft
```

Marketplace listing must join through to `Cartridge.author_id` for the "cartridge by:" credit line — this is a second author reference on the same list item, don't let it get conflated with `Game.owner_id` in the query or the UI.

### 3.9 Analytics

```
GET /api/analytics/games/{id}              # per-game (My Games view)
  -> plays, MAU (distinct player_id over trailing 30d), avg rating,
     completion rate, replay rate, time series bucketed by day/week,
     mods_spawned: COUNT(Game WHERE modded_from_id = this game)
GET /api/analytics/cartridges/{id}         # per-cartridge (My Cartridges view)
  -> requires caller = cartridge.author_id, 403 otherwise
  -> aggregate across ALL games with this cartridge_id, regardless of owner:
     total plays, MAU, mod count, top mods by plays (cross-owner)
  -> mechanic health: AVG(completion_rate), AVG(rating) across the tree
```

`mods_spawned` and the whole per-cartridge rollup are the reason PlaySession/Review need `game_id`, not `cartridge_id` — always derive cartridge-level aggregates by joining through Game, never denormalize a cartridge_id onto PlaySession, or the numbers silently drift when a game gets re-parented (shouldn't happen, but don't build a schema that trusts it never will).

---

## 4. Cartridge schema/engine contract

Every cartridge ships two artifacts, versioned together:

1. `schema_json` — JSON Schema, defines what the LLM (and a human editor) can fill: item sets, difficulty ramp, distractors, misconception tags.
2. `engine_bundle` — compiled JS implementing `load(instanceData)`, `render()`, `getScore()`, `onComplete(callback)` as the minimum contract the preview iframe and production player both call. Full-access (cartridge author) editing means editing the source that compiles to this bundle; instance-only editing never touches it.

Schema versioning: bump `Cartridge.schema_version` on any breaking change to `schema_json`. Existing `Game` rows keep their `instance_data_json` valid against whatever version they were created under — store `Game.schema_version_at_creation` so a later schema change doesn't silently invalidate old published games. Don't force-migrate instance data on schema bump for MVP; that's a real feature (data migration UI) you don't need yet.

## 5. Auth & the three frontends

```
Anon:    no token. Arcade reads are public GET, no auth header.
         PlaySession.player_id = null on anon plays (score/completion still
         logged for aggregate analytics — MAU counts should probably EXCLUDE
         anon by definition, decide this before the number means anything).
Student: JWT, role=student. Gates: XP writes, Rankings row, Profile, FOR YOU! cards.
Tutor:   JWT, role=tutor. Gates: Editor, Catalog/Mine, Analytics.
         Marketplace browsing (read-only) — student-role or anon could
         arguably browse it too; spec doesn't require it, don't build it
         unless asked.
```

Role is fixed per account for MVP — no dual-role users, no role switcher in the real app (the three-way `[ANON][STUDENT][TUTOR]` toggle is demo-only scaffolding per your instruction, not a real feature; don't let it leak into production auth design as if it were one).

## 6. Frontend structure

```
/src
  /theme
    student.css       # DESIGN.md, y2k skin
    tutor.css          # flat skin, same token names, different values
    tokens.css          # shared CSS custom properties both themes set
  /components
    Mod.tsx             # <div class="mod {color}"> — generic bordered panel,
                         # used by BOTH themes, styled via theme CSS not props
    XPBar.tsx
    RankRow.tsx
    GameCard.tsx
  /screens
    /anon      Arcade.tsx
    /student   Arcade.tsx  XP.tsx  Rankings.tsx  Profile.tsx
    /tutor     Editor.tsx  Catalog.tsx  Analytics.tsx
  /editor
    ChatPane.tsx          # SSE consumer
    PreviewFrame.tsx      # postMessage wrapper around the iframe
```

`Mod.tsx` naming collision flagged earlier (product term "Mod" vs. CSS class `.mod`) — resolve now by renaming the component `Panel.tsx` internally even though the CSS class stays `.mod` for the retro-chrome reasons in DESIGN.md. Cheap to do before the codebase exists; expensive after.

## 7. MVP cut list

Explicitly out of scope per earlier calls in this thread — build these as static/stub, not real subsystems:

- Profile: read-only, no write endpoint, badges hardcoded.
- XP rule set: "5/5/5, subject to change" — implement as a config map (`XP_RULES = {played: 5, new_record: 5, daily_login: 5}`), not hardcoded literals scattered in handlers, since it's explicitly expected to change.
- Anon XP/progress: none. No local-storage stash, no migration flow — was scoped out this session.
- Cartridge schema migration UI: none, per §4.
- Any social layer on mods (mod leaderboards, notifications to cartridge author on new mod): none — only the passive credit line ships.

---

## 8. Suggested build order

1. Postgres schema + migrations (§2) — everything else depends on the lineage/authorship constraints being right from day one; retrofitting non-transferable authorship after data exists is painful.
2. Anon Arcade + one real cartridge/engine end-to-end (proves the schema+engine+iframe contract before building anything else on top of it).
3. Student auth, XP, Rankings (Redis wiring).
4. Tutor Editor (chat+preview+schema validation) — the highest-complexity surface, sequence it after the runtime contract is proven in step 2.
5. Catalog + mod flow.
6. Analytics (needs real play data to be worth building against — sequence last).

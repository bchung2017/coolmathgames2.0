"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO, type DemoRole } from "@/src/demo/identity";

type Tab = "arcade" | "editor" | "catalog" | "xp";
type CatalogView = "mine" | "marketplace";

interface ChatMsg {
  who: "tutor" | "engine";
  text: string;
  pre?: string;
  previewId?: string;
}

/** Enriched game as returned by GET /api/games (row + cartridge join). */
interface EnrichedGame {
  game_id: string;
  cartridge_id: string;
  cartridge_name: string;
  cartridge_author_id: string | null;
  owner_id: string | null;
  modded_from_id: string | null;
  title: string | null;
  topic: string;
  misconception: string | null;
  visibility: string;
  status: string;
  target_student_id: string | null;
}

const CARTRIDGES = [
  { id: "number-line", name: "Number Line", iso: "↔ integers & signed movement" },
  { id: "balance-scale", name: "Balance Scale", iso: "↔ equations & equality", soon: true },
  { id: "pipe-flow", name: "Pipe Flow", iso: "↔ rates & proportion", soon: true },
  { id: "sorting-gates", name: "Sorting Gates", iso: "↔ boolean logic", soon: true },
];

const COLORS = ["red", "green", "blue", "yellow"] as const;
const THUMB: Record<string, string> = { "number-line": "🚶", "balance-scale": "⚖", "pipe-flow": "💧", "sorting-gates": "⎇" };

function tabsFor(role: DemoRole): Tab[] {
  if (role === "anon") return ["arcade"];
  if (role === "student") return ["arcade", "xp"];
  return ["arcade", "editor", "catalog", "xp"];
}
const TAB_LABEL: Record<Tab, string> = {
  arcade: "Arcade",
  editor: "Level Editor",
  catalog: "Catalog",
  xp: "XP",
};

export default function Home() {
  const [role, setRole] = useState<DemoRole>("anon");
  const [tab, setTab] = useState<Tab>("arcade");

  // Editor state
  const [cartridge, setCartridge] = useState("number-line");
  const [topic, setTopic] = useState("comparing negative integers");
  const [misconception, setMisconception] = useState(
    "−5 > −2 because 5 > 2 (orders by magnitude, not position)",
  );
  const [instruction, setInstruction] = useState("Make a level that traps that mistake");
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      who: "engine",
      text:
        "Pick a cartridge, describe the student's confusion, and I'll fill it — items, difficulty ramp, and distractors that only work if the student has that exact misconception. Everything I hand back is schema-validated before it can be played.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Arcade + Catalog data
  const [arcade, setArcade] = useState<EnrichedGame[]>([]);
  const [arcadeLoading, setArcadeLoading] = useState(false);
  const [catalogView, setCatalogView] = useState<CatalogView>("mine");
  const [catalog, setCatalog] = useState<EnrichedGame[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Swap the whole skin by toggling body.className (mockup's approach), and keep
  // the active tab valid for the current role.
  useEffect(() => {
    document.body.className = "role-" + role;
    setTab((t) => (tabsFor(role).includes(t) ? t : "arcade"));
  }, [role]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const loadArcade = useCallback(async () => {
    setArcadeLoading(true);
    try {
      const url =
        role === "student"
          ? `/api/games?arcade=student&student_id=${DEMO.student.id}`
          : `/api/games?visibility=public&status=published`;
      const res = await fetch(url);
      setArcade(await res.json());
    } catch {
      setArcade([]);
    } finally {
      setArcadeLoading(false);
    }
  }, [role]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const url =
        catalogView === "mine"
          ? `/api/games?owner_id=${DEMO.tutor.id}`
          : `/api/games?visibility=public&status=published`;
      const res = await fetch(url);
      setCatalog(await res.json());
    } catch {
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogView]);

  useEffect(() => {
    if (tab === "arcade") loadArcade();
  }, [tab, loadArcade]);

  useEffect(() => {
    if (tab === "catalog") loadCatalog();
  }, [tab, loadCatalog]);

  // Tutor actions
  async function patchGame(id: string, body: Record<string, unknown>) {
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await loadCatalog();
  }
  const publish = (id: string) => patchGame(id, { status: "published", visibility: "public" });
  const sendToStudent = (id: string) =>
    patchGame(id, { status: "sent_to_student", target_student_id: DEMO.student.id });
  async function modGame(id: string) {
    await fetch(`/api/games/${id}/mod`, { method: "POST" });
    await loadCatalog();
  }
  async function deleteGame(id: string, label: string) {
    if (!window.confirm(`Delete "${label}"? This removes the game and its play sessions.`)) return;
    setCatalog((xs) => xs.filter((x) => x.game_id !== id)); // optimistic
    const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
    if (!res.ok) {
      await loadCatalog(); // rollback on failure
      window.alert("Delete failed — restored the list.");
    }
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setMessages((m) => [
      ...m,
      { who: "tutor", text: instruction || "(generate)" },
      { who: "engine", text: "" },
    ]);
    try {
      const res = await fetch(`/api/cartridges/${cartridge}/games`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, misconception, instruction }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let visible = buf;
        let previewId: string | undefined;
        let pre: string | undefined;
        const marker = buf.indexOf("[[INSTANCE]]");
        if (marker !== -1) {
          visible = buf.slice(0, marker);
          const rest = buf.slice(marker + "[[INSTANCE]]".length).trim();
          try {
            const parsed = JSON.parse(rest);
            previewId = parsed.gameId;
            pre = parsed.preview;
          } catch {
            /* still streaming the json tail */
          }
        }
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { who: "engine", text: visible.trim(), pre, previewId };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          who: "engine",
          text: "Generation failed: " + (err as Error).message,
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  const tabs = tabsFor(role);

  return (
    <>
      <header>
        <div className="planet" aria-hidden="true">
          <div className="ring" />
          <div className="globe" />
        </div>
        <h1 className="wordmark">
          coolmath<small>games 2.0</small>
        </h1>
        <div className="role-toggle">
          <span className="label">Demo:</span>
          {(["anon", "student", "tutor"] as DemoRole[]).map((r) => (
            <button key={r} data-role={r} aria-pressed={role === r} onClick={() => setRole(r)}>
              {r}
            </button>
          ))}
        </div>
      </header>

      <nav role="tablist" aria-label="Main">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            &raquo; {TAB_LABEL[t]}
          </button>
        ))}
      </nav>
      <div className="rainbow" aria-hidden="true" />

      <main>
        {/* ================= ARCADE ================= */}
        <section hidden={tab !== "arcade"} role="tabpanel">
          <p className="section-head">
            <span className="deco">&gt;&gt;&gt;&gt;</span>{" "}
            {role === "student" ? "Your Arcade" : "Arcade"}{" "}
            <span className="deco">&lt;&lt;&lt;&lt;</span>
          </p>
          {arcadeLoading && <p className="empty">Loading…</p>}
          {!arcadeLoading && arcade.length === 0 && (
            <p className="empty">No published games yet — a tutor can publish one from the Catalog.</p>
          )}
          <div className="game-grid">
            {arcade.map((g, i) => (
              <ArcadeCard key={g.game_id} game={g} index={i} role={role} />
            ))}
          </div>
        </section>

        {/* ================= LEVEL EDITOR ================= */}
        {role === "tutor" && (
          <section hidden={tab !== "editor"} role="tabpanel">
            <p className="section-head">
              <span className="deco">&gt;&gt;&gt;&gt;</span> Level Editor{" "}
              <span className="deco">&lt;&lt;&lt;&lt;</span>
            </p>
            <div className="editor-layout">
              <div className="mod green">
                <div className="strip">Build A Level</div>
                <div className="chat-log" ref={logRef}>
                  {messages.map((m, i) => (
                    <div className={"msg " + m.who} key={i}>
                      <span className="who">&raquo; {m.who === "tutor" ? "You" : "Engine"}:</span>{" "}
                      {m.text}
                      {m.pre && <pre>{m.pre}</pre>}
                      {m.previewId && (
                        <p style={{ marginTop: 6 }}>
                          <a className="btn yellow" href={`/play/${m.previewId}`}>
                            Preview Level!
                          </a>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  <input
                    aria-label="Topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="topic"
                    style={{ flex: 1, minWidth: 120 }}
                    className="topic-in"
                  />
                  <input
                    aria-label="Misconception"
                    value={misconception}
                    onChange={(e) => setMisconception(e.target.value)}
                    placeholder="misconception"
                    style={{ flex: 2, minWidth: 160 }}
                    className="topic-in"
                  />
                </div>
                <div className="chat-input">
                  <input
                    type="text"
                    aria-label="Describe the level you want"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && generate()}
                  />
                  <button className="btn" onClick={generate} disabled={busy}>
                    {busy ? "…" : "Send!"}
                  </button>
                </div>
              </div>

              <div className="mod blue">
                <div className="strip">Pick A Cartridge</div>
                <ul className="cartridge-list">
                  {CARTRIDGES.map((c) => (
                    <li key={c.id}>
                      <button
                        aria-pressed={cartridge === c.id}
                        disabled={c.soon}
                        onClick={() => setCartridge(c.id)}
                      >
                        {c.name}
                        {c.soon ? " (soon)" : ""}
                        <span className="iso">{c.iso}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: 10 }}>
                  &raquo; New games land in <a href="#" onClick={(e) => { e.preventDefault(); setTab("catalog"); }}>Catalog → Mine</a> as drafts.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ================= CATALOG (tutor) ================= */}
        {role === "tutor" && (
          <section hidden={tab !== "catalog"} role="tabpanel">
            <p className="section-head">
              <span className="deco">&gt;&gt;&gt;&gt;</span> Catalog{" "}
              <span className="deco">&lt;&lt;&lt;&lt;</span>
            </p>
            <div className="sub-toggle">
              <button
                className={"btn" + (catalogView === "mine" ? "" : " yellow")}
                aria-pressed={catalogView === "mine"}
                onClick={() => setCatalogView("mine")}
              >
                Mine
              </button>
              <button
                className={"btn" + (catalogView === "marketplace" ? "" : " yellow")}
                aria-pressed={catalogView === "marketplace"}
                onClick={() => setCatalogView("marketplace")}
              >
                Marketplace
              </button>
            </div>
            {catalogLoading && <p className="empty">Loading…</p>}
            {!catalogLoading && catalog.length === 0 && (
              <p className="empty">
                {catalogView === "mine"
                  ? "No games yet — build one in the Level Editor."
                  : "Nothing published to the marketplace yet."}
              </p>
            )}
            <div className="game-grid">
              {catalog.map((g, i) => (
                <CatalogCard
                  key={g.game_id}
                  game={g}
                  index={i}
                  view={catalogView}
                  onPublish={() => publish(g.game_id)}
                  onSend={() => sendToStudent(g.game_id)}
                  onMod={() => modGame(g.game_id)}
                  onDelete={() => deleteGame(g.game_id, g.title ?? g.topic)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ================= XP (demo content) ================= */}
        {role !== "anon" && (
          <section hidden={tab !== "xp"} role="tabpanel">
            <p className="section-head" data-role-only="student">
              &gt;&gt;&gt;&gt; Your XP &lt;&lt;&lt;&lt;
            </p>
            <p className="section-head" data-role-only="tutor">
              <span className="deco">&gt;&gt;&gt;&gt;</span> Student: Maya R.{" "}
              <span className="deco">&lt;&lt;&lt;&lt;</span>
            </p>
            <div className="xp-summary">
              <div className="mod yellow">
                <div className="strip">Total XP</div>
                <div className="big">04,200</div>
              </div>
              <div className="mod green">
                <div className="strip">Streak</div>
                <div className="big">06 days</div>
              </div>
              <div className="mod red">
                <div className="strip">Levels Beat</div>
                <div className="big">017</div>
              </div>
            </div>
            <div className="mod blue">
              <div className="strip">Concepts</div>
              <ConceptRow name="Fractions" lv="LV 03 • last played 08/05" fills="ggggggg" cls="g" score="0700/1000" />
              <ConceptRow name="Neg. Numbers" lv="LV 02 • last played tonight" fills="yyyy" cls="y" score="0400/1000" />
              <ConceptRow name="Subtraction" lv="LV 01 • SUB-04 spotted!" fills="rr" cls="r" score="0200/1000" />
              <ConceptRow name="Ratios" lv="LV 00 • not started" fills="" cls="g" score="0000/1000" />
            </div>
            <p className="empty" style={{ marginTop: 10 }}>
              XP &amp; Rankings are still demo content — wiring them to real play sessions is the next feature.
            </p>
          </section>
        )}
      </main>

      <footer>
        <a href="#">about</a> | <a href="#">for tutors</a> | <a href="#">for parents</a> |{" "}
        <a href="#">privacy</a> | <a href="#">terms</a> | <a href="#">contact</a>
        <p style={{ marginTop: 8, color: "#888" }}>
          © 2026 coolmathgames2.0 — play smart, play well!
        </p>
      </footer>
    </>
  );
}

function ArcadeCard({ game, index, role }: { game: EnrichedGame; index: number; role: DemoRole }) {
  const color = COLORS[index % COLORS.length];
  const forYou = game.target_student_id === DEMO.student.id;
  return (
    <div className={`mod ${color} game-card`}>
      {forYou && role === "student" && <span className="badge red">FOR YOU!</span>}
      <div className="strip">{game.cartridge_name}</div>
      <div className={`thumb t${(index % 4) + 1}`}>{THUMB[game.cartridge_id] ?? "🎮"}</div>
      <h3>{game.title ?? game.topic}</h3>
      <p className="meta">
        FORMAT: {game.cartridge_id} • TOPIC: {game.topic}
      </p>
      {game.misconception && <p>Targets: {game.misconception}</p>}
      <a className="btn" href={`/play/${game.game_id}`}>
        Play!
      </a>
    </div>
  );
}

function CatalogCard({
  game,
  index,
  view,
  onPublish,
  onSend,
  onMod,
  onDelete,
}: {
  game: EnrichedGame;
  index: number;
  view: CatalogView;
  onPublish: () => void;
  onSend: () => void;
  onMod: () => void;
  onDelete: () => void;
}) {
  const color = COLORS[index % COLORS.length];
  const tag = game.status === "sent_to_student" ? "sent" : game.status;
  const tagLabel = game.status === "sent_to_student" ? "SENT TO MAYA" : game.status.toUpperCase();
  return (
    <div className={`mod ${color} game-card`}>
      <div className="strip">{game.cartridge_name}</div>
      <span className={`status-tag ${tag}`}>{tagLabel}</span>
      <h3>{game.title ?? game.topic}</h3>
      <p className="meta">
        FORMAT: {game.cartridge_id} • TOPIC: {game.topic}
      </p>
      {view === "marketplace" && (
        <p className="credit">
          cartridge by: {game.cartridge_author_id ?? "official"}
          {game.modded_from_id ? " • modded" : ""}
        </p>
      )}
      <div className="card-actions">
        <a className="btn yellow" href={`/play/${game.game_id}`}>
          Play
        </a>
        {view === "mine" && game.status === "draft" && (
          <button className="btn" onClick={onPublish}>
            Publish
          </button>
        )}
        {view === "mine" && (
          <button className="btn" onClick={onSend}>
            Send to Maya
          </button>
        )}
        <button className="btn red" onClick={onMod}>
          Mod
        </button>
        {view === "mine" && (
          <button
            className="btn red"
            onClick={onDelete}
            aria-label={`Delete ${game.title ?? game.topic}`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function ConceptRow({
  name,
  lv,
  fills,
  cls,
  score,
}: {
  name: string;
  lv: string;
  fills: string;
  cls: string;
  score: string;
}) {
  const total = 10;
  const filled = fills.length;
  return (
    <div className="concept-row">
      <div className="name">
        {name} <span className="lv">{lv}</span>
      </div>
      <div className="xp-bar" role="img" aria-label={`${name}: ${filled} of ${total} segments`}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={i < filled ? `fill ${cls}` : ""} />
        ))}
      </div>
      <div className="score">{score}</div>
    </div>
  );
}

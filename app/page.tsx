"use client";

import { useEffect, useRef, useState } from "react";

type Role = "student" | "tutor";
type Tab = "arcade" | "editor" | "xp";

interface ChatMsg {
  who: "tutor" | "engine";
  text: string;
  pre?: string;
  previewId?: string;
}

const CARTRIDGES = [
  { id: "balance-scale", name: "Balance Scale", iso: "↔ equations & equality" },
  { id: "pipe-flow", name: "Pipe Flow", iso: "↔ rates & proportion", soon: true },
  { id: "sorting-gates", name: "Sorting Gates", iso: "↔ boolean logic", soon: true },
  { id: "number-line", name: "Number Line Hopper", iso: "↔ integers & distance", soon: true },
];

export default function Home() {
  const [role, setRole] = useState<Role>("student");
  const [tab, setTab] = useState<Tab>("arcade");

  // Editor state
  const [cartridge, setCartridge] = useState("balance-scale");
  const [topic, setTopic] = useState("multi-digit subtraction");
  const [misconception, setMisconception] = useState(
    "subtracts smaller digit from larger regardless of position (borrow-avoidance)",
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

  // Swap the whole skin by toggling body.className (mockup's approach).
  useEffect(() => {
    document.body.className = "role-" + role;
    if (role === "student" && tab === "editor") setTab("arcade");
  }, [role, tab]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

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
        // Split off the final instance marker if present.
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
          <button
            data-role="student"
            aria-pressed={role === "student"}
            onClick={() => setRole("student")}
          >
            Student
          </button>
          <button
            data-role="tutor"
            aria-pressed={role === "tutor"}
            onClick={() => setRole("tutor")}
          >
            Tutor
          </button>
        </div>
      </header>

      <nav role="tablist" aria-label="Main">
        <button role="tab" aria-selected={tab === "arcade"} onClick={() => setTab("arcade")}>
          &raquo; Arcade
        </button>
        {role === "tutor" && (
          <button role="tab" aria-selected={tab === "editor"} onClick={() => setTab("editor")}>
            &raquo; Level Editor
          </button>
        )}
        <button role="tab" aria-selected={tab === "xp"} onClick={() => setTab("xp")}>
          &raquo; XP
        </button>
      </nav>
      <div className="rainbow" aria-hidden="true" />

      <main>
        {/* ================= ARCADE (demo content) ================= */}
        <section hidden={tab !== "arcade"} role="tabpanel">
          <p className="section-head">
            <span className="deco">&gt;&gt;&gt;&gt;</span> Your Arcade{" "}
            <span className="deco">&lt;&lt;&lt;&lt;</span>
          </p>
          <div className="game-grid">
            <div className="mod red game-card">
              <span className="badge blink">NEW!</span>
              <div className="strip">Balance Scale</div>
              <div className="thumb t1">⚖</div>
              <h3>Tip The Scales!</h3>
              <p className="meta">FORMAT: balance-scale • TOPIC: 2-step equations</p>
              <p>Both sides have to match — can you keep the scale level for all 12 rounds?</p>
              <a className="btn" href="/play/demo-balance-scale">
                Play!
              </a>
            </div>
            <div className="mod green game-card">
              <div className="strip">Pipe Flow</div>
              <div className="thumb t2">💧</div>
              <h3>Flood Control!</h3>
              <p className="meta">FORMAT: pipe-flow • TOPIC: unit rates</p>
              <p>Water&apos;s coming in fast. Set the right flow rates before the tank overflows!</p>
              <button className="btn" disabled>
                Soon
              </button>
            </div>
            <div className="mod blue game-card">
              <div className="strip">Sorting Gates</div>
              <div className="thumb t3">⎇</div>
              <h3>Gate Keeper!</h3>
              <p className="meta">FORMAT: sorting-gates • TOPIC: boolean logic</p>
              <p>AND, OR, NOT — route every shape to the right bin. Can you clear level 8?</p>
              <button className="btn" disabled>
                Soon
              </button>
            </div>
            <div className="mod yellow game-card">
              <span className="badge red" data-role-only="student">
                FOR YOU!
              </span>
              <span className="badge red" data-role-only="tutor">
                SENT TO MAYA
              </span>
              <div className="strip">Balance Scale</div>
              <div className="thumb t4">⚖</div>
              <h3>Negative Numbers, Round 2!</h3>
              <p className="meta">FORMAT: balance-scale • TOPIC: integers • MADE: tonight</p>
              <p>Your tutor made this one just for you. Those minus signs won&apos;t know what hit &apos;em!</p>
              <a className="btn" href="/play/demo-balance-scale">
                Play!
              </a>
            </div>
          </div>
        </section>

        {/* ================= LEVEL EDITOR (wired to the real generate route) ================= */}
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
                &raquo; <a href="#">What&apos;s a cartridge?</a>
              </p>
            </div>
          </div>
        </section>

        {/* ================= XP (demo content) ================= */}
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
        </section>
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

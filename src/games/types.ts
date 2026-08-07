/**
 * Shared shapes for the game engine.
 *
 * A CARTRIDGE is a mechanic isomorphic to a concept class. Its `generate` fills
 * a schema for one student's confusion (server-side, later an LLM call); its
 * `validate` is the quality gate that a filled instance must pass before it is
 * ever stored or rendered. The client-side engine (`mount`) only renders an
 * already-validated instance — it never generates content.
 *
 * (TECH_SPEC.md §4 targets a compiled engine bundle with a
 * load/render/getScore/onComplete contract behind a sandboxed iframe; today the
 * engine is still an in-app `mount()` module. That runtime change is tracked
 * separately — this file only carries the current, pre-iframe contract.)
 */

/** One playable challenge inside a balance-scale instance. */
export interface BalanceItem {
  /** e.g. "2x + 3 = 7" */
  prompt: string;
  /** the correct value of x */
  answer: number;
  /** answer choices shown to the player (includes `answer`) */
  choices: number[];
  /** the distractor that a student with the target misconception would pick */
  trap?: number;
}

/** The full generated payload stored in games.instance_data_json (as JSON). */
export interface BalanceInstance {
  items: BalanceItem[];
  ramp: "gentle" | "standard" | "steep";
}

/** Result reported by the engine when a play-through finishes. */
export interface PlayResult {
  score: number; // items answered correctly
  total: number;
  detail: Array<{ prompt: string; picked: number; correct: boolean; wasTrap: boolean }>;
}

/** Server-side cartridge definition: metadata + the generate/validate pair. */
export interface CartridgeServer<TInstance = unknown> {
  id: string;
  name: string;
  conceptClass: string;
  /** JSON Schema describing what an instance looks like (stored in cartridges.schema_json). */
  schemaJson: Record<string, unknown>;
  /** Fill the schema for a (topic, misconception). Deterministic stub today; an LLM call later. */
  generate(topic: string, misconception: string | null): TInstance;
  /** Quality gate. Return null if valid, else a human-readable reason. */
  validate(instance: unknown): string | null;
}

/** Client-side engine: renders a validated instance into a container. */
export interface CartridgeEngine<TInstance = unknown> {
  mount(
    container: HTMLElement,
    instance: TInstance,
    onComplete: (result: PlayResult) => void,
  ): () => void; // returns a teardown fn
}

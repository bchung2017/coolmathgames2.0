/**
 * Shared shapes for the game engine.
 *
 * A FORMAT is a mechanic isomorphic to a concept class. Its `generate` fills a
 * schema for one student's confusion (server-side, later an LLM call); its
 * `validate` is the quality gate that a filled instance must pass before it is
 * ever stored or rendered. The client-side engine (`mount`) only renders an
 * already-validated instance — it never generates content.
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

/** The full generated payload stored in instances.items (as JSON). */
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

/** Server-side format definition: metadata + the generate/validate pair. */
export interface FormatServer<TInstance = unknown> {
  id: string;
  name: string;
  conceptClass: string;
  /** JSON-schema-ish description of what an instance looks like (stored in formats.spec). */
  spec: Record<string, unknown>;
  /** Fill the schema for a (topic, misconception). Deterministic stub today; an LLM call later. */
  generate(topic: string, misconception: string | null): TInstance;
  /** Quality gate. Return null if valid, else a human-readable reason. */
  validate(instance: unknown): string | null;
}

/** Client-side engine: renders a validated instance into a container. */
export interface FormatEngine<TInstance = unknown> {
  mount(
    container: HTMLElement,
    instance: TInstance,
    onComplete: (result: PlayResult) => void,
  ): () => void; // returns a teardown fn
}

import type { NumberLineInstance, NumberLineItem, CartridgeServer } from "../types";

/**
 * number-line — the reference cartridge.
 *
 * Mechanic ↔ concept: a number line is a track and the number is just where you
 * stand. Positive = move right, negative = move left, adding a negative = walking
 * backward. That is the whole rule, with zero translation loss between the game
 * and signed-integer arithmetic.
 *
 * It targets a famous, well-documented misconception: kids think "−5 > −2
 * because 5 > 2." On a track that is simply standing in the wrong spot — the
 * error is visible and self-correcting. The LLM only fills `items`; the mechanic
 * (and its correctness) is load-bearing and lives in the engine.
 *
 * `generate` is a DETERMINISTIC STUB today. Swapping in a real LLM call later
 * changes only this function — schema, validator, and engine are unchanged.
 */

const SPEC = {
  format: "number-line",
  conceptClass: "signed-integers",
  produces: {
    items: "array of { start, moves[], answer, choices[], trap? }",
    ramp: "gentle | standard | steep",
  },
  invariants: [
    "answer === start + sum(moves)",
    "answer ∈ choices",
    "choices has 3–5 unique integers",
    "trap ∈ choices and trap ≠ answer (when present)",
    "1 ≤ items.length ≤ 20",
  ],
} as const;

const sum = (ns: number[]): number => ns.reduce((s, n) => s + n, 0);

/**
 * The misconception's landing spot. The classic error ("−5 > −2 because 5 > 2",
 * and its movement cousin "adding a negative still walks right") treats every
 * step as its magnitude and walks forward — landing at start + Σ|move|. When the
 * moves are all non-negative that collapses onto the answer, so fall back to the
 * fully reversed walk (start − Σmove), then to a simple off-by-one.
 */
function computeTrap(start: number, moves: number[]): number {
  const answer = start + sum(moves);
  const magnitudeWalk = start + sum(moves.map(Math.abs));
  if (magnitudeWalk !== answer) return magnitudeWalk;
  const reversedWalk = start - sum(moves);
  if (reversedWalk !== answer) return reversedWalk;
  return answer + 1;
}

function buildItem(start: number, moves: number[]): NumberLineItem {
  const answer = start + sum(moves);
  const trap = computeTrap(start, moves);
  const pool = new Set<number>([answer, answer + 1, answer - 1, trap]);
  const choices = [...pool].sort((a, b) => a - b).slice(0, 5);
  return { start, moves, answer, choices, trap };
}

export const numberLine: CartridgeServer<NumberLineInstance> = {
  id: "number-line",
  name: "Number Line",
  conceptClass: "signed-integers",
  schemaJson: SPEC,

  generate() {
    // A gentle ramp: single step → single backward step → crossing zero (the
    // "−5 > −2" hero item) → deeper into the negatives → chained moves. A real
    // generator would tune these to `topic` and the specific misconception.
    const seeds: Array<[number, number[]]> = [
      [2, [3]],        // 2 → 5      forward only
      [8, [-3]],       // 8 → 5      first backward step
      [3, [-5]],       // 3 → -2     crosses zero (walk right = the trap at 8)
      [-1, [-4]],      // -1 → -5    deeper negative; -5 is LEFT of -2, not "bigger"
      [0, [-2, 5]],    // 0 → 3      chained, crosses zero
      [4, [-6, 3]],    // 4 → 1      chained backward-then-forward
    ];
    return { items: seeds.map(([start, moves]) => buildItem(start, moves)), ramp: "gentle" };
  },

  validate(instance) {
    const inst = instance as Partial<NumberLineInstance> | null;
    if (!inst || !Array.isArray(inst.items)) return "items missing or not an array";
    if (inst.items.length < 1 || inst.items.length > 20) return "items length out of range";
    for (const [i, it] of inst.items.entries()) {
      if (typeof it.start !== "number" || !Number.isInteger(it.start)) return `item ${i}: bad start`;
      if (!Array.isArray(it.moves) || it.moves.length < 1) return `item ${i}: moves must be a non-empty array`;
      if (!it.moves.every((m) => Number.isInteger(m))) return `item ${i}: moves must be integers`;
      if (typeof it.answer !== "number") return `item ${i}: bad answer`;
      if (it.answer !== it.start + sum(it.moves)) return `item ${i}: answer ≠ start + sum(moves)`;
      if (!Array.isArray(it.choices) || it.choices.length < 3 || it.choices.length > 5)
        return `item ${i}: choices must have 3–5 entries`;
      if (new Set(it.choices).size !== it.choices.length) return `item ${i}: duplicate choices`;
      if (!it.choices.includes(it.answer)) return `item ${i}: answer not among choices`;
      if (it.trap !== undefined && (it.trap === it.answer || !it.choices.includes(it.trap)))
        return `item ${i}: trap must be a distractor in choices`;
    }
    return null;
  },
};

import type { BalanceInstance, BalanceItem, CartridgeServer } from "../types";

/**
 * balance-scale — the reference format.
 *
 * Mechanic ↔ concept: a two-pan balance is isomorphic to an equation. Keeping
 * the scale level == both sides equal == solving for x. The mechanic is
 * load-bearing; the LLM only fills in items and misconception-targeting traps.
 *
 * `generate` is a DETERMINISTIC STUB today (no API key needed to run the
 * skeleton). Swapping in a real LLM call later changes only this function — the
 * schema, the validator, and the engine are unchanged. That's the whole point
 * of "fill, don't design": the model output is constrained to `items`.
 */

const SPEC = {
  format: "balance-scale",
  conceptClass: "linear-equations",
  produces: {
    items: "array of { prompt, answer, choices[], trap? }",
    ramp: "gentle | standard | steep",
  },
  invariants: [
    "answer ∈ choices",
    "choices has 3–4 unique integers",
    "trap ∈ choices and trap ≠ answer (when present)",
    "1 ≤ items.length ≤ 20",
  ],
} as const;

/** A tiny linear equation a*x + b = c with integer solution. */
function eq(a: number, b: number, x: number): { prompt: string; answer: number } {
  const c = a * x + b;
  const sign = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
  return { prompt: `${a}x ${sign} = ${c}`, answer: x };
}

/**
 * Build choices around the answer. If the misconception hints at a specific
 * error, plant the corresponding wrong value as the `trap` distractor so the
 * item actually probes the broken mental model rather than being decorative.
 */
function withChoices(
  prompt: string,
  answer: number,
  misconception: string | null,
): BalanceItem {
  const m = (misconception ?? "").toLowerCase();
  let trap: number | undefined;

  if (m.includes("sign") || m.includes("negative")) {
    trap = -answer; // dropped/flipped the sign
  } else if (m.includes("add") || m.includes("subtract") || m.includes("sub-04")) {
    trap = answer + 1; // off-by-one from mishandling the constant term
  }

  const pool = new Set<number>([answer, answer + 1, answer - 1]);
  if (trap !== undefined) pool.add(trap);
  // Deterministic order (no Math.random — keeps generation reproducible).
  const choices = [...pool].sort((p, q) => p - q).slice(0, 4);
  return { prompt, answer, choices, trap };
}

export const balanceScale: CartridgeServer<BalanceInstance> = {
  id: "balance-scale",
  name: "Balance Scale",
  conceptClass: "linear-equations",
  schemaJson: SPEC,

  generate(topic, misconception) {
    // Gentle ramp of six equations; a real generator would tune to `topic`.
    const seeds: Array<[number, number, number]> = [
      [1, 3, 2],
      [2, 3, 2],
      [2, -1, 4],
      [3, 2, 3],
      [2, 5, -3],
      [4, -3, 2],
    ];
    const items = seeds.map(([a, b, x]) => {
      const { prompt, answer } = eq(a, b, x);
      return withChoices(prompt, answer, misconception);
    });
    return { items, ramp: "gentle" };
  },

  validate(instance) {
    const inst = instance as Partial<BalanceInstance> | null;
    if (!inst || !Array.isArray(inst.items)) return "items missing or not an array";
    if (inst.items.length < 1 || inst.items.length > 20) return "items length out of range";
    for (const [i, it] of inst.items.entries()) {
      if (typeof it.prompt !== "string" || !it.prompt) return `item ${i}: bad prompt`;
      if (typeof it.answer !== "number") return `item ${i}: bad answer`;
      if (!Array.isArray(it.choices) || it.choices.length < 3 || it.choices.length > 4)
        return `item ${i}: choices must have 3–4 entries`;
      if (new Set(it.choices).size !== it.choices.length) return `item ${i}: duplicate choices`;
      if (!it.choices.includes(it.answer)) return `item ${i}: answer not among choices`;
      if (it.trap !== undefined && (it.trap === it.answer || !it.choices.includes(it.trap)))
        return `item ${i}: trap must be a distractor in choices`;
    }
    return null;
  },
};

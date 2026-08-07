/**
 * Demo identities — the stand-in for real accounts while session auth is
 * deliberately deferred (no User table, no JWT yet). The [ANON|STUDENT|TUTOR]
 * toggle picks a role; these fixed ids fill the owner_id / player_id /
 * target_student_id columns so the role-gated features actually function and
 * demo end to end. When real auth lands, these get replaced by the JWT subject.
 */
export const DEMO = {
  tutor: { id: "demo-tutor", name: "You" },
  student: { id: "demo-student", name: "Maya R." },
} as const;

export type DemoRole = "anon" | "student" | "tutor";

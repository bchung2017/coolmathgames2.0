import type { NumberLineInstance, CartridgeEngine, PlayResult } from "../types";

/**
 * number-line client engine. Pure DOM/canvas — no framework. It draws the track,
 * stands the pawn on `start`, states the walk, and lets the player pick a landing
 * spot. Picking the wrong direction (the classic sign error) literally stands the
 * pawn in the wrong place, so the mistake is visible. React only hands it a div
 * and the validated instance; the game logic lives here so the cartridge stays
 * portable (the "moat" is framework-independent).
 */

function describeMoves(moves: number[]): string {
  return moves
    .map((m) => (m < 0 ? `back ${Math.abs(m)}` : `forward ${m}`))
    .join(", then ");
}

export const numberLineEngine: CartridgeEngine<NumberLineInstance> = {
  mount(container, instance, onComplete) {
    const items = instance.items;
    let idx = 0;
    const detail: PlayResult["detail"] = [];

    container.innerHTML = "";
    container.style.textAlign = "center";

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 150;
    canvas.style.maxWidth = "100%";
    const ctx = canvas.getContext("2d")!;
    container.appendChild(canvas);

    const prompt = document.createElement("p");
    prompt.setAttribute("aria-live", "polite");
    prompt.style.cssText = "font:bold 18px monospace;margin:12px 0;";
    container.appendChild(prompt);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;justify-content:center;flex-wrap:wrap;";
    container.appendChild(btnRow);

    const status = document.createElement("p");
    status.style.cssText = "margin-top:10px;min-height:1.4em;font:12px monospace;";
    container.appendChild(status);

    function drawTrack(pawnPos: number) {
      const it = items[idx];
      const values = [it.start, it.answer, ...it.choices, ...(it.trap !== undefined ? [it.trap] : [])];
      const lo = Math.min(...values) - 1;
      const hi = Math.max(...values) + 1;
      const pad = 34;
      const y = 96;
      const span = hi - lo || 1;
      const xFor = (v: number) => pad + ((v - lo) * (canvas.width - 2 * pad)) / span;
      // keep the tick labels from colliding on a wide range
      const step = span <= 22 ? 1 : Math.ceil(span / 22);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // axis
      ctx.strokeStyle = "#ffe000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xFor(lo), y);
      ctx.lineTo(xFor(hi), y);
      ctx.stroke();

      // ticks + labels
      ctx.fillStyle = "#fff";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      for (let v = Math.ceil(lo); v <= Math.floor(hi); v += step) {
        const x = xFor(v);
        const zero = v === 0;
        ctx.strokeStyle = zero ? "#fff" : "#8a8a2a";
        ctx.lineWidth = zero ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x, y + 7);
        ctx.stroke();
        ctx.fillText(String(v), x, y + 22);
      }

      // pawn — a standing marker with a flag
      const px = xFor(pawnPos);
      ctx.strokeStyle = "#3a8dff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, y - 4);
      ctx.lineTo(px, y - 40);
      ctx.stroke();
      ctx.fillStyle = "#3a8dff";
      ctx.beginPath();
      ctx.moveTo(px, y - 40);
      ctx.lineTo(px + 20, y - 34);
      ctx.lineTo(px, y - 28);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    function render() {
      const it = items[idx];
      prompt.textContent = `You're standing on ${it.start}. Walk ${describeMoves(it.moves)}. Where do you land?`;
      status.textContent = "";
      btnRow.innerHTML = "";
      drawTrack(it.start);
      for (const choice of it.choices) {
        const b = document.createElement("button");
        b.className = "btn yellow";
        b.textContent = String(choice);
        b.setAttribute("aria-label", `Land on ${choice}`);
        b.addEventListener("click", () => pick(choice));
        btnRow.appendChild(b);
      }
    }

    function pick(choice: number) {
      const it = items[idx];
      const correct = choice === it.answer;
      detail.push({
        prompt: `${it.start} then ${describeMoves(it.moves)}`,
        picked: choice,
        correct,
        wasTrap: choice === it.trap,
      });
      if (correct) {
        drawTrack(it.answer); // stand the pawn on the right spot
        status.textContent = `✓ You're standing on ${it.answer}!`;
        idx += 1;
        if (idx >= items.length) {
          const score = detail.filter((d) => d.correct).length;
          window.setTimeout(() => onComplete({ score, total: items.length, detail }), 600);
          prompt.textContent = `Done! ${score}/${items.length}`;
          btnRow.innerHTML = "";
          return;
        }
        window.setTimeout(render, 600);
      } else {
        drawTrack(choice); // show where they actually walked to
        status.textContent =
          choice === it.trap
            ? "You walked the wrong way — a negative step goes LEFT."
            : "Not quite — count the steps along the track.";
      }
    }

    render();
    return () => {
      container.innerHTML = "";
    };
  },
};

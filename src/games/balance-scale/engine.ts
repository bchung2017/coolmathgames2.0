import type { BalanceInstance, FormatEngine, PlayResult } from "../types";

/**
 * balance-scale client engine. Pure DOM/canvas — no framework. It builds its
 * own canvas + answer buttons inside `container`, runs the round loop, and
 * calls onComplete when the instance is finished. A React component only hands
 * it a div and the validated instance; the game logic lives here so the format
 * stays portable (the "moat" is framework-independent).
 */
export const balanceScaleEngine: FormatEngine<BalanceInstance> = {
  mount(container, instance, onComplete) {
    const items = instance.items;
    let idx = 0;
    const detail: PlayResult["detail"] = [];

    container.innerHTML = "";
    container.style.textAlign = "center";

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 240;
    canvas.style.maxWidth = "100%";
    const ctx = canvas.getContext("2d")!;
    container.appendChild(canvas);

    const prompt = document.createElement("p");
    prompt.setAttribute("aria-live", "polite");
    prompt.style.cssText = "font:bold 22px monospace;margin:12px 0;";
    container.appendChild(prompt);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;justify-content:center;flex-wrap:wrap;";
    container.appendChild(btnRow);

    const status = document.createElement("p");
    status.style.cssText = "margin-top:10px;min-height:1.4em;font:12px monospace;";
    container.appendChild(status);

    function drawScale(tilt: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      ctx.strokeStyle = "#ffe000";
      ctx.lineWidth = 4;
      // pivot post
      ctx.beginPath();
      ctx.moveTo(cx, 60);
      ctx.lineTo(cx, 200);
      ctx.stroke();
      // beam (tilts with correctness)
      ctx.save();
      ctx.translate(cx, 60);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(-140, 0);
      ctx.lineTo(140, 0);
      ctx.stroke();
      for (const dir of [-140, 140]) {
        ctx.beginPath();
        ctx.moveTo(dir, 0);
        ctx.lineTo(dir, 34);
        ctx.stroke();
        ctx.strokeStyle = "#3a8dff";
        ctx.strokeRect(dir - 30, 34, 60, 16);
        ctx.strokeStyle = "#ffe000";
      }
      ctx.restore();
      // base
      ctx.beginPath();
      ctx.moveTo(cx - 60, 200);
      ctx.lineTo(cx + 60, 200);
      ctx.stroke();
    }

    function render() {
      const it = items[idx];
      prompt.textContent = it.prompt + "   →   x = ?";
      status.textContent = "";
      btnRow.innerHTML = "";
      drawScale(0.12); // tilted = unsolved
      for (const choice of it.choices) {
        const b = document.createElement("button");
        b.className = "btn yellow";
        b.textContent = String(choice);
        b.setAttribute("aria-label", `Choose x equals ${choice}`);
        b.addEventListener("click", () => pick(choice));
        btnRow.appendChild(b);
      }
    }

    function pick(choice: number) {
      const it = items[idx];
      const correct = choice === it.answer;
      detail.push({ prompt: it.prompt, picked: choice, correct, wasTrap: choice === it.trap });
      if (correct) {
        drawScale(0); // level = solved
        status.textContent = "✓ Balanced!";
        idx += 1;
        if (idx >= items.length) {
          const score = detail.filter((d) => d.correct).length;
          window.setTimeout(() => onComplete({ score, total: items.length, detail }), 500);
          prompt.textContent = `Done! ${score}/${items.length}`;
          btnRow.innerHTML = "";
          return;
        }
        window.setTimeout(render, 500);
      } else {
        drawScale(0.22); // tips further = wrong
        status.textContent = choice === it.trap ? "Not quite — watch that sign/step!" : "Try again!";
      }
    }

    render();
    return () => {
      container.innerHTML = "";
    };
  },
};

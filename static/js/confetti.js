(() => {
  const COLORS = [
    "#22c55e",
    "#4ade80",
    "#38bdf8",
    "#0ea5e9",
    "#fbbf24",
    "#fb7185",
    "#a78bfa",
    "#f472b6",
  ];

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  window.triggerConfetti = function triggerConfetti(originX, originY) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const ox = typeof originX === "number" ? originX : w / 2;
    const oy = typeof originY === "number" ? originY : h * 0.35;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "confetti-canvas";
    Object.assign(canvas.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "10000",
    });
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const pieces = [];
    const n = 64;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.85;
      const speed = 6 + Math.random() * 14;
      pieces.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.95),
        vy: Math.sin(angle) * speed * 0.5 - 9 - Math.random() * 10,
        g: 0.2 + Math.random() * 0.2,
        drag: 0.989,
        w: 5 + Math.random() * 5,
        h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.32,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        round: Math.random() > 0.45,
        alpha: 1,
      });
    }

    const start = performance.now();
    const maxMs = 2800;
    const fadeStart = maxMs * 0.52;

    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);

      pieces.forEach((p) => {
        p.vx *= p.drag;
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (elapsed > fadeStart) {
          p.alpha = clamp(1 - (elapsed - fadeStart) / (maxMs - fadeStart), 0, 1);
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.w * 0.5, p.h * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      });

      if (elapsed < maxMs) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }

    requestAnimationFrame(frame);
  };
})();

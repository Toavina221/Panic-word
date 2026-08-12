import { useEffect, useRef } from "react";

/**
 * Fond "lignes de code" en arrière-plan — thème Cyberpunk.
 * Canvas léger : colonnes de caractères qui défilent, opacity très basse
 * pour rester lisible et ne pas distraire du jeu.
 */
export default function CodeRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const glyphs =
      "01アイウエオカキクケコ{}[]<>=/;#$%&*+<>function const let";
    const fontSize = 13;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const cols = Math.ceil(canvas.width / fontSize);
    const drops = new Array(cols).fill(0).map(() => Math.random() * -40);

    const draw = () => {
      if (!running) return;
      ctx.fillStyle = "rgba(4, 6, 12, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        // teinte cyan → magenta selon la colonne
        const hue = 180 + (i % 7) * 20;
        ctx.fillStyle = `hsla(${hue}, 90%, 62%, 0.22)`;
        ctx.fillText(ch, x, y);
        drops[i] += 1;
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-70"
    />
  );
}

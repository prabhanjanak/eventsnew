import { useEffect, useRef } from "react";

export function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", handleResize);

    // Mouse position
    const mouse = {
      x: -1000,
      y: -1000,
      radius: 200,
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    // Track mouse on parent container
    const parent = canvas.parentElement || window;
    parent.addEventListener("mousemove", handleMouseMove as any);
    parent.addEventListener("mouseleave", handleMouseLeave as any);

    // Ambient Glowing Color Blobs (Aurora effect)
    interface Blob {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
    }

    const blobs: Blob[] = [
      {
        x: width * 0.2,
        y: height * 0.2,
        vx: 0.25,
        vy: 0.15,
        radius: Math.min(width, height) * 0.35,
        color: "hsla(28, 93%, 55%, 0.12)", // Orange glow
      },
      {
        x: width * 0.8,
        y: height * 0.3,
        vx: -0.2,
        vy: 0.25,
        radius: Math.min(width, height) * 0.4,
        color: "hsla(261, 49%, 51%, 0.12)", // Purple glow
      },
      {
        x: width * 0.3,
        y: height * 0.7,
        vx: 0.18,
        vy: -0.22,
        radius: Math.min(width, height) * 0.3,
        color: "hsla(261, 49%, 51%, 0.08)", // Purple Light
      },
      {
        x: width * 0.7,
        y: height * 0.8,
        vx: -0.25,
        vy: -0.15,
        radius: Math.min(width, height) * 0.38,
        color: "hsla(28, 93%, 55%, 0.1)", // Orange Light
      },
    ];

    // Small Interactive Particles
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      alpha: number;
      alphaSpeed: number;
    }

    const particles: Particle[] = [];
    const particleCount = 45;

    for (let i = 0; i < particleCount; i++) {
      const isOrange = Math.random() > 0.5;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 4 + 1.5,
        color: isOrange ? "rgba(245, 130, 32, " : "rgba(111, 66, 193, ",
        alpha: Math.random() * 0.4 + 0.2,
        alphaSpeed: (Math.random() * 0.008 + 0.003) * (Math.random() > 0.5 ? 1 : -1),
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw large blurred background blobs (Aurora)
      ctx.save();
      ctx.filter = "blur(80px)";
      blobs.forEach((blob) => {
        blob.x += blob.vx;
        blob.y += blob.vy;

        // Bounce boundaries
        if (blob.x - blob.radius < 0 || blob.x + blob.radius > width) blob.vx *= -1;
        if (blob.y - blob.radius < 0 || blob.y + blob.radius > height) blob.vy *= -1;

        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = blob.color;
        ctx.fill();
      });
      ctx.restore();

      // 2. Draw interactive sharp particles
      particles.forEach((p) => {
        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Bounce boundaries
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse hover pull
        if (mouse.x !== -1000 && mouse.y !== -1000) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            p.x += (dx / dist) * force * 1.8;
            p.y += (dy / dist) * force * 1.8;
          }
        }

        // Opacity oscillation
        p.alpha += p.alphaSpeed;
        if (p.alpha > 0.75 || p.alpha < 0.15) p.alphaSpeed *= -1;
        p.alpha = Math.max(0.05, Math.min(0.8, p.alpha));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();

        // Draw soft glow ring around particles
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha * 0.15})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      parent.removeEventListener("mousemove", handleMouseMove as any);
      parent.removeEventListener("mouseleave", handleMouseLeave as any);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

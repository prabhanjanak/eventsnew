import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeAmbientSceneProps {
  particleCount?: number;
  className?: string;
  interactive?: boolean;
}

export function ThreeAmbientScene({
  particleCount = 70,
  className = "",
  interactive = true,
}: ThreeAmbientSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 80;

    // 2. WebGL Renderer with performance optimizations
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 3. Floating 3D Geometric Dust Particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Color palette: Cyan/Blue (top) and Purple/Violet (bottom)
    const colorTop = new THREE.Color("#3B82F6");    // Blue
    const colorBottom = new THREE.Color("#A855F7"); // Purple
    const colorTeal = new THREE.Color("#06B6D4");   // Cyan

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 140;
      positions[i3 + 1] = (Math.random() - 0.5) * 100;
      positions[i3 + 2] = (Math.random() - 0.5) * 80;

      const mixedColor = i % 3 === 0 ? colorTop : i % 3 === 1 ? colorBottom : colorTeal;
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Particle texture
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.7)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 3.5,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 4. Subtle Floating Geometry (Torus Knots & Octahedrons)
    const polyGeo = new THREE.IcosahedronGeometry(12, 0);
    const polyMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const polyMesh = new THREE.Mesh(polyGeo, polyMat);
    polyMesh.position.set(40, -15, -20);
    scene.add(polyMesh);

    const polyGeo2 = new THREE.TorusGeometry(10, 2.5, 8, 24);
    const polyMat2 = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    const polyMesh2 = new THREE.Mesh(polyGeo2, polyMat2);
    polyMesh2.position.set(-45, 20, -30);
    scene.add(polyMesh2);

    // 5. Cursor Parallax Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      if (!interactive) return;
      const { innerWidth, innerHeight } = window;
      mouseX = (event.clientX / innerWidth - 0.5) * 2;
      mouseY = -(event.clientY / innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // 6. Responsive Resize Handling
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    // 7. Animation Loop with RAF
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera parallax easing
      targetX += (mouseX * 8 - targetX) * 0.03;
      targetY += (mouseY * 8 - targetY) * 0.03;
      camera.position.x = targetX;
      camera.position.y = targetY;
      camera.lookAt(scene.position);

      // Rotation animations
      particles.rotation.y = elapsedTime * 0.04;
      particles.rotation.x = Math.sin(elapsedTime * 0.02) * 0.05;

      polyMesh.rotation.x = elapsedTime * 0.08;
      polyMesh.rotation.y = elapsedTime * 0.12;

      polyMesh2.rotation.x = elapsedTime * 0.1;
      polyMesh2.rotation.z = elapsedTime * 0.1;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // 8. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      polyGeo.dispose();
      polyMat.dispose();
      polyGeo2.dispose();
      polyMat2.dispose();
      renderer.dispose();
    };
  }, [particleCount, interactive]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    />
  );
}

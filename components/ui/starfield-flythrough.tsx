"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  particleCount?: number;
  particleColor1?: string;
  particleColor2?: string;
  particleSize?: number;
  flythroughSpeed?: number;
}

/**
 * StarfieldFlythrough — "traveling through space" effect for portrait viewports.
 *
 * Camera moves forward through a static starfield tube. As particles pass
 * behind the camera they respawn at the far end with fresh random X/Y, so
 * density is constant and the effect loops forever.
 *
 * Shares desktop FloatingParticles' visual vocabulary (dual gold, additive
 * blending, fog depth, radial sprite) but with a different motion paradigm:
 * the orbital camera of the desktop component produces antigravity-driven
 * upward drift that reads as a "stream" on tall narrow viewports. This
 * component's forward-fly camera eliminates the directional bias.
 *
 * Implementation notes:
 *   - Each color has its own tightly-packed position array. An earlier
 *     revision wasted half of each geometry's slots as "zombie" points at
 *     the origin, which fogged out over the first ~36 seconds and looked
 *     like the particles were vanishing.
 *   - Particles spawn at uniform random depth across [D_NEAR, D_FAR] at
 *     startup — no visible "pop-in" wave.
 *   - Respawn triggers when a particle is BEHIND_LIMIT units behind the
 *     camera, teleporting it to D_FAR ahead. The cycle time is constant
 *     (~35 sec per particle) and phases are naturally staggered.
 *   - Fog near=200 / far=2000 is tighter than the desktop component so
 *     particles are always at least partially visible in the tube.
 */
export function StarfieldFlythrough({
  particleCount = 3500,
  particleColor1 = "#FFD700",
  particleColor2 = "#FFE4A0",
  particleSize = 14,
  flythroughSpeed = 1.0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 200, 2000);

    // Wide FOV compensates for portrait aspect. With FOV 35° (desktop's
    // value), portrait's horizontal visible angle is only ~16° — particles
    // stream past outside the frame. 75° opens that up to ~33° horizontal.
    const FOV = 75;
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 1, 2500);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    // Spawn box roughly matches the frustum at medium depth (d~400). Close
    // depths fill the frustum fully; far depths see a narrow central column
    // of particles (which reads as depth perspective). Y taller than X
    // because portrait aspect.
    const SPAWN_X_HALF = 300;
    const SPAWN_Y_HALF = 550;
    const D_NEAR = 50;
    const D_FAR = 2000;
    const BEHIND_LIMIT = 100;

    const randomXY = () => [
      (Math.random() - 0.5) * 2 * SPAWN_X_HALF,
      (Math.random() - 0.5) * 2 * SPAWN_Y_HALF,
    ];

    // Soft radial gradient sprite — identical to desktop for aesthetic parity.
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(100, 100, 0, 100, 100, 100);
    grad.addColorStop(0.0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.3, "rgba(255, 255, 255, 0.4)");
    grad.addColorStop(1.0, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 200, 200);
    const texture = new THREE.Texture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;

    // Each color gets its own tightly-packed buffer. Contrast with the earlier
    // revision where a single shared indexing scheme left half of each
    // geometry's slots at (0,0,0) — those rendered at world origin and
    // disappeared as the camera moved away, creating the "all the particles
    // went away" impression after ~30-60s.
    const countA = Math.ceil(particleCount / 2);
    const countB = particleCount - countA;

    const makeMaterial = (color: string) =>
      new THREE.PointsMaterial({
        color,
        size: particleSize,
        transparent: true,
        opacity: 0.85,
        map: texture,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });

    const matA = makeMaterial(particleColor1);
    const matB = makeMaterial(particleColor2);

    const posA = new Float32Array(countA * 3);
    const posB = new Float32Array(countB * 3);

    // Initial spawn: uniform depth distribution so we hit steady-state density
    // on frame 0, no pop-in wave.
    const initializePositions = (arr: Float32Array, count: number) => {
      for (let i = 0; i < count; i++) {
        const [x, y] = randomXY();
        const d = Math.random() * (D_FAR - D_NEAR) + D_NEAR;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = -d;
      }
    };
    initializePositions(posA, countA);
    initializePositions(posB, countB);

    const geoA = new THREE.BufferGeometry();
    const geoB = new THREE.BufferGeometry();
    geoA.setAttribute("position", new THREE.BufferAttribute(posA, 3));
    geoB.setAttribute("position", new THREE.BufferAttribute(posB, 3));

    const pointsA = new THREE.Points(geoA, matA);
    const pointsB = new THREE.Points(geoB, matB);
    scene.add(pointsA);
    scene.add(pointsB);

    let cameraZ = 0;

    const respawn = (arr: Float32Array, count: number) => {
      const threshold = cameraZ + BEHIND_LIMIT;
      const respawnZ = cameraZ - D_FAR;
      for (let i = 0; i < count; i++) {
        if (arr[i * 3 + 2] > threshold) {
          const [x, y] = randomXY();
          arr[i * 3] = x;
          arr[i * 3 + 1] = y;
          arr[i * 3 + 2] = respawnZ;
        }
      }
    };

    const animate = () => {
      cameraZ -= flythroughSpeed;
      camera.position.z = cameraZ;
      camera.lookAt(0, 0, cameraZ - 100);

      respawn(geoA.attributes.position.array as Float32Array, countA);
      respawn(geoB.attributes.position.array as Float32Array, countB);

      geoA.attributes.position.needsUpdate = true;
      geoB.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      animIdRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animIdRef.current != null) cancelAnimationFrame(animIdRef.current);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
      geoA.dispose();
      geoB.dispose();
      matA.dispose();
      matB.dispose();
      texture.dispose();
    };
  }, [particleCount, particleColor1, particleColor2, particleSize, flythroughSpeed]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
    />
  );
}

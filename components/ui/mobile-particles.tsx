"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  particleCount?: number;
  particleColor?: string;
  particleSize?: number;
}

/**
 * MobileParticles — a WebGL gold spark field tuned for portrait viewports.
 *
 * Differs from the desktop FloatingParticles in three critical ways:
 *
 * 1. **Proper physics.** Desktop's Mover class sets position = velocity
 *    each frame, forcing straight-line motion. This uses a normal
 *    `position += velocity * dt` integrator so particles can drift in
 *    any direction.
 *
 * 2. **Distributed spawn with random velocity vectors.** Every particle
 *    starts at a uniformly-random point inside a sphere with a random
 *    small velocity. No antigravity, no upward bias, no cohort motion.
 *
 * 3. **Orbital camera around the cloud.** Camera slowly circles the
 *    origin at a radius of 550; creates parallax so the scene reads as
 *    3D depth even on a narrow mobile viewport. Particles themselves
 *    also wrap around a bounded sphere so the cloud density stays
 *    constant — no respawn streaks.
 */
export function MobileParticles({
  particleCount = 450,
  particleColor = "#FFD700",
  particleSize = 10,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // Camera — orbits a 550-unit radius around origin. Wide FOV (60°)
    // so the particle cloud fills the narrow portrait frustum.
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 3000);
    const CAM_RADIUS = 550;
    let angle = 0;
    camera.position.set(0, 0, CAM_RADIUS);
    camera.lookAt(0, 0, 0);

    // Circular gradient sprite texture for soft gold glow.
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(100, 100, 0, 100, 100, 100);
    grad.addColorStop(0.0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.5)");
    grad.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 200, 200);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    // Spawn particles uniformly inside a sphere of radius SPHERE_R,
    // each with a small random velocity vector (no preferred direction).
    const SPHERE_R = 420;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      // Uniform-in-sphere sample: sphere surface then scale by cube root of u.
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = Math.cbrt(Math.random()) * SPHERE_R;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Small random drift velocity per particle. Range ±0.3/frame means
      // at 60fps a particle drifts ~18 units per second — slow and gentle.
      velocities[i * 3]     = (Math.random() - 0.5) * 0.6;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: particleColor,
      size: particleSize,
      transparent: true,
      opacity: 0.95,
      map: texture,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Animation loop — positions advance, camera orbits.
    const animate = () => {
      const posArr = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3]     += velocities[i * 3];
        posArr[i * 3 + 1] += velocities[i * 3 + 1];
        posArr[i * 3 + 2] += velocities[i * 3 + 2];

        // Boundary wrap: when a particle exits the sphere's bounding box,
        // teleport it to the opposite side. Keeps cloud density constant
        // and no visible "stream entering" on any side.
        for (let j = 0; j < 3; j++) {
          if (posArr[i * 3 + j] > SPHERE_R) posArr[i * 3 + j] = -SPHERE_R;
          else if (posArr[i * 3 + j] < -SPHERE_R) posArr[i * 3 + j] = SPHERE_R;
        }
      }
      geometry.attributes.position.needsUpdate = true;

      // Slow camera orbit — full revolution in ~2.2 min. Creates parallax.
      angle += 0.0008;
      camera.position.x = Math.sin(angle) * CAM_RADIUS;
      camera.position.z = Math.cos(angle) * CAM_RADIUS;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      animIdRef.current = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animIdRef.current != null) cancelAnimationFrame(animIdRef.current);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [particleCount, particleColor, particleSize]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}
    />
  );
}

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
 * StarfieldFlythrough — WebGL "traveling through space" effect tuned for
 * portrait viewports.
 *
 * Built as a sibling to FloatingParticles because the motion paradigm is
 * fundamentally different:
 *
 *   FloatingParticles: camera orbits a suspended gold cloud while particles
 *   rain + antigravitate upward. Atmospheric on wide landscape viewports
 *   because the horizontal span dilutes the vertical cohort motion.
 *
 *   StarfieldFlythrough: camera moves forward through a static starfield.
 *   Particles live in a deep tube (900 wide × 1100 tall × 3300 deep). As
 *   the camera passes them, they respawn at the far end. No vertical bias,
 *   constant density at all times, stars stream past the viewer.
 *
 * Shares the desktop component's visual vocabulary: dual-gold palette,
 * additive blending, identical particle size, same radial-gradient sprite,
 * same fog depth cue.
 */
export function StarfieldFlythrough({
  particleCount = 3500,
  particleColor1 = "#FFD700",
  particleColor2 = "#FFE4A0",
  particleSize = 14,
  flythroughSpeed = 1.4,
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
    scene.fog = new THREE.Fog(0x000000, 400, 3000);

    // FOV 65° is wider than desktop's 35° because portrait viewports need
    // more horizontal spread to feel atmospheric instead of claustrophobic.
    const camera = new THREE.PerspectiveCamera(65, width / height, 1, 4000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    // Particle spatial bounds — a box centered on the camera's forward axis.
    // Y is slightly larger than X so portrait frustums see particles at
    // both top and bottom edges throughout the flythrough.
    const SPREAD_X = 900;
    const SPREAD_Y = 1100;
    const Z_MIN = -3000; // farthest ahead (most negative)
    const Z_MAX = 300; // just behind the camera

    const randomXY = () => [
      (Math.random() - 0.5) * SPREAD_X * 2,
      (Math.random() - 0.5) * SPREAD_Y * 2,
    ];

    // Same sprite texture the desktop component uses — circular radial
    // gradient composited with additive blending for the soft gold glow.
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

    const mat1 = new THREE.PointsMaterial({
      color: particleColor1,
      size: particleSize,
      transparent: true,
      opacity: 0.8,
      map: texture,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const mat2 = new THREE.PointsMaterial({
      color: particleColor2,
      size: particleSize,
      transparent: true,
      opacity: 0.8,
      map: texture,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const geo1 = new THREE.BufferGeometry();
    const geo2 = new THREE.BufferGeometry();
    const pos1 = new Float32Array(particleCount * 3);
    const pos2 = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const [x, y] = randomXY();
      const z = Math.random() * (Z_MAX - Z_MIN) + Z_MIN;
      if (i % 2 === 0) {
        pos1[i * 3] = x;
        pos1[i * 3 + 1] = y;
        pos1[i * 3 + 2] = z;
      } else {
        pos2[i * 3] = x;
        pos2[i * 3 + 1] = y;
        pos2[i * 3 + 2] = z;
      }
    }

    geo1.setAttribute("position", new THREE.BufferAttribute(pos1, 3));
    geo2.setAttribute("position", new THREE.BufferAttribute(pos2, 3));

    const points1 = new THREE.Points(geo1, mat1);
    const points2 = new THREE.Points(geo2, mat2);
    scene.add(points1);
    scene.add(points2);

    let cameraZ = 0;

    const animate = () => {
      cameraZ -= flythroughSpeed;
      camera.position.z = cameraZ;
      camera.lookAt(0, 0, cameraZ - 100);

      const a1 = geo1.attributes.position.array as Float32Array;
      const a2 = geo2.attributes.position.array as Float32Array;

      // Respawn particles that pass behind the camera, placed far ahead
      // at a random X/Y so we never see a visible "seam" entering the view.
      for (let i = 0; i < particleCount; i++) {
        const arr = i % 2 === 0 ? a1 : a2;
        const pz = arr[i * 3 + 2];
        if (pz > cameraZ + Z_MAX) {
          const [x, y] = randomXY();
          arr[i * 3] = x;
          arr[i * 3 + 1] = y;
          arr[i * 3 + 2] = cameraZ + Z_MIN;
        }
      }
      geo1.attributes.position.needsUpdate = true;
      geo2.attributes.position.needsUpdate = true;

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
      geo1.dispose();
      geo2.dispose();
      mat1.dispose();
      mat2.dispose();
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

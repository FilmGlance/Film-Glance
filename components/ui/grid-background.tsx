"use client";

interface GridBackgroundProps {
  className?: string;
}

/**
 * GridBackground — static grid-on-dark backdrop, themed for Film Glance.
 *
 * Adapted from 21st.dev/r/ctate/grid-background. Differences from the source:
 *   - Tailwind utility classes swapped for inline styles (this codebase has no Tailwind).
 *   - Blue radial replaced with a soft Film Glance gold radial on near-black.
 *   - White 0.02-alpha grid lines replaced with low-opacity gold (0.035) at 32px spacing.
 *
 * Renders at 100% of its parent. Pair with the existing `.fg-particles-wrap`
 * positioning class (fixed, inset:0, z-index:3, pointer-events:none) so it
 * sits below the vignette + grain layers and is non-interactive.
 */
export function GridBackground({ className = "" }: GridBackgroundProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle at center, rgba(255, 215, 0, 0.07), #050505 65%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 215, 0, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 215, 0, 0.035) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}

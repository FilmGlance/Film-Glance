// app/discover/page.tsx
//
// Page shell for /discover. Renders the DiscoverPage client component which
// owns URL-state, data fetching, filter UI, and the roulette feature. The
// sticky header + base layout come from app/layout.tsx (shared).

import { Suspense } from "react";
import DiscoverPage from "@/components/discover/DiscoverPage";

export const metadata = {
  title: "Discover — Film Glance",
  description:
    "100 hand-picked films per filter, ranked by Film Glance score. Find what to watch by genre, year, or where it's streaming. Spin the Movie Reel Roulette for a random pick.",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DiscoverPage />
    </Suspense>
  );
}

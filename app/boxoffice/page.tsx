// app/boxoffice/page.tsx
//
// Page shell for /boxoffice. Renders the BoxOfficePage client component
// which owns URL-state, data fetching, and composition. The Sticky header
// + base layout come from app/layout.tsx (shared with the rest of the site).

import { Suspense } from "react";
import BoxOfficePage from "@/components/box-office/BoxOfficePage";

export const metadata = {
  title: "Box Office — Film Glance",
  description:
    "Top 10 highest-grossing films, refreshed weekly. Filter by week, month, season, or year.",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BoxOfficePage />
    </Suspense>
  );
}

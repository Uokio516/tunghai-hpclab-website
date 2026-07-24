import { useState } from "react";
import { PageShell } from "../layout/PageShell";
import { ResearchAreas } from "../sections/ResearchAreas";
import { ResearchNetworkGraph } from "../ResearchNetworkGraph";
import { lab } from "../../data/lab";

/* The graph and the list are the same six things shown two ways, so they
   share one piece of state (lifted here) rather than each tracking its own
   hover — pointing at a row lights up its node, and vice versa.

   Below lg the graph and list stack (a circular diagram squeezed into a
   half-width column reads worse than a full-width one above a full-width
   list); at lg+ there's room for both side by side, so the graph goes
   sticky in its own column while the list scrolls next to it. Either way
   the shared state keeps them in sync. */
export function ResearchPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <PageShell eyebrow="Research" title="研究方向" lede={lab.positioning}>
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        <div className="grid gap-y-16 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.3fr)] lg:gap-x-12 lg:items-start">
          <div className="lg:sticky lg:top-32">
            <ResearchNetworkGraph compact activeId={activeId} onActiveChange={setActiveId} />
          </div>

          <div className="hidden lg:block lg:h-full" style={{ background: "rgba(255,255,255,0.1)" }} />

          <ResearchAreas showHeading={false} bare activeId={activeId} onActiveChange={setActiveId} />
        </div>
      </section>
    </PageShell>
  );
}

import { motion } from "motion/react";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";

interface PageShellProps {
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}

/* Shared frame for the content pages reached from the main menu, so they
   read as one site rather than six separate designs. Deliberately quiet:
   no 3D or custom cursor — the hero carries the spectacle,
   these pages carry the information (and get the native cursor back,
   rather than layering a custom one without `cursor-none` to match). */
export function PageShell({ eyebrow, title, lede, children }: PageShellProps) {
  return (
    <div className="content-page min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Navigation />

      <header className="content-page-hero mx-auto max-w-7xl px-6 pt-36 pb-14 sm:px-10 sm:pt-44 sm:pb-20">
        <motion.p
          className="mb-4 text-xs font-medium uppercase tracking-[0.2em] opacity-50"
          initial={{ opacity: 0.001, y: 8 }}
          animate={{ opacity: 0.5, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          className="max-w-4xl text-[clamp(2.25rem,6vw,4.5rem)] font-medium uppercase leading-[0.95] tracking-tight"
          initial={{ opacity: 0.001, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {title}
        </motion.h1>
        {lede && (
          <motion.p
            className="mt-7 max-w-2xl text-base leading-relaxed opacity-70 sm:text-lg"
            initial={{ opacity: 0.001, y: 12 }}
            animate={{ opacity: 0.7, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {lede}
          </motion.p>
        )}
      </header>

      <main className="content-page-main">{children}</main>
      <Footer />
    </div>
  );
}

/* Used where we genuinely have nothing verified to show. Saying so plainly
   is better than padding the page with invented content. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-dashed px-6 py-14 text-center"
      style={{ borderColor: "var(--border-strong)" }}
    >
      <p className="text-sm opacity-60">{message}</p>
    </div>
  );
}

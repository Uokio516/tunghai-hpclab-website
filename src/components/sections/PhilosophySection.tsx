import { motion } from "motion/react";
import { useLocale } from "../../lib/locale";

const LINES = [
  "We do not build technology",
  "for technology's sake.",
  "We explore what happens",
  "when computation becomes",
  "understanding.",
];

/* Scroll-triggered, line-by-line reveal. `whileInView` with `once` means
   it plays a single time when it enters the viewport and then stays put —
   no replaying as the user scrolls back and forth. */
export function PhilosophySection() {
  const { language } = useLocale();
  const lines = language === "en" ? LINES : ["我們探索技術，", "也思考技術的意義。", "當計算化為理解，", "新的可能便由此展開。"];
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-28 sm:px-10 sm:py-40">
      <h2 className="max-w-4xl text-[clamp(1.75rem,5vw,3.75rem)] font-medium uppercase leading-[1.08] tracking-tight">
        {lines.map((line, i) => (
          <motion.span
            key={line}
            className="block"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: i >= 2 ? 1 : 0.45, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            {line}
          </motion.span>
        ))}
      </h2>
    </section>
  );
}

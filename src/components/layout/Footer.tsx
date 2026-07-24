import { lab } from "../../data/lab";

export function Footer() {
  return (
    <footer className="relative z-10 flex flex-col items-center gap-2 px-6 py-12 text-center sm:px-10">
      <p className="text-xs uppercase tracking-[0.15em] opacity-50" style={{ color: "#f3f4f6" }}>
        {lab.universityEn} · {lab.departmentEn}
      </p>
      <p className="text-[11px] tracking-[0.1em] opacity-30" style={{ color: "#f3f4f6" }}>
        © {new Date().getFullYear()} {lab.nameEn}
      </p>
    </footer>
  );
}

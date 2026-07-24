import { PageShell, EmptyState } from "../layout/PageShell";
import { people } from "../../data/people";
import { professor, lab } from "../../data/lab";

export function PeoplePage() {
  const pi = people.find((p) => p.role === "pi");
  const students = people.filter((p) => p.role === "student");

  return (
    <PageShell eyebrow="People" title="研究成員" lede="由人、想法與實驗構成的研究網絡。">
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {pi && (
          <div className="border-t pt-10" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] opacity-50">
              Principal Investigator
            </p>
            <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
              <div className="lg:w-2/5">
                <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-medium leading-tight tracking-tight">
                  {pi.nameZh}
                </h2>
                <p className="mt-2 text-lg uppercase tracking-[0.08em] opacity-70">{pi.nameEn}</p>
                <p className="mt-4 text-base opacity-70">{pi.titleZh}</p>
                <p className="mt-1 text-sm opacity-55">
                  {lab.university} {lab.department}
                </p>
              </div>

              <div className="lg:w-3/5">
                <dl className="space-y-5">
                  <div>
                    <dt className="mb-2 text-xs font-medium uppercase tracking-[0.15em] opacity-45">學歷</dt>
                    <dd className="space-y-1">
                      {professor.education.map((e) => (
                        <p key={e.degree} className="text-sm opacity-80">
                          {e.degree} · {e.school} {e.field}
                          <span className="ml-2 font-mono text-xs tabular-nums opacity-55">{e.year}</span>
                        </p>
                      ))}
                    </dd>
                  </div>

                  <div>
                    <dt className="mb-2 text-xs font-medium uppercase tracking-[0.15em] opacity-45">現職</dt>
                    <dd className="space-y-1">
                      {professor.roles.map((r) => (
                        <p key={r} className="text-sm opacity-80">
                          {r}
                        </p>
                      ))}
                    </dd>
                  </div>

                  <div>
                    <dt className="mb-2 text-xs font-medium uppercase tracking-[0.15em] opacity-45">學術檔案</dt>
                    <dd className="flex flex-wrap gap-x-5 gap-y-2">
                      <a
                        href={professor.dblpUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "#c9b8a0" }}
                      >
                        DBLP
                      </a>
                      <a
                        href={`https://orcid.org/${professor.orcid}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "#c9b8a0" }}
                      >
                        ORCID
                      </a>
                      <a
                        href={professor.researchGateUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "#c9b8a0" }}
                      >
                        ResearchGate
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        <div className="mt-20 border-t pt-10" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] opacity-50">
            Graduate Students &amp; Researchers
          </p>
          {students.length === 0 ? (
            <EmptyState message="成員名單整理中,待研究室確認後公開。" />
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => (
                <li key={s.id} className="rounded-xl border p-6" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
                  <p className="text-lg font-medium">{s.nameZh}</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.08em] opacity-60">{s.nameEn}</p>
                  <p className="mt-3 text-sm opacity-70">{s.titleZh}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}

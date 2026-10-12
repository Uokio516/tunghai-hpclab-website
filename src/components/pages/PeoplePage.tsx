import { useEffect, useState } from "react";
import { PageShell, EmptyState } from "../layout/PageShell";
import { people } from "../../data/people";
import { professor, lab } from "../../data/lab";
import { directoryRoleLabel, studyPeriod, type DirectoryMember, type DirectoryRole } from "../../lib/memberDirectory";
import { useLocale } from "../../lib/locale";

export function PeoplePage() {
  const { language, t } = useLocale();
  const pi = people.find((p) => p.role === "pi");
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => { const controller = new AbortController(); fetch("/api/members/directory", { cache: "no-store", signal: controller.signal }).then(response => { if (!response.ok) throw new Error("unavailable"); return response.json(); }).then(data => setMembers(data.members ?? [])).catch(error => { if (error.name !== "AbortError") setLoadError(true); }); return () => controller.abort(); }, []);
  const groups: DirectoryRole[] = ["master1", "master2", "alumni"];
  const cards = (items: DirectoryMember[]) => <ul className="directory-grid">{items.map(member => <li className="member-panel directory-card" key={member.id}><h3>{member.name}</h3>{member.role === "alumni" && member.graduationYear && <p>{t(`${member.graduationYear} 年畢業`, `Graduated ${member.graduationYear}`)}</p>}{studyPeriod(member,language) && <p className="member-hint">{studyPeriod(member,language)}</p>}</li>)}</ul>;

  return (
    <PageShell eyebrow="People" title={t("研究成員", "People")} lede={t("由人、想法與實驗構成的研究網絡。", "A research community built on people, ideas and experiments.")}>
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {pi && (
          <div className="border-t pt-10" style={{ borderColor: "var(--border)" }}>
            <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] opacity-50">
              Principal Investigator
            </p>
            <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
              <div className="member-pi-identity lg:w-2/5">
                <figure className="member-pi-portrait">
                  <img src="/images/professor-yang.jpg" alt={t("楊朝棟教授肖像", "Portrait of Prof. Chao-Tung Yang")} width="1006" height="1130" decoding="async" />
                </figure>
                <div className="member-pi-name">
                  <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-medium leading-tight tracking-tight">
                    {language === "en" ? pi.nameEn : pi.nameZh}
                  </h2>
                  <p className="mt-2 text-lg uppercase tracking-[0.08em] opacity-70">{language === "en" ? pi.nameZh : pi.nameEn}</p>
                  <p className="mt-4 text-base opacity-70">{t(pi.titleZh, "Lifetime Distinguished Professor / Lab Director")}</p>
                  <p className="mt-1 text-sm opacity-55">
                    {language === "en" ? `${lab.universityEn} · ${lab.departmentEn}` : `${lab.university} ${lab.department}`}
                  </p>
                </div>
              </div>

              <div className="lg:w-3/5">
                <dl className="space-y-5">
                  <div>
                    <dt className="mb-2 text-xs font-medium uppercase tracking-[0.15em] opacity-45">{t("學歷", "Education")}</dt>
                    <dd className="space-y-1">
                      {professor.education.map((e) => (
                        <p key={e.degree} className="text-sm opacity-80">
                          {language === "en" ? `${e.degreeEn} · ${e.schoolEn}, ${e.fieldEn}` : `${e.degree} · ${e.school} ${e.field}`}
                          <span className="ml-2 font-mono text-xs tabular-nums opacity-55">{e.year}</span>
                        </p>
                      ))}
                    </dd>
                  </div>

                  <div>
                    <dt className="mb-2 text-xs font-medium uppercase tracking-[0.15em] opacity-45">{t("現職", "Current Roles")}</dt>
                    <dd className="space-y-1">
                      {(language === "en" ? professor.rolesEn : professor.roles).map((r) => (
                        <p key={r} className="text-sm opacity-80">
                          {r}
                        </p>
                      ))}
                    </dd>
                  </div>

                  <div>
                    <dt className="mb-2 text-xs font-medium uppercase tracking-[0.15em] opacity-45">{t("學術檔案", "Academic Profiles")}</dt>
                    <dd className="flex flex-wrap gap-x-5 gap-y-2">
                      <a
                        href={professor.profileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "var(--brand-light)" }}
                      >
                        {t("東海大學官方簡歷", "Official Tunghai Profile")}
                      </a>
                      <a
                        href={professor.dblpUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "var(--brand-light)" }}
                      >
                        DBLP
                      </a>
                      <a
                        href={`https://orcid.org/${professor.orcid}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "var(--brand-light)" }}
                      >
                        ORCID
                      </a>
                      <a
                        href={professor.researchGateUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "var(--brand-light)" }}
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

        {groups.map(role => <section key={role} className="mt-14 border-t pt-8" style={{ borderColor: "var(--border)" }}><h2 className="mb-6 text-lg font-medium">{directoryRoleLabel(role,language)}</h2>{members.some(member => member.role === role) ? cards(members.filter(member => member.role === role)) : <EmptyState message={loadError ? t("名單暫時無法載入，請稍後再試。", "The directory is temporarily unavailable.") : t("成員名單整理中。", "Directory updates are in progress.")} />}</section>)}
      </section>
    </PageShell>
  );
}

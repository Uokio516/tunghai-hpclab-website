import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell, EmptyState } from "../layout/PageShell";
import { people } from "../../data/people";
import { professor, lab } from "../../data/lab";

export function PeoplePage() {
  const pi = people.find((p) => p.role === "pi");
  type PublicMember = { id: number; role: string; roleLabel: string; displayNameZh: string; displayNameEn: string; entryYear: string; graduationYear: string; degree: string; interests: string[]; bio: string; affiliation: string; link: string; avatarUrl: string | null };
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => { const controller = new AbortController(); fetch("/api/members/public", { cache: "no-store", signal: controller.signal }).then(response => { if (!response.ok) throw new Error("unavailable"); return response.json(); }).then(data => setMembers(data.members ?? [])).catch(error => { if (error.name !== "AbortError") setLoadError(true); }); return () => controller.abort(); }, []);
  const current = members.filter(member => member.role === "master1" || member.role === "master2");
  const alumni = members.filter(member => member.role === "alumni");
  const cards = (items: PublicMember[]) => <ul className="member-public-grid">{items.map(member => <li className="member-public-card" key={member.id}><div className="member-public-avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.displayNameZh} 的頭像`} loading="lazy" /> : <span>{member.displayNameZh.slice(0, 1)}</span>}</div><div><span className="member-public-role">{member.roleLabel}{member.entryYear ? ` · ${member.entryYear} 入學` : member.graduationYear ? ` · ${member.graduationYear} 畢業` : ""}</span><h3>{member.displayNameZh}</h3>{member.displayNameEn && <p>{member.displayNameEn}</p>}{member.affiliation && <p>{member.affiliation}</p>}{member.bio && <p className="member-public-bio">{member.bio}</p>}{member.interests.length > 0 && <div className="member-public-tags">{member.interests.map(tag => <span key={tag}>{tag}</span>)}</div>}{member.link && <a href={member.link} target="_blank" rel="noopener noreferrer">個人連結 ↗</a>}</div></li>)}</ul>;

  return (
    <PageShell eyebrow="People" title="研究成員" lede="由人、想法與實驗構成的研究網絡。">
      <section className="mx-auto max-w-7xl px-6 pb-28 sm:px-10 sm:pb-40">
        {pi && (
          <div className="border-t pt-10" style={{ borderColor: "var(--border)" }}>
            <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] opacity-50">
              Principal Investigator
            </p>
            <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
              <div className="member-pi-identity lg:w-2/5">
                <figure className="member-pi-portrait">
                  <img src="/images/professor-yang.jpg" alt="楊朝棟教授肖像" width="1006" height="1130" decoding="async" />
                </figure>
                <div className="member-pi-name">
                  <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-medium leading-tight tracking-tight">
                    {pi.nameZh}
                  </h2>
                  <p className="mt-2 text-lg uppercase tracking-[0.08em] opacity-70">{pi.nameEn}</p>
                  <p className="mt-4 text-base opacity-70">{pi.titleZh}</p>
                  <p className="mt-1 text-sm opacity-55">
                    {lab.university} {lab.department}
                  </p>
                </div>
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
                        href={professor.profileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-cursor-hover
                        className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                        style={{ color: "var(--brand-light)" }}
                      >
                        東海大學官方簡歷
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

        <div className="mt-20 border-t pt-10" style={{ borderColor: "var(--border)" }}>
          <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] opacity-50">
            碩一與碩二
          </p>
          {current.length ? cards(current) : <EmptyState message={loadError ? "成員名單暫時無法載入。" : "碩一與碩二名單核對中；取得本人同意並審核後公開。"} />}
        </div>
        <div className="mt-20 border-t pt-10" style={{ borderColor: "var(--border)" }}><p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] opacity-50">實驗室畢業學長姊</p>{alumni.length ? cards(alumni) : <EmptyState message="實驗室畢業學長姊名單整理中；取得本人同意並審核後公開。" />}</div>
        <div className="member-people-footer">已收到實驗室邀請？<Link to="/member/login">登入並更新自己的資料 ↗</Link></div>
      </section>
    </PageShell>
  );
}

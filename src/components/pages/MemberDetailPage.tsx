import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, PageShell } from "../layout/PageShell";
import { memberCaption, type PublicMember } from "../../lib/memberProfiles";

export function MemberDetailPage() {
  const { id } = useParams();
  const [member, setMember] = useState<PublicMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setMember(null);
    if (!id || !/^\d{1,12}$/.test(id)) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    fetch("/api/members/public", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("unavailable"); return response.json(); })
      .then(data => setMember((data.members as PublicMember[]).find(item => String(item.id) === id) ?? null))
      .catch(error => { if (error.name !== "AbortError") setMember(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  return <PageShell eyebrow="People / Profile" title={member?.displayNameZh ?? "成員資料"} lede={member ? memberCaption(member) : undefined}>
    <section className="member-detail-shell mx-auto max-w-5xl px-6 pb-28 sm:px-10">
      <Link className="member-detail-back" to="/people">← 返回研究成員</Link>
      {loading ? <EmptyState message="正在載入成員資料…" /> : !member ? <EmptyState message="找不到這位成員的公開資料，可能已由本人撤下。" /> : <>
        <div className="member-detail-intro">
          <div className="member-detail-avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.displayNameZh} 的頭像`} /> : <span>{member.displayNameZh.slice(0, 1)}</span>}</div>
          <div>{member.displayNameEn && <p className="member-detail-en">{member.displayNameEn}</p>}{member.affiliation && <p>{member.affiliation}</p>}{member.bio && <p className="member-detail-bio">{member.bio}</p>}</div>
        </div>
        <div className="member-detail-columns">
          <section className="member-detail-section"><h2>學歷與經歷</h2>{member.background?.length ? <ol className="member-background-list">{member.background.map((item, index) => <li key={`${index}-${item.organization}`}><span className="member-background-kind">{item.kind === "education" ? "學歷" : "經歷"}</span><h3>{item.organization}</h3>{item.detail && <p>{item.detail}</p>}{item.period && <small>{item.period}</small>}</li>)}</ol> : <p className="member-detail-empty">這位成員尚未補充學歷或經歷。</p>}</section>
          <aside className="member-detail-section"><h2>研究與連結</h2>{member.interests.length ? <div className="member-public-tags">{member.interests.map(tag => <span key={tag}>{tag}</span>)}</div> : <p className="member-detail-empty">尚未填寫研究方向。</p>}{member.link && <a className="member-detail-link" href={member.link} target="_blank" rel="noopener noreferrer">前往個人網站 ↗</a>}</aside>
        </div>
      </>}
    </section>
  </PageShell>;
}

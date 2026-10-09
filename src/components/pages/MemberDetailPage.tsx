import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, PageShell } from "../layout/PageShell";
import { localizedInterest, localizedMemberCaption, type PublicMember } from "../../lib/memberProfiles";
import { useLocale } from "../../lib/locale";

export function MemberDetailPage() {
  const { language, t } = useLocale();
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

  return <PageShell eyebrow="People / Profile" title={member ? language === "en" ? member.displayNameEn || member.displayNameZh : member.displayNameZh : t("成員資料", "Member Profile")} lede={member ? localizedMemberCaption(member, language) : undefined}>
    <section className="member-detail-shell mx-auto max-w-5xl px-6 pb-28 sm:px-10">
      <Link className="member-detail-back" to="/people">{t("← 返回研究成員", "← Back to People")}</Link>
      {loading ? <EmptyState message={t("正在載入成員資料…", "Loading member profile…")} /> : !member ? <EmptyState message={t("找不到這位成員的公開資料，可能已由本人撤下。", "This public profile could not be found. The member may have unpublished it.")} /> : <>
        <div className="member-detail-intro">
          <div className="member-detail-avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt={t(`${member.displayNameZh} 的頭像`, `Portrait of ${member.displayNameEn || member.displayNameZh}`)} /> : <span>{member.displayNameZh.slice(0, 1)}</span>}</div>
          <div>{member.displayNameEn && <p className="member-detail-en">{member.displayNameEn}</p>}{member.affiliation && <p>{member.affiliation}</p>}{member.bio && <p className="member-detail-bio">{member.bio}</p>}</div>
        </div>
        <div className="member-detail-columns">
          <section className="member-detail-section"><h2>{t("學歷與經歷", "Education & Experience")}</h2>{member.background?.length ? <ol className="member-background-list">{member.background.map((item, index) => <li key={`${index}-${item.organization}`}><span className="member-background-kind">{item.kind === "education" ? t("學歷", "Education") : t("經歷", "Experience")}</span><h3>{item.organization}</h3>{item.detail && <p>{item.detail}</p>}{item.period && <small>{item.period}</small>}</li>)}</ol> : <p className="member-detail-empty">{t("這位成員尚未補充學歷或經歷。", "This member has not added education or experience yet.")}</p>}</section>
          <aside className="member-detail-section"><h2>{t("研究與連結", "Research & Links")}</h2>{member.interests.length ? <div className="member-public-tags">{member.interests.map(tag => <span key={tag}>{localizedInterest(tag, language)}</span>)}</div> : <p className="member-detail-empty">{t("尚未填寫研究方向。", "No research interests listed yet.")}</p>}{member.link && <a className="member-detail-link" href={member.link} target="_blank" rel="noopener noreferrer">{t("前往個人網站 ↗", "Visit personal website ↗")}</a>}</aside>
        </div>
      </>}
    </section>
  </PageShell>;
}

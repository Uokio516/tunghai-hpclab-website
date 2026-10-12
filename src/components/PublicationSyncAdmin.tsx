import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";
type Status={updatedAt:string|null;nextUpdateAt:string|null;lastError:string|null;running:boolean;count:number};
export function PublicationSyncAdmin({password}:{password:string}) {
  const {t,language}=useLocale();
  const [status,setStatus]=useState<Status|null>(null);
  const [error,setError]=useState(false);
  const read=async()=>{
    const response=await fetch('/api/members/admin/publications/status',{headers:{'X-Admin-Password':password},cache:'no-store'});
    if(!response.ok)throw new Error('unavailable');
    setStatus(await response.json());setError(false);
  };
  useEffect(()=>{void read().catch(()=>setError(true));},[password]);
  useEffect(()=>{
    if(!status?.running)return;
    const timer=setInterval(()=>{void read().catch(()=>setError(true));},2000);
    return()=>clearInterval(timer);
  },[status?.running,password]);
  const refresh=async()=>{
    setError(false);
    try{
      const response=await fetch('/api/members/admin/publications/refresh',{method:'POST',headers:{'X-Admin-Password':password}});
      if(!response.ok)throw new Error('unavailable');
      setStatus(previous=>previous?{...previous,running:true}:{updatedAt:null,nextUpdateAt:null,lastError:null,count:0,running:true});
    }catch{setError(true);}
  };
  const date=(value:string|null)=>value?new Date(value).toLocaleString(language==='en'?'en-US':'zh-TW',{timeZone:'Asia/Taipei'}):'—';
  return <details className="member-panel directory-guide"><summary className="directory-guide-summary"><span><strong>{t('論文自動更新','Publication synchronization')}</strong><small>{t('每週自動同步；可查看狀態或手動更新。','Weekly synchronization with status and manual refresh.')}</small></span></summary><div className="directory-guide-content">
    {status&&<p>{t('已保存著作：','Saved publications: ')}{status.count}<br/>{t('最近成功更新：','Last successful update: ')}{date(status.updatedAt)}<br/>{t('下次更新：','Next update: ')}{date(status.nextUpdateAt)}</p>}
    <p>{t('OpenAlex 合併教授的作者紀錄，以 DOI 去重並用 Crossref 核對。來源失敗時保留最後成功清單；Google Scholar 僅提供參考連結。','OpenAlex author records are merged and deduplicated by DOI, with Crossref metadata checks. The last successful list is retained on failure. Google Scholar is a reference link.')}</p>
    {(error||status?.lastError)&&<p className="member-error">{t('同步暫時未完成，已保存的論文仍會顯示。','Synchronization is unavailable; saved publications remain visible.')}{status?.lastError&&<small> {status.lastError}</small>}</p>}
    <button type="button" className="member-primary" disabled={status?.running} onClick={()=>void refresh()}>{status?.running?t('同步中…','Synchronizing…'):t('立即更新論文','Update publications now')}</button>
  </div></details>;
}

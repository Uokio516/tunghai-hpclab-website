import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "zh-TW" | "en";
const serverErrorsEn: Record<string, string> = {
  "操作失敗，請稍後再試": "Action failed. Please try again later.",
  "請先登入": "Please sign in first.", "登入已失效": "Your session has expired. Please sign in again.",
  "邀請已失效": "This invitation has expired.", "請設定至少 10 字元的密碼": "Please set a password of at least 10 characters.",
  "帳號已建立，請直接登入": "This account already exists. Please sign in.",
  "信箱或密碼錯誤": "Incorrect email or password.", "信箱或密碼錯誤，請稍後再試": "Incorrect email or password. Please try again later.",
  "重設連結已失效": "This reset link has expired.", "密碼需為 10 至 128 字元": "Password must be 10 to 128 characters.",
  "資料格式不正確，請檢查姓名與連結": "Invalid profile. Please check your name and link.",
  "RGB 技能按鈕數量超過此帳號上限": "You have exceeded the RGB badge limit for this account.",
  "請選擇畢業年份、上／下學期與學位": "Select a graduation year, term and degree.",
  "請填寫入學學年度": "Enter your enrollment year.",
  "請上傳 JPEG、PNG 或 WebP 照片": "Upload a JPEG, PNG or WebP photo.",
  "照片格式或尺寸不符；請使用至少 200×200 的 JPEG、PNG 或 WebP": "Invalid photo format or size. Use a JPEG, PNG or WebP image of at least 200 × 200 pixels.",
  "照片不可超過 5 MB": "Photo must be smaller than 5 MB.",
  "服務暫時無法處理，請稍後再試": "Service is temporarily unavailable. Please try again later.",
  "成員服務尚未啟用": "Member service is not enabled.", "成員服務暫時無法連線": "Member service is temporarily unavailable.",
  "一次請匯入 1 至 100 人": "Import 1 to 100 members at a time.", "名冊格式錯誤": "Invalid directory format.",
  "名冊含已建立的帳號": "The directory includes existing accounts.", "找不到帳號": "Account not found.",
  "身分格式錯誤": "Invalid role.", "目前沒有暫停公開的資料": "No paused profile is available.",
  "本人未同意公開": "The member has not consented to publication.",
  Unauthorized: "Unauthorized.",
};

export function localizedServerError(error: string, language: Language): string {
  return language === "en" ? serverErrorsEn[error] ?? error : error;
}
type LocaleContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (zh: string, en: string) => string;
};

const STORAGE_KEY = "hpclab-language";
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh-TW"; }
    catch { return "zh-TW"; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "en" ? "HPC Lab | Tunghai University" : "高效能計算實驗室 | 東海大學";
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* Storage can be disabled. */ }
  }, [language]);
  const value = useMemo<LocaleContextValue>(() => ({
    language,
    setLanguage,
    t: (zh, en) => language === "en" ? en : zh,
  }), [language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error("useLocale must be used inside LocaleProvider");
  return locale;
}

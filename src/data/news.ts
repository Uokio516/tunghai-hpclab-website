export interface NewsItem {
  id: string;
  date: string;
  category: string;
  titleZh: string;
  titleEn?: string;
}

// No confirmed news items yet — populate as real announcements come in,
// don't fabricate entries to fill the section.
export const news: NewsItem[] = [];

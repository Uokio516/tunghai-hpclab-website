export interface PublicationRecord {
  id: string;
  title: string;
  authors: string[];
  venue: string;
  year: string;
  volume?: string;
  issue?: string;
  pages?: string;
  articleNumber?: string;
  doi?: string;
  url?: string;
  crossrefVerified?: boolean;
}
export interface PublicationSnapshot {
  publications: PublicationRecord[];
  updatedAt: string | null;
  source: string;
  crossrefVerifiedCount: number;
}

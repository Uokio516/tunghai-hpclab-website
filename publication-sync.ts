import type { PublicationRecord, PublicationSnapshot } from "./src/lib/publicationTypes";
import { publications as curated } from "./src/data/publications";

export const AUTHOR_IDS = ["A5031161487", "A5101008873", "A5138152082"];
export const PROFESSOR_ORCID = "0000-0002-9579-4426";
const WEEK = 7 * 86400_000;
const titleKey = (title: string) => title.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function normalizeDoi(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const doi = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : undefined;
}
const orcid = (value: unknown) => typeof value === "string" ? value.replace(/^https?:\/\/orcid\.org\//, "") : "";
const text = (value: unknown) => typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim() : "";
const authorNames = (authors: any[]) => authors.map(a => text(a.author?.display_name || [a.given, a.family].filter(Boolean).join(" "))).filter(Boolean);

export function mergePublications(openalex: any[], crossref: any[], manual: PublicationRecord[] = curated): PublicationRecord[] {
  const byDoi = new Map<string, PublicationRecord>();
  const withoutDoi: PublicationRecord[] = [];
  for (const work of openalex) {
    const title = text(work.display_name);
    if (!title || work.is_retracted || !/^\d{4}$/.test(String(work.publication_year))) continue;
    const doi = normalizeDoi(work.doi);
    const record: PublicationRecord = { id: doi ? `doi:${doi}` : text(work.id), title, authors: authorNames(work.authorships ?? []), venue: text(work.primary_location?.source?.display_name) || "", year: String(work.publication_year), ...(doi ? { doi, url: `https://doi.org/${doi}` } : { url: text(work.id) }) };
    if (doi) byDoi.set(doi, record); else withoutDoi.push(record);
  }
  for (const work of crossref) {
    const doi = normalizeDoi(work.DOI);
    if (!doi) continue;
    const existing = byDoi.get(doi);
    // Crossref is fetched by ORCID. Require author identity again before adding
    // a work absent from OpenAlex; never use a fuzzy author-name search.
    const exactAuthor = (work.author ?? []).some((a: any) => orcid(a.ORCID) === PROFESSOR_ORCID);
    if (!existing && !exactAuthor) continue;
    const title = text(work.title?.[0]) || existing?.title;
    const year = String(work.published?.["date-parts"]?.[0]?.[0] ?? existing?.year ?? "");
    if (!title || !/^\d{4}$/.test(year)) continue;
    byDoi.set(doi, {
      ...existing, id: `doi:${doi}`, title, authors: work.author?.length ? authorNames(work.author) : existing?.authors ?? [],
      venue: text(work["container-title"]?.[0]) || existing?.venue || "", year, doi, url: `https://doi.org/${doi}`, crossrefVerified: true,
      ...(work.volume ? { volume: text(work.volume) } : {}), ...(work.issue ? { issue: text(work.issue) } : {}),
      ...(work.page ? { pages: text(work.page) } : {}), ...(work["article-number"] ? { articleNumber: text(work["article-number"]) } : {}),
    });
  }
  const result: PublicationRecord[] = [];
  const seenWithoutDoi = new Set<string>();
  const records = [...byDoi.values()].sort((a,b) => Number(Boolean(b.crossrefVerified))-Number(Boolean(a.crossrefVerified)));
  result.push(...records);
  for (const record of withoutDoi) {
    const title = titleKey(record.title);
    const key = `${title}|${record.year}|${titleKey(record.venue)}`;
    if (!title || seenWithoutDoi.has(key) || records.some(p => titleKey(p.title)===title && p.year===record.year && title.length>20)) continue;
    seenWithoutDoi.add(key); result.push(record);
  }
  for (const record of manual) {
    if (!result.some(p => titleKey(p.title)===titleKey(record.title))) result.push(record);
  }
  return result.sort((a,b) => Number(b.year)-Number(a.year) || a.title.localeCompare(b.title));
}

export async function collectPublications(fetcher: typeof fetch = fetch, apiKey = process.env.OPENALEX_API_KEY): Promise<PublicationSnapshot> {
  async function request(provider: "OpenAlex" | "Crossref", url: URL) {
    if (provider === "OpenAlex" && apiKey) url.searchParams.set("api_key", apiKey);
    const response = await fetcher(url, { headers: { "User-Agent": "HPC-Lab-Website/1.0 (+https://hpclab.thu.edu.tw/)", Accept: "application/json" }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`${provider} returned HTTP ${response.status}`);
    return response.json();
  }
  const verifiedIds: string[] = [];
  for (const id of AUTHOR_IDS) {
    const author = await request("OpenAlex", new URL(`https://api.openalex.org/authors/${id}`));
    if (orcid(author.orcid) !== PROFESSOR_ORCID) throw new Error("OpenAlex author identity could not be verified");
    const canonicalId = author.id?.split("/").pop();
    if (!/^A\d+$/.test(canonicalId)) throw new Error("Invalid OpenAlex author ID");
    if (!verifiedIds.includes(canonicalId)) verifiedIds.push(canonicalId);
  }
  const openalex: any[] = [];
  let cursor: string | null = "*";
  let finished = false;
  const seenCursors = new Set<string>();
  for (let page=0;page<30 && cursor;page++) {
    if (seenCursors.has(cursor)) throw new Error("OpenAlex pagination did not advance");
    seenCursors.add(cursor);
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("filter", `authorships.author.id:${verifiedIds.join("|")}`);
    url.searchParams.set("per_page", "200"); url.searchParams.set("cursor", cursor);
    url.searchParams.set("select", "id,doi,display_name,publication_year,authorships,primary_location,is_retracted");
    const response = await request("OpenAlex", url);
    if (!Array.isArray(response.results)) throw new Error("Invalid OpenAlex response");
    for (const work of response.results) {
      if (!(work.authorships ?? []).some((a: any) => verifiedIds.includes(a.author?.id?.split("/").pop()))) throw new Error("OpenAlex returned a different author's work");
      openalex.push(work);
    }
    cursor = response.meta?.next_cursor ?? null;
    if (response.results.length < 200 || !cursor) { finished = true; break; }
  }
  if (!finished || !openalex.length) throw new Error("OpenAlex did not return a complete bibliography");
  const crossref: any[] = [];
  cursor = "*"; finished = false;
  for (let page=0;page<10;page++) {
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("filter", `orcid:${PROFESSOR_ORCID}`); url.searchParams.set("rows", "1000"); url.searchParams.set("cursor", cursor!);
    url.searchParams.set("select", "DOI,title,author,container-title,published,volume,issue,page,article-number,type");
    const response = await request("Crossref", url);
    if (!Array.isArray(response.message?.items)) throw new Error("Invalid Crossref response");
    crossref.push(...response.message.items);
    if (response.message.items.length < 1000) { finished = true; break; }
    const next = response.message["next-cursor"];
    if (!next || next === cursor) throw new Error("Crossref pagination did not advance");
    cursor = next;
  }
  if (!finished) throw new Error("Crossref did not return complete results");
  const publications = mergePublications(openalex, crossref);
  return { publications, updatedAt: new Date().toISOString(), source: "OpenAlex + Crossref", crossrefVerifiedCount: publications.filter(p => p.crossrefVerified).length };
}

export interface PublicationCacheStorage {
  read(): Promise<{ snapshot: PublicationSnapshot; lastAttempt: number; lastError: string | null } | undefined>;
  write(snapshot: PublicationSnapshot, lastAttempt: number, lastError: string | null): Promise<void>;
}
export class PublicationSync {
  private pending: Promise<void> | null = null;
  private lastAttempt = 0;
  private lastError: string | null = null;
  constructor(private snapshot: PublicationSnapshot, private storage: PublicationCacheStorage, private collect = collectPublications) {}
  async initialize() {
    const cached = await this.storage.read();
    if (cached?.snapshot.publications.length) { this.snapshot = cached.snapshot; this.lastAttempt = cached.lastAttempt; this.lastError = cached.lastError; }
    else await this.storage.write(this.snapshot, this.snapshot.updatedAt ? Date.parse(this.snapshot.updatedAt) : 0, null);
  }
  getSnapshot() { return this.snapshot; }
  getStatus() { return { updatedAt: this.snapshot.updatedAt, lastAttempt: this.lastAttempt ? new Date(this.lastAttempt).toISOString() : null, lastError: this.lastError, running: Boolean(this.pending), count: this.snapshot.publications.length, nextUpdateAt: this.snapshot.updatedAt ? new Date(Date.parse(this.snapshot.updatedAt)+WEEK).toISOString() : null }; }
  refresh(force = false): Promise<void> {
    if (this.pending) return this.pending;
    if (!force && Date.now() - (this.lastError ? this.lastAttempt : Date.parse(this.snapshot.updatedAt || "1970-01-01")) < (this.lastError ? 6*3600_000 : WEEK)) return Promise.resolve();
    this.pending = this.run().finally(() => { this.pending = null; });
    return this.pending;
  }
  private async run() {
    this.lastAttempt = Date.now();
    try {
      const next = await this.collect();
      if (!next.publications.length || next.publications.length < this.snapshot.publications.length*.7) throw new Error("Bibliography unexpectedly shrank; previous data retained");
      await this.storage.write(next, this.lastAttempt, null);
      this.snapshot = next; this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Publication source unavailable";
      await this.storage.write(this.snapshot, this.lastAttempt, this.lastError);
    }
  }
}

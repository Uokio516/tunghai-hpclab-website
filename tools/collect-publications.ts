import fs from "node:fs/promises";
import { collectPublications } from "../publication-sync";
const snapshot = await collectPublications();
await fs.writeFile(new URL("../src/data/publications.default.json",import.meta.url),JSON.stringify(snapshot,null,2)+"\n");
console.log(`Verified ${snapshot.publications.length} publications; ${snapshot.crossrefVerifiedCount} with Crossref metadata.`);

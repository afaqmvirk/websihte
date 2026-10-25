// Run: bun scripts/build-parent-form.ts <python executable with reportlab>
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CONSENT_VERSION, ORGANIZER_NAME, CONSENT_EVENT, PARTICIPANT_DOCUMENTS, PARENT_DECLARATIONS } from "../app/lib/participant-documents";
mkdirSync(".render-consent", { recursive: true });
writeFileSync(".render-consent/documents.json", JSON.stringify({ version: CONSENT_VERSION, organizer: ORGANIZER_NAME, event: CONSENT_EVENT, documents: PARTICIPANT_DOCUMENTS, parentDeclarations: PARENT_DECLARATIONS }));
const result = spawnSync(process.argv[2] || "python", ["scripts/build-parent-form.py", ".render-consent/documents.json", "public/forms/sih-ottawa-2026-parent-guardian-consent.pdf"], { stdio: "inherit" });
process.exit(result.status ?? 1);

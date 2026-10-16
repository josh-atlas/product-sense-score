// Inlines both questions.json files into worker/src/index.js so the result can be pasted into the Cloudflare dashboard editor.
// Usage: node scripts/bundle-worker.mjs   -> worker/dist/worker.bundle.js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
let src = read("worker/src/index.js");
const inline = (name, path) => {
  const re = new RegExp(`^import ${name} from "[^"]+";\\n`, "m");
  if (!re.test(src)) throw new Error("import not found: " + name);
  src = src.replace(re, `const ${name} = ${JSON.stringify(JSON.parse(read(path)), null, 2)};\n`);
};
inline("pss", "quizzes/product-sense-score/questions.json");
inline("hbs", "quizzes/hours-back-score/questions.json");
const out = "// Generated: worker/src/index.js with both questions.json inlined. Paste into the Cloudflare dashboard editor.\n" + src;
mkdirSync(resolve(root, "worker/dist"), { recursive: true });
writeFileSync(resolve(root, "worker/dist/worker.bundle.js"), out);
console.log("worker/dist/worker.bundle.js", out.length);

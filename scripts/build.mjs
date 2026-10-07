// Builds every quiz under quizzes/<slug>/ (questions.json + config.json) into:
//   dist/<slug>/index.html    production: full document, answer key stripped, scores on the worker
//   dist/<slug>/preview.html  claude.ai artifact fragment: key included, Claude grades the sentences in the viewer
//   docs/<slug>/index.html    friends-test build for GitHub Pages: key included, keyword estimate, no email, nothing stored
// Usage: node scripts/build.mjs            (all quizzes)
//        node scripts/build.mjs hours-back-score
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const styles = read("src/styles.css");
const app = read("src/app.js");
const tpl = read("src/page.html");
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const fill = (vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const only = process.argv[2];
const slugs = readdirSync(resolve(root, "quizzes")).filter((s) => existsSync(resolve(root, "quizzes", s, "questions.json")) && (!only || s === only));
if (!slugs.length) { console.error("no quizzes found" + (only ? " for " + only : "")); process.exit(1); }

const doc = ({ title, head, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
${head}
</head>
<body>
${body}
</body>
</html>
`;

for (const slug of slugs) {
  const questions = JSON.parse(read(`quizzes/${slug}/questions.json`));
  const config = JSON.parse(read(`quizzes/${slug}/config.json`));
  const title = questions.title || slug;
  const brand = questions.copy?.brand || { name: title, by: "Josh Atlas · Product Management Circle" };
  const meta = questions.copy?.meta || {};

  // Public copy of the questions: same shape, scores, rubrics and examples removed. The key stays on the worker.
  const publicQ = JSON.parse(JSON.stringify(questions));
  for (const q of publicQ.questions) for (const o of q.options) delete o.score;
  for (const w of publicQ.written) { delete w.rubric; delete w.examples; }

  const common = { TITLE: title, STYLES: styles, APP_JS: app, BRAND_NAME: esc(brand.name), BRAND_BY: esc(brand.by) };
  const offerBits = { offer: config.offer, secondary: config.secondary };

  // PostHog: funnels per question and session replay on the free tier. Leave key empty to ship without analytics.
  const ph = config.posthog || {};
  const analytics = ph.key
    ? `<script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init(${JSON.stringify(ph.key)}, { api_host: ${JSON.stringify(ph.host || "https://us.i.posthog.com")}, person_profiles: "identified_only", capture_pageview: true, session_recording: { maskAllInputs: true } });
</script>`
    : "";

  // Production
  const prod = doc({
    title,
    head: `<meta name="description" content="${esc(meta.description || title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(meta.ogDescription || meta.description || title)}">
${analytics}
<!-- Meta pixel and LinkedIn Insight Tag go here once the accounts exist. Install on day one, before any spend. -->`,
    body: fill({ ...common, CONFIG_JSON: safeJson({ preview: false, apiUrl: config.apiUrl, videos: config.videos, ...offerBits }), QUESTIONS_JSON: safeJson(publicQ) }),
  });

  // Preview (artifact): fragment, key included, sample capability grades the sentences.
  const preview = fill({ ...common, CONFIG_JSON: safeJson({ preview: true, videos: {}, ...offerBits }), QUESTIONS_JSON: safeJson(questions) });

  // Test build (GitHub Pages): full document, key included, no worker, no email.
  const test = doc({
    title: title + " (test)",
    head: `<meta name="robots" content="noindex">\n<meta name="description" content="Test build of the ${esc(title)}.">\n${analytics}`,
    body: fill({ ...common, TITLE: title + " (test)", CONFIG_JSON: safeJson({ test: true, videos: {}, ...offerBits }), QUESTIONS_JSON: safeJson(questions) }),
  });

  // docs/ is what GitHub Pages serves. It gets the test build until config.apiUrl points at a real worker,
  // then the production build (answer key stripped, scoring and email on the worker).
  const live = !!config.apiUrl && !/YOUR-SUBDOMAIN|REPLACE/.test(config.apiUrl);
  const pages = live ? prod : test;
  mkdirSync(resolve(root, "dist", slug), { recursive: true });
  mkdirSync(resolve(root, "docs", slug), { recursive: true });
  writeFileSync(resolve(root, "dist", slug, "index.html"), prod);
  writeFileSync(resolve(root, "dist", slug, "preview.html"), preview);
  writeFileSync(resolve(root, "docs", slug, "index.html"), pages);
  console.log("%s: dist/%s/index.html (%d), dist/%s/preview.html (%d), docs/%s/index.html (%d, %s)", slug, slug, prod.length, slug, preview.length, slug, pages.length, live ? "production" : "test build");
}
writeFileSync(resolve(root, "docs/.nojekyll"), "");

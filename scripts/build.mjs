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
const thanksTpl = read("src/thanks.html");
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
  // Checkout (Stripe Payment Link in offer.url): product id for /api/seats, value and currency for the pixel. Thanks copy stays out of the page.
  const ck = config.checkout || null;
  const checkoutBits = ck ? { checkout: { product: ck.product, cap: ck.cap, value: ck.value, currency: ck.currency } } : {};

  // PostHog: funnels per question and session replay on the free tier. Leave key empty to ship without analytics.
  const ph = config.posthog || {};
  const analytics = ph.key
    ? `<script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init(${JSON.stringify(ph.key)}, { api_host: ${JSON.stringify(ph.host || "https://us.i.posthog.com")}, person_profiles: "identified_only", capture_pageview: true, session_recording: { maskAllInputs: true } });
</script>`
    : "";

  // Meta pixel: only when config.metaPixelId is set. PageView here; the app fires Lead (results) and InitiateCheckout (buy click);
  // the thanks page fires Purchase. Leave the id empty to ship without it.
  const pixelId = String(config.metaPixelId || "").replace(/\D/g, "");
  const pixelHead = pixelId
    ? `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1" alt=""></noscript>`
    : "";

  // Production
  const prod = doc({
    title,
    head: `<meta name="description" content="${esc(meta.description || title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(meta.ogDescription || meta.description || title)}">
${analytics}
${pixelHead || "<!-- Meta pixel goes here: set metaPixelId in config.json. Install on day one, before any spend. -->"}`,
    body: fill({ ...common, CONFIG_JSON: safeJson({ preview: false, apiUrl: config.apiUrl, turnstileSiteKey: config.turnstileSiteKey || "", videos: config.videos, ...offerBits, ...checkoutBits }), QUESTIONS_JSON: safeJson(publicQ) }),
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

  // Thanks page: where the Stripe Payment Link sends people after paying. Fires the pixel's Purchase event.
  if (ck && ck.thanks) {
    const t = ck.thanks;
    const steps = (t.steps || []).map((x) => "<li><span>" + esc(x) + "</span></li>").join("");
    const purchase = pixelId
      ? `<script>try{fbq('track','Purchase',{value:${Number(ck.value) || 0},currency:${JSON.stringify(ck.currency || "USD")},content_name:${JSON.stringify(config.offer && config.offer.name || title)}});}catch(e){}</script>`
      : "";
    const thanksBody = thanksTpl.replace(/\{\{(\w+)\}\}/g, (_, k) => ({
      STYLES: styles, BRAND_NAME: esc(brand.name), BRAND_BY: esc(brand.by),
      EYEBROW: esc(t.eyebrow || ""), HEADLINE: esc(t.headline || "Thank you."), LEAD: esc(t.lead || ""), STEPS: steps,
      CALL_URL: esc(t.callUrl || "#"), CALL_LABEL: esc(t.callLabel || "Book a call"), BACK_URL: esc(t.backUrl || "../"), BACK_LABEL: esc(t.backLabel || "Back"),
    })[k] ?? "");
    const thanks = doc({
      title: (t.headline || "Thank you") + " · " + title,
      head: `<meta name="robots" content="noindex">\n${analytics}\n${pixelHead}\n<script>try{window.posthog&&posthog.capture("purchase_thanks",{quiz:${JSON.stringify(slug)}})}catch(e){}</script>${purchase}`,
      body: thanksBody,
    });
    mkdirSync(resolve(root, "docs", slug, "thanks"), { recursive: true });
    writeFileSync(resolve(root, "docs", slug, "thanks", "index.html"), thanks);
    console.log("%s: docs/%s/thanks/index.html (%d)", slug, slug, thanks.length);
  }
  console.log("%s: dist/%s/index.html (%d), dist/%s/preview.html (%d), docs/%s/index.html (%d, %s)", slug, slug, prod.length, slug, preview.length, slug, pages.length, live ? "production" : "test build");
}
writeFileSync(resolve(root, "docs/.nojekyll"), "");

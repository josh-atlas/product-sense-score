# Quiz engine: Product Sense Score, Hours Back Score

A twelve-question diagnostic engine: eight multiple choice, two one-sentence written answers graded by Claude against Josh's rubric, a score out of 30 across five dimensions, four bands, and an offer card. Each quiz is a folder under `quizzes/` (questions, copy, band text, offer); the engine, worker and build are shared.

- `quizzes/product-sense-score/` scores judgment on the initiative a senior PM owns (ORBIT). Spec: `PMC/00_Strategic_Resources/product-sense-score-funnel-spec-2026-09.md`. Its offer is currently "the next cohort", which is on hold.
- `quizzes/hours-back-score/` scores whether AI can give a PM hours back on one recurring task (Visibility, Inputs, Rules, Reuse, Judgment) and ends in the Hours Back Pilot.

## What's in here

```
quizzes/<slug>/questions.json   the questions, answer key, rubrics, examples, band and dimension copy, and every on-page string (edit this)
quizzes/<slug>/config.json      URLs the page needs: the worker, PostHog key, the band videos, the offer (the ask), the per-band secondary links
src/                            the engine (page.html template, styles.css, app.js); nothing product-specific lives here
scripts/build.mjs               builds dist/<slug>/index.html (production), dist/<slug>/preview.html (claude.ai preview), docs/<slug>/index.html (test)
worker/                         Cloudflare Worker: scores answers for any quiz (by `quiz` slug), calls Claude for the two sentences, adds the person to Kit, logs to D1
```

To add a quiz: copy a folder under `quizzes/`, change `slug`, `title`, `token` (the placeholder the person's answer is piped into, e.g. `[task]`), `kitPrefix`, the questions and copy; add one import line to `worker/src/index.js`; `npm run build`.

The answer key never ships to the browser: the build strips scores from the public copy of the questions, and the worker holds the key. The preview build keeps the key so it can grade itself without a server.

## The ask

Every results page ends in the same offer card (the quiz's `config.json` `offer`): for Hours Back Score that is the pilot and a scoping-call button; for Product Sense Score it was the next cohort. It comes from `offer` in `config.json`; update `when`, `deadline` and `url` for each cohort and rebuild. `secondary` holds the per-band line under the button (community for Reactive, the 20-minute review for Strategic and Leader, nothing for Emerging).

## Editing the questions

Everything a reader sees is in the quiz's `questions.json`. The `token` (`[initiative]`, `[task]`) anywhere in the text is replaced with what the person typed. Keep four options per question with scores 3, 2, 1, 0 in any order; the page never shows the scores. The two written items carry the rubric and four examples each; those are what Claude grades against, so tightening them is how you tune the grading.

After editing: `npm run build`, then redeploy the site and the worker (the worker imports every quiz's `questions.json` too).

## Test link for friends (before the worker exists)

`npm run build` also writes `docs/<slug>/index.html`: the whole quiz with local scoring, a keyword estimate for the two sentences, no email sent, no data stored. Publish it with GitHub Pages: repo Settings > Pages > "Deploy from a branch" > `main` and `/docs`. The pages are then at `https://<user>.github.io/product-sense-score/<slug>/`. The answer key is readable in that page's source, so this is for a friends test only; turn Pages off once the real site is up.

## Local preview

```
npm run build
npm run serve        # opens dist/ on a local port; the site works fully except the two sentences,
                     # which fall back to a keyword estimate when no worker URL is set
```

## Deploying the site (free)

Cloudflare Pages or GitHub Pages, either works. The site is one file per quiz: `dist/<slug>/index.html`.

1. Push this repo to GitHub.
2. Cloudflare Pages: new project from the repo, build command `npm run build`, output directory `dist`.
3. Custom domain: `joshatlas.co/score` needs the page served under the existing site; the simplest route is a Cloudflare Pages project on a subdomain (`score.joshatlas.co`) plus a redirect from `/score` if you want the short path.
4. Set `apiUrl` in `config.json` to the worker URL once it exists, rebuild, redeploy.

## Deploying the worker

```
cd worker
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY     # console.anthropic.com
npx wrangler secret put KIT_API_KEY           # Kit > Settings > Developer
npx wrangler deploy
```

Edit `wrangler.toml` first: `ALLOWED_ORIGIN` (the site's origin), `ANTHROPIC_MODEL` (check docs.claude.com for the current cheapest capable model id), and `KIT_TAGS` once the tags exist in Kit.

Optional log of every submission (so you can read the first 50 sentences): create a D1 database, uncomment the `[[d1_databases]]` block, then `npx wrangler d1 execute pss --file=schema.sql`. Read it later with `npx wrangler d1 execute pss --command "select created_at, initiative, w1, w1_score, w1_reason, w2, w2_score, w2_reason from submissions order by id desc limit 50"`.

## Kit setup (once)

1. Plan: Creator (the free plan allows one automation; this needs four).
2. Custom fields, one set per quiz using its `kitPrefix`: `pss_score`, `pss_band`, `pss_weakest`, `pss_initiative`, `pss_role`, `pss_source`, `pss_w1_reason`, `pss_w2_reason`, and the same with `hbs_`.
3. Tags, prefixed by quiz: `pss:band:<band>`, `pss:weakest:<dimension>`, `hbs:band:<band>` (byhand, adhoc, systematic, operator), `hbs:weakest:<dimension>` (visibility, inputs, rules, reuse, judgment), plus `role:<id>`. Paste each tag's id into `KIT_TAGS`.
4. Four visual automations, one per band tag, each a five-email sequence (E0 instant, E1 day 2, E2 day 5, E3 day 8, E4 day 12). The emails can use the fields above as merge tags, so E1 can quote the person's initiative and the reason Claude gave for their sentence score.
5. Verify the two API calls in `worker/src/index.js` (`POST /v4/subscribers`, `POST /v4/tags/{id}/subscribers`) against the current Kit v4 docs before launch; field names in the API are the field keys Kit shows in Settings.

## Analytics and pixels

`config.json` has `posthog.key` (free tier at posthog.com; project settings > API key) and `posthog.host`; leave the key empty to ship without analytics. PostHog gives you a funnel per question (Insights > Funnels, steps `start` then `answer` filtered by `q`) and session replays with inputs masked. The page fires these events: `start_view`, `start`, `role`, `initiative_set`, `answer` (per question), `gate_view`, `email_submitted`, `scored` (band, weakest), `results_view`, `offer_click` (band), `secondary_click` (band), `score_error`. The Meta pixel and LinkedIn Insight Tag go in the marked spot in `scripts/build.mjs` once the ad accounts exist; install them before any spend so the retargeting audiences build up.

## The preview on claude.ai

`dist/<slug>/preview.html` is the same page as an artifact fragment. It grades the multiple choice locally and asks Claude (through the viewer's own account) to grade the two sentences, so you can test the rubric before anything is deployed. It stores nothing.

## Cost

Hosting: free. Worker: free tier covers this volume. Claude: a fraction of a cent per quiz. Kit Creator: about $39 a month at 1,000 subscribers. PostHog: free tier covers this volume.

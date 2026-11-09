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

## Abuse controls (added Oct 16, 2026)

The worker refuses or throttles before any paid call. In order: Origin must be on `ALLOWED_ORIGIN`; a hidden honeypot field (`website`) must be empty; a Cloudflare Turnstile token must verify when `TURNSTILE_SECRET` is set; at most `RATE_LIMIT_PER_10MIN` submissions per IP (hashed, in D1); sentences identical to one the same email submitted in the last 24h reuse the stored grade; more than `EMAIL_DAILY_CAP` new grades per email per day, or more than `DAILY_CLAUDE_CAP` submissions per day, get a placeholder score instead of a Claude call; past `DAILY_LOG_CAP` nothing is logged. Each control is skipped when its config is absent. Dashboard deploy (no wrangler): paste `worker/dist/worker.bundle.js` (regenerate with `node scripts/bundle-worker.mjs` after any change to `worker/src/index.js` or either `questions.json`), add the vars in Settings, run the new statements in `worker/schema.sql` in the D1 console.

Turnstile, once: Cloudflare dashboard > Turnstile > Add widget (hostnames `josh-atlas.github.io` and `joshatlas.co`, mode Managed). Put the site key in each `quizzes/<slug>/config.json` as `turnstileSiteKey` and rebuild; add the secret key to the worker as the `TURNSTILE_SECRET` secret. Until both are set, the page shows no widget and the worker skips the check. The only money cap outside this code is the monthly spend limit on the Anthropic console; set it.

## Checkout (added Nov 8, 2026)

The Product Sense Score results card sells the cohort directly: the button is a Stripe Payment Link, the seat line is live ("Three of eight seats left"), and the card flips to "Sold out" at the cap. Pieces:

- `quizzes/product-sense-score/config.json`: `checkout` (product id `pss-cohort`, cap, value, currency, and the `thanks` page copy) and `offer` (`url` is the Payment Link; `talk` is the book-a-call line under the button; `soldOut` copy; `soldOutOverride: true` forces the sold-out state by hand). While `offer.url` is empty the button falls back to the call link, so the page is always safe to ship.
- The page appends `prefilled_email` and `client_reference_id` (`pss-cohort_<band>_<weakest>_<source>`) to the Payment Link, fetches `GET /api/seats?product=pss-cohort` on the results screen, and fires the pixel's `Lead` (results) and `InitiateCheckout` (buy click) when `metaPixelId` is set.
- `docs/product-sense-score/thanks/` is the page Stripe sends people to after paying (built from `src/thanks.html`). It fires the pixel's `Purchase`.
- Worker: `POST /api/stripe-webhook` verifies the `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET`, records paid `checkout.session.completed` sessions in D1 (`purchases`, idempotent on session id) and marks `charge.refunded` rows refunded; `GET /api/seats` counts paid rows against `PSS_COHORT_CAP` (default 8).

Stripe, once: Products > add "Product Sense Cohort", one-time $499. Payment Links > create from that product; under the link's options set "Limit the number of payments" to 8 (the hard stop; the page's sold-out state is the soft one), "After payment" to redirect to `https://josh-atlas.github.io/product-sense-score/product-sense-score/thanks/`, and collect the customer's name. Developers > Webhooks > add endpoint `https://quiz-api.josh-andrew-atlas.workers.dev/api/stripe-webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`; copy its signing secret into the worker as the `STRIPE_WEBHOOK_SECRET` secret and promote the new version. Run the `purchases` statements from `worker/schema.sql` in the D1 console. Paste the Payment Link into `offer.url`, rebuild, commit.

## Kit setup (once)

1. Plan: Creator (the free plan allows one automation; this needs four).
2. Custom fields, one set per quiz using its `kitPrefix`: `pss_score`, `pss_band`, `pss_weakest`, `pss_initiative`, `pss_role`, `pss_source`, `pss_w1_reason`, `pss_w2_reason`, and the same with `hbs_`.
3. Tags, prefixed by quiz: `pss:band:<band>`, `pss:weakest:<dimension>`, `hbs:band:<band>` (byhand, adhoc, systematic, operator), `hbs:weakest:<dimension>` (visibility, inputs, rules, reuse, judgment), plus `role:<id>`. Paste each tag's id into `KIT_TAGS`.
4. Four visual automations, one per band tag, each a five-email sequence (E0 instant, E1 day 2, E2 day 5, E3 day 8, E4 day 12). The emails can use the fields above as merge tags, so E1 can quote the person's initiative and the reason Claude gave for their sentence score.
5. Verify the two API calls in `worker/src/index.js` (`POST /v4/subscribers`, `POST /v4/tags/{id}/subscribers`) against the current Kit v4 docs before launch; field names in the API are the field keys Kit shows in Settings.

## Analytics and pixels

`config.json` has `posthog.key` (free tier at posthog.com; project settings > API key) and `posthog.host`; leave the key empty to ship without analytics. PostHog gives you a funnel per question (Insights > Funnels, steps `start` then `answer` filtered by `q`) and session replays with inputs masked. The page fires these events: `start_view`, `start`, `role`, `initiative_set`, `answer` (per question), `gate_view`, `email_submitted`, `scored` (band, weakest), `results_view`, `offer_click` or `checkout_click` (band, weakest), `talk_click`, `secondary_click` (band), `sold_out_view`, `score_error`, and `purchase_thanks` on the thanks page. Meta pixel: put the pixel id in `metaPixelId` in `config.json` and rebuild; the build injects the base code (PageView) and the page fires `Lead`, `InitiateCheckout` and `Purchase` as described under Checkout. Install it before any spend so the audiences build up. LinkedIn Insight Tag still goes in by hand in `scripts/build.mjs` if ever needed.

## The preview on claude.ai

`dist/<slug>/preview.html` is the same page as an artifact fragment. It grades the multiple choice locally and asks Claude (through the viewer's own account) to grade the two sentences, so you can test the rubric before anything is deployed. It stores nothing.

## Cost

Hosting: free. Worker: free tier covers this volume. Claude: a fraction of a cent per quiz. Kit Creator: about $39 a month at 1,000 subscribers. PostHog: free tier covers this volume.

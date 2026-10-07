// Quiz API (Product Sense Score, Hours Back Score, ...). Cloudflare Worker.
// POST /api/score  { quiz, email, name, role, initiative, answers:{q1..q8: optionIndex}, written:{w1,w2}, source, version }
// -> { total, sub:{orient..transmit}, band, written:{w1:{score,reason}, w2:{...}}, scoredBy }
//
// Secrets (wrangler secret put ...): ANTHROPIC_API_KEY, KIT_API_KEY
// Vars (wrangler.toml [vars]): ALLOWED_ORIGIN, ANTHROPIC_MODEL, KIT_TAGS (JSON map name->id)
// Optional binding: DB (D1) for logging every scored submission so Josh can read the first 50 sentences.

import pss from "../../quizzes/product-sense-score/questions.json";
import hbs from "../../quizzes/hours-back-score/questions.json";

const QUIZZES = { [pss.slug]: pss, [hbs.slug]: hbs };

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/score") {
      try {
        const body = await request.json();
        const result = await score(body, env, ctx);
        return json(result, 200, cors);
      } catch (e) {
        const status = e && e.status ? e.status : 500;
        return json({ error: e && e.message ? e.message : "error" }, status, cors);
      }
    }
    return json({ ok: true, service: "quiz-api", quizzes: Object.fromEntries(Object.values(QUIZZES).map((q) => [q.slug, q.version])) }, 200, cors);
  },
};

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ "content-type": "application/json" }, headers) });
}
function bad(msg) { const e = new Error(msg); e.status = 400; return e; }

async function score(body, env, ctx) {
  const questions = QUIZZES[String(body.quiz || "product-sense-score")];
  if (!questions) throw bad("unknown_quiz");
  const DIMS = questions.dimensions;
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("invalid_email");
  const name = String(body.name || "").trim().slice(0, 80);
  const role = String(body.role || "").slice(0, 40);
  const initiative = String(body.initiative || "").trim().slice(0, 120);
  if (initiative.length < 4) throw bad("initiative_required");
  const answers = body.answers || {};
  const written = body.written || {};
  const source = String(body.source || "").slice(0, 120);

  // Multiple choice: the key lives here, never in the page.
  const sub = {}; DIMS.forEach((d) => (sub[d] = 0));
  let total = 0;
  for (const q of questions.questions) {
    const i = Number(answers[q.id]);
    const opt = Number.isInteger(i) ? q.options[i] : null;
    const sc = opt ? opt.score : 0;
    sub[q.dimension] += sc; total += sc;
  }

  // Written answers: Claude against the rubric. One call for both sentences.
  const w = await scoreWritten(questions, written, initiative, env);
  for (const item of questions.written) { sub[item.dimension] += w[item.id].score; total += w[item.id].score; }

  const band = (questions.bands.find((b) => total >= b.min && total <= b.max) || questions.bands[0]).id;
  const weakest = DIMS.reduce((a, b) => (sub[b] < sub[a] ? b : a));
  const result = { quiz: questions.slug, total, sub, band, weakest, written: w, scoredBy: w.scoredBy };

  // Side effects after the response is on its way.
  ctx.waitUntil(Promise.allSettled([
    addToKit(env, questions, { email, name, role, initiative, total, band, weakest, sub, w, source }),
    logSubmission(env, { quiz: questions.slug, email, name, role, initiative, answers, written, total, band, weakest, sub, w, source, version: questions.version }),
  ]));

  return result;
}

async function scoreWritten(questions, written, initiative, env) {
  const out = { scoredBy: "claude" };
  const items = questions.written.map((item) => ({ item, text: String(written[item.id] || "").trim().slice(0, 400) }));

  if (!env.ANTHROPIC_API_KEY) {
    for (const { item, text } of items) out[item.id] = { score: text.length < 12 ? 0 : 1, reason: "Scoring model not configured." };
    out.scoredBy = "fallback";
    return out;
  }

  const prompt = buildPrompt(questions, items, initiative);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || "claude-haiku-4-5",
        max_tokens: 400,
        temperature: 0,
        system: "You grade single sentences written by senior product managers against a fixed rubric. Be strict and literal: score what the sentence does, not what it implies. Reply with JSON only.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error("anthropic_" + res.status);
    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const parsed = extractJson(text);
    for (const { item, text: t } of items) {
      const r = parsed && parsed[item.id];
      const sc = Math.max(0, Math.min(3, Number(r && r.score) || 0));
      out[item.id] = { score: t.length < 12 ? 0 : sc, reason: String((r && r.reason) || "").slice(0, 400) };
    }
    return out;
  } catch (e) {
    for (const { item, text } of items) out[item.id] = { score: text.length < 12 ? 0 : 1, reason: "The scoring model was unavailable; this is a placeholder score. I'll re-score it by hand." };
    out.scoredBy = "fallback";
    out.error = String(e && e.message);
    return out;
  }
}

function buildPrompt(questions, items, initiative) {
  const L = [];
  const tok = questions.token || "[initiative]";
  L.push(((questions.copy && questions.copy.promptContext) || "The PM's initiative") + ": " + initiative);
  L.push("");
  for (const { item, text } of items) {
    L.push("=== " + item.id + " ===");
    L.push("Question: " + item.prompt.split(tok).join(initiative));
    L.push("Rubric:");
    for (const r of item.rubric) L.push("  " + r.score + ": " + r.text);
    L.push("Examples:");
    for (const ex of item.examples) L.push("  score " + ex.score + ': "' + ex.text + '"');
    L.push('Their sentence: "' + text.replace(/"/g, "'") + '"');
    L.push("");
  }
  L.push('Reply with only this JSON: {"w1": {"score": 0|1|2|3, "reason": "<one plain sentence, second person, no jargon, saying what the sentence does or lacks against the rubric>"}, "w2": {"score": 0|1|2|3, "reason": "..."}}');
  return L.join("\n");
}

function extractJson(text) {
  try { return JSON.parse(text); } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// ---------- Kit (formerly ConvertKit) v4 API ----------
// Docs: https://developers.kit.com/v4  (verify field and tag endpoints against the current docs before launch)
async function addToKit(env, questions, d) {
  if (!env.KIT_API_KEY) return;
  const headers = { "X-Kit-Api-Key": env.KIT_API_KEY, "content-type": "application/json" };
  const dimNames = questions.dimensionNames;
  const prefix = questions.kitPrefix || "pss";

  // 1. Create or update the subscriber with custom fields (create the fields in Kit first: see README).
  const sub = await fetch("https://api.kit.com/v4/subscribers", {
    method: "POST", headers,
    body: JSON.stringify({
      email_address: d.email,
      first_name: d.name || undefined,
      fields: {
        [prefix + "_score"]: String(d.total),
        [prefix + "_band"]: d.band,
        [prefix + "_weakest"]: dimNames[d.weakest],
        [prefix + "_initiative"]: d.initiative,
        [prefix + "_role"]: d.role,
        [prefix + "_source"]: d.source,
        [prefix + "_w1_reason"]: d.w.w1.reason,
        [prefix + "_w2_reason"]: d.w.w2.reason,
      },
    }),
  });
  if (!sub.ok) {
    // Most likely cause: a custom field doesn't exist yet in Kit. Keep the email; drop the fields.
    const bare = await fetch("https://api.kit.com/v4/subscribers", {
      method: "POST", headers, body: JSON.stringify({ email_address: d.email, first_name: d.name || undefined }),
    });
    if (!bare.ok) throw new Error("kit_subscriber_" + sub.status + "_" + bare.status);
  }

  // 2. Tag: band, weakest dimension, role. KIT_TAGS is a JSON map of tag name -> tag id.
  let tags = {};
  try { tags = JSON.parse(env.KIT_TAGS || "{}"); } catch (e) {}
  const wanted = [prefix + ":band:" + d.band, prefix + ":weakest:" + d.weakest, "role:" + d.role];
  await Promise.allSettled(wanted.map(async (name) => {
    const id = tags[name];
    if (!id) return;
    const r = await fetch("https://api.kit.com/v4/tags/" + id + "/subscribers", {
      method: "POST", headers, body: JSON.stringify({ email_address: d.email }),
    });
    if (!r.ok) throw new Error("kit_tag_" + name + "_" + r.status);
  }));
}

// ---------- D1 log (optional) ----------
async function logSubmission(env, d) {
  if (!env.DB) return;
  await env.DB.prepare(
    "INSERT INTO submissions (created_at, quiz, email, name, role, initiative, answers, w1, w1_score, w1_reason, w2, w2_score, w2_reason, total, band, weakest, sub, source, version, scored_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(
    new Date().toISOString(), d.quiz, d.email, d.name, d.role, d.initiative, JSON.stringify(d.answers),
    d.written.w1 || "", d.w.w1.score, d.w.w1.reason,
    d.written.w2 || "", d.w.w2.score, d.w.w2.reason,
    d.total, d.band, d.weakest, JSON.stringify(d.sub), d.source, d.version, d.w.scoredBy
  ).run();
}

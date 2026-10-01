/* Quiz engine front-end (Product Sense Score, Hours Back Score, ...). Built per quiz into dist/<slug>/.
   Globals injected by the build: window.PSS_CONFIG, window.PSS_QUESTIONS. */
(function () {
  "use strict";

  const CONFIG = window.PSS_CONFIG || {};
  const Q = window.PSS_QUESTIONS;
  const C = Q.copy || {};
  const TOKEN = Q.token || "[initiative]";
  const PREVIEW = !!CONFIG.preview;   // claude.ai artifact: scores locally, Claude grades the sentences
  const TEST = !!CONFIG.test;         // friends-test build on GitHub Pages: scores locally, keyword estimate for the sentences, no email sent
  const LOCAL = PREVIEW || TEST;

  // ---------- tiny DOM helper (text-safe; user input never goes through innerHTML) ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v; // only ever called with build-time strings
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const $ = (s) => document.querySelector(s);

  // ---------- state ----------
  const STEPS = ["intro", "role", "initiative", ...Q.questions.map((q) => q.id), ...Q.written.map((w) => w.id), "gate", "scoring", "results"];
  let state = { step: "intro", role: null, initiative: "", mc: {}, written: {}, email: "", name: "", result: null, source: sourceFromUrl() };

  function sourceFromUrl() {
    try {
      const p = new URLSearchParams(location.search);
      return p.get("src") || p.get("utm_source") || (document.referrer ? new URL(document.referrer).hostname : "direct");
    } catch (e) { return "direct"; }
  }
  function save() { try { sessionStorage.setItem("pss-state", JSON.stringify(state)); } catch (e) {} }
  function load() {
    try {
      const s = JSON.parse(sessionStorage.getItem("pss-state") || "null");
      if (s && s.step && STEPS.includes(s.step) && s.step !== "scoring") state = Object.assign(state, s);
    } catch (e) {}
  }

  // ---------- analytics (PostHog if present, GA4 dataLayer if present, console in preview/test) ----------
  function track(event, props) {
    try {
      if (window.posthog && window.posthog.capture) window.posthog.capture(event, props || {});
      if (window.dataLayer) window.dataLayer.push(Object.assign({ event }, props));
      if (LOCAL) console.log("[pss]", event, props || "");
    } catch (e) {}
  }

  // ---------- rendering ----------
  const app = $("#app");
  const bar = $("#progress > div");

  // The user's own words drop into question stems. Quoting them keeps the sentence readable whatever they typed
  // ("how many hours you spent on “weekly pulse check report”"); the fallback is plain prose and stays unquoted.
  function taskName() {
    const raw = (state.initiative || "").trim().replace(/^["“”']+|["“”']+$/g, "").replace(/[.!?]+$/, "");
    if (!raw) return (Q.setup[1] && Q.setup[1].fallback) || "your initiative";
    return "“" + raw + "”";
  }
  function pipe(text) {
    const init = taskName();
    return text.split(TOKEN).join(init).split("[initiative]").join(init);
  }
  function progress() {
    const i = STEPS.indexOf(state.step);
    const denom = STEPS.length - 2; // don't count scoring/results as steps to reach
    bar.style.width = Math.min(100, Math.round((i / denom) * 100)) + "%";
  }
  function go(step) {
    state.step = step;
    save();
    render();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
  function next() {
    const i = STEPS.indexOf(state.step);
    go(STEPS[Math.min(i + 1, STEPS.length - 1)]);
  }
  function back() {
    const i = STEPS.indexOf(state.step);
    go(STEPS[Math.max(i - 1, 0)]);
  }

  function render() {
    progress();
    app.replaceChildren();
    const s = state.step;
    let el;
    if (s === "intro") el = viewIntro();
    else if (s === "role") el = viewRole();
    else if (s === "initiative") el = viewInitiative();
    else if (s === "gate") el = viewGate();
    else if (s === "scoring") el = viewScoring();
    else if (s === "results") el = viewResults();
    else {
      const q = Q.questions.find((x) => x.id === s);
      const w = Q.written.find((x) => x.id === s);
      el = q ? viewMC(q) : viewWritten(w);
    }
    app.append(el);
    const focusTarget = app.querySelector("h1, h2");
    if (focusTarget) { focusTarget.setAttribute("tabindex", "-1"); focusTarget.focus({ preventScroll: true }); }
  }

  function viewIntro() {
    track("start_view");
    return h("section", { class: "screen" },
      h("div", { class: "eyebrow" }, C.intro.eyebrow),
      h("h1", null, C.intro.h1),
      h("p", null, C.intro.p),
      h("p", { class: "muted" }, C.intro.muted),
      PREVIEW ? h("div", { class: "notice" }, "Preview build. Nothing you type is stored or sent anywhere; the two written answers are scored live by Claude against my rubric so you can judge the grading.") : null,
      TEST ? h("div", { class: "notice" }, "Test build. Nothing you type is stored or sent anywhere and no email goes out. The two written answers get a rough keyword estimate here; the real version grades them against my rubric.") : null,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { track("start"); next(); } }, "Start")),
    );
  }

  function viewRole() {
    const q = Q.setup[0];
    return h("section", { class: "screen" },
      h("div", { class: "eyebrow" }, "Before we start"),
      h("h2", null, q.prompt),
      h("div", { class: "options", role: "group", "aria-label": q.prompt },
        q.options.map((o) => h("button", {
          class: "opt", "aria-pressed": state.role === o.id ? "true" : "false",
          onclick: () => { state.role = o.id; save(); track("role", { role: o.id }); setTimeout(next, 120); },
        }, o.text))),
      h("div", { class: "row" }, h("button", { class: "link", onclick: back }, "Back")),
    );
  }

  function viewInitiative() {
    const q = Q.setup[1];
    const input = h("input", { type: "text", id: "initiative", maxlength: q.maxLength, placeholder: q.placeholder, value: state.initiative, autocomplete: "off" });
    const err = h("div", { class: "error", "aria-live": "polite" });
    const submit = () => {
      const v = input.value.trim();
      if (v.length < 4) { err.textContent = C.setupError; input.focus(); return; }
      state.initiative = v; save(); track("initiative_set"); next();
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    return h("section", { class: "screen" },
      h("div", { class: "eyebrow" }, "Before we start"),
      h("h2", null, q.prompt),
      h("div", { class: "field" },
        h("label", { for: "initiative" }, C.setupLabel),
        input,
        h("div", { class: "help" }, q.help),
        q.privacy ? h("div", { class: "help muted", style: "margin-top:6px" }, q.privacy) : null,
        err),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: submit }, "Continue"),
        h("button", { class: "link", onclick: back }, "Back")),
    );
  }

  function viewMC(q) {
    const idx = Q.questions.indexOf(q);
    const chosen = state.mc[q.id];
    return h("section", { class: "screen" },
      idx === 0 ? h("div", { class: "notice" }, pipe(Q.instruction)) : null,
      h("div", { class: "eyebrow" }, "Question " + (idx + 1) + " of " + (Q.questions.length + Q.written.length)),
      h("h2", null, pipe(q.prompt)),
      h("div", { class: "options", role: "group", "aria-label": "Answers" },
        q.options.map((o, i) => h("button", {
          class: "opt", "aria-pressed": chosen === i ? "true" : "false",
          onclick: () => { state.mc[q.id] = i; save(); track("answer", { q: q.id }); setTimeout(next, 140); },
        }, o.text))),
      h("div", { class: "row" }, h("button", { class: "link", onclick: back }, "Back")),
    );
  }

  function viewWritten(w) {
    const idx = Q.questions.length + Q.written.indexOf(w);
    const ta = h("textarea", { id: w.id, maxlength: w.maxLength, placeholder: w.placeholder });
    ta.value = state.written[w.id] || "";
    const count = h("div", { class: "count" }, ta.value.length + " / " + w.maxLength);
    ta.addEventListener("input", () => { count.textContent = ta.value.length + " / " + w.maxLength; });
    const err = h("div", { class: "error", "aria-live": "polite" });
    const submit = () => {
      const v = ta.value.trim();
      if (v.length < 12) { err.textContent = "One real sentence. A blank scores zero, and I would rather you get a real number."; ta.focus(); return; }
      state.written[w.id] = v; save(); track("answer", { q: w.id }); next();
    };
    return h("section", { class: "screen" },
      h("div", { class: "eyebrow" }, "Question " + (idx + 1) + " of " + (Q.questions.length + Q.written.length) + ". Written answer."),
      h("h2", null, pipe(w.prompt)),
      h("div", { class: "field" }, ta, count, err),
      h("p", { class: "help" }, "One sentence is enough. This one is scored against my rubric by an AI model; I read a sample every week to keep it honest."),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: submit }, "Continue"),
        h("button", { class: "link", onclick: back }, "Back")),
    );
  }

  function viewGate() {
    track("gate_view");
    const email = h("input", { type: "email", id: "email", placeholder: "you@company.com", value: state.email, autocomplete: "email", required: true });
    const name = h("input", { type: "text", id: "name", placeholder: "First name (optional)", value: state.name, autocomplete: "given-name" });
    const err = h("div", { class: "error", "aria-live": "polite" });
    const form = h("form", { class: "screen gate", onsubmit: (e) => {
      e.preventDefault();
      const v = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { err.textContent = "That email doesn't look complete."; email.focus(); return; }
      state.email = v; state.name = name.value.trim(); save(); track("email_submitted");
      try { if (window.posthog && window.posthog.identify) window.posthog.identify(v, { name: state.name || undefined, role: state.role }); } catch (e) {}
      go("scoring"); runScoring();
    } },
      h("div", { class: "eyebrow" }, "Your score is ready"),
      h("div", { class: "blur-band", "aria-hidden": "true" }, Q.bands[Q.bands.length - 1].name),
      h("h2", null, C.gate.h2),
      h("p", { class: "muted" }, C.gate.p),
      h("div", { class: "field" }, h("label", { for: "email" }, "Email"), email),
      h("div", { class: "field" }, h("label", { for: "name" }, "Name"), name),
      err,
      LOCAL ? h("div", { class: "notice" }, "This build stores nothing and sends no email. Enter anything with an @ to see the results page.") : null,
      h("div", { class: "row" },
        h("button", { class: "btn", type: "submit" }, "Show my score"),
        h("button", { class: "link", type: "button", onclick: back }, "Back")),
    );
    return form;
  }

  function viewScoring() {
    return h("section", { class: "screen" },
      h("h2", null, h("span", { class: "spinner", "aria-hidden": "true" }), C.scoring.h2),
      h("p", { class: "muted", id: "scoring-status" }, C.scoring.p),
    );
  }

  // ---------- scoring ----------
  function bandFor(total) {
    return Q.bands.find((b) => total >= b.min && total <= b.max) || Q.bands[0];
  }
  function localMC() {
    // Only possible in preview, where the key ships with the page. Production scores on the server.
    const sub = {}; Q.dimensions.forEach((d) => (sub[d] = 0));
    let total = 0;
    for (const q of Q.questions) {
      const i = state.mc[q.id];
      const sc = (i != null && q.options[i] && typeof q.options[i].score === "number") ? q.options[i].score : 0;
      sub[q.dimension] += sc; total += sc;
    }
    return { sub, total };
  }
  function rubricPrompt(w) {
    const lines = [];
    lines.push("You are scoring one sentence written by a senior product manager, using the rubric below. Be strict and literal: score what the sentence does, not what it implies.");
    lines.push("");
    lines.push((C.promptContext || "Their initiative") + ": " + (state.initiative || "(not given)"));
    lines.push("The question they answered: " + pipe(w.prompt));
    lines.push("");
    lines.push("Rubric:");
    for (const r of w.rubric) lines.push("  " + r.score + ": " + r.text);
    lines.push("");
    lines.push("Examples:");
    for (const ex of w.examples) lines.push("  score " + ex.score + ': "' + ex.text + '"');
    lines.push("");
    lines.push('Their sentence: "' + (state.written[w.id] || "") + '"');
    lines.push("");
    lines.push('Reply with only a JSON object: {"score": 0|1|2|3, "reason": "<one plain sentence, second person, no jargon, that says what the sentence does or lacks against the rubric>"}');
    return lines.join("\n");
  }
  async function scoreWrittenPreview() {
    const out = {};
    let sample = null;
    try { sample = window.claude && window.claude.use ? await window.claude.use("sample") : null; } catch (e) { sample = null; }
    for (const w of Q.written) {
      const text = state.written[w.id] || "";
      if (sample) {
        try {
          const r = await sample.json(rubricPrompt(w), { modelTier: "quick" });
          const sc = Math.max(0, Math.min(3, Number(r && r.score) || 0));
          out[w.id] = { score: sc, reason: String((r && r.reason) || ""), scoredBy: "claude" };
          continue;
        } catch (e) {
          out[w.id] = heuristic(w, text, "Claude scoring was unavailable in this view (" + (e && e.code ? e.code : "no access") + "), so this is a rough keyword estimate.");
          continue;
        }
      }
      out[w.id] = heuristic(w, text, "Claude scoring isn't available outside the claude.ai viewer, so this is a rough keyword estimate.");
    }
    return out;
  }
  function heuristic(w, text, note) {
    const t = text.toLowerCase();
    let sc = text.length < 12 ? 0 : 1;
    // Quiz-specific estimate: each regex group in w.heuristic stands for one rubric element; score counts how many appear.
    if (Array.isArray(w.heuristic) && w.heuristic.length) {
      let hit = 0;
      for (const re of w.heuristic) { try { if (new RegExp(re, "i").test(t)) hit++; } catch (e) { /* bad pattern: skip */ } }
      const perHit = 3 / w.heuristic.length;
      return { score: text.length < 25 ? 0 : Math.max(1, Math.min(3, Math.round(hit * perHit))), reason: note, scoredBy: "heuristic" };
    }
    if (/(not|no longer|won't|will not|instead of|rather than|which means we)/.test(t)) sc = Math.max(sc, 2);
    if (w.id === "w1" && /(not|which means)/.test(t) && /(rate|revenue|retention|activation|churn|margin|conversion|nps|cost|time to|%|number)/.test(t)) sc = 3;
    if (w.id === "w2" && /(not)/.test(t) && /(even|though|asked|wants|sales|renewal|exec|cfo|ceo|board|enterprise|customer)/.test(t)) sc = 3;
    return { score: sc, reason: note, scoredBy: "heuristic" };
  }

  async function runScoring() {
    try {
      let result;
      if (LOCAL || !CONFIG.apiUrl) {
        const { sub, total } = localMC();
        const written = await scoreWrittenPreview();
        for (const w of Q.written) { sub[w.dimension] += written[w.id].score; }
        const grand = total + written.w1.score + written.w2.score;
        result = { total: grand, sub, written, band: bandFor(grand).id, scoredBy: written.w1.scoredBy };
      } else {
        const res = await fetch(CONFIG.apiUrl, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            quiz: Q.slug, email: state.email, name: state.name, role: state.role, initiative: state.initiative,
            answers: state.mc, written: state.written, source: state.source, version: Q.version,
          }),
        });
        if (!res.ok) throw new Error("score_failed_" + res.status);
        result = await res.json();
      }
      const weakest = Q.dimensions.reduce((a, b) => (result.sub[b] < result.sub[a] ? b : a));
      state.result = Object.assign({ weakest }, result);
      save();
      track("scored", { band: result.band, weakest });
      go("results");
    } catch (e) {
      const st = $("#scoring-status");
      if (st) st.textContent = "Something went wrong scoring your answers. Your answers are saved on this page; try again in a moment.";
      const btn = h("button", { class: "btn", onclick: () => { st.textContent = "Trying again."; runScoring(); } }, "Try again");
      app.append(h("div", { class: "row" }, btn));
      track("score_error", { message: String(e && e.message) });
    }
  }

  // ---------- results ----------
  function ring(total) {
    const r = 54, c = 2 * Math.PI * r, frac = total / 30;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 132 132"); svg.setAttribute("class", "ring"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Score " + total + " out of 30");
    const bg = document.createElementNS(svgNS, "circle");
    bg.setAttribute("cx", 66); bg.setAttribute("cy", 66); bg.setAttribute("r", r); bg.setAttribute("fill", "none");
    bg.setAttribute("stroke", "var(--line)"); bg.setAttribute("stroke-width", 10);
    const fg = document.createElementNS(svgNS, "circle");
    fg.setAttribute("cx", 66); fg.setAttribute("cy", 66); fg.setAttribute("r", r); fg.setAttribute("fill", "none");
    fg.setAttribute("stroke", "var(--accent)"); fg.setAttribute("stroke-width", 10); fg.setAttribute("stroke-linecap", "round");
    fg.setAttribute("stroke-dasharray", (c * frac).toFixed(1) + " " + c.toFixed(1));
    fg.setAttribute("transform", "rotate(-90 66 66)");
    const t1 = document.createElementNS(svgNS, "text");
    t1.setAttribute("x", 66); t1.setAttribute("y", 72); t1.setAttribute("text-anchor", "middle"); t1.setAttribute("font-size", "34");
    t1.textContent = String(total);
    const t2 = document.createElementNS(svgNS, "text");
    t2.setAttribute("x", 66); t2.setAttribute("y", 92); t2.setAttribute("text-anchor", "middle"); t2.setAttribute("font-size", "12"); t2.setAttribute("fill", "var(--ink-2)");
    t2.textContent = "of 30";
    svg.append(bg, fg, t1, t2);
    return svg;
  }

  function viewResults() {
    const r = state.result;
    const band = Q.bands.find((b) => b.id === r.band) || Q.bands[0];
    const copy = Q.bandCopy[band.id];
    const weakName = Q.dimensionNames[r.weakest];
    const video = (CONFIG.videos || {})[band.id];
    const offer = CONFIG.offer || null;
    const secondary = (CONFIG.secondary || {})[band.id] || null;
    track("results_view", { band: band.id });

    // The ask. Same offer on every band; the copy above it is what changes.
    const offerCard = offer ? h("div", { class: "card offer" },
      h("div", { class: "eyebrow" }, "The next step"),
      h("h3", null, offer.name),
      h("p", { style: "margin:0 0 6px" }, offer.when),
      h("p", { style: "margin:0 0 6px" }, offer.what),
      h("p", { style: "margin:0 0 12px" }, [offer.seats, offer.price, offer.deadline].filter(Boolean).join(" · ")),
      h("a", { class: "btn", href: offer.url, target: "_blank", rel: "noopener", onclick: () => track("offer_click", { band: band.id }) }, offer.button),
      secondary ? h("p", { class: "small", style: "margin:12px 0 0" },
        h("a", { href: secondary.url, target: "_blank", rel: "noopener", onclick: () => track("secondary_click", { band: band.id }) }, secondary.label)) : null) : null;

    const dims = h("div", { class: "dims" },
      Q.dimensions.map((d) => h("div", { class: "dim" + (d === r.weakest ? " weak" : "") },
        h("span", { class: "name" }, Q.dimensionNames[d]),
        h("div", { class: "bar" }, h("i", { style: "width:" + Math.round((r.sub[d] / 6) * 100) + "%" })),
        h("span", { class: "n" }, r.sub[d] + " / 6"))));

    // "Is 22 good?" Place the score on the ladder in one sentence, built from the band table.
    const bandIdx = Q.bands.indexOf(band);
    const ordinals = ["lowest", "second", "third", "top"];
    const ordinal = Q.bands.length === 4 ? ordinals[bandIdx] : String(bandIdx + 1);
    const above = Q.bands[bandIdx + 1];
    const countWord = ["one", "two", "three", "four", "five", "six"][Q.bands.length - 1] || String(Q.bands.length);
    const placement = r.total + " of 30 is " + band.name + ", the " + ordinal + " of " + countWord + " bands." +
      (above ? " " + above.name + " starts at " + above.min + "." : " There is no band above this one.");

    const writtenCards = Q.written.map((w) => {
      const wr = r.written[w.id] || { score: 0, reason: "" };
      return h("div", { class: "card" },
        h("div", { class: "row" }, h("span", { class: "pill" }, Q.dimensionNames[w.dimension] + " · " + wr.score + " / 3")),
        h("p", { class: "small muted", style: "margin:8px 0 4px" }, "You were asked: " + pipe(w.prompt)),
        h("div", { class: "quote" }, state.written[w.id] || ""),
        h("p", { class: "small", style: "margin:0" }, wr.reason || ""));
    });

    // "What I'd do next": the first move for the weakest dimension, then the band-level note.
    const nextText = [Q.dimensionNext && Q.dimensionNext[r.weakest], copy.next].filter(Boolean).map(pipe).join(" ");

    return h("section", { class: "screen" },
      h("div", { class: "eyebrow" }, C.results.eyebrow),
      C.results.framing ? h("p", { class: "small muted", style: "margin:0 0 12px" }, pipe(C.results.framing)) : null,
      h("div", { class: "score-hero" },
        ring(r.total),
        h("div", null,
          h("div", { class: "band-name" }, band.name),
          h("div", { class: "band-tag" }, band.tagline),
          h("p", { class: "small", style: "margin:8px 0 0" }, placement),
          h("p", { class: "small muted", style: "margin:4px 0 0" }, C.results.weakestLabel + ": " + weakName))),
      h("h2", null, pipe(copy.headline)),
      h("p", null, pipe(copy.body)),
      h("h3", { class: "eyebrow", style: "margin-top:8px" }, "By dimension"),
      dims,
      h("div", { class: "card" },
        h("h3", null, C.results.weakestLabel + ": " + weakName),
        h("p", { style: "margin:0" }, pipe(Q.dimensionCopy[r.weakest]))),
      h("h3", { class: "eyebrow", style: "margin-top:8px" }, C.results.sentencesH3),
      ...writtenCards,
      video ? h("div", { class: "card" },
        h("h3", null, C.results.videoH3.replace("{band}", band.name)),
        h("p", { class: "small" }, C.results.videoP),
        h("a", { class: "btn", href: video, target: "_blank", rel: "noopener" }, "Watch the note")) :
        h("div", { class: "card" }, h("h3", null, C.results.videoH3.replace("{band}", band.name)), h("p", { class: "small muted", style: "margin:0" }, "The video for this band arrives in your first email.")),
      h("div", { class: "card" },
        h("h3", null, C.results.nextH3),
        h("p", { style: "margin:0" }, nextText)),
      offerCard,
      h("p", { class: "disclosure" }, "The two sentences you wrote are scored against my rubric by an AI model. I read a sample every week to keep it honest.",
        r.scoredBy === "heuristic" ? " (In this " + (TEST ? "test build" : "preview") + " the model isn't used, so those two scores are a rough estimate.)" : ""),
      LOCAL ? h("div", { class: "row" }, h("button", { class: "link", onclick: () => { state = { step: "intro", role: null, initiative: "", mc: {}, written: {}, email: "", name: "", result: null, source: state.source }; save(); go("intro"); } }, "Start over")) : null,
    );
  }

  // ---------- boot ----------
  load();
  if (state.step === "results" && !state.result) state.step = "gate";
  render();
})();

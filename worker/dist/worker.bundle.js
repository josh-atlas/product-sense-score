// Generated: worker/src/index.js with both questions.json inlined. Paste into the Cloudflare dashboard editor.
// Quiz API (Product Sense Score, Hours Back Score, ...). Cloudflare Worker.
// POST /api/score  { quiz, email, name, role, initiative, answers:{q1..q8: optionIndex}, written:{w1,w2}, source, version }
// -> { total, sub:{orient..transmit}, band, written:{w1:{score,reason}, w2:{...}}, scoredBy }
//
// Secrets (wrangler secret put ...): ANTHROPIC_API_KEY, KIT_API_KEY
// Vars (wrangler.toml [vars]): ALLOWED_ORIGIN, ANTHROPIC_MODEL, KIT_TAGS (JSON map name->id)
// Optional binding: DB (D1) for logging every scored submission so Josh can read the first 50 sentences.

const pss = {
  "slug": "product-sense-score",
  "title": "Product Sense Score",
  "token": "[initiative]",
  "version": "2026-09-25",
  "dimensions": [
    "orient",
    "reframe",
    "balance",
    "integrate",
    "transmit"
  ],
  "dimensionNames": {
    "orient": "Orient",
    "reframe": "Reframe",
    "balance": "Balance",
    "integrate": "Integrate",
    "transmit": "Transmit"
  },
  "bands": [
    {
      "id": "reactive",
      "min": 0,
      "max": 11,
      "name": "Reactive",
      "tagline": "Pulled by everyone else's gravity"
    },
    {
      "id": "emerging",
      "min": 12,
      "max": 18,
      "name": "Emerging",
      "tagline": "Partial ORBIT, a lot of thrash"
    },
    {
      "id": "strategic",
      "min": 19,
      "max": 25,
      "name": "Strategic",
      "tagline": "Others orbit your clarity"
    },
    {
      "id": "leader",
      "min": 26,
      "max": 30,
      "name": "Leader",
      "tagline": "ORBIT at scale"
    }
  ],
  "setup": [
    {
      "id": "role",
      "prompt": "Which is closest to your role?",
      "options": [
        {
          "id": "senior_pm",
          "text": "Senior PM or above, in role"
        },
        {
          "id": "pm",
          "text": "PM below senior"
        },
        {
          "id": "eng_design",
          "text": "Engineer or designer leading product work"
        },
        {
          "id": "founder",
          "text": "Founder"
        },
        {
          "id": "other",
          "text": "Something else"
        }
      ]
    },
    {
      "id": "initiative",
      "prompt": "What's the initiative you own going into planning?",
      "placeholder": "self-serve onboarding for small business accounts",
      "help": "Describe it the way you would to a peer at another company. No internal codename, no customer names, no numbers. I use this to write the questions around your actual work and to make the results about it. It's stored with your score and nothing else. Two questions ask you for a sentence; those are scored against my rubric by an AI model and are not used to train anything. Email me any time and I'll delete all of it.",
      "maxLength": 80
    }
  ],
  "instruction": "These ask what actually happened. If a situation hasn't come up on [initiative] yet, pick what you'd most likely do.",
  "questions": [
    {
      "id": "q1",
      "dimension": "orient",
      "prompt": "Think about the last time leadership asked where [initiative] was going next year. What did you actually bring?",
      "options": [
        {
          "text": "A ranked list of the most requested improvements, with effort estimates.",
          "score": 1
        },
        {
          "text": "A focus area, with the reasoning for why it mattered most.",
          "score": 2
        },
        {
          "text": "A direction that named what we would not be doing next year, and why.",
          "score": 3
        },
        {
          "text": "Options with the trade-offs laid out so leadership could choose.",
          "score": 0
        }
      ]
    },
    {
      "id": "q2",
      "dimension": "reframe",
      "prompt": "The last time a stakeholder pushed a feature onto [initiative] with \"or we lose the deal,\" what did you do first?",
      "options": [
        {
          "text": "Pulled the numbers to see how many deals were actually at risk.",
          "score": 1
        },
        {
          "text": "Estimated it with engineering so I could give them a date.",
          "score": 0
        },
        {
          "text": "Wrote down, in their words, what they believed the problem was, and checked it with the people closest to the deals.",
          "score": 3
        },
        {
          "text": "Explained why it wasn't on the roadmap this quarter.",
          "score": 2
        }
      ]
    },
    {
      "id": "q3",
      "dimension": "reframe",
      "prompt": "The last time a debate about [initiative] went in circles (this feature versus that one), what did you do?",
      "options": [
        {
          "text": "Kept it on the agenda and drove to a decision on the features.",
          "score": 1
        },
        {
          "text": "Proposed we step back and agree which customer we're building for before ranking anything.",
          "score": 2
        },
        {
          "text": "Said out loud what I thought the room was actually arguing about, named who would lose under the new frame, and offered them something.",
          "score": 3
        },
        {
          "text": "Let it run; the data would settle it in a couple of weeks.",
          "score": 0
        }
      ]
    },
    {
      "id": "q4",
      "dimension": "balance",
      "prompt": "When you last presented a trade-off on [initiative] and someone said \"obviously option A,\" what did you take from it?",
      "options": [
        {
          "text": "We had consensus; I documented it and moved on.",
          "score": 0
        },
        {
          "text": "Option B wasn't real yet. I hadn't shown what a sane person gains by choosing it, so the decision would get reopened later by whoever did.",
          "score": 3
        },
        {
          "text": "I should add a third option that split the difference.",
          "score": 1
        },
        {
          "text": "They didn't understand the risk in A; I looped in my tech lead.",
          "score": 2
        }
      ]
    },
    {
      "id": "q5",
      "dimension": "integrate",
      "prompt": "Six weeks before your last launch on [initiative], who was actually aligned?",
      "options": [
        {
          "text": "Engineering, design, and my manager; the rest we'd loop in at launch readiness.",
          "score": 1
        },
        {
          "text": "Engineering, design, my manager, and marketing.",
          "score": 2
        },
        {
          "text": "All of those plus finance or legal, because I had already asked each of them what would stop the launch.",
          "score": 3
        },
        {
          "text": "Everyone who mattered; my manager handled their peers.",
          "score": 0
        }
      ]
    },
    {
      "id": "q6",
      "dimension": "integrate",
      "prompt": "When you last explained [initiative] to a room with a finance person, an engineer, and a salesperson in it, how did you handle it?",
      "options": [
        {
          "text": "One version of the story for everyone; consistency matters.",
          "score": 2
        },
        {
          "text": "Separate 1:1s beforehand, so the meeting was a formality.",
          "score": 1
        },
        {
          "text": "One framing that named what each of them is measured on, and said what we were not doing so sales heard it from me first.",
          "score": 3
        },
        {
          "text": "Kept it high level so nobody got into the weeds.",
          "score": 0
        }
      ]
    },
    {
      "id": "q7",
      "dimension": "transmit",
      "prompt": "The last time someone repeated your strategy for [initiative] back to you (a tech lead, a peer, your manager), how close was it?",
      "options": [
        {
          "text": "Word for word, including what we were not doing.",
          "score": 3
        },
        {
          "text": "The gist held; the details drifted.",
          "score": 2
        },
        {
          "text": "They repeated the features, not the direction.",
          "score": 1
        },
        {
          "text": "Nobody has had to; I'm in every meeting where it comes up.",
          "score": 0
        }
      ]
    },
    {
      "id": "q8",
      "dimension": "transmit",
      "prompt": "When you last had two minutes with an exec about [initiative], what did you open with?",
      "options": [
        {
          "text": "The decision we're making, what it costs us, and the number it moves.",
          "score": 3
        },
        {
          "text": "The customer problem, and how we found it.",
          "score": 2
        },
        {
          "text": "The context on how we got here.",
          "score": 1
        },
        {
          "text": "What the team has built so far.",
          "score": 0
        }
      ]
    }
  ],
  "written": [
    {
      "id": "w1",
      "dimension": "orient",
      "prompt": "In one sentence, write the direction you've set for [initiative].",
      "placeholder": "We are making checkout the fastest in the category for repeat buyers, which means we are not touching onboarding next year.",
      "maxLength": 240,
      "rubric": [
        {
          "score": 3,
          "text": "Names a choice that rules something out, and ties it to an outcome the company already measures."
        },
        {
          "score": 2,
          "text": "A clear focus with a company outcome, but nothing ruled out."
        },
        {
          "score": 1,
          "text": "A focus area or theme with no outcome (\"make onboarding better\")."
        },
        {
          "score": 0,
          "text": "A feature list, a mission statement, \"improve [initiative],\" or blank."
        }
      ],
      "examples": [
        {
          "score": 3,
          "text": "Cut time-to-first-value for self-serve accounts from days to one session, so the 30-day activation number moves, which means no new admin features this year."
        },
        {
          "score": 2,
          "text": "Make self-serve onboarding fast enough that 30-day activation goes up."
        },
        {
          "score": 1,
          "text": "Improve the onboarding experience for new accounts."
        },
        {
          "score": 0,
          "text": "Onboarding checklist, progress bar, welcome email series, and in-app tips."
        }
      ]
    },
    {
      "id": "w2",
      "dimension": "balance",
      "prompt": "In one sentence, what are you explicitly not doing on [initiative] this year?",
      "placeholder": "We are not building the merchant export API, even if the two enterprise renewals ask for it.",
      "maxLength": 240,
      "rubric": [
        {
          "score": 3,
          "text": "A specific, nameable thing someone could hold you to in November, and it names who wants it."
        },
        {
          "score": 2,
          "text": "A specific thing, no stakeholder named."
        },
        {
          "score": 1,
          "text": "A category (\"lower-priority requests,\" \"nice-to-haves\")."
        },
        {
          "score": 0,
          "text": "Nothing actually ruled out (\"we'll revisit as capacity allows\"), or blank."
        }
      ],
      "examples": [
        {
          "score": 3,
          "text": "We are not building SSO for the mid-market tier this year, even though two account managers have it in their renewal plans."
        },
        {
          "score": 2,
          "text": "We are not building SSO for the mid-market tier this year."
        },
        {
          "score": 1,
          "text": "We are deprioritizing the lower-impact enterprise requests."
        },
        {
          "score": 0,
          "text": "We will revisit other requests as capacity allows."
        }
      ]
    }
  ],
  "bandCopy": {
    "reactive": {
      "headline": "You are running someone else's roadmap.",
      "body": "Most of what you brought to the last planning cycle was shaped by whoever asked loudest. That is not a talent problem. Nobody told you the framing was the job. The first move is small: one direction for [initiative] that says what you are not doing.",
      "next": "Take a seat in the next cohort. You will bring one real decision from [initiative] each week and leave with a direction that says what you are not doing. If that feels like too much right now, start with the free exercise in your first email and the community."
    },
    "emerging": {
      "headline": "You set direction. It does not always hold.",
      "body": "You bring a point of view to [initiative], and then the same decision comes back a month later, because a trade-off stayed unnamed or a stakeholder family was never in the room. This is the band the cohort is built for: one real decision a week, tested until it holds.",
      "next": "This is the band the cohort is built for. Bring the decision on [initiative] that keeps coming back and we test it until it holds."
    },
    "strategic": {
      "headline": "Your framing travels. Now make it compound.",
      "body": "People repeat your direction for [initiative] back to you close to intact, and your trade-offs mostly stay decided. What is left is consistency across rooms and the one dimension that scored lowest. That is usually where a senior PM's next level lives.",
      "next": "The cohort gives you six weeks of pressure on your lowest dimension, from peers who will not let a trade-off stay vague. If 1:1 work is what you are after, book the review and we decide together."
    },
    "leader": {
      "headline": "You create gravity. The question is your team.",
      "body": "Your answers on [initiative] describe someone whose direction holds without them in the room. At this level the leverage is in the PMs around you, and whether they can do what you just did.",
      "next": "Take a seat, or send a PM on your team who should take this score. I run the same method with product teams; the review call is where we scope that."
    }
  },
  "dimensionCopy": {
    "orient": "Orient is setting the direction before anyone hands you one. Your answers say the direction for [initiative] is a theme more than a choice. A choice rules something out. Try writing it again with the sentence \"which means we are not\" in the middle.",
    "reframe": "Reframe is changing how the room sees the problem without winning an argument. Your answers say you tend to answer the question as asked. Next time a stakeholder pushes, write down their frame in their words before you respond, and name who loses if the frame changes.",
    "balance": "Balance is saying what you are choosing against, before someone makes you. Your answers say your trade-offs on [initiative] have one real option in them. Write option B so a sane peer would pick it, then say plainly what you are not doing and who wanted it.",
    "integrate": "Integrate is carrying every function in one plan instead of winning each conversation separately. Your answers say one stakeholder family (usually finance or legal) meets [initiative] late. Ask each of them this week what would stop the launch.",
    "transmit": "Transmit is making the framing simple enough to travel without you. Your answers say the strategy for [initiative] lives in your head or in the features. Write the two-minute version, then have someone repeat it back and rewrite from what they got wrong."
  },
  "copy": {
    "intro": {
      "eyebrow": "For senior PMs who own a roadmap",
      "h1": "How does your judgment hold up when it's your roadmap on the line?",
      "p": "Twelve questions about the initiative you actually own, scored against the five behaviors I see in PMs with real pull in their orgs: Orient, Reframe, Balance, Integrate, Transmit. You get a score out of 30, your weakest dimension, and a two-minute note from me for where you landed.",
      "muted": "About four minutes. Every option is something a good PM would do, so answer with what happened, not what you'd like to have done."
    },
    "setupLabel": "The initiative, in a few words",
    "setupError": "A few words is enough, but I need something to write the questions around.",
    "gate": {
      "h2": "Where should I send your note?",
      "p": "Your score and the full breakdown show on the next screen. I read every submission and send one short note on where you landed. No automated sequence, and you can reply."
    },
    "scoring": {
      "h2": "Scoring your answers",
      "p": "Reading your two sentences against the rubric. Ten seconds or so."
    },
    "results": {
      "eyebrow": "Your Product Sense Score",
      "videoH3": "Two minutes from me on the {band} band",
      "videoP": "What this band looks like in a planning meeting, the move to try this week, and what I'd do next.",
      "weakestLabel": "Weakest dimension",
      "sentencesH3": "Your two sentences",
      "nextH3": "What I'd do next"
    },
    "meta": {
      "description": "Twelve questions about the initiative you own, scored against the five ORBIT behaviors. Four minutes. From Josh Atlas, Product Management Circle.",
      "ogDescription": "How does your judgment hold up when it's your roadmap on the line? Four minutes, scored."
    },
    "brand": {
      "name": "Product Sense Score",
      "by": "Josh Atlas · Product Management Circle"
    },
    "promptContext": "Their initiative"
  }
};
const hbs = {
  "slug": "hours-back-score",
  "title": "Hours Back Score",
  "token": "[task]",
  "kitPrefix": "hbs",
  "version": "2026-10-01",
  "dimensions": [
    "visibility",
    "inputs",
    "rules",
    "reuse",
    "judgment"
  ],
  "dimensionNames": {
    "visibility": "Visibility",
    "inputs": "Inputs",
    "rules": "Rules",
    "reuse": "Reuse",
    "judgment": "Judgment"
  },
  "bands": [
    {
      "id": "byhand",
      "min": 0,
      "max": 11,
      "name": "By hand",
      "tagline": "Everything runs through you, every time"
    },
    {
      "id": "adhoc",
      "min": 12,
      "max": 18,
      "name": "Ad hoc",
      "tagline": "AI helps when you remember to ask it"
    },
    {
      "id": "systematic",
      "min": 19,
      "max": 25,
      "name": "Systematic",
      "tagline": "You have pieces of a workflow. It isn't one yet"
    },
    {
      "id": "operator",
      "min": 26,
      "max": 30,
      "name": "Operator",
      "tagline": "You run a system. The question is what's next"
    }
  ],
  "setup": [
    {
      "id": "role",
      "prompt": "Which is closest to your situation?",
      "options": [
        {
          "id": "multi_pm",
          "text": "PM with more than one product or area"
        },
        {
          "id": "single_pm",
          "text": "PM with one product"
        },
        {
          "id": "lead",
          "text": "I manage PMs"
        },
        {
          "id": "founder",
          "text": "Founder doing the PM work"
        },
        {
          "id": "other",
          "text": "Something else"
        }
      ]
    },
    {
      "id": "initiative",
      "prompt": "What's the recurring task that eats your week?",
      "placeholder": "the weekly status update across three products",
      "fallback": "that task",
      "help": "One task that comes back every week or every month: the status update, the PRD you draft again, the feedback you still haven't sorted, the QBR pack. Name it the way you'd say it to a peer at another company, in a few words, with no codenames, customer names or numbers. Your words drop into the questions so they're about your actual week.",
      "maxLength": 80,
      "privacy": "It's stored with your score and nothing else. Two later questions ask for a sentence; an AI model scores those against my rubric and nothing is used for training. Email me any time and I'll delete all of it."
    }
  ],
  "instruction": "These ask what actually happens, not what you'd like to happen. If a situation hasn't come up with [task] yet, pick what you'd most likely do.",
  "questions": [
    {
      "id": "q1",
      "dimension": "visibility",
      "prompt": "If I asked how many hours you spent on [task] last month, what could you tell me?",
      "options": [
        {
          "text": "A close estimate. I know roughly where it lands.",
          "score": 2
        },
        {
          "text": "It varies too much month to month to put a number on.",
          "score": 1
        },
        {
          "text": "A number. I've tracked it, at least once.",
          "score": 3
        },
        {
          "text": "I've never thought of it as one task. It's just part of the job.",
          "score": 0
        }
      ]
    },
    {
      "id": "q2",
      "dimension": "inputs",
      "prompt": "Where do the inputs for [task] live right now?",
      "options": [
        {
          "text": "In a few places. I gather them myself each time so nothing gets missed.",
          "score": 1
        },
        {
          "text": "In one place I could point a tool at: a doc, a tracker, a folder.",
          "score": 3
        },
        {
          "text": "Mostly in my head, which is faster than writing it all down.",
          "score": 0
        },
        {
          "text": "In a couple of known places, and I copy them into one doc before I start.",
          "score": 2
        }
      ]
    },
    {
      "id": "q3",
      "dimension": "inputs",
      "prompt": "The last time you worked on [task], how did you start?",
      "options": [
        {
          "text": "From last time's version, edited.",
          "score": 2
        },
        {
          "text": "From a blank page, so it stays fresh and honest.",
          "score": 0
        },
        {
          "text": "From a template or checklist I keep for it.",
          "score": 3
        },
        {
          "text": "From whatever came in that week, in the order it came in.",
          "score": 1
        }
      ]
    },
    {
      "id": "q4",
      "dimension": "rules",
      "prompt": "What do you know about your company's rules for using AI tools on work content?",
      "options": [
        {
          "text": "I know which tool is approved. I'm less sure what data is allowed in it.",
          "score": 2
        },
        {
          "text": "I've asked around. Nobody seems sure, so I keep it to non-sensitive stuff.",
          "score": 1
        },
        {
          "text": "I've read the policy. I know the sanctioned tools and what data can go in.",
          "score": 3
        },
        {
          "text": "I haven't looked into it yet.",
          "score": 0
        }
      ]
    },
    {
      "id": "q5",
      "dimension": "rules",
      "prompt": "Who at your company knows you use AI for [task]?",
      "options": [
        {
          "text": "Nobody. It's my edge, and I'd rather not invite questions.",
          "score": 1
        },
        {
          "text": "My manager. I've shown them the output and how it's made.",
          "score": 3
        },
        {
          "text": "A couple of peers I trust.",
          "score": 2
        },
        {
          "text": "I don't use AI for [task] yet.",
          "score": 0
        }
      ]
    },
    {
      "id": "q6",
      "dimension": "reuse",
      "prompt": "The last time a prompt worked well for something like [task], what happened to it?",
      "options": [
        {
          "text": "I rewrote it from memory the next time. It's usually close enough.",
          "score": 1
        },
        {
          "text": "It's in the chat history. I scroll back and find it.",
          "score": 2
        },
        {
          "text": "I saved it as a reusable prompt, template, project or skill.",
          "score": 3
        },
        {
          "text": "I don't reuse prompts. Each week is different.",
          "score": 0
        }
      ]
    },
    {
      "id": "q7",
      "dimension": "reuse",
      "prompt": "How much of [task] does a tool do before you touch it?",
      "options": [
        {
          "text": "It helps with pieces when I ask: a summary here, a rewording there.",
          "score": 2
        },
        {
          "text": "None. I do it by hand, and honestly that's faster.",
          "score": 0
        },
        {
          "text": "It produces a first draft from the inputs. I edit and decide.",
          "score": 3
        },
        {
          "text": "I use it to check my work after I've done it.",
          "score": 1
        }
      ]
    },
    {
      "id": "q8",
      "dimension": "judgment",
      "prompt": "The last AI draft you used for something like [task]: how did you decide it was good enough?",
      "options": [
        {
          "text": "Read it through. It sounded right.",
          "score": 1
        },
        {
          "text": "Checked it against what the reader needs to decide, and fixed what was missing.",
          "score": 3
        },
        {
          "text": "Compared it to the last version I'd done by hand.",
          "score": 2
        },
        {
          "text": "Sent it. The reader would tell me if something was off.",
          "score": 0
        }
      ]
    }
  ],
  "written": [
    {
      "id": "w1",
      "dimension": "visibility",
      "prompt": "In one sentence, describe [task] the way you'd hand it to a new hire: what goes in, what comes out, and who reads it.",
      "placeholder": "Every Friday I pull the three product trackers and last week's escalations into a one-page update that the VP of Product reads before her Monday staff meeting.",
      "maxLength": 240,
      "rubric": [
        {
          "score": 3,
          "text": "Names the inputs, the output, and who consumes it (or what decision it feeds). Someone else could start from this sentence."
        },
        {
          "score": 2,
          "text": "Two of the three: inputs and output, or output and reader, but one is missing."
        },
        {
          "score": 1,
          "text": "One of the three, or all three so vaguely that a new hire would have to ask."
        },
        {
          "score": 0,
          "text": "A label, not a description (\"the weekly update\"), or blank."
        }
      ],
      "examples": [
        {
          "score": 3,
          "text": "Every Friday I pull the three product trackers and last week's escalations into a one-page update that the VP of Product reads before her Monday staff meeting."
        },
        {
          "score": 2,
          "text": "I turn the trackers and the escalation list into a one-page status update every Friday."
        },
        {
          "score": 1,
          "text": "I write the weekly status update for leadership."
        },
        {
          "score": 0,
          "text": "The weekly update."
        }
      ],
      "heuristic": [
        "\\b(inputs?|pull|from|data|notes?|tracker|dashboard|tickets?|transcripts?|feedback|escalations?|numbers|sources?|spreadsheet|sheet|crm|jira|slack|meeting)\\b",
        "\\b(outputs?|report|update|doc|document|deck|summary|email|page|prd|memo|brief|list|hit list|turn (it|them|that) into|produce|write up|writeup)\\b",
        "\\b(reads?|read by|for the|to the|goes to|sent to|send(s)? (it|them)? ?to|manager|lead|vp|director|exec|leadership|stakeholders?|team|customer|analytics|engineering|eng|cfo|ceo|board|head of)\\b"
      ]
    },
    {
      "id": "w2",
      "dimension": "judgment",
      "prompt": "In one sentence, what would make you reject an AI draft of [task]?",
      "placeholder": "If it reports a date or a number without the source I can check it against, or if it buries the one risk my VP actually needs to see.",
      "maxLength": 240,
      "rubric": [
        {
          "score": 3,
          "text": "A specific, checkable criterion tied to the reader or the decision the output feeds (a missing risk, an unsourced number, a recommendation the reader can't act on)."
        },
        {
          "score": 2,
          "text": "A specific, checkable criterion, but not tied to the reader or decision (\"if it invents a number\")."
        },
        {
          "score": 1,
          "text": "A general quality statement (\"if it's inaccurate,\" \"if it doesn't sound like me\")."
        },
        {
          "score": 0,
          "text": "\"I'd know it when I see it,\" no criterion, or blank."
        }
      ],
      "examples": [
        {
          "score": 3,
          "text": "If it states a delivery date without the tracker line I can check it against, or hides the one risk my VP needs to see before her staff meeting."
        },
        {
          "score": 2,
          "text": "If it makes up a number or a date that isn't in the inputs."
        },
        {
          "score": 1,
          "text": "If it's inaccurate or doesn't sound like me."
        },
        {
          "score": 0,
          "text": "I'd know it when I read it."
        }
      ],
      "heuristic": [
        "\\b(number|numbers|%|percent|date|figure|metric|risk|source|sourced|unsourced|invent|invented|made up|makes up|hallucinat\\w*|fabricat\\w*|wrong|inaccurate|mismatch|doesn't match|match|exact|exactly|accurate|accuracy|missing|misses|miss|omits?|leaves out|unsupported|cites?|citation|context)\\b",
        "\\b(reader|readers|the person|my (manager|vp|director|lead|team)|stakeholders?|decision|act on|can't act|cannot act|needs to see|needs to know|why|because|reason|before (the|her|his|their) )\\b"
      ]
    }
  ],
  "bandCopy": {
    "byhand": {
      "headline": "Everything runs through you, every time.",
      "body": "Your answers on [task] describe work that starts from scratch, lives in your head or your inbox, and gets done by hand because that feels faster. It is faster, once. The cost is that it never gets cheaper, and every week it competes with the work only you can do.",
      "next": "You have the most hours to get back and the shortest path, because nothing has to be undone. One task, mapped, with its inputs in one place before any tool touches it."
    },
    "adhoc": {
      "headline": "AI helps when you remember to ask it.",
      "body": "You use a tool on [task] the way most PMs do: pieces, when you think of it, with a prompt you rewrite each time. The hours come back in small change. Nothing compounds, because nothing is saved, measured, or checked against what the reader needs.",
      "next": "After that, the job is to make one of those pieces a workflow you keep: a saved prompt or skill, a check you can name, and the hours counted before and after, so the gains compound instead of resetting every week."
    },
    "systematic": {
      "headline": "You have pieces of a workflow. It isn't one yet.",
      "body": "You've saved what works, you know roughly what [task] costs, and you know the rules you're working inside. What's missing is the part that makes it a system: the inputs feeding it without you, and a stated bar the draft has to clear before it's yours.",
      "next": "After that, finish the system: inputs that feed [task] without you, a written bar the draft has to clear, and a before-and-after hours count you'd stand behind. Then it runs without you babysitting it."
    },
    "operator": {
      "headline": "You run a system. The question is what's next.",
      "body": "Your answers on [task] describe a workflow with inputs, reuse, a named check, and someone else who knows it exists. That puts you ahead of most PMs I talk to. The leverage now is the next task, and the PMs around you who are still doing this by hand.",
      "next": "The leverage now is your second-worst task, or the PMs around you still doing this by hand. The same method works for a team, inside the company's rules."
    }
  },
  "dimensionCopy": {
    "visibility": "Visibility is knowing what [task] costs and what it's for. Your answers say it's part of the job rather than a thing with hours and a reader. Write the one-sentence handoff (what goes in, what comes out, who reads it) and time it once. That sentence is the spec for everything after.",
    "inputs": "Inputs are where the raw material for [task] lives before you start. Your answers say it's scattered, or in your head, so every run starts with a hunt. Put the inputs in one place a tool could read (a doc, a tracker, a folder), even if you keep doing the task by hand for now. The hunt is where most of the hours go.",
    "rules": "Rules are your company's policy on AI tools and data, and who knows what you're doing. Your answers say you're working in a grey area or alone. Find the policy, in writing, and show one person the output. A workflow nobody knows about can't be kept, and one that breaks policy is worse than none.",
    "reuse": "Reuse is whether anything you build for [task] survives to next week. Your answers say prompts get rewritten and drafts start from scratch. Save the prompt that worked as a template, project, or skill, and start the next run from it. That is the difference between help and a system.",
    "judgment": "Judgment is the check a draft of [task] has to pass before it's yours. Your answers say the check is \"it sounds right.\" Write down what would make you reject a draft, in terms of what the reader needs. A workflow without that sentence produces confident wrong things faster."
  },
  "copy": {
    "intro": {
      "eyebrow": "For PMs running more than one thing",
      "h1": "Where do your hours go?",
      "p": "Twelve questions about one recurring task in your week, scored on the five things that decide whether AI gives you hours back or just another tool to check: Visibility, Inputs, Rules, Reuse, Judgment. You get a score out of 30, the dimension that's costing you most, and a short note from me for where you landed.",
      "muted": "About four minutes. Every option is something a busy PM actually does, so answer with what happens, not what you'd like to happen."
    },
    "setupLabel": "The task, in a few words",
    "setupError": "A few words is enough, but I need one task to write the questions around.",
    "gate": {
      "h2": "Where should I send your note?",
      "p": "Your score and the full breakdown show on the next screen. I read every submission and send one short note on where you landed. No automated sequence, and you can reply."
    },
    "scoring": {
      "h2": "Scoring your answers",
      "p": "Reading your two sentences against the rubric. Ten seconds or so."
    },
    "results": {
      "eyebrow": "Your Hours Back Score",
      "videoH3": "Two minutes from me on the {band} band",
      "videoP": "What this band looks like on a Tuesday, the one move to try this week, and what I'd do next.",
      "weakestLabel": "Costing you most",
      "sentencesH3": "Your two answers, scored",
      "nextH3": "What I'd do next",
      "framing": "A readout on one task, [task]: where AI is already giving you hours back, where it isn't yet, and where a four-week pilot would start."
    },
    "meta": {
      "description": "Twelve questions about one recurring task in your week, scored on whether AI can give you hours back. Four minutes. From Josh Atlas, Product Management Circle.",
      "ogDescription": "Where do your hours go? Four minutes, scored."
    },
    "brand": {
      "name": "Hours Back Score",
      "by": "Josh Atlas · Product Management Circle"
    },
    "promptContext": "The PM's recurring task"
  },
  "dimensionNext": {
    "visibility": "This week: write the one-sentence handoff for [task] and time the next run, start to finish. Until it has hours and a reader, there is nothing to get back.",
    "inputs": "This week: put everything [task] draws on into one place a tool could read, even if you keep doing the task by hand. Most of the hours are in the hunt, so that alone moves the number.",
    "rules": "This week: find your company's written policy on AI tools and work content, and show one person the output of your next run. A workflow nobody knows about can't survive you, and one outside policy is a liability.",
    "reuse": "This week: take the prompt that worked for [task] and save it as a template, project or skill, then start the next run from it instead of from memory. That one habit is the difference between help and a system.",
    "judgment": "This week: write down, in one line, what would make you reject a draft of [task], in terms of what the reader needs. Then check the next draft against that line before you read it for tone."
  }
};

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

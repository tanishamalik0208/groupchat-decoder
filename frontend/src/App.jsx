import { useEffect, useMemo, useRef, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const DEMOS = {
  project: {
    id: "project",
    label: "Project Team",
    icon: "⌁",
    description: "A software project coordination chat",
    text: `Aarav: We need to finish the authentication module this week.
Priya: I'll handle the frontend login screens.
Rohan: I'll take the backend authentication API.
Aarav: Great. Can we have both parts ready by Friday?
Priya: Yes, I'll finish the screens by Thursday evening.
Rohan: Backend should be ready by Friday afternoon.
Meera: Should we use JWT or sessions?
Aarav: Let's use JWT for this project.
Rohan: Agreed. I'll document the API as well.
Priya: I'll also add loading and error states.
Meera: I'll test the complete login flow once both pieces are merged.
Aarav: Perfect. Let's review everything Friday evening.`,
  },

  event: {
    id: "event",
    label: "Event Planning",
    icon: "✦",
    description: "A team organizing a college event",
    text: `Tanvi: We need to finalize the event plan today.
Kabir: I'll handle the auditorium booking.
Ananya: I'll design the poster and social media announcement.
Rahul: We still need someone for registrations.
Tanvi: I'll take registrations.
Kabir: The auditorium is available on Saturday from 10 AM.
Ananya: Should we keep registration free?
Tanvi: Yes, registration will be free.
Rahul: What about refreshments?
Kabir: I'll contact the vendor tomorrow.
Ananya: I'll send the first poster draft by Wednesday.
Tanvi: Great. Let's review everything on Thursday.`,
  },

  hackathon: {
    id: "hackathon",
    label: "Hackathon Team",
    icon: "⚡",
    description: "A fast-moving team preparing a hackathon project",
    text: `Tanisha: We need to lock our hackathon idea tonight.
Arjun: I think the group chat intelligence idea is strong.
Meera: Agreed. We can turn messy chats into actions and decisions.
Kabir: I'll build the FastAPI backend.
Tanisha: I'll work on the React interface.
Arjun: I'll design the analysis logic and demo dataset.
Meera: I'll prepare the presentation and pitch.
Kabir: Should we use an external LLM for the demo?
Tanisha: The demo should work even without API credits.
Arjun: Then let's keep local analysis as the fallback.
Kabir: Good. I'll expose the /analyze endpoint.
Tanisha: I'll make the dashboard show actions, decisions, people and signals.
Meera: We should also add a Judge Demo button so the workflow is reliable.
Arjun: Agreed.
Tanisha: Let's have the first complete version ready tonight.
Meera: I'll test the full flow before the presentation.
Kabir: Backend is ready for integration.
Tanisha: Perfect. We have a plan.`,
  },
};

const EMPTY_RESULT = {
  summary: "",
  tone: {
    label: "Neutral",
    score: 50,
    description: "No analysis yet.",
  },
  collaboration: {
    score: 0,
    label: "Not analyzed",
    description: "Analyze a conversation to generate collaboration insights.",
  },
  conversation_health: {
    score: 0,
    label: "Not analyzed",
    description: "Conversation health will appear here after analysis.",
  },
  topics: [],
  action_items: [],
  people: [],
  decisions: [],
  unresolved_questions: [],
  timeline: [],
  key_messages: [],
  risks: [],
  signals: [],
  insight: "",
  most_active_participant: "",
  privacy_note: "",
  counts: {
    actions: 0,
    decisions: 0,
    people: 0,
    topics: 0,
    unresolved: 0,
    signals: 0,
  },
};

const ANALYSIS_STAGES = [
  {
    title: "Reading conversation",
    detail: "Understanding messages and context",
  },
  {
    title: "Finding decisions",
    detail: "Detecting agreements and commitments",
  },
  {
    title: "Extracting actions",
    detail: "Identifying tasks, owners and deadlines",
  },
  {
    title: "Mapping participants",
    detail: "Understanding people and responsibilities",
  },
  {
    title: "Building intelligence",
    detail: "Generating signals and conversation health",
  },
];

function normalizeResult(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_RESULT };
  }

  return {
    ...EMPTY_RESULT,
    ...raw,
    tone: {
      ...EMPTY_RESULT.tone,
      ...(raw.tone || {}),
    },
    collaboration: {
      ...EMPTY_RESULT.collaboration,
      ...(raw.collaboration || {}),
    },
    conversation_health: {
      ...EMPTY_RESULT.conversation_health,
      ...(raw.conversation_health || {}),
    },
    counts: {
      ...EMPTY_RESULT.counts,
      ...(raw.counts || {}),
    },
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    action_items: Array.isArray(raw.action_items)
      ? raw.action_items
      : [],
    people: Array.isArray(raw.people) ? raw.people : [],
    decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
    unresolved_questions: Array.isArray(raw.unresolved_questions)
      ? raw.unresolved_questions
      : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    key_messages: Array.isArray(raw.key_messages)
      ? raw.key_messages
      : [],
    risks: Array.isArray(raw.risks) ? raw.risks : [],
    signals: Array.isArray(raw.signals) ? raw.signals : [],
  };
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function getPersonName(person) {
  if (typeof person === "string") return person;

  return (
    person?.name ||
    person?.person ||
    person?.participant ||
    person?.author ||
    "Unknown"
  );
}

function getActionText(action) {
  if (typeof action === "string") return action;

  return (
    action?.task ||
    action?.action ||
    action?.description ||
    action?.text ||
    "Action item"
  );
}

function getDecisionText(decision) {
  if (typeof decision === "string") return decision;

  return (
    decision?.decision ||
    decision?.description ||
    decision?.text ||
    "Decision"
  );
}

function getTopicText(topic) {
  if (typeof topic === "string") return topic;

  return topic?.name || topic?.topic || topic?.label || "Topic";
}

function scoreValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function localAnalyze(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const participants = [];

  for (const line of lines) {
    const match = line.match(/^([^:]{1,40}):/);

    if (match && !participants.includes(match[1].trim())) {
      participants.push(match[1].trim());
    }
  }

  const lower = text.toLowerCase();

  const decisions = [];
  const actions = [];
  const unresolved = [];
  const signals = [];

  lines.forEach((line) => {
    const low = line.toLowerCase();

    if (
      low.includes("agreed") ||
      low.includes("let's use") ||
      low.includes("lets use") ||
      low.includes("we'll use") ||
      low.includes("decision")
    ) {
      decisions.push({
        decision: line.replace(/^[^:]{1,40}:\s*/, ""),
        owner: line.match(/^([^:]{1,40}):/)?.[1] || "",
      });
    }

    if (
      low.includes("i'll") ||
      low.includes("i will") ||
      low.includes("i’m") ||
      low.includes("im going to") ||
      low.includes("i'm going to")
    ) {
      actions.push({
        task: line.replace(/^[^:]{1,40}:\s*/, ""),
        assignee: line.match(/^([^:]{1,40}):/)?.[1] || "",
        status: "pending",
      });
    }

    if (
      line.includes("?") &&
      !low.startsWith("should we")
    ) {
      unresolved.push(line.replace(/^[^:]{1,40}:\s*/, ""));
    }
  });

  const questionCount = (text.match(/\?/g) || []).length;

  if (questionCount > 0) {
    signals.push({
      type: "open_questions",
      label: `${questionCount} question${
        questionCount === 1 ? "" : "s"
      } detected`,
      severity: questionCount > 2 ? "medium" : "low",
      description:
        "Questions may need explicit resolution before the team can move forward.",
    });
  }

  if (actions.length > 0) {
    signals.push({
      type: "action_density",
      label: "Action-oriented conversation",
      severity: "low",
      description:
        "The conversation contains concrete commitments and next steps.",
    });
  }

  if (decisions.length > 0) {
    signals.push({
      type: "decision",
      label: "Decisions detected",
      severity: "low",
      description:
        "The team appears to be converting discussion into concrete decisions.",
    });
  }

  const summary =
    participants.length > 0
      ? `The conversation involves ${participants.length} participant${
          participants.length === 1 ? "" : "s"
        } and contains ${actions.length} apparent action item${
          actions.length === 1 ? "" : "s"
        }, ${decisions.length} decision${
          decisions.length === 1 ? "" : "s"
        }, and ${questionCount} question${
          questionCount === 1 ? "" : "s"
        }.`
      : "The conversation contains several discussion points that can be organized into actions, decisions and signals.";

  const collaborationScore = Math.min(
    96,
    55 +
      participants.length * 5 +
      actions.length * 4 +
      decisions.length * 4
  );

  const healthScore = Math.min(
    96,
    60 +
      decisions.length * 7 +
      actions.length * 5 -
      unresolved.length * 3
  );

  return normalizeResult({
    summary,
    tone: {
      label:
        decisions.length + actions.length > questionCount
          ? "Constructive"
          : "Mixed",
      score: Math.min(
        95,
        55 + decisions.length * 5 + actions.length * 3
      ),
      description:
        "The conversation shows a mix of discussion, coordination and concrete next steps.",
    },
    collaboration: {
      score: collaborationScore,
      label:
        collaborationScore >= 80
          ? "Strong collaboration"
          : "Developing collaboration",
      description:
        "Participants are contributing ideas and moving toward concrete outcomes.",
    },
    conversation_health: {
      score: healthScore,
      label:
        healthScore >= 80
          ? "Healthy"
          : healthScore >= 65
            ? "Mostly healthy"
            : "Needs attention",
      description:
        unresolved.length > 0
          ? "The conversation has useful progress, with some unresolved questions remaining."
          : "The conversation shows clear progress with relatively few unresolved issues.",
    },
    topics: [
      ...new Set(
        [
          lower.includes("backend") ? "Backend" : null,
          lower.includes("frontend") ? "Frontend" : null,
          lower.includes("api") ? "API" : null,
          lower.includes("hackathon") ? "Hackathon" : null,
          lower.includes("project") ? "Project" : null,
          lower.includes("event") ? "Event planning" : null,
          lower.includes("deadline") ||
          lower.includes("friday") ||
          lower.includes("thursday")
            ? "Deadlines"
            : null,
        ].filter(Boolean)
      ),
    ],
    action_items: actions,
    people: participants.map((name, index) => ({
      name,
      role: index === 0 ? "Coordinator" : "Participant",
      messages: lines.filter((line) =>
        line.startsWith(`${name}:`)
      ).length,
    })),
    decisions,
    unresolved_questions: unresolved,
    timeline: lines.slice(-6).map((message, index) => ({
      title: `Conversation event ${index + 1}`,
      description: message,
    })),
    key_messages: lines.slice(0, 5),
    risks:
      unresolved.length > 0
        ? [
            {
              label: "Unresolved questions",
              severity: "medium",
              description:
                "Some questions may need explicit answers before execution.",
            },
          ]
        : [],
    signals,
    insight:
      actions.length > 0 && decisions.length > 0
        ? "This conversation is moving beyond discussion into execution: people are taking ownership while the team records decisions."
        : "The conversation contains useful coordination signals that can be structured into clearer next steps.",
    most_active_participant:
      participants[0] || "No participant detected",
    privacy_note:
      "Local analysis is available without requiring an external AI API.",
    counts: {
      actions: actions.length,
      decisions: decisions.length,
      people: participants.length,
      topics: [
        ...new Set(
          [
            lower.includes("backend") ? "Backend" : null,
            lower.includes("frontend") ? "Frontend" : null,
            lower.includes("api") ? "API" : null,
            lower.includes("hackathon") ? "Hackathon" : null,
            lower.includes("project") ? "Project" : null,
            lower.includes("event") ? "Event planning" : null,
          ].filter(Boolean)
        ),
      ].length,
      unresolved: unresolved.length,
      signals: signals.length,
    },
  });
}

function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className="toast" role="status">
      <span className="toast-icon">
        {toast.type === "error" ? "!" : "✓"}
      </span>

      <div>
        <strong>{toast.title}</strong>
        {toast.message && <span>{toast.message}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div className="section-title">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function ScoreRing({ score = 0, label, small = false }) {
  const safeScore = scoreValue(score);

  return (
    <div
      className={`score-ring ${small ? "score-ring-small" : ""}`}
      style={{
        "--score": `${safeScore * 3.6}deg`,
      }}
    >
      <div className="score-ring-inner">
        <strong>{safeScore}</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, detail }) {
  return (
    <div className="metric-card interactive-card">
      <div className="metric-top">
        <span className="metric-icon">{icon}</span>
        <span className="metric-label">{label}</span>
      </div>

      <strong className="metric-value">{value}</strong>

      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  );
}

function EmptyState({ icon = "○", title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function Overview({ result }) {
  const topics = result.topics || [];
  const counts = result.counts || {};

  return (
    <div className="dashboard-content dashboard-overview">
      <div className="overview-grid">
        <div className="summary-card primary-card">
          <div className="card-heading">
            <span className="card-icon">✦</span>
            <div>
              <span className="card-eyebrow">EXECUTIVE SUMMARY</span>
              <h3>What happened?</h3>
            </div>
          </div>

          <p className="summary-text">
            {result.summary ||
              "No summary was generated for this conversation."}
          </p>

          {result.insight && (
            <div className="insight-callout">
              <span>◈</span>
              <div>
                <strong>Decoder insight</strong>
                <p>{result.insight}</p>
              </div>
            </div>
          )}
        </div>

        <div className="health-card">
          <div className="card-heading">
            <span className="card-icon">◉</span>
            <div>
              <span className="card-eyebrow">CONVERSATION HEALTH</span>
              <h3>
                {result.conversation_health?.label ||
                  "Not analyzed"}
              </h3>
            </div>
          </div>

          <div className="health-score-row">
            <ScoreRing
              score={result.conversation_health?.score}
              label="health"
            />

            <div>
              <p>
                {result.conversation_health?.description ||
                  "Analyze a conversation to see its health."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          icon="✓"
          label="Actions"
          value={counts.actions || 0}
          detail="tasks detected"
        />
        <MetricCard
          icon="◆"
          label="Decisions"
          value={counts.decisions || 0}
          detail="decisions detected"
        />
        <MetricCard
          icon="◎"
          label="People"
          value={counts.people || 0}
          detail="participants"
        />
        <MetricCard
          icon="#"
          label="Topics"
          value={counts.topics || topics.length || 0}
          detail="themes detected"
        />
      </div>

      <div className="overview-grid">
        <div className="collaboration-card">
          <div className="card-heading">
            <span className="card-icon">↗</span>
            <div>
              <span className="card-eyebrow">COLLABORATION</span>
              <h3>
                {result.collaboration?.label ||
                  "Not analyzed"}
              </h3>
            </div>
          </div>

          <div className="collaboration-layout">
            <ScoreRing
              score={result.collaboration?.score}
              label="score"
            />

            <p>
              {result.collaboration?.description ||
                "Collaboration insights will appear after analysis."}
            </p>
          </div>
        </div>

        <div className="tone-card">
          <div className="card-heading">
            <span className="card-icon">◌</span>
            <div>
              <span className="card-eyebrow">CONVERSATION TONE</span>
              <h3>{result.tone?.label || "Neutral"}</h3>
            </div>
          </div>

          <div className="tone-bar">
            <div
              className="tone-fill"
              style={{
                width: `${scoreValue(result.tone?.score)}%`,
              }}
            />
          </div>

          <p>
            {result.tone?.description ||
              "Tone information will appear here."}
          </p>
        </div>
      </div>

      <div className="topic-card">
        <div className="card-heading">
          <span className="card-icon">#</span>
          <div>
            <span className="card-eyebrow">TOPIC MAP</span>
            <h3>Conversation themes</h3>
          </div>
        </div>

        {topics.length > 0 ? (
          <div className="topic-list">
            {topics.map((topic, index) => (
              <span
                className="topic-pill"
                key={`${getTopicText(topic)}-${index}`}
              >
                #{getTopicText(topic)}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="#"
            title="No topics detected"
            description="The analyzer did not identify distinct topics."
          />
        )}
      </div>
    </div>
  );
}

function ActionList({ result }) {
  const actions = result.action_items || [];

  if (!actions.length) {
    return (
      <EmptyState
        icon="✓"
        title="No action items detected"
        description="Concrete tasks will appear here when the conversation contains commitments."
      />
    );
  }

  return (
    <div className="list-stack">
      {actions.map((action, index) => (
        <div className="list-card action-list-card" key={index}>
          <div className="list-number">{String(index + 1).padStart(2, "0")}</div>

          <div className="list-main">
            <strong>{getActionText(action)}</strong>

            <div className="list-meta">
              {action?.assignee && (
                <span>◉ {safeText(action.assignee)}</span>
              )}

              {action?.deadline && (
                <span>◷ {safeText(action.deadline)}</span>
              )}

              {action?.status && (
                <span className="status-pill">
                  {safeText(action.status)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PeopleList({ result }) {
  const people = result.people || [];

  if (!people.length) {
    return (
      <EmptyState
        icon="◎"
        title="No participants detected"
        description="People and roles will appear here after analysis."
      />
    );
  }

  return (
    <div className="people-grid">
      {people.map((person, index) => (
        <div className="person-card" key={index}>
          <div className="avatar">
            {getPersonName(person).charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{getPersonName(person)}</strong>

            {person?.role && (
              <span>{safeText(person.role)}</span>
            )}

            {person?.messages !== undefined && (
              <small>
                {person.messages} message
                {person.messages === 1 ? "" : "s"}
              </small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionList({ result }) {
  const decisions = result.decisions || [];

  if (!decisions.length) {
    return (
      <EmptyState
        icon="◆"
        title="No decisions detected"
        description="Detected agreements and choices will appear here."
      />
    );
  }

  return (
    <div className="list-stack">
      {decisions.map((decision, index) => (
        <div className="list-card decision-card" key={index}>
          <div className="decision-mark">✓</div>

          <div className="list-main">
            <strong>{getDecisionText(decision)}</strong>

            {decision?.owner && (
              <div className="list-meta">
                <span>Decision by {safeText(decision.owner)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline({ result }) {
  const timeline = result.timeline || [];

  if (!timeline.length) {
    return (
      <EmptyState
        icon="◷"
        title="No timeline available"
        description="Important conversation events will appear here."
      />
    );
  }

  return (
    <div className="timeline">
      {timeline.map((item, index) => (
        <div className="timeline-item" key={index}>
          <div className="timeline-dot" />

          <div className="timeline-content">
            <span className="timeline-index">
              {String(index + 1).padStart(2, "0")}
            </span>

            <div>
              <strong>
                {item?.title ||
                  item?.event ||
                  `Conversation event ${index + 1}`}
              </strong>

              <p>
                {item?.description ||
                  item?.text ||
                  safeText(item)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalList({ result }) {
  const signals = [
    ...(result.signals || []),
    ...(result.risks || []).map((risk) => ({
      ...risk,
      type: "risk",
    })),
  ];

  if (!signals.length) {
    return (
      <EmptyState
        icon="!"
        title="No major signals detected"
        description="Risks, open questions and other conversation signals will appear here."
      />
    );
  }

  return (
    <div className="signal-grid">
      {signals.map((signal, index) => (
        <div className="signal-card" key={index}>
          <div className="signal-icon">
            {signal?.type === "risk" ? "!" : "◈"}
          </div>

          <div>
            <div className="signal-title-row">
              <strong>
                {signal?.label ||
                  signal?.title ||
                  signal?.type ||
                  "Signal"}
              </strong>

              {signal?.severity && (
                <span
                  className={`severity ${safeText(
                    signal.severity
                  ).toLowerCase()}`}
                >
                  {safeText(signal.severity)}
                </span>
              )}
            </div>

            <p>
              {signal?.description ||
                signal?.text ||
                "Conversation signal detected."}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard({
  result,
  chat,
  activeTab,
  setActiveTab,
  onCopy,
  onExport,
}) {
  const tabs = [
    ["overview", "Overview"],
    ["actions", "Actions"],
    ["people", "People"],
    ["decisions", "Decisions"],
    ["timeline", "Timeline"],
    ["signals", "Signals"],
  ];

  return (
    <section className="dashboard-section">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">DECODER OUTPUT</span>
          <h2>Conversation intelligence</h2>
          <p>
            Your conversation has been converted into structured
            intelligence.
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCopy}
          >
            <span>⧉</span>
            Copy summary
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onExport}
          >
            <span>↓</span>
            Export JSON
          </button>
        </div>
      </div>

      <div className="dashboard-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`tab-button ${
              activeTab === id ? "active" : ""
            }`}
            key={id}
            onClick={() => setActiveTab(id)}
          >
            {label}

            {id !== "overview" && (
              <span className="tab-count">
                {id === "actions"
                  ? result.action_items.length
                  : id === "people"
                    ? result.people.length
                    : id === "decisions"
                      ? result.decisions.length
                      : id === "timeline"
                        ? result.timeline.length
                        : result.signals.length +
                          result.risks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="dashboard-panel">
        {activeTab === "overview" && (
          <Overview result={result} />
        )}

        {activeTab === "actions" && (
          <div className="dashboard-content">
            <SectionTitle
              eyebrow="ACTION ITEMS"
              title="What needs to happen?"
              description="Tasks extracted from the conversation, including ownership and deadlines when available."
            />
            <ActionList result={result} />
          </div>
        )}

        {activeTab === "people" && (
          <div className="dashboard-content">
            <SectionTitle
              eyebrow="PARTICIPANTS"
              title="Who is involved?"
              description="People detected in the conversation and their apparent roles."
            />
            <PeopleList result={result} />
          </div>
        )}

        {activeTab === "decisions" && (
          <div className="dashboard-content">
            <SectionTitle
              eyebrow="DECISIONS"
              title="What was decided?"
              description="Important agreements and choices detected by the decoder."
            />
            <DecisionList result={result} />
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="dashboard-content">
            <SectionTitle
              eyebrow="TIMELINE"
              title="How did the conversation evolve?"
              description="A structured view of notable conversation events."
            />
            <Timeline result={result} />
          </div>
        )}

        {activeTab === "signals" && (
          <div className="dashboard-content">
            <SectionTitle
              eyebrow="SIGNALS"
              title="What should the team notice?"
              description="Risks, open questions and collaboration signals extracted from the conversation."
            />
            <SignalList result={result} />
          </div>
        )}
      </div>

      <details className="original-conversation">
        <summary>
          <span>View original conversation</span>
          <span>+</span>
        </summary>

        <pre>{chat}</pre>
      </details>
    </section>
  );
}

function App() {
  const [chat, setChat] = useState("");
  const [result, setResult] = useState(EMPTY_RESULT);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeDemo, setActiveDemo] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [toast, setToast] = useState(null);
  const [showLanding, setShowLanding] = useState(true);

  const fileInputRef = useRef(null);
  const stageTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = (title, message = "", type = "success") => {
    setToast({ title, message, type });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (stageTimerRef.current) {
        clearInterval(stageTimerRef.current);
      }

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Click ripple effect.
  useEffect(() => {
    const handleClick = (event) => {
      const target = event.target.closest(
        "button, .demo-card, .interactive-card"
      );

      if (!target || target.disabled) return;

      const rect = target.getBoundingClientRect();

      const ripple = document.createElement("span");
      ripple.className = "click-ripple";

      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;

      target.appendChild(ripple);

      window.setTimeout(() => {
        ripple.remove();
      }, 650);
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const stats = useMemo(
    () => ({
      actions: result.action_items?.length || 0,
      decisions: result.decisions?.length || 0,
      people: result.people?.length || 0,
      signals:
        (result.signals?.length || 0) +
        (result.risks?.length || 0),
    }),
    [result]
  );

  const selectDemo = (demoId) => {
    const demo = DEMOS[demoId];

    if (!demo) return;

    setActiveDemo(demoId);
    setChat(demo.text);
    setHasAnalyzed(false);
    setResult(EMPTY_RESULT);
    setActiveTab("overview");
    setShowLanding(false);

    showToast(
      `${demo.label} loaded`,
      "Conversation is ready to decode."
    );
  };

  const startJudgeDemo = () => {
    const demo = DEMOS.hackathon;

    setActiveDemo("hackathon");
    setChat(demo.text);
    setShowLanding(false);
    setActiveTab("overview");

    window.setTimeout(() => {
      analyzeChat(demo.text, true);
    }, 250);
  };

  const analyzeChat = async (
    providedText = chat,
    isJudgeDemo = false
  ) => {
    const text = providedText.trim();

    if (!text) {
      showToast(
        "Nothing to decode",
        "Paste or load a conversation first.",
        "error"
      );
      return;
    }

    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
    }

    setChat(text);
    setIsAnalyzing(true);
    setHasAnalyzed(false);
    setAnalysisStage(0);
    setActiveTab("overview");
    setShowLanding(false);

    let stage = 0;

    stageTimerRef.current = setInterval(() => {
      stage += 1;

      if (stage < ANALYSIS_STAGES.length) {
        setAnalysisStage(stage);
      }
    }, 520);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();

      // Give the animation enough time to be visible.
      await new Promise((resolve) =>
        setTimeout(resolve, 1050)
      );

      setResult(normalizeResult(data));
    } catch (error) {
      console.warn(
        "Backend unavailable. Using local analysis.",
        error
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 1050)
      );

      setResult(localAnalyze(text));

      showToast(
        "Local decoder active",
        "Analysis completed without an external AI service."
      );
    } finally {
      if (stageTimerRef.current) {
        clearInterval(stageTimerRef.current);
      }

      setAnalysisStage(ANALYSIS_STAGES.length - 1);

      await new Promise((resolve) =>
        setTimeout(resolve, 420)
      );

      setIsAnalyzing(false);
      setHasAnalyzed(true);
      setActiveTab("overview");

      if (isJudgeDemo) {
        showToast(
          "Judge Demo ready",
          "The full intelligence dashboard is ready."
        );
      } else {
        showToast(
          "Analysis complete",
          "Your conversation has been decoded."
        );
      }
    }
  };

  const handleAnalyze = () => {
    analyzeChat(chat);
  };

  const handleCopy = async () => {
    const summary = result.summary || "No summary available.";

    try {
      await navigator.clipboard.writeText(summary);

      showToast(
        "Summary copied",
        "The executive summary is now on your clipboard."
      );
    } catch {
      showToast(
        "Copy unavailable",
        "Your browser blocked clipboard access.",
        "error"
      );
    }
  };

  const handleExport = () => {
    const payload = {
      product: "GroupChat Decoder",
      version: "4.0",
      generated_at: new Date().toISOString(),
      conversation: chat,
      analysis: result,
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      {
        type: "application/json",
      }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "groupchat-decoder-analysis.json";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    showToast(
      "JSON exported",
      "Your structured analysis has been downloaded."
    );
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const supported =
      file.name.toLowerCase().endsWith(".txt") ||
      file.name.toLowerCase().endsWith(".csv");

    if (!supported) {
      showToast(
        "Unsupported file",
        "Please upload a .txt or .csv file.",
        "error"
      );

      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const content = safeText(reader.result);

      setChat(content);
      setActiveDemo("");
      setShowLanding(false);
      setHasAnalyzed(false);
      setResult(EMPTY_RESULT);

      showToast(
        "Conversation imported",
        `${file.name} is ready to decode.`
      );
    };

    reader.onerror = () => {
      showToast(
        "Upload failed",
        "The conversation file could not be read.",
        "error"
      );
    };

    reader.readAsText(file);

    event.target.value = "";
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      <Toast toast={toast} />

      <header className="navbar">
        <button
          type="button"
          className="brand"
          onClick={() => {
            setShowLanding(true);
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>

          <span>
            <strong>GroupChat</strong>
            <em>Decoder</em>
          </span>
        </button>

        <div className="nav-right">
          <span className="version-badge">
            v4.0 Competition Edition
          </span>

          <button
            type="button"
            className="judge-button"
            onClick={startJudgeDemo}
          >
            <span>⚡</span>
            Judge Demo
          </button>
        </div>
      </header>

      {showLanding && !hasAnalyzed && (
        <>
          <main className="hero">
            <div className="hero-copy">
              <div className="hero-badge">
                <span className="live-dot" />
                Conversation intelligence engine
              </div>

              <h1>
                Turn group chat
                <br />
                into <span>structured action.</span>
              </h1>

              <p>
                GroupChat Decoder transforms messy conversations
                into summaries, actions, decisions, people,
                timelines and collaboration signals.
              </p>

              <div className="hero-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    document
                      .getElementById("analyzer")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      });
                  }}
                >
                  Start decoding
                  <span>→</span>
                </button>

                <button
                  type="button"
                  className="ghost-button"
                  onClick={startJudgeDemo}
                >
                  Try Judge Demo
                  <span>↗</span>
                </button>
              </div>

              <div className="hero-proof">
                <span>LOCAL-FIRST</span>
                <i />
                <span>STRUCTURED JSON</span>
                <i />
                <span>FAST ANALYSIS</span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="visual-glow" />

              <div className="decoder-orbit orbit-one" />
              <div className="decoder-orbit orbit-two" />

              <div className="decoder-card">
                <div className="decoder-card-top">
                  <span>DECODER ENGINE</span>
                  <span className="engine-status">
                    <i />
                    READY
                  </span>
                </div>

                <div className="decoder-core">
                  <div className="core-ring">
                    <div className="core-center">GD</div>
                  </div>
                </div>

                <div className="decoder-stream">
                  <div>
                    <span>01</span>
                    <b>Conversation</b>
                    <i>✓</i>
                  </div>
                  <div>
                    <span>02</span>
                    <b>Actions</b>
                    <i>✓</i>
                  </div>
                  <div>
                    <span>03</span>
                    <b>Decisions</b>
                    <i>✓</i>
                  </div>
                  <div>
                    <span>04</span>
                    <b>Signals</b>
                    <i>✓</i>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <section className="how-section">
            <SectionTitle
              eyebrow="HOW IT WORKS"
              title="From conversation to clarity"
              description="One simple workflow turns communication noise into useful team intelligence."
            />

            <div className="flow-grid">
              <div className="flow-card interactive-card">
                <span className="flow-number">01</span>
                <span className="flow-icon">◌</span>
                <h3>Input</h3>
                <p>
                  Paste a group conversation or upload a text
                  file.
                </p>
              </div>

              <div className="flow-connector">→</div>

              <div className="flow-card interactive-card">
                <span className="flow-number">02</span>
                <span className="flow-icon">◎</span>
                <h3>Decode</h3>
                <p>
                  The analysis engine identifies structure,
                  context and signals.
                </p>
              </div>

              <div className="flow-connector">→</div>

              <div className="flow-card interactive-card">
                <span className="flow-number">03</span>
                <span className="flow-icon">✦</span>
                <h3>Act</h3>
                <p>
                  Teams get decisions, tasks and insights they
                  can act on.
                </p>
              </div>
            </div>
          </section>

          <section className="features-section">
            <SectionTitle
              eyebrow="BUILT FOR SIGNAL"
              title="More than a summary"
              description="The decoder extracts the information teams actually need from conversations."
            />

            <div className="feature-grid">
              {[
                [
                  "✦",
                  "Executive summary",
                  "Understand the conversation in seconds.",
                ],
                [
                  "✓",
                  "Action extraction",
                  "Find tasks, owners and deadlines.",
                ],
                [
                  "◆",
                  "Decision detection",
                  "Surface the choices hidden in discussion.",
                ],
                [
                  "◎",
                  "People & roles",
                  "See who is contributing and how.",
                ],
                [
                  "◷",
                  "Timeline",
                  "Follow how the conversation evolved.",
                ],
                [
                  "◈",
                  "Signals",
                  "Detect risks, questions and collaboration patterns.",
                ],
              ].map(([icon, title, description]) => (
                <div
                  className="feature-card interactive-card"
                  key={title}
                >
                  <span className="feature-icon">{icon}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="feature-arrow">↗</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section
        className={`analyzer-section ${
          hasAnalyzed ? "analyzer-with-results" : ""
        }`}
        id="analyzer"
      >
        <div className="analyzer-heading">
          <div>
            <span className="eyebrow">CONVERSATION ANALYZER</span>
            <h2>Give the decoder something to read.</h2>
            <p>
              Paste a conversation, choose a demo, or upload a
              text file.
            </p>
          </div>

          <div className="analyzer-status">
            <span className="status-dot" />
            Local engine available
          </div>
        </div>

        <div className="demo-selector">
          {Object.values(DEMOS).map((demo) => (
            <button
              type="button"
              className={`demo-card ${
                activeDemo === demo.id ? "selected" : ""
              }`}
              key={demo.id}
              onClick={() => selectDemo(demo.id)}
            >
              <span className="demo-icon">{demo.icon}</span>

              <span>
                <strong>{demo.label}</strong>
                <small>{demo.description}</small>
              </span>

              <span className="demo-check">
                {activeDemo === demo.id ? "✓" : "→"}
              </span>
            </button>
          ))}
        </div>

        <div className="input-card">
          <div className="input-toolbar">
            <span>
              <span className="terminal-dot" />
              conversation.input
            </span>

            <div className="input-tools">
              <button
                type="button"
                className="mini-button"
                onClick={() => fileInputRef.current?.click()}
              >
                ↑ Upload .txt / .csv
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={handleFileUpload}
                hidden
              />
            </div>
          </div>

          <textarea
            value={chat}
            onChange={(event) => {
              setChat(event.target.value);
              setActiveDemo("");
              setHasAnalyzed(false);
            }}
            placeholder={`Paste your group conversation here...

Example:
Aarav: I'll handle the backend.
Priya: I'll finish the frontend by Friday.
Rohan: Should we use JWT?
Aarav: Agreed. Let's use JWT.`}
            spellCheck="false"
          />

          <div className="input-footer">
            <span>
              {chat.trim()
                ? `${chat.trim().split(/\s+/).length} words`
                : "Waiting for conversation"}
            </span>

            <button
              type="button"
              className="primary-button analyze-button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="button-spinner" />
                  Decoding...
                </>
              ) : (
                <>
                  Decode conversation
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {hasAnalyzed && (
        <Dashboard
          result={result}
          chat={chat}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onCopy={handleCopy}
          onExport={handleExport}
        />
      )}

      {!hasAnalyzed && (
        <section className="architecture-section">
          <SectionTitle
            eyebrow="UNDER THE HOOD"
            title="Built to be reliable"
            description="The architecture separates the interface, API and intelligence layer so the product stays usable even when external services are unavailable."
          />

          <div className="architecture-flow">
            <div className="architecture-node">
              <span>01</span>
              <strong>React</strong>
              <small>Interactive interface</small>
            </div>

            <div className="architecture-line">→</div>

            <div className="architecture-node">
              <span>02</span>
              <strong>FastAPI</strong>
              <small>Analysis endpoint</small>
            </div>

            <div className="architecture-line">→</div>

            <div className="architecture-node">
              <span>03</span>
              <strong>Analysis Engine</strong>
              <small>Structured intelligence</small>
            </div>

            <div className="architecture-line">→</div>

            <div className="architecture-node">
              <span>04</span>
              <strong>Dashboard</strong>
              <small>Actionable output</small>
            </div>
          </div>

          <div className="reliability-grid">
            <div>
              <span>01</span>
              <strong>Local fallback</strong>
              <p>
                Core analysis can run without external API
                credits.
              </p>
            </div>

            <div>
              <span>02</span>
              <strong>Structured output</strong>
              <p>
                The dashboard is powered by predictable JSON
                data.
              </p>
            </div>

            <div>
              <span>03</span>
              <strong>Optional AI</strong>
              <p>
                External LLM analysis can be enabled when
                available.
              </p>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">
        <div>
          <strong>GroupChat Decoder</strong>
          <span>Conversation → Intelligence → Action</span>
        </div>

        <span>v4.0 Competition Edition</span>
      </footer>

      {isAnalyzing && (
        <div className="analysis-overlay">
          <div className="analysis-modal">
            <div className="analysis-top">
              <span className="eyebrow">DECODER ENGINE</span>
              <span className="analysis-live">
                <i />
                PROCESSING
              </span>
            </div>

            <div className="analysis-core">
              <div className="analysis-orbit orbit-a" />
              <div className="analysis-orbit orbit-b" />
              <div className="analysis-center">
                <span>GD</span>
              </div>
            </div>

            <div className="analysis-copy">
              <h2>
                {ANALYSIS_STAGES[analysisStage]?.title ||
                  "Decoding conversation"}
              </h2>

              <p>
                {ANALYSIS_STAGES[analysisStage]?.detail ||
                  "Turning conversation into structured intelligence."}
              </p>
            </div>

            <div className="analysis-steps">
              {ANALYSIS_STAGES.map((stage, index) => (
                <div
                  className={`analysis-step ${
                    index < analysisStage ? "complete" : ""
                  } ${
                    index === analysisStage ? "current" : ""
                  }`}
                  key={stage.title}
                >
                  <span className="analysis-step-icon">
                    {index < analysisStage
                      ? "✓"
                      : index === analysisStage
                        ? "•"
                        : "○"}
                  </span>

                  <span>{stage.title}</span>
                </div>
              ))}
            </div>

            <div className="analysis-progress">
              <span
                style={{
                  width: `${
                    ((analysisStage + 1) /
                      ANALYSIS_STAGES.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
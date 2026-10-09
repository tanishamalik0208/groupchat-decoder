import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clipboard,
  Command,
  Download,
  FileJson2,
  FileText,
  Fingerprint,
  HelpCircle,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  MessageSquareText,
  Moon,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const MIN_DECODING_MS = 1800;
const NAV_SECTIONS = [
  ["summary", "Overview"],
  ["actions", "Actions"],
  ["people", "People"],
  ["topics", "Topics"],
  ["timeline", "Timeline"],
  ["evidence", "Evidence"],
];
const monotonicNow = () => globalThis.performance.now();

const DEMOS = [
  {
    id: "project",
    label: "Project Team",
    short: "PROJECT",
    description: "A sprint plan with owners, decisions, and deadlines.",
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
  {
    id: "event",
    label: "Event Planning",
    short: "EVENTS",
    description: "A team coordinating a real-world event.",
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
  {
    id: "hackathon",
    label: "Hackathon Team",
    short: "HACKATHON",
    description: "The build crew turning a demo into a plan.",
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
];

const TEXT_KEYS = ["text", "task", "action", "decision", "description", "question", "detail", "message", "name", "label"];

function textOf(value, ...keys) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  for (const key of keys.length ? keys : TEXT_KEYS) {
    if (value[key] !== undefined && value[key] !== null) return String(value[key]);
  }
  return "";
}

function normalizeResult(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    ...data,
    topics: Array.isArray(data.topics) ? data.topics : [],
    actions: Array.isArray(data.actions) ? data.actions : Array.isArray(data.action_items) ? data.action_items : [],
    people: Array.isArray(data.people) ? data.people : [],
    decisions: Array.isArray(data.decisions) ? data.decisions : [],
    questions: Array.isArray(data.unresolved_questions) ? data.unresolved_questions : [],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    keyMessages: Array.isArray(data.key_messages) ? data.key_messages : [],
    risks: Array.isArray(data.risks) ? data.risks : [],
    tone: data.tone && typeof data.tone === "object" ? data.tone : {},
    health: data.health && typeof data.health === "object" ? data.health : data.conversation_health || {},
    collaboration: data.collaboration && typeof data.collaboration === "object" ? data.collaboration : {},
  };
}

function scoreOf(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
}

function statusGroup(action) {
  const status = String(action?.status || "Open").toLowerCase();
  if (/(done|complete|closed|resolved)/.test(status)) return "done";
  if (/(progress|doing|active|started)/.test(status)) return "progress";
  return "todo";
}

function detectedFormat(text) {
  if (/^\s*\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/m.test(text) && / - .+?:/.test(text)) return "WhatsApp export";
  if (/^\s*\d{1,2}:\d{2}\s*(AM|PM)?\s+.+?:/im.test(text)) return "WhatsApp export";
  if (/^\s*<@[^>]+>|^\s*\[[^\]]+\]\s+<@/m.test(text)) return "Slack export";
  return text.trim() ? "Plain text" : "Waiting for input";
}

function findSourceLines(chat, phrase) {
  const lines = chat.split(/\r?\n/).filter((line) => line.trim());
  const needle = String(phrase || "").toLowerCase().trim();
  if (!needle) return [];
  const exact = lines.filter((line) => line.toLowerCase().includes(needle));
  if (exact.length) return exact.slice(0, 5);
  const words = needle.split(/\W+/).filter((word) => word.length > 3);
  if (!words.length) return [];
  return lines
    .map((line) => ({ line, weight: words.filter((word) => line.toLowerCase().includes(word)).length }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((entry) => entry.line);
}

function Badge({ children, tone = "neutral", dot = false }) {
  return <span className={`badge badge-${tone}`}>{dot && <i aria-hidden="true" />}{children}</span>;
}

function GlassCard({ as: Element = "article", className = "", children, ...props }) {
  return <Element className={`glass-card ${className}`} {...props}>{children}</Element>;
}

function GradientButton({ children, className = "", ...props }) {
  return <button className={`gradient-button ${className}`} {...props}>{children}</button>;
}

function Tabs({ label, options, value, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          aria-selected={value === option.value}
          className={value === option.value ? "tab is-active" : "tab"}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Tooltip({ label, children }) {
  return <span className="tooltip-wrap" title={label}>{children}</span>;
}

function AnimatedNumber({ value, suffix = "" }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return <span>{value ?? "—"}</span>;
  return <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>{numeric}{suffix}</motion.span>;
}

function TypewriterText({ text, reducedMotion }) {
  const [visibleText, setVisibleText] = useState(reducedMotion ? text : "");
  useEffect(() => {
    if (reducedMotion) return undefined;
    let position = 0;
    const timer = window.setInterval(() => {
      position = Math.min(position + 4, text.length);
      setVisibleText(text.slice(0, position));
      if (position >= text.length) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [reducedMotion, text]);
  return <><span className="sr-only">{text}</span><span aria-hidden="true">{visibleText}</span></>;
}

function ScoreRing({ score, label, caption, size = 112 }) {
  const value = scoreOf(score);
  const circumference = 2 * Math.PI * 43;
  const tone = value === null ? "neutral" : value >= 70 ? "good" : value >= 40 ? "warning" : "risk";
  return (
    <div className={`score-ring score-${tone}`} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value === null ? "not scored" : `${value} out of 100`}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="score-ring-track" cx="50" cy="50" r="43" />
        {value !== null && <motion.circle className="score-ring-value" cx="50" cy="50" r="43" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - value / 100) }} transition={{ duration: .85, ease: [.22, .7, .2, 1] }} />}
      </svg>
      <span className="score-ring-value-text">{value === null ? "—" : <AnimatedNumber value={value} />}</span>
      <span className="score-ring-caption">{caption || label}</span>
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

function Toast({ message, onDismiss }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div className="toast" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
          <Check size={16} /><span>{message}</span><button aria-label="Dismiss notification" onClick={onDismiss} type="button"><X size={15} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HighlightedLine({ text, active }) {
  if (!active) return <>{text}</>;
  const terms = active.split(/\W+/).filter((term) => term.length > 3);
  if (!terms.length) return <>{text}</>;
  const expression = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(expression).map((part, index) => terms.some((term) => term.toLowerCase() === part.toLowerCase()) ? <mark key={`${index}-${part}`}>{part}</mark> : part)}</>;
}

function EvidenceDrawer({ evidence, chat, onClose }) {
  const matching = useMemo(() => findSourceLines(chat, evidence), [chat, evidence]);
  const matchingSet = new Set(matching);
  return (
    <motion.div className="drawer-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.aside className="evidence-drawer" aria-labelledby="evidence-title" aria-modal="true" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .25 }} role="dialog">
        <header className="drawer-head"><div><span className="eyebrow">SOURCE CONTEXT</span><h2 id="evidence-title">Evidence drawer</h2></div><button className="icon-button" aria-label="Close evidence drawer" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="drawer-query"><Search size={15} /><span>{evidence}</span></div>
        <p className="drawer-note">{matching.length ? `${matching.length} related source line${matching.length === 1 ? "" : "s"} highlighted from the submitted conversation.` : "No matching source line was identified. Full submitted conversation shown for context."}</p>
        <div className="source-transcript">
          {chat.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => (
            <div className={`source-line${matchingSet.has(line) ? " source-line-match" : ""}`} key={`${index}-${line}`}>
              <span>{String(index + 1).padStart(2, "0")}</span><p><HighlightedLine text={line} active={matchingSet.has(line) ? evidence : ""} /></p>
            </div>
          ))}
        </div>
      </motion.aside>
    </motion.div>
  );
}

function Modal({ title, children, onClose, className = "" }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <motion.div className="modal-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, scale: .97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98, y: 5 }}>
        <header className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose} type="button"><X size={18} /></button></header>
        {children}
      </motion.section>
    </motion.div>
  );
}

function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);
  const filtered = commands.filter((command) => `${command.title} ${command.hint || ""}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop command-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <motion.section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" initial={{ opacity: 0, scale: .98, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98, y: -5 }}>
            <div className="command-search"><Search size={18} /><input ref={inputRef} aria-label="Search commands" placeholder="Search actions, demos, and sections…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div>
            <div className="command-results">{filtered.map((command) => <button key={command.title} type="button" onClick={() => { onClose(); command.run(); }}><span className="command-icon">{command.icon}</span><span>{command.title}<small>{command.hint}</small></span><ArrowRight size={15} /></button>)}{filtered.length === 0 && <p className="empty-state">No matching commands.</p>}</div>
            <footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Run</span><span><kbd>ESC</kbd> Close</span></footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DonutChart({ people }) {
  const palette = ["#8185ff", "#22d3ee", "#34d399", "#f472b6", "#fbbf24", "#a78bfa"];
  const circumference = 2 * Math.PI * 35;
  const segments = people.map((person, index) => ({
    person,
    index,
    share: Math.max(0, Math.min(100, Number(person.share) || 0)),
    offset: people.slice(0, index).reduce((total, previous) => total + Math.max(0, Math.min(100, Number(previous.share) || 0)), 0),
  }));
  return (
    <svg className="people-donut" viewBox="0 0 84 84" role="img" aria-label={`Message share from ${people.length} participants`}>
      <circle cx="42" cy="42" r="35" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
      {segments.map(({ person, index, share, offset }) => {
        const dash = (share / 100) * circumference;
        return <circle key={`${person.name}-${index}`} cx="42" cy="42" r="35" fill="none" stroke={palette[index % palette.length]} strokeWidth="9" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-(offset / 100) * circumference} transform="rotate(-90 42 42)" />;
      })}
      <text x="42" y="40" textAnchor="middle" className="donut-number">{people.length}</text>
      <text x="42" y="51" textAnchor="middle" className="donut-caption">PEOPLE</text>
    </svg>
  );
}

function Dashboard({ result, notice, onToast, onEvidence, onExportJson, onShareImage, onReset, search, setSearch, searchRef, reducedMotion }) {
  const [actionFilter, setActionFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [completedNext, setCompletedNext] = useState([]);
  const q = search.trim().toLowerCase();
  const matches = useCallback((value) => !q || String(value || "").toLowerCase().includes(q), [q]);
  const serialized = (value) => typeof value === "string" ? value : JSON.stringify(value || {});
  const matchesScoped = (value) => {
    const content = serialized(value).toLowerCase();
    return matches(content)
      && (personFilter === "all" || content.includes(personFilter.toLowerCase()))
      && (topicFilter === "all" || content.includes(topicFilter.toLowerCase()));
  };
  const filteredActions = result.actions.filter((action) => {
    const personMatch = personFilter === "all" || String(action?.assignee || "").toLowerCase() === personFilter.toLowerCase();
    const topicMatch = topicFilter === "all" || `${textOf(action)} ${action?.assignee || ""}`.toLowerCase().includes(topicFilter.toLowerCase());
    return personMatch && topicMatch && matchesScoped(action);
  });
  const visiblePeople = result.people.filter((person) => (personFilter === "all" || person.name === personFilter) && matches(`${person.name} ${person.role}`));
  const visibleTopics = result.topics.filter((topic) => (topicFilter === "all" || textOf(topic, "name", "topic") === topicFilter) && matches(textOf(topic, "name", "topic", "label")));
  const visibleQuestions = result.questions.filter(matchesScoped);
  const visibleDecisions = result.decisions.filter(matchesScoped);
  const visibleTimeline = result.timeline.filter(matchesScoped);
  const visibleQuotes = result.keyMessages.filter(matchesScoped);
  const visibleRisks = result.risks.filter(matchesScoped);
  const nextSteps = [
    ...result.actions.filter((action) => statusGroup(action) !== "done").map((action, index) => ({ id: `action-${index}`, text: `${action?.assignee ? `${action.assignee}: ` : ""}${textOf(action, "task", "action", "description", "text")}` })),
    ...result.questions.map((question, index) => ({ id: `question-${index}`, text: `Resolve: ${textOf(question, "question", "text")}` })),
  ];
  const collaborators = result.people.map((person) => `${person.name} ${person.role || ""}`).join(" ");
  const messageCount = result.message_count ?? "—";
  const healthScore = scoreOf(result.health.score);
  const collaborationScore = scoreOf(result.collaboration.score);
  const filtered = Boolean(q || personFilter !== "all" || topicFilter !== "all");

  const copyMarkdown = async () => {
    const lines = [
      "# GroupChat Decoder — Intelligence Brief",
      "",
      result.summary || "No summary was returned by the analyzer.",
      "",
      `- Messages: ${messageCount}`,
      `- Participants: ${result.participant_count ?? result.people.length}`,
      `- Actions: ${result.actions.length}`,
      `- Decisions: ${result.decisions.length}`,
      "",
      "## Action items",
      ...(result.actions.length ? result.actions.map((action) => `- [${action?.status || "Open"}] ${textOf(action, "task", "action", "description", "text")}${action?.assignee ? ` — ${action.assignee}` : ""}${action?.deadline ? ` (${action.deadline})` : ""}`) : ["- None returned"]),
      "",
      "## Decisions",
      ...(result.decisions.length ? result.decisions.map((decision) => `- ${textOf(decision)}`) : ["- None returned"]),
      "",
      "## Open questions",
      ...(result.questions.length ? result.questions.map((question) => `- ${textOf(question)}`) : ["- None returned"]),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      onToast("Markdown brief copied");
    } catch {
      onToast("Clipboard access was blocked by the browser");
    }
  };

  const cardMotion = { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: .12 }, transition: { duration: .38, ease: "easeOut" } };

  return (
    <section className="dashboard-shell" id="dashboard" aria-label="Conversation intelligence dashboard">
      <div className="dashboard-nav">
        <div className="case-title"><span className="case-live" /><span>CASE FILE</span><b>001</b><span className="case-divider" />{result.source || "ANALYZED CONVERSATION"}</div>
        <nav className="dashboard-tabs" aria-label="Dashboard sections">{NAV_SECTIONS.map(([id, label], index) => <a key={id} href={`#${id}`}><kbd>{index + 1}</kbd>{label}</a>)}</nav>
        <button className="new-case-button" onClick={onReset} type="button"><Plus size={15} /> New case</button>
      </div>

      <div className="dashboard-heading">
        <div><span className="eyebrow"><Sparkles size={13} /> STRUCTURED INTELLIGENCE</span><h2>Your conversation,<br /><em>decoded.</em></h2></div>
        <div className="dashboard-heading-tools"><label className="insight-search"><Search size={16} /><input ref={searchRef} aria-label="Search insights" placeholder="Search this report… /" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></label><button className="icon-button" title="Copy Markdown brief" aria-label="Copy Markdown brief" onClick={copyMarkdown} type="button"><Clipboard size={16} /></button><button className="icon-button" title="Export JSON" aria-label="Export JSON" onClick={onExportJson} type="button"><FileJson2 size={16} /></button><button className="icon-button" title="Download summary image" aria-label="Download summary image" onClick={onShareImage} type="button"><Download size={16} /></button><button className="icon-button" title="Print report" aria-label="Print report" onClick={() => window.print()} type="button"><Printer size={16} /></button></div>
      </div>

      <div className="filter-row">
        <span>FILTER REPORT</span>
        <label><Users size={14} /><select aria-label="Filter by person" value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="all">All people</option>{result.people.map((person) => <option key={person.name} value={person.name}>{person.name}</option>)}</select><ChevronDown size={13} /></label>
        <label><Layers3 size={14} /><select aria-label="Filter by topic" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="all">All topics</option>{result.topics.map((topic, index) => <option key={`${textOf(topic, "name", "topic")}-${index}`} value={textOf(topic, "name", "topic")}>{textOf(topic, "name", "topic")}</option>)}</select><ChevronDown size={13} /></label>
        {filtered && <button className="clear-filter" onClick={() => { setSearch(""); setPersonFilter("all"); setTopicFilter("all"); }} type="button"><X size={13} /> Reset filters</button>}
      </div>
      {filtered && <p className="filter-context">Report details are filtered; the executive summary reflects the full analysis.</p>}

      <div className="bento-grid">
        <motion.div className="bento-summary" id="summary" {...cardMotion}>
          <GlassCard className="summary-card">
            <div className="card-topline"><span className="eyebrow"><span className="live-dot" /> EXECUTIVE SUMMARY</span><Badge tone="indigo"><Fingerprint size={12} /> ANALYZED</Badge></div>
            <p className="summary-copy"><TypewriterText text={result.summary || "No summary was returned by the analyzer."} reducedMotion={reducedMotion} /></p>
            {result.insight && <p className="summary-insight"><WandSparkles size={15} />{result.insight}</p>}
            <div className="summary-stat-row">
              {[["MESSAGES", messageCount], ["PEOPLE", result.participant_count ?? result.people.length], ["ACTIONS", result.actions.length], ["DECISIONS", result.decisions.length]].map(([label, value]) => <div className="summary-stat" key={label}><strong><AnimatedNumber value={value} /></strong><span>{label}</span></div>)}
            </div>
            <div className="summary-footer"><span><ShieldCheck size={14} /> {result.privacy_note || "Analysis returned by your configured service."}</span><button className="inline-action" onClick={copyMarkdown} type="button"><Clipboard size={14} /> Copy brief</button></div>
          </GlassCard>
        </motion.div>

        <motion.div className="score-card" {...cardMotion}>
          <GlassCard className="score-panel">
            <div className="card-topline"><span className="eyebrow">COLLABORATION</span><Badge tone={collaborationScore === null ? "neutral" : collaborationScore >= 70 ? "emerald" : collaborationScore >= 40 ? "amber" : "rose"} dot>{result.collaboration.label || "Not scored"}</Badge></div>
            <div className="score-layout"><ScoreRing score={collaborationScore} label="Collaboration score" caption="SCORE" size={118} /><div className="score-copy"><strong>{result.collaboration.label || "Signal unavailable"}</strong><p>{result.collaboration.description || "No collaboration explanation was returned."}</p></div></div>
          </GlassCard>
        </motion.div>

        <motion.div className="health-card" {...cardMotion}>
          <GlassCard className="health-panel">
            <div className="card-topline"><span className="eyebrow">CONVERSATION HEALTH</span><Activity size={17} className="accent-icon cyan" /></div>
            <div className="score-layout"><ScoreRing score={healthScore} label="Conversation health" caption="HEALTH" size={108} /><div className="score-copy"><strong>{result.health.label || "Not scored"}</strong><p>{result.health.description || result.tone.explanation || "No health explanation was returned."}</p><div className="reason-chips">{result.tone.label && <Badge tone="cyan">{result.tone.label} tone</Badge>}{result.collaboration.label && <Badge tone="indigo">{result.collaboration.label}</Badge>}</div></div></div>
          </GlassCard>
        </motion.div>

        <motion.div className="actions-card" id="actions" {...cardMotion}>
          <GlassCard className="actions-panel">
            <div className="card-topline"><div><span className="eyebrow">ACTION ITEMS</span><h3>Owners & next moves</h3></div><Badge tone="indigo">{filteredActions.length} returned</Badge></div>
            <Tabs label="Filter actions by status" value={actionFilter} onChange={setActionFilter} options={[{ value: "all", label: "All" }, { value: "todo", label: "To do" }, { value: "progress", label: "In progress" }, { value: "done", label: "Done" }]} />
            <div className="action-list">{filteredActions.filter((action) => actionFilter === "all" || statusGroup(action) === actionFilter).map((action, index) => {
              const assignee = action?.assignee || "Unassigned";
              const status = action?.status || "Open";
              const group = statusGroup(action);
              const text = textOf(action, "task", "action", "description", "text") || "Action item";
              return (
                <button className="action-item" key={`${assignee}-${index}`} onClick={() => onEvidence(text)} type="button">
                  <span className={`avatar avatar-${index % 6}`}>{assignee.slice(0, 1).toUpperCase()}</span>
                  <span className="action-detail"><strong>{text}</strong><span>{assignee}</span></span>
                  {action?.deadline && <Badge tone="cyan">{action.deadline}</Badge>}
                  <Badge tone={group === "done" ? "emerald" : group === "progress" ? "amber" : "neutral"}>{status}</Badge><ArrowUpRight size={14} className="row-arrow" />
                </button>
              );
            })}{filteredActions.length === 0 && <p className="empty-state">{result.actions.length ? "No actions match these filters." : "No action items were returned."}</p>}</div>
          </GlassCard>
        </motion.div>

        <motion.div className="decisions-card" {...cardMotion}>
          <GlassCard className="decisions-panel">
            <div className="card-topline"><div><span className="eyebrow">DECISIONS</span><h3>Locked in</h3></div><LockKeyhole size={17} className="accent-icon violet" /></div>
            <ol className="decision-timeline">{visibleDecisions.map((decision, index) => <li key={index}><span className="timeline-marker"><Check size={12} /></span><button onClick={() => onEvidence(textOf(decision))} type="button"><span>{textOf(decision)}</span><Badge tone="emerald">LOCKED IN</Badge></button></li>)}</ol>
            {visibleDecisions.length === 0 && <p className="empty-state">{result.decisions.length ? "No decisions match this search." : "No decisions were returned."}</p>}
          </GlassCard>
        </motion.div>

        <motion.div className="people-card" id="people" {...cardMotion}>
          <GlassCard className="people-panel">
            <div className="card-topline"><div><span className="eyebrow">PEOPLE & ROLES</span><h3>The conversation cast</h3></div><Users size={17} className="accent-icon cyan" /></div>
            {visiblePeople.length ? <div className="people-layout"><div className="people-list">{visiblePeople.map((person, index) => {
              const name = textOf(person, "name", "person") || "Unknown";
              const share = Math.max(0, Math.min(100, Number(person.share) || 0));
              const count = Number(person.messages);
              return <button className="person-row" key={`${name}-${index}`} onClick={() => setPersonFilter(name)} type="button"><span className={`avatar avatar-${index % 6}`}>{name.charAt(0).toUpperCase()}</span><span className="person-info"><span className="person-line"><strong>{name}</strong><Badge tone="neutral">{person.role || "Contributor"}</Badge></span><span className="person-meter"><i style={{ width: `${share}%` }} /></span></span><span className="person-count">{Number.isFinite(count) ? `${count} msg` : "—"}<small>{share}%</small></span></button>;
            })}</div>{visiblePeople.every((person) => Number.isFinite(Number(person.share))) && <div className="donut-wrap"><DonutChart people={visiblePeople} /><span>Message<br />contribution</span></div>}</div> : <p className="empty-state">{result.people.length ? "No people match this search." : "No participants were returned."}</p>}
            <span className="sr-only">{collaborators}</span>
          </GlassCard>
        </motion.div>

        <motion.div className="topics-card" id="topics" {...cardMotion}>
          <GlassCard className="topics-panel">
            <div className="card-topline"><div><span className="eyebrow">TOPIC SIGNALS</span><h3>What the chat returned</h3></div><AudioLines size={17} className="accent-icon magenta" /></div>
            <div className="topic-cluster">{visibleTopics.map((topic, index) => {
              const mentions = Number(topic.mentions);
              const max = Math.max(1, ...result.topics.map((item) => Number(item.mentions) || 0));
              return <button className={`topic-bubble topic-${index % 5}`} key={`${textOf(topic, "name", "topic")}-${index}`} onClick={() => setTopicFilter(textOf(topic, "name", "topic"))} type="button"><span>{textOf(topic, "name", "topic", "label")}</span>{Number.isFinite(mentions) && <small>{mentions}</small>}<i style={{ transform: `scaleX(${Math.max(.08, mentions / max)})` }} /></button>;
            })}{visibleTopics.length === 0 && <p className="empty-state">{result.topics.length ? "No topics match this search." : "No topics were returned."}</p>}</div>
          </GlassCard>
        </motion.div>

        <motion.div className="timeline-card" id="timeline" {...cardMotion}>
          <GlassCard className="timeline-panel">
            <div className="card-topline"><div><span className="eyebrow">TIMELINE</span><h3>Conversation sequence</h3></div><MessageSquareText size={17} className="accent-icon violet" /></div>
            <p className="panel-note">Analyzer order only. Message timestamps were not returned.</p>
            <ol className="event-list">{visibleTimeline.map((item, index) => {
              const detail = textOf(item, "detail", "description", "text") || textOf(item);
              return <li key={index}><span className={`event-pin event-${index % 4}`} /><button onClick={() => onEvidence(detail)} type="button"><Badge tone={index % 2 ? "violet" : "cyan"}>{textOf(item, "label", "title") || `EVENT ${String(index + 1).padStart(2, "0")}`}</Badge><span>{detail}</span><ArrowUpRight size={13} /></button></li>;
            })}</ol>
            {visibleTimeline.length === 0 && <p className="empty-state">{result.timeline.length ? "No events match this search." : "No timeline entries were returned."}</p>}
          </GlassCard>
        </motion.div>

        <motion.div className="questions-card" {...cardMotion}>
          <GlassCard className="questions-panel">
            <div className="card-topline"><div><span className="eyebrow">OPEN LOOPS</span><h3>Unresolved questions</h3></div><CircleAlert size={17} className="accent-icon rose" /></div>
            <ul className="open-loop-list">{visibleQuestions.map((question, index) => <li key={index}><span className="loop-dot" /><button onClick={() => onEvidence(textOf(question))} type="button">{textOf(question, "question", "text") || textOf(question)}</button><ArrowUpRight size={13} /></li>)}</ul>
            {visibleQuestions.length === 0 && <p className="empty-state">{result.questions.length ? "No questions match this search." : "No unresolved questions were returned."}</p>}
          </GlassCard>
        </motion.div>

        <motion.div className="risk-card" {...cardMotion}>
          <GlassCard className="risk-panel">
            <div className="card-topline"><div><span className="eyebrow">RISK & SIGNALS</span><h3>Worth a closer look</h3></div><ShieldCheck size={17} className="accent-icon amber" /></div>
            <div className="risk-list">{visibleRisks.map((risk, index) => {
              const level = textOf(risk, "level", "severity").toLowerCase();
              const tone = level === "high" || level === "critical" ? "rose" : level === "medium" ? "amber" : "neutral";
              const detail = textOf(risk, "text", "description") || textOf(risk);
              return <button className="risk-item" key={index} onClick={() => onEvidence(detail)} type="button"><Badge tone={tone} dot>{textOf(risk, "level", "severity") || "Signal"}</Badge><span><strong>{textOf(risk, "type", "label") || "Signal"}</strong><small>{detail}</small></span><ArrowUpRight size={13} /></button>;
            })}{visibleRisks.length === 0 && <p className="empty-state">{result.risks.length ? "No signals match this search." : "No risk signals were returned."}</p>}</div>
          </GlassCard>
        </motion.div>

        <motion.div className="quotes-card" id="evidence" {...cardMotion}>
          <GlassCard className="quotes-panel">
            <div className="card-topline"><div><span className="eyebrow">KEY MESSAGES</span><h3>Receipts from the thread</h3></div><MessageCircle size={17} className="accent-icon magenta" /></div>
            <div className="quote-grid">{visibleQuotes.map((quote, index) => <button className="quote-item" key={index} onClick={() => onEvidence(textOf(quote))} type="button"><span className="quote-mark">“</span><span>{textOf(quote)}</span><ArrowUpRight size={14} /></button>)}</div>
            {visibleQuotes.length === 0 && <p className="empty-state">{result.keyMessages.length ? "No messages match this search." : "No key messages were returned."}</p>}
          </GlassCard>
        </motion.div>

        <motion.div className="next-card" {...cardMotion}>
          <GlassCard className="next-panel">
            <div className="card-topline"><div><span className="eyebrow">NEXT STEPS</span><h3>Keep the thread moving</h3></div><CheckCheck size={17} className="accent-icon emerald" /></div>
            <p className="panel-note">A personal checklist derived from open items and questions. It is not saved to the analyzer.</p>
            <div className="next-list">{nextSteps.map((step) => {
              const checked = completedNext.includes(step.id);
              return <label className={checked ? "next-step is-checked" : "next-step"} key={step.id}><input type="checkbox" checked={checked} onChange={() => setCompletedNext((current) => checked ? current.filter((id) => id !== step.id) : [...current, step.id])} /><span className="check-visual"><Check size={12} /></span><span>{step.text}</span></label>;
            })}{nextSteps.length === 0 && <p className="empty-state">No open actions or questions to carry forward.</p>}</div>
          </GlassCard>
        </motion.div>
      </div>
      <div className="report-disclaimer"><ShieldCheck size={14} /> Only fields returned by the analyzer are visualized. No message timestamps or unsupported scores are inferred.</div>
      <Toast message={notice} onDismiss={() => onToast("")} />
    </section>
  );
}

function LoadingScreen({ phase }) {
  const steps = ["Request sent", "Waiting for analyzer", "Preparing the report"];
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <div className="loading-visual"><svg viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="35" /><circle className="loading-ring" cx="42" cy="42" r="35" /></svg><ScanSearch size={21} /></div>
      <div className="loading-copy"><span className="eyebrow">DECODER IN SESSION</span><h3>Reading the room.</h3><p>{phase === 0 ? "Sending the conversation to your analysis service…" : phase === 1 ? "Waiting for the analyzer to return its findings…" : "Findings received. Preparing your structured report…"}</p><div className="loading-terminal">{steps.map((step, index) => <span className={index < phase ? "phase-done" : index === phase ? "phase-active" : ""} key={step}>{index < phase ? <Check size={12} /> : <span className="phase-indicator" />}{step}</span>)}</div></div>
      <div className="loading-skeletons" aria-hidden="true"><Skeleton /><Skeleton /><Skeleton /></div>
    </div>
  );
}

function App() {
  const [chat, setChat] = useState("");
  const [previousChat, setPreviousChat] = useState("");
  const [result, setResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [toast, setToast] = useState("");
  const [activeDemo, setActiveDemo] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [search, setSearch] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("gcd-theme") || "dark"; } catch { return "dark"; }
  });
  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchRef = useRef(null);
  const gutterRef = useRef(null);
  const requestLockRef = useRef(false);
  const reducedMotion = useReducedMotion();

  const setNotice = useCallback((message) => {
    setToast(message);
    if (message) window.setTimeout(() => setToast((current) => current === message ? "" : current), 3200);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("gcd-theme", theme); } catch { /* Storage may be unavailable in private contexts. */ }
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.key === "Escape") {
        setEvidence("");
        setPaletteOpen(false);
        setHelpOpen(false);
        return;
      }
      if (!isTyping && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!isTyping && event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (!isTyping && /^[1-9]$/.test(event.key)) {
        const section = NAV_SECTIONS[Number(event.key) - 1];
        if (section) document.getElementById(section[0])?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reducedMotion]);

  const lineCount = chat ? chat.split(/\r?\n/).length : 1;
  const messageCount = chat.split(/\r?\n/).filter((line) => line.trim()).length;
  const format = detectedFormat(chat);

  const focusWorkspace = useCallback(() => {
    document.getElementById("workspace")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    window.setTimeout(() => textAreaRef.current?.focus(), reducedMotion ? 0 : 400);
  }, [reducedMotion]);

  const updateChat = (value, demoId = "") => {
    if (value !== chat) setPreviousChat(chat);
    setChat(value);
    setActiveDemo(demoId);
    setResult(null);
    setError("");
  };

  const loadFile = (file) => {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["txt", "csv"].includes(extension)) {
      setError("Unsupported file. Choose a .txt or .csv conversation.");
      setCanRetry(false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateChat(typeof reader.result === "string" ? reader.result : "");
      setNotice(`${file.name} is ready to decode`);
      setError("");
      setCanRetry(false);
    };
    reader.onerror = () => {
      setCanRetry(false);
      setError("The file could not be read. Try another text or CSV file.");
    };
    reader.readAsText(file);
  };

  const analyzeChat = async (providedText = chat) => {
    const text = providedText.trim();
    if (!text) {
      setError("Add a conversation before decoding.");
      textAreaRef.current?.focus();
      return;
    }
    if (requestLockRef.current) return;
    requestLockRef.current = true;
    const startedAt = monotonicNow();
    setChat(text);
    setResult(null);
    setIsAnalyzing(true);
    setPhase(0);
    setError("");
    setCanRetry(false);
    setToast("");
    try {
      const responsePromise = fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: text }),
      });
      setPhase(1);
      const response = await responsePromise;
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Analyzer returned ${response.status}.`);
      }
      const normalized = normalizeResult(data);
      setPhase(2);
      const remaining = MIN_DECODING_MS - (monotonicNow() - startedAt);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setResult(normalized);
      if (!reducedMotion) {
        window.setTimeout(() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
      } else {
        document.getElementById("dashboard")?.scrollIntoView({ behavior: "auto", block: "start" });
      }
    } catch (requestError) {
      setCanRetry(true);
      setError(requestError instanceof Error
        ? `${requestError.message} Check the analysis service and retry.`
        : "The conversation could not be decoded. Please retry.");
    } finally {
      requestLockRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const startDemo = (demo) => {
    updateChat(demo.text, demo.id);
    analyzeChat(demo.text);
  };

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ product: "GroupChat Decoder", generated_at: new Date().toISOString(), conversation: chat, analysis: result }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "groupchat-decoder-analysis.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("JSON report exported");
  };

  const shareImage = () => {
    if (!result) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) {
      setNotice("Image export is not available in this browser");
      return;
    }
    const gradient = context.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#10142b");
    gradient.addColorStop(1, "#07151b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1200, 630);
    context.strokeStyle = "rgba(129,133,255,.55)";
    context.lineWidth = 2;
    context.strokeRect(40, 40, 1120, 550);
    context.fillStyle = "#22d3ee";
    context.font = "500 20px Inter, sans-serif";
    context.fillText("GROUPCHAT DECODER  /  INTELLIGENCE BRIEF", 76, 104);
    context.fillStyle = "#f4f5ff";
    context.font = "600 38px 'Space Grotesk', sans-serif";
    const summary = result.summary || "Conversation analysis";
    const words = summary.split(/\s+/);
    let line = "";
    let y = 190;
    context.font = "500 32px Inter, sans-serif";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > 1020 && line) {
        context.fillText(line, 76, y);
        line = word;
        y += 49;
        if (y > 400) break;
      } else line = next;
    }
    if (line && y <= 400) context.fillText(line, 76, y);
    context.fillStyle = "#a5abc4";
    context.font = "500 20px 'DM Mono', monospace";
    context.fillText(`${result.message_count ?? "—"} MESSAGES    ${result.participant_count ?? result.people.length} PEOPLE    ${result.actions.length} ACTIONS`, 76, 492);
    context.fillStyle = "#707790";
    context.font = "16px Inter, sans-serif";
    context.fillText("Based only on findings returned by the configured analyzer.", 76, 548);
    canvas.toBlob((blob) => {
      if (!blob) {
        setNotice("Could not create a report image in this browser");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "groupchat-decoder-brief.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Summary image downloaded");
    }, "image/png");
  };

  const resetCase = () => {
    updateChat("");
    setResult(null);
    setError("");
    setSearch("");
    focusWorkspace();
  };

  const commands = [
    { title: "Focus conversation input", hint: "Jump to decoder studio", icon: <MessageSquareText size={16} />, run: focusWorkspace },
    { title: "Show keyboard shortcuts", hint: "Open help", icon: <HelpCircle size={16} />, run: () => setHelpOpen(true) },
    { title: "Toggle appearance", hint: "Switch dark / light", icon: theme === "dark" ? <Sun size={16} /> : <Moon size={16} />, run: () => setTheme((value) => value === "dark" ? "light" : "dark") },
    ...DEMOS.map((demo) => ({ title: `Run ${demo.label} demo`, hint: "Analyze sample conversation", icon: <Zap size={16} />, run: () => startDemo(demo) })),
    ...NAV_SECTIONS.map(([id, label], index) => ({ title: `Go to ${label}`, hint: `Jump to section ${index + 1}`, icon: <ArrowRight size={16} />, run: () => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }) })),
  ];

  return (
    <div className={`app-shell theme-${theme}`} onPointerMove={(event) => {
      if (event.pointerType !== "mouse" || window.innerWidth < 760) return;
      event.currentTarget.style.setProperty("--cursor-x", `${event.clientX}px`);
      event.currentTarget.style.setProperty("--cursor-y", `${event.clientY}px`);
    }}>
      <div className="ambient" aria-hidden="true"><span /><span /><span /></div>
      <div className="grid-noise" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#" aria-label="GroupChat Decoder home"><span className="brand-mark"><Fingerprint size={19} /></span><span>groupchat<span>decoder</span></span><Badge tone="indigo">BETA</Badge></a>
        <nav className="top-nav" aria-label="Primary navigation"><a className={!result ? "active" : ""} href="#workspace">Decoder</a><a className={result ? "active" : ""} href={result ? "#dashboard" : "#scenarios"}>Intelligence</a></nav>
        <div className="top-actions"><span className="service-status"><i /> ENGINE READY</span><Tooltip label={`Switch to ${theme === "dark" ? "light" : "dark"} appearance`}><button className="icon-button theme-toggle" title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} type="button">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button></Tooltip><button className="command-trigger" onClick={() => setPaletteOpen(true)} type="button"><Command size={14} /><span>Command</span><kbd>⌘ K</kbd></button></div>
      </header>

      <main className="page-shell">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow hero-kicker"><span className="live-dot" /> CONVERSATION INTELLIGENCE / 001</span>
            <ScrambleHeading reducedMotion={reducedMotion} />
            <p>Turn the chaos of your group chat into a clear read on <strong>who’s doing what</strong> and what happens next.</p>
            <div className="hero-cta-row"><GradientButton onClick={focusWorkspace} type="button">Decode a chat <ArrowRight size={17} /></GradientButton><button className="secondary-button" onClick={() => startDemo(DEMOS[2])} type="button"><Zap size={15} /> Try Judge Demo</button></div>
            <div className="hero-meta"><span>STRUCTURED SIGNALS</span><i /> <span>ONE DECODE</span><i /> <span>NO MADE-UP RECEIPTS</span></div>
            <p className="privacy-copy"><ShieldCheck size={14} /> Your conversation is sent to the configured analysis service to generate this report.</p>
          </div>
          <div className="hero-visual" aria-label="Conversation messages being structured into insights">
            <div className="visual-top"><span><i /> LIVE DECODER</span><span>ILLUSTRATIVE / CHAT → SIGNAL</span></div>
            <div className="visual-chat">
              <motion.div className="visual-message message-left" animate={reducedMotion ? {} : { x: [0, 7, 0], opacity: [.72, 1, .72] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}><small>11:42 PM · MAYA</small><span>“are we actually doing this?”</span></motion.div>
              <motion.div className="visual-message message-right" animate={reducedMotion ? {} : { x: [0, -7, 0], opacity: [.8, 1, .8] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: .4 }}><small>11:43 PM · JULES</small><span>“I already booked it btw”</span></motion.div>
              <div className="scanner-beam" />
              <div className="scanner-ring"><ScanSearch size={23} /></div>
            </div>
            <div className="visual-output"><span className="output-title">STRUCTURED INTELLIGENCE</span><div><Badge tone="cyan">ACTION</Badge><span>Venue booked</span></div><div><Badge tone="violet">DECISION</Badge><span>Plan confirmed</span></div><div><Badge tone="rose">OPEN LOOP</Badge><span>Attendance unknown</span></div></div>
            <div className="visual-footer"><span>PARSE / CLASSIFY / CLARIFY</span><span><Activity size={13} /> READY</span></div>
          </div>
          <div className="hero-stats"><div><strong>01</strong><span>CONVERSATION</span></div><ArrowRight size={15} /><div><strong>02</strong><span>DECODER</span></div><ArrowRight size={15} /><div><strong>03</strong><span>STRUCTURED INTELLIGENCE</span></div><ArrowRight size={15} /><div><strong>04</strong><span>ACTION</span></div></div>
        </section>

        <section className="scenario-section" id="scenarios" aria-labelledby="scenario-title">
          <div className="section-heading compact-heading"><div><span className="eyebrow">JUDGE DEMO MODE</span><h2 id="scenario-title">One click. Real analysis.</h2></div><span>Pick a sample to run through the same analyzer.</span></div>
          <div className="scenario-grid">{DEMOS.map((demo, index) => <button className={`scenario-card${activeDemo === demo.id ? " scenario-selected" : ""}`} key={demo.id} onClick={() => startDemo(demo)} type="button" disabled={isAnalyzing}><span className={`scenario-icon scenario-icon-${index}`}><Zap size={17} /></span><span className="scenario-text"><strong>{demo.label}</strong><small>{demo.description}</small></span><ArrowUpRight size={16} /></button>)}</div>
        </section>

        <section className="workspace-section" id="workspace" aria-labelledby="workspace-title">
          <div className="section-heading workspace-heading"><div><span className="eyebrow"><span className="live-dot" /> DECODER STUDIO / INPUT 01</span><h2 id="workspace-title">Bring the <em>conversation.</em></h2></div><p>Paste a message dump or import a plain-text / CSV export. The analyzer returns the structured findings shown in your report.</p></div>
          <div className="workspace-grid">
            <GlassCard className={`editor-panel${isDragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); loadFile(event.dataTransfer.files?.[0]); }}>
              <div className="editor-header"><div><span className="editor-led" /><span>CONVERSATION INPUT</span><Badge tone="emerald">PRIVATE CASE</Badge></div><span className="format-badge"><FileText size={13} /> {format}</span></div>
              <div className="editor-body"><div ref={gutterRef} className="line-numbers" aria-hidden="true">{Array.from({ length: Math.max(8, lineCount) }, (_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div><textarea ref={textAreaRef} aria-label="Conversation text" value={chat} onChange={(event) => updateChat(event.target.value)} onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.target.scrollTop; }} placeholder={"Paste your group chat here…\n\nMia: are we still on for tonight?\nJules: booked the table already\nAri: wait, what time?"} spellCheck="false" /></div>
              {!chat && <div className="editor-drop-hint"><Upload size={14} /> DROP A .TXT OR .CSV FILE</div>}
              <div className="editor-footer"><div className="editor-counts"><span>{messageCount} <small>LINES</small></span><i /><span>{chat.length.toLocaleString()} <small>CHARACTERS</small></span></div><div className="editor-tools"><input ref={fileInputRef} type="file" accept=".txt,.csv,text/plain,text/csv" hidden aria-label="Import text or CSV conversation" onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = ""; }} /><button className="quiet-button" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Import</button><button className="quiet-button" type="button" disabled={!previousChat} onClick={() => { const old = previousChat; setPreviousChat(chat); setChat(old); setResult(null); setError(""); }}><RotateCcw size={14} /> Undo</button><button className="quiet-button quiet-danger" type="button" disabled={!chat} onClick={() => updateChat("")}><X size={14} /> Clear</button></div></div>
              <div className="editor-action-row"><div className="editor-tip"><ShieldCheck size={15} /><span>Text is sent only when you choose to decode.</span></div><GradientButton className="analyze-button" disabled={!chat.trim() || isAnalyzing} onClick={() => analyzeChat()} type="button">{isAnalyzing ? <><LoaderCircle className="spin" size={17} /> Decoding…</> : <>Decode conversation <ArrowRight size={17} /></>}</GradientButton></div>
            </GlassCard>
            <aside className="workspace-aside"><GlassCard className="input-guide"><span className="eyebrow">GOOD TO KNOW</span><h3>Give it the full thread.</h3><p>Names and message boundaries help the analyzer identify participants, actions, decisions, and open questions.</p><div className="guide-divider" /><div className="guide-item"><span className="guide-index">01</span><span><strong>Paste or drop</strong><small>TXT and CSV files are supported.</small></span></div><div className="guide-item"><span className="guide-index">02</span><span><strong>Review the source</strong><small>Your input stays editable before analysis.</small></span></div><div className="guide-item"><span className="guide-index">03</span><span><strong>Decode the signals</strong><small>Only fields returned by the analyzer appear.</small></span></div><button className="sample-load" onClick={() => updateChat(DEMOS[0].text, DEMOS[0].id)} type="button"><FileText size={15} /> Load Project Team sample <ArrowRight size={14} /></button></GlassCard></aside>
          </div>
          <AnimatePresence>{error && <motion.div className="error-banner" role="alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}><CircleAlert size={18} /><span>{error}</span>{canRetry && <button className="quiet-button" disabled={!chat.trim() || isAnalyzing} onClick={() => analyzeChat()} type="button"><RotateCcw size={14} /> Retry</button>}</motion.div>}</AnimatePresence>
          <AnimatePresence>{isAnalyzing && <motion.div className="loading-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><LoadingScreen phase={phase} /></motion.div>}</AnimatePresence>
        </section>

        {result && <Dashboard result={result} notice={toast} onToast={setNotice} onEvidence={setEvidence} onExportJson={exportJson} onShareImage={shareImage} onReset={resetCase} search={search} setSearch={setSearch} searchRef={searchRef} reducedMotion={reducedMotion} />}
      </main>

      <footer className="site-footer"><a className="brand" href="#" aria-label="Back to top"><span className="brand-mark"><Fingerprint size={17} /></span><span>groupchat<span>decoder</span></span></a><span>CONVERSATION → CLARITY</span><span>YOUR CHAT. YOUR CALL.</span></footer>

      <AnimatePresence>{evidence && <EvidenceDrawer evidence={evidence} chat={chat} onClose={() => setEvidence("")} />}</AnimatePresence>
      <CommandPalette key={paletteOpen ? "palette-open" : "palette-closed"} open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <AnimatePresence>{helpOpen && <Modal title="Keyboard shortcuts" onClose={() => setHelpOpen(false)}><div className="shortcut-list"><span><kbd>/</kbd> Search this report</span><span><kbd>⌘ K</kbd> Open command palette</span><span><kbd>1–9</kbd> Jump to a dashboard section</span><span><kbd>?</kbd> Show this help</span><span><kbd>ESC</kbd> Close dialog or evidence</span></div></Modal>}</AnimatePresence>
      <Toast message={toast && !result ? toast : ""} onDismiss={() => setToast("")} />
    </div>
  );
}

function ScrambleHeading({ reducedMotion }) {
  const finalText = "Turn group chat chaos into clarity.";
  const [text, setText] = useState(reducedMotion ? finalText : "Turn group chat chaos into clarity.");
  useEffect(() => {
    if (reducedMotion) return undefined;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let frame = 0;
    const totalFrames = 16;
    const interval = window.setInterval(() => {
      frame += 1;
      const revealed = Math.floor((frame / totalFrames) * finalText.length);
      setText(finalText.split("").map((character, index) => {
        if (character === " " || index < revealed) return character;
        return alphabet[Math.floor(Math.random() * alphabet.length)];
      }).join(""));
      if (frame >= totalFrames) {
        setText(finalText);
        window.clearInterval(interval);
      }
    }, 42);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);
  return <h1 id="hero-title">{text.split(" ").map((word, index) => <span className={index >= 4 ? "headline-accent" : ""} key={`${index}-${word}`}>{word}{index < 5 ? " " : ""}</span>)}</h1>;
}

export default App;

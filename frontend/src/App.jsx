import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleAlert,
  Clipboard,
  FileText,
  Fingerprint,
  Hash,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const DEMOS = [
  {
    id: "project",
    label: "Project team",
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
    label: "Event planning",
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
    label: "Hackathon crew",
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

function normalizeResult(raw) {
  const topics = Array.isArray(raw.topics) ? raw.topics : [];
  const actions = Array.isArray(raw.actions)
    ? raw.actions
    : Array.isArray(raw.action_items)
      ? raw.action_items
      : [];
  const people = Array.isArray(raw.people) ? raw.people : [];
  const decisions = Array.isArray(raw.decisions) ? raw.decisions : [];
  const questions = Array.isArray(raw.unresolved_questions)
    ? raw.unresolved_questions
    : [];
  const timeline = Array.isArray(raw.timeline) ? raw.timeline : [];
  const keyMessages = Array.isArray(raw.key_messages)
    ? raw.key_messages
    : [];
  const risks = Array.isArray(raw.risks) ? raw.risks : [];
  const tone = raw.tone && typeof raw.tone === "object" ? raw.tone : {};
  const health = raw.health || raw.conversation_health || {};
  const collaboration = raw.collaboration || {};
  const counts = raw.counts || {};

  return {
    ...raw,
    topics,
    actions,
    people,
    decisions,
    questions,
    timeline,
    keyMessages,
    risks,
    tone,
    health,
    collaboration,
    actionCount: countOr(counts.actions, actions.length),
    decisionCount: countOr(counts.decisions, decisions.length),
    participantCount: countOr(raw.participant_count, people.length),
    messageCount: countOr(raw.message_count, null),
  };
}

function textOf(item, ...keys) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) {
      return String(item[key]);
    }
  }
  return "";
}

function scoreOf(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
}

function countOr(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const count = Number(value);
  return Number.isFinite(count) ? count : fallback;
}

function SectionLabel({ children, accent = false }) {
  return <span className={`section-label${accent ? " label-accent" : ""}`}>{children}</span>;
}

function Logo({ onClick }) {
  return (
    <button className="brand" onClick={onClick} type="button" aria-label="Groupchat Decoder home">
      <span className="brand-symbol"><Fingerprint size={18} strokeWidth={1.8} /></span>
      <span className="brand-lockup">
        <span className="brand-name">groupchat<span>decoder</span></span>
        <span className="brand-descriptor">SOCIAL INTELLIGENCE</span>
      </span>
      <span className="brand-period">®</span>
    </button>
  );
}

function EmptySignal({ children }) {
  return (
    <div className="empty-signal">
      <span className="empty-signal-mark">—</span>
      <p>{children}</p>
    </div>
  );
}

function Report({ result, notice, error, onCopy, onExport, onDecodeAnother }) {
  const maxMessages = Math.max(
    1,
    ...result.people.map((person) => Number(person?.messages) || 0),
  );
  const maxTopicMentions = Math.max(
    1,
    ...result.topics.map((topic) => Number(topic?.mentions) || 0),
  );
  const hasMessageCounts = result.people.some(
    (person) => person?.messages !== undefined
      && person?.messages !== null
      && Number.isFinite(Number(person.messages)),
  );

  return (
    <section className="report-section" id="report" aria-labelledby="report-title">
      <div className="report-topline">
        <div className="case-label-group">
          <SectionLabel accent>CASE FILE 001</SectionLabel>
          {result.source && <span className="case-source">SOURCE / {result.source}</span>}
        </div>
        <div className="report-tools">
          <button className="text-button" type="button" onClick={onCopy} disabled={!result.summary}>
            <Clipboard size={15} /> Copy summary
          </button>
          <button className="text-button" type="button" onClick={onExport}>
            <ArrowDownToLine size={15} /> Export JSON
          </button>
          <button className="text-button" type="button" onClick={onDecodeAnother}>
            <RotateCcw size={15} /> New case
          </button>
        </div>
      </div>
      {(notice || error) && (
        <div className={`report-feedback${error ? " report-feedback-error" : ""}`} role={error ? "alert" : "status"}>
          {error ? <CircleAlert size={14} /> : <Check size={14} />}
          <span>{error || notice}</span>
        </div>
      )}

      <div className="report-heading">
        <div>
          <p className="micro-label">CHAT UNDER REVIEW</p>
          <h2 id="report-title">Here’s what <em>actually</em> happened.</h2>
        </div>
        <div className="case-stamp"><ScanSearch size={17} /><span>DECODED<br />NOT DISTORTED</span></div>
      </div>

      <div className="verdict-card">
        <div className="verdict-main">
          <SectionLabel accent>THE VERDICT / 01</SectionLabel>
          <p className="verdict-summary">{result.summary || "No summary was returned by the analyzer."}</p>
          {result.insight && <p className="verdict-insight"><Sparkles size={15} />{result.insight}</p>}
          {result.privacy_note && <p className="privacy-note"><ShieldCheck size={14} />{result.privacy_note}</p>}
        </div>
        <div className="verdict-stats">
          <div className="verdict-stat"><strong>{result.messageCount ?? "—"}</strong><span>MESSAGES</span></div>
          <div className="verdict-stat"><strong>{result.participantCount}</strong><span>PEOPLE</span></div>
          <div className="verdict-stat"><strong>{result.actionCount}</strong><span>ACTIONS</span></div>
        </div>
      </div>

      <div className="report-grid">
        <article className="report-card group-vibe">
          <div className="card-topline">
            <SectionLabel>02 / GROUP VIBE</SectionLabel>
            <AudioLines size={19} className="pink-icon" />
          </div>
          <h3>{result.tone.label || "Tone not available"}</h3>
          <p>{result.tone.explanation || result.tone.description || "No tone explanation was provided."}</p>
          {scoreOf(result.tone.score) !== null && (
            <div className="meter-wrap">
              <div className="meter-label"><span>TONE SIGNAL</span><strong>{scoreOf(result.tone.score)}%</strong></div>
              <div className="meter-track"><span style={{ width: `${scoreOf(result.tone.score)}%` }} /></div>
            </div>
          )}
        </article>

        <article className="report-card cast-card">
          <div className="card-topline">
            <SectionLabel>03 / THE SOCIAL CAST</SectionLabel>
            <Users size={19} className="lime-icon" />
          </div>
          {result.people.length ? (
            <div className="cast-list">
              {result.people.map((person, index) => {
                const name = textOf(person, "name", "person") || "Unknown";
                const hasCount = person?.messages !== undefined
                  && person?.messages !== null
                  && Number.isFinite(Number(person.messages));
                const messageCount = hasCount ? Number(person.messages) : 0;
                return (
                  <div className="cast-person" key={`${name}-${index}`}>
                    <span className={`cast-avatar avatar-${index % 4}`}>{name.charAt(0).toUpperCase()}</span>
                    <div className="cast-person-info">
                      <div className="cast-name-row">
                        <strong>{name}</strong>
                        {person?.role && <span>{person.role}</span>}
                      </div>
                      {hasMessageCounts && hasCount && (
                        <div className="contribution-row">
                          <div className="contribution-track"><span style={{ width: `${Math.max(5, messageCount / maxMessages * 100)}%` }} /></div>
                          <small>{messageCount} msg{messageCount === 1 ? "" : "s"}</small>
                          {Number.isFinite(Number(person.share)) && <small className="contribution-share">{person.share}%</small>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptySignal>No participants were identified in this chat.</EmptySignal>}
          {result.most_active?.name && (
            <p className="active-note">Most active · <strong>{result.most_active.name}</strong></p>
          )}
        </article>

        <article className="report-card lore-card">
          <div className="card-topline">
            <SectionLabel>04 / THE EVIDENCE</SectionLabel>
            <Hash size={19} className="violet-icon" />
          </div>
          {result.topics.length ? (
            <div className="topic-breakdown">
              {result.topics.map((topic, index) => {
                const label = textOf(topic, "name", "topic", "label") || "Topic";
                const mentions = Number(topic?.mentions);
                return (
                  <div className={`topic-row topic-${index % 3}`} key={`${label}-${index}`}>
                    <div className="topic-row-label"><span><i />{label}</span><small>{Number.isFinite(mentions) ? `${mentions} mention${mentions === 1 ? "" : "s"}` : "Detected"}</small></div>
                    {Number.isFinite(mentions) && <div className="topic-track"><span style={{ width: `${Math.max(5, mentions / maxTopicMentions * 100)}%` }} /></div>}
                  </div>
                );
              })}
            </div>
          ) : <EmptySignal>No distinct themes were returned.</EmptySignal>}
          {result.keyMessages.length > 0 && (
            <details className="evidence-details">
              <summary><span>Notable messages</span><ChevronDown size={15} /></summary>
              <ul className="evidence-list">
                {result.keyMessages.map((message, index) => (
                  <li key={index}>{textOf(message, "text", "message") || String(message)}</li>
                ))}
              </ul>
            </details>
          )}
        </article>

        <article className="report-card health-card">
          <div className="card-topline">
            <SectionLabel>05 / CHAT HEALTH</SectionLabel>
            <Layers3 size={19} className="lime-icon" />
          </div>
          <div className="score-row">
            <div className="score-dial" style={{ "--score": `${scoreOf(result.health.score) ?? 0}%` }}>
              <strong>{scoreOf(result.health.score) ?? "—"}{scoreOf(result.health.score) !== null && <small>%</small>}</strong>
            </div>
            <div><h3>{result.health.label || "Not scored"}</h3><p>{result.collaboration.label || "Collaboration insight unavailable"}</p></div>
          </div>
          {result.collaboration.description && <p className="card-description">{result.collaboration.description}</p>}
          {result.health.description && <p className="card-description">{result.health.description}</p>}
        </article>

        <article className="report-card full-card">
          <div className="card-topline">
            <SectionLabel>06 / COMMITMENTS & DECISIONS</SectionLabel>
            <Zap size={18} className="pink-icon" />
          </div>
          <div className="action-decision-grid">
            <div className="evidence-column">
              <h3><span className="evidence-index">A</span> Action items <b>{result.actions.length}</b></h3>
              {result.actions.length ? (
                <ul className="action-list">
                  {result.actions.map((action, index) => (
                    <li key={index}>
                      <span className="list-check"><Check size={13} /></span>
                      <div><strong>{textOf(action, "task", "action", "description", "text") || "Action item"}</strong>
                        <small>{[action?.assignee, action?.deadline, action?.status].filter(Boolean).join(" · ")}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptySignal>No explicit actions detected.</EmptySignal>}
            </div>
            <div className="evidence-column">
              <h3><span className="evidence-index violet-index">D</span> Decisions <b>{result.decisions.length}</b></h3>
              {result.decisions.length ? (
                <ul className="decision-list">
                  {result.decisions.map((decision, index) => (
                    <li key={index}><span className="decision-diamond" />{textOf(decision, "decision", "description", "text") || "Decision"}</li>
                  ))}
                </ul>
              ) : <EmptySignal>No decisions detected.</EmptySignal>}
            </div>
          </div>
        </article>

        <article className="report-card timeline-card">
          <div className="card-topline">
            <SectionLabel>07 / THE TIMELINE</SectionLabel>
            <MessageSquareText size={18} className="violet-icon" />
          </div>
          {result.timeline.length ? (
            <>
              <p className="timeline-disclaimer">Sequence from the analyzer · timestamps were not provided</p>
              <ol className="timeline-list">
                {result.timeline.map((item, index) => (
                  <li key={index}>
                    <span className="timeline-pin" />
                    <div><small>{textOf(item, "label", "title") || `EVENT ${String(index + 1).padStart(2, "0")}`}</small><p>{textOf(item, "detail", "description", "text") || String(item)}</p></div>
                  </li>
                ))}
              </ol>
            </>
          ) : <EmptySignal>The analyzer did not return timeline events.</EmptySignal>}
        </article>

        <article className="report-card questions-card">
          <div className="card-topline">
            <SectionLabel>08 / OPEN THREADS</SectionLabel>
            <CircleAlert size={18} className="pink-icon" />
          </div>
          {result.questions.length ? (
            <ul className="question-list">
              {result.questions.map((question, index) => <li key={index}>{textOf(question, "text", "question") || String(question)}</li>)}
            </ul>
          ) : <EmptySignal>No unanswered questions were flagged.</EmptySignal>}
          {result.risks.length > 0 && (
            <details className="evidence-details risk-details">
              <summary><span>Signals & risks <b>{result.risks.length}</b></span><ChevronDown size={15} /></summary>
              <ul className="evidence-list">
                {result.risks.map((risk, index) => {
                  const level = textOf(risk, "level", "severity");
                  return (
                    <li key={index}>
                      <strong>{textOf(risk, "type", "label")}</strong>
                      {textOf(risk, "text", "description")}
                      {level && <small className={`risk-level risk-${level.toLowerCase()}`}> · {level}</small>}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </article>
      </div>
      <div className="report-footnote"><span><ShieldCheck size={14} /> INSIGHT, NOT SURVEILLANCE.</span><span>Built from the data this conversation actually gave us.</span></div>
    </section>
  );
}

export default function App() {
  const [chat, setChat] = useState("");
  const [result, setResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeDemo, setActiveDemo] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeSection, setActiveSection] = useState("studio");
  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const requestLockRef = useRef(false);

  useEffect(() => {
    const sections = ["studio", "method", "report"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSection(visible[0].target.id === "report" ? "" : visible[0].target.id);
        }
      },
      { rootMargin: "-18% 0px -68% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const wordCount = chat.trim() ? chat.trim().split(/\s+/).length : 0;
  const lineCount = chat.split(/\r?\n/).filter((line) => line.trim()).length;

  const focusStudio = () => {
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => textAreaRef.current?.focus(), 450);
  };

  const setInput = (value, demo = "") => {
    setChat(value);
    setActiveDemo(demo);
    setResult(null);
    setError("");
    setNotice("");
  };

  const loadFile = (file) => {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["txt", "csv"].includes(extension)) {
      setError("That file type is not supported. Choose a .txt or .csv conversation.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInput(typeof reader.result === "string" ? reader.result : "");
      setNotice(`${file.name} is ready to decode.`);
    };
    reader.onerror = () => setError("The file could not be read. Try another text or CSV file.");
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
    setChat(text);
    setIsAnalyzing(true);
    setError("");
    setNotice("");
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: text }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Analyzer returned ${response.status}.`);
      }
      setResult(normalizeResult(data));
      window.setTimeout(() => {
        document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `${requestError.message} Check that the local analysis service is running, then retry.`
          : "The conversation could not be decoded. Please retry.",
      );
    } finally {
      requestLockRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(result?.summary || "");
      setNotice("Summary copied to clipboard.");
    } catch {
      setError("Clipboard access was blocked by the browser.");
    }
  };

  const exportResult = () => {
    const blob = new Blob(
      [JSON.stringify({
        product: "GroupChat Decoder",
        generated_at: new Date().toISOString(),
        conversation: chat,
        analysis: result,
      }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "groupchat-decoder-analysis.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Analysis exported as JSON.");
  };

  const startDemo = () => {
    const demo = DEMOS.find((item) => item.id === "hackathon");
    if (demo) {
      setInput(demo.text, demo.id);
      analyzeChat(demo.text);
    }
  };

  const resetCase = () => {
    setInput("");
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => textAreaRef.current?.focus(), 450);
  };

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="navbar">
        <Logo onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <nav className="nav-links" aria-label="Main navigation">
          <a className={activeSection === "method" ? "nav-active" : ""} aria-current={activeSection === "method" ? "location" : undefined} href="#method">The method</a>
          <a className={activeSection === "studio" ? "nav-active" : ""} aria-current={activeSection === "studio" ? "location" : undefined} href="#studio">Decoder studio</a>
        </nav>
        <button className="nav-demo" type="button" onClick={startDemo}>
          <Zap size={13} /> JUDGE DEMO
        </button>
        <button className="nav-cta" type="button" onClick={focusStudio}>
          <span>OPEN A CASE</span><ArrowUpRight size={15} />
        </button>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="live-mark" /> SOCIAL INTELLIGENCE / VISUALIZED</div>
            <h1 id="hero-title">The signal<br />inside the <em>conversation.</em></h1>
            <p className="hero-subtitle">Drop the messages. Decode the dynamics.<br /><strong>Keep the receipts.</strong></p>
            <div className="hero-actions">
              <button className="button-primary" type="button" onClick={focusStudio}>DECODE THE CHAT <ArrowRight size={17} /></button>
              <a className="button-secondary" href="#method">HOW IT WORKS <ArrowDownToLine size={15} /></a>
            </div>
            <div className="hero-proof"><span>LOCAL-FIRST ENGINE</span><i /> <span>NO MADE-UP RECEIPTS</span><i /> <span>YOUR DATA, YOUR BUSINESS</span></div>
          </div>

          <div className="hero-art" aria-label="Example conversation excerpts being analyzed">
            <div className="art-index"><span>CASE FILE 001</span><span>ILLUSTRATIVE COMPOSITION</span></div>
            <div className="chat-slip slip-one"><small>11:42 PM · MAYBE</small><p>“so are we actually doing this or...”</p><span className="slip-user">mia</span></div>
            <div className="chat-slip slip-two"><small>11:43 PM · CONFIRMED</small><p>“I already booked it btw”</p><span className="slip-user">jules</span></div>
            <div className="highlight-ring"><ScanSearch size={28} strokeWidth={1.35} /></div>
            <div className="annotation annotation-top"><span>01</span> open thread</div>
            <div className="annotation annotation-bottom"><span>02</span> commitment detected</div>
            <div className="art-stamp">THE<br />LORE<br /><b>IS REAL.</b></div>
            <div className="art-footer"><span>GCD / SOCIAL FORENSICS</span><span><span className="live-mark" /> ENGINE READY</span></div>
          </div>
          <div className="hero-bottomline"><span>01 — INPUT</span><span>02 — DECODE</span><span>03 — KNOW THE TEA</span><ArrowDownToLine size={16} /></div>
        </section>

        <section className="studio-section" id="studio">
          <div className="studio-head">
            <div><SectionLabel accent>NEW INVESTIGATION / INPUT 01</SectionLabel><h2>Conversation<br /><em>under review.</em></h2></div>
            <p>Paste a message dump, import a supported file, or start with a sample case. The service returns the analysis you see below.</p>
          </div>
          <div className="studio-layout">
            <div className="input-panel">
              <div className="input-panel-head">
                <span><span className="panel-indicator" /> THE EVIDENCE <i>/</i> CHAT UNDER REVIEW</span>
                <span>PRIVATE BY DESIGN <ShieldCheck size={13} /></span>
              </div>
              <div
                className={`editor-wrap${isDragging ? " is-dragging" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); loadFile(event.dataTransfer.files?.[0]); }}
              >
                <div className="editor-gutter" aria-hidden="true">01<br />02<br />03<br />04<br />05<br />06<br />07<br />08</div>
                <textarea
                  ref={textAreaRef}
                  value={chat}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={"Paste the groupchat here...\n\nMia: are we still on for tonight?\nJules: booked the table already ✨\nAri: wait what time??"}
                  spellCheck="false"
                  aria-label="Conversation text"
                />
                {!chat && <div className="drop-hint"><Upload size={14} /> DROP A .TXT OR .CSV HERE</div>}
              </div>
              <div className="editor-toolbar">
                <span>{wordCount} WORDS <i /> {lineCount} LINES</span>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,text/plain,text/csv"
                    onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = ""; }}
                    hidden
                    aria-label="Upload a text or CSV conversation"
                  />
                  <button className="toolbar-button" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> IMPORT FILE</button>
                  {chat && <button className="toolbar-button clear-button" type="button" onClick={() => setInput("")}><X size={14} /> CLEAR</button>}
                </div>
              </div>
              <div className="decode-row">
                <div className="format-note"><FileText size={15} /><span>Supports plain text + CSV<br /><small>Message labels are best-effort parsed by the analyzer.</small></span></div>
                <button className="button-primary decode-button" type="button" disabled={!chat.trim() || isAnalyzing} onClick={() => analyzeChat()}>
                  {isAnalyzing ? <><LoaderCircle className="spin" size={17} /> DECODING…</> : <>DECODE THE CHAT <ArrowRight size={17} /> </>}
                </button>
              </div>
            </div>
            <aside className="sample-panel">
              <div className="sample-panel-head"><SectionLabel>OR START WITH A CASE</SectionLabel><span>03 SAMPLES</span></div>
              <p className="sample-intro">No chat on hand? Pick a sample conversation and send it through the same analyzer.</p>
              <div className="sample-list">
                {DEMOS.map((demo, index) => (
                  <button className={`sample-option${activeDemo === demo.id ? " selected" : ""}`} key={demo.id} type="button" onClick={() => setInput(demo.text, demo.id)}>
                    <span className="sample-num">0{index + 1}</span><span className="sample-title">{demo.label}</span><ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              <button className="sample-run" type="button" disabled={isAnalyzing} onClick={() => analyzeChat()}>
                <Zap size={15} /> RUN SELECTED CASE
              </button>
              <div className="studio-privacy"><ShieldCheck size={17} /><p><strong>Not here to expose anyone.</strong><br />The local engine analyzes the text you choose to submit. Optional AI provider use depends on your backend configuration.</p></div>
            </aside>
          </div>
          {isAnalyzing && (
            <div className="processing-state" role="status" aria-live="polite">
              <span className="processing-icon"><LoaderCircle size={20} /></span>
              <div><strong>DECODER IS READING THE RECEIPTS</strong><p>Waiting for the analysis service to return its findings. No progress is being guessed.</p></div>
              <span className="processing-pulse" />
            </div>
          )}
          {error && !result && (
            <div className="feedback feedback-error" role="alert">
              <CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => analyzeChat()} disabled={isAnalyzing || !chat.trim()}><RotateCcw size={14} /> RETRY</button>
            </div>
          )}
          {notice && !error && !result && <div className="feedback feedback-notice" role="status"><Check size={16} />{notice}</div>}
        </section>

        <section className="method-section" id="method">
          <div className="method-heading">
            <SectionLabel accent>THE METHOD / NO VIBES-BASED METRICS</SectionLabel>
            <h2>Read the room.<br /><em>Keep the receipts.</em></h2>
          </div>
          <div className="method-steps">
            <article><span className="method-number">01</span><MessageSquareText size={22} /><h3>Drop the context</h3><p>Paste the conversation or bring in a .txt / .csv export.</p></article>
            <article><span className="method-number">02</span><ScanSearch size={22} /><h3>Run the decoder</h3><p>The existing analyzer finds the actual people, decisions, actions, and threads.</p></article>
            <article><span className="method-number">03</span><Fingerprint size={22} /><h3>Get the lore</h3><p>A readable case file. No invented rankings, fake timestamps, or filler.</p></article>
          </div>
        </section>

        {result && (
          <Report
            result={result}
            notice={notice}
            error={error}
            onCopy={copySummary}
            onExport={exportResult}
            onDecodeAnother={resetCase}
          />
        )}
      </main>

      <footer className="footer">
        <Logo onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <span>YOUR CHAT. YOUR CALL.</span>
        <span>GCD / v4.0</span>
      </footer>
    </div>
  );
}

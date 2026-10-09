import { ArrowDown, ArrowRight, Fingerprint, LockKeyhole, MessageSquareText, ScanSearch, ShieldCheck, Sparkles, Zap } from "lucide-react";

const fragments = [
  "wait, who said they'd send the deck?", "we said thursday right??", "did anyone book it",
  "i thought you had that", "maybe we should ask again", "ok but which version",
  "someone please confirm", "is this actually final?", "we need a name for this",
  "sorry just saw this", "what time are we meeting", "i can take that",
];

const features = [
  { number: "01", label: "OWNERSHIP", title: "Action, with an owner.", detail: "Returned tasks and assignees, surfaced from the thread.", icon: Fingerprint, color: "lime" },
  { number: "02", label: "DECISIONS", title: "The moment it clicks.", detail: "Commitments and decisions the analyzer actually found.", icon: LockKeyhole, color: "cyan" },
  { number: "03", label: "OPEN LOOPS", title: "What is still hanging.", detail: "Questions, risks, and messages worth another look.", icon: ScanSearch, color: "magenta" },
];

export default function StorySections({ onDecode, onDemo, demos }) {
  return (
    <>
      <div className="signal-marquee" aria-label="Conversation intelligence categories"><div className="marquee-track" aria-hidden="true">{Array.from({ length: 2 }, (_, index) => <span key={index}>ACTIONS <i>✳</i> DECISIONS <i>✳</i> RISKS <i>✳</i> TIMELINE <i>✳</i> OWNERS <i>✳</i> OPEN LOOPS <i>✳</i>&nbsp;</span>)}</div></div>

      <section className="problem-story" aria-label="The group chat problem">
        <div className="story-pin">
          <div className="story-heading"><span className="eyebrow">01 / THE PROBLEM · SIGNAL IN THE NOISE</span><h2>Scroll back.<br /><em>Or know.</em></h2></div>
          <div className="problem-wall">{fragments.map((fragment, index) => <div className={`problem-message fragment-${index % 6}`} key={`${fragment}-${index}`}><span>{String(index + 1).padStart(2, "0")} / THREAD</span>{fragment}</div>)}</div>
          <div className="problem-questions">{["Who owns this?", "What was decided?", "What’s still blocked?"].map((question, index) => <p className="problem-prompt" key={question}><i>0{index + 1}</i>{question}<ArrowRight size={17} /></p>)}</div>
          <span className="story-coordinates">ILLUSTRATIVE / MESSAGE COLLAGE</span>
        </div>
      </section>

      <section className="pipeline-story" aria-label="From conversation to action">
        <div className="pipeline-pin">
          <div className="pipeline-intro"><span className="eyebrow">02 / THE DECODER · FOUR MOVES</span><h2>From thread<br />to <em>traction.</em></h2><p>The messy middle, made visible.</p></div>
          <div className="pipeline-track">
            {[
              { step: "01", title: "Conversation", note: "Raw input.", icon: MessageSquareText },
              { step: "02", title: "Decoder", note: "Local analysis or configured AI.", icon: ScanSearch },
              { step: "03", title: "Intelligence", note: "Only returned findings.", icon: Sparkles },
              { step: "04", title: "Action", note: "A clearer next move.", icon: Zap },
            ].map(({ step, title, note, icon: Icon }, index) => <article className={`pipeline-node pipeline-node-${index}`} key={step}><span className="pipeline-step">/{step}</span><Icon size={27} strokeWidth={1.4} /><h3>{title}</h3><p>{note}</p>{index < 3 && <span className="pipeline-connector" aria-hidden="true"><svg viewBox="0 0 180 24"><path d="M2 12h176" pathLength="100" /></svg><ArrowRight size={15} /></span>}</article>)}
          </div>
          <span className="story-coordinates">SYS.DECODE / PIPELINE 001</span>
        </div>
      </section>

      <section className="feature-story" aria-labelledby="feature-story-title">
        <div className="feature-heading" data-reveal><div><span className="eyebrow">03 / WHAT YOU GET · STRUCTURED SIGNAL</span><h2 id="feature-story-title">Receipts, not<br /><em>made-up lore.</em></h2></div><p>Every card maps to a field the analyzer returns. Missing signal stays missing.</p></div>
        <div className="feature-grid">{features.map(({ number, label, title, detail, icon: Icon, color }) => <article className={`feature-card feature-${color}`} data-reveal key={number} onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          event.currentTarget.style.setProperty("--spot-x", `${x * 100}%`);
          event.currentTarget.style.setProperty("--spot-y", `${y * 100}%`);
          event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - y) * 3}deg`);
          event.currentTarget.style.setProperty("--tilt-y", `${(x - 0.5) * 3}deg`);
        }} onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--tilt-x", "0deg");
          event.currentTarget.style.setProperty("--tilt-y", "0deg");
        }}><span className="feature-index">{number} — {label}</span><div className="feature-glyph"><Icon size={23} /></div><h3>{title}</h3><p>{detail}</p><div className="feature-orbit" aria-hidden="true" /></article>)}</div>
      </section>

      <section className="final-cta" data-reveal>
        <span className="eyebrow"><ShieldCheck size={14} /> 04 / YOUR THREAD. YOUR CALL.</span>
        <h2>Make the<br /><em>chat make sense.</em></h2>
        <p>Your conversation is sent to the configured analysis service when you decode.</p>
        <div className="cta-actions"><button className="gradient-button" onClick={onDecode} type="button">DECODE A CHAT <ArrowDown size={17} /></button><button className="secondary-button" onClick={() => onDemo(demos[2])} type="button">JUDGE DEMO <Zap size={15} /></button></div>
        <div className="cta-chips">{demos.map((demo) => <button className="cta-chip" key={demo.id} onClick={() => onDemo(demo)} type="button">{demo.label}<ArrowRight size={12} /></button>)}</div>
      </section>
    </>
  );
}

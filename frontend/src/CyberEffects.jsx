import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { clearActiveLenis, setActiveLenis } from "./pageMotion.js";

gsap.registerPlugin(ScrollTrigger);

export function PageSystems() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = window.innerWidth < 760 || navigator.hardwareConcurrency <= 4;
    if (reduceMotion || lowPower) return undefined;

    const lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.9 });
    setActiveLenis(lenis);
    const raf = (time) => lenis.raf(time * 1000);
    const sync = () => ScrollTrigger.update();
    gsap.ticker.add(raf);
    lenis.on("scroll", sync);

    const context = gsap.context(() => {
      gsap.utils.toArray("[data-reveal]").forEach((element) => {
        gsap.fromTo(element, { autoAlpha: 0, y: 36 }, {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 86%", once: true },
        });
      });

      const problem = document.querySelector(".problem-story");
      if (problem) {
        const messages = problem.querySelectorAll(".problem-message");
        const prompts = problem.querySelectorAll(".problem-prompt");
        gsap.timeline({
          scrollTrigger: {
            trigger: problem,
            start: "top top",
            end: "+=140%",
            scrub: 0.8,
            pin: problem.querySelector(".story-pin"),
            anticipatePin: 1,
          },
        })
          .to(messages, { x: (index) => (index % 2 ? -90 : 90), y: (index) => index % 2 ? -25 : 25, rotate: (index) => (index % 2 ? -7 : 7), filter: "blur(7px)", opacity: 0.18, stagger: 0.02 }, 0)
          .fromTo(prompts, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.18, duration: 0.25 }, 0.22);
      }

      const pipeline = document.querySelector(".pipeline-story");
      const track = pipeline?.querySelector(".pipeline-track");
      if (pipeline && track) {
        gsap.to(track, {
          x: () => -Math.max(0, track.scrollWidth - pipeline.clientWidth + 80),
          ease: "none",
          scrollTrigger: {
            trigger: pipeline,
            start: "top top",
            end: () => `+=${track.scrollWidth}`,
            scrub: 0.7,
            pin: pipeline.querySelector(".pipeline-pin"),
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
      }
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh, { once: true });
    const timeout = window.setTimeout(refresh, 500);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("load", refresh);
      context.revert();
      lenis.off("scroll", sync);
      clearActiveLenis(lenis);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}

export function BootSequence({ onComplete }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 1500;
    const started = performance.now();
    const interval = window.setInterval(() => {
      const next = Math.min(100, Math.round(((performance.now() - started) / duration) * 100));
      setProgress(next);
    }, 50);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setProgress(100);
      onComplete();
    }, duration + 160);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="boot-screen" role="status" aria-live="polite" aria-label={`Initializing decoder ${progress}%`}>
      <div className="boot-frame">
        <div className="boot-mark"><span>G</span><i /></div>
        <div className="boot-lines"><p><b>SYS.DECODE</b> / BOOT SEQUENCE 01</p><p><i /> calibrating signal architecture</p><p><i /> initializing conversation engine</p><p><i /> securing the evidence channel</p></div>
        <div className="boot-progress"><span><i style={{ transform: `scaleX(${progress / 100})` }} /></span><b>{String(progress).padStart(3, "0")}%</b></div>
        <small>GROUPCHAT DECODER // CYBER-AURORA SYSTEMS</small>
      </div>
    </div>
  );
}

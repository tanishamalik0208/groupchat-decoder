import gsap from "gsap";

let activeLenis = null;

export function setActiveLenis(lenis) {
  activeLenis = lenis;
}

export function clearActiveLenis(lenis) {
  if (activeLenis === lenis) activeLenis = null;
}

export function animateDashboard(element) {
  if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
  const context = gsap.context(() => {
    gsap.fromTo(".bento-grid > * > .glass-card", { autoAlpha: 0, y: 22, scale: .985 }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: .62,
      stagger: .055,
      ease: "power3.out",
      clearProps: "opacity,visibility,transform",
    });
  }, element);
  return () => context.revert();
}

export function scrollPageTo(element, reducedMotion = false) {
  if (!element) return;
  const immediate = reducedMotion || document.visibilityState === "hidden";
  if (activeLenis && !immediate) {
    activeLenis.scrollTo(element, { offset: -82, duration: .85, easing: (time) => 1 - (1 - time) ** 4 });
    return;
  }
  element.scrollIntoView({ behavior: immediate ? "auto" : "smooth", block: "start" });
}

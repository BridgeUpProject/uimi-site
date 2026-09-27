// uimi.app interactions. Waitlist and the delivery demo work without the
// animation libraries; everything else is progressive enhancement that is
// skipped entirely for people who ask their OS for reduced motion.
(() => {
  const ENDPOINT = "https://pnfkiiaagblozzxpvbua.supabase.co/functions/v1/join-waitlist";
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const params = new URLSearchParams(location.search);
  const campaign = (params.get("utm_source") || params.get("ref") || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);

  // ---------------------------------------------------------- waitlist
  document.querySelectorAll("form.join").forEach((form) => {
    const email = form.querySelector("input[type=email]");
    const status = form.querySelector(".status");
    const button = form.querySelector("button[type=submit]");
    const label = button.querySelector(".label");
    const field = form.querySelector(".field");
    const done = document.getElementById(form.id.replace("join-", "done-"));
    email.addEventListener("input", () => { field.classList.remove("invalid"); email.removeAttribute("aria-invalid"); status.textContent = ""; status.className = "status"; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        field.classList.add("invalid");
        email.setAttribute("aria-invalid", "true");
        status.className = "status err";
        status.textContent = "Please enter a valid email address.";
        email.focus();
        return;
      }
      button.disabled = true;
      label.textContent = "Joining…";
      status.className = "status";
      status.textContent = "";
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: value,
            role: (form.querySelector("input[name=role]:checked") || {}).value || "other",
            company: form.querySelector("input[name=company]").value,
            source: campaign ? campaign + "-" + form.dataset.source : form.dataset.source,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please try again.");
        document.querySelectorAll("form.join").forEach((f) => { f.hidden = true; });
        document.querySelectorAll(".done").forEach((d) => d.classList.add("show"));
        if (window.gsap && !reduce) gsap.fromTo(done, { y: 24, autoAlpha: 0, scale: 0.98 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.9, ease: "expo.out" });
        done.focus({ preventScroll: true });
      } catch (err) {
        status.className = "status err";
        status.textContent = err instanceof TypeError ? "Couldn't reach us. Check your connection and try again." : err.message;
        button.disabled = false;
        label.textContent = "Join the waitlist";
      }
    });
  });

  const shareUrl = "https://uimi.app/?ref=share";
  document.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", async () => {
    const data = { title: "UIMI", text: "Practice the conversations nobody teaches you how to handle.", url: shareUrl };
    if (navigator.share) { try { await navigator.share(data); } catch {} return; }
    try { await navigator.clipboard.writeText(shareUrl); b.textContent = "Link copied"; } catch { b.textContent = "uimi.app"; }
  }));
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareUrl); b.textContent = "Copied"; } catch { b.textContent = "uimi.app"; }
  }));

  // ---------------------------------------------------------- demo toggle
  const toggle = document.querySelector(".toggle");
  const perception = document.getElementById("perception");
  const bar = document.getElementById("bar");
  const note = document.getElementById("demo-note");
  const sides = {
    a: { label: "Supportive", color: "var(--green)", scale: 0.82, note: "Supportive. They feel heard." },
    b: { label: "Dismissive", color: "var(--amber-deep)", scale: 0.26, note: "Dismissive. They brace for the argument." },
  };
  let side = "a";
  function setSide(next) {
    if (!toggle || next === side) return;
    side = next;
    toggle.dataset.side = next;
    toggle.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === next)));
    const s = sides[next];
    perception.textContent = s.label;
    perception.style.color = s.color;
    bar.style.transform = "scaleX(" + s.scale + ")";
    bar.style.background = s.color;
    note.textContent = s.note;
    if (window.gsap && !reduce) gsap.fromTo(perception, { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "expo.out" });
  }
  let manual = false;
  toggle?.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => { manual = true; setSide(btn.dataset.side); }));

  // ---------------------------------------------------------- motion
  if (reduce) { root.classList.add("ready"); return; }
  const start = () => {
    if (!window.gsap || !window.ScrollTrigger || !window.SplitText || !window.Lenis) { root.classList.add("ready"); return; }
    gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
    CustomEase.create("silk", "0.22,1,0.36,1");

    // Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const el = document.getElementById(a.getAttribute("href").slice(1));
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -24, duration: 1.4 });
    }));

    gsap.to(".progress", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

    // Island nav tucks away on the way down, returns on the way up.
    const nav = document.querySelector(".nav");
    let navHidden = false;
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (self) => {
        const hide = self.direction === 1 && self.scroll() > 320;
        if (hide === navHidden) return;
        navHidden = hide;
        gsap.to(nav, { yPercent: hide ? -160 : 0, duration: 0.6, ease: "silk", overwrite: "auto" });
      },
    });

    const mm = gsap.matchMedia();
    const intro = document.querySelector(".hero");

    // ---------------- intro
    if (!intro) {
      gsap.set("[data-intro]", { visibility: "visible" });
      root.classList.add("ready");
    }
    if (intro) {
      const split = new SplitText("[data-split]", { type: "lines,words", mask: "lines", linesClass: "line" });
      gsap.set("[data-intro]", { visibility: "visible" });
      const tl = gsap.timeline({ defaults: { ease: "silk", duration: 1.2 } });
      tl.from(nav, { y: -30, autoAlpha: 0, duration: 1 })
        .from(".nav .dot", { y: -22, autoAlpha: 0, ease: "back.out(3.5)", stagger: 0.09, duration: 0.7 }, "-=.55")
        .from(".hero .pill", { y: 14, autoAlpha: 0, duration: 0.8 }, "-=.7")
        .from(split.words, { yPercent: 110, stagger: 0.035, duration: 1.1 }, "-=.6")
        .from(".hero .lede", { y: 26, autoAlpha: 0 }, "-=.85")
        .from("#join-hero", { y: 26, autoAlpha: 0 }, "-=1")
        .from(".phone-wrap", { y: 90, rotateX: 18, rotateY: -12, autoAlpha: 0, duration: 1.6, transformPerspective: 1400 }, "-=1.35")
        .from(".sat", { scale: 0.5, autoAlpha: 0, stagger: 0.12, ease: "back.out(2.2)", duration: 0.9 }, "-=.9")
        .from(".phone .meter b", { scaleX: 0, stagger: 0.18, duration: 0.9 }, "-=.7")
        .fromTo(".phone .verdict", { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.9 }, "-=.9")
        .add(() => root.classList.add("ready"));

      // Satellites drift at different depths, the phone rises slower than the page.
      gsap.utils.toArray(".sat").forEach((el) => {
        gsap.to(el, { y: () => -120 * Number(el.dataset.depth), ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.8 } });
      });
      gsap.to(".stage", { y: -70, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.8 } });

      // Idle float, then tilt toward the pointer on desktop.
      gsap.to(".phone", { y: -10, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
      if (fine) {
        const rx = gsap.quickTo(".phone", "rotationX", { duration: 1.1, ease: "power3" });
        const ry = gsap.quickTo(".phone", "rotationY", { duration: 1.1, ease: "power3" });
        gsap.set(".phone", { transformPerspective: 1200 });
        intro.addEventListener("pointermove", (e) => {
          const r = intro.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 14);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
        });
        intro.addEventListener("pointerleave", () => { rx(0); ry(0); });
      }
    }

    // ---------------- marquee that answers scroll speed
    document.querySelectorAll(".mrow").forEach((row) => {
      const dir = Number(row.dataset.dir);
      const tween = gsap.fromTo(row, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 48, ease: "none", repeat: -1 });
      let reset;
      ScrollTrigger.create({
        trigger: row, start: "top bottom", end: "bottom top",
        onUpdate: (self) => {
          const boost = gsap.utils.clamp(-5, 5, self.getVelocity() / 350);
          gsap.to(tween, { timeScale: 1 + Math.abs(boost), duration: 0.2, overwrite: true });
          clearTimeout(reset);
          reset = setTimeout(() => gsap.to(tween, { timeScale: 1, duration: 1.2, ease: "power2.out" }), 120);
        },
      });
    });

    // ---------------- manifesto lights up word by word
    const scrub = document.querySelector("[data-scrub]");
    if (scrub) {
      // aria "none": the words stay real text, so screen readers read the
      // paragraph as written; a label on a <p> is not allowed.
      const words = new SplitText(scrub, { type: "words", wordsClass: "word", aria: "none" }).words;
      gsap.fromTo(words, { opacity: 0.14 }, { opacity: 1, stagger: 0.12, ease: "none", scrollTrigger: { trigger: scrub, start: "top 78%", end: "bottom 42%", scrub: 0.6 } });
    }

    mm.add("(min-width: 1024px) and (min-height: 700px)", () => {
      // How it works: pinned, sideways.
      const track = document.querySelector(".how-track");
      const distance = () => track.scrollWidth - track.parentElement.clientWidth;
      const tl = gsap.timeline({ scrollTrigger: { trigger: ".how", start: "center center", end: () => "+=" + (distance() + innerHeight * 0.4), pin: true, scrub: 0.9, invalidateOnRefresh: true } });
      tl.to(track, { x: () => -distance(), ease: "none" }, 0).to(".how-progress i", { scaleX: 1, ease: "none" }, 0);

      // Same words demo: pinned, and the delivery flips halfway through.
      ScrollTrigger.create({
        trigger: ".demo-sec", start: "center center", end: "+=110%", pin: true,
        onUpdate: (self) => { if (!manual) setSide(self.progress > 0.5 ? "b" : "a"); },
      });
    });
    mm.add("(max-width: 1023px), (max-height: 699px)", () => {
      gsap.utils.toArray("[data-step]").forEach((el) => gsap.fromTo(el, { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: "silk", scrollTrigger: { trigger: el, start: "top 88%", once: true } }));
      ScrollTrigger.create({ trigger: ".demo-sec .toggle", start: "top 60%", once: true, onEnter: () => setTimeout(() => { if (!manual) setSide("b"); }, 1600) });
    });

    // ---------------- generic reveals
    gsap.set("[data-reveal], [data-row]", { autoAlpha: 0 });
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 88%",
      once: true,
      onEnter: (els) => gsap.fromTo(els, { y: 70, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.3, ease: "silk", stagger: 0.09, overwrite: true }),
    });
    ScrollTrigger.batch("[data-row]", {
      start: "top 92%", once: true,
      onEnter: (els) => gsap.fromTo(els, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: "silk", stagger: 0.07 }),
    });

    // ---------------- counters
    document.querySelectorAll("[data-count]").forEach((el) => {
      const to = Number(el.dataset.count);
      const o = { v: 0 };
      el.textContent = "0";
      ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: "expo.out", onUpdate: () => { el.textContent = Math.round(o.v); } }) });
    });

    // ---------------- privacy block expands to the full width
    gsap.fromTo(".dark-shell", { scale: 0.92, borderRadius: 64 }, { scale: 1, borderRadius: 0, ease: "none", scrollTrigger: { trigger: ".dark-shell", start: "top bottom", end: "top 25%", scrub: 0.6 } });

    // ---------------- FAQ answers ease open
    document.querySelectorAll(".faq details").forEach((d) => d.addEventListener("toggle", () => {
      if (d.open) gsap.fromTo(d.querySelector("p"), { y: -8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "silk" });
    }));

    // ---------------- the penguin waddles in to close
    const pen = document.querySelector(".closing-penguin");
    if (pen) {
      gsap.fromTo(pen, { x: -140, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.6, ease: "silk", scrollTrigger: { trigger: pen, start: "top 90%", once: true } });
      gsap.fromTo(pen, { rotation: -7 }, { rotation: 7, duration: 0.42, ease: "sine.inOut", yoyo: true, repeat: 5, scrollTrigger: { trigger: pen, start: "top 90%", once: true }, onComplete: () => gsap.to(pen, { rotation: 0, duration: 0.5 }) });
    }

    // ---------------- magnetic buttons
    if (fine) {
      document.querySelectorAll(".magnetic").forEach((el) => {
        const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
        const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
        el.addEventListener("pointermove", (e) => {
          const r = el.getBoundingClientRect();
          x((e.clientX - r.left - r.width / 2) * 0.22);
          y((e.clientY - r.top - r.height / 2) * 0.3);
        });
        el.addEventListener("pointerleave", () => { x(0); y(0); });
      });
    }

    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  };

  // Split lines only once the fonts have loaded, or the line breaks are wrong.
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]);
  const domReady = document.readyState === "loading" ? new Promise((r) => document.addEventListener("DOMContentLoaded", r)) : Promise.resolve();
  Promise.all([fontsReady, domReady]).then(start);
})();

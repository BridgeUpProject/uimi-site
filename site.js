// uimi.app runtime: the waitlist, the delivery demo, and all of the motion.
//
// Motion plays for every visitor, including people whose device asks for
// reduced motion (the founder's call). "Pause animations" in the footer
// stops it for the rest of the visit; nothing is saved.
//
// Libraries, all served from uimi.app: GSAP (ScrollTrigger, SplitText,
// CustomEase, Flip, ScrambleText, Physics2D) runs the scroll choreography,
// anime.js draws the underline and the privacy icons and ripples the dot
// grid, Motion gives the pointer-driven pieces their springs, and Lenis
// smooths the scroll.
// The waitlist and the demo work without any of them.
(() => {
  "use strict";
  const CONFIG = {"endpoint":"https://pnfkiiaagblozzxpvbua.supabase.co/functions/v1/join-waitlist"};
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let lenis = null;
  let paused = false;
  let stopMotion = null;
  const hooks = { side: null, hop: null };

  // Motion and Lenis would quietly switch themselves off for devices that
  // ask for reduced motion; this site animates for everyone.
  if (window.Motion) {
    Motion.hasReducedMotionListener.current = true;
    Motion.prefersReducedMotion.current = false;
  }

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
    // "I'm a ...": one pressed at a time, Parent by default.
    const roles = $$(".roles button", form);
    roles.forEach((b) => b.addEventListener("click", () => roles.forEach((o) => o.setAttribute("aria-pressed", String(o === b)))));
    email.addEventListener("input", () => {
      field.classList.remove("invalid");
      email.removeAttribute("aria-invalid");
      status.textContent = "";
      status.className = "status";
    });
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
        const res = await fetch(CONFIG.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: value,
            role: roles.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.role || "parent",
            company: form.querySelector("input[name=company]").value,
            source: campaign ? campaign + "-" + form.dataset.source : form.dataset.source,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please try again.");
        const from = button.getBoundingClientRect();
        document.querySelectorAll("form.join").forEach((f) => { f.hidden = true; });
        document.querySelectorAll(".done").forEach((d) => d.classList.add("show"));
        if (window.gsap && !paused) {
          gsap.fromTo(done, { y: 24, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "expo.out", clearProps: "transform,opacity" });
          celebrate(from);
          if (hooks.hop) hooks.hop();
        }
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
    const data = { title: "UIMI", text: "Say it out loud. See how you came across.", url: shareUrl };
    if (navigator.share) { try { await navigator.share(data); } catch {} return; }
    try { await navigator.clipboard.writeText(shareUrl); b.textContent = "Link copied"; } catch { b.textContent = "uimi.app"; }
  }));
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareUrl); b.textContent = "Copied"; } catch { b.textContent = "uimi.app"; }
  }));

  // Dots burst out of the button when someone joins.
  function celebrate(rect) {
    const G = window.gsap;
    if (!G || !window.Physics2DPlugin) return;
    G.registerPlugin(Physics2DPlugin);
    const layer = document.createElement("div");
    layer.className = "confetti";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
    const colors = ["#6B8FCA", "#4A6EA9", "#2F3740", "#C98A4B", "#35674F"];
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    for (let i = 0; i < 44; i++) {
      const d = document.createElement("i");
      if (i % 3 === 0) d.className = "p";
      d.style.background = colors[i % colors.length];
      layer.append(d);
      G.set(d, { x, y, rotation: G.utils.random(0, 360) });
      G.to(d, { duration: G.utils.random(1.4, 2.2), physics2D: { velocity: G.utils.random(420, 860), angle: G.utils.random(-165, -15), gravity: 1400 }, rotation: "+=" + G.utils.random(-540, 540), ease: "none" });
      G.to(d, { autoAlpha: 0, duration: 0.4, delay: G.utils.random(0.9, 1.6) });
    }
    setTimeout(() => layer.remove(), 2700);
  }

  // ---------------------------------------------------------- situations: tabs by practice area
  // Without scripts every area shows as a list; with them, one at a time.
  const tabBox = $(".tabs");
  const tabs = $$('.tablist [role="tab"]');
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  let tabInd = null;
  let current = 0;
  // The dark pill behind the chosen tab (GSAP Flip fits it to the tab).
  function placeInd(animate) {
    const tab = tabs[current];
    if (!tabInd || !tab) return null;
    if (window.gsap && window.Flip) {
      gsap.registerPlugin(Flip);
      return Flip.fit(tabInd, tab, animate ? { scale: false, duration: 0.5, ease: "power3.out" } : { scale: false });
    }
    Object.assign(tabInd.style, { left: tab.offsetLeft + "px", top: tab.offsetTop + "px", width: tab.offsetWidth + "px", height: tab.offsetHeight + "px" });
    return null;
  }
  if (tabBox && tabs.length) {
    tabBox.classList.add("js-tabs");
    panels.forEach((p, i) => { p.removeAttribute("data-idle"); p.hidden = i !== 0; });
    window.uimiRan = true;
    tabInd = Object.assign(document.createElement("span"), { className: "tab-ind" });
    tabInd.setAttribute("aria-hidden", "true");
    tabs[0].parentElement.prepend(tabInd);
    tabs[0].classList.add("lit");
    const select = (i, focus) => {
      if (i === current) return;
      current = i;
      tabs.forEach((t, k) => {
        t.setAttribute("aria-selected", String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        if (k !== i) t.classList.remove("lit");
      });
      panels.forEach((p, k) => { p.hidden = k !== i; });
      if (focus) tabs[i].focus({ preventScroll: true });
      const list = tabs[i].parentElement;
      if (list.scrollWidth > list.clientWidth + 1) list.scrollTo({ left: Math.max(0, tabs[i].offsetLeft - 18), behavior: paused ? "auto" : "smooth" });
      if (hooks.tab) hooks.tab(i);
      else {
        placeInd(false);
        tabs[i].classList.add("lit");
      }
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        const n = tabs.length;
        const k = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (k === undefined) return;
        e.preventDefault();
        select(k, true);
      });
    });
    window.addEventListener("resize", () => placeInd(false));
  }

  // The privacy section's dot grid: a wide block on desktop, a band on phones.
  const grid = { box: $(".dots"), cols: 0, rows: 0, dots: [] };
  function buildDots() {
    if (!grid.box) return;
    const wide = innerWidth >= 980;
    const cols = wide ? 14 : Math.max(8, Math.min(12, Math.floor((grid.box.parentElement.clientWidth - 12) / 21)));
    const rows = wide ? 7 : 4;
    if (grid.box.dataset.grid === cols + "x" + rows) return;
    grid.box.dataset.grid = cols + "x" + rows;
    grid.box.style.setProperty("--cols", String(cols));
    grid.box.innerHTML = "<i></i>".repeat(cols * rows);
    Object.assign(grid, { cols, rows, dots: $$("i", grid.box) });
  }
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildDots, 200);
  });

  // ---------------------------------------------------------- shared pieces
  function ensureSwoosh() {
    const mark = $(".hero .mark");
    if (!mark) return null;
    let svg = $(".swoosh", mark);
    if (!svg) {
      mark.insertAdjacentHTML("beforeend", '<svg class="swoosh" viewBox="0 0 300 26" aria-hidden="true" focusable="false"><path d="M4 19C64 9 168 5 296 11"/></svg>');
      svg = $(".swoosh", mark);
    }
    return svg;
  }
  const cleanDrawable = (el) => {
    el.removeAttribute("pathLength");
    el.removeAttribute("stroke-dasharray");
    el.removeAttribute("stroke-dashoffset");
    el.style.strokeLinecap = "";
  };

  const haveCore = () => !!(window.gsap && window.ScrollTrigger && window.Lenis);

  // If the animation libraries fail to load, the page still shows everything.
  function startOff() {
    root.classList.add("ready");
    ensureSwoosh();
    buildDots();
    placeInd(false);
  }

  let registered = false;
  function registerOnce() {
    if (registered) return;
    registered = true;
    gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.CustomEase, window.Flip, window.ScrambleTextPlugin, window.Physics2DPlugin].filter(Boolean));
    gsap.config({ nullTargetWarn: false });
    if (window.CustomEase) CustomEase.create("silk", "0.22,1,0.36,1");
  }

  // ---------------------------------------------------------- motion
  function startOn(playIntro) {
    registerOnce();
    const G = gsap;
    const ST = ScrollTrigger;
    const A = window.anime;
    const M = window.Motion;
    const SplitText = window.SplitText;
    const Flip = window.Flip;
    const ease = window.CustomEase ? "silk" : "expo.out";

    const ac = new AbortController();
    const on = (el, type, fn, opts) => el && el.addEventListener(type, fn, { ...opts, signal: ac.signal });
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    const undo = [];
    const animes = [];
    const springs = new Map();
    const spring = (el, keyframes, options = { type: "spring", stiffness: 380, damping: 30 }) => {
      if (!M || !el) return null;
      const c = M.animate(el, keyframes, options);
      springs.set(el, c);
      return c;
    };
    // Everything below the fold starts hidden and plays on the way in;
    // anything already on screen or scrolled past is left alone.
    const below = (el) => el.getBoundingClientRect().top > innerHeight * 0.9;

    // Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, respectReducedMotion: false });
    const tick = (t) => lenis && lenis.raf(t * 1000);
    lenis.on("scroll", ST.update);
    G.ticker.add(tick);
    G.ticker.lagSmoothing(0);
    undo.push(() => {
      G.ticker.remove(tick);
      lenis.destroy();
      lenis = null;
      G.ticker.lagSmoothing(500, 33);
    });
    $$('a[href^="#"]:not(.skip)').forEach((a) => on(a, "click", (e) => {
      const el = document.getElementById(a.getAttribute("href").slice(1));
      if (!el || !lenis) return;
      e.preventDefault();
      lenis.scrollTo(el, {
        offset: -24,
        duration: 1.4,
        onComplete: () => {
          if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
          el.focus({ preventScroll: true });
        },
      });
    }));

    // ctx holds what is built up front; animations made later, in callbacks,
    // go into late. Once teardown starts, callbacks make nothing new.
    const ctx = G.context(() => {});
    const late = G.context(() => {});
    let dead = false;
    const inCtx = (fn) => (...args) => (dead ? undefined : late.add(() => fn(...args)));
    const mm = G.matchMedia();

    ctx.add(() => {
      G.to(".progress", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

      // ------------------------------------------------ island nav
      // It slips away while you read down the page and comes back when you
      // scroll up. On the landing page below 1024px it also waits until the
      // masthead, which carries the brand, has scrolled away.
      root.classList.add("motion-on");
      undo.push(() => root.classList.remove("motion-on"));
      const nav = $(".nav");
      const mast = $(".masthead");
      const mastEnd = () => (mast && innerWidth < 1024 ? mast.offsetTop + mast.offsetHeight : 0);
      let navHidden = scrollY < mastEnd();
      if (navHidden) G.set(nav, { yPercent: -220 });
      const navTo = inCtx((hide) => G.to(nav, { yPercent: hide ? -220 : 0, duration: 0.6, ease, overwrite: "auto" }));
      ST.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          const y = self.scroll();
          const hide = y < mastEnd() || (self.direction === 1 && (navHidden || y > 320));
          if (hide === navHidden) return;
          navHidden = hide;
          navTo(hide);
        },
      });
      on(nav, "focusin", () => { if (navHidden) { navHidden = false; navTo(false); } });

      // A pill slides behind the link for the section on screen.
      const hl = $(".nav-hl");
      const links = $$(".nav a.link[href^='#']");
      if (hl && links.length && M) {
        const clipFor = (a) => {
          const b = hl.parentElement.getBoundingClientRect();
          const r = a.getBoundingClientRect();
          return `inset(0px ${(b.right - r.right).toFixed(1)}px 0px ${(r.left - b.left).toFixed(1)}px round 999px)`;
        };
        let current = null;
        const show = (a) => {
          if (a === current) return;
          links.forEach((l) => l.classList.toggle("on", l === a));
          if (!a) spring(hl, { opacity: 0 }, { duration: 0.2 });
          else if (!current) {
            hl.style.clipPath = clipFor(a);
            spring(hl, { opacity: 1 }, { duration: 0.2 });
          } else spring(hl, { clipPath: clipFor(a), opacity: 1 }, { type: "spring", stiffness: 420, damping: 36 });
          current = a;
        };
        links.forEach((a) => {
          const section = document.getElementById(a.getAttribute("href").slice(1));
          if (section) ST.create({ trigger: section, start: "top 50%", end: "bottom 50%", onToggle: (self) => { if (self.isActive) show(a); else if (current === a) show(null); } });
        });
        undo.push(() => links.forEach((l) => l.classList.remove("on")));
      }

      // ------------------------------------------------ hero
      const hero = $(".hero");
      const drawSwoosh = (animate) => {
        const svg = ensureSwoosh();
        if (!svg || !animate || !A) return;
        const paths = $$("path", svg);
        animes.push(A.animate(A.svg.createDrawable(paths), { draw: ["0 0", "0 1"], duration: 900, delay: A.stagger(260), ease: "inOutQuad" }));
        undo.push(() => paths.forEach(cleanDrawable));
      };
      const startPenguin = inCtx(penguin);
      if (hero && playIntro && SplitText) {
        $(".hero .swoosh")?.remove();
        // The penguin is left out of the split so it can make its own entrance.
        const split = new SplitText("[data-split]", { type: "lines,words", mask: "lines", ignore: ".hero-penguin" });
        G.set("[data-intro]", { visibility: "visible" });
        const intro = G.timeline({ defaults: { ease, duration: 1.2 } })
          .from(".masthead .wordmark", { y: -24, autoAlpha: 0, duration: 1 })
          .from(".masthead .dot", { y: -24, autoAlpha: 0, ease: "back.out(3.5)", stagger: 0.09, duration: 0.7 }, "-=.55")
          .from(".masthead-tag", { x: -12, autoAlpha: 0, duration: 0.8 }, "<+=.15");
        if (!navHidden) intro.from(nav, { y: -30, autoAlpha: 0, duration: 1, clearProps: "opacity,visibility" }, 0.2);
        intro
          .from(".hero .pill", { y: 14, autoAlpha: 0, duration: 0.8 }, "-=.5")
          .from(split.words, { yPercent: 115, rotation: 5, transformOrigin: "0% 100%", stagger: 0.035, duration: 1.1 }, "-=.6")
          .from(".hero-penguin", { yPercent: 70, scale: 0.3, rotation: -18, autoAlpha: 0, duration: 0.9, ease: "back.out(2.2)" }, "-=.95")
          .from(".hero .lede", { y: 26, autoAlpha: 0 }, "-=.85")
          .from("#join-hero", { y: 26, autoAlpha: 0 }, "-=.75")
          // The phone rises into place once, its bar fills to where the answer
          // came across, and 1.5s later "Attempt 2 · Strong" arrives below it.
          // Nothing in the hero loops.
          .from(".phone-wrap", { y: 40, autoAlpha: 0, duration: 1.2 }, "-=1.35")
          .addLabel("bar", "-=.5")
          .from(".phone .meter b", { scaleX: 0, stagger: 0.2, duration: 0.9 }, "bar")
          .from(".next-chip", { y: 10, autoAlpha: 0, duration: 0.6 }, "bar+=1.5")
          .add(() => {
            root.classList.add("ready");
            split.revert();
            drawSwoosh(true);
            startPenguin();
          });
      } else {
        root.classList.add("ready");
        startPenguin();
        drawSwoosh(false);
      }

      // The penguin at the corner of the headline hops when you touch it and
      // when someone joins. It is looked up fresh because the headline's split
      // and revert rebuild what is inside it.
      function penguin() {
        const pen = () => $(".hero-penguin");
        if (!pen()) return;
        // Squash, hop, land, settle.
        hooks.hop = inCtx(() => {
          const el = pen();
          if (!el || G.isTweening(el)) return;
          G.timeline()
            .to(el, { scaleY: 0.84, scaleX: 1.1, duration: 0.12, ease: "power2.out" })
            .to(el, { yPercent: -38, scaleY: 1.07, scaleX: 0.95, duration: 0.3, ease: "power2.out" })
            .to(el, { yPercent: 0, scaleY: 1, scaleX: 1, duration: 0.3, ease: "power2.in" })
            .to(el, { scaleY: 0.9, scaleX: 1.06, duration: 0.1, ease: "power1.out" })
            .to(el, { scaleY: 1, scaleX: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        });
        undo.push(() => { hooks.hop = null; });
        const title = $("#hero-title");
        const onPenguin = (e) => { if (e.target.closest && e.target.closest(".hero-penguin")) hooks.hop && hooks.hop(); };
        on(title, "pointerover", onPenguin);
        on(title, "click", onPenguin);
      }

      // ------------------------------------------------ the privacy statement lights up as you read
      const scrub = $("[data-scrub]");
      if (scrub && SplitText) {
        // aria "none": the words stay real text, so screen readers read the
        // heading as written.
        const words = new SplitText(scrub, { type: "words", wordsClass: "word", aria: "none" }).words;
        scrub.classList.add("hl-split");
        undo.push(() => scrub.classList.remove("hl-split"));
        G.fromTo(words, { opacity: 0.14 }, { opacity: 1, stagger: 0.12, ease: "none", scrollTrigger: { trigger: scrub, start: "top 78%", end: "bottom 42%", scrub: 0.6 } });
        const marked = words.filter((w) => w.closest(".hl"));
        G.fromTo(marked, { "--hl": 0 }, { "--hl": 1, stagger: 0.25, ease: "none", scrollTrigger: { trigger: scrub, start: "top 52%", end: "bottom 46%", scrub: 0.6 } });
      }

      // ------------------------------------------------ generic reveals
      const reveal = $$("[data-reveal]").filter(below);
      G.set(reveal, { autoAlpha: 0, y: 70 });
      ST.batch(reveal, { start: "top 88%", once: true, onEnter: inCtx((els) => G.to(els, { y: 0, autoAlpha: 1, duration: 1.3, ease, stagger: 0.09, overwrite: true })) });
      const listRows = $$("[data-row]").filter(below);
      G.set(listRows, { autoAlpha: 0, y: 40 });
      ST.batch(listRows, { start: "top 92%", once: true, onEnter: inCtx((els) => G.to(els, { y: 0, autoAlpha: 1, duration: 1.1, ease, stagger: 0.07 })) });

      // ------------------------------------------------ numbers roll like an odometer
      $$("[data-count]").filter(below).forEach((b) => {
        const value = b.dataset.count;
        const digits = value.split("");
        const strip = "0123456789".repeat(3).split("").map((d) => `<span>${d}</span>`).join("");
        b.innerHTML = `<span class="sr-only">${value}</span><span class="odo" aria-hidden="true">${digits.map(() => `<span class="odo-col">${strip}</span>`).join("")}</span>`;
        undo.push(() => { b.textContent = value; });
        const cols = $$(".odo-col", b);
        ST.create({
          trigger: b,
          start: "top 90%",
          once: true,
          onEnter: inCtx(() => cols.forEach((col, i) => G.to(col, { yPercent: -((20 + Number(digits[i])) / 30) * 100, duration: 2.2 + i * 0.3, ease: "expo.out", delay: i * 0.08 }))),
        });
      });

      // Cards lift off their trays under the pointer (Motion springs).
      if (fine && M) {
        const lift = M.hover($$(".pgrid li > div"), (el) => {
          spring(el, { transform: "translateY(-6px)" }, { type: "spring", stiffness: 300, damping: 22 });
          return () => spring(el, { transform: "translateY(0px)" }, { type: "spring", stiffness: 300, damping: 26 });
        });
        undo.push(lift);
      }

      // ------------------------------------------------ situations
      placeInd(false);
      hooks.tab = inCtx((i) => {
        placeInd(true);
        later(() => tabs[i] && tabs[i].classList.add("lit"), 200);
        const panel = panels[i];
        G.fromTo([$(".tab-sub", panel), ...$$(".sit-chips li", panel)].filter(Boolean), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease, stagger: 0.03, clearProps: "transform,opacity,visibility" });
      });
      undo.push(() => { hooks.tab = null; });

      // On desktop, a card follows the pointer with each situation's setup.
      if (fine && M && tabBox) {
        const peek = document.createElement("div");
        peek.className = "peek";
        peek.setAttribute("aria-hidden", "true");
        peek.innerHTML = '<div class="bezel"><div class="core"><span class="small-label"></span><p></p></div></div>';
        document.body.append(peek);
        undo.push(() => peek.remove());
        const face = $(".bezel", peek);
        const title = $(".small-label", peek);
        const text = $("p", peek);
        const px = G.quickTo(peek, "x", { duration: 0.55, ease: "power3" });
        const py = G.quickTo(peek, "y", { duration: 0.55, ease: "power3" });
        let shown = false;
        let chip = null;
        let last = null;
        const place = (x, y, now) => {
          const tx = Math.min(x + 26, innerWidth - peek.offsetWidth - 16);
          const ty = Math.max(16, Math.min(y + 22, innerHeight - peek.offsetHeight - 16));
          if (now) G.set(peek, { x: tx, y: ty });
          px(tx);
          py(ty);
        };
        const hide = () => {
          if (!shown) return;
          shown = false;
          chip = null;
          spring(face, { opacity: 0, transform: "scale(0.92)" }, { duration: 0.16 });
        };
        const update = (x, y) => {
          const li = document.elementFromPoint(x, y)?.closest(".sit-chips li");
          if (!li || !tabBox.contains(li) || !li.dataset.peek) return hide();
          if (li !== chip) {
            chip = li;
            title.textContent = li.textContent;
            text.textContent = li.dataset.peek;
          }
          if (!shown) {
            shown = true;
            place(x, y, true);
            spring(face, { opacity: 1, transform: "scale(1)" }, { type: "spring", stiffness: 420, damping: 30 });
          } else place(x, y, false);
        };
        on(tabBox, "pointermove", (e) => { last = [e.clientX, e.clientY]; update(e.clientX, e.clientY); });
        on(tabBox, "pointerleave", () => { last = null; hide(); });
        on(window, "keydown", (e) => { if (e.key === "Escape") hide(); });
        lenis.on("scroll", () => { if (last) update(last[0], last[1]); });
      }

      // ------------------------------------------------ privacy
      if ($(".dark-shell")) G.fromTo(".dark-shell", { scale: 0.92, borderRadius: 64 }, { scale: 1, borderRadius: 0, ease: "none", scrollTrigger: { trigger: ".dark-shell", start: "top bottom", end: "top 25%", scrub: 0.6 } });

      // The dot grid ripples like sound (anime.js grid stagger): once on the
      // way in, now and then on its own, and from wherever the pointer is.
      buildDots();
      const shell = $(".dark-shell");
      if (A && grid.box && shell) {
        let lastRipple = 0;
        let ambient = null;
        const ripple = (from) => {
          const now = performance.now();
          if (now - lastRipple < 380 || !grid.dots.length) return;
          lastRipple = now;
          A.animate(grid.dots, {
            scale: [{ to: 2.3, duration: 240, ease: "outQuad" }, { to: 1, duration: 720, ease: "inOutQuad" }],
            opacity: [{ to: 1, duration: 240, ease: "outQuad" }, { to: 0.3, duration: 720, ease: "inOutQuad" }],
            delay: A.stagger(42, { grid: [grid.cols, grid.rows], from }),
          });
        };
        const center = () => Math.floor(grid.rows / 2) * grid.cols + Math.floor(grid.cols / 2);
        ST.create({
          trigger: shell,
          start: "top 70%",
          end: "bottom 30%",
          onToggle: (self) => {
            clearInterval(ambient);
            if (!self.isActive) return;
            ripple(center());
            ambient = setInterval(() => { if (!document.hidden) ripple(Math.floor(Math.random() * grid.dots.length)); }, 3400);
          },
        });
        if (fine) on(shell, "pointermove", (e) => {
          const r = grid.box.getBoundingClientRect();
          const col = Math.round(G.utils.clamp(0, 1, (e.clientX - r.left) / r.width) * (grid.cols - 1));
          const row = Math.round(G.utils.clamp(0, 1, (e.clientY - r.top) / r.height) * (grid.rows - 1));
          ripple(row * grid.cols + col);
        });
        undo.push(() => {
          clearInterval(ambient);
          A.utils.remove(grid.dots);
          grid.dots.forEach((d) => d.removeAttribute("style"));
        });
      }

      // Each privacy promise draws its own icon (anime.js).
      if (A) $$(".pgrid li").filter(below).forEach((c) => {
        const shapes = $$(".k svg > *", c);
        if (!shapes.length) return;
        const pens = A.svg.createDrawable(shapes);
        undo.push(() => shapes.forEach(cleanDrawable));
        ST.create({ trigger: c, start: "top 82%", once: true, onEnter: () => animes.push(A.animate(pens, { draw: ["0 0", "0 1"], duration: 1000, delay: A.stagger(140, { start: 250 }), ease: "inOutQuad" })) });
      });

      // ------------------------------------------------ FAQ answers open and close smoothly
      $$(".faq details").forEach((d) => {
        const sum = $("summary", d);
        const ans = $(".ans", d);
        if (!sum || !ans) return;
        let open = d.open;
        on(sum, "click", inCtx((e) => {
          e.preventDefault();
          open = !open;
          if (open) {
            const from = d.open ? ans.offsetHeight : 0;
            d.open = true;
            d.classList.remove("closing");
            G.fromTo(ans, { height: from, autoAlpha: from ? 1 : 0 }, { height: "auto", autoAlpha: 1, duration: 0.5, ease, overwrite: true, clearProps: "height,opacity,visibility" });
          } else {
            d.classList.add("closing");
            G.to(ans, {
              height: 0,
              autoAlpha: 0,
              duration: 0.36,
              ease: "power2.out",
              overwrite: true,
              onComplete: () => {
                if (!open) d.open = false;
                d.classList.remove("closing");
                G.set(ans, { clearProps: "height,opacity,visibility" });
              },
            });
          }
        }));
      });
      undo.push(() => $$(".faq details").forEach((d) => d.classList.remove("closing")));

      // ------------------------------------------------ closing
      const closingTitle = $("[data-chars]");
      if (closingTitle && SplitText && below(closingTitle)) {
        const split = new SplitText(closingTitle, { type: "words,chars", mask: "words" });
        G.set(split.chars, { yPercent: 110, rotation: 8 });
        ST.create({ trigger: closingTitle, start: "top 86%", once: true, onEnter: inCtx(() => G.to(split.chars, { yPercent: 0, rotation: 0, duration: 0.9, ease: "back.out(1.6)", stagger: 0.035 })) });
      }

      // ------------------------------------------------ the sign-off wordmark
      const big = $(".bigmark");
      if (big) {
        const letters = $$(".ch", big);
        const dots = $$(".dot", big);
        const eyes = $$(".dot b", big);
        if (below(big)) {
          G.set(letters, { yPercent: 100 });
          G.set(dots, { yPercent: -520, autoAlpha: 0 });
          ST.create({
            trigger: big,
            start: "top 90%",
            once: true,
            onEnter: inCtx(() => {
              G.to(letters, { yPercent: 0, duration: 1.2, ease, stagger: 0.07 });
              G.to(dots, { yPercent: 0, autoAlpha: 1, duration: 1, ease: "bounce.out", stagger: 0.14, delay: 0.55 });
            }),
          });
        }
        // Its dots keep an eye on the pointer (Motion springs).
        if (fine && M) {
          let watching = false;
          let frame = 0;
          let px = 0;
          let py = 0;
          ST.create({ trigger: big, start: "top bottom", end: "bottom top", onToggle: (self) => { watching = self.isActive; } });
          const look = () => {
            frame = 0;
            eyes.forEach((eye) => {
              const r = eye.parentElement.getBoundingClientRect();
              const dx = px - (r.left + r.width / 2);
              const dy = py - (r.top + r.height / 2);
              const d = Math.hypot(dx, dy) || 1;
              const k = Math.min(1, d / 480) * r.width * 0.2;
              spring(eye, { transform: `translate(${((dx / d) * k).toFixed(1)}px, ${((dy / d) * k).toFixed(1)}px)` }, { type: "spring", stiffness: 170, damping: 14 });
            });
          };
          on(window, "pointermove", (e) => {
            if (!watching) return;
            px = e.clientX;
            py = e.clientY;
            if (!frame) frame = requestAnimationFrame(look);
          });
          undo.push(() => cancelAnimationFrame(frame));
        }
      }

      // ------------------------------------------------ magnetic buttons
      if (fine) {
        $$(".magnetic").forEach((el) => {
          const x = G.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
          const y = G.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
          on(el, "pointermove", (e) => {
            const r = el.getBoundingClientRect();
            x((e.clientX - r.left - r.width / 2) * 0.22);
            y((e.clientY - r.top - r.height / 2) * 0.3);
          });
          on(el, "pointerleave", () => { x(0); y(0); });
        });
      }
    });


    // ------------------------------------------------ how it works: the practice loop
    // Built outside ctx: matchMedia runs its own contexts, and a context
    // that is active inside another one must never add to its parent.
    const steps = $$("[data-step]");
    const q = (i, sel) => (steps[i] ? $(sel, steps[i]) : null);
    const qa = (i, sel) => (steps[i] ? $$(sel, steps[i]) : []);
    // Steps still below the fold start from their "before" state and play
    // in; anything already on screen is left as it is.
    const primed = steps.map((st) => below(st));
    const chips = qa(0, ".vis-chips span");
    const chosen = chips.findIndex((c) => c.classList.contains("on"));
    const time = q(1, ".rec-time");
    const timeFull = time ? time.textContent : "";
    const later2 = [q(2, ".att-quote"), q(2, ".words .small-label"), ...qa(2, ".wchip")].filter(Boolean);
    ctx.add(() => {
      if (primed[0]) chips.forEach((c) => c.classList.remove("on"));
      if (primed[1] && time) time.textContent = "0:00";
      if (primed[2]) G.set([...qa(2, ".att"), ...qa(2, ".att-arrow"), ...later2], { autoAlpha: 0 });
    });
    undo.push(() => {
      chips.forEach((c, j) => c.classList.toggle("on", j === chosen));
      if (time) time.textContent = timeFull;
      if (q(2, ".strong2")) q(2, ".strong2").textContent = "Strong";
    });
    const played = new Set();
    const playStep = inCtx((i) => {
      if (played.has(i) || !steps[i] || !primed[i]) return;
      played.add(i);
      if (i === 0) {
        // The impression is picked: a couple of the others, then Confident.
        const tl = G.timeline({ delay: 0.35 });
        [2, 1, chosen].forEach((k, n) => tl.call(() => chips.forEach((c, j) => c.classList.toggle("on", j === k)), null, n ? "+=.45" : 0));
      } else if (i === 1 && time) {
        // The answer is being recorded; the clock runs to where it stops.
        const [m, sec] = timeFull.split(":").map(Number);
        const o = { s: 0 };
        G.to(o, { s: m * 60 + sec, duration: 2.2, ease: "none", onUpdate: () => { time.textContent = "0:" + String(Math.floor(o.s)).padStart(2, "0"); } });
      } else if (i === 2) {
        // Attempt one, then attempt two, which decodes into its better result
        // (ScrambleText); then what changed, and the words worth another look.
        const [a1, a2] = qa(2, ".att");
        const [arrow] = qa(2, ".att-arrow");
        const strong = q(2, ".strong2");
        const tl = G.timeline({ delay: 0.2 })
          .fromTo(a1, { x: -8, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease })
          .fromTo(arrow, { x: -6, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.4, ease: "back.out(3)" }, "+=.05")
          .fromTo(a2, { x: -8, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease }, "+=.05");
        if (strong && window.ScrambleTextPlugin) tl.to(strong, { duration: 0.8, scrambleText: { text: "Strong", chars: "lowerCase", speed: 0.5 }, ease: "none" }, "<");
        tl.fromTo(later2, { y: 6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease, stagger: 0.12 }, "+=.1");
      }
    });

    mm.add("(min-width: 1024px)", () => {
      // Desktop: the three cards are laid down in order, then each plays its
      // little demo.
      const grid = $(".steps");
      if (grid && steps.length && below(grid)) {
        G.set(steps, { y: 40, rotateX: 10, autoAlpha: 0, transformPerspective: 900, transformOrigin: "50% 100%" });
        ST.create({
          trigger: grid,
          start: "top 75%",
          once: true,
          onEnter: inCtx(() => {
            G.to(steps, { y: 0, rotateX: 0, autoAlpha: 1, duration: 0.9, ease, stagger: 0.08 });
            steps.forEach((st, i) => G.delayedCall(0.55 + i * 0.2, () => playStep(i)));
          }),
        });
      } else steps.forEach((st, i) => ST.create({ trigger: st, start: "top 85%", once: true, onEnter: () => playStep(i) }));
    });
    mm.add("(max-width: 1023px)", () => {
      steps.forEach((st, i) => {
        if (below(st)) G.fromTo(st, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.85, ease, scrollTrigger: { trigger: st, start: "top 97%", once: true } });
        ST.create({ trigger: st, start: "top 82%", once: true, onEnter: () => playStep(i) });
      });
    });

    ST.sort();
    ST.refresh();

    // Its own cleanup, which "Pause animations" runs.
    return () => {
      dead = true;
      hooks.side = null;
      hooks.hop = null;
      ac.abort();
      timers.forEach(clearTimeout);
      timers.clear();
      animes.forEach((a) => { try { a.revert(); } catch {} });
      springs.forEach((c, el) => {
        try { c && c.stop(); } catch {}
        el.style.transform = "";
        el.style.opacity = "";
        el.style.clipPath = "";
      });
      // Newest first: callback animations were made after the screen-size
      // sets, which were made after the main build; undoing them out of
      // order would restore a half-way state (the cards' dealt-from pile).
      late.revert();
      mm.revert();
      ctx.revert();
      undo.reverse().forEach((fn) => { try { fn(); } catch {} });
    };
  }

  // ---------------------------------------------------------- pause
  // "Pause animations" in the footer stops all motion for the rest of the
  // visit; "Play animations" brings it back. Nothing is saved.
  const pauseBtn = $("[data-pause]");
  pauseBtn?.addEventListener("click", () => {
    paused = !paused;
    root.classList.toggle("paused", paused);
    pauseBtn.textContent = paused ? "Play animations" : "Pause animations";
    if (stopMotion) stopMotion();
    stopMotion = null;
    if (!paused && haveCore()) stopMotion = startOn(false);
    else startOff();
  });

  // ---------------------------------------------------------- start
  // Split lines only once the fonts have loaded, or the line breaks are wrong.
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]);
  const domReady = document.readyState === "loading" ? new Promise((r) => document.addEventListener("DOMContentLoaded", r)) : Promise.resolve();
  Promise.all([fontsReady, domReady]).then(() => {
    if (haveCore()) stopMotion = startOn(scrollY < innerHeight * 0.5);
    else startOff();
  });
})();

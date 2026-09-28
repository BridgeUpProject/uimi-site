// uimi.app runtime: the waitlist, the delivery demo, and all of the motion.
//
// Motion plays for every visitor, including people whose device asks for
// reduced motion (the founder's call). The Animations switch in the corner
// turns it all off, live; that choice is remembered on the device
// (localStorage "uimi.motion" = "off") and never leaves it. The switch is
// also the pause control WCAG 2.2.2 asks for, since the rotating line, the
// phone, the marquee and the voice line move on their own.
//
// Libraries, all served from uimi.app: GSAP (ScrollTrigger, SplitText,
// CustomEase, Flip, ScrambleText, Physics2D) runs the scroll choreography,
// anime.js draws the underline and the privacy icons, drives the recording
// waveform, morphs the voice line and ripples the dot grid, Motion gives the
// pointer-driven pieces their springs, and Lenis smooths the scroll.
// The waitlist and the demo work without any of them.
(() => {
  "use strict";
  const CONFIG = {"endpoint":"https://pnfkiiaagblozzxpvbua.supabase.co/functions/v1/join-waitlist","rotating":["Practice a college interview.","Handle an awkward silence.","Ask your teacher for an extension.","Join a group conversation.","Tell someone something bothered you.","Practice an upcoming speech.","Speak up when something feels unfair.","Ask for another opportunity.","Prepare for an internship interview.","Push back respectfully."],"attempts":{"a":{"label":"Mixed","color":"var(--amber-deep)","fill":[1,1,0],"meter":"var(--amber)","worked":"You asked for a specific new date.","quote":"“Could I maybe have until Thursday?”","way":"Hedges like “maybe” and “really” made the ask sound unsure.","words":["um","maybe","really"],"next":"Say the date first, then one reason, then stop.","cue":"Try this: pause for a beat after the date."},"b":{"label":"Strong","color":"var(--green)","fill":[1,1,1],"meter":"var(--green)","worked":"You led with the date, gave one reason, and stopped.","quote":"“Could I have until Thursday? A family thing took over my week.”","way":"Nothing major. The reason ran a little fast.","words":[],"next":"Keep that pause, and slow down on the reason.","cue":"Try this: land the last word, then stop."}}};
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const KEY = "uimi.motion";
  let mode = root.getAttribute("data-motion") === "off" ? "off" : "on";
  let ticket = null;
  let teardown = null;
  let lenis = null;
  const hooks = { side: null, hop: null };

  // Motion and Lenis would quietly switch themselves off for devices that
  // ask for reduced motion; the switch above is how this site does that.
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
            company: form.querySelector("input[name=company]").value,
            source: campaign ? campaign + "-" + form.dataset.source : form.dataset.source,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please try again.");
        ticket = typeof body.ticket === "string" ? body.ticket : null;
        const from = button.getBoundingClientRect();
        document.querySelectorAll("form.join").forEach((f) => { f.hidden = true; });
        document.querySelectorAll(".done").forEach((d) => d.classList.add("show"));
        if (mode === "on" && window.gsap) {
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
    const data = { title: "UIMI", text: "Practice the conversations nobody teaches you how to handle.", url: shareUrl };
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

  // "I'm a ...", asked once the address is saved. One answer, sent once.
  document.querySelectorAll(".ask-roles button").forEach((btn) => btn.addEventListener("click", () => {
    const role = btn.dataset.role;
    document.querySelectorAll(".ask").forEach((a) => { a.hidden = true; });
    document.querySelectorAll(".ask-thanks").forEach((t) => { t.textContent = "Thanks. That helps us build the right thing."; });
    const thanks = btn.closest(".core")?.querySelector(".ask-thanks");
    if (thanks) { thanks.tabIndex = -1; thanks.focus({ preventScroll: true }); }
    if (!ticket) return;
    const once = ticket;
    ticket = null;
    fetch(CONFIG.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket: once, role }) }).catch(() => {});
  }));

  // ---------------------------------------------------------- the feedback demo: attempt 1 and 2
  const toggle = $(".fb-card .toggle");
  const card = $(".fb-card");
  const perception = $("#perception");
  const live = $("#perception-live");
  const segs = $$(".meter3 b");
  const slot = (k) => $(`.fb-card [data-k="${k}"]`);
  const thumb = toggle && $(".thumb", toggle);
  const voicePath = $(".voice .vp");
  const voiceShape = (s) => ($(s === "b" ? "#v-b" : "#v-a") || {}).getAttribute?.("d");
  let side = "a";
  let manual = false;
  function fillAttempt(s) {
    for (const k of ["worked", "quote", "way", "next", "cue"]) {
      const el = slot(k);
      if (el) el.textContent = s[k];
    }
    const words = slot("words");
    if (!words) return;
    $$(".wchip", words).forEach((w) => w.remove());
    s.words.forEach((w) => words.append(Object.assign(document.createElement("span"), { className: "wchip", textContent: `“${w}”` })));
  }
  function setSide(next) {
    if (!toggle || next === side) return;
    const t = thumb ? getComputedStyle(thumb).transform : "none";
    const thumbFrom = t && t !== "none" ? new DOMMatrixReadOnly(t).m41 : 0;
    side = next;
    const s = CONFIG.attempts[next];
    toggle.dataset.side = next;
    card.dataset.side = next;
    toggle.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === next)));
    live.textContent = `Attempt ${next === "a" ? 1 : 2} likely landed as ${s.label}`;
    perception.style.color = s.color;
    segs.forEach((b, i) => { b.style.transform = `scaleX(${s.fill[i]})`; });
    if (hooks.side) {
      hooks.side(next, s, thumbFrom);
    } else {
      perception.textContent = s.label;
      fillAttempt(s);
      if (voicePath && voiceShape(next)) voicePath.setAttribute("d", voiceShape(next));
    }
  }
  toggle?.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => { manual = true; setSide(btn.dataset.side); }));

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
      if (list.scrollWidth > list.clientWidth + 1) list.scrollTo({ left: Math.max(0, tabs[i].offsetLeft - 18), behavior: mode === "on" ? "smooth" : "auto" });
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

  // ---------------------------------------------------------- pieces both modes share
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

  // ---------------------------------------------------------- the switch
  const sw = $(".mswitch");
  const knob = sw && $(".knob", sw);
  const syncSwitch = () => sw?.setAttribute("aria-checked", String(mode === "on"));
  sw?.addEventListener("click", () => {
    const next = mode === "on" ? "off" : "on";
    try {
      if (next === "off") localStorage.setItem(KEY, "off");
      else localStorage.removeItem(KEY);
    } catch {}
    if (window.Motion && knob) {
      Motion.animate(knob, { transform: next === "on" ? ["translateX(0px)", "translateX(14px)"] : ["translateX(14px)", "translateX(0px)"] }, { type: "spring", stiffness: 700, damping: 36 })
        .then(() => { knob.style.transform = ""; });
    }
    switchMode(next);
  });

  // The switch steps aside while a button or a field passes under it, so it
  // never covers one. (Plain text links would make it blink on and off.)
  if (sw) {
    const clickable = "button, input, select, textarea, summary, [role=tab], .btn";
    let queued = false;
    const check = () => {
      queued = false;
      if (document.activeElement === sw) return sw.classList.remove("yield");
      const r = sw.getBoundingClientRect();
      const points = [[r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]];
      const covered = points.some(([x, y]) => document.elementsFromPoint(x, y).some((el) => !sw.contains(el) && el.closest(clickable)));
      sw.classList.toggle("yield", covered);
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(check);
    };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    setTimeout(check, 400);
  }

  function switchMode(next) {
    if (next === mode) return;
    const place = holdPlace();
    if (teardown) teardown();
    teardown = null;
    mode = next;
    root.setAttribute("data-motion", next);
    syncSwitch();
    teardown = next === "on" && haveCore() ? startOn(scrollY < 80) : startOff();
    place();
  }

  // Keep whatever the visitor is reading in the same spot while pins and
  // spacers come and go.
  function holdPlace() {
    const hit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.4);
    const target = hit && hit.closest("section, footer, .signoff");
    if (!target || scrollY < 80) return () => {};
    const top = target.getBoundingClientRect().top;
    return () => {
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      const delta = target.getBoundingClientRect().top - top;
      if (Math.abs(delta) < 2) return;
      if (lenis) lenis.scrollTo(scrollY + delta, { immediate: true, force: true });
      else window.scrollTo(0, scrollY + delta);
    };
  }

  const haveCore = () => !!(window.gsap && window.ScrollTrigger && window.Lenis);

  function startOff() {
    root.classList.add("ready");
    ensureSwoosh();
    buildDots();
    placeInd(false);
    if (voicePath && voiceShape(side)) voicePath.setAttribute("d", voiceShape(side));
    return () => {};
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
      const nav = $(".nav");
      let navHidden = false;
      const navTo = inCtx((hide) => G.to(nav, { yPercent: hide ? -160 : 0, duration: 0.6, ease, overwrite: "auto" }));
      ST.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          const hide = self.direction === 1 && self.scroll() > 320;
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
      const startPhone = inCtx(phone);
      if (hero && playIntro && SplitText) {
        $(".hero .swoosh")?.remove();
        const split = new SplitText("[data-split]", { type: "lines,words", mask: "lines" });
        G.set("[data-intro]", { visibility: "visible" });
        G.timeline({ defaults: { ease, duration: 1.2 } })
          .from(nav, { y: -30, autoAlpha: 0, duration: 1 })
          .from(".nav .dot", { y: -22, autoAlpha: 0, ease: "back.out(3.5)", stagger: 0.09, duration: 0.7 }, "-=.55")
          .from(".hero .pill", { y: 14, autoAlpha: 0, duration: 0.8 }, "-=.7")
          .from(split.words, { yPercent: 115, rotation: 5, transformOrigin: "0% 100%", stagger: 0.035, duration: 1.1 }, "-=.6")
          .from(".hero .lede", { y: 26, autoAlpha: 0 }, "-=.85")
          .from(".rotator", { y: 20, autoAlpha: 0 }, "-=.95")
          .from("#join-hero", { y: 26, autoAlpha: 0 }, "-=1")
          .from(".phone-wrap", { y: 90, rotateX: 18, rotateY: -12, autoAlpha: 0, duration: 1.6, transformPerspective: 1400 }, "-=1.35")
          .from(".sat", { scale: 0.6, autoAlpha: 0, stagger: 0.12, ease: "back.out(2.2)", duration: 0.9 }, "-=.9")
          .from(".s-fb .meter b", { scaleX: 0, stagger: 0.18, duration: 0.9 }, "-=.7")
          .fromTo(".s-fb .verdict", { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.9 }, "-=.9")
          .add(() => {
            root.classList.add("ready");
            split.revert();
            drawSwoosh(true);
            startPhone(2.2);
          });
      } else {
        root.classList.add("ready");
        drawSwoosh(false);
        if (hero) startPhone(1.2);
      }

      // Real situations take turns under the lede, letter by letter.
      const rot = $(".rot-text");
      if (rot && (CONFIG.rotating || []).length > 1) {
        const list = CONFIG.rotating;
        let i = 0;
        let visible = true;
        let split = null;
        let call = null;
        ST.create({ trigger: ".hero", start: "top bottom", end: "bottom top", onToggle: (self) => { visible = self.isActive; } });
        const step = () => {
          if (dead) return;
          call = G.delayedCall(2.8, step);
          if (!visible || document.hidden) return;
          i = (i + 1) % list.length;
          G.to(rot, {
            yPercent: -40,
            autoAlpha: 0,
            duration: 0.3,
            ease: "power2.out",
            onComplete: () => {
              if (dead) return;
              if (split) split.revert();
              rot.textContent = list[i];
              G.set(rot, { yPercent: 0, autoAlpha: 1 });
              if (SplitText) {
                split = new SplitText(rot, { type: "words,chars" });
                G.from(split.chars, { yPercent: 100, autoAlpha: 0, duration: 0.55, ease, stagger: 0.012 });
              }
            },
          });
        };
        call = G.delayedCall(playIntro ? 4.6 : 2.4, step);
        undo.push(() => {
          if (call) call.kill();
          G.killTweensOf(rot);
          if (split) { G.killTweensOf(split.chars); split.revert(); }
          rot.textContent = list[0];
          G.set(rot, { clearProps: "all" });
        });
      }

      if (hero) {
        // Tags drift at different depths; the phone rises slower than the page.
        // Only side by side: stacked on a phone, drifting up would cover the form.
        if (innerWidth >= 980) {
          $$(".sat").forEach((el) => {
            G.to(el, { y: () => -120 * Number(el.dataset.depth), ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.8 } });
          });
          G.to(".stage", { y: -70, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.8 } });
        }
        G.to(".phone", { y: -10, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
        if (fine) {
          const rx = G.quickTo(".phone", "rotationX", { duration: 1.1, ease: "power3" });
          const ry = G.quickTo(".phone", "rotationY", { duration: 1.1, ease: "power3" });
          G.set(".phone", { transformPerspective: 1200 });
          on(hero, "pointermove", (e) => {
            const r = hero.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 14);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
          });
          on(hero, "pointerleave", () => { rx(0); ry(0); });
        }
      }

      // The phone plays the app on a loop: pick the moment, say it, see how
      // it landed. It rests whenever the hero is off screen.
      function phone(delay) {
        const box = $(".pchips");
        const pick = $(".s-pick");
        const rec = $(".s-rec");
        const fb = $(".s-fb");
        if (!box || !pick || !rec || !fb) return;
        const chips = $$("span", box);
        const words = $$(".cap span");
        const timer = $(".s-rec .timer");
        const hl = document.createElement("span");
        hl.className = "chip-hl";
        box.prepend(hl);
        box.classList.add("js-hl");
        undo.push(() => {
          hl.remove();
          box.classList.remove("js-hl");
          chips.forEach((c) => c.classList.remove("on"));
          if (timer) timer.textContent = "0:14";
        });
        // Layout offsets, not screen boxes: the phone is tilted in 3D.
        const clipTo = (chip) =>
          `inset(${chip.offsetTop}px ${box.clientWidth - chip.offsetLeft - chip.offsetWidth}px ${box.clientHeight - chip.offsetTop - chip.offsetHeight}px ${chip.offsetLeft}px round 999px)`;
        const choose = (i) => chips.forEach((c, k) => c.classList.toggle("on", k === i));
        const clock = { s: 0 };
        const showClock = () => { if (timer) timer.textContent = "0:" + String(Math.floor(clock.s)).padStart(2, "0"); };
        const speak = words.length * 0.19 + 0.3;

        G.set([pick, rec], { autoAlpha: 0 });
        const loop = G.timeline({ repeat: -1, delay, defaults: { ease } });
        loop
          .to(fb, { autoAlpha: 0, y: -14, duration: 0.4 })
          .fromTo(pick, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.55, immediateRender: false }, "-=.15")
          .call(() => choose(-1), null, "<")
          .set(hl, { opacity: 0 }, "<")
          .call(() => { hl.style.clipPath = clipTo(chips[1]); choose(1); }, null, "+=.4")
          .to(hl, { opacity: 1, duration: 0.25 }, "<")
          .to(hl, { clipPath: () => clipTo(chips[0]), duration: 0.55 }, "+=.55")
          .call(() => choose(0), null, "<+=.12")
          .to(".go", { scale: 0.95, duration: 0.12, ease: "power2.out" }, "+=.55")
          .to(".go", { scale: 1, duration: 0.4, ease: "back.out(3)" })
          .to(pick, { autoAlpha: 0, y: -14, duration: 0.4 }, "+=.1")
          .fromTo(rec, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.55, immediateRender: false }, "-=.15")
          .fromTo(words, { opacity: 0.2 }, { opacity: 1, duration: 0.2, stagger: 0.19, ease: "none", immediateRender: false }, "+=.15")
          .fromTo(clock, { s: 0 }, { s: 14, duration: speak, ease: "none", onUpdate: showClock, immediateRender: false }, "<")
          .to(rec, { autoAlpha: 0, y: -14, duration: 0.4 }, "+=.5")
          .fromTo(fb, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.55, immediateRender: false }, "-=.15")
          .fromTo(".s-fb .verdict", { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.8, immediateRender: false }, "<+=.1")
          .fromTo(".s-fb .meter b", { scaleX: 0 }, { scaleX: 1, stagger: 0.18, duration: 0.8, immediateRender: false }, "<+=.1")
          .fromTo(".s-fb .line, .s-fb .mini", { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.6, immediateRender: false }, "<")
          .addLabel("rest")
          .to({}, { duration: 3.2 });

        // The live waveform on the recording screen (anime.js): every beat,
        // each bar springs to a new level from wherever it is.
        let beat = null;
        const bars = $$(".s-rec .wave i");
        if (A && bars.length) {
          beat = A.createTimer({
            duration: 150,
            loop: true,
            onLoop: () => A.animate(bars, { scaleY: () => A.utils.random(0.16, 1, 2), duration: 150, ease: "outQuad" }),
          });
          animes.push(beat);
          undo.push(() => { A.utils.remove(bars); bars.forEach((b) => b.removeAttribute("style")); });
        }
        const seen = ST.create({
          trigger: ".hero",
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => {
            // Off screen it waits on the finished feedback screen, never
            // halfway through a fade.
            if (self.isActive) { loop.resume(); beat?.resume(); } else { loop.pause("rest"); beat?.pause(); }
          },
        });
        if (!seen.isActive) { loop.pause("rest"); beat?.pause(); }
        on(window, "resize", () => loop.invalidate());
      }

      // ------------------------------------------------ marquee that answers scroll speed
      const rows = $$(".mrow");
      if (rows.length) {
        const tweens = rows.map((row) => {
          const dir = Number(row.dataset.dir);
          return G.fromTo(row, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 48, ease: "none", repeat: -1 });
        });
        const skew = G.quickTo(".marquee", "skewX", { duration: 0.5, ease: "power3" });
        let settle;
        const st = ST.create({
          trigger: ".marquee",
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => tweens.forEach((t) => (self.isActive ? t.resume() : t.pause())),
          onUpdate: (self) => {
            const v = self.getVelocity();
            const boost = 1 + Math.abs(G.utils.clamp(-5, 5, v / 350));
            tweens.forEach((t) => G.to(t, { timeScale: boost, duration: 0.2, overwrite: true }));
            skew(G.utils.clamp(-7, 7, v / -260));
            clearTimeout(settle);
            settle = setTimeout(() => {
              tweens.forEach((t) => G.to(t, { timeScale: 1, duration: 1.2, ease: "power2.out", overwrite: true }));
              skew(0);
            }, 140);
          },
        });
        if (!st.isActive) tweens.forEach((t) => t.pause());
        undo.push(() => { clearTimeout(settle); G.killTweensOf(tweens); });
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


      // The feedback card: the voice line wavers on the first attempt and
      // steadies on the second (anime.js morph), the verdict decodes itself
      // (ScrambleText), the thumb springs across and the flagged words pop
      // in (Motion).
      const voiceSvg = $(".voice svg");
      let travel = null;
      if (voiceSvg) {
        travel = G.to(voiceSvg, { xPercent: -50, duration: 7, ease: "none", repeat: -1 });
        travel.timeScale(side === "a" ? 4.2 : 1);
        ST.create({ trigger: ".product", start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? travel.resume() : travel.pause()) });
      }
      if (voicePath && voiceShape(side)) voicePath.setAttribute("d", voiceShape(side));
      const popWords = () =>
        $$(".fb-card .wchip").forEach((w, i) => spring(w, { opacity: [0, 1], transform: ["scale(0.8)", "scale(1)"] }, { type: "spring", stiffness: 420, damping: 16, delay: 0.12 + i * 0.1 }));
      let thumbRun = 0;
      hooks.side = inCtx((next, s, thumbFrom) => {
        if (window.ScrambleTextPlugin) G.to(perception, { duration: 0.8, scrambleText: { text: s.label, chars: "lowerCase", speed: 0.5, revealDelay: 0.2 }, ease: "none", overwrite: true });
        else perception.textContent = s.label;
        G.to(".fb-blocks", {
          autoAlpha: 0,
          y: 8,
          duration: 0.18,
          overwrite: true,
          onComplete: inCtx(() => {
            fillAttempt(s);
            G.to(".fb-blocks", { autoAlpha: 1, y: 0, duration: 0.45, ease });
            popWords();
          }),
        });
        if (travel) G.to(travel, { timeScale: next === "a" ? 4.2 : 1, duration: 0.8, ease: "power2.out", overwrite: true });
        if (A && voicePath && voiceShape(next)) animes.push(A.animate(voicePath, { d: A.svg.morphTo(next === "b" ? "#v-b" : "#v-a", 0), duration: 700, ease: "inOutQuad" }));
        if (thumb && M) {
          const run = ++thumbRun;
          const to = next === "b" ? thumb.offsetWidth + 8 : 0;
          spring(thumb, { transform: [`translateX(${thumbFrom}px)`, `translateX(${to}px)`] }, { type: "spring", stiffness: 420, damping: 32 })
            ?.then(() => { if (run === thumbRun) thumb.style.transform = ""; });
        }
      });
      undo.push(() => {
        hooks.side = null;
        const s = CONFIG.attempts[side];
        if (perception) perception.textContent = s.label;
        fillAttempt(s);
        if (voicePath && voiceShape(side)) voicePath.setAttribute("d", voiceShape(side));
      });
      if (M && card && below(card)) {
        $$(".fb-card .wchip").forEach((w) => { w.style.opacity = "0"; springs.set(w, null); });
        undo.push(M.inView(".fb-card .words", () => popWords(), { amount: 0.8 }));
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

      const pen = $(".closing-penguin");
      if (pen) {
        if (below(pen)) {
          G.set(pen, { x: -140, autoAlpha: 0 });
          ST.create({
            trigger: pen,
            start: "top 90%",
            once: true,
            onEnter: inCtx(() => {
              G.to(pen, { x: 0, autoAlpha: 1, duration: 1.6, ease });
              G.fromTo(pen, { rotation: -7 }, { rotation: 7, duration: 0.42, ease: "sine.inOut", yoyo: true, repeat: 5, onComplete: inCtx(() => G.to(pen, { rotation: 0, duration: 0.5 })) });
            }),
          });
        }
        // Squash, hop, land, settle.
        hooks.hop = inCtx(() => {
          if (G.isTweening(pen)) return;
          G.timeline()
            .to(pen, { scaleY: 0.86, scaleX: 1.08, duration: 0.12, ease: "power2.out" })
            .to(pen, { y: -34, scaleY: 1.06, scaleX: 0.96, duration: 0.3, ease: "power2.out" })
            .to(pen, { y: 0, scaleY: 1, scaleX: 1, duration: 0.3, ease: "power2.in" })
            .to(pen, { scaleY: 0.9, scaleX: 1.06, duration: 0.1, ease: "power1.out" })
            .to(pen, { scaleY: 1, scaleX: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        });
        on(pen, "pointerenter", () => hooks.hop && hooks.hop());
        on(pen, "click", () => hooks.hop && hooks.hop());
        undo.push(() => { hooks.hop = null; });
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


    // ------------------------------------------------ how it works + the demo
    // Built outside ctx: matchMedia runs its own contexts, and a context
    // that is active inside another one must never add to its parent.
    const cards = $$("[data-step]");
    const played = new Set();
    const playStep = inCtx((i) => {
      if (played.has(i)) return;
      played.add(i);
      const card = cards[i];
      if (i === 0) {
        const chips = $$(".vis-chips span", card);
        const tl = G.timeline();
        [2, 4, 1, 0].forEach((k, n) => tl.call(() => chips.forEach((c, j) => c.classList.toggle("on", j === k)), null, n * 0.45));
        undo.push(() => chips.forEach((c, j) => c.classList.toggle("on", j === 0)));
      } else if (i === 1) {
        const el = $(".rec-time", card);
        const o = { s: 0 };
        G.to(o, { s: 14, duration: 2.4, ease: "none", onUpdate: () => { el.textContent = "0:" + String(Math.floor(o.s)).padStart(2, "0"); } });
        undo.push(() => { el.textContent = "0:14"; });
      } else {
        G.fromTo($$(".meter.green i", card), { scaleX: 0 }, { scaleX: 1, stagger: 0.16, duration: 0.8, ease });
        G.fromTo($(".strong", card), { yPercent: 50, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.8, ease });
        G.fromTo($(".next-line", card), { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease, delay: 0.5 });
      }
    });

    mm.add("(min-width: 1024px)", () => {
      // How it works: the three cards are dealt from a stack into their row
      // as the section comes into view (no pinning, no extra scrolling),
      // then each plays its little demo.
      if (cards.length === 3 && below(cards[0])) {
        const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
        G.set(cards[0], { zIndex: 3, x: () => step(), rotation: -5, y: 16, scale: 0.94 });
        G.set(cards[1], { zIndex: 2, rotation: 3, y: 8, scale: 0.94 });
        G.set(cards[2], { zIndex: 1, x: () => -step(), rotation: -2, y: 24, scale: 0.94 });
        ST.create({
          trigger: ".steps",
          start: "top 72%",
          once: true,
          onEnter: inCtx(() => {
            G.to(cards, { x: 0, y: 0, rotation: 0, scale: 1, duration: 1.1, ease, stagger: 0.09 });
            cards.forEach((c, i) => G.delayedCall(0.85 + i * 0.15, () => playStep(i)));
          }),
        });
      } else cards.forEach((c, i) => ST.create({ trigger: c, start: "top 85%", once: true, onEnter: () => playStep(i) }));
    });
    mm.add("(max-width: 1023px)", () => {
      cards.forEach((c, i) => {
        if (below(c)) G.fromTo(c, { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease, scrollTrigger: { trigger: c, start: "top 97%", once: true } });
        ST.create({ trigger: c, start: "top 80%", once: true, onEnter: () => playStep(i) });
      });
    });

    // The feedback: pinned where it fits, and the second attempt takes over
    // halfway through; elsewhere it flips on its own once seen.
    mm.add("(min-width: 1024px) and (min-height: 820px)", () => {
      ST.create({ trigger: ".product", start: "center center", end: "+=110%", pin: true, onUpdate: (self) => { if (!manual) setSide(self.progress > 0.5 ? "b" : "a"); } });
    });
    mm.add("(max-width: 1023px), (max-height: 819px)", () => {
      ST.create({ trigger: ".fb-card .toggle", start: "top 62%", once: true, onEnter: () => later(() => { if (!manual) setSide("b"); }, 1800) });
    });

    ST.sort();
    ST.refresh();

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
      mm.revert();
      late.revert();
      ctx.revert();
      undo.reverse().forEach((fn) => { try { fn(); } catch {} });
    };
  }

  // ---------------------------------------------------------- start
  syncSwitch();
  // Split lines only once the fonts have loaded, or the line breaks are wrong.
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]);
  const domReady = document.readyState === "loading" ? new Promise((r) => document.addEventListener("DOMContentLoaded", r)) : Promise.resolve();
  Promise.all([fontsReady, domReady]).then(() => {
    teardown = mode === "on" && haveCore() ? startOn(scrollY < innerHeight * 0.5) : startOff();
  });
})();

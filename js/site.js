/* FaceWork static — shared helpers */
(function(){
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => Array.from(root.querySelectorAll(q));

  // ---------- Base path
  // Makes routing/guards work with file:// and sub-folder deploys (e.g. /facework/).
  const SITE_BASE_PATH = (function(){
    try{
      const src = document.currentScript?.src;
      if(!src) return "";
      const u = new URL(src, window.location.href);
      const p = String(u.pathname || "");
      return p.replace(/\/js\/site\.js$/,"");
    }catch(e){
      return "";
    }
  })();

  // ---------- Theme
  const THEME_KEY = "fwTheme";
  function applyTheme(t){
    const theme = (t === "light" || t === "dark") ? t : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    $("[data-theme-label]") && ($("[data-theme-label]").textContent = theme === "dark" ? "Sombre" : "Clair");
  }
  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved){ applyTheme(saved); return; }
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  }
  initTheme();
  $$("[data-theme-toggle]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  });

  // ---------- Auth (localStorage + optional Supabase)
  const USER_KEY = "fwUser";
  function getUser(){
    try{ return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }catch(e){ return null; }
  }
  function setUser(u){ localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function isAdminUser(user){
    return String(user?.role || "").trim().toLowerCase() === "admin";
  }
  async function logout(){
    const base = loginRedirectHref();
    try{ localStorage.removeItem(USER_KEY); }catch(e){ /* ignore */ }
    if(window.fwSupabase?.enabled){
      try{ await window.fwSupabase.signOut(); }catch(e){ /* ignore */ }
    }
    window.location.href = base;
  }

  // Put user in UI if elements exist
  function hydrateUserUI(){
    const u = getUser();
    const initials = (name)=>{
      const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
      return parts.slice(0,2).map(s=>s[0]?.toUpperCase() || "U").join("") || "U";
    };

    const safeMediaUrl = (raw)=>{
      const s = String(raw || "").trim();
      if(!s) return "";
      const compact = s.replace(/[\u0000-\u0020\u007f]+/g, "");
      const lower = compact.toLowerCase();
      if(lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return "";
      if(lower.startsWith("data:")) return /^data:image\//i.test(lower) ? s : "";
      if(lower.startsWith("blob:")) return s;
      try{
        const u = new URL(s, window.location.href);
        return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "";
      }catch(e){
        return "";
      }
    };

    const safeAvatarBg = (raw, fallback = "")=>{
      const s = String(raw || "").trim();
      if(!s) return fallback;
      if(s.length > 180) return fallback;
      if(/[;"<>]/.test(s) || /url\s*\(/i.test(s)) return fallback;
      if(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
      if(/^rgba?\([0-9.,%\s]+\)$/i.test(s)) return s;
      if(/^hsla?\([0-9.,%\s]+\)$/i.test(s)) return s;
      if(/^linear-gradient\([^)]+\)$/i.test(s)) return s;
      return fallback;
    };

    const setAvatar = (el, user)=>{
      if(!el) return;
      const url = safeMediaUrl(user && user.avatarUrl);
      const bg = safeAvatarBg(user && user.avatarBg);

      if(bg) el.style.background = bg;
      else el.style.background = "";

      const existingImg = el.querySelector("img");
      if(url){
        const img = existingImg || document.createElement("img");
        img.alt = "";
        img.src = url;
        if(!existingImg) el.replaceChildren(img);
        return;
      }
      existingImg && existingImg.remove();
      el.textContent = user ? initials(user.name) : "FW";
    };

    document.querySelectorAll("[data-user-name]").forEach(el=> el.textContent = u?.name || "Utilisateur");
    document.querySelectorAll("[data-user-company]").forEach(el=> el.textContent = u?.company || "Entreprise");
    document.querySelectorAll("[data-user-email]").forEach(el=> el.textContent = u?.email || "—");
    document.querySelectorAll("[data-user-role]").forEach(el=> el.textContent = u?.role || "—");
    document.querySelectorAll("[data-user-joined]").forEach(el=> el.textContent = u?.joinedAt || "—");
    document.querySelectorAll("[data-user-avatar]").forEach(el=> setAvatar(el, u));

    applyVisibility();
  }
  hydrateUserUI();

  function isUnsafeHref(raw){
    const compact = String(raw || "").replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
    return compact.startsWith("javascript:") || compact.startsWith("vbscript:") || compact.startsWith("data:text/html");
  }

  function hardenAnchor(anchor){
    if(!anchor || anchor.__fwLinkHardened) return;
    const rawHref = anchor.getAttribute("href");
    if(rawHref && isUnsafeHref(rawHref)){
      anchor.removeAttribute("href");
      anchor.setAttribute("aria-disabled", "true");
      anchor.setAttribute("role", "link");
    }
    if(String(anchor.getAttribute("target") || "").toLowerCase() === "_blank"){
      const rel = new Set(String(anchor.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      anchor.setAttribute("rel", Array.from(rel).join(" "));
    }
    anchor.__fwLinkHardened = true;
  }

  function hardenLinks(root = document){
    if(!root) return;
    if(root.matches?.("a[href], a[target=\"_blank\"]")){
      hardenAnchor(root);
      return;
    }
    root.querySelectorAll?.("a[href], a[target=\"_blank\"]").forEach(hardenAnchor);
  }

  function initLinkHardening(){
    hardenLinks(document);
    const target = document.body || document.documentElement;
    if(!target || !window.MutationObserver) return;
    const observer = new MutationObserver((mutations)=>{
      mutations.forEach((mutation)=>{
        mutation.addedNodes.forEach((node)=>{
          if(node.nodeType !== Node.ELEMENT_NODE) return;
          hardenLinks(node);
        });
      });
    });
    observer.observe(target, { childList: true, subtree: true });
  }
  initLinkHardening();

  // Logout buttons
  $$("[data-logout]").forEach(b=>b.addEventListener("click", ()=> logout()));

  // ---------- Guard (protected pages)
  function isProtectedPath(path){
    const p = String(path || "");
    if(p === "/login") return false;
    if(p === "/inscription") return false;
    if(p.startsWith("/app")) return true;
    if(p === "/tutoriel") return true;
    if(p.startsWith("/guides/")) return true;
    if(p === "/tutos") return true;
    if(p.startsWith("/tutos/")) return true;
    if(p === "/exercices") return true;
    if(p.startsWith("/exercices/")) return true;
    if(p === "/langages") return true;
    if(p.startsWith("/langages/")) return true;
    return false;
  }

  function isAdminOnlyPath(path){
    const p = String(path || "");
    if(p === "/app/admin") return true;
    if(p.startsWith("/app/crm")) return true;
    if(p === "/guides/admin") return true;
    return false;
  }

  function pathFromHref(href){
    const h = String(href || "").trim();
    if(!h || h.startsWith("#")) return "";
    try{
      return canonPath(new URL(h, window.location.href).pathname);
    }catch(e){
      return "";
    }
  }

  function applyAuthVisibility(){
    const authed = !!getUser();
    document.querySelectorAll("[data-auth-only]").forEach(el=> el.classList.toggle("hidden", !authed));
    if(authed) return;

    // Landing/login: hide shortcuts to pages that require auth (avoid redirect loops / confusion).
    document.querySelectorAll("a[href]").forEach(a=>{
      const p = pathFromHref(a.getAttribute("href") || "");
      if(p === "/tutoriel" || p === "/exercices" || p === "/langages"){
        a.classList.add("hidden");
      }
    });
  }

  function applyRoleVisibility(){
    const admin = isAdminUser(getUser());
    document.querySelectorAll("[data-admin-only]").forEach(el=> el.classList.toggle("hidden", !admin));
    document.querySelectorAll("[data-member-only]").forEach(el=> el.classList.toggle("hidden", admin));

    // Hide admin-only pages/links for members.
    if(!admin){
      document.querySelectorAll("a[href]").forEach(a=>{
        const p = pathFromHref(a.getAttribute("href") || "");
        if(p && isAdminOnlyPath(p)){
          a.classList.add("hidden");
        }
      });
    }
  }

  function applyVisibility(){
    applyAuthVisibility();
    applyRoleVisibility();
  }

  function isProtectedPage(){
    const path = canonPath(window.location.pathname);
    return isProtectedPath(path);
  }

  function loginRedirectHref(){
    const p = window.location.pathname || "";
    const inSubdir =
      p.includes("/app/") ||
      p.includes("/guides/") ||
      p.includes("/tutos/") ||
      p.includes("/exercices/") ||
      p.includes("/langages/");
    return inSubdir ? "../login.html" : "login.html";
  }

  if(isProtectedPage()){
    const redirectTo = loginRedirectHref();
    if(window.fwSupabase?.enabled){
      // async guard via Supabase session
      window.fwSupabase.requireAuth({ redirectTo });
    }else{
      // demo guard via localStorage
      const u = getUser();
      if(!u) window.location.href = redirectTo;
    }
  }

  async function enforceAdminOnlyIfNeeded(){
    const path = canonPath(window.location.pathname);
    if(!isAdminOnlyPath(path)) return;

    if(window.fwSupabase?.enabled && !getUser()){
      try{ await window.fwSupabase.syncLocalUser?.(); }catch(e){ /* ignore */ }
    }

    const u = getUser();
    if(!u) return; // not authenticated (protected guard will redirect)
    if(isAdminUser(u)) return;

    const p = window.location.pathname || "";
    const inSubdir =
      p.includes("/app/") ||
      p.includes("/guides/") ||
      p.includes("/tutos/") ||
      p.includes("/exercices/") ||
      p.includes("/langages/");
    const href = inSubdir ? "../app/feed.html" : "app/feed.html";
    window.location.href = href;
  }
  enforceAdminOnlyIfNeeded();

  // ---------- Active nav highlight
  function canonPath(p){
    let s = String(p || "");
    if(!s.startsWith("/")) s = "/" + s;

    // Strip hosting base path (file:// absolute path or sub-folder hosting)
    if(SITE_BASE_PATH && s === SITE_BASE_PATH) s = "/";
    else if(SITE_BASE_PATH && s.startsWith(SITE_BASE_PATH + "/")) s = s.slice(SITE_BASE_PATH.length);

    s = s.replace(/\/+$/, "");
    if(s === "") s = "/";

    // Treat /index and /index.html as root
    s = s.replace(/\/index\.html$/, "");
    s = s.replace(/\/index$/, "");

    // Pretty URLs: /page and /page.html are equivalent on Netlify
    s = s.replace(/\.html$/, "");

    if(s === "/landing-atelier") s = "/";

    if(s === "") s = "/";
    return s;
  }

  const currentPath = canonPath(window.location.pathname);
  $$("[data-app-nav]").forEach(a=>{
    const href = a.getAttribute("href");
    if(!href) return;
    let targetPath = "";
    try{
      targetPath = new URL(href, window.location.href).pathname;
    }catch(e){
      return;
    }
    if(canonPath(targetPath) === currentPath){
      a.classList.add("active");
    }
  });

  // ---------- Side menu (drawer)
  function relPrefix(){
    let p = String(window.location.pathname || "");
    if(SITE_BASE_PATH && p === SITE_BASE_PATH) p = "/";
    else if(SITE_BASE_PATH && p.startsWith(SITE_BASE_PATH + "/")) p = p.slice(SITE_BASE_PATH.length);

    p = p.replace(/^\/+/, "");
    if(!p) return "";

    const parts = p.split("/").filter(Boolean);
    if(parts.length <= 1) return "";
    return "../".repeat(parts.length - 1);
  }

  function landingAtelierHref(){
    return relPrefix() || "./";
  }

  function ensureLandingShortcut(){
    if(currentPath === "/") return;

    const href = landingAtelierHref();
    const title = "Retour vers Digitalexis-Studio";

    const createLink = (label, className)=>{
      const a = document.createElement("a");
      a.href = href;
      a.className = className;
      a.textContent = label;
      a.title = title;
      a.setAttribute("aria-label", title);
      a.setAttribute("data-atelier-link", "1");
      return a;
    };

    const navActions = document.querySelector(".navbar .nav-actions");
    if(navActions && !navActions.querySelector("[data-atelier-link]")){
      const existingReturn = Array.from(navActions.querySelectorAll("a.btn[href]")).find((link)=>{
        const label = String(link.textContent || "").trim().toLowerCase();
        const targetPath = pathFromHref(link.getAttribute("href") || "");
        return label.includes("retour") && targetPath === "/";
      });

      if(existingReturn){
        existingReturn.href = href;
        existingReturn.textContent = "Retour studio";
        existingReturn.title = title;
        existingReturn.setAttribute("aria-label", title);
        existingReturn.setAttribute("data-atelier-link", "1");
      }else{
        const button = createLink("Retour studio", "btn small");
        const primaryAction = navActions.querySelector("a.btn.primary, button.btn.primary");
        if(primaryAction) navActions.insertBefore(button, primaryAction);
        else navActions.appendChild(button);
      }
    }

    const userbox = document.querySelector(".appbar .userbox");
    if(userbox && !userbox.querySelector("[data-atelier-link]")){
      const button = createLink("Studio", "btn small ghost hide-sm");
      const logoutBtn = userbox.querySelector("[data-logout]");
      if(logoutBtn) userbox.insertBefore(button, logoutBtn);
      else userbox.appendChild(button);
    }
  }

  ensureLandingShortcut();

  function initSideMenu(){
    const header = document.querySelector(".appbar, .navbar");
    if(!header) return;

    const isAppHeader = header.classList.contains("appbar");
    const linksRoot = isAppHeader ? header.querySelector(".appnav") : header.querySelector(".navlinks");
    const target = isAppHeader ? header.querySelector(".userbox") : header.querySelector(".nav-actions");
    if(!target || !linksRoot) return;
    if(document.querySelector("[data-side-overlay]")) return;

    document.body.classList.add("has-sidemenu");

    const btn = document.createElement("button");
    btn.className = "btn icon";
    btn.type = "button";
    btn.textContent = "☰";
    btn.title = "Menu";
    btn.setAttribute("aria-label", "Ouvrir le menu");
    btn.setAttribute("data-side-open", "1");
    target.insertBefore(btn, target.firstChild);

    const overlay = document.createElement("div");
    overlay.className = "side-overlay hidden";
    overlay.setAttribute("data-side-overlay", "1");
    overlay.innerHTML = `
      <div class="side-drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="side-head">
          <div class="side-brand">
            <div class="logo" aria-hidden="true" style="width:34px;height:34px;border-radius:12px">
              <img src="${relPrefix()}assets/fw-logo.png" alt=""/>
            </div>
            <div style="display:flex; flex-direction:column; min-width:0">
              <div class="t">FaceWork</div>
              <div class="s">${escapeHtml(isAppHeader ? (getUser()?.company || "Entreprise") : "Menu")}</div>
            </div>
          </div>
          <button class="btn icon ghost" type="button" title="Fermer" aria-label="Fermer" data-side-close>✕</button>
        </div>
        <div class="side-links" data-side-links></div>
        ${isAppHeader ? `<div class="side-links" style="padding-top:0">
          <button class="btn danger block" type="button" data-side-logout>Déconnexion</button>
        </div>` : ""}
      </div>
    `;
    document.body.appendChild(overlay);

    const list = overlay.querySelector("[data-side-links]");
    const closeBtn = overlay.querySelector("[data-side-close]");
    const logoutBtn = overlay.querySelector("[data-side-logout]");

    const links = Array.from(linksRoot.querySelectorAll("a[href]"));
    links.forEach(a=>{
      const clone = a.cloneNode(true);
      clone.classList.remove("active");
      clone.classList.add("side-link");
      clone.removeAttribute("data-app-nav");

      const href = clone.getAttribute("href") || "";
      try{
        const u = new URL(href, window.location.href);
        if(!u.hash && canonPath(u.pathname) === currentPath){
          clone.classList.add("active");
        }
      }catch(e){ /* ignore */ }

      list.appendChild(clone);
    });

    function addSideLink(label, href){
      if(!list || !href) return;

      let targetPath = "";
      try{
        targetPath = canonPath(new URL(href, window.location.href).pathname);
      }catch(e){
        return;
      }

      const exists = Array.from(list.querySelectorAll("a.side-link")).some(el=>{
        const h = el.getAttribute("href");
        if(!h) return false;
        try{
          return canonPath(new URL(h, window.location.href).pathname) === targetPath;
        }catch(e){
          return false;
        }
      });
      if(exists) return;

      const a = document.createElement("a");
      a.className = "side-link";
      a.href = href;
      a.textContent = label;
      if(targetPath === currentPath) a.classList.add("active");
      list.appendChild(a);
    }

    // Global shortcuts (some pages don't show these in the top nav)
    // Keep landing page clean: only show extra links inside the app header.
    if(currentPath !== "/"){
      addSideLink("Retour studio", landingAtelierHref());
    }
    if(isAppHeader){
      addSideLink("Exercices", `${relPrefix()}exercices.html`);
      if(isAdminUser(getUser())){
        addSideLink("CRM", `${relPrefix()}app/crm-dashboard.html`);
      }
    }

    let prevOverflow = "";
    function open(){
      if(!overlay.classList.contains("hidden")) return;
      prevOverflow = document.body.style.overflow ?? "";
      document.body.style.overflow = "hidden";
      overlay.classList.remove("hidden");
      requestAnimationFrame(()=> overlay.classList.add("open"));
      btn.setAttribute("aria-expanded", "true");
    }
    function close(){
      if(overlay.classList.contains("hidden")) return;
      overlay.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      const done = ()=>{
        overlay.classList.add("hidden");
        document.body.style.overflow = prevOverflow;
      };
      window.setTimeout(done, 210);
    }

    btn.addEventListener("click", open);
    closeBtn && closeBtn.addEventListener("click", close);
    logoutBtn && logoutBtn.addEventListener("click", ()=>{ close(); logout(); });
    overlay.addEventListener("click", (e)=>{
      if(e.target === overlay) close();
      const link = e.target.closest("a.side-link");
      if(link) close();
    });
    window.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && !overlay.classList.contains("hidden")) close();
    });

    btn.setAttribute("aria-expanded", "false");
  }

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  initSideMenu();

  // ---------- Toast
  const toast = document.querySelector(".toast");
  window.fwToast = function(title, desc){
    if(!toast) return;
    toast.querySelector(".t").textContent = title || "OK";
    toast.querySelector(".d").textContent = desc || "";
    toast.classList.add("show");
    clearTimeout(window.__fwToastTimer);
    window.__fwToastTimer = setTimeout(()=>toast.classList.remove("show"), 2600);
  };

  // ---------- AI assistant (optional: Netlify Function)
  const AI_ENDPOINT = "/.netlify/functions/ai";
  const AI_LS_KEY = "fwAiChat_v1";
  const AI_MAX_MESSAGES = 24;

  const ai = {
    overlay: null,
    fab: null,
    messagesEl: null,
    inputEl: null,
    formEl: null,
    subEl: null,
    sendBtn: null,
    clearBtn: null,
    closeBtn: null,
    prevOverflow: "",
    context: null,
    messages: [],
    sending: false,
  };

  function pad2(n){ return String(n).padStart(2, "0"); }
  function fmtHm(ts){
    const d = new Date(ts);
    if(Number.isNaN(d.getTime())) return "";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function initials(name){
    const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0,2).map(s=> (s[0] || "U").toUpperCase()).join("") || "U";
  }

  function loadAiMessages(){
    try{
      const raw = JSON.parse(localStorage.getItem(AI_LS_KEY) || "[]");
      ai.messages = Array.isArray(raw) ? raw : [];
    }catch(e){
      ai.messages = [];
    }

    ai.messages = ai.messages
      .filter(m=> m && typeof m === "object")
      .map(m=>({
        id: String(m.id || ""),
        role: (m.role === "user" || m.role === "assistant" || m.role === "system") ? m.role : "system",
        content: String(m.content || "").slice(0, 8000),
        ts: Number(m.ts || 0) || Date.now(),
      }))
      .slice(-AI_MAX_MESSAGES);
  }

  function saveAiMessages(){
    try{
      localStorage.setItem(AI_LS_KEY, JSON.stringify((ai.messages || []).slice(-AI_MAX_MESSAGES)));
    }catch(e){ /* ignore */ }
  }

  function pushAiMessage(role, content){
    const safeRole = (role === "user" || role === "assistant" || role === "system") ? role : "system";
    const msg = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: safeRole,
      content: String(content || "").slice(0, 8000),
      ts: Date.now(),
    };
    ai.messages.push(msg);
    ai.messages = ai.messages.slice(-AI_MAX_MESSAGES);
    saveAiMessages();
    return msg.id;
  }

  function updateAiMessage(id, patch){
    const idx = (ai.messages || []).findIndex(m=> m && m.id === id);
    if(idx < 0) return;
    ai.messages[idx] = { ...ai.messages[idx], ...(patch || {}) };
    saveAiMessages();
  }

  function contextLabel(ctx){
    const c = (ctx && typeof ctx === "object") ? ctx : null;
    const title = String(c?.title || "").trim();
    const langRaw = String(c?.lang || "").trim();
    const diffRaw = String(c?.difficulty || "").trim();

    const lang = (()=>{
      const l = langRaw.toLowerCase();
      if(l === "js") return "JS";
      if(l === "html") return "HTML";
      if(l === "css") return "CSS";
      if(l === "sql") return "SQL";
      if(l === "php") return "PHP";
      return langRaw ? langRaw.toUpperCase() : "";
    })();

    const diff = (()=>{
      const d = diffRaw.toLowerCase();
      if(d === "beginner") return "Débutant";
      if(d === "intermediate") return "Intermédiaire";
      if(d === "advanced") return "Avancé";
      return diffRaw;
    })();

    if(title){
      const meta = [lang ? lang.toUpperCase() : "", diff ? diff : ""].filter(Boolean).join(" • ");
      return meta ? `${title} (${meta})` : title;
    }
    return "";
  }

  function setAiContext(ctx){
    ai.context = (ctx && typeof ctx === "object") ? {
      kind: String(ctx.kind || ""),
      lang: String(ctx.lang || ""),
      difficulty: String(ctx.difficulty || ""),
      title: String(ctx.title || ""),
      prompt: String(ctx.prompt || ""),
    } : null;

    if(ai.subEl){
      const label = contextLabel(ai.context);
      ai.subEl.textContent = label
        ? `Contexte : ${label}`
        : "Pose une question (ex: “donne-moi un indice”).";
    }
  }

  function renderAiMessages(){
    if(!ai.messagesEl) return;

    const u = getUser?.() || null;
    const userName = String(u?.name || "Toi").trim() || "Toi";
    const userAvatar = initials(userName);

    ai.messagesEl.innerHTML = (ai.messages || []).map(m=>{
      const role = (m.role === "user" || m.role === "assistant" || m.role === "system") ? m.role : "system";
      const isSystem = role === "system";
      const name = isSystem ? "Système" : (role === "assistant" ? "Assistant IA" : userName);
      const avatar = isSystem ? "•" : (role === "assistant" ? "IA" : userAvatar);
      const time = m.ts ? fmtHm(m.ts) : "";
      const msgClass = isSystem ? "msg system" : "msg";
      const avatarStyle = role === "assistant"
        ? "background: linear-gradient(135deg, rgba(0,245,255,.55), rgba(162,89,255,.55));"
        : "";
      return `
        <div class="${msgClass}">
          <div class="avatar msg-avatar" style="${avatarStyle}">${escapeHtml(avatar)}</div>
          <div class="msg-body">
            <div class="msg-head">
              <span class="msg-name">${escapeHtml(name)}</span>
              ${time ? `<span class="msg-time">${escapeHtml(time)}</span>` : ""}
            </div>
            <div class="msg-text">${escapeHtml(m.content || "")}</div>
          </div>
        </div>
      `;
    }).join("");

    ai.messagesEl.scrollTop = ai.messagesEl.scrollHeight;
  }

  async function callAi(chatMessages){
    const msgs = Array.isArray(chatMessages)
      ? chatMessages
      : (ai.messages || [])
          .filter(m=> (m.role === "user" || m.role === "assistant"))
          .slice(-12)
          .map(m=> ({ role: m.role, content: String(m.content || "").slice(0, 8000) }));

    const payload = {
      context: ai.context,
      messages: (msgs || []).slice(-12),
    };

    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = {};
    try{ data = await res.json(); }catch(e){ data = {}; }

    if(!res.ok){
      const msg = String(data?.error || "").trim();
      if(res.status === 404){
        throw new Error("IA indisponible en local. Déploie sur Netlify (ou utilise netlify dev).");
      }
      if(res.status === 501){
        throw new Error(msg || "OPENAI_API_KEY manquant sur Netlify.");
      }
      throw new Error(msg || `Erreur IA (${res.status}).`);
    }

    return String(data?.output || "").trim();
  }

  async function sendAi(){
    if(ai.sending) return;
    if(!ai.inputEl) return;

    const text = String(ai.inputEl.value || "").trim();
    if(!text) return;

    ai.inputEl.value = "";
    ai.inputEl.style.height = "";

    pushAiMessage("user", text);
    const convo = (ai.messages || [])
      .filter(m=> (m.role === "user" || m.role === "assistant"))
      .slice(-12)
      .map(m=> ({ role: m.role, content: String(m.content || "").slice(0, 8000) }));

    const pendingId = pushAiMessage("assistant", "…");
    renderAiMessages();

    ai.sending = true;
    ai.sendBtn && (ai.sendBtn.disabled = true);

    try{
      const out = await callAi(convo);
      updateAiMessage(pendingId, { content: out || "(réponse vide)" });
      renderAiMessages();
    }catch(err){
      const msg = String(err?.message || err || "Erreur IA.");
      updateAiMessage(pendingId, { role: "system", content: `IA : ${msg}` });
      renderAiMessages();
      window.fwToast?.("IA", msg);
    }finally{
      ai.sending = false;
      ai.sendBtn && (ai.sendBtn.disabled = false);
    }
  }

  function ensureAiUi(){
    if(ai.overlay || !document.body) return;

    loadAiMessages();

    // Floating button
    const fab = document.createElement("button");
    fab.className = "btn primary icon ai-fab";
    fab.type = "button";
    fab.title = "Assistant IA";
    fab.setAttribute("aria-label", "Assistant IA");
    fab.textContent = "🤖";
    document.body.appendChild(fab);

    // Modal overlay
    const overlay = document.createElement("div");
    overlay.className = "composer-overlay hidden";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Assistant IA");
    overlay.innerHTML = `
      <div class="card composer-modal" role="document" style="width: min(980px, 96vw); max-height: 86vh; overflow:hidden">
        <div class="chat" style="min-height: 0">
          <div class="chat-header">
            <div class="chat-left">
              <div class="chat-icon" aria-hidden="true">🤖</div>
              <div class="chat-meta">
                <div class="chat-title">Assistant IA</div>
                <div class="chat-sub" data-ai-sub>Pose une question (ex: “donne-moi un indice”).</div>
              </div>
            </div>
            <div class="chat-actions">
              <button class="btn small" type="button" data-ai-clear>Vider</button>
              <button class="btn icon ghost" type="button" data-ai-close aria-label="Fermer" title="Fermer">✕</button>
            </div>
          </div>

          <div class="chat-messages" data-ai-messages></div>

          <form class="chat-composer" data-ai-form>
            <textarea class="chat-input" data-ai-input rows="2" placeholder="Écris ta question… (Entrée = envoyer, Shift+Entrée = ligne)"></textarea>
            <button class="btn primary" type="submit" data-ai-send>Envoyer</button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    ai.overlay = overlay;
    ai.fab = fab;
    ai.messagesEl = overlay.querySelector("[data-ai-messages]");
    ai.inputEl = overlay.querySelector("[data-ai-input]");
    ai.formEl = overlay.querySelector("[data-ai-form]");
    ai.subEl = overlay.querySelector("[data-ai-sub]");
    ai.sendBtn = overlay.querySelector("[data-ai-send]");
    ai.clearBtn = overlay.querySelector("[data-ai-clear]");
    ai.closeBtn = overlay.querySelector("[data-ai-close]");

    function open(ctx){
      ensureAiUi();
      setAiContext(ctx);
      if(!ai.overlay || !ai.overlay.classList.contains("hidden")) return;
      ai.prevOverflow = document.body.style.overflow ?? "";
      document.body.style.overflow = "hidden";
      document.body.classList.add("ai-open");
      ai.overlay.classList.remove("hidden");
      renderAiMessages();
      setTimeout(()=> ai.inputEl?.focus(), 50);
    }

    function close(){
      if(!ai.overlay || ai.overlay.classList.contains("hidden")) return;
      ai.overlay.classList.add("hidden");
      document.body.style.overflow = ai.prevOverflow;
      document.body.classList.remove("ai-open");
    }

    function clear(){
      ai.messages = [];
      saveAiMessages();
      renderAiMessages();
      window.fwToast?.("IA", "Conversation vidée.");
    }

    function autosize(){
      if(!ai.inputEl) return;
      ai.inputEl.style.height = "auto";
      ai.inputEl.style.height = `${Math.min(ai.inputEl.scrollHeight, 160)}px`;
    }

    fab.addEventListener("click", ()=> open(null));
    ai.closeBtn?.addEventListener("click", close);
    ai.clearBtn?.addEventListener("click", clear);

    overlay.addEventListener("click", (e)=>{
      if(e.target === overlay) close();
    });

    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && ai.overlay && !ai.overlay.classList.contains("hidden")) close();
    });

    ai.formEl?.addEventListener("submit", (e)=>{
      e.preventDefault();
      sendAi();
    });

    ai.inputEl?.addEventListener("input", autosize);
    ai.inputEl?.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      if(e.shiftKey) return;
      e.preventDefault();
      sendAi();
    });

    if(!(ai.messages || []).length){
      pushAiMessage("system", "Salut ! Je peux t'aider à comprendre une consigne, donner un indice, ou corriger ton code (colle-le ici).");
    }
    renderAiMessages();

    // expose helpers
    window.fwAi = {
      open,
      close,
      clear,
      setContext: setAiContext,
    };
  }

  ensureAiUi();

  // Expose a tiny API for other scripts
  window.fw = {
    $,
    $$,
    getUser,
    setUser,
    logout,
    applyTheme,
    hydrateUserUI,
  };

  // Keep local user in sync with Supabase session (if enabled)
  if(window.fwSupabase?.enabled && window.fwSupabase?.client?.auth?.onAuthStateChange){
    window.fwSupabase.syncLocalUser();
    window.fwSupabase.client.auth.onAuthStateChange((event)=>{
      if(event === "SIGNED_OUT"){
        try{ localStorage.removeItem(USER_KEY); }catch(e){ /* ignore */ }
        hydrateUserUI();
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED
      window.fwSupabase.syncLocalUser();
    });
  }
})();

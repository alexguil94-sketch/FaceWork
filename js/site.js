/* FaceWork static — shared helpers */
(function(){
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => Array.from(root.querySelectorAll(q));

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
  async function logout(){
    const inApp = (window.location.pathname.includes("/app/") || window.location.href.includes("/app/"));
    const base = inApp ? "../login.html" : "login.html";
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

    const setAvatar = (el, user)=>{
      if(!el) return;
      const url = (user && user.avatarUrl) ? String(user.avatarUrl) : "";
      const bg = (user && user.avatarBg) ? String(user.avatarBg) : "";

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
  }
  hydrateUserUI();

  // Logout buttons
  $$("[data-logout]").forEach(b=>b.addEventListener("click", ()=> logout()));

  // ---------- Guard (protected pages)
  function isProtectedPage(){
    const path = canonPath(window.location.pathname);
    if(path === "/login") return false;
    if(path.startsWith("/app")) return true;
    if(path === "/tutoriel") return true;
    if(path.startsWith("/guides/")) return true;
    if(path === "/tutos") return true;
    if(path.startsWith("/tutos/")) return true;
    return false;
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

  // ---------- Active nav highlight
  function canonPath(p){
    let s = String(p || "");
    if(!s.startsWith("/")) s = "/" + s;
    s = s.replace(/\/+$/, "");
    if(s === "") s = "/";

    // Treat /index and /index.html as root
    s = s.replace(/\/index\.html$/, "");
    s = s.replace(/\/index$/, "");

    // Pretty URLs: /page and /page.html are equivalent on Netlify
    s = s.replace(/\.html$/, "");

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
    const p = window.location.pathname || "";
    const inSubdir =
      p.includes("/app/") ||
      p.includes("/guides/") ||
      p.includes("/tutos/") ||
      p.includes("/exercices/") ||
      p.includes("/langages/");
    return inSubdir ? "../" : "";
  }

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
    if(isAppHeader){
      addSideLink("Exercices", `${relPrefix()}exercices.html`);
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

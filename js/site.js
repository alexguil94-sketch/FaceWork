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

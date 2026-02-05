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

  // ---------- Auth (demo)
  const USER_KEY = "fwUser";
  function getUser(){
    try{ return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }catch(e){ return null; }
  }
  function setUser(u){ localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function logout(){
    localStorage.removeItem(USER_KEY);
    const inApp = (window.location.pathname.includes("/app/") || window.location.href.includes("/app/"));
    window.location.href = inApp ? "../login.html" : "login.html";
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
  $$("[data-logout]").forEach(b=>b.addEventListener("click", logout));

  // ---------- Guard app pages
  function isAppPage(){
    return window.location.pathname.includes("/app/") || window.location.pathname.endsWith("/app");
  }
  if(isAppPage()){
    const u = getUser();
    if(!u){
      // redirect to login
      const base = window.location.pathname.includes("/app/") ? "../login.html" : "login.html";
      window.location.href = base;
    }
  }

  // ---------- Active nav highlight
  const path = window.location.pathname;
  $$("[data-app-nav]").forEach(a=>{
    const target = a.getAttribute("href");
    if(!target) return;
    // support relative links
    const normalized = target.replace("./","").replace("../","");
    if(path.endsWith(normalized) || path.includes("/app/"+normalized.replace("app/",""))){
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
})();

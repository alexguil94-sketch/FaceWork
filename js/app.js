/* FaceWork static — app features (feed/channels/messages/settings) */
(function(){
  const { $, $$, getUser, setUser } = window.fw || {};
  if(!$) return;

  const sb = (window.fwSupabase?.enabled && window.fwSupabase?.client) ? window.fwSupabase.client : null;
  const sbEnabled = !!sb;

  const nowStr = ()=>{
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const dateStr = ()=>{
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  };

  function loginHref(){
    const inApp = (window.location.pathname.includes("/app/") || window.location.href.includes("/app/"));
    return inApp ? "../login.html" : "login.html";
  }

  function companyFromUser(){
    const u = getUser() || {};
    return String(u.company || window.fwSupabase?.companyDefault || "Entreprise").trim() || "Entreprise";
  }

  let __sbSession = null;
  async function sbSession(){
    if(!sb) return null;
    if(__sbSession) return __sbSession;
    const { data, error } = await sb.auth.getSession();
    if(error) return null;
    __sbSession = data?.session || null;
    return __sbSession;
  }
  async function sbUser(){
    const s = await sbSession();
    return s?.user || null;
  }
  async function sbUserId(){
    const u = await sbUser();
    return u?.id || "";
  }

  function fmtTs(ts){
    const d = new Date(ts);
    if(Number.isNaN(d.getTime())) return String(ts || "");
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtTime(ts){
    const d = new Date(ts);
    if(Number.isNaN(d.getTime())) return "";
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function sbToastError(title, error){
    const msg = error?.message || error?.error_description || "Erreur Supabase";
    console.error(title, error);
    window.fwToast?.(title, msg);
  }

  const STORAGE_BUCKET = String(window.FW_ENV?.SUPABASE_BUCKET || "facework").trim() || "facework";

  function normalizeCompanyForPath(company){
    // Keep it readable, but prevent path traversal / accidental slashes.
    return String(company || "")
      .trim()
      .replace(/[\\\/]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 60) || "Entreprise";
  }

  function normalizeFolderPath(raw){
    const s = String(raw || "").trim();
    if(!s) return "";
    const parts = s
      .split(/[\\\/]+/g)
      .map(x=> x.trim())
      .filter(Boolean)
      .slice(0, 8);
    const clean = parts
      .map(p=> p
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, 40)
      )
      .filter(Boolean);
    return clean.join("/");
  }

  function safeFileName(name){
    const n = String(name || "").trim();
    if(!n) return "fichier";
    const parts = n.split(".");
    const ext = parts.length > 1 ? parts.pop() : "";
    const base = parts.join(".") || "fichier";
    const baseSafe = base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "fichier";
    const extSafe = ext
      ? ext.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 12)
      : "";
    return extSafe ? `${baseSafe}.${extSafe}` : baseSafe;
  }

  function parseSbStorageUrl(raw){
    const s = String(raw || "").trim();
    const m = s.match(/^sb:\/\/([^\/]+)\/(.+)$/i);
    if(!m) return null;
    return { bucket: m[1], path: m[2] };
  }

  function fmtBytes(bytes){
    const b = Number(bytes || 0);
    if(!Number.isFinite(b) || b <= 0) return "0 B";
    const units = ["B","KB","MB","GB"];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
    const v = b / Math.pow(1024, i);
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function uuid(){
    if(crypto?.randomUUID) return crypto.randomUUID();
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    a[6] = (a[6] & 0x0f) | 0x40;
    a[8] = (a[8] & 0x3f) | 0x80;
    const h = Array.from(a, b=> b.toString(16).padStart(2,"0")).join("");
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }

  async function openFileFromPost({ fileUrl, fileName } = {}){
    const sbUrl = parseSbStorageUrl(fileUrl);
    if(sbUrl && sb){
      window.fwToast?.("Téléchargement","Récupération du fichier…");
      const res = await sb.storage.from(sbUrl.bucket).download(sbUrl.path);
      if(res.error){
        sbToastError("Fichier", res.error);
        return;
      }
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(blobUrl); }catch(e){ /* ignore */ } }, 60_000);
      return;
    }

    const href = safeUrl(fileUrl);
    if(!href){
      window.fwToast?.("Aucun lien","Ajoute un lien de fichier ou dépose un fichier dans le formulaire.");
      return;
    }
    window.open(href, "_blank");
  }

  function bindComposerFileUI(){
    const form = $("#newPostForm");
    if(!form || form.__fileUiBound) return;

    const sub = $("#composerSub");
    if(sub){
      sub.textContent = sbEnabled
        ? "Supabase : tes posts et fichiers sont stockés en base + Storage."
        : "Démo locale : tes posts sont enregistrés dans le navigateur (localStorage).";
    }

    const drop = $("#postDrop");
    const input = $("#postFile");
    const info = $("#postFileInfo");
    const clear = $("#postFileClear");

    function setSelectedFile(file){
      form.__selectedFile = file || null;
      if(info){
        info.textContent = file ? `${file.name} • ${fmtBytes(file.size)}` : "Aucun fichier sélectionné";
      }
      const fileNameEl = $("#postFileName");
      if(file && fileNameEl && !String(fileNameEl.value || "").trim()){
        fileNameEl.value = file.name;
      }
      const fileUrlEl = $("#postFileUrl");
      if(file && fileUrlEl){
        fileUrlEl.value = "";
      }
    }

    setSelectedFile(null);

    input?.addEventListener("change", ()=>{
      const f = input.files?.[0] || null;
      setSelectedFile(f);
    });

    clear?.addEventListener("click", (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if(input) input.value = "";
      setSelectedFile(null);
    });

    function prevent(e){ e.preventDefault(); e.stopPropagation(); }
    drop?.addEventListener("click", ()=>{
      input?.click();
    });
    drop?.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        input?.click();
      }
    });

    drop?.addEventListener("dragenter", (e)=>{ prevent(e); drop.classList.add("dragover"); });
    drop?.addEventListener("dragover", (e)=>{ prevent(e); drop.classList.add("dragover"); });
    drop?.addEventListener("dragleave", (e)=>{ prevent(e); drop.classList.remove("dragover"); });
    drop?.addEventListener("drop", (e)=>{
      prevent(e);
      drop.classList.remove("dragover");
      const file = e.dataTransfer?.files?.[0] || null;
      if(file) setSelectedFile(file);
    });

    form.__fileUiBound = true;
  }

  // ---------- Seed data
  function seed(){
    if(!localStorage.getItem("fwPosts")){
      const u = getUser() || {name:"alexis g", company:"HeroForgeWeb"};
      const posts = [{
        id: cryptoRandom(),
        author: u.name,
        company: u.company,
        title: "calculatrice du futur",
        body: "Petite démo : partage d’un fichier + publication interne. (Version statique HTML)",
        fileName: "calculatrice-du-futur.txt",
        fileUrl: "../assets/calculatrice-du-futur.txt",
        likes: 1,
        comments: 0,
        createdAt: nowStr()
      }];
      localStorage.setItem("fwPosts", JSON.stringify(posts));
    }
    if(!localStorage.getItem("fwChannels")){
      const channels = {
        public: ["général","annonces","random","support"],
        voice: ["general"],
        private: []
      };
      localStorage.setItem("fwChannels", JSON.stringify(channels));
    }
    if(!localStorage.getItem("fwChannelMsgs")){
      const u = getUser() || {name:"Moi"};
      const me = u?.name || "Moi";
      const msgs = {
        "public:général": [
          {from:"FaceWork Bot", text:"Bienvenue dans #général ! Présente-toi et partage les infos importantes ici.", at: nowStr(), system:true},
          {from:"Camille", text:"Hello 👋 On fait un point à 15h ?", at: nowStr()},
          {from: me, text:"Yes, je suis dispo. J’envoie l’invite.", at: nowStr()},
        ],
        "public:annonces": [
          {from:"FaceWork Bot", text:"📢 Pensez à mettre à jour votre profil (avatar + entreprise).", at: nowStr(), system:true},
        ],
      };
      localStorage.setItem("fwChannelMsgs", JSON.stringify(msgs));
    }
    if(!localStorage.getItem("fwDMs")){
      const dms = {
        "Camille": [{from:"Camille", text:"Salut ! On fait un point à 15h ?", at: nowStr()}],
        "Rayan": [{from:"Moi", text:"Tu peux relire le doc avant la réunion ?", at: nowStr()}]
      };
      localStorage.setItem("fwDMs", JSON.stringify(dms));
    }

    // Admin demo (Discord-like): roles + members
    if(!localStorage.getItem("fwRoles")){
      const roles = [
        {
          id: cryptoRandom(),
          name: "Admin",
          color: "#ff2d78",
          perms: { admin:true, manageRoles:true, manageMembers:true, manageChannels:true },
          createdAt: dateStr()
        },
        {
          id: cryptoRandom(),
          name: "Modérateur",
          color: "#7c3aed",
          perms: { manageMembers:true, manageChannels:true },
          createdAt: dateStr()
        },
        {
          id: cryptoRandom(),
          name: "Membre",
          color: "#3b82f6",
          perms: {},
          createdAt: dateStr()
        }
      ];
      localStorage.setItem("fwRoles", JSON.stringify(roles));
    }

    let roles = [];
    try{ roles = JSON.parse(localStorage.getItem("fwRoles") || "[]"); }catch(e){ roles = []; }
    if(!Array.isArray(roles)) roles = [];

    const getRoleId = (...names)=>{
      const want = names.map(n=> String(n || "").trim().toLowerCase()).filter(Boolean);
      const found = roles.find(r=> want.includes(String(r?.name || "").trim().toLowerCase()));
      return found?.id || "";
    };
    const adminRoleId = getRoleId("admin");
    const modRoleId = getRoleId("modérateur", "moderateur");
    const memberRoleId = getRoleId("membre");

    if(!localStorage.getItem("fwMembers")){
      const u = getUser() || {};
      const meCompany = u.company || "Entreprise";
      const members = [
        {
          id: cryptoRandom(),
          name: u.name || "Utilisateur",
          email: u.email || "vous@exemple.com",
          company: meCompany,
          joinedAt: u.joinedAt || dateStr(),
          roleIds: adminRoleId ? [adminRoleId] : [],
          avatarUrl: u.avatarUrl || "",
          avatarBg: u.avatarBg || "",
        },
        {
          id: cryptoRandom(),
          name: "Camille",
          email: "camille@exemple.com",
          company: meCompany,
          joinedAt: dateStr(),
          roleIds: modRoleId ? [modRoleId] : (memberRoleId ? [memberRoleId] : []),
          avatarUrl: "",
          avatarBg: avatarBgFor("Camille"),
        },
        {
          id: cryptoRandom(),
          name: "Rayan",
          email: "rayan@exemple.com",
          company: meCompany,
          joinedAt: dateStr(),
          roleIds: memberRoleId ? [memberRoleId] : [],
          avatarUrl: "",
          avatarBg: avatarBgFor("Rayan"),
        },
      ];
      localStorage.setItem("fwMembers", JSON.stringify(members));
    }else{
      const u = getUser() || null;
      if(u){
        let members = [];
        try{ members = JSON.parse(localStorage.getItem("fwMembers") || "[]"); }catch(e){ members = []; }
        if(!Array.isArray(members)) members = [];

        const email = String(u.email || "").trim().toLowerCase();
        const idx = email ? members.findIndex(m=> String(m?.email || "").trim().toLowerCase() === email) : -1;
        if(idx >= 0){
          members[idx] = {
            ...members[idx],
            name: u.name || members[idx]?.name || "Utilisateur",
            company: u.company || members[idx]?.company || "Entreprise",
            avatarUrl: u.avatarUrl || members[idx]?.avatarUrl || "",
            avatarBg: u.avatarBg || members[idx]?.avatarBg || "",
          };
          localStorage.setItem("fwMembers", JSON.stringify(members));
        }else if(u.email || u.name){
          const wantAdmin = String(u.role || "").trim().toLowerCase() === "admin";
          const roleIds = [];
          if(wantAdmin && adminRoleId) roleIds.push(adminRoleId);
          else if(memberRoleId) roleIds.push(memberRoleId);

          members.push({
            id: cryptoRandom(),
            name: u.name || "Utilisateur",
            email: u.email || "",
            company: u.company || "Entreprise",
            joinedAt: u.joinedAt || dateStr(),
            roleIds,
            avatarUrl: u.avatarUrl || "",
            avatarBg: u.avatarBg || "",
          });
          localStorage.setItem("fwMembers", JSON.stringify(members));
        }
      }
    }
  }
  function cryptoRandom(){
    // fallback if crypto isn't available
    try{
      const a = new Uint32Array(2);
      crypto.getRandomValues(a);
      return `${a[0].toString(16)}${a[1].toString(16)}`;
    }catch(e){
      return String(Date.now()) + String(Math.random()).slice(2);
    }
  }
  if(!sbEnabled) seed();

  // ---------- FEED
  function loadPosts(){
    try{ return JSON.parse(localStorage.getItem("fwPosts") || "[]"); }catch(e){ return []; }
  }
  function savePosts(arr){ localStorage.setItem("fwPosts", JSON.stringify(arr)); }

  function renderFeed(){
    const root = $("#feedList");
    if(!root) return;
    bindComposerFileUI();
    const posts = loadPosts();
    root.innerHTML = "";
    posts.slice().reverse().forEach(p=>{
      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <div class="top">
          <div class="who">
            <div class="avatar" aria-hidden="true">${(p.author||"U").split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||"U").join("")}</div>
            <div class="meta">
              <div class="name">${escapeHtml(p.author || "Utilisateur")} <span class="badge" style="margin-left:8px">${escapeHtml(p.company || "Entreprise")}</span></div>
              <div class="time">${escapeHtml(p.createdAt || "")}${(p.fileName || p.fileUrl) ? " • 📄 Fichier" : ""}</div>
            </div>
          </div>
          <button class="btn icon ghost" title="Supprimer" data-del="${p.id}">🗑️</button>
        </div>
        <h4>${escapeHtml(p.title || "Publication")}</h4>
        ${(p.fileName || p.fileUrl) ? `
          <button class="file-box" type="button" data-open="${p.id}" data-file-url="${escapeHtml(p.fileUrl || "")}" data-file-name="${escapeHtml(p.fileName || "")}">
            <div class="file-left">
              <div class="file-ico" aria-hidden="true">📄</div>
              <div class="file-meta">
                <div class="file-title">Télécharger le fichier</div>
                <div class="file-sub">${escapeHtml(p.fileName || "Cliquez pour ouvrir")}</div>
              </div>
            </div>
            <span class="badge">Ouvrir</span>
          </button>
        ` : ""}
        ${p.body ? `<p>${escapeHtml(p.body)}</p>` : ""}
        <div class="actions">
          <button class="iconbtn" data-like="${p.id}">❤️ <span>${p.likes || 0}</span></button>
          <span class="badge">${p.comments || 0} commentaires</span>
        </div>
      `;
      root.appendChild(el);
    });

    if(!root.__bound){
      root.__bound = true;
      root.addEventListener("click", async (e)=>{
        const likeId = e.target.closest("[data-like]")?.getAttribute("data-like");
        const delId = e.target.closest("[data-del]")?.getAttribute("data-del");
        const openId = e.target.closest("[data-open]")?.getAttribute("data-open");

        if(likeId){
          const posts = loadPosts();
          const idx = posts.findIndex(x=>x.id===likeId);
          if(idx>=0){ posts[idx].likes = (posts[idx].likes||0)+1; savePosts(posts); renderFeed(); window.fwToast?.("Like ajouté","Réaction enregistrée."); }
        }
        if(delId){
          const posts = loadPosts().filter(x=>x.id!==delId);
          savePosts(posts);
          renderFeed();
          window.fwToast?.("Supprimé","La publication a été retirée.");
        }
        if(openId){
          const posts = loadPosts();
          const p = posts.find(x=>x.id===openId);
          if(p?.fileData?.dataUrl){
            try{
              const r = await fetch(p.fileData.dataUrl);
              const blob = await r.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = blobUrl;
              a.target = "_blank";
              a.rel = "noopener";
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(()=>{ try{ URL.revokeObjectURL(blobUrl); }catch(e){ /* ignore */ } }, 60_000);
              return;
            }catch(e){
              window.fwToast?.("Fichier","Impossible d’ouvrir ce fichier en démo locale.");
              return;
            }
          }
          await openFileFromPost({ fileUrl: p?.fileUrl, fileName: p?.fileName });
        }
      });
    }

    // New post
    const form = $("#newPostForm");
    if(form && !form.__bound){
      form.__bound = true;
      form.addEventListener("submit", async (ev)=>{
        ev.preventDefault();
        const u = getUser() || {name:"Utilisateur", company:"Entreprise"};
        const company = normalizeCompanyForPath(u.company || "Entreprise");
        const title = $("#postTitle").value.trim();
        const body  = $("#postBody").value.trim();
        const fileUrl = $("#postFileUrl")?.value.trim() || "";
        const fileNameInput = $("#postFileName")?.value.trim() || "";
        const selectedFile = form.__selectedFile || null;
        let fileName = fileNameInput;
        if(!fileName && fileUrl){
          try{ fileName = new URL(fileUrl, window.location.href).pathname.split("/").pop() || ""; }catch(e){ /* ignore */ }
        }
        if(!title && !body && !fileUrl && !selectedFile){
          window.fwToast?.("Oups","Écris au moins un titre ou un message.");
          return;
        }

        let fileData = null;
        if(selectedFile){
          if(selectedFile.size > 1_000_000){
            window.fwToast?.("Fichier trop gros","En démo locale, limite ~1 Mo. Active Supabase pour l’upload.");
            return;
          }
          try{
            const dataUrl = await new Promise((resolve, reject)=>{
              const fr = new FileReader();
              fr.onerror = ()=> reject(new Error("read_error"));
              fr.onload = ()=> resolve(String(fr.result || ""));
              fr.readAsDataURL(selectedFile);
            });
            fileData = { dataUrl, type: selectedFile.type || "", size: selectedFile.size || 0 };
            fileName = fileName || selectedFile.name || "fichier";
          }catch(e){
            window.fwToast?.("Erreur","Impossible de lire le fichier.");
            return;
          }
        }

        const posts = loadPosts();
        posts.push({
          id: cryptoRandom(),
          author: u.name,
          company,
          title: title || "Sans titre",
          body: body || "",
          fileName,
          fileUrl,
          fileData,
          likes: 0,
          comments: 0,
          createdAt: nowStr()
        });
        savePosts(posts);
        $("#postTitle").value = "";
        $("#postBody").value = "";
        $("#postFileUrl") && ($("#postFileUrl").value = "");
        $("#postFileName") && ($("#postFileName").value = "");
        $("#postFolder") && ($("#postFolder").value = "");
        $("#postFile") && ($("#postFile").value = "");
        form.__selectedFile = null;
        $("#postFileInfo") && ($("#postFileInfo").textContent = "Aucun fichier sélectionné");
        renderFeed();
        window.fwToast?.("Publié","Ta publication est en ligne.");
      });
    }
  }

  async function renderFeedSupabase(){
    const root = $("#feedList");
    if(!root) return;
    bindComposerFileUI();

    const uid = await sbUserId();
    if(!uid){
      window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
      return;
    }

    const company = companyFromUser();

    const { data: posts, error } = await sb
      .from("posts")
      .select("*")
      .eq("company", company)
      .order("created_at", { ascending: false });
    if(error){
      sbToastError("Supabase", error);
      root.innerHTML = "";
      return;
    }

    const authorIds = Array.from(new Set((posts || []).map(p=> p?.author_id).filter(Boolean)));
    let authors = [];
    if(authorIds.length){
      const res = await sb
        .from("profiles")
        .select("id,name,company,avatar_url,avatar_bg")
        .in("id", authorIds);
      if(!res.error) authors = res.data || [];
    }
    const authorById = new Map((authors || []).map(a=> [String(a.id), a]));

    let likedSet = new Set();
    const likesRes = await sb
      .from("post_likes")
      .select("post_id")
      .eq("company", company)
      .eq("user_id", uid);
    if(!likesRes.error){
      likedSet = new Set((likesRes.data || []).map(x=> String(x.post_id)));
    }

    const meRole = String(getUser()?.role || "").trim().toLowerCase();

    root.innerHTML = "";
    (posts || []).forEach(p=>{
      const author = authorById.get(String(p.author_id)) || {};
      const name = String(author.name || "Utilisateur");
      const comp = String(author.company || company);
      const createdAt = fmtTs(p.created_at);
      const fileUrl = String(p.file_url || "");
      const fileName = String(p.file_name || "");
      const canDelete = String(p.author_id) === String(uid) || meRole === "admin";
      const likeCount = Number(p.likes_count || 0);
      const isLiked = likedSet.has(String(p.id));

      const avatar = author.avatar_url
        ? `<div class="avatar" aria-hidden="true"><img src="${escapeHtml(author.avatar_url)}" alt=""/></div>`
        : `<div class="avatar" aria-hidden="true"${author.avatar_bg ? ` style="background:${escapeHtml(author.avatar_bg)}"` : ""}>${escapeHtml(initials(name))}</div>`;

      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <div class="top">
          <div class="who">
            ${avatar}
            <div class="meta">
              <div class="name">${escapeHtml(name)} <span class="badge" style="margin-left:8px">${escapeHtml(comp)}</span></div>
              <div class="time">${escapeHtml(createdAt)}${(fileName || fileUrl) ? " • 📄 Fichier" : ""}</div>
            </div>
          </div>
          ${canDelete ? `<button class="btn icon ghost" title="Supprimer" data-del="${escapeHtml(p.id)}">🗑️</button>` : `<span></span>`}
        </div>
        <h4>${escapeHtml(p.title || "Publication")}</h4>
        ${(fileName || fileUrl) ? `
          <button class="file-box" type="button" data-open="${escapeHtml(p.id)}" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}">
            <div class="file-left">
              <div class="file-ico" aria-hidden="true">📄</div>
              <div class="file-meta">
                <div class="file-title">Télécharger le fichier</div>
                <div class="file-sub">${escapeHtml(fileName || "Cliquez pour ouvrir")}</div>
              </div>
            </div>
            <span class="badge">Ouvrir</span>
          </button>
        ` : ""}
        ${p.body ? `<p>${escapeHtml(p.body)}</p>` : ""}
        <div class="actions">
          <button class="iconbtn${isLiked ? " active" : ""}" data-like="${escapeHtml(p.id)}" aria-pressed="${isLiked ? "true" : "false"}">❤️ <span>${likeCount}</span></button>
          <span class="badge">0 commentaires</span>
        </div>
      `;
      root.appendChild(el);
    });

    if(!root.__sbBound){
      root.__sbBound = true;
      root.addEventListener("click", async (e)=>{
        const likeBtn = e.target.closest("[data-like]");
        const delId = e.target.closest("[data-del]")?.getAttribute("data-del");
        const openId = e.target.closest("[data-open]")?.getAttribute("data-open");

        if(likeBtn){
          const postId = likeBtn.getAttribute("data-like");
          const isLiked = likeBtn.getAttribute("aria-pressed") === "true" || likeBtn.classList.contains("active");
          const uid = await sbUserId();
          const company = companyFromUser();
          if(!uid) return;

          if(isLiked){
            const res = await sb
              .from("post_likes")
              .delete()
              .eq("company", company)
              .eq("post_id", postId)
              .eq("user_id", uid);
            if(res.error) sbToastError("Like", res.error);
          }else{
            const res = await sb
              .from("post_likes")
              .insert({ company, post_id: postId, user_id: uid });
            if(res.error) sbToastError("Like", res.error);
          }
          await renderFeedSupabase();
          return;
        }

        if(delId){
          const ok = confirm("Supprimer cette publication ?");
          if(!ok) return;
          const company = companyFromUser();
          let fileUrl = "";
          const pre = await sb
            .from("posts")
            .select("file_url")
            .eq("company", company)
            .eq("id", delId)
            .maybeSingle();
          if(!pre.error) fileUrl = String(pre.data?.file_url || "");

          const res = await sb.from("posts").delete().eq("company", company).eq("id", delId);
          if(res.error) sbToastError("Suppression", res.error);
          const sbUrl = parseSbStorageUrl(fileUrl);
          if(!res.error && sbUrl){
            const rm = await sb.storage.from(sbUrl.bucket).remove([sbUrl.path]);
            if(rm.error){
              console.warn("Storage remove failed", rm.error);
            }
          }
          await renderFeedSupabase();
          return;
        }

        if(openId){
          const btn = e.target.closest("[data-open]");
          const urlAttr = btn?.getAttribute("data-file-url") || "";
          const nameAttr = btn?.getAttribute("data-file-name") || "";

          // Fallback: re-fetch the post (simple + safe)
          const company = companyFromUser();
          const res = await sb
            .from("posts")
            .select("file_url,file_name")
            .eq("company", company)
            .eq("id", openId)
            .maybeSingle();
          const fileUrl = String(res.data?.file_url || urlAttr || "");
          const fileName = String(res.data?.file_name || nameAttr || "");
          await openFileFromPost({ fileUrl, fileName });
        }
      });
    }

    const form = $("#newPostForm");
    if(form && !form.__sbBound){
      form.__sbBound = true;
      form.addEventListener("submit", async (ev)=>{
        ev.preventDefault();
        const uid = await sbUserId();
        if(!uid) return;

        const title = $("#postTitle")?.value.trim() || "";
        const body  = $("#postBody")?.value.trim() || "";
        let fileUrl = $("#postFileUrl")?.value.trim() || "";
        const fileNameInput = $("#postFileName")?.value.trim() || "";
        const folderInput = $("#postFolder")?.value || "";
        const selectedFile = form.__selectedFile || null;

        let fileName = fileNameInput;
        if(!fileName && fileUrl){
          try{ fileName = new URL(fileUrl, window.location.href).pathname.split("/").pop() || ""; }catch(e){ /* ignore */ }
        }
        if(!title && !body && !fileUrl && !selectedFile){
          window.fwToast?.("Oups","Écris au moins un titre ou un message.");
          return;
        }

        const company = companyFromUser();
        if(/[\\\/]/.test(company)){
          window.fwToast?.("Entreprise invalide","Évite / ou \\ dans le nom d’entreprise/workspace.");
          return;
        }

        const postId = uuid();
        let uploadedPath = "";

        if(selectedFile){
          const subFolder = normalizeFolderPath(folderInput);
          const safeName = safeFileName(selectedFile.name);
          uploadedPath = `${company}/posts/${subFolder ? subFolder + "/" : ""}${postId}/${safeName}`;

          window.fwToast?.("Upload","Envoi du fichier…");
          const up = await sb.storage.from(STORAGE_BUCKET).upload(uploadedPath, selectedFile, {
            upsert: false,
            contentType: selectedFile.type || undefined,
            cacheControl: "3600",
          });
          if(up.error){
            const msg = up.error?.message || "Upload impossible. Vérifie le bucket + les policies Storage.";
            window.fwToast?.("Upload", msg);
            console.error("Upload", up.error);
            return;
          }

          fileUrl = `sb://${STORAGE_BUCKET}/${uploadedPath}`;
          fileName = fileName || selectedFile.name || safeName;
        }

        window.fwToast?.("Publication","Enregistrement…");
        const res = await sb.from("posts").insert({
          id: postId,
          company,
          author_id: uid,
          title: title || "Sans titre",
          body: body || "",
          file_url: fileUrl || "",
          file_name: fileName || "",
        });
        if(res.error){
          // Best-effort cleanup if upload succeeded but post insert failed.
          if(uploadedPath){
            try{ await sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]); }catch(e){ /* ignore */ }
          }
          sbToastError("Publication", res.error);
          return;
        }

        $("#postTitle") && ($("#postTitle").value = "");
        $("#postBody") && ($("#postBody").value = "");
        $("#postFileUrl") && ($("#postFileUrl").value = "");
        $("#postFileName") && ($("#postFileName").value = "");
        $("#postFolder") && ($("#postFolder").value = "");
        $("#postFile") && ($("#postFile").value = "");
        form.__selectedFile = null;
        $("#postFileInfo") && ($("#postFileInfo").textContent = "Aucun fichier sélectionné");

        await renderFeedSupabase();
        window.fwToast?.("Publié","Ta publication est en ligne.");
      });
    }
  }
  sbEnabled ? renderFeedSupabase() : renderFeed();

  // ---------- CHANNELS
  function loadChannels(){
    try{ return JSON.parse(localStorage.getItem("fwChannels") || "{}"); }catch(e){ return {}; }
  }
  function saveChannels(c){ localStorage.setItem("fwChannels", JSON.stringify(c)); }
  function loadChannelMsgs(){
    try{ return JSON.parse(localStorage.getItem("fwChannelMsgs") || "{}"); }catch(e){ return {}; }
  }
  function saveChannelMsgs(m){ localStorage.setItem("fwChannelMsgs", JSON.stringify(m)); }

  function renderChannels(){
    const panel = $("#channelPanel");
    if(!panel) return;

    const c = loadChannels();
    const allKeys = [];
    const sections = [
      {key:"public", title:"Canaux publics", icon:"#"},
      {key:"voice", title:"Canaux vocaux", icon:"🎙️"},
      {key:"private", title:"Canaux privés", icon:"🔒"},
    ];
    const msgMap = loadChannelMsgs();

    sections.forEach(s=>{
      const list = $(`[data-ch-list="${s.key}"]`);
      if(!list) return;
      list.innerHTML = "";
      (c[s.key] || []).forEach(name=>{
        const key = `${s.key}:${name}`;
        allKeys.push(key);
        const count = (msgMap[key] || []).length;
        const b = document.createElement("button");
        b.className = "ch-item";
        b.setAttribute("data-ch", key);
        b.innerHTML = `<span><span class="hash">${s.icon}</span> ${escapeHtml(name)}</span><span class="badge">${count}</span>`;
        b.addEventListener("click", ()=> showChannel(key));
        list.appendChild(b);
      });
    });

    function showChannel(key){
      localStorage.setItem("fwActiveChannel", key);
      document.querySelectorAll("[data-ch]").forEach(x=> x.classList.toggle("active", x.getAttribute("data-ch") === key));

      const [type, ...rest] = key.split(":");
      const name = rest.join(":") || "canal";
      const icon = (type === "voice") ? "🎙️" : (type === "private") ? "🔒" : "#";
      const title = name;
      const subtitle = (type === "voice") ? "Salon vocal (démo UI)" : "Salon texte (style Discord)";

      panel.innerHTML = chatShellHtml({
        icon,
        title,
        subtitle,
        placeholder: `Message ${icon === "#" ? "#" : ""}${name}`,
      });

      const u = getUser() || {name:"Utilisateur", avatarUrl:"", avatarBg:""};
      const msgsRoot = $("#chatMsgs", panel);
      const form = $("#chatForm", panel);
      const input = $("#chatInput", panel);
      const addBtn = $("[data-chat-add]", panel);
      const searchBtn = $("[data-chat-search]", panel);
      const infoBtn = $("[data-chat-info]", panel);

      const map = loadChannelMsgs();
      const msgs = map[key] || [];
      msgsRoot.innerHTML = msgs.length ? msgs.map(m=> renderChatMessageHtml(m, u)).join("") : emptyChatHtml("Aucun message", "Écris le premier message pour lancer la discussion.");
      msgsRoot.scrollTop = msgsRoot.scrollHeight;

      const btn = document.querySelector(`[data-ch="${key}"]`);
      btn?.querySelector(".badge") && (btn.querySelector(".badge").textContent = String((map[key] || []).length));

      addBtn && (addBtn.onclick = ()=> window.fwToast?.("Bientôt", "Ajout de fichiers à brancher ensuite."));
      searchBtn && (searchBtn.onclick = ()=> window.fwToast?.("Recherche", "Recherche à implémenter ensuite."));
      infoBtn && (infoBtn.onclick = ()=> window.fwToast?.("Infos", `Salon: ${title}`));
      if(input){
        input.addEventListener("input", ()=>{
          input.style.height = "0px";
          input.style.height = Math.min(input.scrollHeight, 160) + "px";
        });
        input.addEventListener("keydown", (ev)=>{
          if(ev.key === "Enter" && !ev.shiftKey){
            ev.preventDefault();
            form?.requestSubmit?.();
          }
        });
      }

      form && (form.onsubmit = (ev)=>{
        ev.preventDefault();
        const text = (input?.value || "").trim();
        if(!text) return;
        const map = loadChannelMsgs();
        map[key] = map[key] || [];
        map[key].push({from: u.name || "Moi", text, at: nowStr()});
        saveChannelMsgs(map);
        input.value = "";
        input.style.height = "";
        showChannel(key);
      });
    }

    let current = localStorage.getItem("fwActiveChannel") || "";
    if(!current || !allKeys.includes(current)) current = allKeys[0] || "";
    current ? showChannel(current) : (panel.innerHTML = emptyChatHtml("Aucun canal", "Crée un canal pour commencer."));

    // Create channel
    const createBtn = $("#createChannel");
    if(createBtn && !createBtn.__bound){
      createBtn.__bound = true;
      createBtn.addEventListener("click", ()=>{
        const type = (prompt("Type de canal ? public / private / voice", "public") || "public").toLowerCase();
        const name = (prompt("Nom du canal (ex: general)", "nouveau-canal") || "").trim().toLowerCase();
        if(!name) return;
        const map = {public:"public", private:"private", voice:"voice"};
        const k = map[type] || "public";
        const c = loadChannels();
        c[k] = c[k] || [];
        if(!c[k].includes(name)) c[k].push(name);
        saveChannels(c);
        const key = `${k}:${name}`;
        const msgs = loadChannelMsgs();
        msgs[key] = msgs[key] || [];
        saveChannelMsgs(msgs);
        localStorage.setItem("fwActiveChannel", key);
        renderChannels();
        window.fwToast?.("Canal créé", `#${name} ajouté.`);
      });
    }
  }

  async function renderChannelsSupabase(){
    const panel = $("#channelPanel");
    if(!panel) return;

    const uid = await sbUserId();
    if(!uid){
      window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
      return;
    }

    const company = companyFromUser();
    const meRole = String(getUser()?.role || "").trim().toLowerCase();

    const { data: chans, error } = await sb
      .from("channels")
      .select("*")
      .eq("company", company)
      .order("type", { ascending: true })
      .order("name", { ascending: true });
    if(error){
      sbToastError("Canaux", error);
      panel.innerHTML = emptyChatHtml("Erreur", "Impossible de charger les canaux.");
      return;
    }

    const channels = chans || [];
    const allIds = [];
    const sections = [
      {key:"public", title:"Canaux publics", icon:"#"},
      {key:"voice", title:"Canaux vocaux", icon:"🎙️"},
      {key:"private", title:"Canaux privés", icon:"🔒"},
    ];

    sections.forEach(s=>{
      const list = $(`[data-ch-list="${s.key}"]`);
      if(!list) return;
      list.innerHTML = "";
      channels.filter(c=> String(c.type) === s.key).forEach(ch=>{
        allIds.push(String(ch.id));
        const count = Number(ch.message_count || 0);
        const b = document.createElement("button");
        b.className = "ch-item";
        b.setAttribute("data-ch-id", String(ch.id));
        b.innerHTML = `<span><span class="hash">${s.icon}</span> ${escapeHtml(ch.name || "canal")}</span><span class="badge">${count}</span>`;
        b.addEventListener("click", ()=> showChannel(ch));
        list.appendChild(b);
      });
    });

    function msgAvatarHtml(profile, className){
      const p = profile || {};
      const u = {
        name: p.name || "Utilisateur",
        avatarUrl: p.avatar_url || "",
        avatarBg: p.avatar_bg || "",
      };
      const cls = className || "avatar msg-avatar";
      if(u.avatarUrl) return `<div class="${cls}"><img src="${escapeHtml(u.avatarUrl)}" alt=""/></div>`;
      const bg = u.avatarBg ? ` style="background:${escapeHtml(u.avatarBg)}"` : "";
      return `<div class="${cls}"${bg}>${escapeHtml(initials(u.name))}</div>`;
    }
    function renderSbChatMessageHtml(row, profile){
      const r = row || {};
      const p = profile || {};
      const name = String(p.name || "Utilisateur");
      const time = fmtTime(r.created_at);
      return `
        <div class="msg">
          ${msgAvatarHtml(p, "avatar msg-avatar")}
          <div class="msg-body">
            <div class="msg-head">
              <span class="msg-name">${escapeHtml(name)}</span>
              <span class="msg-time">${escapeHtml(time)}</span>
            </div>
            <div class="msg-text">${escapeHtml(String(r.text || ""))}</div>
          </div>
        </div>
      `;
    }

    async function showChannel(channel){
      const ch = channel || {};
      localStorage.setItem("fwActiveChannelId", String(ch.id || ""));
      document.querySelectorAll("[data-ch-id]").forEach(x=> x.classList.toggle("active", x.getAttribute("data-ch-id") === String(ch.id)));

      const type = String(ch.type || "public");
      const name = String(ch.name || "canal");
      const icon = (type === "voice") ? "🎙️" : (type === "private") ? "🔒" : "#";
      const subtitle = (type === "voice") ? "Salon vocal (démo UI)" : "Salon texte (style Discord)";

      panel.innerHTML = chatShellHtml({
        icon,
        title: name,
        subtitle,
        placeholder: `Message ${icon === "#" ? "#" : ""}${name}`,
      });

      const msgsRoot = $("#chatMsgs", panel);
      const form = $("#chatForm", panel);
      const input = $("#chatInput", panel);
      const addBtn = $("[data-chat-add]", panel);
      const searchBtn = $("[data-chat-search]", panel);
      const infoBtn = $("[data-chat-info]", panel);

      const msgRes = await sb
        .from("channel_messages")
        .select("*")
        .eq("company", company)
        .eq("channel_id", ch.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if(msgRes.error){
        sbToastError("Messages", msgRes.error);
        msgsRoot.innerHTML = emptyChatHtml("Erreur", "Impossible de charger les messages.");
        return;
      }

      const msgs = msgRes.data || [];
      const userIds = Array.from(new Set(msgs.map(m=> m?.user_id).filter(Boolean).map(String)));
      let profilesById = new Map();
      if(userIds.length){
        const profRes = await sb.from("profiles").select("id,name,avatar_url,avatar_bg").in("id", userIds);
        if(!profRes.error){
          profilesById = new Map((profRes.data || []).map(p=> [String(p.id), p]));
        }
      }

      msgsRoot.innerHTML = msgs.length
        ? msgs.map(m=> renderSbChatMessageHtml(m, profilesById.get(String(m.user_id)))).join("")
        : emptyChatHtml("Aucun message", "Écris le premier message pour lancer la discussion.");
      msgsRoot.scrollTop = msgsRoot.scrollHeight;

      addBtn && (addBtn.onclick = ()=> window.fwToast?.("Bientôt", "Ajout de fichiers à brancher ensuite."));
      searchBtn && (searchBtn.onclick = ()=> window.fwToast?.("Recherche", "Recherche à implémenter ensuite."));
      infoBtn && (infoBtn.onclick = ()=> window.fwToast?.("Infos", `Salon: ${name}`));

      if(input){
        input.addEventListener("input", ()=>{
          input.style.height = "0px";
          input.style.height = Math.min(input.scrollHeight, 160) + "px";
        });
        input.addEventListener("keydown", (ev)=>{
          if(ev.key === "Enter" && !ev.shiftKey){
            ev.preventDefault();
            form?.requestSubmit?.();
          }
        });
      }

      form && (form.onsubmit = async (ev)=>{
        ev.preventDefault();
        const text = (input?.value || "").trim();
        if(!text) return;
        const res = await sb.from("channel_messages").insert({
          company,
          channel_id: ch.id,
          user_id: uid,
          text,
        });
        if(res.error){
          sbToastError("Message", res.error);
          return;
        }
        input.value = "";
        input.style.height = "";
        await showChannel(ch);
      });
    }

    let current = localStorage.getItem("fwActiveChannelId") || "";
    if(!current || !allIds.includes(String(current))) current = allIds[0] || "";
    if(current){
      const ch = channels.find(x=> String(x.id) === String(current)) || channels[0];
      await showChannel(ch);
    }else{
      panel.innerHTML = emptyChatHtml("Aucun canal", "Crée un canal pour commencer.");
    }

    const createBtn = $("#createChannel");
    if(createBtn && !createBtn.__sbBound){
      createBtn.__sbBound = true;
      createBtn.addEventListener("click", async ()=>{
        if(meRole !== "admin"){
          window.fwToast?.("Accès refusé","Seul un admin peut créer des canaux (démo).");
          return;
        }
        const type = (prompt("Type de canal ? public / private / voice", "public") || "public").toLowerCase();
        const name = (prompt("Nom du canal (ex: general)", "nouveau-canal") || "").trim().toLowerCase();
        if(!name) return;
        const map = {public:"public", private:"private", voice:"voice"};
        const k = map[type] || "public";
        const res = await sb.from("channels").insert({ company, type: k, name }).select("*").single();
        if(res.error){
          sbToastError("Canal", res.error);
          return;
        }
        localStorage.setItem("fwActiveChannelId", String(res.data?.id || ""));
        await renderChannelsSupabase();
        window.fwToast?.("Canal créé", `#${name} ajouté.`);
      });
    }
  }
  sbEnabled ? renderChannelsSupabase() : renderChannels();

  // ---------- MESSAGES (DM)
  function loadDMs(){
    try{ return JSON.parse(localStorage.getItem("fwDMs") || "{}"); }catch(e){ return {}; }
  }
  function saveDMs(d){ localStorage.setItem("fwDMs", JSON.stringify(d)); }

  function renderDM(){
    const list = $("#dmList");
    const convo = $("#dmConvo");
    if(!list || !convo) return;

    const dms = loadDMs();
    const names = Object.keys(dms).sort((a,b)=> a.localeCompare(b, "fr"));
    list.innerHTML = "";
    names.forEach((n)=>{
      const b = document.createElement("button");
      b.className = "ch-item";
      b.setAttribute("data-dm", n);
      const count = (dms[n] || []).length;
      b.innerHTML = `
        <span class="item-left">
          ${renderNameAvatarHtml(n, "mini-avatar")}
          <span class="truncate">${escapeHtml(n)}</span>
        </span>
        <span class="badge">${count}</span>
      `;
      b.addEventListener("click", ()=> showDM(n));
      list.appendChild(b);
    });

    function showDM(name){
      const u = getUser() || {name:"Utilisateur", avatarUrl:"", avatarBg:""};
      localStorage.setItem("fwActiveDM", name || "");
      document.querySelectorAll("[data-dm]").forEach(x=> x.classList.toggle("active", x.getAttribute("data-dm") === name));

      convo.innerHTML = name ? chatShellHtml({
        icon: "@",
        title: name,
        subtitle: "Discussion privée (style Discord)",
        placeholder: `Message @${name}`,
      }) : emptyChatHtml("Aucun message", "Crée une discussion pour commencer.");

      if(!name) return;

      const dmMsgs = $("#chatMsgs", convo);
      const form = $("#chatForm", convo);
      const input = $("#chatInput", convo);
      const addBtn = $("[data-chat-add]", convo);
      const searchBtn = $("[data-chat-search]", convo);
      const infoBtn = $("[data-chat-info]", convo);

      const dms = loadDMs();
      const msgs = dms[name] || [];
      dmMsgs.innerHTML = msgs.length ? msgs.map(m=> renderChatMessageHtml(m, u)).join("") : emptyChatHtml("Aucun message", "Envoie le premier message.");
      dmMsgs.scrollTop = dmMsgs.scrollHeight;

      const btn = document.querySelector(`[data-dm="${name}"]`);
      btn?.querySelector(".badge") && (btn.querySelector(".badge").textContent = String(msgs.length));

      addBtn && (addBtn.onclick = ()=> window.fwToast?.("Bientôt", "Ajout de fichiers à brancher ensuite."));
      searchBtn && (searchBtn.onclick = ()=> window.fwToast?.("Recherche", "Recherche à implémenter ensuite."));
      infoBtn && (infoBtn.onclick = ()=> window.fwToast?.("Infos", `DM avec ${name}`));
      if(input){
        input.addEventListener("input", ()=>{
          input.style.height = "0px";
          input.style.height = Math.min(input.scrollHeight, 160) + "px";
        });
        input.addEventListener("keydown", (ev)=>{
          if(ev.key === "Enter" && !ev.shiftKey){
            ev.preventDefault();
            form?.requestSubmit?.();
          }
        });
      }

      form && (form.onsubmit = (ev)=>{
        ev.preventDefault();
        const text = (input?.value || "").trim();
        if(!text) return;
        const dms = loadDMs();
        dms[name] = dms[name] || [];
        dms[name].push({from: u.name || "Moi", text, at: nowStr()});
        saveDMs(dms);
        input.value = "";
        input.style.height = "";
        showDM(name);
      });
    }

    const createBtn = $("#createDM");
    if(createBtn){
      createBtn.onclick = ()=>{
        const name = (prompt("Nom du contact", "Nouveau contact") || "").trim();
        if(!name) return;
        const dms = loadDMs();
        if(!dms[name]) dms[name] = [];
        saveDMs(dms);
        localStorage.setItem("fwActiveDM", name);
        renderDM();
        window.fwToast?.("DM créé", `Discussion avec ${name}.`);
      };
    }

    let current = localStorage.getItem("fwActiveDM") || "";
    if(!current || !dms[current]) current = names[0] || "";
    current ? showDM(current) : (convo.innerHTML = emptyChatHtml("Aucun contact", "Crée un DM pour commencer."));
  }

  async function renderDMSupabase(){
    const list = $("#dmList");
    const convo = $("#dmConvo");
    if(!list || !convo) return;

    const uid = await sbUserId();
    if(!uid){
      window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
      return;
    }

    const company = companyFromUser();

    const threadsRes = await sb
      .from("dm_threads")
      .select("*")
      .eq("company", company)
      .or(`user1.eq.${uid},user2.eq.${uid}`)
      .order("last_message_at", { ascending: false })
      .order("created_at", { ascending: false });

    if(threadsRes.error){
      sbToastError("DM", threadsRes.error);
      convo.innerHTML = emptyChatHtml("Erreur", "Impossible de charger les messages.");
      return;
    }

    const threads = threadsRes.data || [];
    const otherIds = Array.from(new Set(threads.map(t=> (String(t.user1) === String(uid)) ? t.user2 : t.user1).filter(Boolean).map(String)));

    let othersById = new Map();
    if(otherIds.length){
      const profRes = await sb
        .from("profiles")
        .select("id,name,email,avatar_url,avatar_bg")
        .in("id", otherIds);
      if(!profRes.error){
        othersById = new Map((profRes.data || []).map(p=> [String(p.id), p]));
      }
    }

    list.innerHTML = "";
    threads.forEach(t=>{
      const otherId = (String(t.user1) === String(uid)) ? String(t.user2) : String(t.user1);
      const other = othersById.get(otherId) || { name: "Contact" };
      const count = Number(t.message_count || 0);

      const b = document.createElement("button");
      b.className = "ch-item";
      b.setAttribute("data-dm-thread", String(t.id));
      b.innerHTML = `
        <span class="item-left">
          ${renderNameAvatarHtml(other.name || "C", "mini-avatar")}
          <span class="truncate">${escapeHtml(other.name || "Contact")}</span>
        </span>
        <span class="badge">${count}</span>
      `;
      b.addEventListener("click", ()=> showDM(t));
      list.appendChild(b);
    });

    function msgAvatarHtml(profile, className){
      const p = profile || {};
      const u = {
        name: p.name || "Utilisateur",
        avatarUrl: p.avatar_url || "",
        avatarBg: p.avatar_bg || "",
      };
      const cls = className || "avatar msg-avatar";
      if(u.avatarUrl) return `<div class="${cls}"><img src="${escapeHtml(u.avatarUrl)}" alt=""/></div>`;
      const bg = u.avatarBg ? ` style="background:${escapeHtml(u.avatarBg)}"` : "";
      return `<div class="${cls}"${bg}>${escapeHtml(initials(u.name))}</div>`;
    }
    function renderSbChatMessageHtml(row, profile){
      const r = row || {};
      const p = profile || {};
      const name = String(p.name || "Utilisateur");
      const time = fmtTime(r.created_at);
      return `
        <div class="msg">
          ${msgAvatarHtml(p, "avatar msg-avatar")}
          <div class="msg-body">
            <div class="msg-head">
              <span class="msg-name">${escapeHtml(name)}</span>
              <span class="msg-time">${escapeHtml(time)}</span>
            </div>
            <div class="msg-text">${escapeHtml(String(r.text || ""))}</div>
          </div>
        </div>
      `;
    }

    async function showDM(thread){
      const t = thread || {};
      localStorage.setItem("fwActiveDMThreadId", String(t.id || ""));
      document.querySelectorAll("[data-dm-thread]").forEach(x=> x.classList.toggle("active", x.getAttribute("data-dm-thread") === String(t.id)));

      const otherId = (String(t.user1) === String(uid)) ? String(t.user2) : String(t.user1);
      const other = othersById.get(otherId) || { name: "Contact" };

      convo.innerHTML = t.id ? chatShellHtml({
        icon: "@",
        title: other.name || "Contact",
        subtitle: "Discussion privée (style Discord)",
        placeholder: `Message @${other.name || "contact"}`,
      }) : emptyChatHtml("Aucun message", "Crée une discussion pour commencer.");

      if(!t.id) return;

      const dmMsgs = $("#chatMsgs", convo);
      const form = $("#chatForm", convo);
      const input = $("#chatInput", convo);
      const addBtn = $("[data-chat-add]", convo);
      const searchBtn = $("[data-chat-search]", convo);
      const infoBtn = $("[data-chat-info]", convo);

      const msgsRes = await sb
        .from("dm_messages")
        .select("*")
        .eq("company", company)
        .eq("thread_id", t.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if(msgsRes.error){
        sbToastError("DM", msgsRes.error);
        dmMsgs.innerHTML = emptyChatHtml("Erreur", "Impossible de charger les messages.");
        return;
      }

      const msgs = msgsRes.data || [];
      const senderIds = Array.from(new Set(msgs.map(m=> m?.sender_id).filter(Boolean).map(String)));
      let sendersById = new Map();
      if(senderIds.length){
        const profRes = await sb.from("profiles").select("id,name,avatar_url,avatar_bg").in("id", senderIds);
        if(!profRes.error) sendersById = new Map((profRes.data || []).map(p=> [String(p.id), p]));
      }

      dmMsgs.innerHTML = msgs.length
        ? msgs.map(m=> renderSbChatMessageHtml(m, sendersById.get(String(m.sender_id)))).join("")
        : emptyChatHtml("Aucun message", "Envoie le premier message.");
      dmMsgs.scrollTop = dmMsgs.scrollHeight;

      addBtn && (addBtn.onclick = ()=> window.fwToast?.("Bientôt", "Ajout de fichiers à brancher ensuite."));
      searchBtn && (searchBtn.onclick = ()=> window.fwToast?.("Recherche", "Recherche à implémenter ensuite."));
      infoBtn && (infoBtn.onclick = ()=> window.fwToast?.("Infos", `DM avec ${other.name || "contact"}`));

      if(input){
        input.addEventListener("input", ()=>{
          input.style.height = "0px";
          input.style.height = Math.min(input.scrollHeight, 160) + "px";
        });
        input.addEventListener("keydown", (ev)=>{
          if(ev.key === "Enter" && !ev.shiftKey){
            ev.preventDefault();
            form?.requestSubmit?.();
          }
        });
      }

      form && (form.onsubmit = async (ev)=>{
        ev.preventDefault();
        const text = (input?.value || "").trim();
        if(!text) return;

        const res = await sb.from("dm_messages").insert({
          company,
          thread_id: t.id,
          sender_id: uid,
          text,
        });
        if(res.error){
          sbToastError("DM", res.error);
          return;
        }
        input.value = "";
        input.style.height = "";
        await showDM(t);
      });
    }

    const createBtn = $("#createDM");
    if(createBtn && !createBtn.__sbBound){
      createBtn.__sbBound = true;
      createBtn.addEventListener("click", async ()=>{
        const email = (prompt("Email du contact", "camille@exemple.com") || "").trim();
        if(!email) return;
        const pRes = await sb
          .from("profiles")
          .select("id,name,email")
          .eq("company", company)
          .eq("email", email)
          .maybeSingle();
        if(pRes.error){
          sbToastError("Contact", pRes.error);
          return;
        }
        const other = pRes.data;
        if(!other?.id){
          window.fwToast?.("Introuvable","Le membre doit se connecter au moins une fois pour apparaître.");
          return;
        }
        if(String(other.id) === String(uid)){
          window.fwToast?.("Info","Tu ne peux pas créer un DM avec toi-même.");
          return;
        }
        const ids = [String(uid), String(other.id)].sort();
        const up = await sb
          .from("dm_threads")
          .upsert({ company, user1: ids[0], user2: ids[1] }, { onConflict: "company,user1,user2" })
          .select("*")
          .single();
        if(up.error){
          sbToastError("DM", up.error);
          return;
        }
        localStorage.setItem("fwActiveDMThreadId", String(up.data?.id || ""));
        await renderDMSupabase();
        window.fwToast?.("DM créé", `Discussion avec ${other.name || email}.`);
      });
    }

    let current = localStorage.getItem("fwActiveDMThreadId") || "";
    if(!current || !threads.some(t=> String(t.id) === String(current))) current = threads[0]?.id || "";
    current ? await showDM(threads.find(t=> String(t.id) === String(current))) : (convo.innerHTML = emptyChatHtml("Aucun contact", "Crée un DM pour commencer."));
  }
  sbEnabled ? renderDMSupabase() : renderDM();

  // ---------- SETTINGS
  function renderSettings(){
    const form = $("#settingsForm");
    if(!form) return;

    const initials = (name)=>{
      const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
      return parts.slice(0,2).map(s=>s[0]?.toUpperCase() || "U").join("") || "U";
    };
    const updateUser = (patch)=>{
      const curr = getUser() || {};
      setUser({ ...curr, ...patch });
      window.fw?.hydrateUserUI?.();
    };

    const u = getUser() || {};
    $("#setName") && ($("#setName").value = u.name || "");
    $("#setCompany") && ($("#setCompany").value = u.company || "");
    $("#avatarUrl") && ($("#avatarUrl").value = u.avatarUrl || "");

    // Avatar presets (colors)
    const presetsRoot = $("#avatarPresets");
    if(presetsRoot && !presetsRoot.__built){
      presetsRoot.__built = true;
      const bgs = [
        "linear-gradient(135deg, rgba(255,106,0,.95), rgba(255,45,120,.95))",
        "linear-gradient(135deg, rgba(46,231,255,.70), rgba(123,92,255,.86))",
        "linear-gradient(135deg, rgba(34,197,94,.85), rgba(14,165,233,.75))",
        "linear-gradient(135deg, rgba(250,204,21,.92), rgba(249,115,22,.85))",
        "linear-gradient(135deg, rgba(239,68,68,.86), rgba(255,45,120,.78))",
        "linear-gradient(135deg, rgba(168,85,247,.84), rgba(59,130,246,.72))",
      ];
      const label = initials(u.name || "Utilisateur");
      bgs.forEach(bg=>{
        const el = document.createElement("div");
        el.className = "preset";
        el.style.background = bg;
        el.textContent = label;
        el.title = "Choisir cet avatar";
        el.addEventListener("click", ()=>{
          updateUser({ avatarBg: bg, avatarUrl: "" });
          $("#avatarUrl") && ($("#avatarUrl").value = "");
          window.fwToast?.("Avatar","Couleur appliquée.");
        });
        presetsRoot.appendChild(el);
      });
    }

    // Avatar URL
    const urlInput = $("#avatarUrl");
    if(urlInput && !urlInput.__bound){
      urlInput.__bound = true;
      urlInput.addEventListener("change", ()=>{
        const url = urlInput.value.trim();
        updateUser({ avatarUrl: url, avatarBg: url ? "" : (getUser()?.avatarBg || "") });
        url && window.fwToast?.("Avatar","URL enregistrée.");
      });
    }

    // Avatar upload
    const fileInput = $("#avatarFile");
    if(fileInput && !fileInput.__bound){
      fileInput.__bound = true;
      fileInput.addEventListener("change", ()=>{
        const file = fileInput.files && fileInput.files[0];
        if(!file) return;
        if(file.size > 2000000){
          window.fwToast?.("Image trop lourde","Choisis une image de moins de 2 MB (démo).");
          fileInput.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = ()=>{
          updateUser({ avatarUrl: String(reader.result || ""), avatarBg: "" });
          $("#avatarUrl") && ($("#avatarUrl").value = "");
          window.fwToast?.("Avatar","Image enregistrée.");
        };
        reader.readAsDataURL(file);
      });
    }

    // Save profile
    if(!form.__bound){
      form.__bound = true;
      form.addEventListener("submit", (ev)=>{
        ev.preventDefault();
        const name = $("#setName")?.value.trim() || "Utilisateur";
        const company = $("#setCompany")?.value.trim() || "Entreprise";
        updateUser({ name, company });
        presetsRoot?.querySelectorAll(".preset").forEach(p=> p.textContent = initials(name));
        window.fwToast?.("Enregistré","Profil mis à jour.");
      });
    }

    $("#clearDemo")?.addEventListener("click", ()=>{
      localStorage.removeItem("fwPosts");
      localStorage.removeItem("fwChannels");
      localStorage.removeItem("fwDMs");
      localStorage.removeItem("fwRoles");
      localStorage.removeItem("fwMembers");
      localStorage.removeItem("fwActiveAdmin");
      window.fwToast?.("Réinitialisé","Données de démo supprimées.");
    });
  }

  async function renderSettingsSupabase(){
    const form = $("#settingsForm");
    if(!form) return;

    const uid = await sbUserId();
    if(!uid){
      window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
      return;
    }

    const initialsLocal = (name)=>{
      const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
      return parts.slice(0,2).map(s=>s[0]?.toUpperCase() || "U").join("") || "U";
    };

    const updateProfile = async (patch)=>{
      const payload = {};
      if(patch && Object.prototype.hasOwnProperty.call(patch, "name")) payload.name = patch.name;
      if(patch && Object.prototype.hasOwnProperty.call(patch, "company")) payload.company = patch.company;
      if(patch && Object.prototype.hasOwnProperty.call(patch, "avatarUrl")) payload.avatar_url = patch.avatarUrl;
      if(patch && Object.prototype.hasOwnProperty.call(patch, "avatarBg")) payload.avatar_bg = patch.avatarBg;

      const res = await sb.from("profiles").update(payload).eq("id", uid);
      if(res.error){
        sbToastError("Profil", res.error);
        return false;
      }
      await window.fwSupabase?.syncLocalUser?.();
      return true;
    };

    const u = getUser() || {};
    $("#setName") && ($("#setName").value = u.name || "");
    $("#setCompany") && ($("#setCompany").value = u.company || "");
    $("#avatarUrl") && ($("#avatarUrl").value = u.avatarUrl || "");

    // In Supabase mode, company is the workspace key: keep it read-only (demo safety).
    const companyInput = $("#setCompany");
    if(companyInput){
      companyInput.disabled = true;
      companyInput.title = "Entreprise gérée par le workspace Supabase (démo)";
    }

    // Avatar presets (colors)
    const presetsRoot = $("#avatarPresets");
    if(presetsRoot && !presetsRoot.__built){
      presetsRoot.__built = true;
      const bgs = [
        "linear-gradient(135deg, rgba(255,106,0,.95), rgba(255,45,120,.95))",
        "linear-gradient(135deg, rgba(46,231,255,.70), rgba(123,92,255,.86))",
        "linear-gradient(135deg, rgba(34,197,94,.85), rgba(14,165,233,.75))",
        "linear-gradient(135deg, rgba(250,204,21,.92), rgba(249,115,22,.85))",
        "linear-gradient(135deg, rgba(239,68,68,.86), rgba(255,45,120,.78))",
        "linear-gradient(135deg, rgba(168,85,247,.84), rgba(59,130,246,.72))",
      ];
      const label = initialsLocal(u.name || "Utilisateur");
      bgs.forEach(bg=>{
        const el = document.createElement("div");
        el.className = "preset";
        el.style.background = bg;
        el.textContent = label;
        el.title = "Choisir cet avatar";
        el.addEventListener("click", async ()=>{
          await updateProfile({ avatarBg: bg, avatarUrl: "" });
          $("#avatarUrl") && ($("#avatarUrl").value = "");
          window.fwToast?.("Avatar","Couleur appliquée.");
        });
        presetsRoot.appendChild(el);
      });
    }

    // Avatar URL
    const urlInput = $("#avatarUrl");
    if(urlInput && !urlInput.__sbBound){
      urlInput.__sbBound = true;
      urlInput.addEventListener("change", async ()=>{
        const url = urlInput.value.trim();
        await updateProfile({ avatarUrl: url, avatarBg: url ? "" : (getUser()?.avatarBg || "") });
        url && window.fwToast?.("Avatar","URL enregistrée.");
      });
    }

    // Avatar upload (stored as dataURL in DB for demo)
    const fileInput = $("#avatarFile");
    if(fileInput && !fileInput.__sbBound){
      fileInput.__sbBound = true;
      fileInput.addEventListener("change", ()=>{
        const file = fileInput.files && fileInput.files[0];
        if(!file) return;
        if(file.size > 2000000){
          window.fwToast?.("Image trop lourde","Choisis une image de moins de 2 MB (démo).");
          fileInput.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = async ()=>{
          await updateProfile({ avatarUrl: String(reader.result || ""), avatarBg: "" });
          $("#avatarUrl") && ($("#avatarUrl").value = "");
          window.fwToast?.("Avatar","Image enregistrée.");
        };
        reader.readAsDataURL(file);
      });
    }

    // Save profile
    if(!form.__sbBound){
      form.__sbBound = true;
      form.addEventListener("submit", async (ev)=>{
        ev.preventDefault();
        const name = $("#setName")?.value.trim() || "Utilisateur";
        await updateProfile({ name });
        presetsRoot?.querySelectorAll(".preset").forEach(p=> p.textContent = initialsLocal(name));
        window.fwToast?.("Enregistré","Profil mis à jour.");
      });
    }

    $("#clearDemo")?.addEventListener("click", ()=>{
      localStorage.removeItem("fwPosts");
      localStorage.removeItem("fwChannels");
      localStorage.removeItem("fwDMs");
      localStorage.removeItem("fwRoles");
      localStorage.removeItem("fwMembers");
      localStorage.removeItem("fwActiveAdmin");
      localStorage.removeItem("fwActiveChannelId");
      localStorage.removeItem("fwActiveDMThreadId");
      window.fwToast?.("Nettoyé","Cache local supprimé (Supabase inchangé).");
    });
  }

  sbEnabled ? renderSettingsSupabase() : renderSettings();

  // ---------- ADMIN (roles/members)
  const ADMIN_ACTIVE_KEY = "fwActiveAdmin";

  function loadRoles(){
    try{
      const v = JSON.parse(localStorage.getItem("fwRoles") || "[]");
      return Array.isArray(v) ? v : [];
    }catch(e){ return []; }
  }
  function saveRoles(arr){ localStorage.setItem("fwRoles", JSON.stringify(arr || [])); }

  function loadMembers(){
    try{
      const v = JSON.parse(localStorage.getItem("fwMembers") || "[]");
      return Array.isArray(v) ? v : [];
    }catch(e){ return []; }
  }
  function saveMembers(arr){ localStorage.setItem("fwMembers", JSON.stringify(arr || [])); }

  function normalizeEmail(s){ return String(s || "").trim().toLowerCase(); }
  function normalizeHexColor(raw, fallback="#7c3aed"){
    const s = String(raw || "").trim();
    const m = s.match(/^#?[0-9a-fA-F]{6}$/);
    if(m) return s.startsWith("#") ? s : `#${s}`;
    return fallback;
  }
  function roleById(roles){
    const m = new Map();
    (roles || []).forEach(r=>{
      if(r && r.id) m.set(String(r.id), r);
    });
    return m;
  }
  function memberForUser(members, user){
    const u = user || {};
    const email = normalizeEmail(u.email);
    if(email){
      const found = (members || []).find(m=> normalizeEmail(m?.email) === email);
      if(found) return found;
    }
    const name = String(u.name || "").trim();
    if(name){
      return (members || []).find(m=> String(m?.name || "").trim() === name) || null;
    }
    return null;
  }
  function hasPerm(member, roles, key){
    const ids = Array.isArray(member?.roleIds) ? member.roleIds : [];
    const byId = roleById(roles);
    for(const id of ids){
      const r = byId.get(String(id));
      if(!r) continue;
      const perms = r.perms || {};
      if(perms.admin) return true;
      if(perms[key]) return true;
    }
    return false;
  }
  function canManageAdmin(user, member, roles){
    const uRole = String(user?.role || "").trim().toLowerCase();
    if(uRole === "admin") return true;
    return hasPerm(member, roles, "manageRoles") || hasPerm(member, roles, "manageMembers") || hasPerm(member, roles, "admin");
  }
  function roleMemberCount(roleId, members){
    const id = String(roleId || "");
    return (members || []).filter(m=> Array.isArray(m?.roleIds) && m.roleIds.map(String).includes(id)).length;
  }
  function primaryRole(member, roles){
    const ids = Array.isArray(member?.roleIds) ? member.roleIds.map(String) : [];
    const byId = roleById(roles);
    const admin = ids.map(id=> byId.get(id)).find(r=> r?.perms?.admin || String(r?.name || "").trim().toLowerCase() === "admin");
    if(admin) return admin;
    return ids.map(id=> byId.get(id)).find(Boolean) || null;
  }
  function emptyAdminHtml(icon, title, hint){
    return `
      <div class="empty">
        <div>
          <div class="big">${escapeHtml(icon || "🛡️")}</div>
          <div class="title">${escapeHtml(title || "")}</div>
          <div class="hint">${escapeHtml(hint || "")}</div>
        </div>
      </div>
    `;
  }
  function roleEditorHtml(role, roles, members){
    const r = role || {};
    const count = roleMemberCount(r.id, members);
    const perms = r.perms || {};
    const color = normalizeHexColor(r.color || "#7c3aed");
    return `
      <div class="badge">Rôle</div>
      <h2 style="margin:10px 0 6px; font-size:26px">${escapeHtml(r.name || "Rôle")}</h2>
      <p class="page-sub">${count} membre${count > 1 ? "s" : ""} • Couleur: <span class="role-pill"><span class="role-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(color)}</span></p>

      <div class="hr"></div>

      <form id="adminRoleForm" class="col" style="gap:14px">
        <div class="grid2">
          <div>
            <div class="label">Nom du rôle</div>
            <input class="input" id="roleName" value="${escapeHtml(r.name || "")}" placeholder="Ex: Modérateur"/>
          </div>
          <div>
            <div class="label">Couleur</div>
            <div class="row" style="gap:10px; align-items:center; flex-wrap:wrap">
              <input class="color-swatch" id="roleColorPicker" type="color" value="${escapeHtml(color)}" aria-label="Couleur du rôle"/>
              <input class="input" id="roleColor" value="${escapeHtml(color)}" placeholder="#7c3aed" style="width:160px"/>
            </div>
          </div>
        </div>

        <div>
          <div class="label">Permissions</div>
          <div class="checklist" style="margin-top:8px">
            <label class="check">
              <div>
                <div class="t">Administrateur</div>
                <div class="d">Accès complet (comme Discord).</div>
              </div>
              <input type="checkbox" id="perm_admin" ${perms.admin ? "checked" : ""}/>
            </label>

            <label class="check">
              <div>
                <div class="t">Gérer les rôles</div>
                <div class="d">Créer, modifier et supprimer des rôles.</div>
              </div>
              <input type="checkbox" id="perm_manageRoles" ${perms.manageRoles ? "checked" : ""}/>
            </label>

            <label class="check">
              <div>
                <div class="t">Gérer les membres</div>
                <div class="d">Inviter/retirer et attribuer des rôles.</div>
              </div>
              <input type="checkbox" id="perm_manageMembers" ${perms.manageMembers ? "checked" : ""}/>
            </label>

            <label class="check">
              <div>
                <div class="t">Gérer les canaux</div>
                <div class="d">Créer et supprimer des canaux.</div>
              </div>
              <input type="checkbox" id="perm_manageChannels" ${perms.manageChannels ? "checked" : ""}/>
            </label>
          </div>
        </div>

        <div class="row" style="justify-content:space-between; flex-wrap:wrap; gap:10px">
          <button class="btn primary" type="submit">💾 Enregistrer</button>
          <button class="btn" type="button" id="deleteRole" style="border-color: rgba(255,120,150,.35); color: rgba(255,120,150,.95)">🗑️ Supprimer</button>
        </div>
      </form>
    `;
  }
  function memberEditorHtml(member, roles){
    const m = member || {};
    const roleObjects = (Array.isArray(m.roleIds) ? m.roleIds : [])
      .map(id=> roles.find(r=> String(r.id) === String(id)))
      .filter(Boolean);
    const subtitle = roleObjects.length ? roleObjects.map(r=> r.name).join(", ") : "Aucun rôle";

    const avatar = m.avatarUrl
      ? `<div class="avatar lg"><img src="${escapeHtml(m.avatarUrl)}" alt=""/></div>`
      : `<div class="avatar lg" style="background:${escapeHtml(m.avatarBg || avatarBgFor(m.name))}">${escapeHtml(initials(m.name))}</div>`;

    return `
      <div class="badge">Membre</div>
      <div class="row" style="justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap; margin-top:10px">
        <div class="row" style="gap:12px; align-items:center; min-width:240px">
          ${avatar}
          <div style="min-width:0">
            <div style="font-weight:950; font-size:22px" class="truncate">${escapeHtml(m.name || "Membre")}</div>
            <div class="sub truncate" style="margin-top:3px">${escapeHtml(m.email || "—")} • ${escapeHtml(subtitle)}</div>
          </div>
        </div>
        <div class="badge">Membre depuis: ${escapeHtml(m.joinedAt || "—")}</div>
      </div>

      <div class="hr"></div>

      <form id="adminMemberForm" class="col" style="gap:14px">
        <div class="grid2">
          <div>
            <div class="label">Nom</div>
            <input class="input" id="memName" value="${escapeHtml(m.name || "")}" placeholder="Nom du membre"/>
          </div>
          <div>
            <div class="label">Email</div>
            <input class="input" id="memEmail" value="${escapeHtml(m.email || "")}" placeholder="email@exemple.com"/>
          </div>
        </div>

        <div>
          <div class="label">Entreprise</div>
          <input class="input" id="memCompany" value="${escapeHtml(m.company || "")}" placeholder="Entreprise"/>
        </div>

        <div>
          <div class="label">Rôles</div>
          <div class="checklist" style="margin-top:8px">
            ${(roles || []).map(r=>{
              const checked = Array.isArray(m.roleIds) && m.roleIds.map(String).includes(String(r.id));
              const c = normalizeHexColor(r.color || "#7c3aed");
              const hint = r.perms?.admin ? "Administrateur" : (r.perms?.manageMembers || r.perms?.manageRoles ? "Gestion" : "Standard");
              return `
                <label class="check">
                  <div>
                    <div class="t"><span class="role-pill"><span class="role-dot" style="background:${escapeHtml(c)}"></span>${escapeHtml(r.name || "")}</span></div>
                    <div class="d">${escapeHtml(hint)}</div>
                  </div>
                  <input type="checkbox" name="memberRole" value="${escapeHtml(r.id)}" ${checked ? "checked" : ""}/>
                </label>
              `;
            }).join("")}
          </div>
        </div>

        <div class="row" style="justify-content:space-between; flex-wrap:wrap; gap:10px">
          <button class="btn primary" type="submit">💾 Enregistrer</button>
          <button class="btn" type="button" id="deleteMember" style="border-color: rgba(255,120,150,.35); color: rgba(255,120,150,.95)">🗑️ Supprimer</button>
        </div>
      </form>
    `;
  }

  function renderAdmin(){
    const rolesRoot = $("#adminRolesList");
    const membersRoot = $("#adminMembersList");
    const main = $("#adminMain");
    if(!rolesRoot || !membersRoot || !main) return;

    let roles = loadRoles();
    let members = loadMembers();

    const u = getUser() || {};
    const me = memberForUser(members, u);
    const canManage = canManageAdmin(u, me, roles);

    const createRoleBtn = $("#createRole");
    const createMemberBtn = $("#createMember");
    if(createRoleBtn) createRoleBtn.disabled = !canManage;
    if(createMemberBtn) createMemberBtn.disabled = !canManage;

    const sortedRoles = roles.slice().sort((a,b)=>{
      const an = String(a?.name || "");
      const bn = String(b?.name || "");
      const aIsAdmin = an.trim().toLowerCase() === "admin";
      const bIsAdmin = bn.trim().toLowerCase() === "admin";
      if(aIsAdmin && !bIsAdmin) return -1;
      if(bIsAdmin && !aIsAdmin) return 1;
      return an.localeCompare(bn, "fr");
    });
    const sortedMembers = members.slice().sort((a,b)=> String(a?.name || "").localeCompare(String(b?.name || ""), "fr"));

    let active = String(localStorage.getItem(ADMIN_ACTIVE_KEY) || "");
    const setDefaultActive = ()=>{
      const adminRole = sortedRoles.find(r=> String(r?.name || "").trim().toLowerCase() === "admin");
      if(adminRole?.id) return `role:${adminRole.id}`;
      if(sortedRoles[0]?.id) return `role:${sortedRoles[0].id}`;
      if(sortedMembers[0]?.id) return `member:${sortedMembers[0].id}`;
      return "";
    };
    if(!active) active = setDefaultActive();
    if(!active){
      main.innerHTML = emptyAdminHtml("🛡️","Aucune donnée","Réinitialise la démo pour recréer des rôles/membres.");
      return;
    }

    const [activeType, activeId] = active.split(":");
    const hasActiveRole = activeType === "role" && sortedRoles.some(r=> String(r.id) === String(activeId));
    const hasActiveMember = activeType === "member" && sortedMembers.some(m=> String(m.id) === String(activeId));
    if(!hasActiveRole && !hasActiveMember){
      active = setDefaultActive();
      localStorage.setItem(ADMIN_ACTIVE_KEY, active);
    }else{
      localStorage.setItem(ADMIN_ACTIVE_KEY, active);
    }

    // Sidebar lists
    rolesRoot.innerHTML = "";
    sortedRoles.forEach(r=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ch-item";
      b.setAttribute("data-admin-role", String(r.id));
      if(active === `role:${r.id}`) b.classList.add("active");
      const c = normalizeHexColor(r.color || "#7c3aed");
      const count = roleMemberCount(r.id, members);
      b.innerHTML = `
        <span class="item-left truncate">
          <span class="role-dot" style="background:${escapeHtml(c)}" aria-hidden="true"></span>
          <span class="truncate">${escapeHtml(r.name || "Rôle")}</span>
        </span>
        <span class="badge">${count}</span>
      `;
      rolesRoot.appendChild(b);
    });

    membersRoot.innerHTML = "";
    sortedMembers.forEach(m=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ch-item";
      b.setAttribute("data-admin-member", String(m.id));
      if(active === `member:${m.id}`) b.classList.add("active");
      const r = primaryRole(m, roles);
      const c = normalizeHexColor(r?.color || "#7c3aed");
      b.innerHTML = `
        <span class="item-left truncate">
          ${renderNameAvatarHtml(m.name || "M", "mini-avatar")}
          <span class="truncate">${escapeHtml(m.name || "Membre")}</span>
        </span>
        <span class="role-pill"><span class="role-dot" style="background:${escapeHtml(c)}" aria-hidden="true"></span>${escapeHtml(r?.name || "—")}</span>
      `;
      membersRoot.appendChild(b);
    });

    if(!rolesRoot.__bound){
      rolesRoot.__bound = true;
      rolesRoot.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-admin-role]");
        if(!btn) return;
        const id = btn.getAttribute("data-admin-role");
        localStorage.setItem(ADMIN_ACTIVE_KEY, `role:${id}`);
        renderAdmin();
      });
    }
    if(!membersRoot.__bound){
      membersRoot.__bound = true;
      membersRoot.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-admin-member]");
        if(!btn) return;
        const id = btn.getAttribute("data-admin-member");
        localStorage.setItem(ADMIN_ACTIVE_KEY, `member:${id}`);
        renderAdmin();
      });
    }

    if(createRoleBtn && !createRoleBtn.__bound){
      createRoleBtn.__bound = true;
      createRoleBtn.addEventListener("click", ()=>{
        if(createRoleBtn.disabled){
          window.fwToast?.("Accès refusé","Tu n'as pas la permission de créer un rôle.");
          return;
        }
        const name = (prompt("Nom du rôle", "Nouveau rôle") || "").trim();
        if(!name) return;
        const color = normalizeHexColor(prompt("Couleur (hex)", "#7c3aed") || "#7c3aed");
        const roles = loadRoles();
        const id = cryptoRandom();
        roles.push({ id, name, color, perms: {}, createdAt: dateStr() });
        saveRoles(roles);
        localStorage.setItem(ADMIN_ACTIVE_KEY, `role:${id}`);
        renderAdmin();
        window.fwToast?.("Rôle créé", name);
      });
    }

    if(createMemberBtn && !createMemberBtn.__bound){
      createMemberBtn.__bound = true;
      createMemberBtn.addEventListener("click", ()=>{
        if(createMemberBtn.disabled){
          window.fwToast?.("Accès refusé","Tu n'as pas la permission d'ajouter un membre.");
          return;
        }
        const email = (prompt("Email du membre", "nouveau@exemple.com") || "").trim();
        if(!email) return;
        const members = loadMembers();
        if(members.some(m=> normalizeEmail(m?.email) === normalizeEmail(email))){
          window.fwToast?.("Déjà présent","Un membre avec cet email existe déjà.");
          return;
        }
        const nameGuess = email.split("@")[0].replace(/[._-]+/g," ").trim();
        const name = (prompt("Nom du membre", nameGuess || "Nouveau membre") || "").trim() || "Nouveau membre";

        const roles = loadRoles();
        const memberRole = roles.find(r=> String(r?.name || "").trim().toLowerCase() === "membre");
        const memberRoleId = memberRole?.id || roles[0]?.id || "";
        const id = cryptoRandom();
        members.push({
          id,
          name,
          email,
          company: (getUser()?.company || "Entreprise"),
          joinedAt: dateStr(),
          roleIds: memberRoleId ? [memberRoleId] : [],
          avatarUrl: "",
          avatarBg: avatarBgFor(name),
        });
        saveMembers(members);
        localStorage.setItem(ADMIN_ACTIVE_KEY, `member:${id}`);
        renderAdmin();
        window.fwToast?.("Membre ajouté", name);
      });
    }

    if(!canManage){
      main.innerHTML = emptyAdminHtml("🔒","Accès réservé","Cette section est disponible pour les admins.");
      return;
    }

    // Main panel
    const current = String(localStorage.getItem(ADMIN_ACTIVE_KEY) || "");
    const [type, id] = current.split(":");

    if(type === "role"){
      const role = roles.find(r=> String(r.id) === String(id));
      if(!role){
        main.innerHTML = emptyAdminHtml("🛡️","Rôle introuvable","Sélectionne un rôle à gauche.");
        return;
      }
      main.innerHTML = roleEditorHtml(role, roles, members);

      const form = $("#adminRoleForm", main);
      const nameInput = $("#roleName", main);
      const colorInput = $("#roleColor", main);
      const colorPicker = $("#roleColorPicker", main);
      const adminCb = $("#perm_admin", main);
      const manageRolesCb = $("#perm_manageRoles", main);
      const manageMembersCb = $("#perm_manageMembers", main);
      const manageChannelsCb = $("#perm_manageChannels", main);

      const syncPermUi = ()=>{
        const isAdmin = !!adminCb?.checked;
        [manageRolesCb, manageMembersCb, manageChannelsCb].forEach(cb=>{
          if(!cb) return;
          cb.disabled = isAdmin;
          if(isAdmin) cb.checked = true;
        });
      };
      adminCb?.addEventListener("change", syncPermUi);
      syncPermUi();

      const syncColor = (raw)=>{
        const c = normalizeHexColor(raw, normalizeHexColor(role.color || "#7c3aed"));
        if(colorInput) colorInput.value = c;
        if(colorPicker) colorPicker.value = c;
      };
      colorPicker?.addEventListener("input", ()=> syncColor(colorPicker.value));
      colorInput?.addEventListener("change", ()=> syncColor(colorInput.value));

      form?.addEventListener("submit", (ev)=>{
        ev.preventDefault();
        const name = (nameInput?.value || "").trim();
        if(!name){
          window.fwToast?.("Nom manquant","Entre un nom de rôle.");
          return;
        }
        const color = normalizeHexColor(colorInput?.value || "");
        const perms = {
          admin: !!adminCb?.checked,
          manageRoles: !!manageRolesCb?.checked,
          manageMembers: !!manageMembersCb?.checked,
          manageChannels: !!manageChannelsCb?.checked,
        };

        const roles = loadRoles().map(r=> String(r.id) === String(id) ? { ...r, name, color, perms } : r);
        saveRoles(roles);
        renderAdmin();
        window.fwToast?.("Enregistré","Rôle mis à jour.");
      });

      $("#deleteRole", main)?.addEventListener("click", ()=>{
        const rolesNow = loadRoles();
        if(rolesNow.length <= 1){
          window.fwToast?.("Impossible","Tu ne peux pas supprimer le dernier rôle.");
          return;
        }
        const ok = confirm(`Supprimer le rôle "${role.name}" ?`);
        if(!ok) return;

        const nextRoles = rolesNow.filter(r=> String(r.id) !== String(id));
        saveRoles(nextRoles);

        const membersNow = loadMembers().map(m=>{
          const ids = Array.isArray(m?.roleIds) ? m.roleIds.map(String) : [];
          return { ...m, roleIds: ids.filter(rid=> rid !== String(id)) };
        });
        saveMembers(membersNow);

        localStorage.removeItem(ADMIN_ACTIVE_KEY);
        renderAdmin();
        window.fwToast?.("Supprimé","Rôle supprimé.");
      });
      return;
    }

    if(type === "member"){
      const member = members.find(m=> String(m.id) === String(id));
      if(!member){
        main.innerHTML = emptyAdminHtml("👤","Membre introuvable","Sélectionne un membre à gauche.");
        return;
      }
      main.innerHTML = memberEditorHtml(member, roles);

      $("#adminMemberForm", main)?.addEventListener("submit", (ev)=>{
        ev.preventDefault();
        const name = ($("#memName", main)?.value || "").trim() || "Membre";
        const email = ($("#memEmail", main)?.value || "").trim();
        const company = ($("#memCompany", main)?.value || "").trim() || "Entreprise";
        if(!email || !email.includes("@")){
          window.fwToast?.("Email invalide","Entre un email valide.");
          return;
        }

        const selected = Array.from(main.querySelectorAll('input[name="memberRole"]:checked'))
          .map(el=> String(el.value))
          .filter(Boolean);

        const membersNow = loadMembers();
        const emailNorm = normalizeEmail(email);
        const dup = membersNow.find(m=> String(m.id) !== String(id) && normalizeEmail(m?.email) === emailNorm);
        if(dup){
          window.fwToast?.("Déjà utilisé","Cet email est déjà utilisé par un autre membre.");
          return;
        }

        const next = membersNow.map(m=>{
          if(String(m.id) !== String(id)) return m;
          return {
            ...m,
            name,
            email,
            company,
            roleIds: selected,
            avatarBg: m.avatarBg || avatarBgFor(name),
          };
        });
        saveMembers(next);

        // If you edited yourself, keep fwUser in sync for name/company
        const u = getUser() || {};
        if(normalizeEmail(u.email) && normalizeEmail(u.email) === emailNorm){
          setUser({ ...u, name, email, company });
          window.fw?.hydrateUserUI?.();
        }

        renderAdmin();
        window.fwToast?.("Enregistré","Membre mis à jour.");
      });

      $("#deleteMember", main)?.addEventListener("click", ()=>{
        const ok = confirm(`Supprimer "${member.name}" ?`);
        if(!ok) return;
        const next = loadMembers().filter(m=> String(m.id) !== String(id));
        saveMembers(next);
        localStorage.removeItem(ADMIN_ACTIVE_KEY);
        renderAdmin();
        window.fwToast?.("Supprimé","Membre supprimé.");
      });
      return;
    }

    main.innerHTML = emptyAdminHtml("🛡️","Sélectionne","Choisis un rôle ou un membre à gauche.");
  }
  async function renderAdminSupabase(){
    const rolesRoot = $("#adminRolesList");
    const membersRoot = $("#adminMembersList");
    const main = $("#adminMain");
    if(!rolesRoot || !membersRoot || !main) return;

    const uid = await sbUserId();
    if(!uid){
      window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
      return;
    }

    const company = companyFromUser();

    const rolesRes = await sb.from("roles").select("*").eq("company", company).order("name", { ascending: true });
    if(rolesRes.error){
      sbToastError("Rôles", rolesRes.error);
      main.innerHTML = emptyAdminHtml("🛡️","Erreur","Impossible de charger les rôles.");
      return;
    }
    const roles = rolesRes.data || [];

    const profRes = await sb
      .from("profiles")
      .select("id,name,email,company,avatar_url,avatar_bg,created_at")
      .eq("company", company)
      .order("name", { ascending: true });
    if(profRes.error){
      sbToastError("Membres", profRes.error);
      main.innerHTML = emptyAdminHtml("🛡️","Erreur","Impossible de charger les membres.");
      return;
    }
    const profiles = profRes.data || [];

    const mrRes = await sb.from("member_roles").select("user_id,role_id").eq("company", company);
    if(mrRes.error){
      sbToastError("Membres", mrRes.error);
      main.innerHTML = emptyAdminHtml("🛡️","Erreur","Impossible de charger les rôles des membres.");
      return;
    }

    const roleIdsByUser = new Map();
    (mrRes.data || []).forEach(r=>{
      const k = String(r.user_id);
      if(!roleIdsByUser.has(k)) roleIdsByUser.set(k, []);
      roleIdsByUser.get(k).push(String(r.role_id));
    });

    const members = profiles.map(p=>({
      id: String(p.id),
      name: p.name || "Utilisateur",
      email: p.email || "",
      company: p.company || company,
      joinedAt: (fmtTs(p.created_at).split(" •")[0] || ""),
      roleIds: roleIdsByUser.get(String(p.id)) || [],
      avatarUrl: p.avatar_url || "",
      avatarBg: p.avatar_bg || "",
    }));

    const u = getUser() || {};
    const me = members.find(m=> String(m.id) === String(uid)) || null;
    const canManage = canManageAdmin(u, me, roles);

    const createRoleBtn = $("#createRole");
    const createMemberBtn = $("#createMember");
    if(createRoleBtn) createRoleBtn.disabled = !canManage;
    if(createMemberBtn) createMemberBtn.disabled = !canManage;

    const sortedRoles = roles.slice().sort((a,b)=>{
      const an = String(a?.name || "");
      const bn = String(b?.name || "");
      const aIsAdmin = an.trim().toLowerCase() === "admin";
      const bIsAdmin = bn.trim().toLowerCase() === "admin";
      if(aIsAdmin && !bIsAdmin) return -1;
      if(bIsAdmin && !aIsAdmin) return 1;
      return an.localeCompare(bn, "fr");
    });
    const sortedMembers = members.slice().sort((a,b)=> String(a?.name || "").localeCompare(String(b?.name || ""), "fr"));

    let active = String(localStorage.getItem(ADMIN_ACTIVE_KEY) || "");
    const setDefaultActive = ()=>{
      const adminRole = sortedRoles.find(r=> String(r?.name || "").trim().toLowerCase() === "admin");
      if(adminRole?.id) return `role:${adminRole.id}`;
      if(sortedRoles[0]?.id) return `role:${sortedRoles[0].id}`;
      if(sortedMembers[0]?.id) return `member:${sortedMembers[0].id}`;
      return "";
    };
    if(!active) active = setDefaultActive();

    const [activeType, activeId] = active.split(":");
    const validRole = activeType === "role" && sortedRoles.some(r=> String(r.id) === String(activeId));
    const validMember = activeType === "member" && sortedMembers.some(m=> String(m.id) === String(activeId));
    if(!validRole && !validMember){
      active = setDefaultActive();
    }
    localStorage.setItem(ADMIN_ACTIVE_KEY, active);

    // Sidebar lists
    rolesRoot.innerHTML = "";
    sortedRoles.forEach(r=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ch-item";
      b.setAttribute("data-admin-role", String(r.id));
      if(active === `role:${r.id}`) b.classList.add("active");
      const c = normalizeHexColor(r.color || "#7c3aed");
      const count = roleMemberCount(r.id, members);
      b.innerHTML = `
        <span class="item-left truncate">
          <span class="role-dot" style="background:${escapeHtml(c)}" aria-hidden="true"></span>
          <span class="truncate">${escapeHtml(r.name || "Rôle")}</span>
        </span>
        <span class="badge">${count}</span>
      `;
      rolesRoot.appendChild(b);
    });

    membersRoot.innerHTML = "";
    sortedMembers.forEach(m=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ch-item";
      b.setAttribute("data-admin-member", String(m.id));
      if(active === `member:${m.id}`) b.classList.add("active");
      const r = primaryRole(m, roles);
      const c = normalizeHexColor(r?.color || "#7c3aed");
      b.innerHTML = `
        <span class="item-left truncate">
          ${renderNameAvatarHtml(m.name || "M", "mini-avatar")}
          <span class="truncate">${escapeHtml(m.name || "Membre")}</span>
        </span>
        <span class="role-pill"><span class="role-dot" style="background:${escapeHtml(c)}" aria-hidden="true"></span>${escapeHtml(r?.name || "—")}</span>
      `;
      membersRoot.appendChild(b);
    });

    if(!rolesRoot.__sbBound){
      rolesRoot.__sbBound = true;
      rolesRoot.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-admin-role]");
        if(!btn) return;
        localStorage.setItem(ADMIN_ACTIVE_KEY, `role:${btn.getAttribute("data-admin-role")}`);
        renderAdminSupabase();
      });
    }
    if(!membersRoot.__sbBound){
      membersRoot.__sbBound = true;
      membersRoot.addEventListener("click", (e)=>{
        const btn = e.target.closest("[data-admin-member]");
        if(!btn) return;
        localStorage.setItem(ADMIN_ACTIVE_KEY, `member:${btn.getAttribute("data-admin-member")}`);
        renderAdminSupabase();
      });
    }

    if(createRoleBtn && !createRoleBtn.__sbBound){
      createRoleBtn.__sbBound = true;
      createRoleBtn.addEventListener("click", async ()=>{
        if(createRoleBtn.disabled){
          window.fwToast?.("Accès refusé","Tu n'as pas la permission de créer un rôle.");
          return;
        }
        const name = (prompt("Nom du rôle", "Nouveau rôle") || "").trim();
        if(!name) return;
        const color = normalizeHexColor(prompt("Couleur (hex)", "#7c3aed") || "#7c3aed");
        const ins = await sb.from("roles").insert({ company, name, color, perms: {} }).select("*").single();
        if(ins.error){
          sbToastError("Rôle", ins.error);
          return;
        }
        localStorage.setItem(ADMIN_ACTIVE_KEY, `role:${ins.data?.id}`);
        await renderAdminSupabase();
        window.fwToast?.("Rôle créé", name);
      });
    }

    if(createMemberBtn && !createMemberBtn.__sbBound){
      createMemberBtn.__sbBound = true;
      createMemberBtn.addEventListener("click", ()=>{
        window.fwToast?.("Info","Les membres apparaissent ici après s'être connectés (Supabase Auth).");
      });
    }

    if(!canManage){
      main.innerHTML = emptyAdminHtml("🔒","Accès réservé","Cette section est disponible pour les admins.");
      return;
    }

    // Main panel
    const current = String(localStorage.getItem(ADMIN_ACTIVE_KEY) || "");
    const [type, id] = current.split(":");

    if(type === "role"){
      const role = roles.find(r=> String(r.id) === String(id));
      if(!role){
        main.innerHTML = emptyAdminHtml("🛡️","Rôle introuvable","Sélectionne un rôle à gauche.");
        return;
      }
      main.innerHTML = roleEditorHtml(role, roles, members);

      const form = $("#adminRoleForm", main);
      const nameInput = $("#roleName", main);
      const colorInput = $("#roleColor", main);
      const colorPicker = $("#roleColorPicker", main);
      const adminCb = $("#perm_admin", main);
      const manageRolesCb = $("#perm_manageRoles", main);
      const manageMembersCb = $("#perm_manageMembers", main);
      const manageChannelsCb = $("#perm_manageChannels", main);

      const syncPermUi = ()=>{
        const isAdmin = !!adminCb?.checked;
        [manageRolesCb, manageMembersCb, manageChannelsCb].forEach(cb=>{
          if(!cb) return;
          cb.disabled = isAdmin;
          if(isAdmin) cb.checked = true;
        });
      };
      adminCb?.addEventListener("change", syncPermUi);
      syncPermUi();

      const syncColor = (raw)=>{
        const c = normalizeHexColor(raw, normalizeHexColor(role.color || "#7c3aed"));
        if(colorInput) colorInput.value = c;
        if(colorPicker) colorPicker.value = c;
      };
      colorPicker?.addEventListener("input", ()=> syncColor(colorPicker.value));
      colorInput?.addEventListener("change", ()=> syncColor(colorInput.value));

      form?.addEventListener("submit", async (ev)=>{
        ev.preventDefault();
        const name = (nameInput?.value || "").trim();
        if(!name){
          window.fwToast?.("Nom manquant","Entre un nom de rôle.");
          return;
        }
        const color = normalizeHexColor(colorInput?.value || "");
        const perms = {
          admin: !!adminCb?.checked,
          manageRoles: !!manageRolesCb?.checked,
          manageMembers: !!manageMembersCb?.checked,
          manageChannels: !!manageChannelsCb?.checked,
        };
        const up = await sb.from("roles").update({ name, color, perms }).eq("company", company).eq("id", id);
        if(up.error){
          sbToastError("Rôle", up.error);
          return;
        }
        await renderAdminSupabase();
        window.fwToast?.("Enregistré","Rôle mis à jour.");
      });

      $("#deleteRole", main)?.addEventListener("click", async ()=>{
        if(roles.length <= 1){
          window.fwToast?.("Impossible","Tu ne peux pas supprimer le dernier rôle.");
          return;
        }
        const ok = confirm(`Supprimer le rôle "${role.name}" ?`);
        if(!ok) return;
        const del = await sb.from("roles").delete().eq("company", company).eq("id", id);
        if(del.error){
          sbToastError("Rôle", del.error);
          return;
        }
        localStorage.removeItem(ADMIN_ACTIVE_KEY);
        await renderAdminSupabase();
        window.fwToast?.("Supprimé","Rôle supprimé.");
      });
      return;
    }

    if(type === "member"){
      const member = members.find(m=> String(m.id) === String(id));
      if(!member){
        main.innerHTML = emptyAdminHtml("👤","Membre introuvable","Sélectionne un membre à gauche.");
        return;
      }
      main.innerHTML = memberEditorHtml(member, roles);

      // Read-only fields in demo
      $("#memEmail", main) && ($("#memEmail", main).disabled = true);
      $("#memCompany", main) && ($("#memCompany", main).disabled = true);

      $("#adminMemberForm", main)?.addEventListener("submit", async (ev)=>{
        ev.preventDefault();
        const name = ($("#memName", main)?.value || "").trim() || "Membre";
        const selected = Array.from(main.querySelectorAll('input[name="memberRole"]:checked'))
          .map(el=> String(el.value))
          .filter(Boolean);

        const up = await sb.from("profiles").update({ name }).eq("id", id).eq("company", company);
        if(up.error){
          sbToastError("Membre", up.error);
          return;
        }

        const del = await sb.from("member_roles").delete().eq("company", company).eq("user_id", id);
        if(del.error){
          sbToastError("Rôles", del.error);
          return;
        }
        if(selected.length){
          const ins = await sb.from("member_roles").insert(selected.map(role_id=>({ company, user_id: id, role_id })));
          if(ins.error){
            sbToastError("Rôles", ins.error);
            return;
          }
        }

        if(String(id) === String(uid)){
          await window.fwSupabase?.syncLocalUser?.();
        }

        await renderAdminSupabase();
        window.fwToast?.("Enregistré","Membre mis à jour.");
      });

      $("#deleteMember", main)?.addEventListener("click", ()=>{
        window.fwToast?.("Indisponible","Suppression d’un compte non disponible en front-only (Supabase Auth).");
      });
      return;
    }

    main.innerHTML = emptyAdminHtml("🛡️","Sélectionne","Choisis un rôle ou un membre à gauche.");
  }

  sbEnabled ? renderAdminSupabase() : renderAdmin();

  // ---------- Utilities
  function initials(name){
    const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0,2).map(s=>s[0]?.toUpperCase() || "U").join("") || "U";
  }
  function shortAt(at){
    const s = String(at || "");
    const idx = s.indexOf("•");
    return idx >= 0 ? s.slice(idx + 1).trim() : s;
  }
  function avatarBgFor(name){
    const bgs = [
      "linear-gradient(135deg, rgba(255,106,0,.95), rgba(255,45,120,.95))",
      "linear-gradient(135deg, rgba(46,231,255,.70), rgba(123,92,255,.86))",
      "linear-gradient(135deg, rgba(34,197,94,.85), rgba(14,165,233,.75))",
      "linear-gradient(135deg, rgba(250,204,21,.92), rgba(249,115,22,.85))",
      "linear-gradient(135deg, rgba(239,68,68,.86), rgba(255,45,120,.78))",
      "linear-gradient(135deg, rgba(168,85,247,.84), rgba(59,130,246,.72))",
    ];
    const s = String(name || "");
    let h = 0;
    for(let i=0; i<s.length; i++){
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return bgs[h % bgs.length];
  }
  function renderNameAvatarHtml(name, className){
    const cls = className || "mini-avatar";
    const bg = avatarBgFor(name);
    const content = escapeHtml(initials(name));
    const style = ` style="background:${escapeHtml(bg)}"`;
    const classList = cls.split(/\s+/).filter(Boolean);
    if(classList.includes("avatar") || classList.includes("msg-avatar")) return `<div class="${cls}"${style}>${content}</div>`;
    return `<span class="${cls}"${style}>${content}</span>`;
  }
  function renderUserAvatarHtml(user){
    const name = user?.name || "Utilisateur";
    const url = (user && user.avatarUrl) ? String(user.avatarUrl) : "";
    const bg = (user && user.avatarBg) ? String(user.avatarBg) : "";
    if(url) return `<div class="avatar msg-avatar"><img src="${escapeHtml(url)}" alt=""/></div>`;
    const style = bg ? ` style="background:${escapeHtml(bg)}"` : "";
    return `<div class="avatar msg-avatar"${style}>${escapeHtml(initials(name))}</div>`;
  }
  function emptyChatHtml(title, hint){
    return `
      <div class="empty">
        <div>
          <div class="big">💬</div>
          <div class="title">${escapeHtml(title || "")}</div>
          <div class="hint">${escapeHtml(hint || "")}</div>
        </div>
      </div>
    `;
  }
  function chatShellHtml({ icon, title, subtitle, placeholder }){
    return `
      <div class="chat">
        <div class="chat-header">
          <div class="chat-left">
            <div class="chat-icon" aria-hidden="true">${escapeHtml(icon || "#")}</div>
            <div class="chat-meta">
              <div class="chat-title truncate">${escapeHtml(title || "")}</div>
              <div class="chat-sub truncate">${escapeHtml(subtitle || "")}</div>
            </div>
          </div>
          <div class="chat-actions">
            <button class="btn icon ghost" type="button" title="Rechercher" data-chat-search>🔎</button>
            <button class="btn icon ghost" type="button" title="Infos" data-chat-info>ℹ️</button>
          </div>
        </div>

        <div class="chat-messages" id="chatMsgs"></div>

        <form class="chat-composer" id="chatForm" autocomplete="off">
          <button class="btn icon ghost" type="button" title="Ajouter" data-chat-add>＋</button>
          <textarea class="chat-input" id="chatInput" rows="1" placeholder="${escapeHtml(placeholder || "Écrire un message…")}"></textarea>
          <button class="btn primary send" type="submit">Envoyer</button>
        </form>
      </div>
    `;
  }
  function renderChatMessageHtml(message, user){
    const m = message || {};
    const fromRaw = String(m.from || "Utilisateur");
    const isMe = fromRaw === "Moi" || fromRaw === (user?.name || "");
    const system = !!m.system;
    const name = system ? "Système" : (isMe ? (user?.name || "Moi") : fromRaw);
    const time = shortAt(m.at || "");
    const text = String(m.text || "");

    const avatar = system
      ? `<div class="avatar msg-avatar" style="background: rgba(255,255,255,.10)">FW</div>`
      : (isMe ? renderUserAvatarHtml(user) : renderNameAvatarHtml(name, "avatar msg-avatar"));

    return `
      <div class="msg${system ? " system" : ""}">
        ${avatar}
        <div class="msg-body">
          <div class="msg-head">
            <span class="msg-name">${escapeHtml(name)}</span>
            <span class="msg-time">${escapeHtml(time)}</span>
          </div>
          <div class="msg-text">${escapeHtml(text)}</div>
        </div>
      </div>
    `;
  }
  function safeUrl(raw){
    const s = String(raw || "").trim();
    if(!s) return "";
    try{
      const u = new URL(s, window.location.href);
      if(u.protocol === "http:" || u.protocol === "https:" || u.protocol === "file:") return u.href;
      return "";
    }catch(e){
      return "";
    }
  }
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (m)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }
})();

/* FaceWork static — tutorial page helpers */
(function(){
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => Array.from(root.querySelectorAll(q));

  // ---------- Filter
  const search = $("#tutSearch");
  const details = $$("details[data-tut-title]");
  const counter = $("#tutCount");

  function applyFilter(){
    const q = String(search?.value || "").trim().toLowerCase();
    let shown = 0;
    details.forEach(d => {
      const hay = (d.getAttribute("data-tut-title") || "") + " " + (d.textContent || "");
      const match = !q || hay.toLowerCase().includes(q);
      d.style.display = match ? "" : "none";
      if(match) shown++;
    });
    if(counter){
      counter.textContent = q ? `${shown}/${details.length} résultat(s)` : `${details.length} chapitre(s)`;
    }
  }
  search?.addEventListener("input", applyFilter);
  applyFilter();

  // ---------- Expand / collapse all
  $("#tutExpandAll")?.addEventListener("click", () => {
    details.forEach(d => d.open = true);
  });
  $("#tutCollapseAll")?.addEventListener("click", () => {
    details.forEach(d => d.open = false);
  });

  // ---------- Copy code blocks
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if(!btn) return;

    const sel = btn.getAttribute("data-copy");
    const target = sel ? document.querySelector(sel) : null;
    if(!target) return;

    const text = (target.innerText || target.textContent || "").replace(/\s+$/,"");
    const old = btn.textContent;
    try{
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copié ✓";
      window.fwToast?.("Copié", "Texte copié dans le presse‑papiers.");
    }catch(err){
      btn.textContent = "Erreur";
      window.fwToast?.("Erreur", "Copie impossible (permissions navigateur).");
    }finally{
      setTimeout(() => btn.textContent = old, 900);
    }
  });

  // ---------- Checklist progress
  const PROG_KEY = "fwTutorialProgress_v1";
  const checks = $$("[data-tut-check]");

  function loadProgress(){
    let state = {};
    try{
      state = JSON.parse(localStorage.getItem(PROG_KEY) || "{}") || {};
    }catch(e){
      state = {};
    }
    checks.forEach(ch => {
      const id = ch.getAttribute("data-tut-check");
      ch.checked = !!(id && state[id]);
    });
  }

  function saveProgress(){
    const state = {};
    checks.forEach(ch => {
      const id = ch.getAttribute("data-tut-check");
      if(id) state[id] = !!ch.checked;
    });
    try{ localStorage.setItem(PROG_KEY, JSON.stringify(state)); }catch(e){ /* ignore */ }
  }

  checks.forEach(ch => ch.addEventListener("change", saveProgress));
  loadProgress();

  // ---------- Posts tutoriel (admin CRUD + drag&drop)
  const sb = (window.fwSupabase?.enabled && window.fwSupabase?.client) ? window.fwSupabase.client : null;
  const sbEnabled = !!sb;
  const POSTS_TABLE = "tutorial_posts";
  const STORAGE_BUCKET = String(window.FW_ENV?.SUPABASE_BUCKET || "facework").trim() || "facework";

  const postsStatus = $("#tutPostsStatus");
  const postsList = $("#tutPostsList");
  const postsEmpty = $("#tutPostsEmpty");
  const adminBox = $("#tutAdminBox");
  const form = $("#tutPostForm");

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normCompany(company){
    return String(company || "")
      .trim()
      .replace(/[\\\/]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 60) || "Entreprise";
  }

  function getCompany(){
    const u = window.fw?.getUser?.() || {};
    return normCompany(u.company || window.fwSupabase?.companyDefault || "Entreprise");
  }

  function isAdmin(){
    const u = window.fw?.getUser?.() || {};
    return String(u.role || "").trim().toLowerCase() === "admin";
  }

  function fmtTs(ts){
    const d = new Date(ts);
    if(Number.isNaN(d.getTime())) return String(ts || "");
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  function fileTitleFromName(fileName){
    const n = String(fileName || "").trim();
    if(!n) return "Nouveau post";
    return n.replace(/\.[a-z0-9]{1,8}$/i, "").replace(/[_-]+/g, " ").trim() || "Nouveau post";
  }

  function parseSbStorageUrl(raw){
    const s = String(raw || "").trim();
    const m = s.match(/^sb:\/\/([^\/]+)\/(.+)$/i);
    if(!m) return null;
    return { bucket: m[1], path: m[2] };
  }

  function safeUrl(raw){
    const s = String(raw || "").trim();
    if(!s) return "";
    if(s.startsWith("sb://")) return s;
    if(s.startsWith("data:")) return s;
    if(s.startsWith("/") || s.startsWith("./") || s.startsWith("../")) return s;
    if(/^https?:\/\//i.test(s)) return s;
    return "";
  }

  async function openFileFromPost({ fileUrl, fileName } = {}){
    const sbUrl = parseSbStorageUrl(fileUrl);
    if(sbUrl && sb){
      window.fwToast?.("Téléchargement","Récupération du fichier…");
      const res = await sb.storage.from(sbUrl.bucket).download(sbUrl.path);
      if(res.error){
        console.error("Storage download", res.error);
        window.fwToast?.("Fichier", res.error.message || "Téléchargement impossible.");
        return;
      }
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.target = "_blank";
      a.rel = "noopener";
      if(fileName) a.download = fileName;
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
    window.open(href, "_blank", "noopener");
  }

  function toCodeFence(txt){
    const t = String(txt || "").replace(/\r\n/g,"\n").replace(/\s+$/,"");
    if(!t) return "";
    if(t.includes("```")) return `\n\`\`\`\n${t}\n\`\`\`\n`;
    return `\n\`\`\`js\n${t}\n\`\`\`\n`;
  }

  function renderBodyHtml(body, idPrefix){
    const s = String(body || "").replace(/\r\n/g,"\n");
    if(!s.trim()) return "";

    const out = [];
    let i = 0;
    let codeIndex = 0;

    while(i < s.length){
      const start = s.indexOf("```", i);
      if(start === -1){
        out.push({ type:"text", value: s.slice(i) });
        break;
      }
      const end = s.indexOf("```", start + 3);
      if(end === -1){
        out.push({ type:"text", value: s.slice(i) });
        break;
      }
      out.push({ type:"text", value: s.slice(i, start) });
      const inside = s.slice(start + 3, end);
      let lang = "";
      let code = inside;
      const m = inside.match(/^([a-zA-Z0-9_-]+)\n([\s\S]*)$/);
      if(m){
        lang = m[1];
        code = m[2];
      }
      out.push({ type:"code", lang, value: String(code || "").replace(/\n+$/,"") });
      i = end + 3;
      codeIndex++;
    }

    const html = [];
    let fenceNo = 0;

    out.forEach(part => {
      if(part.type === "code"){
        const preId = `${idPrefix}-code-${fenceNo++}`;
        html.push(`
          <div class="codeblock">
            <div class="codebar">
              ${part.lang ? `Code (${escapeHtml(part.lang)})` : "Code"}
              <button class="btn small" type="button" data-copy="#${escapeHtml(preId)}">Copier</button>
            </div>
            <pre id="${escapeHtml(preId)}">${escapeHtml(part.value || "")}</pre>
          </div>
        `);
        return;
      }

      const text = String(part.value || "");
      const chunks = text
        .split(/\n{2,}/g)
        .map(x=>x.trim())
        .filter(Boolean);
      chunks.forEach(ch => {
        html.push(`<p>${escapeHtml(ch).replace(/\n/g,"<br>")}</p>`);
      });
    });

    return html.join("");
  }

  // ---- local fallback (demo)
  const LS_KEY = "fwTutorialPosts_v1";
  function loadLocalPosts(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || "[]") || []; }catch(e){ return []; }
  }
  function saveLocalPosts(items){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(items || [])); }catch(e){ /* ignore */ }
  }

  function setAdminVisibility(){
    if(!adminBox) return;
    adminBox.classList.toggle("hidden", !isAdmin());
  }

  function composerIsEmpty(){
    const title = $("#tutTitle")?.value?.trim() || "";
    const body = $("#tutBody")?.value?.trim() || "";
    const fileUrl = $("#tutFileUrl")?.value?.trim() || "";
    const fileName = $("#tutFileName")?.value?.trim() || "";
    const file = form?.__selectedFile || null;
    return !(title || body || fileUrl || fileName || file);
  }

  function resetComposer(){
    if(!form) return;
    form.__editingId = "";
    form.__editingOldFileUrl = "";
    form.__editingOldFileName = "";
    form.__editingRemoveFile = false;
    form.__selectedFile = null;

    $("#tutTitle") && ($("#tutTitle").value = "");
    $("#tutBody") && ($("#tutBody").value = "");
    $("#tutFileUrl") && ($("#tutFileUrl").value = "");
    $("#tutFileName") && ($("#tutFileName").value = "");

    const input = $("#tutFile");
    try{ if(input) input.value = ""; }catch(e){ /* ignore */ }

    $("#tutFileInfo") && ($("#tutFileInfo").textContent = "Aucun fichier sélectionné");
    $("#tutEditBar")?.classList.add("hidden");
  }

  function enterEditMode(p){
    if(!form || !p) return;
    form.__editingId = String(p.id || "");
    form.__editingOldFileUrl = String(p.file_url || "");
    form.__editingOldFileName = String(p.file_name || "");
    form.__editingRemoveFile = false;
    form.__selectedFile = null;

    $("#tutTitle") && ($("#tutTitle").value = String(p.title || ""));
    $("#tutBody") && ($("#tutBody").value = String(p.body || ""));
    $("#tutFileUrl") && ($("#tutFileUrl").value = String(p.file_url || ""));
    $("#tutFileName") && ($("#tutFileName").value = String(p.file_name || ""));
    $("#tutFileInfo") && ($("#tutFileInfo").textContent = (p.file_name || p.file_url) ? String(p.file_name || "Fichier lié") : "Aucun fichier sélectionné");

    $("#tutEditBar")?.classList.remove("hidden");
    window.fwToast?.("Mode édition","Modifie le post puis clique Publier.");
    window.location.hash = "#tut-posts";
  }

  function bindFileUI(){
    if(!form || form.__fileUiBound) return;

    const drop = $("#tutDrop");
    const input = $("#tutFile");
    const info = $("#tutFileInfo");
    const clear = $("#tutFileClear");

    function setSelectedFile(file){
      form.__selectedFile = file || null;
      form.__editingRemoveFile = false;
      if(info){
        info.textContent = file ? `${file.name} • ${fmtBytes(file.size)}` : "Aucun fichier sélectionné";
      }
      const fileNameEl = $("#tutFileName");
      if(file && fileNameEl && !String(fileNameEl.value || "").trim()){
        fileNameEl.value = file.name;
      }
      const fileUrlEl = $("#tutFileUrl");
      if(file && fileUrlEl){
        fileUrlEl.value = "";
      }
    }

    setSelectedFile(null);

    input?.addEventListener("change", ()=>{
      setSelectedFile(input.files?.[0] || null);
    });

    clear?.addEventListener("click", (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      try{ if(input) input.value = ""; }catch(e){ /* ignore */ }
      setSelectedFile(null);

      if(form.__editingId){
        form.__editingRemoveFile = true;
        $("#tutFileUrl") && ($("#tutFileUrl").value = "");
        $("#tutFileName") && ($("#tutFileName").value = "");
      }
    });

    function prevent(e){ e.preventDefault(); e.stopPropagation(); }
    drop?.addEventListener("click", ()=> input?.click());
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
      const emptyBefore = composerIsEmpty();
      const file = e.dataTransfer?.files?.[0] || null;
      const txt = String(e.dataTransfer?.getData?.("text/plain") || "");

      if(file){
        setSelectedFile(file);
        const t = $("#tutTitle");
        if(t && !t.value.trim() && !form.__editingId){
          t.value = fileTitleFromName(file.name);
        }
        if(isAdmin() && !form.__editingId && emptyBefore){
          if(typeof form.requestSubmit === "function") form.requestSubmit();
          else form.querySelector('button[type="submit"]')?.click();
        }
        return;
      }

      if(txt.trim()){
        const b = $("#tutBody");
        const fenced = toCodeFence(txt);
        if(b){
          b.value = b.value.trim()
            ? `${b.value.replace(/\s+$/,"")}\n\n${fenced.trim()}`
            : fenced.trim();
          b.dispatchEvent(new Event("input", { bubbles:true }));
        }
        const t = $("#tutTitle");
        if(t && !t.value.trim() && !form.__editingId){
          t.value = "Snippet";
        }
        if(isAdmin() && !form.__editingId && emptyBefore){
          if(typeof form.requestSubmit === "function") form.requestSubmit();
          else form.querySelector('button[type="submit"]')?.click();
        }
      }
    });

    $("#tutEditCancel")?.addEventListener("click", (ev)=>{
      ev.preventDefault();
      resetComposer();
      window.fwToast?.("Annulé","Mode édition désactivé.");
    });

    form.__fileUiBound = true;
  }

  function renderPostItemHtml(p){
    const id = String(p.id || "");
    const title = String(p.title || "Sans titre");
    const body = String(p.body || "");
    const createdAt = fmtTs(p.created_at || p.createdAt || "");
    const fileUrl = String(p.file_url || p.fileUrl || "");
    const fileName = String(p.file_name || p.fileName || "");

    const actions = isAdmin()
      ? `
        <div class="row" style="gap:8px; align-items:center">
          <button class="btn icon ghost" type="button" title="Éditer" data-tut-edit="${escapeHtml(id)}">✏️</button>
          <button class="btn icon ghost" type="button" title="Supprimer" data-tut-del="${escapeHtml(id)}">🗑️</button>
        </div>
      `
      : `<span></span>`;

    return `
      <div class="post" data-tut-post="${escapeHtml(id)}">
        <div class="top">
          <div class="who">
            <div class="avatar" aria-hidden="true">📘</div>
            <div class="meta">
              <div class="name">${escapeHtml(title)}</div>
              <div class="time">${escapeHtml(createdAt)}${(fileName || fileUrl) ? " • 📄 Fichier" : ""}</div>
            </div>
          </div>
          ${actions}
        </div>

        ${(fileName || fileUrl) ? `
          <button class="file-box" type="button" data-tut-open="${escapeHtml(id)}" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}">
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

        ${renderBodyHtml(body, `tutp-${id}`)}
      </div>
    `;
  }

  function setStatus(text){
    if(postsStatus) postsStatus.textContent = text || "—";
  }

  async function fetchPostsSupabase(){
    const company = getCompany();
    const { data, error } = await sb
      .from(POSTS_TABLE)
      .select("*")
      .eq("company", company)
      .order("created_at", { ascending: false });
    if(error){
      return { data:null, error };
    }
    return { data: data || [], error:null };
  }

  async function renderPosts(){
    if(!postsList) return;

    setAdminVisibility();
    bindFileUI();

    if(sbEnabled){
      setStatus("Supabase • Chargement…");
      const session = (await sb.auth.getSession())?.data?.session || null;
      if(!session?.user){
        setStatus("Supabase • Non connecté");
        postsList.innerHTML = "";
        postsEmpty && postsEmpty.classList.remove("hidden");
        postsEmpty && (postsEmpty.innerHTML = "<strong>Connexion requise.</strong> Va sur <a href=\"login.html\">login.html</a> puis reviens.");
        return;
      }

      const res = await fetchPostsSupabase();
      if(res.error){
        const code = String(res.error.code || "");
        const msg = String(res.error.message || "Erreur Supabase");
        console.error("tutorial_posts", res.error);
        setStatus("Supabase • Erreur");

        // Table missing (schema not applied / old schema)
        if(code === "42P01" || msg.toLowerCase().includes("does not exist")){
          postsList.innerHTML = "";
          postsEmpty && postsEmpty.classList.remove("hidden");
          postsEmpty && (postsEmpty.innerHTML = "<strong>Table manquante.</strong> Applique la mise à jour SQL (<code>supabase/schema.sql</code>) puis recharge.");
          return;
        }

        window.fwToast?.("Supabase", msg);
        postsList.innerHTML = "";
        postsEmpty && postsEmpty.classList.remove("hidden");
        postsEmpty && (postsEmpty.innerHTML = "<strong>Erreur.</strong> Ouvre la console (F12) pour voir le détail.");
        return;
      }

      const items = res.data || [];
      setStatus(`Supabase • ${items.length} post(s)`);
      postsList.innerHTML = items.map(renderPostItemHtml).join("");
      postsEmpty && postsEmpty.classList.toggle("hidden", items.length > 0);
      return;
    }

    // LocalStorage mode
    const items = loadLocalPosts();
    setStatus(`Démo locale • ${items.length} post(s)`);
    postsList.innerHTML = items.slice().reverse().map(renderPostItemHtml).join("");
    postsEmpty && postsEmpty.classList.toggle("hidden", items.length > 0);
  }

  async function submitPost(ev){
    ev?.preventDefault?.();
    if(!form) return;
    if(!isAdmin()){
      window.fwToast?.("Admin", "Seuls les admins peuvent publier/modifier.");
      return;
    }

    const title = $("#tutTitle")?.value?.trim() || "";
    const body = $("#tutBody")?.value?.trim() || "";
    let fileUrl = $("#tutFileUrl")?.value?.trim() || "";
    let fileName = $("#tutFileName")?.value?.trim() || "";
    const selectedFile = form.__selectedFile || null;

    if(!title && !body && !fileUrl && !selectedFile){
      window.fwToast?.("Vide", "Ajoute un titre, du texte, un lien ou un fichier.");
      return;
    }

    const company = getCompany();
    const editingId = String(form.__editingId || "");
    const postId = editingId || uuid();
    const removeFile = !!form.__editingRemoveFile;
    const oldFileUrl = String(form.__editingOldFileUrl || "");
    let uploadedPath = "";

    // --- Supabase
    if(sbEnabled){
      const session = (await sb.auth.getSession())?.data?.session || null;
      const uid = session?.user?.id || "";
      if(!uid){
        window.fwToast?.("Connexion", "Reconnecte-toi sur login.html puis reviens.");
        return;
      }

      if(selectedFile){
        const safeName = safeFileName(selectedFile.name);
        uploadedPath = `${company}/tutorial/${postId}/${safeName}`;
        window.fwToast?.("Upload", "Envoi du fichier…");
        const up = await sb.storage.from(STORAGE_BUCKET).upload(uploadedPath, selectedFile, {
          upsert: false,
          contentType: selectedFile.type || undefined,
          cacheControl: "3600",
        });
        if(up.error){
          console.error("Upload", up.error);
          window.fwToast?.("Upload", up.error.message || "Upload impossible. Vérifie le bucket + les policies Storage.");
          return;
        }
        fileUrl = `sb://${STORAGE_BUCKET}/${uploadedPath}`;
        fileName = fileName || selectedFile.name || safeName;
      }else if(removeFile){
        fileUrl = "";
        fileName = "";
      }

      if(editingId){
        window.fwToast?.("Mise à jour","Enregistrement…");
        const res = await sb
          .from(POSTS_TABLE)
          .update({
            title: title || "Sans titre",
            body: body || "",
            file_url: fileUrl || "",
            file_name: fileName || "",
          })
          .eq("company", company)
          .eq("id", postId);

        if(res.error){
          if(uploadedPath){
            try{ await sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]); }catch(e){ /* ignore */ }
          }
          console.error("Update tutorial_posts", res.error);
          window.fwToast?.("Supabase", res.error.message || "Update impossible.");
          return;
        }

        // Cleanup old storage file if changed/removed
        const prev = parseSbStorageUrl(oldFileUrl);
        const next = parseSbStorageUrl(fileUrl);
        if(prev && (!next || prev.bucket !== next.bucket || prev.path !== next.path)){
          try{ await sb.storage.from(prev.bucket).remove([prev.path]); }catch(e){ /* ignore */ }
        }

        resetComposer();
        await renderPosts();
        window.fwToast?.("OK","Post mis à jour.");
        return;
      }

      window.fwToast?.("Publication","Enregistrement…");
      const res = await sb.from(POSTS_TABLE).insert({
        id: postId,
        company,
        author_id: uid,
        title: title || "Sans titre",
        body: body || "",
        file_url: fileUrl || "",
        file_name: fileName || "",
      });

      if(res.error){
        if(uploadedPath){
          try{ await sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]); }catch(e){ /* ignore */ }
        }
        console.error("Insert tutorial_posts", res.error);
        window.fwToast?.("Supabase", res.error.message || "Insert impossible.");
        return;
      }

      resetComposer();
      await renderPosts();
      window.fwToast?.("Publié","Post ajouté.");
      return;
    }

    // --- localStorage
    const items = loadLocalPosts();
    const nowIso = new Date().toISOString();
    if(editingId){
      const idx = items.findIndex(x=>String(x.id)===postId);
      if(idx >= 0){
        items[idx] = {
          ...items[idx],
          title: title || "Sans titre",
          body: body || "",
          file_url: removeFile ? "" : (fileUrl || items[idx].file_url || ""),
          file_name: removeFile ? "" : (fileName || items[idx].file_name || ""),
        };
        saveLocalPosts(items);
      }
      resetComposer();
      await renderPosts();
      window.fwToast?.("OK","Post mis à jour (local).");
      return;
    }

    items.push({
      id: postId,
      company,
      author_id: "local",
      title: title || "Sans titre",
      body: body || "",
      file_url: fileUrl || "",
      file_name: fileName || "",
      created_at: nowIso,
    });
    saveLocalPosts(items);
    resetComposer();
    await renderPosts();
    window.fwToast?.("Publié","Post ajouté (local).");
  }

  async function onPostsClick(e){
    const openBtn = e.target.closest("[data-tut-open]");
    if(openBtn){
      const fileUrl = openBtn.getAttribute("data-file-url") || "";
      const fileName = openBtn.getAttribute("data-file-name") || "";
      await openFileFromPost({ fileUrl, fileName });
      return;
    }

    const editBtn = e.target.closest("[data-tut-edit]");
    if(editBtn){
      if(!isAdmin()){
        window.fwToast?.("Admin","Accès réservé.");
        return;
      }
      const id = editBtn.getAttribute("data-tut-edit") || "";
      if(!id) return;
      if(sbEnabled){
        const company = getCompany();
        const { data, error } = await sb
          .from(POSTS_TABLE)
          .select("*")
          .eq("company", company)
          .eq("id", id)
          .maybeSingle();
        if(error || !data){
          window.fwToast?.("Supabase", error?.message || "Post introuvable.");
          return;
        }
        enterEditMode(data);
        return;
      }
      const items = loadLocalPosts();
      const p = items.find(x=>String(x.id)===String(id));
      if(p) enterEditMode(p);
      return;
    }

    const delBtn = e.target.closest("[data-tut-del]");
    if(delBtn){
      if(!isAdmin()){
        window.fwToast?.("Admin","Accès réservé.");
        return;
      }
      const id = delBtn.getAttribute("data-tut-del") || "";
      if(!id) return;
      const ok = confirm("Supprimer ce post ?");
      if(!ok) return;

      if(sbEnabled){
        const company = getCompany();
        // Fetch to remove storage file too
        const { data, error } = await sb
          .from(POSTS_TABLE)
          .select("id,file_url")
          .eq("company", company)
          .eq("id", id)
          .maybeSingle();
        if(error){
          window.fwToast?.("Supabase", error.message || "Suppression impossible.");
          return;
        }
        const fileUrl = String(data?.file_url || "");

        const res = await sb
          .from(POSTS_TABLE)
          .delete()
          .eq("company", company)
          .eq("id", id);
        if(res.error){
          window.fwToast?.("Supabase", res.error.message || "Suppression impossible.");
          return;
        }

        const sbUrl = parseSbStorageUrl(fileUrl);
        if(sbUrl){
          try{ await sb.storage.from(sbUrl.bucket).remove([sbUrl.path]); }catch(e2){ /* ignore */ }
        }

        resetComposer();
        await renderPosts();
        window.fwToast?.("OK","Post supprimé.");
        return;
      }

      const items = loadLocalPosts().filter(x=>String(x.id)!==String(id));
      saveLocalPosts(items);
      resetComposer();
      await renderPosts();
      window.fwToast?.("OK","Post supprimé (local).");
    }
  }

  if(form && !form.__bound){
    form.__bound = true;
    form.addEventListener("submit", submitPost);
  }

  if(postsList && !postsList.__bound){
    postsList.__bound = true;
    postsList.addEventListener("click", onPostsClick);
  }

  if(postsList){
    setAdminVisibility();
    bindFileUI();
    renderPosts();
  }
})();


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

  async function openDataUrl(dataUrl){
    const s = String(dataUrl || "").trim();
    if(!s || !s.startsWith("data:")) return false;
    try{
      const r = await fetch(s);
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
      return true;
    }catch(e){
      return false;
    }
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
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function bindComposerFileUI(){
    const form = $("#newPostForm");
    if(!form || form.__fileUiBound) return;
    bindComposerModalUI();

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
      form.__editingRemoveFile = false;
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
      // In edit mode: "Retirer" means remove the existing attachment too.
      if(form.__editingId){
        form.__editingRemoveFile = true;
        form.__editingOldFileUrl = "";
        form.__editingOldFileName = "";
        form.__editingOldFileData = null;
        $("#postFileUrl") && ($("#postFileUrl").value = "");
        $("#postFileName") && ($("#postFileName").value = "");
        $("#postFolder") && ($("#postFolder").value = "");
        info && (info.textContent = "Aucun fichier sélectionné");
      }
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
      const isEmptyBeforeDrop = composerIsEmpty();
      const file = e.dataTransfer?.files?.[0] || null;
      const txt = String(e.dataTransfer?.getData?.("text/plain") || "");

      if(file){
        setSelectedFile(file);
        if(isAdmin() && !form.__editingId && isEmptyBeforeDrop){
          const t = $("#postTitle");
          if(t && !t.value.trim()) t.value = fileTitleFromName(file.name);
          if(typeof form.requestSubmit === "function") form.requestSubmit();
          else form.querySelector('button[type="submit"]')?.click();
        }
        return;
      }

      if(txt.trim()){
        const b = $("#postBody");
        const fenced = toCodeFence(txt);
        if(b){
          b.value = b.value.trim()
            ? `${b.value.replace(/\s+$/,"")}\n\n${fenced}`
            : fenced;
          b.dispatchEvent(new Event("input", { bubbles:true }));
        }
        const t = $("#postTitle");
        if(t && !t.value.trim() && !form.__editingId){
          t.value = "Snippet";
        }
        if(isAdmin() && !form.__editingId && isEmptyBeforeDrop){
          if(typeof form.requestSubmit === "function") form.requestSubmit();
          else form.querySelector('button[type="submit"]')?.click();
        }
      }
    });

    // Cancel edit mode (if the edit UI exists on this page)
    const cancel = $("#postEditCancel");
    if(cancel && !cancel.__bound){
      cancel.__bound = true;
      cancel.addEventListener("click", (ev)=>{
        ev.preventDefault();
        exitPostEditMode();
        closeComposerModal({ reset:true });
      });
    }

    // Delete confirm UI (optional in modal)
    const delBtn = $("#postDeleteBtn");
    if(delBtn && !delBtn.__bound){
      delBtn.__bound = true;
      delBtn.addEventListener("click", (ev)=>{
        ev.preventDefault();
        showPostDeleteConfirm();
      });
    }
    const delCancel = $("#postDeleteCancel");
    if(delCancel && !delCancel.__bound){
      delCancel.__bound = true;
      delCancel.addEventListener("click", (ev)=>{
        ev.preventDefault();
        hidePostDeleteConfirm();
      });
    }
    const delConfirm = $("#postDeleteConfirm");
    if(delConfirm && !delConfirm.__bound){
      delConfirm.__bound = true;
      delConfirm.addEventListener("click", async (ev)=>{
        ev.preventDefault();
        const id = String(form.__editingId || "").trim();
        if(!id) return;
        await deletePostById(id);
      });
    }

    form.__fileUiBound = true;
  }

  function bindChatFileUI(container){
    const root = container || document;
    const form = $("#chatForm", root);
    if(!form || form.__fileUiBound) return;

    const input = $("#chatInput", root);
    const fileInput = $("#chatFile", root);
    const addBtn = $("[data-chat-add]", root);
    const emojiBtn = $("[data-chat-emoji]", root);
    const gifBtn = $("[data-chat-gif]", root);
    const attach = $("#chatAttach", root);
    const attachBadge = $("#chatAttachBadge", root);
    const label = $("#chatAttachLabel", root);
    const clearBtn = $("[data-chat-attach-clear]", root);
    const msgs = $("#chatMsgs", root);

    const emojiPop = $("#chatEmojiPop", root);
    const gifPop = $("#chatGifPop", root);
    const gifUrlInput = $("[data-chat-gif-url]", root);
    const gifAddBtn = $("[data-chat-gif-add]", root);
    const gifSearchInput = $("[data-chat-gif-search]", root);
    const gifGrid = $("[data-chat-gif-grid]", root);
    const gifStatus = $("[data-chat-gif-status]", root);
    const gifMoreBtn = $("[data-chat-gif-more]", root);
    const popCloseBtns = $$("[data-chat-pop-close]", root);

    const GIF_ENDPOINT = "/.netlify/functions/gifs";
    let gifReqId = 0;
    let gifNextPos = "";
    let gifLastQuery = "";
    let gifDebounce = null;

    function closePops(){
      emojiPop && emojiPop.classList.add("hidden");
      gifPop && gifPop.classList.add("hidden");
    }
    function togglePop(which){
      const wantEmoji = which === "emoji";
      const wantGif = which === "gif";
      if(wantEmoji && emojiPop){
        const opening = emojiPop.classList.contains("hidden");
        closePops();
        emojiPop.classList.toggle("hidden", !opening);
        return;
      }
      if(wantGif && gifPop){
        const opening = gifPop.classList.contains("hidden");
        closePops();
        gifPop.classList.toggle("hidden", !opening);
        if(opening){
          setTimeout(()=> (gifSearchInput || gifUrlInput)?.focus?.(), 0);
          if(gifGrid && gifGrid.children.length === 0){
            loadGifLibrary({ query: String(gifSearchInput?.value || "").trim() });
          }
        }
      }
    }

    function insertAtCursor(el, text){
      if(!el) return;
      const t = String(text || "");
      if(!t) return;
      const start = Number(el.selectionStart || 0);
      const end = Number(el.selectionEnd || 0);
      const before = String(el.value || "").slice(0, start);
      const after = String(el.value || "").slice(end);
      el.value = before + t + after;
      const pos = start + t.length;
      try{ el.setSelectionRange(pos, pos); }catch(e){ /* ignore */ }
      el.dispatchEvent(new Event("input", { bubbles:true }));
      el.focus();
    }

    function setAttachBar({ kind, text } = {}){
      const k = String(kind || "file");
      const t = String(text || "");
      attach && attach.classList.toggle("hidden", !t);
      if(attachBadge){
        attachBadge.textContent = k === "gif" ? "🎞️ GIF" : (k === "image" ? "🖼️ Image" : "📎 Fichier");
      }
      label && (label.textContent = t || "Aucun fichier");
    }

    function clearAttachment(){
      try{ if(fileInput) fileInput.value = ""; }catch(e){ /* ignore */ }
      form.__selectedFile = null;
      form.__selectedUrl = null;
      setAttachBar({ kind: "file", text: "" });
      closePops();
    }

    function setFile(file){
      const f = file || null;
      form.__selectedFile = f;
      form.__selectedUrl = null;
      if(!f && fileInput) fileInput.value = "";
      if(!f){
        setAttachBar({ kind: "file", text: "" });
        return;
      }
      setAttachBar({ kind: "file", text: `${f.name} • ${fmtBytes(f.size)}` });
    }

    function setUrl(url){
      const u = safeUrl(url);
      if(!u){
        clearAttachment();
        return;
      }
      try{ if(fileInput) fileInput.value = ""; }catch(e){ /* ignore */ }
      form.__selectedFile = null;

      const ext = fileExt(u);
      const isImg = ["png","jpg","jpeg","gif","webp","svg","bmp","avif"].includes(ext);
      const kind = (ext === "gif") ? "gif" : (isImg ? "image" : "file");

      if(!isImg){
        window.fwToast?.("GIF", "Lien invalide. Colle un lien direct vers une image (ex: .gif).");
        return;
      }

      form.__selectedUrl = {
        url: u,
        name: (ext ? `gif.${ext}` : "gif.gif"),
      };
      setAttachBar({ kind, text: `${form.__selectedUrl.name}` });
    }

    clearAttachment();

    addBtn && addBtn.addEventListener("click", ()=> fileInput?.click());
    fileInput && fileInput.addEventListener("change", ()=> setFile(fileInput.files?.[0] || null));
    clearBtn && clearBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      clearAttachment();
    });

    emojiBtn && emojiBtn.addEventListener("click", ()=> togglePop("emoji"));
    gifBtn && gifBtn.addEventListener("click", ()=> togglePop("gif"));
    popCloseBtns.forEach(btn=> btn.addEventListener("click", closePops));

    emojiPop && emojiPop.addEventListener("click", (e)=>{
      const b = e.target.closest("[data-emoji]");
      if(!b) return;
      const emoji = b.getAttribute("data-emoji") || "";
      insertAtCursor(input, emoji);
      closePops();
    });

    function setGifStatusText(text){
      if(!gifStatus) return;
      const t = String(text || "").trim();
      gifStatus.textContent = t || "—";
      gifStatus.classList.toggle("hidden", !t);
    }

    function setGifMoreVisible(show){
      gifMoreBtn && gifMoreBtn.classList.toggle("hidden", !show);
    }

    function gifItemHtml(g){
      const url = escapeHtml(String(g?.url || ""));
      const preview = escapeHtml(String(g?.preview || g?.url || ""));
      const title = escapeHtml(String(g?.title || "GIF"));
      if(!url) return "";
      return `<button class="gif-btn" type="button" data-gif-url="${url}" title="${title}" aria-label="${title}">
        <img class="gif-thumb" alt="" loading="lazy" src="${preview || url}"/>
      </button>`;
    }

    async function loadGifLibrary({ query, append } = {}){
      if(!gifGrid) return;
      const q = String(query ?? gifLastQuery ?? "").trim();
      const isAppend = !!append;
      if(isAppend && !gifNextPos) return;

      if(!isAppend){
        gifLastQuery = q;
        gifNextPos = "";
        gifGrid.innerHTML = "";
        setGifMoreVisible(false);
      }

      const reqId = ++gifReqId;
      setGifStatusText("Chargement…");

      const params = new URLSearchParams();
      if(q) params.set("q", q);
      params.set("limit", "24");
      if(isAppend && gifNextPos) params.set("pos", gifNextPos);

      let res, data;
      try{
        res = await fetch(`${GIF_ENDPOINT}?${params.toString()}`, { method: "GET" });
        data = await res.json();
      }catch(e){
        if(reqId !== gifReqId) return;
        setGifStatusText("Bibliothèque GIF indisponible. (Colle un lien direct.)");
        setGifMoreVisible(false);
        return;
      }

      if(reqId !== gifReqId) return;

      if(!res.ok){
        const msg = String(data?.error || "").trim();
        setGifStatusText(msg ? `GIF: ${msg}` : "Erreur GIF.");
        setGifMoreVisible(false);
        return;
      }

      const arr = Array.isArray(data?.gifs) ? data.gifs : [];
      const html = arr.map(gifItemHtml).filter(Boolean).join("");
      if(isAppend){
        if(html) gifGrid.insertAdjacentHTML("beforeend", html);
      }else{
        gifGrid.innerHTML = html;
      }

      gifNextPos = String(data?.next || "").trim();
      setGifMoreVisible(!!gifNextPos);

      if(!arr.length && !isAppend){
        setGifStatusText(q ? "Aucun résultat." : "Aucun GIF trouvé.");
      }else{
        setGifStatusText("");
      }
    }

    gifGrid && gifGrid.addEventListener("click", (e)=>{
      const b = e.target.closest("[data-gif-url]");
      if(!b) return;
      const u = b.getAttribute("data-gif-url") || "";
      if(!u) return;
      setUrl(u);
      closePops();
      input?.focus?.();
    });

    gifSearchInput && gifSearchInput.addEventListener("input", ()=>{
      if(gifDebounce) clearTimeout(gifDebounce);
      gifDebounce = setTimeout(()=> loadGifLibrary({ query: gifSearchInput.value || "", append:false }), 250);
    });
    gifSearchInput && gifSearchInput.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      if(gifDebounce) clearTimeout(gifDebounce);
      loadGifLibrary({ query: gifSearchInput.value || "", append:false });
    });
    gifMoreBtn && gifMoreBtn.addEventListener("click", ()=> loadGifLibrary({ query: gifLastQuery, append:true }));

    function addGifUrl(){
      const raw = String(gifUrlInput?.value || "").trim();
      if(!raw){
        window.fwToast?.("GIF", "Colle un lien vers un GIF (.gif).");
        return;
      }
      const u = safeUrl(raw);
      if(!u){
        window.fwToast?.("GIF", "Lien invalide (http/https uniquement).");
        return;
      }
      const ext = fileExt(u);
      if(!["gif","png","jpg","jpeg","webp","svg","bmp","avif"].includes(ext)){
        window.fwToast?.("GIF", "Lien non direct. Utilise un lien qui finit par .gif (ou une image).");
        return;
      }
      setUrl(u);
      if(gifUrlInput) gifUrlInput.value = "";
      closePops();
      input?.focus?.();
    }
    gifAddBtn && gifAddBtn.addEventListener("click", addGifUrl);
    gifUrlInput && gifUrlInput.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      addGifUrl();
    });

    // Global close (once)
    if(!document.__fwChatPopCloseBound){
      document.__fwChatPopCloseBound = true;
      document.addEventListener("keydown", (e)=>{
        if(e.key === "Escape") document.querySelectorAll(".chat-pop").forEach(p=> p.classList.add("hidden"));
      });
      document.addEventListener("click", (e)=>{
        const t = e.target;
        if(t.closest(".chat-pop")) return;
        if(t.closest("[data-chat-emoji]")) return;
        if(t.closest("[data-chat-gif]")) return;
        document.querySelectorAll(".chat-pop").forEach(p=> p.classList.add("hidden"));
      });
    }

    function prevent(e){ e.preventDefault(); e.stopPropagation(); }
    function setDrag(on){ form.classList.toggle("dragover", !!on); }
    [msgs, form].filter(Boolean).forEach(el=>{
      el.addEventListener("dragenter", (e)=>{ prevent(e); setDrag(true); });
      el.addEventListener("dragover", (e)=>{ prevent(e); setDrag(true); });
      el.addEventListener("dragleave", (e)=>{ prevent(e); setDrag(false); });
      el.addEventListener("drop", (e)=>{
        prevent(e);
        setDrag(false);
        const f = e.dataTransfer?.files?.[0] || null;
        if(f) setFile(f);
      });
    });

    form.__fileUiBound = true;
  }

  function clearChatSelectedFile(container){
    const root = container || document;
    const form = $("#chatForm", root);
    const fileInput = $("#chatFile", root);
    const attach = $("#chatAttach", root);
    const attachBadge = $("#chatAttachBadge", root);
    const label = $("#chatAttachLabel", root);
    try{ if(fileInput) fileInput.value = ""; }catch(e){ /* ignore */ }
    if(form){
      form.__selectedFile = null;
      form.__selectedUrl = null;
    }
    attach && attach.classList.add("hidden");
    attachBadge && (attachBadge.textContent = "📎 Fichier");
    label && (label.textContent = "Aucun fichier");
    form && form.classList.remove("dragover");
  }

  // ---------- VISIO (WebRTC + Supabase Realtime signalling)
  const CALL_ICE = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
    ],
  };

  const callState = {
    active: false,
    joining: false,
    roomId: "",
    title: "",
    myId: "",
    channel: null,
    peers: new Map(), // peerId -> { pc, stream, makingOffer }
    peerMeta: new Map(), // peerId -> { name }
    localStream: null,
    audioTrack: null,
    cameraTrack: null,
    videoTrack: null,
    screenTrack: null,
    ui: null,
    tiles: new Map(), // id -> { tile, video, label }
    maximized: false,
  };

  function ensureCallUI(){
    if(callState.ui) return callState.ui;
    const html = `
      <div class="call-overlay hidden" id="callOverlay" role="dialog" aria-modal="true" aria-label="Visio">
        <div class="call-modal card" role="document">
          <div class="call-header">
            <div class="call-head-left">
              <div class="call-title" id="callTitle">Visio</div>
              <div class="call-sub" id="callSub">—</div>
            </div>
            <div class="row" style="gap:8px; align-items:center">
              <button class="btn icon ghost" type="button" title="Agrandir" data-call-max aria-pressed="false">⛶</button>
              <button class="btn icon ghost" type="button" title="Fermer" data-call-close>✕</button>
            </div>
          </div>
          <div class="call-grid" id="callGrid"></div>
          <div class="call-controls">
            <div class="call-ctrl-left">
              <button class="btn icon" type="button" title="Micro" data-call-mic>🎙️</button>
              <button class="btn icon" type="button" title="Caméra" data-call-cam>🎥</button>
              <button class="btn icon" type="button" title="Partager écran" data-call-share>🖥️</button>
            </div>
            <button class="btn danger" type="button" data-call-hangup>Raccrocher</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);

    const overlay = document.getElementById("callOverlay");
    const titleEl = document.getElementById("callTitle");
    const subEl = document.getElementById("callSub");
    const grid = document.getElementById("callGrid");
    const closeBtn = overlay.querySelector("[data-call-close]");
    const maxBtn = overlay.querySelector("[data-call-max]");
    const hangupBtn = overlay.querySelector("[data-call-hangup]");
    const micBtn = overlay.querySelector("[data-call-mic]");
    const camBtn = overlay.querySelector("[data-call-cam]");
    const shareBtn = overlay.querySelector("[data-call-share]");

    overlay.addEventListener("click", (e)=>{
      if(e.target === overlay){
        leaveCall();
      }
    });
    closeBtn.addEventListener("click", ()=> leaveCall());
    maxBtn && maxBtn.addEventListener("click", ()=> setCallMaximized(!callState.maximized));
    hangupBtn.addEventListener("click", ()=> leaveCall());
    micBtn.addEventListener("click", ()=> toggleMic());
    camBtn.addEventListener("click", ()=> toggleCam());
    shareBtn.addEventListener("click", ()=> toggleShareScreen());
    window.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && !overlay.classList.contains("hidden")){
        leaveCall();
      }
    });

    callState.ui = { overlay, titleEl, subEl, grid, micBtn, camBtn, shareBtn, maxBtn };
    return callState.ui;
  }

  function syncCallLayout(){
    const ui = ensureCallUI();
    const count = callState.tiles.size;
    ui.grid.classList.toggle("call-grid--single", count === 1);
    ui.grid.classList.toggle("call-grid--multi", count > 1);
  }

  function setCallMaximized(max){
    const ui = ensureCallUI();
    const modal = ui.overlay?.querySelector?.(".call-modal");
    const next = !!max;
    callState.maximized = next;
    modal && modal.classList.toggle("is-max", next);
    if(ui.maxBtn){
      ui.maxBtn.setAttribute("aria-pressed", String(next));
      ui.maxBtn.setAttribute("title", next ? "Réduire" : "Agrandir");
    }
  }

  function setCallHeader({ title, sub } = {}){
    const ui = ensureCallUI();
    if(title != null) ui.titleEl.textContent = String(title || "Visio");
    if(sub != null) ui.subEl.textContent = String(sub || "—");
  }

  function showCallOverlay(show){
    const ui = ensureCallUI();
    ui.overlay.classList.toggle("hidden", !show);
  }

  function tileLabelFor(id){
    if(id === "local") return "Moi";
    const meta = callState.peerMeta.get(String(id)) || {};
    return String(meta.name || "Participant");
  }

  function upsertTile(id, stream){
    const ui = ensureCallUI();
    const key = String(id);
    let t = callState.tiles.get(key);
    if(!t){
      const tile = document.createElement("div");
      tile.className = "call-tile";
      tile.setAttribute("data-call-tile", key);
      tile.innerHTML = `
        <video class="call-video" playsinline autoplay></video>
        <div class="call-label"></div>
      `;
      ui.grid.appendChild(tile);
      const video = tile.querySelector("video");
      const label = tile.querySelector(".call-label");
      t = { tile, video, label };
      callState.tiles.set(key, t);
    }
    t.label.textContent = tileLabelFor(key);
    if(stream){
      try{ t.video.srcObject = stream; }catch(e){ /* ignore */ }
      t.video.muted = (key === "local");
      t.video.play?.().catch(()=>{});
    }
    syncCallLayout();
  }

  function removeTile(id){
    const key = String(id);
    const t = callState.tiles.get(key);
    if(!t) return;
    t.tile.remove();
    callState.tiles.delete(key);
    syncCallLayout();
  }

  function resetTiles(){
    const ui = ensureCallUI();
    ui.grid.innerHTML = "";
    callState.tiles.clear();
    syncCallLayout();
  }

  function sendSignal(to, data){
    const ch = callState.channel;
    if(!ch) return;
    const payload = { to: String(to), from: String(callState.myId), data: data || {} };
    ch.send({ type: "broadcast", event: "signal", payload });
  }

  function shouldInitiate(peerId){
    return String(callState.myId) < String(peerId);
  }

  async function ensurePeer(peerId){
    const id = String(peerId);
    if(!id || id === String(callState.myId)) return null;
    if(callState.peers.has(id)) return callState.peers.get(id);

    const pc = new RTCPeerConnection(CALL_ICE);
    const remoteStream = new MediaStream();

    try{
      (callState.localStream?.getTracks() || []).forEach(track=>{
        try{ pc.addTrack(track, callState.localStream); }catch(e){ /* ignore */ }
      });
    }catch(e){ /* ignore */ }

    pc.ontrack = (e)=>{
      if(e.track) remoteStream.addTrack(e.track);
      upsertTile(id, remoteStream);
    };
    pc.onicecandidate = (e)=>{
      if(e.candidate){
        sendSignal(id, { type: "candidate", candidate: (e.candidate.toJSON ? e.candidate.toJSON() : e.candidate) });
      }
    };
    pc.onconnectionstatechange = ()=>{
      const st = pc.connectionState;
      if(st === "failed" || st === "disconnected" || st === "closed"){
        // keep tile, but allow reconnect by re-joining
      }
    };

    const peer = { pc, stream: remoteStream, makingOffer: false, needOffer: true };
    callState.peers.set(id, peer);
    upsertTile(id, remoteStream);
    return peer;
  }

  async function makeOffer(peerId){
    const id = String(peerId);
    const peer = await ensurePeer(id);
    if(!peer || peer.makingOffer) return;
    peer.makingOffer = true;
    try{
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      const ld = peer.pc.localDescription;
      sendSignal(id, { type: "offer", sdp: ld ? { type: ld.type, sdp: ld.sdp } : null });
    }catch(e){
      console.warn("Offer failed", e);
    }finally{
      peer.makingOffer = false;
    }
  }

  async function handleSignal(payload){
    const p = payload || {};
    if(String(p.to || "") !== String(callState.myId)) return;
    const from = String(p.from || "");
    if(!from || from === String(callState.myId)) return;
    const data = p.data || {};

    if(data.type === "offer"){
      const peer = await ensurePeer(from);
      if(!peer) return;
      try{
        if(!data.sdp) return;
        await peer.pc.setRemoteDescription(data.sdp);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        const ld = peer.pc.localDescription;
        sendSignal(from, { type: "answer", sdp: ld ? { type: ld.type, sdp: ld.sdp } : null });
      }catch(e){
        console.warn("Handle offer failed", e);
      }
      return;
    }
    if(data.type === "answer"){
      const peer = await ensurePeer(from);
      if(!peer) return;
      try{
        if(!data.sdp) return;
        await peer.pc.setRemoteDescription(data.sdp);
      }catch(e){
        console.warn("Handle answer failed", e);
      }
      return;
    }
    if(data.type === "candidate"){
      const peer = await ensurePeer(from);
      if(!peer) return;
      try{
        await peer.pc.addIceCandidate(data.candidate);
      }catch(e){
        // ignore (can happen if candidate arrives early)
      }
    }
  }

  async function syncCallPeers(){
    const ch = callState.channel;
    if(!ch) return;
    const state = ch.presenceState ? ch.presenceState() : {};
    const ids = Object.keys(state || {}).map(String).filter(id=> id && id !== String(callState.myId));

    // update meta
    ids.forEach(id=>{
      const meta = (state[id] && state[id][0]) || {};
      callState.peerMeta.set(String(id), { name: meta.name || meta.user?.name || meta.user_name || "" });
    });

    // remove peers who left
    Array.from(callState.peers.keys()).forEach(id=>{
      if(!ids.includes(String(id))){
        try{ callState.peers.get(id)?.pc?.close?.(); }catch(e){ /* ignore */ }
        callState.peers.delete(id);
        callState.peerMeta.delete(id);
        removeTile(id);
      }
    });

    // ensure connections
    for(const id of ids){
      const peer = await ensurePeer(id);
      if(peer && shouldInitiate(id) && peer.needOffer){
        peer.needOffer = false;
        await makeOffer(id);
      }
    }

    // update labels and header
    callState.tiles.forEach((t, id)=>{ t.label.textContent = tileLabelFor(id); });
    setCallHeader({ sub: `${1 + ids.length} participant(s)` });
  }

  async function getLocalMedia(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      return stream;
    }catch(e){
      // fallback to audio-only
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return stream;
    }
  }

  async function joinCall({ roomId, title } = {}){
    if(!sbEnabled || !sb){
      window.fwToast?.("Visio", "La visio nécessite Supabase (Realtime) + HTTPS.");
      return;
    }
    const rid = String(roomId || "").trim();
    if(!rid) return;

    if(callState.joining) return;
    if(callState.active && callState.roomId === rid){
      showCallOverlay(true);
      return;
    }

    callState.joining = true;
    try{
      await leaveCall();
      const myId = await sbUserId();
      if(!myId){
        window.fwToast?.("Visio", "Connecte-toi d’abord.");
        return;
      }
      callState.active = true;
      callState.roomId = rid;
      callState.title = String(title || "Visio");
      callState.myId = String(myId);

      setCallHeader({ title: callState.title, sub: "Connexion…" });
      showCallOverlay(true);
      resetTiles();

      window.fwToast?.("Visio", "Autorise micro/caméra…");
      const stream = await getLocalMedia();
      callState.localStream = stream;
      callState.audioTrack = stream.getAudioTracks?.()[0] || null;
      callState.cameraTrack = stream.getVideoTracks?.()[0] || null;
      callState.videoTrack = callState.cameraTrack;
      upsertTile("local", stream);

      const realtime = sb.channel(`fw-call:${rid}`, {
        config: {
          broadcast: { self: true },
          presence: { key: String(myId) },
        },
      });
      callState.channel = realtime;

      realtime.on("broadcast", { event: "signal" }, ({ payload })=> handleSignal(payload));
      realtime.on("presence", { event: "sync" }, ()=>{ syncCallPeers(); });
      realtime.on("presence", { event: "join" }, ()=>{ syncCallPeers(); });
      realtime.on("presence", { event: "leave" }, ({ key })=>{
        const id = String(key || "");
        if(!id) return;
        try{ callState.peers.get(id)?.pc?.close?.(); }catch(e){ /* ignore */ }
        callState.peers.delete(id);
        callState.peerMeta.delete(id);
        removeTile(id);
        syncCallPeers();
      });

      await new Promise((resolve, reject)=>{
        const t = setTimeout(()=> reject(new Error("realtime_timeout")), 12_000);
        realtime.subscribe((status)=>{
          if(status === "SUBSCRIBED"){
            clearTimeout(t);
            resolve();
          }
        });
      });

      await realtime.track({ name: getUser()?.name || "Utilisateur" });
      await syncCallPeers();
      window.fwToast?.("Visio", "Connecté.");
    }catch(e){
      console.error("joinCall failed", e);
      const errName = String(e?.name || "").trim();
      const errMsg = String(e?.message || "").trim().toLowerCase();
      if(errName === "NotAllowedError"){
        window.fwToast?.("Visio", "Micro/camera bloques. Autorise-les dans le navigateur et verifie Permissions-Policy.");
      } else if(errName === "NotFoundError"){
        window.fwToast?.("Visio", "Aucun micro ou aucune camera detecte(e).");
      } else if(errMsg.includes("secure") || !window.isSecureContext){
        window.fwToast?.("Visio", "La visio exige HTTPS ou localhost.");
      } else {
        window.fwToast?.("Visio", "Impossible de demarrer la visio.");
      }
      await leaveCall();
    }finally{
      callState.joining = false;
    }
  }

  async function leaveCall(){
    if(!callState.active && !callState.channel) {
      showCallOverlay(false);
      return;
    }

    // stop screen share if any
    if(callState.screenTrack){
      try{ callState.screenTrack.stop(); }catch(e){ /* ignore */ }
      callState.screenTrack = null;
    }

    // close peers
    for(const [id, peer] of callState.peers.entries()){
      try{ peer.pc.close(); }catch(e){ /* ignore */ }
      removeTile(id);
    }
    callState.peers.clear();
    callState.peerMeta.clear();

    // unsubscribe realtime
    try{ callState.channel?.untrack?.(); }catch(e){ /* ignore */ }
    try{ callState.channel?.unsubscribe?.(); }catch(e){ /* ignore */ }
    callState.channel = null;

    // stop local tracks
    try{
      (callState.localStream?.getTracks?.() || []).forEach(t=>{ try{ t.stop(); }catch(e){ /* ignore */ } });
    }catch(e){ /* ignore */ }

    callState.localStream = null;
    callState.audioTrack = null;
    callState.cameraTrack = null;
    callState.videoTrack = null;

    callState.active = false;
    callState.roomId = "";
    callState.title = "";
    callState.myId = "";

    showCallOverlay(false);
    setCallMaximized(false);
    resetTiles();
  }

  function currentVideoSender(pc){
    const senders = pc?.getSenders ? pc.getSenders() : [];
    return senders.find(s=> s.track && s.track.kind === "video") || null;
  }

  async function toggleMic(){
    const t = callState.audioTrack;
    if(!t){
      window.fwToast?.("Micro", "Audio indisponible.");
      return;
    }
    t.enabled = !t.enabled;
    const ui = ensureCallUI();
    ui.micBtn.textContent = t.enabled ? "🎙️" : "🔇";
  }

  async function toggleCam(){
    const t = callState.videoTrack;
    if(!t){
      window.fwToast?.("Caméra", "Vidéo indisponible.");
      return;
    }
    t.enabled = !t.enabled;
    const ui = ensureCallUI();
    ui.camBtn.textContent = t.enabled ? "🎥" : "🚫";
  }

  async function toggleShareScreen(){
    if(!callState.active){
      window.fwToast?.("Partage écran", "Démarre une visio d’abord.");
      return;
    }

    // stop share
    if(callState.screenTrack){
      try{ callState.screenTrack.stop(); }catch(e){ /* ignore */ }
      callState.screenTrack = null;
      if(callState.cameraTrack){
        callState.videoTrack = callState.cameraTrack;
        for(const peer of callState.peers.values()){
          const sender = currentVideoSender(peer.pc);
          sender && sender.replaceTrack?.(callState.cameraTrack);
        }
        upsertTile("local", callState.localStream);
      }
      ensureCallUI().shareBtn.textContent = "🖥️";
      return;
    }

    try{
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = display.getVideoTracks?.()[0];
      if(!screenTrack) return;

      callState.screenTrack = screenTrack;
      callState.videoTrack = screenTrack;
      screenTrack.onended = ()=>{ toggleShareScreen(); };

      for(const peer of callState.peers.values()){
        const sender = currentVideoSender(peer.pc);
        sender && sender.replaceTrack?.(screenTrack);
      }

      // local preview: show screen
      upsertTile("local", new MediaStream([screenTrack, ...(callState.audioTrack ? [callState.audioTrack] : [])]));
      ensureCallUI().shareBtn.textContent = "⏹️";
    }catch(e){
      window.fwToast?.("Partage écran", "Partage écran refusé ou indisponible.");
    }
  }

  // Expose for handlers in channels/DM
  window.fwCall = {
    join: joinCall,
    leave: leaveCall,
    active: ()=> callState.active,
    roomId: ()=> callState.roomId,
  };

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
      const wantAdmin = String(u.role || "").trim().toLowerCase() === "admin";
      const meRoleIds = [];
      if(wantAdmin && adminRoleId) meRoleIds.push(adminRoleId);
      else if(memberRoleId) meRoleIds.push(memberRoleId);
      const members = [
        {
          id: cryptoRandom(),
          name: u.name || "Utilisateur",
          email: u.email || "vous@exemple.com",
          company: meCompany,
          joinedAt: u.joinedAt || dateStr(),
          roleIds: meRoleIds,
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
  function isAdmin(){
    return String(getUser()?.role || "").trim().toLowerCase() === "admin";
  }

  const FEED_IMG_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const sbImageCache = new Map(); // key: bucket/path -> objectURL

  const composerModalState = {
    bound: false,
    prevOverflow: "",
  };

  function getComposerOverlay(){
    return $("#postComposerOverlay");
  }

  function openComposerModal(){
    const overlay = getComposerOverlay();
    if(!overlay) return false;
    bindComposerModalUI();

    const opening = overlay.classList.contains("hidden");
    overlay.classList.remove("hidden");

    if(opening){
      try{
        composerModalState.prevOverflow = document.body.style.overflow ?? "";
        document.body.style.overflow = "hidden";
      }catch(e){ /* ignore */ }
    }

    hidePostDeleteConfirm();
    try{ $("#postTitle")?.focus?.(); }catch(e){ /* ignore */ }
    return true;
  }

  function closeComposerModal({ reset } = {}){
    const overlay = getComposerOverlay();
    if(!overlay) return false;

    const wasOpen = !overlay.classList.contains("hidden");
    overlay.classList.add("hidden");
    hidePostDeleteConfirm();

    if(wasOpen){
      try{ document.body.style.overflow = composerModalState.prevOverflow; }catch(e){ /* ignore */ }
    }

    if(reset) exitPostEditMode();
    return true;
  }

  function bindComposerModalUI(){
    const overlay = getComposerOverlay();
    if(!overlay || composerModalState.bound) return;
    composerModalState.bound = true;

    const openBtn = $("[data-post-modal-open]");
    if(openBtn && !openBtn.__bound){
      openBtn.__bound = true;
      openBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        exitPostEditMode();
        openComposerModal();
      });
    }

    $$("[data-post-modal-close]", overlay).forEach(btn => {
      if(btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener("click", (e)=>{
        e.preventDefault();
        closeComposerModal({ reset:true });
      });
    });

    overlay.addEventListener("click", (e)=>{
      if(e.target !== overlay) return;
      closeComposerModal({ reset:true });
    });

    document.addEventListener("keydown", (e)=>{
      if(e.key !== "Escape") return;
      const o = getComposerOverlay();
      if(!o || o.classList.contains("hidden")) return;
      closeComposerModal({ reset:true });
    });
  }

  function showPostDeleteConfirm(){
    const box = $("#postDeleteBox");
    box && box.classList.remove("hidden");
  }

  function hidePostDeleteConfirm(){
    const box = $("#postDeleteBox");
    box && box.classList.add("hidden");
  }

  function fileExt(raw){
    const s = String(raw || "").trim().toLowerCase();
    if(!s) return "";
    const clean = s.split("#")[0].split("?")[0];
    const m = clean.match(/\.([a-z0-9]{1,6})$/i);
    return m ? String(m[1] || "").toLowerCase() : "";
  }

  function isProbablyImageAttachment({ fileName, fileUrl, fileDataUrl } = {}){
    const dataUrl = String(fileDataUrl || "").trim();
    if(dataUrl.startsWith("data:image/")) return true;
    const ext = fileExt(fileName || fileUrl || "");
    return ["png","jpg","jpeg","gif","webp","svg","bmp","avif"].includes(ext);
  }

  function attachmentHint({ fileName, fileUrl, fileDataUrl } = {}){
    const has = !!(String(fileName || "").trim() || String(fileUrl || "").trim() || String(fileDataUrl || "").trim());
    if(!has) return "";
    return isProbablyImageAttachment({ fileName, fileUrl, fileDataUrl }) ? " • 🖼️ Image" : " • 📄 Fichier";
  }

  function attachmentImgSrc({ fileUrl, fileDataUrl } = {}){
    const dataUrl = String(fileDataUrl || "").trim();
    if(dataUrl.startsWith("data:image/")) return dataUrl;
    const url = String(fileUrl || "").trim();
    if(!url || url.startsWith("sb://")) return "";
    return safeUrl(url) || "";
  }

  function renderPostAttachmentHtml({ id, fileUrl, fileName, fileDataUrl } = {}){
    const fid = String(id || "").trim();
    const url = String(fileUrl || "").trim();
    const name = String(fileName || "").trim();
    const dataUrl = String(fileDataUrl || "").trim();
    const has = !!(name || url || dataUrl);
    if(!has) return "";

    const isImg = isProbablyImageAttachment({ fileName: name, fileUrl: url, fileDataUrl: dataUrl });
    if(!isImg){
      return `
        <button class="file-box" type="button" data-open="${escapeHtml(fid)}" data-file-url="${escapeHtml(url)}" data-file-name="${escapeHtml(name)}">
          <div class="file-left">
            <div class="file-ico" aria-hidden="true">📄</div>
            <div class="file-meta">
              <div class="file-title">Télécharger le fichier</div>
              <div class="file-sub">${escapeHtml(name || "Cliquez pour ouvrir")}</div>
            </div>
          </div>
          <span class="badge">Ouvrir</span>
        </button>
      `;
    }

    const src = attachmentImgSrc({ fileUrl: url, fileDataUrl: dataUrl });
    const sbUrl = !src ? parseSbStorageUrl(url) : null;
    if(!src && !sbUrl){
      // Invalid URL: fallback to file-box
      return `
        <button class="file-box" type="button" data-open="${escapeHtml(fid)}" data-file-url="${escapeHtml(url)}" data-file-name="${escapeHtml(name)}">
          <div class="file-left">
            <div class="file-ico" aria-hidden="true">📄</div>
            <div class="file-meta">
              <div class="file-title">Télécharger le fichier</div>
              <div class="file-sub">${escapeHtml(name || "Cliquez pour ouvrir")}</div>
            </div>
          </div>
          <span class="badge">Ouvrir</span>
        </button>
      `;
    }

    return `
      <button class="media-box" type="button" data-open="${escapeHtml(fid)}" data-file-url="${escapeHtml(url)}" data-file-name="${escapeHtml(name)}">
        <img
          class="media-img"
          alt=""
          loading="lazy"
          src="${escapeHtml(src || FEED_IMG_PLACEHOLDER)}"
          ${sbUrl ? `data-sb-bucket="${escapeHtml(sbUrl.bucket)}" data-sb-path="${escapeHtml(sbUrl.path)}"` : ""}
        />
        <div class="media-bar">
          <div class="media-name">${escapeHtml(name || "Image")}</div>
          <span class="badge">Ouvrir</span>
        </div>
      </button>
    `;
  }

  async function hydrateSbImagePreviews(root){
    if(!sbEnabled || !sb || !root) return;
    const imgs = $$("img[data-sb-bucket][data-sb-path]", root);
    for(const img of imgs){
      const bucket = String(img.getAttribute("data-sb-bucket") || "").trim();
      const path = String(img.getAttribute("data-sb-path") || "").trim();
      if(!bucket || !path) continue;
      if(img.__sbLoading || img.__sbLoaded) continue;

      const key = `${bucket}/${path}`;
      const cached = sbImageCache.get(key);
      if(cached){
        img.src = cached;
        img.__sbLoaded = true;
        continue;
      }

      img.__sbLoading = true;
      try{
        const res = await sb.storage.from(bucket).download(path);
        if(res.error){
          console.warn("Image preview download failed", res.error);
          continue;
        }
        const url = URL.createObjectURL(res.data);
        sbImageCache.set(key, url);
        img.src = url;
        img.__sbLoaded = true;
      }catch(e){
        console.warn("Image preview download failed", e);
      }finally{
        img.__sbLoading = false;
      }
    }
  }

  async function deletePostById(postId){
    const id = String(postId || "").trim();
    if(!id) return false;

    const form = $("#newPostForm");
    if(form && form.__deleting) return false;
    if(form) form.__deleting = true;

    const confirmBtn = $("#postDeleteConfirm");
    if(confirmBtn) confirmBtn.disabled = true;

    try{
      if(sbEnabled){
        const uid = await sbUserId();
        if(!uid){
          window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
          return false;
        }

        const company = companyFromUser();

        let fileUrl = "";
        const pre = await sb
          .from("posts")
          .select("file_url")
          .eq("company", company)
          .eq("id", id)
          .maybeSingle();
        if(!pre.error) fileUrl = String(pre.data?.file_url || "");

        const res = await sb
          .from("posts")
          .delete()
          .eq("company", company)
          .eq("id", id);
        if(res.error){
          sbToastError("Suppression", res.error);
          return false;
        }

        const sbUrl = parseSbStorageUrl(fileUrl);
        if(sbUrl){
          const rm = await sb.storage.from(sbUrl.bucket).remove([sbUrl.path]);
          if(rm.error){
            console.warn("Storage remove failed", rm.error);
          }
        }

        if(form && String(form.__editingId || "") === String(id)){
          exitPostEditMode();
        }

        closeComposerModal({ reset:true });
        await renderFeedSupabase();
        window.fwToast?.("Supprimé","La publication a été retirée.");
        return true;
      }

      const posts = loadPosts().filter(x=>String(x.id)!==String(id));
      savePosts(posts);
      if(form && String(form.__editingId || "") === String(id)){
        exitPostEditMode();
      }
      closeComposerModal({ reset:true });
      renderFeed();
      window.fwToast?.("Supprimé","La publication a été retirée.");
      return true;
    } finally {
      hidePostDeleteConfirm();
      if(confirmBtn) confirmBtn.disabled = false;
      if(form) form.__deleting = false;
    }
  }

  function composerIsEmpty(){
    const form = $("#newPostForm");
    if(!form) return true;
    const title = $("#postTitle")?.value.trim() || "";
    const body = $("#postBody")?.value.trim() || "";
    const fileUrl = $("#postFileUrl")?.value.trim() || "";
    const fileName = $("#postFileName")?.value.trim() || "";
    const folder = $("#postFolder")?.value.trim() || "";
    return !title && !body && !fileUrl && !fileName && !folder && !form.__selectedFile;
  }

  function fileTitleFromName(name){
    const s = String(name || "").trim();
    if(!s) return "Fichier";
    return s.replace(/\.[^.]+$/, "") || s;
  }

  function toCodeFence(raw){
    const t = String(raw || "").replace(/\r\n/g, "\n");
    if(!t.trim()) return "";
    const trimmed = t.trim();
    if(trimmed.startsWith("```") && trimmed.endsWith("```")) return trimmed;
    return `\`\`\`js\n${t.replace(/\s+$/,"")}\n\`\`\``;
  }

  function parseCodeFence(raw){
    const s = String(raw || "").replace(/\r\n/g, "\n").trim();
    const m = s.match(/^```([a-zA-Z0-9_-]+)?[^\n]*\n([\s\S]*?)\n```$/);
    if(!m) return null;
    return { lang: String(m[1] || "").trim(), code: m[2] || "" };
  }

  function renderPostBodyHtml(body){
    const s = String(body || "");
    if(!s.trim()) return "";
    const fenced = parseCodeFence(s);
    if(fenced){
      return `<pre class="post-code"><code>${escapeHtml(fenced.code)}</code></pre>`;
    }
    return `<p>${escapeHtml(s).replace(/\n/g, "<br/>")}</p>`;
  }

  function setComposerEditUI(isEditing, label){
    const bar = $("#postEditBar");
    bar && bar.classList.toggle("hidden", !isEditing);
    const l = $("#postEditLabel");
    l && (l.textContent = label || (isEditing ? "Mode édition" : "Mode création"));
    const submit = $("#postSubmitBtn");
    submit && (submit.textContent = isEditing ? "Mettre à jour" : "Publier");
    const del = $("#postDeleteBtn");
    del && del.classList.toggle("hidden", !isEditing);
    if(!isEditing) hidePostDeleteConfirm();
  }

  function enterPostEditMode({ id, title, body, fileUrl, fileName, fileData } = {}){
    const form = $("#newPostForm");
    if(!form) return;
    bindComposerFileUI();
    const pid = String(id || "").trim();
    if(!pid) return;

    form.__editingId = pid;
    form.__editingRemoveFile = false;
    form.__editingOldFileUrl = String(fileUrl || "").trim();
    form.__editingOldFileName = String(fileName || "").trim();
    form.__editingOldFileData = fileData || null;

    $("#postTitle") && ($("#postTitle").value = String(title || ""));
    $("#postBody") && ($("#postBody").value = String(body || ""));
    $("#postFileUrl") && ($("#postFileUrl").value = form.__editingOldFileUrl);
    $("#postFileName") && ($("#postFileName").value = form.__editingOldFileName);
    $("#postFolder") && ($("#postFolder").value = "");

    // Clear any new file selection; keep the existing attachment in __editingOldFile*
    $("#postFile") && ($("#postFile").value = "");
    form.__selectedFile = null;

    const info = $("#postFileInfo");
    if(info){
      if(form.__editingOldFileName || form.__editingOldFileUrl){
        info.textContent = `Fichier actuel : ${form.__editingOldFileName || "lien"}`;
      }else if(form.__editingOldFileData){
        info.textContent = `Fichier actuel : ${form.__editingOldFileName || "fichier (démo)"}`;
      }else{
        info.textContent = "Aucun fichier sélectionné";
      }
    }

    setComposerEditUI(true, `Édition : ${String(title || "Publication")}`);
    if(!openComposerModal()){
      try{ form.scrollIntoView({ behavior:"smooth", block:"start" }); }catch(e){ /* ignore */ }
    }
  }

  function exitPostEditMode(){
    const form = $("#newPostForm");
    if(!form) return;
    form.__editingId = "";
    form.__editingRemoveFile = false;
    form.__editingOldFileUrl = "";
    form.__editingOldFileName = "";
    form.__editingOldFileData = null;

    $("#postTitle") && ($("#postTitle").value = "");
    $("#postBody") && ($("#postBody").value = "");
    $("#postFileUrl") && ($("#postFileUrl").value = "");
    $("#postFileName") && ($("#postFileName").value = "");
    $("#postFolder") && ($("#postFolder").value = "");
    $("#postFile") && ($("#postFile").value = "");
    form.__selectedFile = null;
    $("#postFileInfo") && ($("#postFileInfo").textContent = "Aucun fichier sélectionné");
    setComposerEditUI(false);
  }

  function loadPosts(){
    try{ return JSON.parse(localStorage.getItem("fwPosts") || "[]"); }catch(e){ return []; }
  }
  function savePosts(arr){ localStorage.setItem("fwPosts", JSON.stringify(arr)); }

  const POST_COMMENTS_KEY = "fwPostComments_v1";
  function loadPostComments(){
    try{
      const m = JSON.parse(localStorage.getItem(POST_COMMENTS_KEY) || "{}");
      return (m && typeof m === "object") ? m : {};
    }catch(e){
      return {};
    }
  }
  function savePostComments(map){ localStorage.setItem(POST_COMMENTS_KEY, JSON.stringify(map || {})); }
  function getCommentsForPost(postId, map){
    const pid = String(postId || "").trim();
    if(!pid) return [];
    const m = (map && typeof map === "object") ? map : {};
    const arr = m[pid];
    return Array.isArray(arr) ? arr : [];
  }
  function countCommentsForPost(postId, map){ return getCommentsForPost(postId, map).length; }
  function trimCommentText(raw){
    const t = String(raw || "").replace(/\r\n/g, "\n").trim();
    return t.slice(0, 800);
  }
  function commentAvatarHtml({ name, avatarUrl, avatarBg } = {}){
    const n = String(name || "Utilisateur").trim() || "Utilisateur";
    const url = safeMediaUrl(avatarUrl);
    const bg = safeAvatarBg(avatarBg, avatarBgFor(n));
    if(url){
      return `<div class="avatar sm" aria-hidden="true"><img src="${escapeHtml(url)}" alt=""/></div>`;
    }
    const style = ` style="background:${escapeHtml(bg)}"`;
    return `<div class="avatar sm" aria-hidden="true"${style}>${escapeHtml(initials(n))}</div>`;
  }
  function commentTextHtml(text){ return escapeHtml(String(text || "")).replace(/\n/g, "<br/>"); }
  function commentActionBtnHtml({ postId, count } = {}){
    const pid = String(postId || "").trim();
    const n = Number(count || 0);
    return `<button class="iconbtn" type="button" data-comment-toggle="${escapeHtml(pid)}" aria-expanded="false" aria-controls="comments-${escapeHtml(pid)}">💬 <span data-comment-count="${escapeHtml(pid)}">${n}</span></button>`;
  }
  function commentPanelHtml({ postId } = {}){
    const pid = String(postId || "").trim();
    return `
      <div class="comments hidden" id="comments-${escapeHtml(pid)}" data-comments-panel="${escapeHtml(pid)}">
        <div class="comments-list" data-comments-list="${escapeHtml(pid)}"></div>
        <form class="comments-form" data-comment-form="${escapeHtml(pid)}">
          <textarea class="input comment-input" name="comment" rows="2" placeholder="Écrire un commentaire…" maxlength="800" required></textarea>
          <button class="btn small" type="submit">Envoyer</button>
        </form>
      </div>
    `;
  }
  function setCommentCountEl(root, postId, count){
    const pid = String(postId || "").trim();
    const el = root?.querySelector?.(`[data-comment-count="${pid}"]`);
    if(el) el.textContent = String(Math.max(0, Number(count || 0)));
  }
  function renderLocalCommentsInto(panel, postId){
    if(!panel) return;
    const pid = String(postId || "").trim();
    const list = panel.querySelector(`[data-comments-list="${pid}"]`) || panel.querySelector("[data-comments-list]");
    if(!list) return;

    const map = loadPostComments();
    const comments = getCommentsForPost(pid, map);
    if(!comments.length){
      list.innerHTML = `<div class="comments-empty">Aucun commentaire pour le moment.</div>`;
      return;
    }

    const me = getUser() || {};
    const meRole = String(me.role || "").trim().toLowerCase();
    const meEmail = String(me.email || "").trim().toLowerCase();

    list.innerHTML = comments.map(c=>{
      const name = String(c?.author || "Utilisateur");
      const at = String(c?.createdAt || "");
      const email = String(c?.authorEmail || "").trim().toLowerCase();
      const canDelete = meRole === "admin" || (meEmail && email && meEmail === email);
      return `
        <div class="comment">
          <div class="comment-head">
            <div class="comment-who">
              ${commentAvatarHtml({ name, avatarUrl: c?.avatarUrl, avatarBg: c?.avatarBg })}
              <div class="comment-meta">
                <div class="comment-name">${escapeHtml(name)}</div>
                <div class="comment-time">${escapeHtml(at)}</div>
              </div>
            </div>
            ${canDelete ? `<button class="btn small ghost" type="button" title="Supprimer" aria-label="Supprimer" data-comment-del="${escapeHtml(String(c?.id || ""))}" data-comment-post="${escapeHtml(pid)}">🗑️</button>` : ""}
          </div>
          <div class="comment-text">${commentTextHtml(c?.text)}</div>
        </div>
      `;
    }).join("");
  }
  function addLocalComment({ postId, text } = {}){
    const pid = String(postId || "").trim();
    const t = trimCommentText(text);
    if(!pid || !t) return null;

    const me = getUser() || {};
    const map = loadPostComments();
    const next = getCommentsForPost(pid, map).slice();
    const c = {
      id: cryptoRandom(),
      postId: pid,
      author: String(me.name || "Utilisateur"),
      authorEmail: String(me.email || ""),
      avatarUrl: String(me.avatarUrl || ""),
      avatarBg: String(me.avatarBg || ""),
      text: t,
      createdAt: nowStr(),
    };
    next.push(c);
    map[pid] = next;
    savePostComments(map);
    return c;
  }
  function deleteLocalComment({ postId, commentId } = {}){
    const pid = String(postId || "").trim();
    const cid = String(commentId || "").trim();
    if(!pid || !cid) return false;
    const map = loadPostComments();
    const prev = getCommentsForPost(pid, map);
    const next = prev.filter(c=> String(c?.id || "") !== cid);
    map[pid] = next;
    savePostComments(map);
    return next.length !== prev.length;
  }

  async function renderSupabaseCommentsInto(root, postId){
    if(!sb || !root) return 0;

    const pid = String(postId || "").trim();
    if(!pid) return 0;

    const panel = root.querySelector(`[data-comments-panel="${pid}"]`);
    if(!panel) return 0;
    const list = panel.querySelector(`[data-comments-list="${pid}"]`) || panel.querySelector("[data-comments-list]");
    if(!list) return 0;

    list.innerHTML = `<div class="comments-empty">Chargement…</div>`;

    const uid = await sbUserId();
    if(!uid){
      list.innerHTML = `<div class="comments-empty">Connecte-toi pour commenter.</div>`;
      return 0;
    }

    const company = companyFromUser();
    const res = await sb
      .from("post_comments")
      .select("id,post_id,user_id,text,created_at")
      .eq("company", company)
      .eq("post_id", pid)
      .order("created_at", { ascending: true });

    if(res.error){
      const msg = res.error?.message || "Commentaires indisponibles.";
      console.error("[FaceWork] post_comments select failed", res.error);
      list.innerHTML = `<div class="comments-empty">${escapeHtml(msg)}</div>`;
      return 0;
    }

    const comments = res.data || [];
    if(!comments.length){
      list.innerHTML = `<div class="comments-empty">Aucun commentaire pour le moment.</div>`;
      setCommentCountEl(root, pid, 0);
      return 0;
    }

    const authorIds = Array.from(new Set((comments || []).map(c=> c?.user_id).filter(Boolean).map(x=> String(x))));
    let authors = [];
    if(authorIds.length){
      const pres = await sb
        .from("profiles")
        .select("id,name,avatar_url,avatar_bg")
        .in("id", authorIds);
      if(!pres.error) authors = pres.data || [];
    }
    const authorById = new Map((authors || []).map(a=> [String(a.id), a]));

    const meRole = String(getUser()?.role || "").trim().toLowerCase();

    list.innerHTML = comments.map(c=>{
      const author = authorById.get(String(c?.user_id)) || {};
      const name = String(author?.name || "Utilisateur");
      const at = fmtTs(c?.created_at);
      const canDelete = meRole === "admin" || String(c?.user_id) === String(uid);
      return `
        <div class="comment">
          <div class="comment-head">
            <div class="comment-who">
              ${commentAvatarHtml({ name, avatarUrl: author?.avatar_url, avatarBg: author?.avatar_bg })}
              <div class="comment-meta">
                <div class="comment-name">${escapeHtml(name)}</div>
                <div class="comment-time">${escapeHtml(at)}</div>
              </div>
            </div>
            ${canDelete ? `<button class="btn small ghost" type="button" title="Supprimer" aria-label="Supprimer" data-comment-del="${escapeHtml(String(c?.id || ""))}" data-comment-post="${escapeHtml(pid)}">🗑️</button>` : ""}
          </div>
          <div class="comment-text">${commentTextHtml(c?.text)}</div>
        </div>
      `;
    }).join("");

    setCommentCountEl(root, pid, comments.length);
    return comments.length;
  }

  function renderFeed(){
    const root = $("#feedList");
    if(!root) return;
    bindComposerFileUI();
    const me = getUser() || {};
    const meRole = String(me.role || "").trim().toLowerCase();
    const meEmail = String(me.email || "").trim().toLowerCase();
    const posts = loadPosts();
    const commentsMap = loadPostComments();
    root.innerHTML = "";
    posts.slice().reverse().forEach(p=>{
      const commentCount = countCommentsForPost(p.id, commentsMap);
      const authorEmail = String(p.authorEmail || "").trim().toLowerCase();
      const canManage = meRole === "admin" || (meEmail && authorEmail && meEmail === authorEmail);
      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <div class="top">
          <div class="who">
              <div class="avatar" aria-hidden="true">${(p.author||"U").split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||"U").join("")}</div>
              <div class="meta">
                <div class="name">${escapeHtml(p.author || "Utilisateur")} <span class="badge" style="margin-left:8px">${escapeHtml(p.company || "Entreprise")}</span></div>
                <div class="time">${escapeHtml(p.createdAt || "")}${attachmentHint({ fileName: p.fileName, fileUrl: p.fileUrl, fileDataUrl: p.fileData?.dataUrl })}</div>
              </div>
            </div>
            <div class="row" style="gap:8px; align-items:center">
              ${canManage ? `<button class="btn icon ghost" title="Éditer" data-edit="${escapeHtml(p.id)}">✏️</button>` : ""}
              ${canManage ? `<button class="btn icon ghost" title="Supprimer" data-del="${escapeHtml(p.id)}">🗑️</button>` : ""}
            </div>
          </div>
          <h4>${escapeHtml(p.title || "Publication")}</h4>
           ${renderPostAttachmentHtml({ id: p.id, fileUrl: p.fileUrl, fileName: p.fileName, fileDataUrl: p.fileData?.dataUrl })}
           ${renderPostBodyHtml(p.body)}
           <div class="actions">
             <button class="iconbtn" data-like="${escapeHtml(p.id)}">❤️ <span>${p.likes || 0}</span></button>
             ${commentActionBtnHtml({ postId: p.id, count: commentCount })}
           </div>
           ${commentPanelHtml({ postId: p.id })}
       `;
       root.appendChild(el);
     });

    if(!root.__bound){
      root.__bound = true;
      root.addEventListener("click", async (e)=>{
        const commentToggleId = e.target.closest("[data-comment-toggle]")?.getAttribute("data-comment-toggle");
        const commentDelBtn = e.target.closest("[data-comment-del]");
        const commentDelId = commentDelBtn?.getAttribute("data-comment-del");
        const commentDelPostId = commentDelBtn?.getAttribute("data-comment-post");
        const editId = e.target.closest("[data-edit]")?.getAttribute("data-edit");
        const likeId = e.target.closest("[data-like]")?.getAttribute("data-like");
        const delId = e.target.closest("[data-del]")?.getAttribute("data-del");
        const openId = e.target.closest("[data-open]")?.getAttribute("data-open");

        if(commentToggleId){
          const pid = String(commentToggleId || "").trim();
          const panel = root.querySelector(`[data-comments-panel="${pid}"]`);
          const btn = e.target.closest("[data-comment-toggle]");
          if(!panel) return;
          const isOpen = !panel.classList.contains("hidden");
          panel.classList.toggle("hidden", isOpen);
          btn?.setAttribute("aria-expanded", isOpen ? "false" : "true");
          if(!isOpen){
            renderLocalCommentsInto(panel, pid);
            setCommentCountEl(root, pid, countCommentsForPost(pid, loadPostComments()));
          }
          return;
        }

        if(commentDelId){
          const pid = String(commentDelPostId || "").trim();
          if(!pid) return;

          const me = getUser() || {};
          const meRole = String(me.role || "").trim().toLowerCase();
          const meEmail = String(me.email || "").trim().toLowerCase();

          const map = loadPostComments();
          const comments = getCommentsForPost(pid, map);
          const c = comments.find(x=> String(x?.id || "") === String(commentDelId));
          if(!c){
            window.fwToast?.("Commentaire", "Commentaire introuvable.");
            return;
          }

          const email = String(c?.authorEmail || "").trim().toLowerCase();
          const canDelete = meRole === "admin" || (meEmail && email && meEmail === email);
          if(!canDelete){
            window.fwToast?.("Commentaire", "Tu ne peux pas supprimer ce commentaire.");
            return;
          }

          deleteLocalComment({ postId: pid, commentId: commentDelId });
          const panel = root.querySelector(`[data-comments-panel="${pid}"]`);
          renderLocalCommentsInto(panel, pid);
          setCommentCountEl(root, pid, countCommentsForPost(pid, loadPostComments()));
          window.fwToast?.("Commentaire", "Supprimé.");
          return;
        }

        if(editId){
          const posts = loadPosts();
          const p = posts.find(x=>x.id===editId);
          if(!p){
            window.fwToast?.("Édition", "Publication introuvable.");
            return;
          }
          enterPostEditMode({
            id: p.id,
            title: p.title,
            body: p.body,
            fileUrl: p.fileUrl,
            fileName: p.fileName,
            fileData: p.fileData,
          });
          return;
        }

        if(likeId){
          const posts = loadPosts();
          const idx = posts.findIndex(x=>x.id===likeId);
          if(idx>=0){ posts[idx].likes = (posts[idx].likes||0)+1; savePosts(posts); renderFeed(); window.fwToast?.("Like ajouté","Réaction enregistrée."); }
        }
        if(delId){
          const posts = loadPosts();
          const p = posts.find(x=>x.id===delId);
          if(!p){
            window.fwToast?.("Suppression", "Publication introuvable.");
            return;
          }
          enterPostEditMode({
            id: p.id,
            title: p.title,
            body: p.body,
            fileUrl: p.fileUrl,
            fileName: p.fileName,
            fileData: p.fileData,
          });
          showPostDeleteConfirm();
          return;
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

      root.addEventListener("submit", (e)=>{
        const form = e.target.closest("form[data-comment-form]");
        if(!form) return;
        e.preventDefault();

        const pid = String(form.getAttribute("data-comment-form") || "").trim();
        const input = form.querySelector('textarea[name="comment"]');
        const text = trimCommentText(input?.value || "");
        if(!pid){
          window.fwToast?.("Commentaire", "Publication introuvable.");
          return;
        }
        if(!text){
          window.fwToast?.("Commentaire", "Écris un commentaire.");
          return;
        }

        const c = addLocalComment({ postId: pid, text });
        if(!c){
          window.fwToast?.("Commentaire", "Impossible d'ajouter ce commentaire.");
          return;
        }
        if(input) input.value = "";

        const panel = root.querySelector(`[data-comments-panel="${pid}"]`);
        panel && panel.classList.remove("hidden");
        const btn = root.querySelector(`[data-comment-toggle="${pid}"]`);
        btn && btn.setAttribute("aria-expanded", "true");
        renderLocalCommentsInto(panel, pid);
        setCommentCountEl(root, pid, countCommentsForPost(pid, loadPostComments()));
        window.fwToast?.("Commentaire", "Envoyé.");
      });
    }

    // New post
    const form = $("#newPostForm");
    if(form && !form.__bound){
      form.__bound = true;
      form.addEventListener("submit", async (ev)=>{
        ev.preventDefault();
        const u = getUser() || {name:"Utilisateur", company:"Entreprise", email:""};
        const company = normalizeCompanyForPath(u.company || "Entreprise");
        const editingId = String(form.__editingId || "").trim();
        const title = $("#postTitle").value.trim();
        const body  = $("#postBody").value.trim();
        let fileUrl = $("#postFileUrl")?.value.trim() || "";
        const fileNameInput = $("#postFileName")?.value.trim() || "";
        const selectedFile = form.__selectedFile || null;
        let fileName = fileNameInput;
        if(!fileName && fileUrl){
          try{ fileName = new URL(fileUrl, window.location.href).pathname.split("/").pop() || ""; }catch(e){ /* ignore */ }
        }
        if(!title && !body && !fileUrl && !selectedFile && !editingId){
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
            fileUrl = "";
          }catch(e){
            window.fwToast?.("Erreur","Impossible de lire le fichier.");
            return;
          }
        }

        const posts = loadPosts();
        if(editingId){
          const idx = posts.findIndex(x=>x.id===editingId);
          if(idx < 0){
            exitPostEditMode();
            window.fwToast?.("Édition","Publication introuvable.");
            return;
          }
          const prev = posts[idx] || {};
          const removeFile = !!form.__editingRemoveFile;
          const keepOldFile = !removeFile && !selectedFile && !fileUrl;
          posts[idx] = {
            ...prev,
            title: title || prev.title || "Sans titre",
            body: body || "",
            fileName: removeFile ? "" : (keepOldFile ? (prev.fileName || form.__editingOldFileName || "") : (fileName || "")),
            fileUrl: removeFile ? "" : (keepOldFile ? (prev.fileUrl || form.__editingOldFileUrl || "") : (fileUrl || "")),
            fileData: removeFile ? null : (keepOldFile ? (prev.fileData || form.__editingOldFileData || null) : fileData),
            updatedAt: nowStr(),
          };
          savePosts(posts);
          exitPostEditMode();
          closeComposerModal({ reset:false });
          renderFeed();
          window.fwToast?.("Mis à jour","La publication a été modifiée.");
          return;
        }

        posts.push({
          id: cryptoRandom(),
          author: u.name,
          authorEmail: u.email || "",
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
        exitPostEditMode();
        closeComposerModal({ reset:false });
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
      const canEdit = canDelete;
      const likeCount = Number(p.likes_count || 0);
      const commentCount = Number(p.comments_count || 0);
      const isLiked = likedSet.has(String(p.id));

      const avatarUrl = safeMediaUrl(author.avatar_url);
      const avatarBg = safeAvatarBg(author.avatar_bg, avatarBgFor(name));
      const avatar = avatarUrl
        ? `<div class="avatar" aria-hidden="true"><img src="${escapeHtml(avatarUrl)}" alt=""/></div>`
        : `<div class="avatar" aria-hidden="true" style="background:${escapeHtml(avatarBg)}">${escapeHtml(initials(name))}</div>`;

      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <div class="top">
          <div class="who">
            ${avatar}
            <div class="meta">
              <div class="name">${escapeHtml(name)} <span class="badge" style="margin-left:8px">${escapeHtml(comp)}</span></div>
              <div class="time">${escapeHtml(createdAt)}${attachmentHint({ fileName, fileUrl })}</div>
            </div>
          </div>
          ${canDelete ? `
            <div class="row" style="gap:8px; align-items:center">
              ${canEdit ? `<button class="btn icon ghost" title="Éditer" data-edit="${escapeHtml(p.id)}">✏️</button>` : ""}
              <button class="btn icon ghost" title="Supprimer" data-del="${escapeHtml(p.id)}">🗑️</button>
            </div>
          ` : `<span></span>`}
        </div>
        <h4>${escapeHtml(p.title || "Publication")}</h4>
        ${renderPostAttachmentHtml({ id: p.id, fileUrl, fileName })}
        ${renderPostBodyHtml(p.body)}
        <div class="actions">
          <button class="iconbtn${isLiked ? " active" : ""}" data-like="${escapeHtml(p.id)}" aria-pressed="${isLiked ? "true" : "false"}">❤️ <span>${likeCount}</span></button>
          ${commentActionBtnHtml({ postId: p.id, count: commentCount })}
        </div>
        ${commentPanelHtml({ postId: p.id })}
      `;
      root.appendChild(el);
    });

    void hydrateSbImagePreviews(root);

    if(!root.__sbBound){
      root.__sbBound = true;
      root.addEventListener("click", async (e)=>{
        const commentToggleId = e.target.closest("[data-comment-toggle]")?.getAttribute("data-comment-toggle");
        const commentDelBtn = e.target.closest("[data-comment-del]");
        const commentDelId = commentDelBtn?.getAttribute("data-comment-del");
        const commentDelPostId = commentDelBtn?.getAttribute("data-comment-post");
        const editId = e.target.closest("[data-edit]")?.getAttribute("data-edit");
        const likeBtn = e.target.closest("[data-like]");
        const delId = e.target.closest("[data-del]")?.getAttribute("data-del");
        const openId = e.target.closest("[data-open]")?.getAttribute("data-open");

        if(commentToggleId){
          const pid = String(commentToggleId || "").trim();
          const panel = root.querySelector(`[data-comments-panel="${pid}"]`);
          const btn = e.target.closest("[data-comment-toggle]");
          if(!panel) return;
          const isOpen = !panel.classList.contains("hidden");
          panel.classList.toggle("hidden", isOpen);
          btn?.setAttribute("aria-expanded", isOpen ? "false" : "true");
          if(!isOpen){
            const n = await renderSupabaseCommentsInto(root, pid);
            setCommentCountEl(root, pid, n);
          }
          return;
        }

        if(commentDelId){
          const pid = String(commentDelPostId || "").trim();
          if(!pid) return;
          const uid = await sbUserId();
          if(!uid) return;

          const company = companyFromUser();
          const res = await sb
            .from("post_comments")
            .delete()
            .eq("company", company)
            .eq("id", commentDelId);
          if(res.error){
            sbToastError("Commentaire", res.error);
            return;
          }

          const n = await renderSupabaseCommentsInto(root, pid);
          setCommentCountEl(root, pid, n);
          window.fwToast?.("Commentaire", "Supprimé.");
          return;
        }

        if(editId){
          const company = companyFromUser();
          const res = await sb
            .from("posts")
            .select("id,title,body,file_url,file_name")
            .eq("company", company)
            .eq("id", editId)
            .maybeSingle();
          if(res.error){
            sbToastError("Édition", res.error);
            return;
          }
          const p = res.data || null;
          if(!p){
            window.fwToast?.("Édition", "Publication introuvable.");
            return;
          }
          enterPostEditMode({
            id: p.id,
            title: p.title,
            body: p.body,
            fileUrl: p.file_url,
            fileName: p.file_name,
          });
          return;
        }

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
          const company = companyFromUser();
          const res = await sb
            .from("posts")
            .select("id,title,body,file_url,file_name")
            .eq("company", company)
            .eq("id", delId)
            .maybeSingle();
          if(res.error){
            sbToastError("Suppression", res.error);
            return;
          }
          const p = res.data || null;
          if(!p){
            window.fwToast?.("Suppression", "Publication introuvable.");
            return;
          }
          enterPostEditMode({
            id: p.id,
            title: p.title,
            body: p.body,
            fileUrl: p.file_url,
            fileName: p.file_name,
          });
          showPostDeleteConfirm();
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

      root.addEventListener("submit", async (e)=>{
        const form = e.target.closest("form[data-comment-form]");
        if(!form) return;
        e.preventDefault();

        const pid = String(form.getAttribute("data-comment-form") || "").trim();
        const input = form.querySelector('textarea[name="comment"]');
        const text = trimCommentText(input?.value || "");
        if(!pid){
          window.fwToast?.("Commentaire", "Publication introuvable.");
          return;
        }
        if(!text){
          window.fwToast?.("Commentaire", "Écris un commentaire.");
          return;
        }

        const uid = await sbUserId();
        if(!uid) return;
        const company = companyFromUser();

        const ins = await sb
          .from("post_comments")
          .insert({ company, post_id: pid, user_id: uid, text });
        if(ins.error){
          sbToastError("Commentaire", ins.error);
          return;
        }

        if(input) input.value = "";

        const panel = root.querySelector(`[data-comments-panel="${pid}"]`);
        panel && panel.classList.remove("hidden");
        const btn = root.querySelector(`[data-comment-toggle="${pid}"]`);
        btn && btn.setAttribute("aria-expanded", "true");

        const n = await renderSupabaseCommentsInto(root, pid);
        setCommentCountEl(root, pid, n);
        window.fwToast?.("Commentaire", "Envoyé.");
      });
    }

    const form = $("#newPostForm");
    if(form && !form.__sbBound){
      form.__sbBound = true;
      form.addEventListener("submit", async (ev)=>{
        ev.preventDefault();
        const uid = await sbUserId();
        if(!uid) return;

        const editingId = String(form.__editingId || "").trim();
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
        if(!title && !body && !fileUrl && !selectedFile && !editingId){
          window.fwToast?.("Oups","Écris au moins un titre ou un message.");
          return;
        }

        const company = companyFromUser();
        if(/[\\\/]/.test(company)){
          window.fwToast?.("Entreprise invalide","Évite / ou \\ dans le nom d’entreprise/workspace.");
          return;
        }

        if(editingId){
          const postId = editingId;
          const oldFileUrl = String(form.__editingOldFileUrl || "");
          const removeFile = !!form.__editingRemoveFile || (!selectedFile && !fileUrl && (oldFileUrl || form.__editingOldFileName));

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
          }else if(removeFile){
            fileUrl = "";
            fileName = "";
          }

          window.fwToast?.("Mise à jour","Enregistrement…");
          const res = await sb
            .from("posts")
            .update({
              title: title || "Sans titre",
              body: body || "",
              file_url: fileUrl || "",
              file_name: fileName || "",
            })
            .eq("company", company)
            .eq("id", postId);
          if(res.error){
            // Best-effort cleanup if upload succeeded but update failed.
            if(uploadedPath){
              try{ await sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]); }catch(e){ /* ignore */ }
            }
            sbToastError("Mise à jour", res.error);
            return;
          }

          // Remove the previous Storage file if it has changed / was removed.
          const prevSbUrl = parseSbStorageUrl(oldFileUrl);
          const nextSbUrl = parseSbStorageUrl(fileUrl);
          if(prevSbUrl && (!nextSbUrl || prevSbUrl.bucket !== nextSbUrl.bucket || prevSbUrl.path !== nextSbUrl.path)){
            const rm = await sb.storage.from(prevSbUrl.bucket).remove([prevSbUrl.path]);
            if(rm.error){
              console.warn("Storage remove failed", rm.error);
            }
          }

          exitPostEditMode();
          closeComposerModal({ reset:false });
          await renderFeedSupabase();
          window.fwToast?.("Mis à jour","La publication a été modifiée.");
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

        exitPostEditMode();
        closeComposerModal({ reset:false });
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
  const MESSAGE_REPORTS_KEY = "fwMessageReports_v1";
  function loadMessageReports(){
    try{ return JSON.parse(localStorage.getItem(MESSAGE_REPORTS_KEY) || "{}"); }catch(e){ return {}; }
  }
  function saveMessageReports(r){ localStorage.setItem(MESSAGE_REPORTS_KEY, JSON.stringify(r || {})); }

  function renderChannels(){
    const panel = $("#channelPanel");
    if(!panel) return;

    const channelsMode = String(document.body?.getAttribute("data-channels-mode") || "").trim().toLowerCase();
    const listOnly = channelsMode === "salon";

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
      const callBtn = $("[data-chat-call]", panel);
      const searchBtn = $("[data-chat-search]", panel);
      const infoBtn = $("[data-chat-info]", panel);

      bindChatFileUI(panel);
      callBtn && (callBtn.onclick = ()=> window.fwToast?.("Visio", "Active Supabase pour la visio + partage d’écran."));

      const map = loadChannelMsgs();
      const msgs = map[key] || [];
      msgsRoot.innerHTML = msgs.length ? msgs.map((m,i)=> renderChatMessageHtml(m, u, i)).join("") : emptyChatHtml("Aucun message", "Écris le premier message pour lancer la discussion.");
      msgsRoot.scrollTop = msgsRoot.scrollHeight;

      const btn = document.querySelector(`[data-ch="${key}"]`);
      btn?.querySelector(".badge") && (btn.querySelector(".badge").textContent = String((map[key] || []).length));

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

      msgsRoot && (msgsRoot.onclick = async (e)=>{
        const idxDel = e.target.closest("[data-msg-del]")?.getAttribute("data-msg-del");
        if(idxDel != null){
          if(!isAdmin()){
            window.fwToast?.("Accès refusé","Seul un admin peut supprimer un message.");
            return;
          }
          const i = Number(idxDel);
          if(!Number.isFinite(i)) return;
          const ok = confirm("Supprimer ce message ?");
          if(!ok) return;

          const map = loadChannelMsgs();
          const arr = Array.isArray(map[key]) ? map[key] : [];
          if(!arr[i]) return;
          arr.splice(i, 1);
          map[key] = arr;
          saveChannelMsgs(map);
          window.fwToast?.("Supprimé","Message supprimé.");
          showChannel(key);
          return;
        }

        const idxReport = e.target.closest("[data-msg-report]")?.getAttribute("data-msg-report");
        if(idxReport != null){
          const i = Number(idxReport);
          if(!Number.isFinite(i)) return;
          const m = msgs[i];
          if(!m || m.system) return;

          const reason = prompt("Pourquoi signaler ce message ? (facultatif)", "");
          if(reason === null) return;

          const reports = loadMessageReports();
          const u = getUser() || {};
          const reporter = normalizeEmail(u.email) || String(u.name || "Utilisateur");
          const rid = `channel:${key}:${i}:${reporter}`;
          if(reports[rid]){
            window.fwToast?.("Déjà signalé","Tu as déjà signalé ce message.");
            return;
          }

          reports[rid] = {
            id: rid,
            company: String(u.company || ""),
            kind: "channel",
            channel: key,
            message_index: i,
            message: {
              from: String(m.from || ""),
              text: String(m.text || ""),
              file_url: String(m.fileUrl || m.file_url || ""),
              file_name: String(m.fileName || m.file_name || ""),
              created_at: String(m.at || ""),
            },
            reporter,
            reason: String(reason || "").trim(),
            status: "open",
            created_at: new Date().toISOString(),
          };
          saveMessageReports(reports);
          window.fwToast?.("Signalé","Merci, un admin va vérifier.");
          return;
        }

        const idxRaw = e.target.closest("[data-open-file]")?.getAttribute("data-open-file");
        if(idxRaw == null) return;
        const i = Number(idxRaw);
        const m = msgs[i];
        if(!m) return;
        if(m.fileData?.dataUrl){
          const ok = await openDataUrl(m.fileData.dataUrl);
          if(!ok) window.fwToast?.("Fichier","Impossible d’ouvrir ce fichier.");
          return;
        }
        await openFileFromPost({ fileUrl: m.fileUrl, fileName: m.fileName });
      });

      form && (form.onsubmit = async (ev)=>{
        ev.preventDefault();
        const text = (input?.value || "").trim();
        const selectedFile = form.__selectedFile || null;
        const selectedUrl = form.__selectedUrl || null;
        if(!text && !selectedFile && !selectedUrl) return;

        let fileName = "";
        let fileUrl = "";
        let fileData = null;

        if(selectedUrl?.url){
          fileUrl = String(selectedUrl.url || "");
          fileName = String(selectedUrl.name || "");
        }
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
            fileName = selectedFile.name || "fichier";
          }catch(e){
            window.fwToast?.("Erreur","Impossible de lire le fichier.");
            return;
          }
        }

        const map = loadChannelMsgs();
        map[key] = map[key] || [];
        map[key].push({
          from: u.name || "Moi",
          text,
          fileName,
          fileUrl,
          fileData,
          at: nowStr(),
        });
        saveChannelMsgs(map);
        input.value = "";
        input.style.height = "";
        clearChatSelectedFile(panel);
        showChannel(key);
      });
    }

    let current = localStorage.getItem("fwActiveChannel") || "";
    if(!current || !allKeys.includes(current)) current = allKeys[0] || "";
    if(listOnly){
      document.querySelectorAll("[data-ch]").forEach(x=> x.classList.remove("active"));
      panel.innerHTML = allKeys.length
        ? emptyChatHtml("Salons", "Choisis un salon dans la liste à gauche.")
        : emptyChatHtml("Aucun salon", "Crée un salon pour commencer.");
    }else{
      current ? showChannel(current) : (panel.innerHTML = emptyChatHtml("Aucun canal", "Crée un canal pour commencer."));
    }

    // Sidebar search (optional)
    const search = $("#channelSearch");
    function applySearch(){
      if(!search) return;
      const q = String(search.value || "").trim().toLowerCase();
      $$(".ch-item[data-ch]").forEach((b)=>{
        const text = String(b.textContent || "").toLowerCase();
        b.style.display = !q || text.includes(q) ? "" : "none";
      });
    }
    if(search && !search.__bound){
      search.__bound = true;
      search.addEventListener("input", applySearch);
    }
    applySearch();

    // Create channel (UI if present, otherwise fallback to prompt)
    const createBtn = $("#createChannel");
    const box = $("#channelCreateBox");
    const typeEl = $("#channelType");
    const nameEl = $("#channelName");
    const cancelBtn = $("#channelCreateCancel");
    const submitBtn = $("#channelCreateSubmit");

    function openCreate(){
      if(!box) return false;
      box.classList.remove("hidden");
      setTimeout(()=> nameEl?.focus?.(), 0);
      return true;
    }
    function closeCreate(){
      if(!box) return;
      box.classList.add("hidden");
      if(nameEl) nameEl.value = "";
      if(typeEl) typeEl.value = "public";
    }

    if(createBtn && !createBtn.__bound){
      createBtn.__bound = true;
      createBtn.addEventListener("click", ()=>{
        if(openCreate()) return;
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
    if(cancelBtn && !cancelBtn.__bound){
      cancelBtn.__bound = true;
      cancelBtn.addEventListener("click", ()=> closeCreate());
    }
    if(submitBtn && !submitBtn.__bound){
      submitBtn.__bound = true;
      submitBtn.addEventListener("click", ()=>{
        const type = String(typeEl?.value || "public").trim().toLowerCase();
        const name = String(nameEl?.value || "").trim().toLowerCase();
        if(!name){
          window.fwToast?.("Nom requis","Entre un nom de canal (ex: general).");
          nameEl?.focus?.();
          return;
        }
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
        closeCreate();
        renderChannels();
        window.fwToast?.("Canal créé", `#${name} ajouté.`);
      });
    }
    if(nameEl && !nameEl.__bound){
      nameEl.__bound = true;
      nameEl.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
          e.preventDefault();
          submitBtn?.click?.();
        }
        if(e.key === "Escape"){
          e.preventDefault();
          closeCreate();
        }
      });
    }
  }

  async function renderChannelsSupabase(){
    const panel = $("#channelPanel");
    if(!panel) return;

    const channelsMode = String(document.body?.getAttribute("data-channels-mode") || "").trim().toLowerCase();
    const listOnly = channelsMode === "salon";

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
      const url = safeMediaUrl(u.avatarUrl);
      const style = ` style="background:${escapeHtml(safeAvatarBg(u.avatarBg, avatarBgFor(u.name)))}"`;
      if(url) return `<div class="${cls}"><img src="${escapeHtml(url)}" alt=""/></div>`;
      return `<div class="${cls}"${style}>${escapeHtml(initials(u.name))}</div>`;
    }
    function renderSbChatMessageHtml(row, profile){
      const r = row || {};
      const p = profile || {};
      const name = String(p.name || "Utilisateur");
      const time = fmtTime(r.created_at);
      const text = String(r.text || "");
      const canDelete = isAdmin();
      const fileUrl = String(r.file_url || "");
      const fileName = String(r.file_name || "");
      const hasFile = !!(fileUrl || fileName);
      const fileLabel = fileName || (fileUrl ? (fileUrl.split("/").pop() || "Fichier") : "Fichier");
      const isImg = hasFile && isProbablyImageAttachment({ fileName, fileUrl });
      const imgSrc = isImg ? attachmentImgSrc({ fileUrl }) : "";
      const sbUrl = (isImg && !imgSrc) ? parseSbStorageUrl(fileUrl) : null;
      const canPreview = isImg && (!!imgSrc || !!sbUrl);
      return `
        <div class="msg">
          ${msgAvatarHtml(p, "avatar msg-avatar")}
          <div class="msg-body">
            <div class="msg-head">
              <span class="msg-name">${escapeHtml(name)}</span>
              <span class="msg-time">${escapeHtml(time)}</span>
              <button class="btn small ghost" type="button" title="Signaler" aria-label="Signaler" data-msg-report="${escapeHtml(String(r.id || ""))}">🚩</button>
              ${canDelete ? `<button class="btn small ghost" type="button" title="Supprimer" aria-label="Supprimer" data-msg-del="${escapeHtml(String(r.id || ""))}">🗑️</button>` : ""}
            </div>
            ${text ? `<div class="msg-text">${escapeHtml(text)}</div>` : ""}
            ${hasFile ? (canPreview ? `
              <button class="media-box msg-file" type="button" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}">
                <img
                  class="media-img"
                  alt=""
                  loading="lazy"
                  src="${escapeHtml(imgSrc || FEED_IMG_PLACEHOLDER)}"
                  ${sbUrl ? `data-sb-bucket="${escapeHtml(sbUrl.bucket)}" data-sb-path="${escapeHtml(sbUrl.path)}"` : ""}
                />
                <div class="media-bar">
                  <div class="media-name">${escapeHtml(fileLabel || "Image")}</div>
                  <span class="badge">Ouvrir</span>
                </div>
              </button>
            ` : `
              <button class="file-box msg-file" type="button" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}">
                <div class="file-left">
                  <div class="file-ico" aria-hidden="true">📄</div>
                  <div class="file-meta">
                    <div class="file-title">Ouvrir le fichier</div>
                    <div class="file-sub">${escapeHtml(fileLabel)}</div>
                  </div>
                </div>
                <span class="badge">Ouvrir</span>
              </button>
            `) : ""}
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
      const callBtn = $("[data-chat-call]", panel);
      const searchBtn = $("[data-chat-search]", panel);
      const infoBtn = $("[data-chat-info]", panel);

      bindChatFileUI(panel);
      callBtn && (callBtn.onclick = ()=> window.fwCall?.join?.({
        roomId: `${company}::channel::${String(ch.id)}`,
        title: `Visio • ${icon === "#" ? "#" : ""}${name}`,
      }));

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
      void hydrateSbImagePreviews(msgsRoot);

      msgsRoot && (msgsRoot.onclick = async (e)=>{
        const reportId = e.target.closest("[data-msg-report]")?.getAttribute("data-msg-report") || "";
        if(reportId){
          const reason = prompt("Pourquoi signaler ce message ? (facultatif)", "");
          if(reason === null) return;

          const ins = await sb.from("message_reports").insert({
            company,
            kind: "channel",
            channel_id: ch.id,
            message_id: reportId,
            reporter_id: uid,
            reason: String(reason || "").trim(),
          });

          if(ins.error){
            const code = String(ins.error.code || "");
            const msg = String(ins.error.message || "");
            if(code === "23505" || msg.toLowerCase().includes("duplicate")){
              window.fwToast?.("Déjà signalé","Tu as déjà signalé ce message.");
              return;
            }
            sbToastError("Signalement", ins.error);
            return;
          }

          window.fwToast?.("Signalé","Merci, un admin va vérifier.");
          return;
        }

        const delId = e.target.closest("[data-msg-del]")?.getAttribute("data-msg-del") || "";
        if(delId){
          if(!isAdmin()){
            window.fwToast?.("Accès refusé","Seul un admin peut supprimer un message.");
            return;
          }
          const ok = confirm("Supprimer ce message ?");
          if(!ok) return;

          const del = await sb
            .from("channel_messages")
            .delete()
            .eq("company", company)
            .eq("id", delId);

          if(del.error){
            sbToastError("Suppression", del.error);
            return;
          }

          // Best-effort badge update (UI)
          const badge = document.querySelector(`[data-ch-id="${String(ch.id)}"] .badge`);
          if(badge){
            const n = Number(badge.textContent || "0");
            if(Number.isFinite(n)) badge.textContent = String(Math.max(n - 1, 0));
          }

          window.fwToast?.("Supprimé","Message supprimé.");
          await showChannel(ch);
          return;
        }

        const btn = e.target.closest("[data-file-url]");
        if(!btn) return;
        const fileUrl = btn.getAttribute("data-file-url") || "";
        const fileName = btn.getAttribute("data-file-name") || "";
        await openFileFromPost({ fileUrl, fileName });
      });

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
        const selectedFile = form.__selectedFile || null;
        const selectedUrl = form.__selectedUrl || null;
        if(!text && !selectedFile && !selectedUrl) return;

        let fileUrl = "";
        let fileName = "";
        let uploadedPath = "";

        if(selectedUrl?.url && !selectedFile){
          fileUrl = String(selectedUrl.url || "");
          fileName = String(selectedUrl.name || "");
        }

        if(selectedFile){
          if(/[\\\/]/.test(company)){
            window.fwToast?.("Entreprise invalide","Évite / ou \\ dans le nom d’entreprise/workspace.");
            return;
          }
          const safeName = safeFileName(selectedFile.name);
          const msgId = uuid();
          uploadedPath = `${company}/channels/${String(ch.id)}/${msgId}/${safeName}`;

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
          fileName = String(selectedFile.name || safeName);
        }

        const res = await sb.from("channel_messages").insert({
          company,
          channel_id: ch.id,
          user_id: uid,
          text: text || "",
          file_url: fileUrl,
          file_name: fileName,
        });
        if(res.error){
          if(uploadedPath){
            try{ await sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]); }catch(e){ /* ignore */ }
          }
          sbToastError("Message", res.error);
          return;
        }

        const badge = document.querySelector(`[data-ch-id="${String(ch.id)}"] .badge`);
        if(badge){
          const n = Number(badge.textContent || "0");
          if(Number.isFinite(n)) badge.textContent = String(n + 1);
        }

        input.value = "";
        input.style.height = "";
        clearChatSelectedFile(panel);
        await showChannel(ch);
      });
    }

    let current = localStorage.getItem("fwActiveChannelId") || "";
    if(!current || !allIds.includes(String(current))) current = allIds[0] || "";
    if(listOnly){
      document.querySelectorAll("[data-ch-id]").forEach(x=> x.classList.remove("active"));
      panel.innerHTML = channels.length
        ? emptyChatHtml("Salons", "Choisis un salon dans la liste à gauche.")
        : emptyChatHtml("Aucun salon", "Crée un salon pour commencer.");
    }else{
      if(current){
        const ch = channels.find(x=> String(x.id) === String(current)) || channels[0];
        await showChannel(ch);
      }else{
        panel.innerHTML = emptyChatHtml("Aucun canal", "Crée un canal pour commencer.");
      }
    }

    // Sidebar search (optional)
    const search = $("#channelSearch");
    function applySearch(){
      if(!search) return;
      const q = String(search.value || "").trim().toLowerCase();
      $$(".ch-item[data-ch-id]").forEach((b)=>{
        const text = String(b.textContent || "").toLowerCase();
        b.style.display = !q || text.includes(q) ? "" : "none";
      });
    }
    if(search && !search.__sbBound){
      search.__sbBound = true;
      search.addEventListener("input", applySearch);
    }
    applySearch();

    const createBtn = $("#createChannel");
    const box = $("#channelCreateBox");
    const typeEl = $("#channelType");
    const nameEl = $("#channelName");
    const cancelBtn = $("#channelCreateCancel");
    const submitBtn = $("#channelCreateSubmit");

    function openCreate(){
      if(!box) return false;
      box.classList.remove("hidden");
      setTimeout(()=> nameEl?.focus?.(), 0);
      return true;
    }
    function closeCreate(){
      if(!box) return;
      box.classList.add("hidden");
      if(nameEl) nameEl.value = "";
      if(typeEl) typeEl.value = "public";
    }

    if(createBtn && !createBtn.__sbBound){
      createBtn.__sbBound = true;
      createBtn.addEventListener("click", async ()=>{
        if(meRole !== "admin"){
          window.fwToast?.("Accès refusé","Seul un admin peut créer des canaux.");
          return;
        }
        if(openCreate()) return;
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

    if(cancelBtn && !cancelBtn.__sbBound){
      cancelBtn.__sbBound = true;
      cancelBtn.addEventListener("click", ()=> closeCreate());
    }

    if(submitBtn && !submitBtn.__sbBound){
      submitBtn.__sbBound = true;
      submitBtn.addEventListener("click", async ()=>{
        if(meRole !== "admin"){
          window.fwToast?.("Accès refusé","Seul un admin peut créer des canaux.");
          return;
        }
        const type = String(typeEl?.value || "public").trim().toLowerCase();
        const name = String(nameEl?.value || "").trim().toLowerCase();
        if(!name){
          window.fwToast?.("Nom requis","Entre un nom de canal (ex: general).");
          nameEl?.focus?.();
          return;
        }
        const map = {public:"public", private:"private", voice:"voice"};
        const k = map[type] || "public";
        const res = await sb.from("channels").insert({ company, type: k, name }).select("*").single();
        if(res.error){
          sbToastError("Canal", res.error);
          return;
        }
        localStorage.setItem("fwActiveChannelId", String(res.data?.id || ""));
        closeCreate();
        await renderChannelsSupabase();
        window.fwToast?.("Canal créé", `#${name} ajouté.`);
      });
    }

    if(nameEl && !nameEl.__sbBound){
      nameEl.__sbBound = true;
      nameEl.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
          e.preventDefault();
          submitBtn?.click?.();
        }
        if(e.key === "Escape"){
          e.preventDefault();
          closeCreate();
        }
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
      const callBtn = $("[data-chat-call]", convo);
      const searchBtn = $("[data-chat-search]", convo);
      const infoBtn = $("[data-chat-info]", convo);

      bindChatFileUI(convo);
      callBtn && (callBtn.onclick = ()=> window.fwToast?.("Visio", "Active Supabase pour la visio + partage d’écran."));

      const dms = loadDMs();
      const msgs = dms[name] || [];
      dmMsgs.innerHTML = msgs.length ? msgs.map((m,i)=> renderChatMessageHtml(m, u, i)).join("") : emptyChatHtml("Aucun message", "Envoie le premier message.");
      dmMsgs.scrollTop = dmMsgs.scrollHeight;

      const btn = document.querySelector(`[data-dm="${name}"]`);
      btn?.querySelector(".badge") && (btn.querySelector(".badge").textContent = String(msgs.length));

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

      dmMsgs && (dmMsgs.onclick = async (e)=>{
        const idxDel = e.target.closest("[data-msg-del]")?.getAttribute("data-msg-del");
        if(idxDel != null){
          if(!isAdmin()){
            window.fwToast?.("Accès refusé","Seul un admin peut supprimer un message.");
            return;
          }
          const i = Number(idxDel);
          if(!Number.isFinite(i)) return;
          const ok = confirm("Supprimer ce message ?");
          if(!ok) return;

          const dms = loadDMs();
          const arr = Array.isArray(dms[name]) ? dms[name] : [];
          if(!arr[i]) return;
          arr.splice(i, 1);
          dms[name] = arr;
          saveDMs(dms);
          window.fwToast?.("Supprimé","Message supprimé.");
          showDM(name);
          return;
        }

        const idxReport = e.target.closest("[data-msg-report]")?.getAttribute("data-msg-report");
        if(idxReport != null){
          const i = Number(idxReport);
          if(!Number.isFinite(i)) return;
          const m = msgs[i];
          if(!m || m.system) return;

          const reason = prompt("Pourquoi signaler ce message ? (facultatif)", "");
          if(reason === null) return;

          const reports = loadMessageReports();
          const u = getUser() || {};
          const reporter = normalizeEmail(u.email) || String(u.name || "Utilisateur");
          const rid = `dm:${name}:${i}:${reporter}`;
          if(reports[rid]){
            window.fwToast?.("Déjà signalé","Tu as déjà signalé ce message.");
            return;
          }

          reports[rid] = {
            id: rid,
            company: String(u.company || ""),
            kind: "dm",
            thread: String(name || ""),
            message_index: i,
            message: {
              from: String(m.from || ""),
              text: String(m.text || ""),
              file_url: String(m.fileUrl || m.file_url || ""),
              file_name: String(m.fileName || m.file_name || ""),
              created_at: String(m.at || ""),
            },
            reporter,
            reason: String(reason || "").trim(),
            status: "open",
            created_at: new Date().toISOString(),
          };
          saveMessageReports(reports);
          window.fwToast?.("Signalé","Merci, un admin va vérifier.");
          return;
        }

        const idxRaw = e.target.closest("[data-open-file]")?.getAttribute("data-open-file");
        if(idxRaw == null) return;
        const i = Number(idxRaw);
        const m = msgs[i];
        if(!m) return;
        if(m.fileData?.dataUrl){
          const ok = await openDataUrl(m.fileData.dataUrl);
          if(!ok) window.fwToast?.("Fichier","Impossible d’ouvrir ce fichier.");
          return;
        }
        await openFileFromPost({ fileUrl: m.fileUrl, fileName: m.fileName });
      });

      form && (form.onsubmit = async (ev)=>{
        ev.preventDefault();
        const text = (input?.value || "").trim();
        const selectedFile = form.__selectedFile || null;
        const selectedUrl = form.__selectedUrl || null;
        if(!text && !selectedFile && !selectedUrl) return;

        let fileName = "";
        let fileUrl = "";
        let fileData = null;

        if(selectedUrl?.url){
          fileUrl = String(selectedUrl.url || "");
          fileName = String(selectedUrl.name || "");
        }
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
            fileName = selectedFile.name || "fichier";
          }catch(e){
            window.fwToast?.("Erreur","Impossible de lire le fichier.");
            return;
          }
        }

        const dms = loadDMs();
        dms[name] = dms[name] || [];
        dms[name].push({
          from: u.name || "Moi",
          text,
          fileName,
          fileUrl,
          fileData,
          at: nowStr(),
        });
        saveDMs(dms);
        input.value = "";
        input.style.height = "";
        clearChatSelectedFile(convo);
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
      const url = safeMediaUrl(u.avatarUrl);
      const style = ` style="background:${escapeHtml(safeAvatarBg(u.avatarBg, avatarBgFor(u.name)))}"`;
      if(url) return `<div class="${cls}"><img src="${escapeHtml(url)}" alt=""/></div>`;
      return `<div class="${cls}"${style}>${escapeHtml(initials(u.name))}</div>`;
    }
    function renderSbChatMessageHtml(row, profile){
      const r = row || {};
      const p = profile || {};
      const name = String(p.name || "Utilisateur");
      const time = fmtTime(r.created_at);
      const text = String(r.text || "");
      const fileUrl = String(r.file_url || "");
      const fileName = String(r.file_name || "");
      const hasFile = !!(fileUrl || fileName);
      const fileLabel = fileName || (fileUrl ? (fileUrl.split("/").pop() || "Fichier") : "Fichier");
      const isImg = hasFile && isProbablyImageAttachment({ fileName, fileUrl });
      const imgSrc = isImg ? attachmentImgSrc({ fileUrl }) : "";
      const sbUrl = (isImg && !imgSrc) ? parseSbStorageUrl(fileUrl) : null;
      const canPreview = isImg && (!!imgSrc || !!sbUrl);
      return `
        <div class="msg">
          ${msgAvatarHtml(p, "avatar msg-avatar")}
          <div class="msg-body">
            <div class="msg-head">
              <span class="msg-name">${escapeHtml(name)}</span>
              <span class="msg-time">${escapeHtml(time)}</span>
              <button class="btn small ghost" type="button" title="Signaler" aria-label="Signaler" data-msg-report="${escapeHtml(String(r.id || ""))}">🚩</button>
            </div>
            ${text ? `<div class="msg-text">${escapeHtml(text)}</div>` : ""}
            ${hasFile ? (canPreview ? `
              <button class="media-box msg-file" type="button" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}">
                <img
                  class="media-img"
                  alt=""
                  loading="lazy"
                  src="${escapeHtml(imgSrc || FEED_IMG_PLACEHOLDER)}"
                  ${sbUrl ? `data-sb-bucket="${escapeHtml(sbUrl.bucket)}" data-sb-path="${escapeHtml(sbUrl.path)}"` : ""}
                />
                <div class="media-bar">
                  <div class="media-name">${escapeHtml(fileLabel || "Image")}</div>
                  <span class="badge">Ouvrir</span>
                </div>
              </button>
            ` : `
              <button class="file-box msg-file" type="button" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}">
                <div class="file-left">
                  <div class="file-ico" aria-hidden="true">📄</div>
                  <div class="file-meta">
                    <div class="file-title">Ouvrir le fichier</div>
                    <div class="file-sub">${escapeHtml(fileLabel)}</div>
                  </div>
                </div>
                <span class="badge">Ouvrir</span>
              </button>
            `) : ""}
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
      const callBtn = $("[data-chat-call]", convo);
      const searchBtn = $("[data-chat-search]", convo);
      const infoBtn = $("[data-chat-info]", convo);

      bindChatFileUI(convo);
      callBtn && (callBtn.onclick = ()=> window.fwCall?.join?.({
        roomId: `${company}::dm::${String(t.id)}`,
        title: `Visio • @${other.name || "contact"}`,
      }));

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
      void hydrateSbImagePreviews(dmMsgs);

      dmMsgs && (dmMsgs.onclick = async (e)=>{
        const reportId = e.target.closest("[data-msg-report]")?.getAttribute("data-msg-report") || "";
        if(reportId){
          const reason = prompt("Pourquoi signaler ce message ? (facultatif)", "");
          if(reason === null) return;

          const ins = await sb.from("message_reports").insert({
            company,
            kind: "dm",
            thread_id: t.id,
            message_id: reportId,
            reporter_id: uid,
            reason: String(reason || "").trim(),
          });

          if(ins.error){
            const code = String(ins.error.code || "");
            const msg = String(ins.error.message || "");
            if(code === "23505" || msg.toLowerCase().includes("duplicate")){
              window.fwToast?.("Déjà signalé","Tu as déjà signalé ce message.");
              return;
            }
            sbToastError("Signalement", ins.error);
            return;
          }

          window.fwToast?.("Signalé","Merci, un admin va vérifier.");
          return;
        }
        const btn = e.target.closest("[data-file-url]");
        if(!btn) return;
        const fileUrl = btn.getAttribute("data-file-url") || "";
        const fileName = btn.getAttribute("data-file-name") || "";
        await openFileFromPost({ fileUrl, fileName });
      });

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
        const selectedFile = form.__selectedFile || null;
        const selectedUrl = form.__selectedUrl || null;
        if(!text && !selectedFile && !selectedUrl) return;

        let fileUrl = "";
        let fileName = "";
        let uploadedPath = "";

        if(selectedUrl?.url && !selectedFile){
          fileUrl = String(selectedUrl.url || "");
          fileName = String(selectedUrl.name || "");
        }

        if(selectedFile){
          if(/[\\\/]/.test(company)){
            window.fwToast?.("Entreprise invalide","Évite / ou \\ dans le nom d’entreprise/workspace.");
            return;
          }
          const safeName = safeFileName(selectedFile.name);
          const msgId = uuid();
          uploadedPath = `${company}/dms/${String(t.id)}/${msgId}/${safeName}`;

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
          fileName = String(selectedFile.name || safeName);
        }

        const res = await sb.from("dm_messages").insert({
          company,
          thread_id: t.id,
          sender_id: uid,
          text: text || "",
          file_url: fileUrl,
          file_name: fileName,
        });
        if(res.error){
          if(uploadedPath){
            try{ await sb.storage.from(STORAGE_BUCKET).remove([uploadedPath]); }catch(e){ /* ignore */ }
          }
          sbToastError("DM", res.error);
          return;
        }
        input.value = "";
        input.style.height = "";
        clearChatSelectedFile(convo);
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
        const raw = urlInput.value.trim();
        const url = raw ? safeMediaUrl(raw) : "";
        if(raw && !url){
          urlInput.value = "";
          window.fwToast?.("Avatar","URL refusée. Utilise une image http(s), blob ou data:image.");
          return;
        }
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
      if(patch && Object.prototype.hasOwnProperty.call(patch, "avatarUrl")) payload.avatar_url = patch.avatarUrl ? safeMediaUrl(patch.avatarUrl) : "";
      if(patch && Object.prototype.hasOwnProperty.call(patch, "avatarBg")) payload.avatar_bg = safeAvatarBg(patch.avatarBg);

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
        const raw = urlInput.value.trim();
        const url = raw ? safeMediaUrl(raw) : "";
        if(raw && !url){
          urlInput.value = "";
          window.fwToast?.("Avatar","URL refusée. Utilise une image http(s), blob ou data:image.");
          return;
        }
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

  // ---------- LEARNING (exercices / tutoriels)
  const LEARNING_LS_KEY = "fwLearningItems_v1";
  const LEARNING_TABLE = "learning_items";

  function loadLearningItemsLocal(){
    try{
      const v = JSON.parse(localStorage.getItem(LEARNING_LS_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    }catch(e){
      return [];
    }
  }

  function saveLearningItemsLocal(items){
    try{
      localStorage.setItem(LEARNING_LS_KEY, JSON.stringify(items || []));
    }catch(e){ /* ignore */ }
  }

  function normalizeLearnKind(raw){
    const s = String(raw || "").trim().toLowerCase();
    return s === "tutorial" ? "tutorial" : "exercise";
  }
  function normalizeLearnLang(raw){
    const s = String(raw || "").trim().toLowerCase();
    return ["html","css","js","sql","php"].includes(s) ? s : "html";
  }
  function normalizeLearnDifficulty(raw){
    const s = String(raw || "").trim().toLowerCase();
    if(["beginner","debutant","débutant","easy","facile","1"].includes(s)) return "beginner";
    if(["intermediate","intermediaire","intermédiaire","medium","moyen","2"].includes(s)) return "intermediate";
    if(["advanced","avance","avancé","hard","difficile","expert","3"].includes(s)) return "advanced";
    return "beginner";
  }

  function learnLangLabel(lang){
    const l = normalizeLearnLang(lang);
    if(l === "js") return "JavaScript";
    return l.toUpperCase();
  }
  function learnLangIcon(lang){
    const l = normalizeLearnLang(lang);
    if(l === "html") return "</>";
    if(l === "css") return "CSS";
    if(l === "js") return "JS";
    if(l === "sql") return "SQL";
    if(l === "php") return "PHP";
    return "</>";
  }
  function learnKindLabel(kind){
    return normalizeLearnKind(kind) === "tutorial" ? "Tutoriel" : "Exercice";
  }
  function learnDifficultyLabel(diff){
    const d = normalizeLearnDifficulty(diff);
    if(d === "intermediate") return "Intermédiaire";
    if(d === "advanced") return "Avancé";
    return "Débutant";
  }

  function seedLearningItemsIfEmpty(){
    const existing = loadLearningItemsLocal();
    const company = companyFromUser();
    const key = (kind, lang, title)=> `${normalizeLearnKind(kind)}|${normalizeLearnLang(lang)}|${String(title || "").trim().toLowerCase()}`;
    const existingKeys = new Set(
      (existing || [])
        .filter(x=> String(x?.company || "") === company)
        .map(x=> key(x?.kind, x?.lang, x?.title))
    );

    const templates = getLearningExampleTemplates();
    const nowIso = new Date().toISOString();
    const toAdd = (templates || [])
      .filter(t=> !existingKeys.has(key(t?.kind, t?.lang, t?.title)))
      .map(t=>({
        id: uuid(),
        company,
        author_id: "local",
        kind: normalizeLearnKind(t?.kind),
        lang: normalizeLearnLang(t?.lang),
        difficulty: normalizeLearnDifficulty(t?.difficulty),
        title: String(t?.title || "").trim() || "Sans titre",
        prompt: String(t?.prompt || ""),
        answer: String(t?.answer || ""),
        created_at: nowIso,
        updated_at: nowIso,
      }));

    if(!toAdd.length) return existing;

    const merged = [...existing, ...toAdd];
    saveLearningItemsLocal(merged);
    return merged;
  }

  async function fetchLearningItemsAnyMode(){
    const company = companyFromUser();

    if(!sbEnabled){
      const all = seedLearningItemsIfEmpty();
      return { modeLabel: "Démo locale", items: (all || []).filter(x=> String(x?.company || "") === company), needsAuth:false };
    }

    const uid = await sbUserId();
    if(!uid){
      return { modeLabel: "Supabase • Non connecté", items: [], needsAuth:true };
    }

    const baseQuery = (selectStr)=> sb
      .from(LEARNING_TABLE)
      .select(selectStr)
      .eq("company", company)
      .order("created_at", { ascending: false });

    const selectNoDiff = "id,company,author_id,kind,lang,title,prompt,answer,created_at,updated_at";
    let res = await baseQuery(`${selectNoDiff},difficulty`);

    if(res.error){
      const code = String(res.error?.code || "");
      const msg = String(res.error?.message || "").toLowerCase();
      const missingDifficulty = (code === "42703") || (msg.includes("difficulty") && msg.includes("does not exist"));
      if(missingDifficulty){
        res = await baseQuery(selectNoDiff);
      }
    }

    if(res.error){
      const code = String(res.error?.code || "");
      const msg = String(res.error?.message || "");
      if(code === "42P01" || msg.toLowerCase().includes("does not exist")){
        const all = seedLearningItemsIfEmpty();
        return { modeLabel: "Supabase • Table manquante (fallback local)", items: (all || []).filter(x=> String(x?.company || "") === company), needsAuth:false, missingTable:true };
      }
      sbToastError("Exercices", res.error);
      return { modeLabel: "Supabase • Erreur", items: [], needsAuth:false };
    }

    const items = (res.data || []).map(x=> ({ ...x, difficulty: normalizeLearnDifficulty(x?.difficulty) }));
    return { modeLabel: "Supabase", items, needsAuth:false };
  }

  function nl2brEscaped(raw){
    return escapeHtml(String(raw || "")).replace(/\n/g, "<br/>");
  }

  function looksLikeHtml(code){
    const t = String(code || "").trim();
    if(!t) return false;
    const lower = t.toLowerCase();
    if(lower.startsWith("<!doctype html")) return true;
    if(lower.startsWith("<html")) return true;
    if(lower.includes("<head") || lower.includes("<body")) return true;
    if(lower.startsWith("<") && /<\/[a-z][^>]*>/i.test(t)) return true;
    return false;
  }

  function guessPreviewBaseHref(html){
    let root = "";
    try{ root = new URL(".", window.location.href).href; }catch(e){ root = ""; }
    if(!root) return "";

    const s = String(html || "");
    if(/\b(?:href|src)\s*=\s*['"]\.\.\//i.test(s)){
      try{ return new URL("guides/", root).href; }catch(e){ return root; }
    }
    return root;
  }

  function injectBaseIntoHtmlDoc(html, baseHref){
    const s = String(html || "").trim();
    if(!s) return "";
    if(/<base\b/i.test(s)) return s;

    const base = String(baseHref || "").trim();
    const baseTag = base ? `<base href="${escapeHtml(base)}">` : "";
    if(!baseTag) return s;

    if(/<head\b[^>]*>/i.test(s)){
      return s.replace(/<head\b[^>]*>/i, (m)=> `${m}\n  ${baseTag}`);
    }

    if(/<html\b[^>]*>/i.test(s)){
      return s.replace(/<html\b[^>]*>/i, (m)=> `${m}\n<head>\n  <meta charset="utf-8"/>\n  <meta name="viewport" content="width=device-width,initial-scale=1"/>\n  ${baseTag}\n</head>`);
    }

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  ${baseTag}
</head>
<body>
${s}
</body>
</html>`;
  }

  function buildPreviewSrcdoc(html){
    const baseHref = guessPreviewBaseHref(html);
    return injectBaseIntoHtmlDoc(html, baseHref);
  }

  let __fwLearnPreview = null;
  function ensureLearnPreviewModal(){
    if(__fwLearnPreview) return __fwLearnPreview;

    const overlay = document.createElement("div");
    overlay.className = "preview-overlay hidden";
    overlay.innerHTML = `
      <div class="card preview-modal" role="dialog" aria-modal="true" aria-label="Prévisualisation">
        <div class="preview-header">
          <div class="preview-head-left">
            <div class="preview-title">Prévisualisation</div>
            <div class="preview-sub" data-preview-sub>HTML</div>
          </div>
          <div class="row" style="gap:8px; align-items:center">
            <button class="btn small" type="button" data-preview-close>Fermer</button>
          </div>
        </div>
        <div class="preview-body">
          <iframe class="preview-frame" title="Prévisualisation" sandbox="" referrerpolicy="no-referrer"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const frame = overlay.querySelector("iframe");
    const sub = overlay.querySelector("[data-preview-sub]");
    const closeBtn = overlay.querySelector("[data-preview-close]");

    const state = { overlay, frame, sub, closeBtn, prevOverflow:"" };
    function close(){
      overlay.classList.add("hidden");
      frame && frame.removeAttribute("srcdoc");
      try{ document.body.style.overflow = state.prevOverflow; }catch(e){ /* ignore */ }
    }
    closeBtn?.addEventListener("click", close);
    overlay.addEventListener("click", (e)=>{ if(e.target === overlay) close(); });
    document.addEventListener("keydown", (e)=>{
      if(e.key !== "Escape") return;
      if(overlay.classList.contains("hidden")) return;
      close();
    });

    state.close = close;
    __fwLearnPreview = state;
    return state;
  }

  function openLearnHtmlPreview(raw){
    const code = String(raw || "").trim();
    if(!code){
      window.fwToast?.("Prévisualiser", "Aucun code à afficher.");
      return;
    }
    if(!looksLikeHtml(code)){
      window.fwToast?.("Prévisualiser", "Ajoute une page HTML pour utiliser l’aperçu.");
      return;
    }

    const modal = ensureLearnPreviewModal();
    if(!modal?.overlay || !modal?.frame) return;

    try{
      const opening = modal.overlay.classList.contains("hidden");
      if(opening){
        modal.prevOverflow = document.body.style.overflow ?? "";
        document.body.style.overflow = "hidden";
      }
    }catch(e){ /* ignore */ }

    modal.sub && (modal.sub.textContent = "HTML • aperçu (sandbox)");
    modal.frame.setAttribute("srcdoc", buildPreviewSrcdoc(code));
    modal.overlay.classList.remove("hidden");
  }

  function renderLearningItemHtml(item){
    const it = item || {};
    const kind = normalizeLearnKind(it.kind);
    const lang = normalizeLearnLang(it.lang);
    const diff = normalizeLearnDifficulty(it.difficulty);
    const title = String(it.title || "").trim() || "Sans titre";
    const prompt = String(it.prompt || "").trim();
    const answer = String(it.answer || "").trim();
    const created = it.created_at || it.createdAt || "";

    const preId = `learn-ans-${String(it.id || uuid())}`;
    const canPreview = (lang === "html") && looksLikeHtml(answer);

    const meta = [
      learnKindLabel(kind),
      learnLangLabel(lang),
      kind === "exercise" ? learnDifficultyLabel(diff) : "",
      created ? fmtTs(created) : "",
    ].filter(Boolean).join(" • ");

    const isExercise = kind === "exercise";
    const promptFirstParagraph = (prompt ? String(prompt.split(/\n\s*\n/)[0] || "").trim() : "");
    const questionSummary = isExercise
      ? ((promptFirstParagraph ? promptFirstParagraph.replace(/\s+/g, " ").trim() : "") || title)
      : title;

    const exerciseMeta = [
      (prompt && title && title !== questionSummary) ? title : "",
      learnLangLabel(lang),
      learnDifficultyLabel(diff),
      created ? fmtTs(created) : "",
    ].filter(Boolean).join(" • ");

    return `
      <details class="tut-details" data-learn-item="${escapeHtml(String(it.id || ""))}" data-learn-kind="${escapeHtml(kind)}">
        <summary class="tut-summary">
          <span class="tut-left">
            <span class="tut-ico" aria-hidden="true">${escapeHtml(learnLangIcon(lang))}</span>
            <span class="tut-txt">
              ${isExercise ? `
                <span class="tut-question">${escapeHtml(questionSummary)}</span>
                <span class="tut-meta truncate">${escapeHtml(exerciseMeta || meta)}</span>
              ` : `
                <span class="tut-title truncate">${escapeHtml(title)}</span>
                <span class="tut-meta truncate">${escapeHtml(meta)}</span>
              `}
            </span>
          </span>
          <span class="badge">${kind === "tutorial" ? "Voir" : "Réponse"}</span>
        </summary>
        <div class="tut-body">
          ${prompt ? `
            <div class="callout" style="margin:0">
              <strong>Consigne :</strong><br/>
              ${nl2brEscaped(prompt)}
            </div>
            <div class="spacer" style="height:12px"></div>
          ` : ""}

          ${isExercise ? `
            <div class="row" style="gap:8px; flex-wrap:wrap">
              <button class="btn small" type="button" data-ai-help>🤖 Aide IA</button>
            </div>
            <div class="spacer" style="height:12px"></div>
          ` : ""}

          ${answer ? `
            <div class="codeblock">
              <div class="codebar">
                <span>Réponse</span>
                <div class="row" style="gap:8px; align-items:center">
                  ${canPreview ? `<button class="btn small" type="button" data-preview="#${escapeHtml(preId)}">Prévisualiser</button>` : ""}
                  <button class="btn small" type="button" data-copy="#${escapeHtml(preId)}">Copier</button>
                </div>
              </div>
              <pre id="${escapeHtml(preId)}">${escapeHtml(answer)}</pre>
            </div>
          ` : `
            <div class="callout" style="margin:0">
              <strong>Réponse :</strong> à compléter (admin).
            </div>
          `}
        </div>
      </details>
    `;
  }

  async function initLearningPage(){
    const list = $("#learnList");
    if(!list) return;

    const mode = $("#learnMode");
    const heading = $("#learnHeading");
    const sub = $("#learnSub");
    const empty = $("#learnEmpty");
    const count = $("#learnCount");
    const search = $("#learnSearch");

    const kindRoot = $("#learnKindFilters");
    const langRoot = $("#learnLangFilters");
    const diffRoot = $("#learnDiffFilters");

    const state = {
      kind: "exercise",
      lang: "",
      difficulty: "",
      q: "",
      items: [],
    };

    const setActiveButtons = ()=>{
      (kindRoot ? Array.from(kindRoot.querySelectorAll("[data-learn-kind]")) : []).forEach(b=>{
        const k = b.getAttribute("data-learn-kind") || "";
        const active = normalizeLearnKind(k) === normalizeLearnKind(state.kind);
        b.classList.toggle("primary", active);
      });
      (langRoot ? Array.from(langRoot.querySelectorAll("[data-learn-lang]")) : []).forEach(b=>{
        const btnRaw = String(b.getAttribute("data-learn-lang") || "").trim().toLowerCase();
        const wantRaw = String(state.lang || "").trim().toLowerCase();
        const active = !wantRaw ? !btnRaw : normalizeLearnLang(btnRaw) === normalizeLearnLang(wantRaw);
        b.classList.toggle("primary", active);
      });
      (diffRoot ? Array.from(diffRoot.querySelectorAll("[data-learn-difficulty]")) : []).forEach(b=>{
        const btnRaw = String(b.getAttribute("data-learn-difficulty") || "").trim().toLowerCase();
        const wantRaw = String(state.difficulty || "").trim().toLowerCase();
        const active = !wantRaw ? !btnRaw : normalizeLearnDifficulty(btnRaw) === normalizeLearnDifficulty(wantRaw);
        b.classList.toggle("primary", active);
      });
    };

    const applyFilters = (items)=>{
      const wantKind = normalizeLearnKind(state.kind);
      const wantLang = String(state.lang || "").trim().toLowerCase();
      const wantDiff = String(state.difficulty || "").trim().toLowerCase();
      const q = String(state.q || "").trim().toLowerCase();

      return (items || [])
        .filter(it=> normalizeLearnKind(it.kind) === wantKind)
        .filter(it=> !wantLang || normalizeLearnLang(it.lang) === normalizeLearnLang(wantLang))
        .filter(it=> wantKind !== "exercise" || !wantDiff || normalizeLearnDifficulty(it.difficulty) === normalizeLearnDifficulty(wantDiff))
        .filter(it=>{
          if(!q) return true;
          const hay = `${it.title || ""}\n${it.prompt || ""}\n${it.answer || ""}`.toLowerCase();
          return hay.includes(q);
        });
    };

    const rerender = ()=>{
      setActiveButtons();
      diffRoot && diffRoot.classList.toggle("hidden", normalizeLearnKind(state.kind) !== "exercise");
      const filtered = applyFilters(state.items);
      const total = state.items.length;
      const shown = filtered.length;

      if(heading) heading.textContent = (normalizeLearnKind(state.kind) === "tutorial") ? "Tutoriels" : "Exercices";
      if(sub){
        sub.textContent = (normalizeLearnKind(state.kind) === "tutorial")
          ? "Mini-guides et rappels rapides par langage."
          : "Clique sur la consigne pour afficher la réponse.";
      }

      if(count){
        count.textContent = state.q ? `${shown}/${total} résultat(s)` : `${shown} item(s)`;
      }

      list.innerHTML = filtered.map(renderLearningItemHtml).join("");
      empty && empty.classList.toggle("hidden", shown > 0);
    };

    kindRoot?.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-learn-kind]");
      if(!btn) return;
      state.kind = normalizeLearnKind(btn.getAttribute("data-learn-kind"));
      rerender();
    });

    langRoot?.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-learn-lang]");
      if(!btn) return;
      const raw = btn.getAttribute("data-learn-lang") || "";
      state.lang = raw ? normalizeLearnLang(raw) : "";
      rerender();
    });

    diffRoot?.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-learn-difficulty]");
      if(!btn) return;
      const raw = btn.getAttribute("data-learn-difficulty") || "";
      state.difficulty = raw ? normalizeLearnDifficulty(raw) : "";
      rerender();
    });

    search?.addEventListener("input", ()=>{
      state.q = String(search.value || "");
      rerender();
    });

    list.addEventListener("click", async (e)=>{
      const aiBtn = e.target.closest("[data-ai-help]");
      if(aiBtn){
        const details = aiBtn.closest("details[data-learn-item]");
        const id = details?.getAttribute("data-learn-item") || "";
        const it = (state.items || []).find(x=> String(x?.id || "") === String(id)) || null;

        if(window.fwAi?.open){
          window.fwAi.open(it ? {
            kind: normalizeLearnKind(it.kind),
            lang: normalizeLearnLang(it.lang),
            difficulty: normalizeLearnDifficulty(it.difficulty),
            title: String(it.title || "").trim(),
            prompt: String(it.prompt || "").trim(),
          } : null);
        }else{
          window.fwToast?.("IA", "Assistant IA indisponible (script non chargé).");
        }
        return;
      }

      const prevBtn = e.target.closest("[data-preview]");
      if(prevBtn){
        const sel = prevBtn.getAttribute("data-preview");
        const target = sel ? document.querySelector(sel) : null;
        const text = (target?.innerText || target?.textContent || "").replace(/\s+$/,"");
        openLearnHtmlPreview(text);
        return;
      }

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
        window.fwToast?.("Copié", "Texte copié dans le presse-papiers.");
      }catch(err){
        btn.textContent = "Erreur";
        window.fwToast?.("Erreur", "Copie impossible (permissions navigateur).");
      }finally{
        setTimeout(()=>{ btn.textContent = old; }, 900);
      }
    });

    mode && (mode.textContent = "Chargement…");
    const res = await fetchLearningItemsAnyMode();
    mode && (mode.textContent = res.modeLabel || "—");

    if(res.needsAuth){
      empty && empty.classList.remove("hidden");
      if(empty){
        empty.innerHTML = `<strong>Connexion requise.</strong> Va sur <a href="${escapeHtml(loginHref())}">login</a> puis reviens.`;
      }
      list.innerHTML = "";
      if(count) count.textContent = "0 item";
      return;
    }

    state.items = Array.isArray(res.items) ? res.items : [];
    rerender();
  }

  initLearningPage();

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

  // ---- Admin dashboard helpers
  const TUTORIAL_POSTS_LS_KEY = "fwTutorialPosts_v1";
  function loadTutorialPosts(){
    try{
      const v = JSON.parse(localStorage.getItem(TUTORIAL_POSTS_LS_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    }catch(e){ return []; }
  }
  function saveTutorialPosts(arr){
    try{ localStorage.setItem(TUTORIAL_POSTS_LS_KEY, JSON.stringify(arr || [])); }catch(e){ /* ignore */ }
  }

  // ---- Learning items (admin modal CRUD)
  const learnAdminModalState = {
    prevOverflow: "",
    bound: false,
    company: "",
    items: [],
    q: "",
    kind: "",
    lang: "",
    editingId: "",
  };

  function getLearnAdminOverlay(){
    return $("#learnAdminOverlay");
  }

  function setLearnAdminFormValues(item){
    const overlay = getLearnAdminOverlay();
    if(!overlay) return;

    const it = item || null;
    const kindSel = $("#learnAdminKind", overlay);
    const langSel = $("#learnAdminLang", overlay);
    const diffSel = $("#learnAdminDifficulty", overlay);
    const titleEl = $("#learnAdminTitle", overlay);
    const promptEl = $("#learnAdminPrompt", overlay);
    const answerEl = $("#learnAdminAnswer", overlay);
    const delBtn = $("#learnAdminDelete", overlay);

    if(kindSel) kindSel.value = normalizeLearnKind(it?.kind || "exercise");
    if(langSel) langSel.value = normalizeLearnLang(it?.lang || "html");
    if(diffSel) diffSel.value = normalizeLearnDifficulty(it?.difficulty || "beginner");
    if(titleEl) titleEl.value = String(it?.title || "");
    if(promptEl) promptEl.value = String(it?.prompt || "");
    if(answerEl) answerEl.value = String(it?.answer || "");

    if(delBtn) delBtn.disabled = !it?.id;
  }

  function learnAdminRowHtml(item, { active } = {}){
    const it = item || {};
    const id = String(it.id || "");
    const title = String(it.title || "").trim() || "Sans titre";
    const kind = normalizeLearnKind(it.kind);
    const lang = normalizeLearnLang(it.lang);
    const diff = normalizeLearnDifficulty(it.difficulty);
    const meta = [
      learnKindLabel(kind),
      learnLangLabel(lang),
      kind === "exercise" ? learnDifficultyLabel(diff) : "",
    ].filter(Boolean).join(" • ");
    const style = active
      ? ` style="border-color: rgba(255,45,120,.32); background: rgba(255,255,255,.08)"`
      : "";

    return `
      <button class="file-box" type="button" data-la-edit="${escapeHtml(id)}"${style}>
        <div class="file-left" style="min-width:0">
          <div class="file-ico" aria-hidden="true">${escapeHtml(learnLangIcon(lang))}</div>
          <div class="file-meta" style="min-width:0">
            <div class="file-title truncate">${escapeHtml(title)}</div>
            <div class="file-sub truncate">${escapeHtml(meta)}</div>
          </div>
        </div>
        <span class="badge">Éditer</span>
      </button>
    `;
  }

  function setLearnAdminActiveButtons(){
    const overlay = getLearnAdminOverlay();
    if(!overlay) return;
    const kindRoot = $("#learnAdminKindFilters", overlay);
    const langRoot = $("#learnAdminLangFilters", overlay);
    const wantKind = String(learnAdminModalState.kind || "").trim().toLowerCase();
    const wantLang = String(learnAdminModalState.lang || "").trim().toLowerCase();

    (kindRoot ? Array.from(kindRoot.querySelectorAll("[data-la-kind]")) : []).forEach(b=>{
      const raw = String(b.getAttribute("data-la-kind") || "").trim().toLowerCase();
      const active = !wantKind ? !raw : normalizeLearnKind(raw) === normalizeLearnKind(wantKind);
      b.classList.toggle("primary", active);
    });
    (langRoot ? Array.from(langRoot.querySelectorAll("[data-la-lang]")) : []).forEach(b=>{
      const raw = String(b.getAttribute("data-la-lang") || "").trim().toLowerCase();
      const active = !wantLang ? !raw : normalizeLearnLang(raw) === normalizeLearnLang(wantLang);
      b.classList.toggle("primary", active);
    });
  }

  function filterLearnAdminItems(items){
    const wantKind = String(learnAdminModalState.kind || "").trim().toLowerCase();
    const wantLang = String(learnAdminModalState.lang || "").trim().toLowerCase();
    const q = String(learnAdminModalState.q || "").trim().toLowerCase();

    return (items || [])
      .filter(it=> !wantKind || normalizeLearnKind(it.kind) === normalizeLearnKind(wantKind))
      .filter(it=> !wantLang || normalizeLearnLang(it.lang) === normalizeLearnLang(wantLang))
      .filter(it=>{
        if(!q) return true;
        const hay = `${it.title || ""}\n${it.prompt || ""}\n${it.answer || ""}`.toLowerCase();
        return hay.includes(q);
      });
  }

  function renderLearnAdminList(){
    const overlay = getLearnAdminOverlay();
    if(!overlay) return;
    const list = $("#learnAdminList", overlay);
    const empty = $("#learnAdminEmpty", overlay);
    if(!list) return;

    setLearnAdminActiveButtons();

    const filtered = filterLearnAdminItems(learnAdminModalState.items);
    list.innerHTML = filtered.map(it=> learnAdminRowHtml(it, { active: String(it.id) === String(learnAdminModalState.editingId) })).join("");
    empty && empty.classList.toggle("hidden", filtered.length > 0);
  }

  async function loadLearnAdminItems(){
    const overlay = getLearnAdminOverlay();
    if(!overlay) return;

    const modeEl = $("#learnAdminMode", overlay);
    const company = companyFromUser();
    learnAdminModalState.company = company;

    if(!isAdmin()){
      modeEl && (modeEl.textContent = sbEnabled ? "Supabase • Accès admin requis" : "Démo locale • Accès admin requis");
      learnAdminModalState.items = [];
      renderLearnAdminList();
      setLearnAdminFormValues(null);
      return;
    }

    if(!sbEnabled){
      modeEl && (modeEl.textContent = "Démo locale • Gestion via localStorage");
      const all = loadLearningItemsLocal();
      learnAdminModalState.items = (all || []).filter(x=> String(x?.company || "") === company);
      renderLearnAdminList();
      if(learnAdminModalState.items.length && !learnAdminModalState.editingId){
        learnAdminModalState.editingId = String(learnAdminModalState.items[0]?.id || "");
        const first = learnAdminModalState.items[0] || null;
        setLearnAdminFormValues(first);
      }else{
        const selected = learnAdminModalState.items.find(x=> String(x?.id || "") === String(learnAdminModalState.editingId)) || null;
        setLearnAdminFormValues(selected);
      }
      return;
    }

    const uid = await sbUserId();
    if(!uid){
      modeEl && (modeEl.textContent = "Supabase • Non connecté");
      learnAdminModalState.items = [];
      renderLearnAdminList();
      setLearnAdminFormValues(null);
      return;
    }

    modeEl && (modeEl.textContent = "Supabase • Chargement…");
    const baseQuery = (selectStr)=> sb
      .from(LEARNING_TABLE)
      .select(selectStr)
      .eq("company", company)
      .order("updated_at", { ascending: false })
      .limit(250);

    const selectNoDiff = "id,company,author_id,kind,lang,title,prompt,answer,created_at,updated_at";
    let res = await baseQuery(`${selectNoDiff},difficulty`);

    if(res.error){
      const code = String(res.error?.code || "");
      const msg = String(res.error?.message || "").toLowerCase();
      const missingDifficulty = (code === "42703") || (msg.includes("difficulty") && msg.includes("does not exist"));
      if(missingDifficulty){
        res = await baseQuery(selectNoDiff);
      }
    }

    if(res.error){
      const code = String(res.error?.code || "");
      const msg = String(res.error?.message || "");
      if(code === "42P01" || msg.toLowerCase().includes("does not exist")){
        modeEl && (modeEl.textContent = "Supabase • Table learning_items manquante (schema.sql)");
      }else{
        modeEl && (modeEl.textContent = "Supabase • Erreur");
        sbToastError("Exercices", res.error);
      }
      learnAdminModalState.items = [];
      renderLearnAdminList();
      setLearnAdminFormValues(null);
      return;
    }

    learnAdminModalState.items = (res.data || []).map(x=> ({ ...x, difficulty: normalizeLearnDifficulty(x?.difficulty) }));
    modeEl && (modeEl.textContent = `Supabase • ${learnAdminModalState.items.length} item(s)`);
    renderLearnAdminList();

    if(learnAdminModalState.items.length && !learnAdminModalState.editingId){
      learnAdminModalState.editingId = String(learnAdminModalState.items[0]?.id || "");
      setLearnAdminFormValues(learnAdminModalState.items[0]);
    }else{
      const selected = learnAdminModalState.items.find(x=> String(x?.id || "") === String(learnAdminModalState.editingId)) || null;
      setLearnAdminFormValues(selected);
    }
  }

  function closeLearningAdminModal(){
    const overlay = getLearnAdminOverlay();
    if(!overlay) return false;
    overlay.classList.add("hidden");
    try{ document.body.style.overflow = learnAdminModalState.prevOverflow; }catch(e){ /* ignore */ }
    return true;
  }

  function openLearningAdminModal(){
    const overlay = getLearnAdminOverlay();
    if(!overlay){
      window.fwToast?.("Admin", "Modal exercices introuvable (learnAdminOverlay).");
      return false;
    }
    bindLearningAdminModalUI();

    const opening = overlay.classList.contains("hidden");
    overlay.classList.remove("hidden");
    if(opening){
      try{
        learnAdminModalState.prevOverflow = document.body.style.overflow ?? "";
        document.body.style.overflow = "hidden";
      }catch(e){ /* ignore */ }
    }

    loadLearnAdminItems();
    return true;
  }

  // ---- Message reports (admin modal)
  const reportsAdminModalState = {
    prevOverflow: "",
    bound: false,
    company: "",
    status: "open",
    items: [],
  };

  function getReportsAdminOverlay(){
    return $("#reportsAdminOverlay");
  }

  function closeReportsAdminModal(){
    const overlay = getReportsAdminOverlay();
    if(!overlay) return false;
    overlay.classList.add("hidden");
    try{ document.body.style.overflow = reportsAdminModalState.prevOverflow; }catch(e){ /* ignore */ }
    return true;
  }

  function reportsStatusLabel(status){
    const s = String(status || "").trim().toLowerCase();
    if(s === "resolved") return "Résolu";
    if(s === "dismissed") return "Ignoré";
    return "Ouvert";
  }

  function setReportsAdminActiveButtons(){
    const overlay = getReportsAdminOverlay();
    if(!overlay) return;
    const root = $("#reportsAdminStatusFilters", overlay);
    if(!root) return;
    const want = String(reportsAdminModalState.status || "");
    $$("[data-ra-status]", root).forEach(b=>{
      const v = String(b.getAttribute("data-ra-status") || "");
      b.classList.toggle("primary", v === want);
    });
  }

  function reportItemHtml(report){
    const r = report || {};
    const id = String(r.id || "");
    const kind = String(r.kind || "").trim().toLowerCase();
    const status = String(r.status || "open").trim().toLowerCase();

    let channelLabel = String(r.channel_name || "").trim();
    if(!channelLabel){
      const raw = String(r.channel || "").trim();
      const parts = raw.split(":");
      channelLabel = parts.length >= 2 ? parts.slice(1).join(":") : raw;
    }
    if(!channelLabel) channelLabel = "canal";

    const where = (kind === "channel") ? `#${channelLabel}` : "DM";

    const createdAt = fmtTs(r.created_at || "");
    const msgAt = fmtTs(r.message_created_at || "");

    const author = String(r.author_name || "Utilisateur");
    const reporter = String(r.reporter_name || "Utilisateur");
    const resolver = String(r.resolver_name || "");

    const reason = String(r.reason || "").trim();
    const msgTextRaw = String(r.message_text || "").replace(/\s+/g, " ").trim();
    const msgText = msgTextRaw.length > 180 ? (msgTextRaw.slice(0, 177) + "…") : msgTextRaw;

    const fileUrl = String(r.message_file_url || "");
    const fileName = String(r.message_file_name || "");
    const hasFile = !!(fileUrl || fileName);

    const meta = [
      `Auteur: ${author}`,
      `Signalé par: ${reporter}`,
      createdAt ? `Signalement: ${createdAt}` : "",
      msgAt ? `Message: ${msgAt}` : "",
      (status !== "open" && resolver) ? `${reportsStatusLabel(status)} par ${resolver}` : "",
    ].filter(Boolean).join(" • ");

    const actions = (status === "open")
      ? `
        <button class="btn small" type="button" data-ra-resolve="${escapeHtml(id)}">Résoudre</button>
        <button class="btn small" type="button" data-ra-dismiss="${escapeHtml(id)}">Ignorer</button>
      `
      : `
        <button class="btn small" type="button" data-ra-reopen="${escapeHtml(id)}">Réouvrir</button>
      `;

    return `
      <div class="file-box" style="margin-top:0; cursor:default">
        <div class="file-left" style="min-width:0">
          <div class="file-ico" aria-hidden="true">🚩</div>
          <div class="file-meta" style="min-width:0">
            <div class="file-title truncate">${escapeHtml(where)} — Message signalé</div>
            <div class="file-sub truncate">${escapeHtml(meta)}</div>
            ${reason ? `<div class="file-sub truncate"><strong>Raison:</strong> ${escapeHtml(reason)}</div>` : ""}
            ${msgText ? `<div class="file-sub">${escapeHtml(msgText)}</div>` : ""}
          </div>
        </div>

        <div class="row" style="gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end">
          <span class="badge">${escapeHtml(reportsStatusLabel(status))}</span>
          ${hasFile ? `<button class="btn small" type="button" title="Ouvrir fichier" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}">📎</button>` : ""}
          ${actions}
        </div>
      </div>
    `;
  }

  function renderReportsAdminList(){
    const overlay = getReportsAdminOverlay();
    if(!overlay) return;
    const list = $("#reportsAdminList", overlay);
    const empty = $("#reportsAdminEmpty", overlay);
    if(!list || !empty) return;

    const want = String(reportsAdminModalState.status || "").trim().toLowerCase();
    const all = Array.isArray(reportsAdminModalState.items) ? reportsAdminModalState.items : [];
    const filtered = want ? all.filter(r=> String(r?.status || "open").trim().toLowerCase() === want) : all;

    list.innerHTML = filtered.map(reportItemHtml).join("");
    empty.classList.toggle("hidden", filtered.length > 0);
    setReportsAdminActiveButtons();
  }

  async function updateReportStatus(reportId, nextStatus){
    const id = String(reportId || "");
    if(!id) return false;

    if(!sbEnabled){
      const all = loadMessageReports();
      const r = all[id];
      if(!r) return false;
      r.status = String(nextStatus || "open");
      if(r.status === "open"){
        r.resolved_at = null;
        r.resolved_by = null;
      }else{
        r.resolved_at = new Date().toISOString();
        r.resolved_by = String(getUser()?.name || "");
      }
      all[id] = r;
      saveMessageReports(all);
      await loadReportsAdminItems();
      return true;
    }

    const uid = await sbUserId();
    if(!uid) return false;

    const company = reportsAdminModalState.company || companyFromUser();
    const status = String(nextStatus || "open").trim().toLowerCase();

    const patch = (status === "open")
      ? { status: "open", resolved_at: null, resolved_by: null }
      : { status, resolved_at: new Date().toISOString(), resolved_by: uid };

    const up = await sb
      .from("message_reports")
      .update(patch)
      .eq("company", company)
      .eq("id", id);
    if(up.error){
      sbToastError("Signalements", up.error);
      return false;
    }

    await loadReportsAdminItems();
    return true;
  }

  async function loadReportsAdminItems(){
    const overlay = getReportsAdminOverlay();
    if(!overlay) return;
    const modeEl = $("#reportsAdminMode", overlay);
    const company = companyFromUser();
    reportsAdminModalState.company = company;

    if(!sbEnabled){
      const all = Object.values(loadMessageReports() || {}).filter(Boolean);
      const items = all
        .map(r=> ({
          ...r,
          reporter_name: String(r.reporter || "Utilisateur"),
          author_name: String(r.message?.from || "Utilisateur"),
          message_text: String(r.message?.text || ""),
          message_file_url: String(r.message?.file_url || ""),
          message_file_name: String(r.message?.file_name || ""),
          message_created_at: String(r.message?.created_at || ""),
          created_at: String(r.created_at || ""),
        }))
        .sort((a,b)=> String(b.created_at || "").localeCompare(String(a.created_at || "")));

      reportsAdminModalState.items = items;
      modeEl && (modeEl.textContent = `Démo locale • ${items.length} signalement(s)`);
      renderReportsAdminList();
      return;
    }

    modeEl && (modeEl.textContent = "Supabase • Chargement…");
    const uid = await sbUserId();
    if(!uid){
      window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
      return;
    }

    const res = await sb
      .from("message_reports")
      .select("*")
      .eq("company", company)
      .order("created_at", { ascending: false })
      .limit(200);

    if(res.error){
      const code = String(res.error?.code || "");
      const msg = String(res.error?.message || "");
      if(code === "42P01" || msg.toLowerCase().includes("does not exist")){
        modeEl && (modeEl.textContent = "Supabase • Table message_reports manquante (schema.sql)");
      }else{
        modeEl && (modeEl.textContent = "Supabase • Erreur");
        sbToastError("Signalements", res.error);
      }
      reportsAdminModalState.items = [];
      renderReportsAdminList();
      return;
    }

    const rows = res.data || [];

    const profIds = Array.from(new Set(
      rows.flatMap(r=> [r?.reporter_id, r?.message_author_id, r?.resolved_by])
        .filter(Boolean)
        .map(String)
    ));
    let profById = new Map();
    if(profIds.length){
      const p = await sb.from("profiles").select("id,name,email").in("id", profIds);
      if(!p.error){
        profById = new Map((p.data || []).map(x=> [String(x.id), x]));
      }
    }

    const chanIds = Array.from(new Set(
      rows.filter(r=> String(r?.kind || "") === "channel" && r?.channel_id).map(r=> String(r.channel_id))
    ));
    let chanById = new Map();
    if(chanIds.length){
      const c = await sb.from("channels").select("id,name,type").in("id", chanIds);
      if(!c.error){
        chanById = new Map((c.data || []).map(x=> [String(x.id), x]));
      }
    }

    reportsAdminModalState.items = rows.map(r=>{
      const reporter = profById.get(String(r?.reporter_id || "")) || {};
      const author = profById.get(String(r?.message_author_id || "")) || {};
      const resolver = profById.get(String(r?.resolved_by || "")) || {};
      const ch = chanById.get(String(r?.channel_id || "")) || {};
      return {
        ...r,
        reporter_name: reporter.name || "Utilisateur",
        author_name: author.name || "Utilisateur",
        resolver_name: resolver.name || "",
        channel_name: ch.name || "",
      };
    });

    modeEl && (modeEl.textContent = `Supabase • ${rows.length} signalement(s)`);
    renderReportsAdminList();
  }

  function bindReportsAdminModalUI(){
    const overlay = getReportsAdminOverlay();
    if(!overlay || reportsAdminModalState.bound) return;
    reportsAdminModalState.bound = true;

    overlay.addEventListener("click", async (e)=>{
      const closeBtn = e.target.closest("[data-ra-close]");
      if(closeBtn){
        closeReportsAdminModal();
        return;
      }

      const refreshBtn = e.target.closest("[data-ra-refresh]");
      if(refreshBtn){
        await loadReportsAdminItems();
        return;
      }

      const statusBtn = e.target.closest("[data-ra-status]");
      if(statusBtn){
        reportsAdminModalState.status = String(statusBtn.getAttribute("data-ra-status") || "");
        renderReportsAdminList();
        return;
      }

      const resolveId = e.target.closest("[data-ra-resolve]")?.getAttribute("data-ra-resolve") || "";
      if(resolveId){
        await updateReportStatus(resolveId, "resolved");
        return;
      }

      const dismissId = e.target.closest("[data-ra-dismiss]")?.getAttribute("data-ra-dismiss") || "";
      if(dismissId){
        await updateReportStatus(dismissId, "dismissed");
        return;
      }

      const reopenId = e.target.closest("[data-ra-reopen]")?.getAttribute("data-ra-reopen") || "";
      if(reopenId){
        await updateReportStatus(reopenId, "open");
        return;
      }

      const fileBtn = e.target.closest("[data-file-url]");
      if(fileBtn){
        const fileUrl = fileBtn.getAttribute("data-file-url") || "";
        const fileName = fileBtn.getAttribute("data-file-name") || "";
        await openFileFromPost({ fileUrl, fileName });
      }
    });
  }

  function openReportsAdminModal(){
    const overlay = getReportsAdminOverlay();
    if(!overlay){
      window.fwToast?.("Admin", "Modal signalements introuvable (reportsAdminOverlay).");
      return false;
    }
    if(!isAdmin()){
      window.fwToast?.("Accès réservé","Cette section est disponible pour les admins.");
      return false;
    }

    bindReportsAdminModalUI();
    const opening = overlay.classList.contains("hidden");
    overlay.classList.remove("hidden");
    if(opening){
      try{
        reportsAdminModalState.prevOverflow = document.body.style.overflow ?? "";
        document.body.style.overflow = "hidden";
      }catch(e){ /* ignore */ }
    }

    loadReportsAdminItems();
    return true;
  }

  function getLearningExampleTemplates(){
    return [
      {
        kind: "exercise",
        lang: "html",
        difficulty: "beginner",
        title: "HTML — Carte de profil",
        prompt: "Consigne : crée une page avec un titre, une image (placeholder) et une section 'Bio'. Ajoute un lien vers tes réseaux.\n\nObjectif : travailler la structure (header/main/section) + les liens.",
        answer: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Profil</title>
</head>
<body>
  <header>
    <h1>Mon profil</h1>
  </header>
  <main>
    <img src="https://via.placeholder.com/140" alt="Photo de profil"/>
    <section>
      <h2>Bio</h2>
      <p>Je suis développeur web.</p>
      <a href="https://example.com" target="_blank" rel="noopener">Mon site</a>
    </section>
  </main>
</body>
</html>`,
      },
      {
        kind: "exercise",
        lang: "html",
        difficulty: "beginner",
        title: "HTML — Formulaire de contact",
        prompt: "Consigne : crée un formulaire (nom, email, message) avec des labels accessibles et un bouton Envoyer.\n\nBonus : ajoute `required` et un petit texte d'aide.",
        answer: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Contact</title>
</head>
<body>
  <main>
    <h1>Contact</h1>
    <p id="help">Tous les champs sont obligatoires.</p>

    <form method="post" aria-describedby="help">
      <p>
        <label for="name">Nom</label><br/>
        <input id="name" name="name" type="text" autocomplete="name" required/>
      </p>

      <p>
        <label for="email">Email</label><br/>
        <input id="email" name="email" type="email" autocomplete="email" required/>
      </p>

      <p>
        <label for="msg">Message</label><br/>
        <textarea id="msg" name="message" rows="6" required></textarea>
      </p>

      <button type="submit">Envoyer</button>
    </form>
  </main>
</body>
</html>`,
      },
      {
        kind: "exercise",
        lang: "html",
        difficulty: "intermediate",
        title: "HTML — Page article (sémantique)",
        prompt: "Consigne : crée une page avec `header`, `nav`, `main`, `article`, `aside` et `footer`.\n\nObjectif : utiliser la sémantique HTML.",
        answer: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Article</title>
</head>
<body>
  <header>
    <h1>Mon blog</h1>
    <nav aria-label="Navigation principale">
      <a href="#">Accueil</a> · <a href="#">Articles</a> · <a href="#">Contact</a>
    </nav>
  </header>

  <main>
    <article>
      <h2>Pourquoi apprendre le web</h2>
      <p>Un article court pour s'entraîner à structurer une page.</p>
      <h3>Points clés</h3>
      <ul>
        <li>HTML pour la structure</li>
        <li>CSS pour le style</li>
        <li>JS pour l'interaction</li>
      </ul>
    </article>

    <aside>
      <h2>À propos</h2>
      <p>Quelques infos sur l'auteur.</p>
    </aside>
  </main>

  <footer>
    <small>© 2026</small>
  </footer>
</body>
</html>`,
      },
      {
        kind: "exercise",
        lang: "html",
        difficulty: "beginner",
        title: "HTML — Liste de produits",
        prompt: "Consigne : crée une liste de 6 produits avec un titre, un prix et un bouton. Utilise une liste `<ul>` et des `<li>`.\n\nObjectif : structure + répétition.",
        answer: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Produits</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px}
    ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    li{border:1px solid #ddd;border-radius:14px;padding:12px}
    .price{font-weight:900}
    button{padding:8px 10px;border-radius:12px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <h1>Catalogue</h1>
    <ul>
      <li><h2>Produit A</h2><div class="price">9,90€</div><button>Ajouter</button></li>
      <li><h2>Produit B</h2><div class="price">12,90€</div><button>Ajouter</button></li>
      <li><h2>Produit C</h2><div class="price">19,90€</div><button>Ajouter</button></li>
      <li><h2>Produit D</h2><div class="price">29,90€</div><button>Ajouter</button></li>
      <li><h2>Produit E</h2><div class="price">39,90€</div><button>Ajouter</button></li>
      <li><h2>Produit F</h2><div class="price">49,90€</div><button>Ajouter</button></li>
    </ul>
  </main>
</body>
</html>`,
      },
      {
        kind: "exercise",
        lang: "html",
        difficulty: "advanced",
        title: "HTML — Modal (dialog) accessible",
        prompt: "Consigne : crée une fenêtre modale accessible avec `<dialog>`. Bouton Ouvrir + bouton Fermer.\n\nBonus : fermer au clic sur l’arrière-plan.",
        answer: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Dialog</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px}
    button{padding:10px 12px;border-radius:12px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}
    dialog{border:0;border-radius:16px;max-width:520px;width:92vw;padding:0;box-shadow:0 20px 60px rgba(0,0,0,.35)}
    dialog::backdrop{background:rgba(0,0,0,.5)}
    .head{padding:14px 14px 0}
    .body{padding:10px 14px 14px;color:#333}
    .actions{display:flex;justify-content:flex-end;gap:10px;padding:0 14px 14px}
    .ghost{background:transparent;color:#111}
  </style>
</head>
<body>
  <main>
    <h1>Modal</h1>
    <button id="open">Ouvrir</button>

    <dialog id="dlg" aria-label="Informations">
      <div class="head"><h2 style="margin:0">Informations</h2></div>
      <div class="body">Ceci est une modale native.</div>
      <div class="actions">
        <button class="ghost" id="close" type="button">Fermer</button>
      </div>
    </dialog>
  </main>

  <script>
    const dlg = document.getElementById("dlg");
    document.getElementById("open").addEventListener("click", ()=> dlg.showModal());
    document.getElementById("close").addEventListener("click", ()=> dlg.close());
    dlg.addEventListener("click", (e)=>{
      const r = dlg.getBoundingClientRect();
      const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
      if(!inside) dlg.close();
    });
  </script>
</body>
</html>`,
      },
      {
        kind: "exercise",
        lang: "css",
        difficulty: "beginner",
        title: "CSS — Bouton glass + hover",
        prompt: "Consigne : style un bouton en mode 'glassmorphism' avec un petit effet au survol (hover) et au clic (active).",
        answer: `button{
  padding: 12px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.10);
  color: white;
  backdrop-filter: blur(14px) saturate(1.2);
  cursor: pointer;
  transition: transform .08s ease, background .12s ease;
}
button:hover{ background: rgba(255,255,255,.14); }
button:active{ transform: translateY(1px); }`,
      },
      {
        kind: "exercise",
        lang: "css",
        difficulty: "intermediate",
        title: "CSS — Carte responsive",
        prompt: "Consigne : crée une carte (card) avec une ombre douce, un titre, un texte, et une image. La carte doit être responsive (max-width).",
        answer: `.card{
  max-width: 520px;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 18px;
  overflow:hidden;
  background: rgba(255,255,255,.06);
  box-shadow: 0 14px 40px rgba(0,0,0,.35);
}
.card img{ width:100%; display:block; }
.card .body{ padding: 16px; }
.card h2{ margin: 0 0 6px; }
.card p{ margin: 0; opacity: .85; }`,
      },
      {
        kind: "exercise",
        lang: "css",
        difficulty: "intermediate",
        title: "CSS — Galerie en grid",
        prompt: "Consigne : crée une grille responsive de cartes ou d'images (grid). Objectif : utiliser `display:grid` + `auto-fit`.",
        answer: `.grid{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.tile{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  min-height: 110px;
}`,
      },
      {
        kind: "exercise",
        lang: "css",
        difficulty: "advanced",
        title: "CSS — Layout dashboard (sidebar + grid)",
        prompt: "Consigne : crée un layout type dashboard : une sidebar fixe + un contenu en grid.\n\nObjectif : combiner `grid` et `sticky` (ou `min-height`).",
        answer: `.layout{
  display:grid;
  grid-template-columns: 260px 1fr;
  gap: 14px;
  min-height: 100vh;
}
.sidebar{
  position: sticky;
  top: 0;
  align-self:start;
  height: 100vh;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 16px;
  background: rgba(255,255,255,.06);
  padding: 14px;
}
.content{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.card{
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 16px;
  background: rgba(255,255,255,.06);
  padding: 14px;
}`,
      },
      {
        kind: "exercise",
        lang: "js",
        difficulty: "beginner",
        title: "JS — Compteur",
        prompt: "Consigne : ajoute un bouton 'Incrémenter' et un nombre. Au clic : +1.\n\nBonus : sauvegarde dans localStorage.",
        answer: `const countEl = document.getElementById("count");
const btn = document.getElementById("inc");

let count = Number(localStorage.getItem("count") || 0);
countEl.textContent = String(count);

btn.addEventListener("click", ()=>{
  count += 1;
  countEl.textContent = String(count);
  localStorage.setItem("count", String(count));
});`,
      },
      {
        kind: "exercise",
        lang: "js",
        difficulty: "intermediate",
        title: "JS — Todo list (DOM + localStorage)",
        prompt: "Consigne : crée une todo list. Ajout + suppression d'une tâche.\n\nHTML attendu : un input `#todoInput`, un bouton `#todoAdd`, une liste `#todoList`.",
        answer: `const KEY = "todos_v1";
const input = document.getElementById("todoInput");
const addBtn = document.getElementById("todoAdd");
const list = document.getElementById("todoList");

let items = [];
try{ items = JSON.parse(localStorage.getItem(KEY) || "[]"); }catch(e){ items = []; }

function save(){
  localStorage.setItem(KEY, JSON.stringify(items));
}
function render(){
  list.innerHTML = "";
  items.forEach((text, idx)=>{
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.gap = "8px";
    li.style.alignItems = "center";

    const span = document.createElement("span");
    span.textContent = text;

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Supprimer";
    del.addEventListener("click", ()=>{
      items.splice(idx, 1);
      save();
      render();
    });

    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  });
}

addBtn.addEventListener("click", ()=>{
  const v = input.value.trim();
  if(!v) return;
  items.push(v);
  input.value = "";
  save();
  render();
});

render();`,
      },
      {
        kind: "exercise",
        lang: "js",
        difficulty: "intermediate",
        title: "JS — Chronomètre",
        prompt: "Consigne : crée un chronomètre start/stop/reset.\n\nHTML attendu : un affichage `#time` + boutons `#start`, `#stop`, `#reset`.",
        answer: `const out = document.getElementById("time");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const resetBtn = document.getElementById("reset");

let seconds = 0;
let timer = null;

function fmt(sec){
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return m + ":" + s;
}
function draw(){
  out.textContent = fmt(seconds);
}

startBtn.addEventListener("click", ()=>{
  if(timer) return;
  timer = setInterval(()=>{
    seconds += 1;
    draw();
  }, 1000);
});
stopBtn.addEventListener("click", ()=>{
  clearInterval(timer);
  timer = null;
});
resetBtn.addEventListener("click", ()=>{
  seconds = 0;
  draw();
});

draw();`,
      },
      {
        kind: "exercise",
        lang: "js",
        difficulty: "advanced",
        title: "JS — Recherche avec debounce",
        prompt: "Consigne : implémente une recherche avec debounce (attendre 300ms après la saisie avant d'exécuter).\n\nHTML attendu : input `#search` + div `#result`.",
        answer: `const input = document.getElementById("search");
const out = document.getElementById("result");

let timer = null;
function run(query){
  out.textContent = "Recherche : " + query;
}

input.addEventListener("input", ()=>{
  const q = input.value.trim();
  clearTimeout(timer);
  timer = setTimeout(()=> run(q), 300);
});`,
      },
      {
        kind: "exercise",
        lang: "sql",
        difficulty: "beginner",
        title: "SQL — Requête SELECT",
        prompt: "Consigne : avec une table `users(id, name, email, created_at)`, récupère les 10 derniers utilisateurs créés.",
        answer: `select id, name, email, created_at
from users
order by created_at desc
limit 10;`,
      },
      {
        kind: "exercise",
        lang: "sql",
        difficulty: "intermediate",
        title: "SQL — JOIN users / orders",
        prompt: "Consigne : avec `users(id, name)` et `orders(id, user_id, total, created_at)`, affiche les 20 dernières commandes avec le nom de l'utilisateur.",
        answer: `select o.id, o.total, o.created_at, u.name as user_name
from orders o
join users u on u.id = o.user_id
order by o.created_at desc
limit 20;`,
      },
      {
        kind: "exercise",
        lang: "sql",
        difficulty: "advanced",
        title: "SQL — GROUP BY (ventes par jour)",
        prompt: "Consigne : avec `orders(total, created_at)`, calcule le total des ventes par jour. Garde seulement les jours > 1000.",
        answer: `select date(created_at) as day, sum(total) as total_sales
from orders
group by date(created_at)
having sum(total) > 1000
order by day desc;`,
      },
      {
        kind: "exercise",
        lang: "sql",
        difficulty: "advanced",
        title: "SQL — Ranking (window function)",
        prompt: "Consigne : avec `orders(user_id, total)`, affiche les 3 meilleurs clients (total cumulé) avec un rang.\n\nObjectif : `sum` + `dense_rank()`.",
        answer: `with totals as (
  select user_id, sum(total) as total_spent
  from orders
  group by user_id
)
select
  user_id,
  total_spent,
  dense_rank() over (order by total_spent desc) as r
from totals
order by r
limit 3;`,
      },
      {
        kind: "exercise",
        lang: "php",
        difficulty: "beginner",
        title: "PHP — Validation email",
        prompt: "Consigne : crée un petit script PHP qui valide un email envoyé en POST et affiche un message (OK/Erreur).",
        answer: `<?php
$email = $_POST["email"] ?? "";
if(filter_var($email, FILTER_VALIDATE_EMAIL)){
  echo "OK : " . htmlspecialchars($email);
} else {
  echo "Erreur : email invalide";
}
?>`,
      },
      {
        kind: "exercise",
        lang: "php",
        difficulty: "intermediate",
        title: "PHP — PDO INSERT (CRUD)",
        prompt: "Consigne : insère un post en base via PDO (requête préparée) avec des champs `title` et `body` envoyés en POST.\n\nPrérequis : une variable `$pdo` connectée + une table `posts(id, title, body)`.",
        answer: `<?php
$title = trim($_POST["title"] ?? "");
$body = trim($_POST["body"] ?? "");
if($title === ""){
  die("Titre obligatoire");
}

$stmt = $pdo->prepare("insert into posts(title, body) values(:title, :body) returning id");
$stmt->execute([
  ":title" => $title,
  ":body" => $body,
]);

$id = $stmt->fetchColumn();
echo "OK, id=" . htmlspecialchars((string)$id);
?>`,
      },
      {
        kind: "exercise",
        lang: "php",
        difficulty: "advanced",
        title: "PHP — Upload fichier (validation)",
        prompt: "Consigne : accepte un fichier via `input type=file name=file`. Autorise jpg/png/pdf et 2MB max. Sauvegarde dans `/uploads` avec un nom aléatoire.",
        answer: `<?php
if(!isset($_FILES["file"]) || $_FILES["file"]["error"] !== UPLOAD_ERR_OK){
  die("Aucun fichier");
}

$f = $_FILES["file"];
if($f["size"] > 2 * 1024 * 1024){
  die("Trop gros (max 2MB)");
}

$ext = strtolower(pathinfo($f["name"] ?? "", PATHINFO_EXTENSION));
$allowed = ["jpg","jpeg","png","pdf"];
if(!in_array($ext, $allowed, true)){
  die("Type interdit");
}

$dir = __DIR__ . "/uploads";
if(!is_dir($dir)) mkdir($dir, 0777, true);

$name = bin2hex(random_bytes(8)) . "." . $ext;
$dest = $dir . "/" . $name;
move_uploaded_file($f["tmp_name"], $dest);

echo "OK";
?>`,
      },
      {
        kind: "exercise",
        lang: "php",
        difficulty: "intermediate",
        title: "PHP — Login session (simple)",
        prompt: "Consigne : crée un mini login avec session.\n\nPrérequis : un formulaire POST avec `email` et `password`. Si OK → `$_SESSION['user']` est défini.",
        answer: `<?php
session_start();

$email = trim($_POST["email"] ?? "");
$password = $_POST["password"] ?? "";

// Exemple : identifiants en dur (à remplacer par une BDD)
$ok = ($email === "demo@exemple.com" && $password === "demo");

if($ok){
  $_SESSION["user"] = ["email" => $email];
  echo "Connecté";
} else {
  http_response_code(401);
  echo "Identifiants invalides";
}
?>`,
      },
      {
        kind: "tutorial",
        lang: "html",
        title: "HTML — Structure minimale",
        prompt: "Rappel : une page HTML propre avec meta viewport + charset + un <main>.",
        answer: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Ma page</title>
</head>
<body>
  <main>
    <h1>Hello</h1>
  </main>
</body>
</html>`,
      },
      {
        kind: "tutorial",
        lang: "css",
        title: "CSS — Centering (flex)",
        prompt: "Rappel : centrer un bloc horizontalement + verticalement avec flex.",
        answer: `.container{
  display:flex;
  align-items:center;
  justify-content:center;
  min-height: 100vh;
}`,
      },
      {
        kind: "tutorial",
        lang: "js",
        title: "JS — Fetch JSON",
        prompt: "Rappel : faire un fetch et afficher le résultat (async/await).",
        answer: `async function load(){
  const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
  const data = await res.json();
  console.log(data);
}
load();`,
      },
      {
        kind: "tutorial",
        lang: "sql",
        title: "SQL — INSERT + RETURNING",
        prompt: "Rappel : insérer une ligne et récupérer l'id (Postgres).",
        answer: `insert into users(name, email)
values ('Alex', 'alex@exemple.com')
returning id;`,
      },
      {
        kind: "tutorial",
        lang: "php",
        title: "PHP — PDO (requête préparée)",
        prompt: "Rappel : requête préparée pour éviter l'injection SQL.",
        answer: `<?php
$pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$stmt = $pdo->prepare("select * from users where email = :email");
$stmt->execute([":email" => $email]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
?>`,
      },
    ];
  }

  async function addLearningExamples(){
    if(!isAdmin()){
      window.fwToast?.("Admin", "Accès réservé.");
      return;
    }

    const company = companyFromUser();
    const existingKeys = new Set(
      (learnAdminModalState.items || [])
        .filter(x=> String(x?.company || "") === company)
        .map(x=> `${normalizeLearnKind(x?.kind)}|${normalizeLearnLang(x?.lang)}|${String(x?.title || "").trim().toLowerCase()}`)
    );

    const templates = getLearningExampleTemplates();
    const nowIso = new Date().toISOString();

    if(!sbEnabled){
      const all = loadLearningItemsLocal();
      const toAdd = templates
        .filter(t=> !existingKeys.has(`${normalizeLearnKind(t.kind)}|${normalizeLearnLang(t.lang)}|${String(t.title || "").trim().toLowerCase()}`))
        .map(t=>({
          id: uuid(),
          company,
          author_id: "local",
          kind: normalizeLearnKind(t.kind),
          lang: normalizeLearnLang(t.lang),
          difficulty: normalizeLearnDifficulty(t.difficulty),
          title: String(t.title || "").trim() || "Sans titre",
          prompt: String(t.prompt || ""),
          answer: String(t.answer || ""),
          created_at: nowIso,
          updated_at: nowIso,
        }));

      if(!toAdd.length){
        window.fwToast?.("Exemples", "Déjà présents.");
        return;
      }

      saveLearningItemsLocal([...all, ...toAdd]);
      window.fwToast?.("Exemples", `${toAdd.length} item(s) ajoutés.`);
      await loadLearnAdminItems();
      return;
    }

    const uid = await sbUserId();
    if(!uid){
      window.fwToast?.("Connexion", "Reconnecte-toi puis réessaie.");
      return;
    }

    const toInsert = templates
      .filter(t=> !existingKeys.has(`${normalizeLearnKind(t.kind)}|${normalizeLearnLang(t.lang)}|${String(t.title || "").trim().toLowerCase()}`))
      .map(t=>({
        id: uuid(),
        company,
        author_id: uid,
        kind: normalizeLearnKind(t.kind),
        lang: normalizeLearnLang(t.lang),
        difficulty: normalizeLearnDifficulty(t.difficulty),
        title: String(t.title || "").trim() || "Sans titre",
        prompt: String(t.prompt || ""),
        answer: String(t.answer || ""),
        created_at: nowIso,
        updated_at: nowIso,
      }));

    if(!toInsert.length){
      window.fwToast?.("Exemples", "Déjà présents.");
      return;
    }

    window.fwToast?.("Exemples", "Insertion…");
    let ins = await sb.from(LEARNING_TABLE).insert(toInsert);
    if(ins.error){
      const code = String(ins.error?.code || "");
      const msg = String(ins.error?.message || "").toLowerCase();
      const missingDifficulty = (code === "42703") || (msg.includes("difficulty") && msg.includes("does not exist"));
      if(missingDifficulty){
        window.fwToast?.("Supabase", "Schéma à mettre à jour (colonne difficulty).");
        const noDiff = toInsert.map(({ difficulty, ...rest })=> rest);
        ins = await sb.from(LEARNING_TABLE).insert(noDiff);
      }
    }
    if(ins.error){
      const code = String(ins.error?.code || "");
      if(code === "23505"){
        window.fwToast?.("Exemples", "Des doublons existent déjà (même type + langage + titre).");
        return;
      }
      sbToastError("Exemples", ins.error);
      return;
    }
    window.fwToast?.("Exemples", `${toInsert.length} item(s) ajoutés.`);
    await loadLearnAdminItems();
  }

  async function saveLearnAdminForm(ev){
    ev?.preventDefault?.();
    const overlay = getLearnAdminOverlay();
    if(!overlay) return;
    if(!isAdmin()){
      window.fwToast?.("Admin", "Accès réservé.");
      return;
    }

    const kind = normalizeLearnKind($("#learnAdminKind", overlay)?.value || "exercise");
    const lang = normalizeLearnLang($("#learnAdminLang", overlay)?.value || "html");
    const difficulty = normalizeLearnDifficulty($("#learnAdminDifficulty", overlay)?.value || "beginner");
    const title = String($("#learnAdminTitle", overlay)?.value || "").trim();
    const prompt = String($("#learnAdminPrompt", overlay)?.value || "").trim();
    const answer = String($("#learnAdminAnswer", overlay)?.value || "").trim();
    const company = companyFromUser();

    if(!title){
      window.fwToast?.("Titre manquant", "Ajoute un titre.");
      return;
    }

    const nowIso = new Date().toISOString();
    const editingId = String(learnAdminModalState.editingId || "");

    const wantedKey = `${kind}|${lang}|${title.trim().toLowerCase()}`;
    const hasDup = (learnAdminModalState.items || []).some(it=>{
      if(String(it?.company || "") !== company) return false;
      const id = String(it?.id || "");
      if(editingId && id === editingId) return false;
      const k = `${normalizeLearnKind(it?.kind)}|${normalizeLearnLang(it?.lang)}|${String(it?.title || "").trim().toLowerCase()}`;
      return k === wantedKey;
    });
    if(hasDup){
      window.fwToast?.("Doublon", "Un item avec ce titre existe déjà (même type + langage).");
      return;
    }

    if(!sbEnabled){
      const all = loadLearningItemsLocal();
      if(editingId){
        const idx = all.findIndex(x=> String(x?.id || "") === editingId && String(x?.company || "") === company);
        if(idx >= 0){
          all[idx] = { ...all[idx], kind, lang, difficulty, title, prompt, answer, updated_at: nowIso };
          saveLearningItemsLocal(all);
          window.fwToast?.("Enregistré", "Item mis à jour (local).");
        }else{
          window.fwToast?.("Introuvable", "Item non trouvé.");
          return;
        }
      }else{
        const id = uuid();
        all.push({
          id,
          company,
          author_id: "local",
          kind,
          lang,
          difficulty,
          title,
          prompt,
          answer,
          created_at: nowIso,
          updated_at: nowIso,
        });
        saveLearningItemsLocal(all);
        learnAdminModalState.editingId = id;
        window.fwToast?.("Ajouté", "Item créé (local).");
      }
      await loadLearnAdminItems();
      return;
    }

    const uid = await sbUserId();
    if(!uid){
      window.fwToast?.("Connexion", "Reconnecte-toi puis réessaie.");
      return;
    }

    if(editingId){
      const payloadWithDiff = { kind, lang, difficulty, title, prompt, answer, updated_at: nowIso };
      const payloadNoDiff = { kind, lang, title, prompt, answer, updated_at: nowIso };
      let up = await sb
        .from(LEARNING_TABLE)
        .update(payloadWithDiff)
        .eq("company", company)
        .eq("id", editingId);

      if(up.error){
        const code = String(up.error?.code || "");
        const msg = String(up.error?.message || "").toLowerCase();
        const missingDifficulty = (code === "42703") || (msg.includes("difficulty") && msg.includes("does not exist"));
        if(missingDifficulty){
          window.fwToast?.("Supabase", "Schéma à mettre à jour (colonne difficulty).");
          up = await sb
            .from(LEARNING_TABLE)
            .update(payloadNoDiff)
            .eq("company", company)
            .eq("id", editingId);
        }
      }

      if(up.error){
        const code = String(up.error?.code || "");
        if(code === "23505"){
          window.fwToast?.("Doublon", "Un item avec ce titre existe déjà (même type + langage).");
          return;
        }
        sbToastError("Enregistrer", up.error);
        return;
      }
      window.fwToast?.("Enregistré", "Item mis à jour.");
    }else{
      const id = uuid();
      const payloadWithDiff = { id, company, author_id: uid, kind, lang, difficulty, title, prompt, answer, created_at: nowIso, updated_at: nowIso };
      const payloadNoDiff = { id, company, author_id: uid, kind, lang, title, prompt, answer, created_at: nowIso, updated_at: nowIso };
      let ins = await sb
        .from(LEARNING_TABLE)
        .insert(payloadWithDiff);

      if(ins.error){
        const code = String(ins.error?.code || "");
        const msg = String(ins.error?.message || "").toLowerCase();
        const missingDifficulty = (code === "42703") || (msg.includes("difficulty") && msg.includes("does not exist"));
        if(missingDifficulty){
          window.fwToast?.("Supabase", "Schéma à mettre à jour (colonne difficulty).");
          ins = await sb
            .from(LEARNING_TABLE)
            .insert(payloadNoDiff);
        }
      }

      if(ins.error){
        const code = String(ins.error?.code || "");
        if(code === "23505"){
          window.fwToast?.("Doublon", "Un item avec ce titre existe déjà (même type + langage).");
          return;
        }
        sbToastError("Créer", ins.error);
        return;
      }
      learnAdminModalState.editingId = id;
      window.fwToast?.("Ajouté", "Item créé.");
    }

    await loadLearnAdminItems();
  }

  async function generateLearnAdminItemWithAi(){
    const overlay = getLearnAdminOverlay();
    if(!overlay) return;
    if(!isAdmin()){
      window.fwToast?.("Admin", "Accès réservé.");
      return;
    }

    const kind = normalizeLearnKind($("#learnAdminKind", overlay)?.value || "exercise");
    const lang = normalizeLearnLang($("#learnAdminLang", overlay)?.value || "html");
    const difficulty = normalizeLearnDifficulty($("#learnAdminDifficulty", overlay)?.value || "beginner");

    const topic = (prompt("Sujet/thème de l'exercice à générer (ex: flexbox, DOM, SELECT…)", "flexbox") || "").trim();
    if(!topic) return;

    const btn = $("#learnAdminGenerate", overlay);
    const oldText = btn?.textContent || "";
    if(btn) btn.disabled = true;
    btn && (btn.textContent = "Génération…");
    window.fwToast?.("IA", "Génération en cours…");

    function stripCodeFences(raw){
      let s = String(raw || "").trim();
      s = s.replace(/^```(?:json)?\s*/i, "");
      s = s.replace(/```$/i, "");
      return s.trim();
    }

    function extractJsonObject(raw){
      const s = stripCodeFences(raw);
      if(s.startsWith("{") && s.endsWith("}")) return s;
      const m = s.match(/\{[\s\S]*\}/);
      return m ? m[0] : "";
    }

    async function callAi(context, messages){
      const res = await fetch("/.netlify/functions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: context || null,
          messages: Array.isArray(messages) ? messages : [],
        }),
      });
      let data = {};
      try{ data = await res.json(); }catch(e){ data = {}; }
      if(!res.ok){
        const msg = String(data?.error || "").trim();
        if(res.status === 404) throw new Error("IA indisponible en local. Déploie sur Netlify (ou utilise netlify dev).");
        if(res.status === 501) throw new Error(msg || "OPENAI_API_KEY manquant sur Netlify.");
        throw new Error(msg || `Erreur IA (${res.status}).`);
      }
      return String(data?.output || "").trim();
    }

    try{
      const kindLabel = (kind === "tutorial") ? "tutoriel" : "exercice";
      const diffLabel = (difficulty === "advanced") ? "avancé" : (difficulty === "intermediate") ? "intermédiaire" : "débutant";
      const langLabel = (lang === "js") ? "JavaScript" : (lang || "HTML").toUpperCase();

      const instruction = [
        `Génère 1 ${kindLabel} (${langLabel}, niveau ${diffLabel}).`,
        `Sujet: ${topic}`,
        "",
        "Retourne UNIQUEMENT du JSON valide (sans markdown, sans ```).",
        "Format: {\"title\":\"…\",\"prompt\":\"…\",\"answer\":\"…\"}",
        "",
        "Contraintes:",
        "- title: court et clair (max 60 caractères).",
        "- prompt: commence par \"Question :\" puis donne une consigne en 3–6 étapes.",
        "- answer: une solution correcte et concise (code si HTML/CSS/JS/PHP, requête si SQL).",
      ].join("\n");

      const out = await callAi(
        { kind, lang, difficulty, title: `${topic}`, prompt: "" },
        [{ role: "user", content: instruction }]
      );

      const jsonStr = extractJsonObject(out);
      let obj = null;
      try{ obj = jsonStr ? JSON.parse(jsonStr) : null; }catch(e){ obj = null; }

      const titleEl = $("#learnAdminTitle", overlay);
      const promptEl = $("#learnAdminPrompt", overlay);
      const answerEl = $("#learnAdminAnswer", overlay);

      if(!obj || typeof obj !== "object"){
        promptEl && (promptEl.value = `Question : ${topic}\n\n(IA) Réponse brute:\n${out}`);
        answerEl && (answerEl.value = "");
        window.fwToast?.("IA", "Réponse non parsable. Je l'ai collée dans le champ Consigne.");
        return;
      }

      learnAdminModalState.editingId = "";
      titleEl && (titleEl.value = String(obj.title || "").trim() || `${langLabel} — ${topic}`);
      promptEl && (promptEl.value = String(obj.prompt || "").trim() || `Question : ${topic}`);
      answerEl && (answerEl.value = String(obj.answer || "").trim());

      window.fwToast?.("IA", "Exercice généré. Vérifie puis clique sur Enregistrer.");
      titleEl?.focus?.();
    }catch(err){
      window.fwToast?.("IA", String(err?.message || err || "Erreur IA."));
    }finally{
      if(btn){
        btn.disabled = false;
        btn.textContent = oldText || "🤖 Générer";
      }
    }
  }

  async function deleteLearnAdminItem(){
    const overlay = getLearnAdminOverlay();
    if(!overlay) return;
    if(!isAdmin()){
      window.fwToast?.("Admin", "Accès réservé.");
      return;
    }

    const id = String(learnAdminModalState.editingId || "");
    if(!id){
      window.fwToast?.("Sélection", "Choisis un item.");
      return;
    }

    const ok = confirm("Supprimer cet item ?");
    if(!ok) return;

    const company = companyFromUser();

    if(!sbEnabled){
      const all = loadLearningItemsLocal().filter(x=> !(String(x?.id || "") === id && String(x?.company || "") === company));
      saveLearningItemsLocal(all);
      learnAdminModalState.editingId = "";
      setLearnAdminFormValues(null);
      window.fwToast?.("Supprimé", "Item supprimé (local).");
      await loadLearnAdminItems();
      return;
    }

    const del = await sb
      .from(LEARNING_TABLE)
      .delete()
      .eq("company", company)
      .eq("id", id);
    if(del.error){
      sbToastError("Supprimer", del.error);
      return;
    }
    learnAdminModalState.editingId = "";
    setLearnAdminFormValues(null);
    window.fwToast?.("Supprimé", "Item supprimé.");
    await loadLearnAdminItems();
  }

  function bindLearningAdminModalUI(){
    const overlay = getLearnAdminOverlay();
    if(!overlay || learnAdminModalState.bound) return;
    learnAdminModalState.bound = true;

    overlay.addEventListener("click", (e)=>{
      if(e.target === overlay) closeLearningAdminModal();
    });
    $("[data-learn-admin-close]", overlay)?.addEventListener("click", ()=> closeLearningAdminModal());

    window.addEventListener("keydown", (e)=>{
      if(e.key !== "Escape") return;
      if(overlay.classList.contains("hidden")) return;
      closeLearningAdminModal();
    });

    $("#learnAdminNew", overlay)?.addEventListener("click", ()=>{
      learnAdminModalState.editingId = "";
      setLearnAdminFormValues(null);
      renderLearnAdminList();
      $("#learnAdminTitle", overlay)?.focus?.();
    });

    $("#learnAdminSeed", overlay)?.addEventListener("click", ()=> addLearningExamples());
    $("#learnAdminGenerate", overlay)?.addEventListener("click", ()=> generateLearnAdminItemWithAi());

    $("#learnAdminSearch", overlay)?.addEventListener("input", ()=>{
      learnAdminModalState.q = String($("#learnAdminSearch", overlay)?.value || "");
      renderLearnAdminList();
    });

    $("#learnAdminKindFilters", overlay)?.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-la-kind]");
      if(!btn) return;
      learnAdminModalState.kind = String(btn.getAttribute("data-la-kind") || "");
      renderLearnAdminList();
    });

    $("#learnAdminLangFilters", overlay)?.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-la-lang]");
      if(!btn) return;
      learnAdminModalState.lang = String(btn.getAttribute("data-la-lang") || "");
      renderLearnAdminList();
    });

    $("#learnAdminList", overlay)?.addEventListener("click", (e)=>{
      const id = e.target.closest("[data-la-edit]")?.getAttribute("data-la-edit") || "";
      if(!id) return;
      learnAdminModalState.editingId = id;
      const it = (learnAdminModalState.items || []).find(x=> String(x?.id || "") === id) || null;
      setLearnAdminFormValues(it);
      renderLearnAdminList();
    });

    $("#learnAdminForm", overlay)?.addEventListener("submit", saveLearnAdminForm);
    $("#learnAdminDelete", overlay)?.addEventListener("click", deleteLearnAdminItem);
  }

  function countChannelsLocal(map){
    const m = map || {};
    const keys = ["public", "private", "voice"];
    return keys.reduce((acc, k)=> acc + (Array.isArray(m[k]) ? m[k].length : 0), 0);
  }

  async function deleteTutorialPostById(postId){
    const id = String(postId || "").trim();
    if(!id) return false;

    if(sbEnabled){
      const uid = await sbUserId();
      if(!uid){
        window.fwSupabase?.requireAuth?.({ redirectTo: loginHref() });
        return false;
      }
      const company = companyFromUser();

      let fileUrl = "";
      const pre = await sb
        .from("tutorial_posts")
        .select("file_url")
        .eq("company", company)
        .eq("id", id)
        .maybeSingle();
      if(!pre.error) fileUrl = String(pre.data?.file_url || "");

      const res = await sb
        .from("tutorial_posts")
        .delete()
        .eq("company", company)
        .eq("id", id);
      if(res.error){
        sbToastError("Suppression", res.error);
        return false;
      }

      const sbUrl = parseSbStorageUrl(fileUrl);
      if(sbUrl){
        try{ await sb.storage.from(sbUrl.bucket).remove([sbUrl.path]); }catch(e){ /* ignore */ }
      }

      window.fwToast?.("Supprimé","Le post tutoriel a été retiré.");
      return true;
    }

    const next = loadTutorialPosts().filter(x=> String(x.id) !== String(id));
    saveTutorialPosts(next);
    window.fwToast?.("Supprimé","Le post tutoriel a été retiré.");
    return true;
  }

  function dashCardHtml({ href, icon, title, desc, meta }){
    return `
      <a class="tut-card" href="${escapeHtml(href || "#")}">
        <div class="tut-card-ico" aria-hidden="true">${escapeHtml(icon || "")}</div>
        <div class="tut-card-main">
          <div class="tut-card-title">${escapeHtml(title || "")}</div>
          <div class="tut-card-desc">${escapeHtml(desc || "")}</div>
          ${meta ? `<div class="tut-card-meta"><span class="badge">${escapeHtml(meta)}</span></div>` : ""}
        </div>
        <div class="tut-card-go" aria-hidden="true">↗</div>
      </a>
    `;
  }

  function dashItemHtml({ icon, title, sub, delAttr, delId }){
    return `
      <div class="file-box" style="margin-top:0; cursor:default">
        <div class="file-left" style="min-width:0">
          <div class="file-ico" aria-hidden="true">${escapeHtml(icon || "")}</div>
          <div class="file-meta" style="min-width:0">
            <div class="file-title truncate">${escapeHtml(title || "Sans titre")}</div>
            <div class="file-sub truncate">${escapeHtml(sub || "")}</div>
          </div>
        </div>
        <div class="row" style="gap:8px; align-items:center">
          ${delAttr && delId ? `<button class="btn small ghost" type="button" ${delAttr}="${escapeHtml(delId)}" title="Supprimer">🗑️</button>` : ""}
        </div>
      </div>
    `;
  }

  function adminDashboardHtml({ modeLabel, rolesCount, membersCount, channelsCount, postsCount, tutPostsCount, learnCount, recentPosts, recentTutPosts }){
    const mode = modeLabel ? ` • ${modeLabel}` : "";
    const posts = Array.isArray(recentPosts) ? recentPosts : [];
    const tuts = Array.isArray(recentTutPosts) ? recentTutPosts : [];
    const learnTotal = Number.isFinite(Number(learnCount)) ? Number(learnCount) : 0;

    return `
      <div class="badge">Admin</div>
      <div class="row" style="justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-top:10px">
        <div>
          <h2 style="margin:0; font-size:26px">Tableau de bord</h2>
          <p class="page-sub">Gère FaceWork depuis ici${escapeHtml(mode)}.</p>
        </div>
        <div class="row" style="gap:8px; flex-wrap:wrap">
          <button class="btn small" type="button" data-admin-action="manageLearning">🧠 Gérer exercices</button>
          <button class="btn small" type="button" data-admin-action="manageReports">🚩 Signalements</button>
          <button class="btn small primary" type="button" data-admin-action="createRole">＋ Rôle</button>
          <button class="btn small" type="button" data-admin-action="createMember">＋ Membre</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row" style="gap:10px; flex-wrap:wrap">
        <span class="pill">Rôles: <strong>${escapeHtml(String(rolesCount ?? 0))}</strong></span>
        <span class="pill">Membres: <strong>${escapeHtml(String(membersCount ?? 0))}</strong></span>
        <span class="pill">Canaux: <strong>${escapeHtml(String(channelsCount ?? 0))}</strong></span>
        <span class="pill">Publications: <strong>${escapeHtml(String(postsCount ?? 0))}</strong></span>
        <span class="pill">Posts tutoriel: <strong>${escapeHtml(String(tutPostsCount ?? 0))}</strong></span>
        <span class="pill">Exercices/tutos: <strong>${escapeHtml(String(learnTotal))}</strong></span>
      </div>

      <div class="spacer" style="height:14px"></div>

      <div class="side-title" style="margin-top:8px"><span>Accès rapide</span></div>
      <div class="tut-grid" style="grid-template-columns: repeat(2, 1fr)">
        ${dashCardHtml({ href:"feed.html", icon:"📰", title:"Publications", desc:"Créer, supprimer et suivre les posts.", meta:`${postsCount ?? 0} post(s)` })}
        ${dashCardHtml({ href:"channels.html", icon:"#", title:"Canaux", desc:"Créer/organiser les salons.", meta:`${channelsCount ?? 0} canal(aux)` })}
        ${dashCardHtml({ href:"messages.html", icon:"💬", title:"Messages", desc:"Discussions privées et notifications." })}
        ${dashCardHtml({ href:"../tutoriel.html", icon:"📘", title:"Tutoriel", desc:"Guides + posts ressources.", meta:`${tutPostsCount ?? 0} post(s)` })}
        ${dashCardHtml({ href:"../exercices.html", icon:"🧠", title:"Exercices", desc:"Hub d’exos et mini‑projets." })}
        ${dashCardHtml({ href:"../tutos.html", icon:"🧩", title:"Tutos", desc:"Articles et pages pas‑à‑pas." })}
        ${dashCardHtml({ href:"../langages.html", icon:"📚", title:"Langages", desc:"Hubs par langage et ressources." })}
        ${dashCardHtml({ href:"settings.html", icon:"⚙️", title:"Paramètres", desc:"Profil, thème et options." })}
      </div>

      <div class="spacer" style="height:18px"></div>

      <div class="grid2">
        <section class="card panel" style="margin:0">
          <div class="row" style="justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-end">
            <div>
              <div class="badge">Contenu</div>
              <h3 style="margin:10px 0 6px; font-size:22px">Dernières publications</h3>
              <p class="page-sub">Suppression rapide depuis le tableau de bord.</p>
            </div>
            <a class="btn small" href="feed.html">Ouvrir</a>
          </div>
          <div class="hr"></div>
          <div class="col" style="gap:10px">
            ${posts.length ? posts.map(p=> dashItemHtml({
              icon: "📰",
              title: p.title || "Publication",
              sub: p.sub || "",
              delAttr: "data-admin-del-post",
              delId: p.id,
            })).join("") : `<div class="callout" style="margin:0"><strong>Aucune publication.</strong></div>`}
          </div>
        </section>

        <section class="card panel" style="margin:0">
          <div class="row" style="justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-end">
            <div>
              <div class="badge">Tutoriel</div>
              <h3 style="margin:10px 0 6px; font-size:22px">Posts ressources</h3>
              <p class="page-sub">Les fichiers/snippets visibles dans le tutoriel.</p>
            </div>
            <a class="btn small" href="../tutoriel.html">Ouvrir</a>
          </div>
          <div class="hr"></div>
          <div class="col" style="gap:10px">
            ${tuts.length ? tuts.map(p=> dashItemHtml({
              icon: "📎",
              title: p.title || "Ressource",
              sub: p.sub || "",
              delAttr: "data-admin-del-tut",
              delId: p.id,
            })).join("") : `<div class="callout" style="margin:0"><strong>Aucun post tutoriel.</strong></div>`}
          </div>
        </section>
      </div>
    `;
  }

  function bindAdminDashboardHandlers(){
    const main = $("#adminMain");
    if(!main || main.__dashBound) return;
    main.__dashBound = true;

    main.addEventListener("click", async (e)=>{
      const action = e.target.closest("[data-admin-action]")?.getAttribute("data-admin-action");
      if(action === "createRole"){
        const btn = $("#createRole");
        if(btn?.disabled){
          window.fwToast?.("Accès refusé","Tu n'as pas la permission de créer un rôle.");
          return;
        }
        btn?.click?.();
        return;
      }
      if(action === "createMember"){
        const btn = $("#createMember");
        if(btn?.disabled){
          window.fwToast?.("Accès refusé","Tu n'as pas la permission d'ajouter un membre.");
          return;
        }
        btn?.click?.();
        return;
      }
      if(action === "manageLearning"){
        openLearningAdminModal();
        return;
      }
      if(action === "manageReports"){
        openReportsAdminModal();
        return;
      }

      const delPostId = e.target.closest("[data-admin-del-post]")?.getAttribute("data-admin-del-post");
      if(delPostId){
        const ok = confirm("Supprimer cette publication ?");
        if(!ok) return;
        await deletePostById(delPostId);
        sbEnabled ? renderAdminSupabase() : renderAdmin();
        return;
      }

      const delTutId = e.target.closest("[data-admin-del-tut]")?.getAttribute("data-admin-del-tut");
      if(delTutId){
        const ok = confirm("Supprimer ce post tutoriel ?");
        if(!ok) return;
        await deleteTutorialPostById(delTutId);
        sbEnabled ? renderAdminSupabase() : renderAdmin();
      }
    });
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

    const avatarUrl = safeMediaUrl(m.avatarUrl);
    const avatarBg = safeAvatarBg(m.avatarBg, avatarBgFor(m.name));
    const avatar = avatarUrl
      ? `<div class="avatar lg"><img src="${escapeHtml(avatarUrl)}" alt=""/></div>`
      : `<div class="avatar lg" style="background:${escapeHtml(avatarBg)}">${escapeHtml(initials(m.name))}</div>`;

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
    const setDefaultActive = ()=> "dash";
    if(!active) active = setDefaultActive();
    if(!active){
      main.innerHTML = emptyAdminHtml("🛡️","Aucune donnée","Réinitialise la démo pour recréer des rôles/membres.");
      return;
    }

    const [activeType, activeId] = active.split(":");
    const hasActiveDash = activeType === "dash";
    const hasActiveRole = activeType === "role" && sortedRoles.some(r=> String(r.id) === String(activeId));
    const hasActiveMember = activeType === "member" && sortedMembers.some(m=> String(m.id) === String(activeId));
    if(!hasActiveDash && !hasActiveRole && !hasActiveMember){
      active = setDefaultActive();
    }
    localStorage.setItem(ADMIN_ACTIVE_KEY, active);

    const dashBtn = $("#adminDashboardBtn");
    const dashBadge = $("#adminDashboardBadge");
    if(dashBtn) dashBtn.classList.toggle("active", String(active).split(":")[0] === "dash");
    if(dashBadge){
      dashBadge.textContent = canManage ? String(loadPosts().length + loadTutorialPosts().length) : "🔒";
    }
    if(dashBtn && !dashBtn.__bound){
      dashBtn.__bound = true;
      dashBtn.addEventListener("click", ()=>{
        localStorage.setItem(ADMIN_ACTIVE_KEY, "dash");
        renderAdmin();
      });
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

    if(type === "dash"){
      const postsAll = loadPosts();
      const tutsAll = loadTutorialPosts();
      const company = companyFromUser();
      const learnAll = loadLearningItemsLocal().filter(x=> String(x?.company || "") === company);
      const recentPosts = postsAll
        .slice()
        .reverse()
        .slice(0, 5)
        .map(p=>({
          id: String(p?.id || ""),
          title: String(p?.title || "Publication"),
          sub: `${String(p?.author || "Utilisateur")} • ${String(p?.createdAt || "")}`.trim(),
        }))
        .filter(x=>x.id);
      const recentTuts = tutsAll
        .slice()
        .reverse()
        .slice(0, 5)
        .map(p=>({
          id: String(p?.id || ""),
          title: String(p?.title || "Ressource"),
          sub: fmtTs(p?.created_at || ""),
        }))
        .filter(x=>x.id);

      main.innerHTML = adminDashboardHtml({
        modeLabel: "Démo locale",
        rolesCount: roles.length,
        membersCount: members.length,
        channelsCount: countChannelsLocal(loadChannels()),
        postsCount: postsAll.length,
        tutPostsCount: tutsAll.length,
        learnCount: learnAll.length,
        recentPosts,
        recentTutPosts: recentTuts,
      });
      bindAdminDashboardHandlers();
      return;
    }

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
    const setDefaultActive = ()=> "dash";
    if(!active) active = setDefaultActive();

    const [activeType, activeId] = active.split(":");
    const validDash = activeType === "dash";
    const validRole = activeType === "role" && sortedRoles.some(r=> String(r.id) === String(activeId));
    const validMember = activeType === "member" && sortedMembers.some(m=> String(m.id) === String(activeId));
    if(!validDash && !validRole && !validMember){
      active = setDefaultActive();
    }
    localStorage.setItem(ADMIN_ACTIVE_KEY, active);

    const dashBtn = $("#adminDashboardBtn");
    const dashBadge = $("#adminDashboardBadge");
    if(dashBtn) dashBtn.classList.toggle("active", String(active).split(":")[0] === "dash");
    if(dashBadge) dashBadge.textContent = canManage ? "OK" : "🔒";
    if(dashBtn && !dashBtn.__sbBound){
      dashBtn.__sbBound = true;
      dashBtn.addEventListener("click", ()=>{
        localStorage.setItem(ADMIN_ACTIVE_KEY, "dash");
        renderAdminSupabase();
      });
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

    if(type === "dash"){
      let postsCount = 0;
      let tutPostsCount = 0;
      let channelsCount = 0;
      let learnCount = 0;

      let posts = [];
      let tuts = [];

      const [postsRes, tutsRes, chansRes, learnRes] = await Promise.all([
        sb
          .from("posts")
          .select("id,title,created_at,author_id", { count: "exact" })
          .eq("company", company)
          .order("created_at", { ascending: false })
          .limit(5),
        sb
          .from("tutorial_posts")
          .select("id,title,created_at,author_id", { count: "exact" })
          .eq("company", company)
          .order("created_at", { ascending: false })
          .limit(5),
        sb
          .from("channels")
          .select("id", { count: "exact", head: true })
          .eq("company", company),
        sb
          .from(LEARNING_TABLE)
          .select("id", { count: "exact", head: true })
          .eq("company", company),
      ]);

      if(postsRes?.error){
        sbToastError("Publications", postsRes.error);
      }else{
        posts = postsRes.data || [];
        postsCount = Number.isFinite(postsRes.count) ? postsRes.count : posts.length;
      }

      if(tutsRes?.error){
        // Table may not exist yet if schema.sql wasn't applied.
        const code = String(tutsRes.error?.code || "");
        const msg = String(tutsRes.error?.message || "");
        if(code !== "42P01" && !msg.toLowerCase().includes("does not exist")){
          sbToastError("Tutoriel", tutsRes.error);
        }
      }else{
        tuts = tutsRes.data || [];
        tutPostsCount = Number.isFinite(tutsRes.count) ? tutsRes.count : tuts.length;
      }

      if(chansRes?.error){
        sbToastError("Canaux", chansRes.error);
      }else{
        channelsCount = Number.isFinite(chansRes.count) ? chansRes.count : 0;
      }

      if(learnRes?.error){
        const code = String(learnRes.error?.code || "");
        const msg = String(learnRes.error?.message || "");
        if(code !== "42P01" && !msg.toLowerCase().includes("does not exist")){
          sbToastError("Exercices", learnRes.error);
        }
      }else{
        learnCount = Number.isFinite(learnRes.count) ? learnRes.count : 0;
      }

      const authorIds = Array.from(new Set(
        [...(posts || []), ...(tuts || [])]
          .map(p=> p?.author_id)
          .filter(Boolean)
          .map(String)
      ));
      let authorById = new Map();
      if(authorIds.length){
        const prof = await sb
          .from("profiles")
          .select("id,name")
          .in("id", authorIds);
        if(!prof.error){
          authorById = new Map((prof.data || []).map(a=> [String(a.id), a]));
        }
      }

      const recentPosts = (posts || [])
        .map(p=>({
          id: String(p?.id || ""),
          title: String(p?.title || "Publication"),
          sub: `${String(authorById.get(String(p?.author_id || ""))?.name || "Utilisateur")} • ${fmtTs(p?.created_at || "")}`,
        }))
        .filter(x=>x.id);
      const recentTuts = (tuts || [])
        .map(p=>({
          id: String(p?.id || ""),
          title: String(p?.title || "Ressource"),
          sub: `${String(authorById.get(String(p?.author_id || ""))?.name || "Utilisateur")} • ${fmtTs(p?.created_at || "")}`,
        }))
        .filter(x=>x.id);

      main.innerHTML = adminDashboardHtml({
        modeLabel: "Supabase",
        rolesCount: roles.length,
        membersCount: members.length,
        channelsCount,
        postsCount,
        tutPostsCount,
        learnCount,
        recentPosts,
        recentTutPosts: recentTuts,
      });
      bindAdminDashboardHandlers();
      return;
    }

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
    const url = safeMediaUrl(user && user.avatarUrl);
    const bg = safeAvatarBg(user && user.avatarBg, avatarBgFor(name));
    if(url) return `<div class="avatar msg-avatar"><img src="${escapeHtml(url)}" alt=""/></div>`;
    const style = ` style="background:${escapeHtml(bg)}"`;
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

  const CHAT_EMOJIS = [
    "😀","😁","😂","🤣","😅","😊","😍","😘","😎","🤩","🤔","😴","😮","😱","😤","😭","😡","🤯","🥳","👍",
    "👎","🙏","👏","🙌","🤝","🔥","💯","✨","💡","🎉","🎯","✅","❌","⚠️","⭐","🚀","📌","🧠","💻","📎",
    "🖼️","🎞️","🧪","🛠️","🧩","📚","📝","🔒","🔓","🕒","📣","💬","❤️","🩷","🫶","😺","🙈","🤖","👀",
  ];
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
            <button class="btn icon ghost" type="button" title="Visio" data-chat-call>📹</button>
            <button class="btn icon ghost" type="button" title="Rechercher" data-chat-search>🔎</button>
            <button class="btn icon ghost" type="button" title="Infos" data-chat-info>ℹ️</button>
          </div>
        </div>

        <div class="chat-messages" id="chatMsgs"></div>

        <div class="chat-attach hidden" id="chatAttach" aria-live="polite">
          <div class="chat-attach-left">
            <span class="badge" id="chatAttachBadge">📎 Fichier</span>
            <div class="chat-attach-label truncate" id="chatAttachLabel">Aucun fichier</div>
          </div>
          <button class="btn small ghost" type="button" data-chat-attach-clear>Retirer</button>
        </div>

        <form class="chat-composer" id="chatForm" autocomplete="off">
          <input id="chatFile" type="file" class="sr-only"/>
          <button class="btn icon ghost" type="button" title="Ajouter un fichier" data-chat-add>＋</button>
          <button class="btn icon ghost" type="button" title="Emojis" aria-label="Emojis" data-chat-emoji>😊</button>
          <button class="btn icon ghost" type="button" title="GIF" aria-label="GIF" data-chat-gif><span class="gif-ico">GIF</span></button>
          <textarea class="chat-input" id="chatInput" rows="1" placeholder="${escapeHtml(placeholder || "Écrire un message…")}"></textarea>
          <button class="btn primary send" type="submit">Envoyer</button>
        </form>

        <div class="chat-pop hidden" id="chatEmojiPop" data-chat-pop="emoji" role="dialog" aria-label="Emojis">
          <div class="chat-pop-head">
            <div class="badge">Emojis</div>
            <button class="btn icon ghost" type="button" aria-label="Fermer" data-chat-pop-close>✕</button>
          </div>
          <div class="chat-emoji-grid" role="list">
            ${CHAT_EMOJIS.map(e=> `<button class="emoji-btn" type="button" data-emoji="${escapeHtml(e)}" aria-label="${escapeHtml(e)}">${escapeHtml(e)}</button>`).join("")}
          </div>
        </div>

        <div class="chat-pop hidden" id="chatGifPop" data-chat-pop="gif" role="dialog" aria-label="GIF">
          <div class="chat-pop-head">
            <div class="badge">GIF</div>
            <button class="btn icon ghost" type="button" aria-label="Fermer" data-chat-pop-close>✕</button>
          </div>
          <div class="chat-pop-body">
            <div class="row" style="gap:8px; align-items:center">
              <input class="input" type="search" placeholder="Rechercher un GIF" data-chat-gif-search />
              <button class="btn small hidden" type="button" data-chat-gif-more>Plus</button>
            </div>
            <div class="chat-gif-grid" data-chat-gif-grid role="list"></div>
            <div class="row" style="justify-content:space-between; align-items:center; gap:10px; margin-top:8px">
              <div class="muted chat-gif-status hidden" data-chat-gif-status style="font-size:12px; font-weight:800">—</div>
              <a class="muted chat-gif-powered" href="https://tenor.com/" target="_blank" rel="noopener">Powered by Tenor</a>
            </div>

            <div class="hr" style="margin:12px 0"></div>

            <div class="row" style="gap:8px; align-items:center">
              <input class="input" type="url" inputmode="url" placeholder="Lien direct vers un GIF (.gif)" data-chat-gif-url />
              <button class="btn small primary" type="button" data-chat-gif-add>Ajouter</button>
            </div>
            <div class="muted" style="font-size:12px; font-weight:800; margin-top:8px">
              Astuce : envoie aussi un fichier GIF via <span class="kbd">＋</span>.
            </div>
          </div>
        </div>
      </div>
    `;
  }
  function renderChatMessageHtml(message, user, idx){
    const m = message || {};
    const fromRaw = String(m.from || "Utilisateur");
    const isMe = fromRaw === "Moi" || fromRaw === (user?.name || "");
    const system = !!m.system;
    const name = system ? "Système" : (isMe ? (user?.name || "Moi") : fromRaw);
    const time = shortAt(m.at || "");
    const text = String(m.text || "");
    const fileName = String(m.fileName || m.file_name || "");
    const fileUrl = String(m.fileUrl || m.file_url || "");
    const fileDataUrl = String(m.fileData?.dataUrl || "");
    const hasFile = !!(fileName || fileUrl || fileDataUrl);
    const fileLabel = fileName || (fileUrl ? (String(fileUrl).split("/").pop() || "Fichier") : "Fichier");
    const isImg = hasFile && isProbablyImageAttachment({ fileName, fileUrl, fileDataUrl });
    const imgSrc = isImg ? attachmentImgSrc({ fileUrl, fileDataUrl }) : "";
    const canDelete = isAdmin() && !system;
    const canReport = !system;

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
            ${canReport ? `<button class="btn small ghost" type="button" title="Signaler" aria-label="Signaler" data-msg-report="${escapeHtml(String(idx ?? ""))}">🚩</button>` : ""}
            ${canDelete ? `<button class="btn small ghost" type="button" title="Supprimer" aria-label="Supprimer" data-msg-del="${escapeHtml(String(idx ?? ""))}">🗑️</button>` : ""}
          </div>
          ${text ? `<div class="msg-text">${escapeHtml(text)}</div>` : ""}
          ${hasFile ? (isImg && imgSrc ? `
            <button class="media-box msg-file" type="button" data-open-file="${escapeHtml(String(idx ?? ""))}">
              <img class="media-img" alt="" loading="lazy" src="${escapeHtml(imgSrc)}"/>
              <div class="media-bar">
                <div class="media-name">${escapeHtml(fileLabel || "Image")}</div>
                <span class="badge">Ouvrir</span>
              </div>
            </button>
          ` : `
            <button class="file-box msg-file" type="button" data-open-file="${escapeHtml(String(idx ?? ""))}">
              <div class="file-left">
                <div class="file-ico" aria-hidden="true">📄</div>
                <div class="file-meta">
                  <div class="file-title">Ouvrir le fichier</div>
                  <div class="file-sub">${escapeHtml(fileLabel)}</div>
                </div>
              </div>
              <span class="badge">Ouvrir</span>
            </button>
          `) : ""}
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
  function safeMediaUrl(raw){
    const s = String(raw || "").trim();
    if(!s) return "";
    const compact = s.replace(/[\u0000-\u0020\u007f]+/g, "");
    const lower = compact.toLowerCase();
    if(lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return "";
    if(lower.startsWith("data:")) return /^data:image\//i.test(lower) ? s : "";
    if(lower.startsWith("blob:")) return s;
    try{
      const u = new URL(s, window.location.href);
      if(u.protocol === "http:" || u.protocol === "https:" || u.protocol === "file:") return u.href;
      return "";
    }catch(e){
      return "";
    }
  }
  function safeAvatarBg(raw, fallback = ""){
    const s = String(raw || "").trim();
    if(!s) return fallback;
    if(s.length > 180) return fallback;
    if(/[;"<>]/.test(s) || /url\s*\(/i.test(s)) return fallback;
    if(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
    if(/^rgba?\([0-9.,%\s]+\)$/i.test(s)) return s;
    if(/^hsla?\([0-9.,%\s]+\)$/i.test(s)) return s;
    if(/^linear-gradient\([^)]+\)$/i.test(s)) return s;
    return fallback;
  }
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (m)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }
})();

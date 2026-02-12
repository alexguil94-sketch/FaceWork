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
})();


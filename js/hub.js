/* FaceWork static — hub pages helpers (search + counter) */
(function(){
  const search = document.getElementById("hubSearch");
  const items = Array.from(document.querySelectorAll("[data-hub-item][data-hub-title]"));
  const counter = document.getElementById("hubCount");
  const empty = document.getElementById("hubEmpty");

  if(!search || items.length === 0) return;

  const baseLabel = counter?.getAttribute("data-hub-label") || "section(s)";

  function applyFilter(){
    const q = String(search.value || "").trim().toLowerCase();
    let shown = 0;

    items.forEach(el => {
      const hay = (el.getAttribute("data-hub-title") || "") + " " + (el.textContent || "");
      const match = !q || hay.toLowerCase().includes(q);
      el.style.display = match ? "" : "none";
      if(match) shown++;
    });

    if(counter){
      counter.textContent = q ? `${shown}/${items.length} résultat(s)` : `${items.length} ${baseLabel}`;
    }

    if(empty){
      empty.classList.toggle("hidden", shown !== 0);
    }
  }

  search.addEventListener("input", applyFilter);
  applyFilter();
})();

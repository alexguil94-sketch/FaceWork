(function(){
  const btn = document.querySelector("[data-print-cv]");
  if(!btn) return;
  btn.addEventListener("click", ()=> window.print());
})();

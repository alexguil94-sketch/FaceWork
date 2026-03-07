(function(){
  const { $ } = window.fw || {};
  if(!$) return;

  const titleEl = $("#confirmTitle");
  const textEl = $("#confirmText");
  const ctaEl = $("#confirmCta");

  function setState(title, text, href, label){
    if(titleEl) titleEl.textContent = title;
    if(textEl) textEl.textContent = text;
    if(ctaEl){
      ctaEl.href = href || "login.html";
      ctaEl.textContent = label || "Retour a la connexion";
    }
  }

  function errorMessage(code){
    if(code === "expired_token"){
      return "Ce lien a expire. Demande un nouvel email depuis la page de connexion.";
    }
    if(code === "stale_token"){
      return "Ce lien ne correspond plus a l'email actuel du compte.";
    }
    return "Ce lien est invalide ou ne peut plus etre utilise.";
  }

  async function run(){
    const token = new URLSearchParams(window.location.search || "").get("token");
    if(!token){
      setState("Lien incomplet", "Aucun token de confirmation n'a ete trouve dans l'URL.", "login.html?confirm_error=missing_token", "Retour a la connexion");
      return;
    }

    if(!(window.fwSupabase?.enabled && typeof window.fwSupabase.confirmEmailToken === "function")){
      setState("Supabase non configure", "Cette page a besoin d'une configuration Supabase valide pour confirmer le compte.", "login.html", "Retour a la connexion");
      return;
    }

    setState("Confirmation en cours", "Nous verifions ton lien de confirmation. Cela prend quelques secondes...", "login.html", "Retour a la connexion");

    const result = await window.fwSupabase.confirmEmailToken(token);
    if(result.ok){
      setState("Email confirme", "Ton compte est maintenant actif. Redirection vers la page de connexion...", "login.html?confirmed=1", "Se connecter");
      window.fwToast?.("Email confirme", "Tu peux maintenant te connecter.");
      setTimeout(()=>{
        window.location.href = "login.html?confirmed=1";
      }, 1200);
      return;
    }

    const code = String(result?.data?.error || result?.error?.message || "invalid_token").trim();
    const href = `login.html?confirm_error=${encodeURIComponent(code)}`;
    setState("Confirmation impossible", errorMessage(code), href, "Retour a la connexion");
  }

  run();
})();

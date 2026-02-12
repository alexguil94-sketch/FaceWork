(function(){
  const { $, setUser } = window.fw || {};
  if(!$) return;

  const form = $("#loginForm");
  if(!form) return;

  function go(){
    window.location.href = "app/feed.html";
  }

  function dateStr(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  }

  function makeUser(email, company){
    const nameGuess = (email || "utilisateur").split("@")[0].replace(/[._-]+/g," ").trim();
    const name = nameGuess ? nameGuess.split(/\s+/).map(s=>s[0]?.toUpperCase()+s.slice(1)).join(" ") : "Utilisateur";
    return {
      id: "",
      name,
      company: normCompany(company || "HeroForgeWeb"),
      email: email || "vous@exemple.com",
      role: "admin",
      joinedAt: dateStr(),
      avatarUrl: "",
      avatarBg: "",
    };
  }

  function normCompany(company){
    return String(company || "")
      .trim()
      .replace(/[\\\/]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 60) || "Entreprise";
  }

  // Prefill company
  const companyInput = $("#company");
  if(companyInput && !companyInput.value){
    companyInput.value = window.fwSupabase?.companyDefault || "HeroForgeWeb";
  }

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    const email = $("#email").value.trim();
    const pwd = $("#password").value.trim();
    const company = normCompany($("#company")?.value || window.fwSupabase?.companyDefault || "HeroForgeWeb");
    if(!email || !pwd){
      window.fwToast?.("Champs manquants","Entre un email et un mot de passe.");
      return;
    }
    // Supabase mode
    if(window.fwSupabase?.enabled && window.fwSupabase?.client){
      const sb = window.fwSupabase.client;
      const nameGuess = (email || "utilisateur").split("@")[0].replace(/[._-]+/g," ").trim();
      const name = nameGuess ? nameGuess.split(/\s+/).map(s=>s[0]?.toUpperCase()+s.slice(1)).join(" ") : "Utilisateur";

      window.fwToast?.("Connexion","Connexion à Supabase...");
      const signIn = await sb.auth.signInWithPassword({ email, password: pwd });
      if(signIn.error){
        const msg = String(signIn.error.message || "Connexion impossible").trim();
        const msgLower = msg.toLowerCase();
        window.fwToast?.("Connexion", msg);

        if(msgLower.includes("email not confirmed") || msgLower.includes("not confirmed")){
          const resendOk = confirm("Email non confirmé.\n\n1) Va dans tes emails (spam) et clique le lien.\n2) Ou veux-tu renvoyer l’email de confirmation ?");
          if(!resendOk) return;
          if(typeof sb.auth?.resend === "function"){
            const resend = await sb.auth.resend({ type: "signup", email });
            if(resend.error){
              window.fwToast?.("Renvoyer", resend.error.message || "Impossible de renvoyer l’email.");
              return;
            }
            window.fwToast?.("Envoyé", "Email de confirmation renvoyé. Vérifie ta boîte.");
            return;
          }
          window.fwToast?.("Renvoyer", "Fonction resend indisponible dans cette version.");
          return;
        }

        const create = confirm(`${msg}\n\nCréer un compte avec cet email ?`);
        if(!create) return;

        const signUp = await sb.auth.signUp({
          email,
          password: pwd,
          options: { data: { name, company } },
        });
        if(signUp.error){
          window.fwToast?.("Erreur", signUp.error.message || "Impossible de créer le compte.");
          return;
        }
        if(!signUp.data?.session){
          window.fwToast?.("Vérification email","Compte créé. Vérifie tes emails (spam) puis reconnecte-toi.");
          return;
        }
      }

      const profile = await window.fwSupabase.ensureProfile({ name, company });
      if(!profile){
        const err = window.fwSupabase?.lastError || null;
        const msg = String(err?.message || err?.error_description || "").trim();
        const msgLower = msg.toLowerCase();
        if(err && (String(err.code) === "42501" || msgLower.includes("row-level security"))){
          window.fwToast?.("Accès base refusé","RLS: tu n’es pas authentifié (token manquant) ou l’ID n’est pas le tien. Vérifie que tu es bien connecté, puis relance.");
        } else if(err && msg){
          window.fwToast?.("Supabase", msg);
        } else {
          window.fwToast?.("Schéma Supabase manquant","Applique le fichier SQL (tables + RLS) puis recharge.");
        }
        return;
      }
      await window.fwSupabase.syncLocalUser();
      window.fwToast?.("Connecté","Bienvenue sur FaceWork !");
      setTimeout(go, 450);
      return;
    }

    // Demo mode (localStorage)
    setUser(makeUser(email, company));
    window.fwToast?.("Connecté","Bienvenue sur FaceWork (démo locale) !");
    setTimeout(go, 450);
  });

  $("#btnGoogle")?.addEventListener("click", ()=>{
    setUser(makeUser("alexis.g@heroforgeweb.com", normCompany($("#company")?.value || window.fwSupabase?.companyDefault || "HeroForgeWeb")));
    window.fwToast?.("Connecté via Google","Bienvenue ! (démo)");
    setTimeout(go, 450);
  });

  $("#btnDiscord")?.addEventListener("click", ()=>{
    setUser(makeUser("alexis.g@heroforgeweb.com", normCompany($("#company")?.value || window.fwSupabase?.companyDefault || "HeroForgeWeb")));
    window.fwToast?.("Connecté via Discord","Bienvenue ! (démo)");
    setTimeout(go, 450);
  });
})();

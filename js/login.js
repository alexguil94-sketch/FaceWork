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
        const create = confirm("Compte introuvable ou mauvais mot de passe.\n\nCréer un compte avec cet email ?");
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
          window.fwToast?.("Vérification email","Compte créé. Vérifie tes emails puis reconnecte-toi.");
          return;
        }
      }

      const profile = await window.fwSupabase.ensureProfile({ name, company });
      if(!profile){
        window.fwToast?.("Schéma Supabase manquant","Applique le fichier SQL (tables + RLS) puis recharge.");
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

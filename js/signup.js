(function(){
  const { $, setUser } = window.fw || {};
  if(!$) return;

  const form = $("#signupForm");
  if(!form) return;

  function go(){
    window.location.href = "app/feed.html";
  }

  function dateStr(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function randomId(){
    try{
      if(typeof crypto?.randomUUID === "function") return crypto.randomUUID();
      const a = new Uint32Array(4);
      crypto.getRandomValues(a);
      return Array.from(a).map((n)=> n.toString(16).padStart(8, "0")).join("");
    }catch(e){
      return String(Date.now()) + String(Math.random()).slice(2);
    }
  }

  function normCompany(company){
    return String(company || "")
      .trim()
      .replace(/[\\\/]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 60) || "Entreprise";
  }

  function makeUser(name, email, company){
    const safeEmail = email || "vous@exemple.com";
    const nameGuess = String(name || "").trim() || safeEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
    const pretty = nameGuess
      ? nameGuess.split(/\s+/).map((s)=> (s[0]?.toUpperCase() || "") + s.slice(1)).join(" ")
      : "Utilisateur";
    return {
      id: randomId(),
      name: pretty || "Utilisateur",
      company: normCompany(company || "HeroForgeWeb"),
      email: safeEmail,
      role: "member",
      joinedAt: dateStr(),
      avatarUrl: "",
      avatarBg: "",
    };
  }

  const isSupabaseEnabled = !!(window.fwSupabase?.enabled && window.fwSupabase?.client);

  const nameInput = $("#name");
  const emailInput = $("#email");
  const companyInput = $("#company");

  try{
    const qs = new URLSearchParams(window.location.search || "");
    const qName = String(qs.get("name") || "").trim();
    const qEmail = String(qs.get("email") || "").trim();
    const qCompany = String(qs.get("company") || "").trim();
    if(qName && nameInput && !nameInput.value) nameInput.value = qName;
    if(qEmail && emailInput && !emailInput.value) emailInput.value = qEmail;
    if(qCompany && companyInput && !companyInput.value) companyInput.value = qCompany;
  }catch(e){ /* ignore */ }

  if(companyInput && !companyInput.value){
    companyInput.value = window.fwSupabase?.companyDefault || "HeroForgeWeb";
  }

  async function signUpViaServer({ name, email, password, company }){
    try{
      const response = await fetch("/.netlify/functions/auth-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, company }),
      });

      const data = await response.json().catch(()=> null);
      if(response.ok){
        return { ok: true, data: data || null };
      }

      if(response.status === 404 || response.status === 405 || response.status === 501){
        return { ok: false, fallback: true, data: data || null };
      }

      return {
        ok: false,
        fallback: false,
        message: String(
          data?.message ||
          data?.details ||
          data?.error ||
          "Inscription impossible"
        ).trim(),
      };
    }catch(error){
      return {
        ok: false,
        fallback: true,
        message: String(error?.message || error || "").trim(),
      };
    }
  }

  async function signInAfterServerSignup(sb, email, password){
    let lastError = null;

    for(let i = 0; i < 3; i += 1){
      const signIn = await sb.auth.signInWithPassword({ email, password });
      if(!signIn.error) return signIn;
      lastError = signIn.error;
      if(i < 2){
        await new Promise((resolve)=> setTimeout(resolve, 350 * (i + 1)));
      }
    }

    return { error: lastError };
  }

  async function finishSupabaseSignup({ finalName, company }){
    const profile = await window.fwSupabase.ensureProfile({ name: finalName, company });
    if(!profile){
      const err = window.fwSupabase?.lastError || null;
      const msg = String(err?.message || err?.error_description || "").trim();
      const msgLower = msg.toLowerCase();
      if(err && (String(err.code) === "42501" || msgLower.includes("row-level security"))){
        window.fwToast?.("Acces base refuse", "RLS: applique le schema SQL et verifie les policies, puis recharge.");
      } else if(err && msg){
        window.fwToast?.("Supabase", msg);
      } else {
        window.fwToast?.("Schema Supabase manquant", "Applique le fichier SQL (tables + RLS) puis recharge.");
      }
      return false;
    }

    await window.fwSupabase.syncLocalUser();
    window.fwToast?.("Compte cree", "Bienvenue sur FaceWork !");
    setTimeout(go, 450);
    return true;
  }

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();

    const name = ($("#name")?.value || "").trim();
    const email = ($("#email")?.value || "").trim();
    const pwd = ($("#password")?.value || "").trim();
    const pwd2 = ($("#password2")?.value || "").trim();
    const company = normCompany($("#company")?.value || window.fwSupabase?.companyDefault || "HeroForgeWeb");

    if(!email || !pwd){
      window.fwToast?.("Champs manquants", "Entre un email et un mot de passe.");
      return;
    }
    if(pwd.length < 6){
      window.fwToast?.("Mot de passe", "Minimum 6 caracteres.");
      return;
    }
    if(pwd !== pwd2){
      window.fwToast?.("Mot de passe", "Les deux mots de passe ne correspondent pas.");
      return;
    }

    if(isSupabaseEnabled){
      const sb = window.fwSupabase.client;
      const fallbackName = (email || "utilisateur").split("@")[0].replace(/[._-]+/g, " ").trim();
      const finalName = String(name || fallbackName || "Utilisateur").trim();

      window.fwToast?.("Inscription", "Creation du compte...");

      const serverSignUp = await signUpViaServer({
        name: finalName,
        email,
        password: pwd,
        company,
      });

      if(serverSignUp.ok){
        const signIn = await signInAfterServerSignup(sb, email, pwd);
        if(signIn.error){
          window.fwToast?.("Connexion", signIn.error.message || "Compte cree mais connexion impossible.");
          return;
        }
        await finishSupabaseSignup({ finalName, company });
        return;
      }

      if(!serverSignUp.fallback){
        const msg = String(serverSignUp.message || "Inscription impossible").trim();
        const msgLower = msg.toLowerCase();
        window.fwToast?.("Inscription", msg);

        if(
          msgLower.includes("already") ||
          msgLower.includes("registered") ||
          msgLower.includes("exists") ||
          msgLower.includes("existe deja")
        ){
          setTimeout(()=>{ window.location.href = "login.html"; }, 650);
        }
        return;
      }

      const signUp = await sb.auth.signUp({
        email,
        password: pwd,
        options: { data: { name: finalName, company } },
      });

      if(signUp.error){
        const msg = String(signUp.error.message || "Inscription impossible").trim();
        const msgLower = msg.toLowerCase();
        window.fwToast?.("Inscription", msg);

        if(msgLower.includes("already") || msgLower.includes("registered") || msgLower.includes("exists")){
          setTimeout(()=>{ window.location.href = "login.html"; }, 650);
        }
        return;
      }

      if(!signUp.data?.session){
        window.fwToast?.("Verification email", "Compte cree. Verifie tes emails (spam), puis connecte-toi.");
        setTimeout(()=>{ window.location.href = "login.html"; }, 1100);
        return;
      }

      await finishSupabaseSignup({ finalName, company });
      return;
    }

    setUser(makeUser(name, email, company));
    window.fwToast?.("Compte cree", "Bienvenue sur FaceWork (demo locale) !");
    setTimeout(go, 450);
  });
})();

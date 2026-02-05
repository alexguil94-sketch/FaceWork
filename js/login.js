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

  function makeUser(email){
    const nameGuess = (email || "utilisateur").split("@")[0].replace(/[._-]+/g," ").trim();
    const name = nameGuess ? nameGuess.split(/\s+/).map(s=>s[0]?.toUpperCase()+s.slice(1)).join(" ") : "Utilisateur";
    return {
      name,
      company: "HeroForgeWeb",
      email: email || "vous@exemple.com",
      role: "admin",
      joinedAt: dateStr(),
      avatarUrl: "",
      avatarBg: "",
    };
  }

  form.addEventListener("submit", (ev)=>{
    ev.preventDefault();
    const email = $("#email").value.trim();
    const pwd = $("#password").value.trim();
    if(!email || !pwd){
      window.fwToast?.("Champs manquants","Entre un email et un mot de passe (démo).");
      return;
    }
    setUser(makeUser(email));
    window.fwToast?.("Connecté","Bienvenue sur FaceWork !");
    setTimeout(go, 450);
  });

  $("#btnGoogle")?.addEventListener("click", ()=>{
    setUser(makeUser("alexis.g@heroforgeweb.com"));
    window.fwToast?.("Connecté via Google","Bienvenue !");
    setTimeout(go, 450);
  });

  $("#btnDiscord")?.addEventListener("click", ()=>{
    setUser(makeUser("alexis.g@heroforgeweb.com"));
    window.fwToast?.("Connecté via Discord","Bienvenue !");
    setTimeout(go, 450);
  });
})();

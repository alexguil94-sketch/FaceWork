// FaceWork — runtime config (client-side)
// 1) Renseigne ton projet Supabase ici (Project URL + Publishable/Anon key)
// 2) Sauvegarde, puis recharge le site
//
// ⚠️ La clé "Publishable/Anon" est prévue pour être utilisée côté navigateur.
// Ne JAMAIS mettre la clé "service_role" ici.
window.FW_ENV = window.FW_ENV || {
  SUPABASE_URL: "",
  SUPABASE_KEY: "",

  // Optionnel : workspace/entreprise par défaut (tu peux aussi le saisir sur la page login)
  SUPABASE_COMPANY: "HeroForgeWeb",
};


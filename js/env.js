// FaceWork — runtime config (client-side)
// 1) Renseigne ton projet Supabase ici (Project URL + Publishable/Anon key)
// 2) Sauvegarde, puis recharge le site
//
// ⚠️ La clé "Publishable/Anon" est prévue pour être utilisée côté navigateur.
// Ne JAMAIS mettre la clé "service_role" ici.
window.FW_ENV = window.FW_ENV || {
  SUPABASE_URL: "https://livucppvekqyfswehasz.supabase.co",
  SUPABASE_KEY: "sb_publishable_M5pvdKQccPb-v1xy9Y_k7w_VhmX5HeG",

  // Bucket Supabase Storage pour l'upload de fichiers (public ou privé selon tes policies)
  SUPABASE_BUCKET: "facework",

  // Optionnel : workspace/entreprise par défaut (tu peux aussi le saisir sur la page login)
  SUPABASE_COMPANY: "Entreprise",
};

/* FaceWork static — Supabase client helper (no build tools) */
(function(){
  const env = window.FW_ENV || {};
  const SUPABASE_URL = String(env.SUPABASE_URL || "").trim();
  const SUPABASE_KEY = String(env.SUPABASE_KEY || "").trim();
  const COMPANY_DEFAULT = String(env.SUPABASE_COMPANY || "HeroForgeWeb").trim();

  const lib = window.supabase;
  const enabled = !!(SUPABASE_URL && SUPABASE_KEY && lib && typeof lib.createClient === "function");

  const client = enabled
    ? lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

  const PROFILE_TABLE = "profiles";
  let lastError = null;
  function setLastError(err){
    lastError = err || null;
  }

  function normCompany(company){
    return String(company || "")
      .trim()
      .replace(/[\\\/]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 60) || "Entreprise";
  }

  function toFwUser(profile, sessionUser){
    const p = profile || {};
    const su = sessionUser || {};
    return {
      id: p.id || su.id || "",
      name: p.name || su.user_metadata?.name || "Utilisateur",
      company: p.company || COMPANY_DEFAULT || "Entreprise",
      email: p.email || su.email || "",
      role: p.role || "member",
      joinedAt: p.joined_at || p.created_at || "",
      avatarUrl: p.avatar_url || "",
      avatarBg: p.avatar_bg || "",
    };
  }

  async function getSession(){
    if(!client) return null;
    const { data, error } = await client.auth.getSession();
    setLastError(error);
    if(error) return null;
    return data?.session || null;
  }

  async function fetchProfile(userId){
    if(!client) return null;
    const id = String(userId || "").trim();
    if(!id) return null;
    const { data, error } = await client
      .from(PROFILE_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setLastError(error);
    if(error) return null;
    return data || null;
  }

  async function ensureProfile({ name, company, avatarUrl, avatarBg } = {}){
    if(!client) return null;
    const session = await getSession();
    const user = session?.user || null;
    if(!user) return null;

    const id = user.id;
    const email = user.email || "";
    const payload = {
      id,
      email,
      name: String(name || user.user_metadata?.name || email.split("@")[0] || "Utilisateur").trim() || "Utilisateur",
      company: normCompany(company || COMPANY_DEFAULT || "Entreprise"),
      avatar_url: String(avatarUrl || "").trim(),
      avatar_bg: String(avatarBg || "").trim(),
    };

    // If the table doesn't exist / schema not applied yet, this will error — keep app usable.
    const existing = await fetchProfile(id);
    if(existing) return existing;

    const { data, error } = await client
      .from(PROFILE_TABLE)
      .insert(payload)
      .select("*")
      .single();
    setLastError(error);
    if(error){
      console.error("[FaceWork] ensureProfile insert failed", error);
      return null;
    }
    return data || null;
  }

  async function syncLocalUser(){
    if(!client) return false;
    const session = await getSession();
    if(!session?.user){
      localStorage.removeItem("fwUser");
      return false;
    }
    const profile = (await fetchProfile(session.user.id)) || (await ensureProfile());
    if(!profile) return false;
    localStorage.setItem("fwUser", JSON.stringify(toFwUser(profile, session.user)));
    window.fw?.hydrateUserUI?.();
    return true;
  }

  async function signOut(){
    try{ localStorage.removeItem("fwUser"); }catch(e){ /* ignore */ }
    if(!client) return;
    await client.auth.signOut();
  }

  async function requireAuth({ redirectTo } = {}){
    if(!client) return false;
    const session = await getSession();
    if(session?.user){
      await syncLocalUser();
      return true;
    }
    if(redirectTo){
      window.location.href = redirectTo;
    }
    return false;
  }

  // Expose API
  window.fwSupabase = {
    enabled,
    client,
    companyDefault: COMPANY_DEFAULT,
    toFwUser,
    get lastError(){ return lastError; },
    getSession,
    fetchProfile,
    ensureProfile,
    syncLocalUser,
    signOut,
    requireAuth,
  };
})();

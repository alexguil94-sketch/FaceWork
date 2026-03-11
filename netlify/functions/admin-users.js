const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

const DEFAULT_SUPABASE_URL = "https://livucppvekqyfswehasz.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_M5pvdKQccPb-v1xy9Y_k7w_VhmX5HeG";

function json(statusCode, obj){
  return {
    statusCode,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(obj || {}),
  };
}

function pickStr(value, maxLen){
  const text = String(value || "").trim();
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function normEmail(value){
  return pickStr(value, 320).toLowerCase();
}

function normName(value, email){
  const fallback = String(email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return pickStr(value || fallback || "Utilisateur", 120) || "Utilisateur";
}

function normCompany(value){
  return pickStr(String(value || "").replace(/[\\\/]+/g, "-").replace(/\s+/g, " "), 120) || "Entreprise";
}

function normAccessMode(value){
  const raw = String(value || "").trim().toLowerCase();
  if(raw === "blocked") return "blocked";
  if(raw === "active") return "active";
  return "";
}

function accessStateFromBannedUntil(value){
  const stamp = Date.parse(String(value || ""));
  return Number.isFinite(stamp) && stamp > Date.now() ? "blocked" : "active";
}

function parseJson(body){
  try{
    return JSON.parse(String(body || "{}"));
  }catch(e){
    return null;
  }
}

function bearerToken(headers){
  const raw = headers?.authorization || headers?.Authorization || "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function isAdminRole(role){
  return String(role || "").trim().toLowerCase() === "admin";
}

function isAdminRoleObject(role){
  const name = String(role?.name || "").trim().toLowerCase();
  return !!role?.perms?.admin || name === "admin";
}

async function fetchJson(url, init){
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try{
    data = text ? JSON.parse(text) : null;
  }catch(e){
    data = null;
  }
  return { response, data, text };
}

function restHeaders(serviceRoleKey, extra){
  return {
    "Content-Type": "application/json",
    "apikey": serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

function adminUserUrlVariants(supabaseUrl, userId){
  const safeId = encodeURIComponent(String(userId || "").trim());
  return [
    `${supabaseUrl}/auth/v1/admin/user/${safeId}`,
    `${supabaseUrl}/auth/v1/admin/users/${safeId}`,
  ];
}

function shouldRetryAdminUserPath(result){
  const status = Number(result?.response?.status || 0);
  const detail = String(
    result?.data?.msg ||
    result?.data?.message ||
    result?.data?.error_description ||
    result?.data?.error ||
    result?.text ||
    ""
  ).toLowerCase();
  return (
    status === 404 ||
    status === 405 ||
    detail.includes("not found") ||
    detail.includes("no route") ||
    detail.includes("404")
  );
}

async function fetchAdminUserResource({ supabaseUrl, serviceRoleKey, userId, method, body }){
  let lastRes = null;
  const urls = adminUserUrlVariants(supabaseUrl, userId);

  for(const url of urls){
    const res = await fetchJson(url, {
      method,
      headers: restHeaders(serviceRoleKey),
      body: body ? JSON.stringify(body) : undefined,
    });
    lastRes = res;
    if(res.response.ok) return res;
    if(!shouldRetryAdminUserPath(res)) break;
  }

  return lastRes;
}

async function fetchAuthUser({ supabaseUrl, serviceRoleKey, userId }){
  const res = await fetchAdminUserResource({
    supabaseUrl,
    serviceRoleKey,
    userId,
    method: "GET",
  });

  if(!res?.response?.ok){
    const detail = res?.data?.msg || res?.data?.message || res?.data?.error_description || res?.data?.error || res?.text;
    throw new Error(detail || "Unable to load auth user");
  }

  return res.data?.user || res.data || null;
}

async function getActor({ supabaseUrl, publishableKey, serviceRoleKey, accessToken }){
  const authRes = await fetchJson(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      "apikey": publishableKey,
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if(!authRes.response.ok || !authRes.data?.id){
    return { error: "invalid_session", statusCode: 401 };
  }

  const profileUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
  profileUrl.searchParams.set("select", "id,email,name,company,role");
  profileUrl.searchParams.set("id", `eq.${authRes.data.id}`);
  profileUrl.searchParams.set("limit", "1");

  const profileRes = await fetchJson(profileUrl.toString(), {
    method: "GET",
    headers: restHeaders(serviceRoleKey),
  });

  const profile = Array.isArray(profileRes.data) ? profileRes.data[0] : null;
  if(!profile?.id){
    return { error: "actor_profile_missing", statusCode: 403 };
  }
  if(!isAdminRole(profile.role)){
    return { error: "admin_required", statusCode: 403 };
  }

  return {
    actor: {
      id: String(profile.id),
      email: String(profile.email || authRes.data.email || ""),
      name: String(profile.name || ""),
      company: String(profile.company || "Entreprise"),
      role: String(profile.role || "member"),
    },
  };
}

async function fetchCompanyRoles({ supabaseUrl, serviceRoleKey, company }){
  const url = new URL(`${supabaseUrl}/rest/v1/roles`);
  url.searchParams.set("select", "id,name,color,perms");
  url.searchParams.set("company", `eq.${company}`);
  url.searchParams.set("order", "name.asc");

  const res = await fetchJson(url.toString(), {
    method: "GET",
    headers: restHeaders(serviceRoleKey),
  });
  if(!res.response.ok){
    throw new Error(res.text || "Unable to load roles");
  }
  return Array.isArray(res.data) ? res.data : [];
}

function resolveRoleSelection(roles, roleIds){
  const allRoles = Array.isArray(roles) ? roles : [];
  const wantedIds = Array.isArray(roleIds) ? roleIds.map(String) : [];
  const selected = allRoles.filter((role)=> wantedIds.includes(String(role.id)));

  if(selected.length){
    return {
      roleIds: selected.map((role)=> String(role.id)),
      profileRole: selected.some(isAdminRoleObject) ? "admin" : "member",
    };
  }

  const memberRole = allRoles.find((role)=>{
    const name = String(role?.name || "").trim().toLowerCase();
    return name === "membre" || name === "member";
  });

  return {
    roleIds: memberRole?.id ? [String(memberRole.id)] : [],
    profileRole: "member",
  };
}

async function fetchProfileById({ supabaseUrl, serviceRoleKey, userId }){
  const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("select", "id,email,name,company,role,created_at");
  url.searchParams.set("id", `eq.${userId}`);
  url.searchParams.set("limit", "1");

  const res = await fetchJson(url.toString(), {
    method: "GET",
    headers: restHeaders(serviceRoleKey),
  });
  if(!res.response.ok){
    throw new Error(res.text || "Unable to load profile");
  }
  return Array.isArray(res.data) ? (res.data[0] || null) : null;
}

async function waitForProfile({ supabaseUrl, serviceRoleKey, userId, tries = 6 }){
  for(let i = 0; i < tries; i += 1){
    const profile = await fetchProfileById({ supabaseUrl, serviceRoleKey, userId });
    if(profile?.id) return profile;
    await new Promise((resolve)=> setTimeout(resolve, 180 * (i + 1)));
  }
  return null;
}

async function upsertProfile({ supabaseUrl, serviceRoleKey, userId, email, name, company, role }){
  const body = [{
    id: userId,
    email,
    name,
    company,
    role,
  }];

  const res = await fetchJson(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: restHeaders(serviceRoleKey, {
      "Prefer": "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(body),
  });

  if(!res.response.ok){
    throw new Error(res.text || "Unable to upsert profile");
  }
  return Array.isArray(res.data) ? (res.data[0] || null) : null;
}

async function patchProfile({ supabaseUrl, serviceRoleKey, userId, patch }){
  const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("id", `eq.${userId}`);

  const res = await fetchJson(url.toString(), {
    method: "PATCH",
    headers: restHeaders(serviceRoleKey, {
      "Prefer": "return=representation",
    }),
    body: JSON.stringify(patch || {}),
  });

  if(!res.response.ok){
    throw new Error(res.text || "Unable to update profile");
  }
  return Array.isArray(res.data) ? (res.data[0] || null) : null;
}

async function replaceMemberRoles({ supabaseUrl, serviceRoleKey, company, userId, roleIds }){
  const delUrl = new URL(`${supabaseUrl}/rest/v1/member_roles`);
  delUrl.searchParams.set("company", `eq.${company}`);
  delUrl.searchParams.set("user_id", `eq.${userId}`);

  const delRes = await fetchJson(delUrl.toString(), {
    method: "DELETE",
    headers: restHeaders(serviceRoleKey),
  });
  if(!delRes.response.ok){
    throw new Error(delRes.text || "Unable to clear member roles");
  }

  const selected = Array.isArray(roleIds) ? roleIds.map(String).filter(Boolean) : [];
  if(!selected.length) return;

  const rows = selected.map((roleId)=> ({
    company,
    user_id: userId,
    role_id: roleId,
  }));

  const insRes = await fetchJson(`${supabaseUrl}/rest/v1/member_roles`, {
    method: "POST",
    headers: restHeaders(serviceRoleKey, {
      "Prefer": "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(rows),
  });
  if(!insRes.response.ok){
    throw new Error(insRes.text || "Unable to assign member roles");
  }
}

async function countAdmins({ supabaseUrl, serviceRoleKey, company }){
  const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("select", "id");
  url.searchParams.set("company", `eq.${company}`);
  url.searchParams.set("role", "eq.admin");

  const res = await fetchJson(url.toString(), {
    method: "GET",
    headers: restHeaders(serviceRoleKey, {
      "Prefer": "count=exact",
      "Range": "0-0",
    }),
  });

  if(!res.response.ok){
    throw new Error(res.text || "Unable to count admins");
  }

  const contentRange = String(res.response.headers.get("content-range") || "");
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : (Array.isArray(res.data) ? res.data.length : 0);
}

async function createAuthUser({ supabaseUrl, serviceRoleKey, email, password, name, company }){
  const res = await fetchJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: restHeaders(serviceRoleKey),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        company,
      },
    }),
  });

  if(!res.response.ok){
    const detail = res.data?.msg || res.data?.message || res.data?.error_description || res.data?.error || res.text;
    throw new Error(detail || "Unable to create auth user");
  }

  return {
    id: String(res.data?.id || res.data?.user?.id || ""),
    email: String(res.data?.email || res.data?.user?.email || email),
  };
}

async function updateAuthUser({ supabaseUrl, serviceRoleKey, userId, email, password, name, company, access }){
  const payload = {
    user_metadata: {
      name,
      company,
    },
  };
  if(email) payload.email = email;
  if(password) payload.password = password;
  if(email) payload.email_confirm = true;
  if(access === "blocked") payload.ban_duration = "876000h";
  if(access === "active") payload.ban_duration = "none";

  const res = await fetchAdminUserResource({
    supabaseUrl,
    serviceRoleKey,
    userId,
    method: "PUT",
    body: payload,
  });

  if(!res?.response?.ok){
    const detail = res.data?.msg || res.data?.message || res.data?.error_description || res.data?.error || res.text;
    throw new Error(detail || "Unable to update auth user");
  }
}

async function deleteAuthUser({ supabaseUrl, serviceRoleKey, userId }){
  const res = await fetchAdminUserResource({
    supabaseUrl,
    serviceRoleKey,
    userId,
    method: "DELETE",
  });

  if(!res?.response?.ok){
    const detail = res.data?.msg || res.data?.message || res.data?.error_description || res.data?.error || res.text;
    throw new Error(detail || "Unable to delete auth user");
  }
}

async function handleCreate({ supabaseUrl, serviceRoleKey, actor, body }){
  const company = actor.company;
  const email = normEmail(body?.email);
  const password = pickStr(body?.password, 200);
  const name = normName(body?.name, email);

  if(!email || !password){
    return json(400, { error: "missing_fields", message: "Email et mot de passe requis." });
  }
  if(password.length < 6){
    return json(400, { error: "invalid_password", message: "Mot de passe trop court." });
  }

  try{
    const roles = await fetchCompanyRoles({ supabaseUrl, serviceRoleKey, company });
    const selection = resolveRoleSelection(roles, body?.roleIds);
    const authUser = await createAuthUser({ supabaseUrl, serviceRoleKey, email, password, name, company });

    let profile = await waitForProfile({ supabaseUrl, serviceRoleKey, userId: authUser.id });
    if(!profile){
      profile = await upsertProfile({
        supabaseUrl,
        serviceRoleKey,
        userId: authUser.id,
        email: authUser.email,
        name,
        company,
        role: selection.profileRole,
      });
    } else {
      profile = await patchProfile({
        supabaseUrl,
        serviceRoleKey,
        userId: authUser.id,
        patch: {
          email: authUser.email,
          name,
          company,
          role: selection.profileRole,
        },
      });
    }

    await replaceMemberRoles({
      supabaseUrl,
      serviceRoleKey,
      company,
      userId: authUser.id,
      roleIds: selection.roleIds,
    });

    return json(200, {
      ok: true,
      user: {
        id: authUser.id,
        email: authUser.email,
        name: profile?.name || name,
        company,
        role: selection.profileRole,
        accessState: "active",
        bannedUntil: "",
      },
    });
  }catch(error){
    const msg = String(error?.message || error || "").trim() || "Creation du compte impossible.";
    const lower = msg.toLowerCase();
    if(lower.includes("already") || lower.includes("registered") || lower.includes("exists") || lower.includes("duplicate")){
      return json(409, { error: "user_exists", message: "Un compte existe deja avec cet email." });
    }
    return json(500, { error: "create_failed", message: msg });
  }
}

async function handleGet({ supabaseUrl, serviceRoleKey, actor, userId }){
  if(!userId){
    return json(400, { error: "missing_user_id", message: "Utilisateur manquant." });
  }

  try{
    const profile = await fetchProfileById({ supabaseUrl, serviceRoleKey, userId });
    if(!profile?.id || String(profile.company || "") !== String(actor.company || "")){
      return json(404, { error: "user_not_found", message: "Utilisateur introuvable." });
    }

    const authUser = await fetchAuthUser({ supabaseUrl, serviceRoleKey, userId });
    const bannedUntil = String(authUser?.banned_until || "");

    return json(200, {
      ok: true,
      user: {
        id: String(profile.id),
        email: String(authUser?.email || profile.email || ""),
        name: String(profile.name || authUser?.user_metadata?.name || ""),
        company: String(profile.company || actor.company || ""),
        role: String(profile.role || "member"),
        bannedUntil,
        accessState: accessStateFromBannedUntil(bannedUntil),
        lastSignInAt: String(authUser?.last_sign_in_at || ""),
      },
    });
  }catch(error){
    const msg = String(error?.message || error || "").trim() || "Chargement impossible.";
    return json(500, { error: "load_failed", message: msg });
  }
}

async function handleUpdate({ supabaseUrl, serviceRoleKey, actor, body }){
  const company = actor.company;
  const userId = pickStr(body?.userId, 120);
  if(!userId){
    return json(400, { error: "missing_user_id", message: "Utilisateur manquant." });
  }

  try{
    const currentProfile = await fetchProfileById({ supabaseUrl, serviceRoleKey, userId });
    if(!currentProfile?.id || String(currentProfile.company || "") !== company){
      return json(404, { error: "user_not_found", message: "Utilisateur introuvable." });
    }

    const accessMode = normAccessMode(body?.access);
    const hasRoleIds = Array.isArray(body?.roleIds);
    const currentIsAdmin = isAdminRole(currentProfile.role);
    let nextRole = String(currentProfile.role || "member");
    let selection = null;

    if(hasRoleIds){
      const roles = await fetchCompanyRoles({ supabaseUrl, serviceRoleKey, company });
      selection = resolveRoleSelection(roles, body?.roleIds);
      nextRole = selection.profileRole;
    }

    const nextIsAdmin = isAdminRole(nextRole);

    if(String(userId) === String(actor.id) && accessMode === "blocked"){
      return json(400, { error: "self_block_blocked", message: "Tu ne peux pas bloquer ton propre compte ici." });
    }

    if(hasRoleIds && String(userId) === String(actor.id) && currentIsAdmin && !nextIsAdmin){
      return json(400, { error: "self_demotion_blocked", message: "Tu ne peux pas retirer ton propre acces admin ici." });
    }

    if(hasRoleIds && currentIsAdmin && !nextIsAdmin){
      const adminCount = await countAdmins({ supabaseUrl, serviceRoleKey, company });
      if(adminCount <= 1){
        return json(400, { error: "last_admin_blocked", message: "Impossible de retirer le dernier admin." });
      }
    }

    if(currentIsAdmin && accessMode === "blocked"){
      const adminCount = await countAdmins({ supabaseUrl, serviceRoleKey, company });
      if(adminCount <= 1){
        return json(400, { error: "last_admin_blocked", message: "Impossible de bloquer le dernier admin." });
      }
    }

    const email = normEmail(body?.email || currentProfile.email);
    const name = normName(body?.name || currentProfile.name, email);
    const password = pickStr(body?.password, 200);

    if(password && password.length < 6){
      return json(400, { error: "invalid_password", message: "Mot de passe trop court." });
    }

    await updateAuthUser({
      supabaseUrl,
      serviceRoleKey,
      userId,
      email: email !== String(currentProfile.email || "").trim().toLowerCase() ? email : "",
      password,
      name,
      company,
      access: accessMode,
    });

    const profile = await patchProfile({
      supabaseUrl,
      serviceRoleKey,
      userId,
      patch: {
        email,
        name,
        role: nextRole,
      },
    });

    if(selection){
      await replaceMemberRoles({
        supabaseUrl,
        serviceRoleKey,
        company,
        userId,
        roleIds: selection.roleIds,
      });
    }

    let authUser = null;
    try{
      authUser = await fetchAuthUser({ supabaseUrl, serviceRoleKey, userId });
    }catch(e){
      authUser = null;
    }
    const bannedUntil = String(authUser?.banned_until || "");

    return json(200, {
      ok: true,
      user: {
        id: userId,
        email,
        name: profile?.name || name,
        company,
        role: nextRole,
        bannedUntil,
        accessState: accessStateFromBannedUntil(bannedUntil),
      },
    });
  }catch(error){
    const msg = String(error?.message || error || "").trim() || "Mise a jour impossible.";
    return json(500, { error: "update_failed", message: msg });
  }
}

async function handleDelete({ supabaseUrl, serviceRoleKey, actor, body }){
  const company = actor.company;
  const userId = pickStr(body?.userId, 120);
  if(!userId){
    return json(400, { error: "missing_user_id", message: "Utilisateur manquant." });
  }
  if(String(userId) === String(actor.id)){
    return json(400, { error: "self_delete_blocked", message: "Tu ne peux pas supprimer ton propre compte ici." });
  }

  try{
    const currentProfile = await fetchProfileById({ supabaseUrl, serviceRoleKey, userId });
    if(!currentProfile?.id || String(currentProfile.company || "") !== company){
      return json(404, { error: "user_not_found", message: "Utilisateur introuvable." });
    }

    if(isAdminRole(currentProfile.role)){
      const adminCount = await countAdmins({ supabaseUrl, serviceRoleKey, company });
      if(adminCount <= 1){
        return json(400, { error: "last_admin_blocked", message: "Impossible de supprimer le dernier admin." });
      }
    }

    await deleteAuthUser({ supabaseUrl, serviceRoleKey, userId });
    return json(200, { ok: true });
  }catch(error){
    const msg = String(error?.message || error || "").trim() || "Suppression impossible.";
    return json(500, { error: "delete_failed", message: msg });
  }
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const supabaseUrl = pickStr(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, 2000).replace(/\/+$/, "");
  const serviceRoleKey = pickStr(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY, 4000);
  const publishableKey = pickStr(
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
    4000
  );
  if(!supabaseUrl || !serviceRoleKey || !publishableKey){
    return json(501, { error: "server_env_missing", message: "Supabase server env missing." });
  }

  const accessToken = bearerToken(event.headers || {});
  if(!accessToken){
    return json(401, { error: "missing_token", message: "Connexion requise." });
  }

  const actorRes = await getActor({ supabaseUrl, publishableKey, serviceRoleKey, accessToken });
  if(actorRes.error){
    return json(actorRes.statusCode || 403, {
      error: actorRes.error,
      message: actorRes.error === "admin_required" ? "Acces admin requis." : "Session invalide.",
    });
  }

  if(event.httpMethod === "GET"){
    const userId = pickStr(event.queryStringParameters?.userId, 120);
    return handleGet({ supabaseUrl, serviceRoleKey, actor: actorRes.actor, userId });
  }

  const body = parseJson(event.body);
  if(!body){
    return json(400, { error: "invalid_json", message: "JSON invalide." });
  }

  if(event.httpMethod === "POST"){
    return handleCreate({ supabaseUrl, serviceRoleKey, actor: actorRes.actor, body });
  }
  if(event.httpMethod === "PATCH"){
    return handleUpdate({ supabaseUrl, serviceRoleKey, actor: actorRes.actor, body });
  }
  if(event.httpMethod === "DELETE"){
    return handleDelete({ supabaseUrl, serviceRoleKey, actor: actorRes.actor, body });
  }

  return json(405, { error: "method_not_allowed", message: "Method not allowed." });
};

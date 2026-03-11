const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const DEFAULT_SUPABASE_URL = "https://livucppvekqyfswehasz.supabase.co";

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

function explainAuthError(detail, status){
  const text = String(detail || "").trim();
  const lower = text.toLowerCase();

  if(
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("already exists") ||
    lower.includes("duplicate")
  ){
    return {
      statusCode: 409,
      payload: { error: "user_exists", message: "Un compte existe deja avec cet email." },
    };
  }

  if(lower.includes("password")){
    return {
      statusCode: 400,
      payload: { error: "invalid_password", message: text || "Mot de passe invalide." },
    };
  }

  return {
    statusCode: status >= 400 && status < 600 ? status : 500,
    payload: { error: "signup_failed", message: text || "Creation du compte impossible." },
  };
}

async function createAuthUser({ supabaseUrl, serviceRoleKey, email, password, name, company }){
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
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

  const bodyText = await response.text();
  let data = null;
  try{
    data = bodyText ? JSON.parse(bodyText) : null;
  }catch(e){
    data = null;
  }

  if(!response.ok){
    const detail = data?.msg || data?.message || data?.error_description || data?.error || bodyText;
    const mapped = explainAuthError(detail, response.status);
    return mapped;
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      user: {
        id: data?.id || data?.user?.id || "",
        email: data?.email || data?.user?.email || email,
      },
    },
  };
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if(event.httpMethod !== "POST"){
    return json(405, { error: "method_not_allowed", message: "Method not allowed." });
  }

  const supabaseUrl = pickStr(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, 2000).replace(/\/+$/, "");
  const serviceRoleKey = pickStr(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY, 4000);
  if(!supabaseUrl || !serviceRoleKey){
    return json(501, { error: "server_env_missing", message: "Supabase server env missing." });
  }

  let body = null;
  try{
    body = JSON.parse(String(event.body || "{}"));
  }catch(e){
    return json(400, { error: "invalid_json", message: "JSON invalide." });
  }

  const email = normEmail(body?.email);
  const password = pickStr(body?.password, 200);
  const company = normCompany(body?.company);
  const name = normName(body?.name, email);

  if(!email || !password){
    return json(400, { error: "missing_fields", message: "Email et mot de passe requis." });
  }

  if(password.length < 6){
    return json(400, { error: "invalid_password", message: "Mot de passe trop court." });
  }

  try{
    const result = await createAuthUser({ supabaseUrl, serviceRoleKey, email, password, name, company });
    return json(result.statusCode, result.payload);
  }catch(error){
    return json(500, { error: "internal_error", message: String(error?.message || error || "Internal error.") });
  }
};

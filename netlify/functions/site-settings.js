const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

const PUBLIC_FIELDS = [
  "social_instagram_url",
  "social_facebook_url",
  "social_linkedin_url",
  "social_whatsapp_url",
];
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

function emptySettings(){
  return PUBLIC_FIELDS.reduce((acc, field)=>{
    acc[field] = "";
    return acc;
  }, {});
}

function hasAnySocialLink(row){
  return PUBLIC_FIELDS.some((field)=> String(row?.[field] || "").trim());
}

async function fetchSettingsRows({ supabaseUrl, serviceRoleKey, query }){
  const response = await fetch(`${supabaseUrl}/rest/v1/crm_settings?${query}`, {
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
  });

  if(!response.ok){
    const detail = await response.text();
    throw new Error(detail || `Supabase settings fetch failed (${response.status})`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : (rows ? [rows] : []);
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if(event.httpMethod !== "GET"){
    return json(405, { error: "Method not allowed." });
  }

  const supabaseUrl = pickStr(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, 2000).replace(/\/+$/, "");
  const serviceRoleKey = pickStr(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY, 4000);
  if(!supabaseUrl || !serviceRoleKey){
    return json(501, { error: "Supabase server env missing." });
  }

  const qs = event.queryStringParameters || {};
  const company = pickStr(qs.company || "Entreprise", 120) || "Entreprise";
  const select = PUBLIC_FIELDS.join(",");

  try{
    const rows = await fetchSettingsRows({
      supabaseUrl,
      serviceRoleKey,
      query: `company=eq.${encodeURIComponent(company)}&select=${encodeURIComponent(select)}&limit=1`,
    });

    const exactRow = rows[0] || null;
    if(hasAnySocialLink(exactRow)){
      return json(200, { ...emptySettings(), ...(exactRow || {}) });
    }

    const fallbackRows = await fetchSettingsRows({
      supabaseUrl,
      serviceRoleKey,
      query: `select=${encodeURIComponent(select)}&order=updated_at.desc&limit=20`,
    });
    const fallbackRow = fallbackRows.find(hasAnySocialLink) || exactRow || null;

    return json(200, { ...emptySettings(), ...(fallbackRow || {}) });
  }catch(error){
    return json(500, { error: "Internal error.", details: String(error) });
  }
};

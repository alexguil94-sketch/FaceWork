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
  const url = `${supabaseUrl}/rest/v1/crm_settings?company=eq.${encodeURIComponent(company)}&select=${encodeURIComponent(select)}`;

  try{
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
    });

    if(!response.ok){
      const detail = await response.text();
      return json(502, { error: "Supabase settings fetch failed.", details: detail });
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return json(200, { ...emptySettings(), ...(row || {}) });
  }catch(error){
    return json(500, { error: "Internal error.", details: String(error) });
  }
};

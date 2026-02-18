// Netlify Function — AI proxy (keeps API key server-side)
// Env:
// - OPENAI_API_KEY (required)
// - OPENAI_MODEL (optional, default: gpt-4o-mini)
// - OPENAI_BASE_URL (optional, default: https://api.openai.com/v1)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const RATE_MAX = Number(process.env.AI_RATE_MAX || 25);
const RATE_WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MS || 60_000);
const __rate = new Map();

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

function pickStr(v, maxLen){
  const s = String(v || "");
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeRole(role){
  const r = String(role || "").trim().toLowerCase();
  return (r === "user" || r === "assistant") ? r : "";
}

function clientIp(event){
  const h = event?.headers || {};
  const direct = String(h["x-nf-client-connection-ip"] || "").trim();
  if(direct) return direct;
  const fwd = String(h["x-forwarded-for"] || "").trim();
  if(!fwd) return "";
  return String(fwd.split(",")[0] || "").trim();
}

function isRateLimited(ip){
  if(!ip) return false;
  if(!Number.isFinite(RATE_MAX) || RATE_MAX <= 0) return false;
  if(!Number.isFinite(RATE_WINDOW_MS) || RATE_WINDOW_MS <= 0) return false;

  const now = Date.now();
  const bucket = __rate.get(ip) || { start: now, count: 0 };
  const elapsed = now - bucket.start;
  if(elapsed > RATE_WINDOW_MS){
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count++;
  __rate.set(ip, bucket);
  return bucket.count > RATE_MAX;
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if(event.httpMethod !== "POST"){
    return json(405, { error: "Method not allowed." });
  }

  const ip = clientIp(event);
  if(isRateLimited(ip)){
    return json(429, { error: "Trop de requêtes. Réessaie dans une minute." });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if(!apiKey){
    return json(501, { error: "OPENAI_API_KEY manquant (variables Netlify)." });
  }

  let payload = {};
  try{
    payload = JSON.parse(event.body || "{}") || {};
  }catch(e){
    return json(400, { error: "JSON invalide." });
  }

  const model = pickStr(process.env.OPENAI_MODEL || "gpt-4o-mini", 80);
  const baseUrlRaw = pickStr(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1", 2000);
  const baseUrl = baseUrlRaw.replace(/\/+$/,"");
  const url = `${baseUrl}/chat/completions`;

  const context = (payload.context && typeof payload.context === "object") ? payload.context : null;
  const inMessages = Array.isArray(payload.messages) ? payload.messages : [];
  const messages = inMessages
    .map(m=> ({
      role: normalizeRole(m?.role),
      content: pickStr(m?.content, 8000),
    }))
    .filter(m=> m.role && m.content)
    .slice(-12);

  const sys = [
    "Tu es l’assistant IA du site FaceWork (apprentissage web).",
    "Réponds en français.",
    "But: aider à comprendre et progresser (explications + étapes + indices).",
    "Si la demande est ambiguë: pose 1 question courte.",
    "Si on te demande une solution complète: commence par un indice, puis propose la solution si l’utilisateur insiste.",
  ].join("\n");

  const full = [{ role: "system", content: sys }];

  if(context){
    const title = pickStr(context.title, 200);
    const lang = pickStr(context.lang, 40);
    const diff = pickStr(context.difficulty, 40);
    const prompt = pickStr(context.prompt, 12000);
    const lines = [
      title ? `Titre: ${title}` : "",
      lang ? `Langage: ${lang}` : "",
      diff ? `Difficulté: ${diff}` : "",
      prompt ? `Consigne:\n${prompt}` : "",
    ].filter(Boolean);
    if(lines.length){
      full.push({ role: "system", content: `Contexte (FaceWork):\n${lines.join("\n")}` });
    }
  }

  full.push(...messages);

  let res;
  try{
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: full,
        temperature: 0.2,
        max_tokens: 700,
      }),
    });
  }catch(e){
    return json(502, { error: "Impossible de joindre le fournisseur IA." });
  }

  let data = null;
  try{
    data = await res.json();
  }catch(e){
    data = null;
  }

  if(!res.ok){
    const msg = String(data?.error?.message || "").trim();
    return json(res.status || 500, { error: msg || "Erreur IA." });
  }

  const output = String(data?.choices?.[0]?.message?.content || "").trim();
  if(!output){
    return json(502, { error: "Réponse IA vide." });
  }

  return json(200, { output });
};

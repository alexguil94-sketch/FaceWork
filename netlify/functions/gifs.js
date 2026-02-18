// Netlify Function — GIF proxy (Tenor)
// Env (optional):
// - TENOR_API_KEY (optional; falls back to Tenor demo key)
// - GIF_RATE_MAX (optional, default: 60)
// - GIF_RATE_WINDOW_MS (optional, default: 60_000)
//
// Notes:
// - Returned URLs are direct `.gif` from Tenor CDN.
// - Keep the API key server-side when you set your own key.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

const RATE_MAX = Number(process.env.GIF_RATE_MAX || 60);
const RATE_WINDOW_MS = Number(process.env.GIF_RATE_WINDOW_MS || 60_000);
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

function clampInt(n, min, max){
  const x = Number(n);
  if(!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
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

function mapTenorResults(data){
  const results = Array.isArray(data?.results) ? data.results : [];
  const gifs = results.map((r)=>{
    const media0 = Array.isArray(r?.media) ? r.media[0] : null;
    const gif = String(media0?.gif?.url || media0?.mediumgif?.url || media0?.tinygif?.url || "").trim();
    const preview = String(media0?.tinygif?.url || media0?.nanogif?.url || gif || "").trim();
    const dims = media0?.tinygif?.dims || media0?.gif?.dims || [];
    const w = Array.isArray(dims) ? Number(dims[0] || 0) : 0;
    const h = Array.isArray(dims) ? Number(dims[1] || 0) : 0;
    return {
      id: String(r?.id || ""),
      title: pickStr(r?.title, 120),
      url: gif || preview,
      preview: preview || gif,
      width: Number.isFinite(w) ? w : 0,
      height: Number.isFinite(h) ? h : 0,
      itemurl: String(r?.itemurl || ""),
    };
  }).filter((g)=> {
    const u = String(g?.url || "");
    return u.startsWith("https://") || u.startsWith("http://");
  });

  return { gifs, next: String(data?.next || "") };
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if(event.httpMethod !== "GET"){
    return json(405, { error: "Method not allowed." });
  }

  const ip = clientIp(event);
  if(isRateLimited(ip)){
    return json(429, { error: "Trop de requêtes. Réessaie dans une minute." });
  }

  // Tenor demo key works for quick demos, but you should set your own key on Netlify.
  const apiKey = pickStr(process.env.TENOR_API_KEY || "LIVDSRZULELA", 220);
  if(!apiKey){
    return json(501, { error: "TENOR_API_KEY manquant (variables Netlify)." });
  }

  const qs = event.queryStringParameters || {};
  const q = pickStr(qs.q, 80).trim();
  const limit = clampInt(qs.limit, 1, 24);
  const pos = pickStr(qs.pos, 40).trim();

  const endpoint = q ? "search" : "trending";
  const params = new URLSearchParams();
  params.set("key", apiKey);
  params.set("limit", String(limit));
  params.set("contentfilter", "high");
  params.set("media_filter", "basic");
  if(q) params.set("q", q);
  if(pos) params.set("pos", pos);

  const url = `https://g.tenor.com/v1/${endpoint}?${params.toString()}`;

  let res;
  try{
    res = await fetch(url);
  }catch(e){
    return json(502, { error: "Impossible de joindre Tenor." });
  }

  let data = null;
  try{
    data = await res.json();
  }catch(e){
    data = null;
  }

  if(!res.ok){
    const msg = String(data?.error || data?.message || data?.meta?.msg || "").trim();
    return json(res.status || 500, { error: msg || "Erreur GIF." });
  }

  const { gifs, next } = mapTenorResults(data);
  return json(200, {
    provider: { name: "Tenor", url: "https://tenor.com/" },
    query: q || "",
    next: next || "",
    gifs,
  });
};


/* Contador de pasos del bot (embudo). Usa Upstash Redis conectado desde Vercel → Storage.
   Registrar: el bot llama a /api/evento?prop=virasoro-8b&paso=entro
   Ver números: abrir /api/evento?prop=virasoro-8b  (o /api/evento?prop=todas) */
const PROPS = ["virasoro-8b", "virasoro-9a", "virasoro-10a", "san-jose", "ph-floresta"];
const PASOS = ["entro", "pago", "mudanza", "nombre", "whatsapp"];
const NOMBRES = { entro:"1. Entraron al bot", pago:"2. Respondieron opción de compra", mudanza:"3. Respondieron mudanza", nombre:"4. Dejaron el nombre", whatsapp:"5. Tocaron Enviar por WhatsApp" };

const URL_DB = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...partes){
  const r = await fetch(`${URL_DB}/${partes.map(encodeURIComponent).join("/")}`, { headers:{ Authorization:`Bearer ${TOKEN}` } });
  if(!r.ok) throw new Error("Redis " + r.status);
  return (await r.json()).result;
}

export default async function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  if(!URL_DB || !TOKEN) return res.status(500).json({ error:"Falta conectar Upstash en Vercel → Storage" });
  const prop = String(req.query.prop || "").toLowerCase();
  const paso = String(req.query.paso || "").toLowerCase();
  try{
    if(paso){
      if(!PROPS.includes(prop) || !PASOS.includes(paso)) return res.status(400).json({ error:"Dato inválido" });
      const hoy = new Date().toLocaleDateString("sv-SE", { timeZone:"America/Argentina/Buenos_Aires" });
      await redis("hincrby", `embudo:${prop}`, paso, "1");
      await redis("hincrby", `embudo:${prop}:${hoy}`, paso, "1");
      return res.status(204).end();
    }
    const lista = prop === "todas" ? PROPS : (PROPS.includes(prop) ? [prop] : []);
    if(!lista.length) return res.status(400).json({ error:"Usá ?prop=virasoro-8b o ?prop=todas" });
    const salida = {};
    for(const p of lista){
      const crudo = await redis("hgetall", `embudo:${p}`) || [];
      const m = {}; for(let i=0;i<crudo.length;i+=2) m[crudo[i]] = Number(crudo[i+1]);
      salida[p] = Object.fromEntries(PASOS.map(k=>[NOMBRES[k], m[k] || 0]));
    }
    return res.status(200).json(salida);
  }catch(e){
    return res.status(500).json({ error:"No se pudo leer el contador" });
  }
}

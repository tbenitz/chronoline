/**
 * OPTIONAL DeepSeek CORS relay for ChronoLine (Cloudflare Worker).
 * This does NOT contain, save, or provide an API key.
 * Each browser sends its own DeepSeek API key in Authorization.
 * Deploy to a Cloudflare Worker and set ChronoLine's advanced API endpoint
 * to https://YOUR-WORKER.workers.dev/chat/completions
 */
const ALLOWED_ORIGIN = "https://tbenitz.github.io";
export default {
 async fetch(request) {
  const origin=request.headers.get("Origin")||"";
  if(origin!==ALLOWED_ORIGIN)return new Response("Origin not allowed",{status:403});
  const cors={
    "Access-Control-Allow-Origin":ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"Authorization, Content-Type",
    "Vary":"Origin",
    "Cache-Control":"no-store"
  };
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST"||new URL(request.url).pathname!=="/chat/completions")return new Response("Not found",{status:404,headers:cors});
  const authorization=request.headers.get("Authorization")||"";
  if(!/^Bearer\s+\S+$/i.test(authorization))return new Response("Your DeepSeek API key is required",{status:401,headers:cors});
  const raw=await request.text();
  if(raw.length>200000)return new Response("Request too large",{status:413,headers:cors});
  let input;
  try{input=JSON.parse(raw)}catch{return new Response("Invalid JSON",{status:400,headers:cors})}
  if(!Array.isArray(input.messages)||input.messages.length>12||!["deepseek-flash","deepseek-v4-pro"].includes(input.model))return new Response("Invalid chat completion request",{status:400,headers:cors});
  try{
    const upstream=await fetch("https://api.deepseek.com/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":authorization},
      body:raw,
      redirect:"error"
    });
    const responseHeaders=new Headers(cors);
    responseHeaders.set("Content-Type","application/json; charset=utf-8");
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }catch(e){return new Response(JSON.stringify({error:{message:"DeepSeek upstream connection failed"}}),{status:502,headers:{...cors,"Content-Type":"application/json"}})}
 }
};
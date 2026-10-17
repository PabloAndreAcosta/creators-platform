import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("/Users/pabloacosta/Code/creators-platform/.env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.startsWith("#"))
  .map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const ID="02915b30-0140-455f-a671-f7748ef268da";
const slut = Date.now() + 40*60*1000;
while (Date.now() < slut) {
  const { data: l } = await db.from("listings").select("tickets_sold").eq("id", ID).single();
  const { count } = await db.from("bookings").select("id",{count:"exact",head:true}).eq("listing_id", ID).in("status",["confirmed","completed"]);
  if (l.tickets_sold === (count ?? 0)) { console.log(`RESERVATIONEN SLÄPPT: räknare ${l.tickets_sold} = verkliga ${count ?? 0}`); process.exit(0); }
  await new Promise(r=>setTimeout(r,120000));
}
console.log("FORTFARANDE FEL efter 40 min — kolla manuellt.");

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.startsWith("#"))
  .map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const IDS = ["02915b30-0140-455f-a671-f7748ef268da","c35c2439-e076-49a6-a047-ee825bdefd44"];

const las = async () => {
  const out = [];
  for (const id of IDS) {
    const { data: l } = await db.from("listings").select("title,event_date,tickets_sold").eq("id", id).single();
    const { count } = await db.from("bookings").select("id",{count:"exact",head:true})
      .eq("listing_id", id).in("status",["confirmed","completed"]);
    out.push({ id, titel: l.title, raknare: l.tickets_sold, riktiga: count ?? 0 });
  }
  return out;
};

const slut = Date.now() + 40*60*1000;
while (Date.now() < slut) {
  const rader = await las();
  if (rader.every(r => r.raknare === r.riktiga)) {
    console.log("RESERVATIONERNA SLÄPPTA — räknarna stämmer med verkliga bokningar:");
    rader.forEach(r => console.log(`  ${r.titel}: ${r.raknare} = ${r.riktiga}`));
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 120000));
}
const rader = await las();
console.log("FORTFARANDE FEL efter 40 min — webhooken har inte släppt dem:");
rader.forEach(r => console.log(`  ${r.titel}: räknare ${r.raknare}, verkliga ${r.riktiga}`));

# usha-cron

Klockan för plattformens schemalagda jobb. Endpointerna bor i Next-appen på
usha.se; den här Workern anropar dem.

## Varför den finns

Vercel Hobby tillåter bara en cron-körning per dygn, så schemat låg i GitHub
Actions. Men GitHubs schemaläggning är "best effort" på riktigt: mätt över en
vecka gick det timvisa jobbet i median var 4,5:e timme, med ett värsta glapp på
12,6 timmar. Påminnelsen "din bokning börjar snart" letar efter bokningar inom
två timmar — med fyra och en halv timme mellan körningarna hann de flesta
bokningar passera hela fönstret. 5 av 57 bokningar fick sitt mejl.

GitHub-schemat ligger kvar som reserv. Alla endpoints är idempotenta.

## Hemligheter

    wrangler secret put CRON_SECRET      # samma som i Vercel
    wrangler secret put RESEND_API_KEY   # för larmmejlet
    wrangler secret put ALERT_EMAIL      # vart larmet går
    wrangler secret put APP_URL          # https://usha.se

Utan `RESEND_API_KEY` larmar Workern inte — då syns fel bara i loggen.

## Köra manuellt

    curl -H "Authorization: Bearer $CRON_SECRET" \
      https://usha-cron.usha-korjournal.workers.dev

Kör alla jobb direkt och svarar med utfallet per jobb. Larmar på samma sätt som
det schemalagda anropet, så larmvägen går att prova utan att vänta på nästa
hela timme.

## Deploy

    cd workers/cron && npm install && npx wrangler deploy

Ingen automatisk deploy — Workern ändras sällan och ligger utanför Vercel-bygget.

## Varför mappen är utesluten ur appens tsconfig

Workern körs på Cloudflares runtime, inte i Next. Dess typer (`ScheduledController`,
`ExecutionContext`) kommer ur `@cloudflare/workers-types` och finns inte i appens
typvärld — låg mappen kvar i rot-`tsconfig.json`s `include` failade `next build`
med "Cannot find name 'ScheduledController'". `workers/` står därför i `exclude`,
och Workern typkollas för sig med sin egen `tsconfig.json`.

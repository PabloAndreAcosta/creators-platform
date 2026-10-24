-- TL;DR som eget fält, inte som en rad i beskrivningen.
--
-- Sammanfattningen plockades först ur brödtexten. Det fungerade men var fel
-- plats: den är en egen uppgift om kvällen, på samma nivå som tid och plats,
-- och ska stå kvar även när beskrivningen är infälld. Som en rad i texten
-- kunde den dessutom inte redigeras utan att man skrev om stycket omkring.
alter table listings add column if not exists tldr text;

comment on column listings.tldr is
  'Kort sammanfattning som visas öppet vid tid och plats på eventsidan. Max ett par meningar: vad det är, nivå, vad det kostar.';

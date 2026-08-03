# CLAUDE.md

Instruktioner för AI-agenter (Claude Code m.fl.) som jobbar i det här repot.

## Vad är Stalljournal?

En digital stalljournal för fårproducenter: djurregister med härstamning, grupper/platser, behandlingar med karensvakt, lamning, betäckning, hull, träckprov, slakt och avräkning. Offline-first PWA (React + TypeScript + Vite, Dexie/IndexedDB som lokal sanningskälla) med valfri delad synk mot en självhostad PocketBase-server på användarens egen hårdvara (Tailscale, ingen molntjänst).

Läs `docs/domanoversikt.md` för **vad** appen gör och **varför** innan du gör domänändringar, och `docs/arkitektur.md` för den tekniska arkitekturen innan du ändrar datamodellen eller synken. Håll dessa två (plus `docs/avel.md`, `docs/synk.md`) uppdaterade när du ändrar något de beskriver — de är källan till sanning, inte bara historik.

## Repo-layout

- `app/` — PWA:n. `app/README.md` har teknikval och byggstatus per fas.
  - `src/db/` — Dexie-schema (`db.ts`) och TS-typer (`types.ts`) för hela datamodellen
  - `src/logic/` — affärslogik/use cases (lamning, flytt, slakt, foton, avel …)
  - `src/pages/`, `src/components/` — UI (svensk text)
  - `src/sync/` — synkmotorn mot PocketBase (`sync.ts` = push/pull, `client.ts` = anslutning/inloggning)
- `server/pb_migrations/` — PocketBase-schemat, en migrationsfil per collection
- `docs/` — domän- och arkitekturdokumentation, se ovan

## Kommandon

```bash
cd app
npm install
npm run dev      # dev-server
npm run build    # tsc -b && vite build — kör alltid efter ändringar i app/
npm run lint     # oxlint
```

Inga automatiska tester finns i repot ännu — `build` (typkontroll) och `lint` är de enda automatiska kontrollerna. Det finns ingen CI som kör på pull requests (bara en deploy-workflow som triggas av push till `main`, `.github/workflows/deploy.yml`).

## Git-arbetsflöde

Enkelt, atomärt arbetsflöde: **committa direkt till `main`**. Inga långlivade feature-branches och inga pull requests för det vanliga arbetet — det är i praktiken en ensam utvecklare/gård, och eftersom ingen CI ändå gatear PR:ar (se ovan) gav branch+PR bara ceremoni utan verklig gatekeeper-funktion.

- Varje commit ska vara **atomär**: en sammanhållen, färdig, byggbar förändring — inte ett mellansteg i en pågående refaktorering.
- Kör **alltid** `npm run build && npm run lint` lokalt innan push till `main` — det är den enda kvalitetskontroll som finns, eftersom `main` saknar PR-gate.
- **En push till `main` är en release**, inte bara en säkerhetskopia av arbete: `.github/workflows/deploy.yml` bygger och publicerar automatiskt till GitHub Pages på varje push till `main`.
- Commit-meddelanden: se konventionen nedan (svenska, kort, imperativ).
- Branch + PR är fortfarande motiverat undantagsvis: stora, riskfyllda eller experimentella ändringar man vill kunna se i sin helhet innan de går live. Det är undantaget, inte regeln.

## Centrala konventioner

Fullständig motivering i `docs/arkitektur.md` — kortversionen:

- **Svenska i UI, engelska i kod/schema.** Fält-, tabell- och funktionsnamn på engelska; text användaren ser på svenska. Commits: korta, beskrivande, på svenska, imperativ form (se `git log`) — inga conventional-commits-prefix.
- **Varje synkad tabell** ärver `id` (uuid), `updated_at` (ISO, satt av klienten vid varje ändring) och `deleted_at` (soft delete, `null` = levande). Hårdradera aldrig en rad — sätt `deleted_at`.
- **Last-write-wins** avgörs alltid av appens egna `updated_at`, aldrig av PocketBases interna `updated`-systemfält (det används bara för att effektivt avgöra "vad är nytt sedan senaste pull").
- **`number | null`-fält lagras som text i PocketBase**, inte dess nummerfälttyp — annars gör PocketBase om tomt värde till `0`, vilket gör "inget värde" och "värdet är faktiskt 0" omöjliga att skilja åt.
- **Beräknade värden lagras aldrig** (karens-t.o.m., slaktintäkt, beräknad lamning, aktuell plats …) — räkna alltid fram dem ur källdatan i appen.
- **Korsreferenser** (`animal_id` m.fl.) är vanliga textfält med appens eget UUID, inte PocketBases relationsfälttyp — appen känner bara sina egna ID:n.

## Recept: lägga till en ny synkad tabell/entitet

Det här mönstret upprepas varje gång en ny datatyp ska kunna delas mellan enheter. **Alla stegen nedan behövs** — det räcker inte att bara lägga till en lokal Dexie-tabell. Det ser då ut att fungera (data sparas och visas fint på den enhet som skapade den) men syns aldrig på andra enheter. Det har hänt två gånger i det här repot innan det upptäcktes: foton (fas 6a) och avelsegenskaper (fas 6b) lades båda till efter att synken redan fanns, och båda glömdes bort i den — se revision 4 och 5 i `docs/arkitektur.md`.

1. **`app/src/db/types.ts`** — ny `interface` som utökar `BaseRow` (ger `id`/`updated_at`/`deleted_at`).
2. **`app/src/db/db.ts`** — lägg till tabellen som en `Table<T, string>`-property på `StalljournalDB`, och en ny `this.version(N).stores({...})`-block (bumpa versionsnumret; ta bara med nya/ändrade tabeller i det blocket — Dexie-scheman är additiva, upprepa inte oförändrade tabeller).
3. **`server/pb_migrations/`** — ny migrationsfil, kopiera formen från en befintlig (t.ex. `*_created_body_conditions.js`): fälten `client_id` (text, required), `updated_at` (text, required), `deleted_at` (text, valfri), samt `created`/`updated` (`autodate`), samma fyra rules (`createRule`/`updateRule`/`deleteRule`/`listRule`/`viewRule` = `"@request.auth.id != ''"`), unikt index på `client_id`. Fälttyp: `text` för strängar/nullable tal/referenser (se ovan), `number` bara för icke-nullable tal, `bool` för booleaner, `file` bara för faktisk binärdata.
4. **`app/src/sync/sync.ts`** — lägg till `{ local, collection, nullableText?, nullableNumber? }` i `TABLES`-arrayen. **Undantag:** innehåller tabellen binärdata (bild/fil) räcker inte det generiska JSON-flödet — bygg ett eget pull/push-par vid sidan av `TABLES` (se `pullPhotos`/`pushPhotos` som mall: multipart-uppladdning vid nyskapande, autentiserad nedladdning via `client.files.getToken()` vid hämtning, ingen omuppladdning av oförändrad fil).
5. **Dokumentation** — tabellen in i `docs/arkitektur.md` §3 (tabellista) och en ny revisionsrad om det är en arkitekturellt relevant ändring, collection-antalet i `server/README.md`, och ev. den domänspecifika docs-filen (t.ex. `docs/avel.md`) om en sådan finns för funktionen.
6. **Verifiera** — `cd app && npm run build && npm run lint`. Se caveaten nedan om varför migrationsfilen inte kan köras/verifieras här.

Det enda avsiktliga undantaget som INTE ska synkas: `app_setting` — ren lokal enhetskonfiguration, saknar `updated_at`/`deleted_at` helt (inte bara satt till null).

## Caveat: PocketBase-migrationer skrivs blint i agentmiljön

Det finns ingen körande PocketBase-server tillgänglig i den här utvecklingsmiljön, så nya migrationsfiler skrivs för hand genom att kopiera fältformen från befintliga migrationer — de har **inte** körts mot en riktig server innan de pushas. Har du (eller användaren) tillgång till en server: kör `./pocketbase serve`, låt den auto-migrera, och stäm av i adminpanelen (`/_/`) att collectionen ser ut som väntat. Upptäcker du att en redan pushad migration är fel: lägg till en ny migrationsfil som rättar till det — PocketBase-migrationer är framåtriktade, redigera inte en fil som redan kan ha körts på en riktig server.

## Synk i stort

`docs/synk.md` är installationsguiden (PocketBase + Tailscale). Push/pull körs vid appstart, var 5:e minut medan appen är öppen, vid återkommen nätanslutning, och manuellt via Mer → Synkronisering (`app/src/pages/SyncPage.tsx`, logik i `app/src/sync/sync.ts`). Servern är helt valfri — appen är fullt användbar offline utan den, och synken är last-write-wins per rad, inte en fullständig CRDT/merge-lösning (tillräckligt för 1–5 användare på samma gård, inte tänkt att skala bortom det).

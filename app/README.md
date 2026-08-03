# Fri Stalljournal — PWA

Offline-first webbapp (PWA) för fårproducenter. Se `../docs/domanoversikt.md` för vad appen gör och varför, `../docs/arkitektur.md` för den tekniska arkitekturen, och `../docs/synk.md` för att sätta upp delad data mellan flera användare.

## Teknik

- **React + TypeScript + Vite** — appramverk
- **Dexie (IndexedDB)** — lokal databas, sanningskälla offline
- **vite-plugin-pwa** — service worker + manifest, installeras på hemskärmen från Safari
- **PocketBase** (självhostad, se `../server/` och `../docs/synk.md`) + **Tailscale** — delad data mellan enheter/användare, ingen molnleverantör

## Utveckling

```bash
npm install
npm run dev        # dev-server
npm run build      # typkontroll + produktionsbygge till dist/
npm run preview    # kör produktionsbygget lokalt
```

## Status (byggfaser, se arkitektur.md §6)

- [x] **Fas 1 — Grund:** projekt, PWA-manifest/service worker, Dexie-schema (hela datamodellen), bottennav, djurregistret (lista/sök/detalj/formulär med härstamning och dublettkontroll), karensvakt i djurlista/detalj
- [x] **Fas 2 — Fältfunktioner:** grupper med medlemshantering (massval), platser med karta (Leaflet/OSM) och GPS-/kartvald position, flyttlogik (auto-stänger föregående placering, betesdagar), vägning med bulkläge och viktkurvor (Recharts, lazy-laddad), behandlingar med karens, gruppbehandling (en journalrad per djur), journalflik med händelsefeed
- [x] **Fas 3 — Avel & hälsa:** lamning med automatiskt skapade lamm (mor/far/födelsedatum sätts, födelsevikt blir vägningsrad), betäckning med dräktighetsprognos (+147 dagar, badge på tackan tills lamning registrerats), hullbedömning, träckprov med parasitvärden (djur eller grupp), utfodring per grupp; alla händelsetyper i journalfeeden
- [x] **Fas 4 — Slakt & rapport:** slaktregister (planerad/anmäld/slaktad) med EUROP-klassning, fettgrupp och intäktsberäkning; karensvakt som varnar och blockerar slakt under pågående karens; vid genomförd slakt markeras djuret automatiskt som slaktat och tas ur sina grupper; slakteriregister; årsrapport (besättning, lamning, tillväxt, slakt, läkemedel) med utskrift/PDF
- [x] **Fas 5a — Publicering:** GitHub Actions-workflow som bygger och publicerar appen till GitHub Pages vid varje push till `main` (`.github/workflows/deploy.yml`). App-URL: `https://kanintespela.github.io/Stalljournal/`
- [x] **Fas 5b — Delad data:** synkmotor mot självhostad PocketBase (`app/src/sync/`) — push/pull med `updated_at`/`deleted_at`, last-write-wins, automatisk bakgrundssynk (appstart, var 5:e minut, vid återkommen nätanslutning) + manuell synk under Mer → Synkronisering. Serverschema i `server/pb_migrations/`, installationsguide i `docs/synk.md` (PocketBase + Tailscale).
- [x] **Fas 6a — Foton:** djur kan få flera foton, komprimerade och lagrade lokalt (IndexedDB), galleri med lightbox i djurdetaljvyn. Synkas till servern som ett PocketBase-filfält (`animal_photos`).
- [x] **Fas 6b — Avelsegenskaper:** egna, fritt definierade egenskaper (temperament, exteriör, ullfällning m.m.) med registrering per djur och rangordning per egenskap; tillväxtjämförelse korrigerad för kullstorlek (kontemporärgruppsjämförelse). Synkas till servern (`traits`, `trait_records`). Se `docs/avel.md`.
- [x] **Fas 6c — Dokument:** PDF/Excel-dokument (foderanalys, träckprovsanalys, ansökningar m.m.) sparas lokalt, valfritt kopplade till ett djur eller en grupp; eget bibliotek under Mer → Dokument samt inbäddat i djurdetaljvyn. Lagras som Blob i IndexedDB, synkas inte ännu mot servern (samma begränsning som foton var innan Fas 6a synkades).
- [x] **Fas 6d — Förflyttningar till/från anläggningen:** registrering av när ett djur lämnar eller kommer till anläggningen (annan besättning, slakteri eller transportör) med riktning, datum och motpartens SE-nummer/registreringsnummer — lagkrav enligt djurhälsolagen (AHL) och Jordbruksverkets föreskrifter för smittspårning. Egen knapp i journalen och på djurkortet, syns i journalfeeden och på djurets sida. Flera djur kan väljas samtidigt, och ett nytt djur som köps/tas emot kan skapas tillsammans med sin in-förflyttning direkt i djurformuläret. Vid en "ut"-flytt kan appen fylla i och öppna Jordbruksverkets riktiga PDF-blankett (förflyttningsdokument, SJV JSB3.12) med pdf-lib, helt offline. Synkas till servern (`animal_movements`).

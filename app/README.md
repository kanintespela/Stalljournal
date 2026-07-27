# Stalljournal — PWA

Offline-first webbapp (PWA) för fårproducenter. Se `../docs/arkitektur.md` för arkitekturen och `../docs/kartlaggning.md` för kartläggningen av AppSheet-appen den ersätter.

## Teknik

- **React + TypeScript + Vite** — appramverk
- **Dexie (IndexedDB)** — lokal databas, sanningskälla offline
- **vite-plugin-pwa** — service worker + manifest, installeras på hemskärmen från Safari
- **Supabase** (fas 5) — moln-synk, auth och fillagring

## Utveckling

```bash
npm install
npm run dev        # dev-server
npm run build      # typkontroll + produktionsbygge till dist/
npm run preview    # kör produktionsbygget lokalt
```

## Status (byggfaser, se arkitektur.md §6)

- [x] **Fas 1 — Grund:** projekt, PWA-manifest/service worker, Dexie-schema (hela datamodell v2), bottennav, djurregistret (lista/sök/detalj/formulär med härstamning och dublettkontroll), karensvakt i djurlista/detalj
- [x] **Fas 2 — Fältfunktioner:** grupper med medlemshantering (massval), platser med karta (Leaflet/OSM) och GPS-/kartvald position, flyttlogik (auto-stänger föregående placering, betesdagar), vägning med bulkläge och viktkurvor (Recharts, lazy-laddad), behandlingar med karens, gruppbehandling (en journalrad per djur), journalflik med händelsefeed
- [ ] Fas 3 — Lamning, betäckning, hull, träckprov, foder
- [ ] Fas 4 — Slakt, avräkning, årsrapport
- [ ] Fas 5 — Supabase-synk, migrering från Google Sheets, deploy

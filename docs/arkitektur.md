# Fri Stalljournal — Arkitektur och byggspec

**Bygger på:** `docs/domanoversikt.md` (vad appen behöver göra och varför).
**Princip:** Datamodellen och funktionerna är designade från grunden för att vara enkla att förstå och underhålla — inte begränsade av något tidigare verktyg.

**Revision 2 (2026-07-27):** Plattformsval ändrat från native SwiftUI till **offline-first PWA**, eftersom appägaren inte har Mac och inte vill betala för Apple Developer Program. Automationslogiken i §4 är bekräftad av appägaren; årsrapporten är för egen produktionsuppföljning.

**Revision 3 (2026-07-27):** Backend ändrat från Supabase (moln) till **självhostad PocketBase + Tailscale**, på appägarens egen begäran — man har hårdvara hemma som kan stå på och vill inte vara beroende av en molnleverantör. Se `docs/synk.md` för installationsguide. Synklogiken (push/pull, last-write-wins) är oförändrad i sak; bara var servern körs har ändrats.

**Revision 4 (2026-08-01):** Djurfoton (`animal_photo`) synkas nu också, via ett PocketBase-filfält i en ny collection (`animal_photos`). Tidigare lagrades foton bara lokalt i IndexedDB, vilket gjorde att bilder tagna på en enhet inte syntes på andras — allt annat synkades men inte foton. Synkmotorn hanterar filen separat från de vanliga JSON-tabellerna (multipart-uppladdning vid nyskapande, autentiserad nedladdning via engångstoken vid hämtning) eftersom PocketBases generiska JSON-baserade push/pull inte hanterar binärdata.

**Revision 5 (2026-08-01):** Avelsegenskaperna (`trait`, `trait_record`, fas 6b) hade samma lucka som foton — lokala Dexie-tabeller utan motsvarande PocketBase-collection, och saknades i synkmotorns `TABLES`-lista. Åtgärdat på samma sätt som övriga JSON-tabeller (ingen binärdata inblandad här, så de följer det generiska push/pull-flödet direkt). Efter detta har all data i modellen utom `app_setting` (avsiktligt lokal enhetskonfiguration) en motsvarighet på servern och synkas.

**Revision 6 (2026-08-03):** Ny tabell `animal_movement` (fas 6d) — förflyttningar av enskilda djur till/från anläggningen (annan besättning, slakteri eller transportör), med motpartens SE-nummer/registreringsnummer. Tillkom efter att appägaren efterfrågade en avstämning mot EU:s djurhälsolag (AHL) och Jordbruksverkets föreskrifter för stalljournaler: djurantal, födslar och dödsfall täcktes redan av datamodellen, men förflyttningar till/från anläggningen saknade en strukturerad plats att registreras på — `group_move` täcker bara flytt mellan egna platser, och `Animal.exit_reason` är fritext utan fält för motpartens SE-nummer. Fristående journalrad per djur (som `treatment`/`weighing`), ingen automatik mot `Animal.status`/`entry_date`/`exit_date`.

---

## 0. Varför PWA — och vad det innebär

Native iOS-appar kan bara byggas/signeras på en Mac och kräver Apple Developer Program (99 USD/år) för att installeras via TestFlight/App Store. Utan båda är native-spåret stängt.

En **PWA** är en webbapp som installeras på hemskärmen från Safari ("Dela → Lägg till på hemskärmen") och därefter beter sig som en app: egen ikon, fullskärm utan webbläsarram, **fungerar offline**, kamera och GPS fungerar. Ingen Mac, inget Apple-konto, ingen App Store-granskning — och den fungerar på Android och dator också, med samma kodbas.

Vad man ger upp jämfört med native, och varför det är acceptabelt här:

| Begränsning | Bedömning för Stalljournal |
|---|---|
| Ingen App Store-närvaro | Irrelevant — appen är för eget bruk. |
| Pushnotiser kräver iOS 16.4+ och att appen är installerad på hemskärmen | Acceptabelt; påminnelser (karens, lamning) fungerar när appen är installerad. |
| Något mindre "native-känsla" i animationer | Marginellt; en välbyggd PWA känns i praktiken mycket nära en native app. |
| Safari kan i teorin rensa lagring för webbplatser som inte används | Gäller inte hemskärmsinstallerade appar i praktiken, och all data finns alltid även på den egna servern hemma — telefonen är aldrig enda kopian när synk är aktiverad. |

**Kostnad för hela driften: 0 kr/mån** (utöver hårdvara du redan äger) — GitHub Pages för appen (gratis) + självhostad PocketBase på egen hårdvara + Tailscale (gratis för privat bruk).

## 1. Arkitekturbeslut

| # | Beslut | Val | Motivering |
|---|---|---|---|
| A1 | Plattform | **PWA** — React + TypeScript + Vite | Enda vägen till iPhone utan Mac/Apple-konto. Samma app fungerar på Android/dator. Störst ekosystem, lätt att underhålla. |
| A2 | Lokal lagring | **IndexedDB via Dexie** | Lokal databas i webbläsaren; sanningskälla offline. Dexie ger schema, index och transaktioner. |
| A3 | Backend | **Självhostad PocketBase** (SQLite + Auth + REST/realtime-API), nådd via **Tailscale** | Riktig delad databas, körd på hårdvara appägaren redan har hemma — ingen molnleverantör, ingen månadskostnad. Tailscale ger säker åtkomst både på hemma-wifi och ute i fält utan att öppna portar mot internet. Enkelt att självhosta (en enda binär). Se `docs/synk.md`. |
| A4 | Offline | **Offline-first** | Fältarbete i stall/hage utan täckning är appens vardag. Service worker cachar appen; Dexie håller datan; allt fungerar utan nät. |
| A5 | Synkstrategi | Push/pull med `updated_at` + soft delete, **last-write-wins per rad** | Enkel, förutsägbar, tillräcklig för 1–5 användare på samma gård. |
| A6 | Affärslogik | **I appen som explicita "use cases", transaktionellt** | De automatiska beteendena (se `domanoversikt.md` §3) körs som vanliga funktioner i en lokal transaktion (fungerar offline) och synkas som radändringar. **Bekräftat av appägaren:** (a) lamning skapar lamm som djur, (b) ny flytt avslutar föregående placering, (c) slakt markerar djuret och stänger grupprelationer, (d) gruppbehandling ger en journalrad per djur. |
| A7 | Rapporter | Genereras i appen (utskriftsvänlig HTML → "Skriv ut/Spara som PDF", alt. jsPDF) | Årsrapporten är för **egen produktionsuppföljning** (ej myndighetsformat) — vi utformar den fritt: produktionsnyckeltal, lamningsresultat, tillväxt, slaktutfall, läkemedelsanvändning. |
| A8 | Distribution | **Hemskärmsinstallation från Safari** + statisk hosting (GitHub Pages) | Ingen butik, inga konton hos Apple, uppdateringar rullas ut automatiskt vid varje ändring (`.github/workflows/deploy.yml`). |
| A9 | Språk | Svenska i UI, engelska i kod/schema | Undviker å/ä/ö-problem i kod och API. |
| A10 | Kartor | **Leaflet + OpenStreetMap** | Gratis, ingen API-nyckel, räcker för platser/beten. |
| A11 | Diagram | **Recharts** (viktkurvor m.m.) | Enkelt, väletablerat. |

## 2. Systemöversikt

```
┌──────────────────── iPhone (Safari / hemskärmsapp) ───────────────────┐
│  React-UI (svenska, mobilanpassat, stora tryckytor)                   │
│      │                                                                │
│  Use cases (affärslogik: lamning, flytt, slakt, gruppdos, karens …)   │
│      │                                                                │
│  Dexie / IndexedDB  ←— lokal sanningskälla, fungerar helt offline     │
│      │                                          Service worker        │
│  Synkmotor (bakgrund: push lokala ändringar,    cachar appen för      │
│             pull fjärrändringar)                offline-start         │
└──────┼────────────────────────────────────────────────────────────────┘
       │ HTTPS via Tailscale (pocketbase-js)
┌──────┴──────── PocketBase, självhostad hemma (Raspberry Pi/NAS) ──────┐
│  SQLite (samma schema + client_id/updated_at/deleted_at)              │
│  Auth (e-postinloggning, delad av alla på gården)                     │
└───────────────────────────────────────────────────────────────────────┘
```

Synkmotorn (`app/src/sync/`): varje tabell har `updated_at` (satt av klienten, avgör vem som vinner vid krock — last-write-wins) och `deleted_at` (soft delete). Push/pull körs vid appstart, var 5:e minut medan appen är öppen, vid återkommen nätanslutning, och manuellt via Mer → Synkronisering. PocketBases eget `updated`-systemfält (satt av servern) används bara för att effektivt avgöra vad som är nytt sedan sist vid pull — konflikthanteringen avgörs alltid av appens egna `updated_at`. Nollbara tal (parasitvärden, slaktvikt m.m.) lagras som text i PocketBase, inte som dess nummerfälttyp, eftersom PocketBase annars gör om ett tomt/null-värde till `0` — vilket gör "inget värde" och "värdet är faktiskt 0" omöjliga att skilja åt. Appen är fullt användbar utan server/nät; synken aktiveras när en PocketBase-server är konfigurerad under Mer → Synkronisering (se `docs/synk.md`).

## 3. Datamodell

### Tabeller

```
animal(id, tag_number, se_number, name, birth_date, sex, breed,
       mother_id→animal, father_id→animal, status, entry_date, exit_date,
       exit_reason, photo_path, notes, lambing_id→lambing,
       slaughter_status, planned_slaughter_date)
place(id, name, type, description, active, lat, lng)
herd_group(id, name, description, active)
group_membership(id, animal_id→animal, group_id→herd_group,
                 added_on, removed_on)      -- ersätter Aktiv-flaggan med datumintervall
group_move(id, group_id→herd_group, place_id→place,
           moved_on, ended_on, end_reason, note)
animal_movement(id, animal_id→animal, direction, date, counterparty_type,
           counterparty_name, counterparty_se_number, note)
           -- till/från anläggningen (annan besättning/slakteri/transportör),
           -- till skillnad från group_move som bara flyttar internt

treatment(id, animal_id→animal, date, drug, dose, route, treated_by,
          diagnosis, veterinarian, withdrawal_days, note, photo_path)
          -- karens t.o.m. = date + withdrawal_days: BERÄKNAS, lagras inte
weighing(id, animal_id→animal, date, weight_kg, type)
lambing(id, ewe_id→animal, date, live_count, dead_count, note)
          -- lamm hämtas via animal.lambing_id: kolumnerna lamm_id_1..3 UTGÅR
mating(id, ewe_id→animal, ram_id→animal, start_date, end_date)
          -- beräknad lamning = start_date + 147 dagar: BERÄKNAS
body_condition(id, animal_id→animal, date, score, note, photo_path)
animal_photo(id, animal_id→animal, taken_on, note, photo [fil], width, height)
parasite_sample(id, date, animal_id?→animal, group_id?→herd_group, type,
                result, note, file_path, trichostrongylida, haemonchus_pct,
                t_axei_pct, chab_oes, n_filaria, n_spathiger, n_battus, capillaria)
feeding(id, group_id→herd_group, date, feed_type, amount, note)

slaughterhouse(id, name, address, contact, phone, email)
slaughter(id, animal_id→animal, slaughterhouse_id→slaughterhouse, date,
          status, carcass_weight, grade, fat_class, price_per_kg, note,
          registered_by, registered_at)
          -- intäkt = price_per_kg × carcass_weight: BERÄKNAS
slaughter_settlement(id, slaughter_id→slaughter, date, carcass_weight,
          grade, fat_class, price_per_kg, base_amount, adjustments,
          slaughter_fee, transport_fee, total, vat, net_total, file_path)

trait(id, name, unit, direction, target_value, description, active)
          -- se docs/avel.md §2 (fritt definierade avelsegenskaper)
trait_record(id, trait_id→trait, animal_id→animal, date, value, note)

app_setting(key, value)
```

Alla tabeller ovan får dessutom `updated_at` och `deleted_at` och synkas mot servern (se §2 och `app/src/sync/sync.ts`). **Undantaget är `app_setting`**: rent lokal enhetskonfiguration (t.ex. importinställningar) utan `updated_at`/`deleted_at` — den är avsiktligt inte en del av datamodellen som delas mellan enheter. Servern (PocketBase) delas av alla på gården — det finns ingen gårds- eller kontoindelning i modellen, eftersom appen är byggd för en enskild gårds betrodda användare, inte som en flergårdstjänst.

### Designprinciper i datamodellen

1. **Härstamning är riktiga referenser.** Mor och far pekar på andra djurposter, inte fritext — det gör härstamningen sökbar och pålitlig.
2. **Lamm är egna djurposter.** Varje lamm i en lamning blir en egen `animal`-rad som pekar tillbaka på sin `lambing` — inget tak på antal lamm per kull.
3. **Djurstatus är en tydlig uppsättning värden** (`active`, `sold`, `slaughtered`, `dead`, `gone`) istället för flera separata ja/nej- och fritextfält.
4. **Gruppmedlemskap har datumintervall** (`added_on`/`removed_on`), inte bara en av/på-flagga — det ger historik ("vilka djur var i den här gruppen i somras?").
5. **Beräknade värden lagras aldrig** (karens-t.o.m., intäkt, beräknad lamning, dagar på bete, aktuell plats) — de räknas alltid fram ur källdatan, så de aldrig kan hamna i otakt med den.

## 4. Affärslogik — BEKRÄFTAD

Körs som lokala transaktioner — fungerar offline, synkas som vanliga radändringar.

| Use case | Utlöses av | Gör |
|---|---|---|
| **Registrera lamning** ✅ | Lamningsformulär sparas | Skapar `lambing`-raden + en `animal`-rad per levande lamm (mor = tackan, far = baggen från senaste `mating` om entydig, födelsedatum = lamningsdatum, status = aktiv, `lambing_id` satt). |
| **Flytta grupp** ✅ | Flyttformulär sparas | Skapar ny `group_move` och sätter `ended_on` på gruppens föregående öppna flytt. Aktuell plats = platsen i gruppens öppna flytt. |
| **Registrera slakt** ✅ | Slaktstatus sätts till *Slaktad* | Sätter djurets status till `slaughtered` + `exit_date`, avslutar djurets öppna gruppmedlemskap (`removed_on` = slaktdatum). |
| **Gruppbehandling** ✅ | "Behandla grupp"-formulär | Skapar en `treatment`-rad per aktivt djur i gruppen. |
| **Karensvakt** | Härledd, visas löpande | Djur med pågående karens flaggas i djurlistan och blockerar slaktregistrering med varning. |
| **Dräktighetsprognos** | Härledd | Beräknad lamning = `mating.start_date + 147 dagar`. |
| **Årsrapport** | Rapportknapp | Produktionsuppföljning för valt år: lamningsresultat (lamm/tacka, dödlighet), tillväxt (medeldaglig viktökning), slaktutfall (vikter, klassning, intäkt), läkemedelsanvändning, besättningsutveckling. Utskriftsvänlig → PDF via delningsmenyn. |

## 5. Skärmstruktur

Bottennav (5 flikar):

1. **Djur** — sökbar lista (filter: aktiva/alla), detaljvy med flikar: översikt/härstamning, viktkurva (diagram), behandlingar + karensstatus, lamningar, hull, slakt.
2. **Grupper** — grupper med aktuellt antal och plats; gruppdetalj med medlemmar, flytta-knapp, gruppbehandling, foder.
3. **Journal** — samlad registreringsingång: vägning, behandling, lamning, betäckning, hull, träckprov, foder, extern flytt (till/från anläggningen).
4. **Platser** — lista + kartvy (Leaflet/OSM) med grupper på plats, betesdagar.
5. **Mer** — slakt & avräkning, slakterier, årsrapport, synkronisering.

Genomgående: registrering ska klaras med en hand i fält — stora tryckytor, senaste/vanligaste värden förifyllda, djurval via sök på märkning.

## 6. Byggfaser

| Fas | Innehåll | Resultat |
|---|---|---|
| **1. Grund** | Vite/React/TS-projekt, PWA-manifest + service worker, Dexie-schema, djurregistret CRUD, bottennav | Installerbar app som visar/redigerar djur, helt offline |
| **2. Fältfunktioner** | Grupper, platser, karta, flyttlogik, vägning + viktkurvor, behandlingar + karens, gruppbehandling | Appen täcker den dagliga driften |
| **3. Avel & hälsa** | Lamning (+ auto-skapa lamm), betäckning + prognos, hull, träckprov, foder | Full journalföring |
| **4. Slakt & rapport** | Slaktflöde, avräkning, intäkter, årsrapport | Funktionsparitet + förbättringar |
| **5a. Publicering** | GitHub Pages, PWA-installation | Appen nåbar och installerbar på alla enheter |
| **5b. Delad data** | Självhostad PocketBase (schema i `server/pb_migrations/`), Tailscale, synkmotor, inloggning | Flera användare delar samma data, från valfri plats, appen fungerar fortfarande offline |

Fas 1–4 fungerar helt lokalt i telefonen/webbläsaren utan konto — du kunde använda appen på riktigt innan delad data fanns. Se `docs/synk.md` för hur fas 5b sätts upp.

## 7. Status

Samtliga faser i §6 är genomförda: appen är byggd, publicerad och stödjer delad data mellan flera användare. Se `app/README.md` för en checklista per fas.

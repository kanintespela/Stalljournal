# Stalljournal — Arkitektur och byggspec för native iOS-app

**Bygger på:** `docs/kartlaggning.md` (fullständig kartläggning av AppSheet-appen).
**Princip:** Det är *funktionerna* som ska överleva konverteringen, inte AppSheet-appens exakta utformning. Där AppSheet-modellen hade brister rättar vi dem här.

---

## 1. Arkitekturbeslut (fattade)

| # | Beslut | Val | Motivering |
|---|---|---|---|
| A1 | App-ramverk | **SwiftUI, iOS 17+** | Modern native iOS. Bäst i fält: kamera, karta, snabb UI. Ingen Android-signal i kraven; blir det aktuellt senare är datamodellen och backenden återanvändbara. |
| A2 | Lokal lagring | **SQLite via GRDB** | Robust, transaktionssäker, full kontroll över schema och migreringar — viktigt när lokal DB är sanningskälla offline. Väljs framför SwiftData som fortfarande är för omoget för egen synklogik. |
| A3 | Backend | **Supabase** (Postgres + Auth + Storage) | Riktig relationsdatabas ersätter Google Sheets. Auth och fleranvändarstöd ingår. Storage för foton/filer (ersätter Google Drive). Row Level Security ger gård-isolering om appen någon gång får fler gårdar. Egen serverkod undviks nästan helt. |
| A4 | Offline | **Offline-first** | Fältarbete i stall/hage utan täckning är appens vardag — AppSheet fungerar så idag och den nya appen får inte bli sämre. Lokal DB är sanningskälla; synk sker i bakgrunden när nät finns. |
| A5 | Synkstrategi | Push/pull med `updated_at` + soft delete, **last-write-wins per rad** | Enkel, förutsägbar, tillräcklig för 1–5 användare på samma gård. Konflikter är sällsynta (olika personer registrerar olika saker); LWW per rad med synklogg räcker. |
| A6 | Affärslogik | **I appen som explicita "use cases", transaktionellt** | AppSheets bots blir vanliga funktioner som körs i en lokal transaktion (fungerar därmed även offline) och synkas som vanliga radändringar. Inga serverberoenden för kärnflöden. |
| A7 | Rapporter | Genereras **i appen** (PDF via `UIGraphicsPDFRenderer`), delas via share sheet | Årsrapport och avräkningsunderlag kräver ingen server; datan finns lokalt. |
| A8 | Distribution | **TestFlight först**, App Store-spåret hålls öppet | Snabbast till din telefon. Kräver Apple Developer Program (99 USD/år). |
| A9 | Språk | Svenska i UI, engelska i kod/schema | Koden får engelska namn (`animal`, `treatment`) med svenska UI-etiketter — undviker å/ä/ö-problem i kod och API. |

## 2. Systemöversikt

```
┌─────────────────────────── iPhone ───────────────────────────┐
│  SwiftUI-vyer                                                 │
│      │                                                        │
│  Use cases (affärslogik: lamning, flytt, slakt, gruppdos …)   │
│      │                                                        │
│  GRDB/SQLite  ←— lokal sanningskälla, fungerar helt offline   │
│      │                                                        │
│  Synkmotor (bakgrund: push lokala ändringar, pull fjärr-)     │
└──────┼────────────────────────────────────────────────────────┘
       │ HTTPS (supabase-swift)
┌──────┴────────────────── Supabase ────────────────────────────┐
│  Postgres (samma schema + updated_at/deleted_at)              │
│  Auth (e-post-inloggning, gårdsmedlemskap)                    │
│  Storage (foton, träckprovsfiler, avräknings-PDF:er)          │
└───────────────────────────────────────────────────────────────┘
```

Synkmotorn: varje tabell har `updated_at` (sätts av den som skriver) och `deleted_at` (soft delete). Klienten push:ar lokala ändringar sedan senaste synk, pull:ar därefter rader med nyare `updated_at` än sitt vattenmärke. Foton laddas upp separat till Storage och refereras med path.

## 3. Datamodell v2 (rättade brister)

Fullständig DDL skrivs i implementationsfasen; här är strukturen och de medvetna ändringarna mot AppSheet-modellen.

### Tabeller

```
farm(id, name)                              -- gård; allt nedan har farm_id (framtidssäkring)
user_profile(id, email, name, farm_id, role)

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

treatment(id, animal_id→animal, date, drug, dose, route, treated_by,
          diagnosis, veterinarian, withdrawal_days, note, photo_path)
          -- karens t.o.m. = date + withdrawal_days: BERÄKNAS, lagras inte
weighing(id, animal_id→animal, date, weight_kg, type)
lambing(id, ewe_id→animal, date, live_count, dead_count, note)
          -- lamm hämtas via animal.lambing_id: kolumnerna lamm_id_1..3 UTGÅR
mating(id, ewe_id→animal, ram_id→animal, start_date, end_date)
          -- beräknad lamning = start_date + 147 dagar: BERÄKNAS
body_condition(id, animal_id→animal, date, score, note, photo_path)
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

app_setting(key, value)
```

Alla tabeller får dessutom `farm_id`, `updated_at`, `deleted_at` för synk och gård-isolering.

### Medvetna ändringar mot AppSheet-modellen

1. **`far_id` blir riktig referens** (var fritext i AppSheet — brist).
2. **`lamm_id_1..3` utgår** — lamm är `animal`-rader som pekar på sin `lambing`. Obegränsat antal lamm, ingen härledningskrock.
3. **Djurstatus blir en enum** (`active`, `sold`, `slaughtered`, `dead`, `gone`) — ersätter kombinationen Yes/No-`status` + fritext-`SlaktStatus`/`SlaktKlar` som var inkonsekvent.
4. **Gruppmedlemskap får datumintervall** (`added_on`/`removed_on`) i stället för en Aktiv-flagga — ger historik ("vilka djur var i gruppen i juni?") som AppSheet inte kunde svara på.
5. **Beräknade värden lagras inte** (karens-t.o.m., intäkt, beräknad lamning, dagar på bete, aktuell plats) — de räknas alltid ut ur källdatan, så de aldrig kan bli osynkade. AppSheets tre extra kolumner för samma sak (`aktuell_plats`, `aktuell_plats_virtual`, `datum_senast_flyttad`) blir en enda härledd egenskap.
6. **Temp-tabellerna utgår** (`LäggTillDjurTempR`, `GruppBehandlingTemp`, `HelperTable`, `Vykontroll`) — de var AppSheet-hack för formulärflöden och blir vanlig skärm-state i appen.
7. **`SlaktAvräkning` städas** — exporten visade dubblerade/felmappade kolumner; v2-schemat ovan är den avsedda strukturen.

## 4. Affärslogik (ersätter AppSheets bots och formler)

Körs som lokala transaktioner — fungerar offline, synkas som vanliga radändringar.

| Use case | Utlöses av | Gör |
|---|---|---|
| **Registrera lamning** | Lamningsformulär sparas | Skapar `lambing`-raden + en `animal`-rad per levande lamm (mor = tackan, far = baggen från senaste `mating` om entydig, födelsedatum = lamningsdatum, status = aktiv, `lambing_id` satt). |
| **Flytta grupp** | Flyttformulär sparas | Skapar ny `group_move` och sätter `ended_on` på gruppens föregående öppna flytt. Aktuell plats = platsen i gruppens öppna flytt. |
| **Registrera slakt** | Slaktstatus sätts till *Slaktad* | Sätter djurets status till `slaughtered` + `exit_date`, avslutar djurets öppna gruppmedlemskap (`removed_on` = slaktdatum). |
| **Gruppbehandling** | "Behandla grupp"-formulär | Skapar en `treatment`-rad per aktivt djur i gruppen (ersätter `GruppBehandlingTemp`-hacket). |
| **Karensvakt** | Härledd, visas löpande | Djur med pågående karens (`date + withdrawal_days ≥ idag`) flaggas i djurlistan och blockerar slaktregistrering med varning. |
| **Dräktighetsprognos** | Härledd | Beräknad lamning = `mating.start_date + 147 dagar`; visas i betäckningslistan och som kommande händelse. |
| **Årsrapport** | Rapportknapp | Genererar PDF för valt år: djurförteckning med in-/utgångar, förflyttningar, behandlingar med karens, lamningar, slaktade djur — stalljournalens journalföringskrav. |

## 5. Skärmstruktur

Bottennav (5 flikar, speglar AppSheet-appens där den fungerade bra):

1. **Djur** — sökbar lista (filter: aktiva/alla), detaljvy med flikar: översikt/härstamning, viktkurva (diagram), behandlingar + karensstatus, lamningar, hull, slakt.
2. **Grupper** — grupper med aktuellt antal och plats; gruppdetalj med medlemmar, flytta-knapp, gruppbehandling, foder.
3. **Journal** — samlad registreringsingång: vägning, behandling, lamning, betäckning, hull, träckprov, foder. (Ersätter AppSheets utspridda Behandling/Läkemedel-flikar.)
4. **Platser** — lista + kartvy (MapKit) med grupper på plats, betesdagar.
5. **Mer** — slakt & avräkning, slakterier, årsrapport, inställningar, synkstatus.

Genomgående: registrering ska klaras med en hand i fält — stora tryckytor, senaste/vanligaste värden förifyllda, djurval via sök på märkning.

## 6. Byggfaser

| Fas | Innehåll | Resultat |
|---|---|---|
| **1. Grund** | Xcode-projekt, GRDB-schema + migreringar, Supabase-projekt + schema, auth, synkmotor, djurregistret CRUD | App som visar/redigerar djur, synkar, fungerar offline |
| **2. Fältfunktioner** | Grupper, platser, karta, flyttlogik, vägning + viktkurvor, behandlingar + karens, gruppbehandling | Daglig drift kan flyttas från AppSheet |
| **3. Avel & hälsa** | Lamning (+ auto-skapa lamm), betäckning + prognos, hull, träckprov, foder | Full journalföring |
| **4. Slakt & rapport** | Slaktflöde, avräkning, intäkter, årsrapport-PDF | Funktionsparitet + förbättringar |
| **5. Migrering & leverans** | Datamigrering Sheets→Postgres (skript med ID-mappning), foton från Drive→Storage, TestFlight | Skarp drift på din iPhone |

Fas 1–4 kan byggas och verifieras i simulator/testdata utan att röra din nuvarande AppSheet-app; migreringen i fas 5 görs när appen är godkänd av dig.

## 7. Frågor som kräver svar från dig

Endast fyra saker kan jag inte besluta eller ta reda på själv:

1. **Mac och Apple-konto:** Har du en Mac, och har du (eller vill du skaffa) ett Apple Developer-konto (99 USD/år)? Utan Mac bygger vi via moln-CI (GitHub Actions med Mac-runner); utan dev-konto stannar appen i simulatorn. Detta avgör fas 5 och hur du testar under vägen.
2. **Bekräfta automationsantagandena** i §4 (lamning, flytt, slakt, gruppbehandling) — jag har designat dem efter vad exporten antyder och vad som är korrekt fårhållning, men du vet om AppSheet-appen gjorde något mer/annorlunda. Skärmdumpar från AppSheet-editorns Automation-flik räcker, eller bara "stämmer" per punkt.
3. **Årsrapportens mottagare/innehåll:** Är den tänkt för Jordbruksverkets journalföringskrav (stalljournal för får/get), eller egen produktionsuppföljning — eller båda? Påverkar vilka fält rapporten måste innehålla.
4. **Vid migreringen (fas 5):** export av hela Google-arket (alla flikar) och åtkomst till foto-mappen i Drive. Behövs inte nu.

Allt annat (offline, synk, backend, UI-struktur, datamodell) är beslutat ovan och ändras bara om du invänder.

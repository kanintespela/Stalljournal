# Stalljournal — Kartläggning inför konvertering AppSheet → native iOS

**Underlag:** AppSheet-dokumentation (467 sidor, exporterad 2026-07-11) + datadump `djur.xlsx`.
**App:** Stalljournal v1.000421 — digital stalljournal för svenska fårproducenter.
**Syfte med dokumentet:** en fullständig karta över appens data, logik och gränssnitt, så att vi vet exakt vad som ska byggas *innan* vi skriver kod.

> Not om käll­datan: AppSheet-exporten är gjord från en PDF där `ff`-ligaturer fallit bort. I dokumentationen står det t.ex. `förIyttning`, `id_Iytt`, `N_elaria`. Rätt namn är **förflyttning**, **id_flytt**, **N_filaria** osv. Nedan används de korrekta namnen.

---

## 1. Sammanfattning

| Mått | Värde |
|---|---|
| Tabeller (varav verkliga datatabeller) | 30 (21 verkliga, resten system-/temp-/process­tabeller) |
| Kolumner totalt | 355 |
| Slices (filtrerade vyer på data) | 6 |
| Vyer (UX) | 87 (5 i bottennav, 7 i meny, 75 auto-genererade ref-vyer) |
| Actions | 34 dokumenterade (mest auto Add/Edit/Delete + 7 navigering) |
| Automationer (bots/processer) | 4 (lamning, förflyttning, gruppåtgärd, slakt) |
| Datakälla | Google Sheets (`djur.gsheet`), locale `sv-SE` |
| Delad? | Ja (flera användare), fältorienterad app (`Field_Service`) |

**Slutsats:** Appen är fullt byggbar som native iOS-app, men den är en riktig verksamhetsapp — inte en enkel lista. Den tunga delen är inte gränssnittet utan (a) affärslogiken i virtuella kolumner + de fyra automationerna, och (b) att byta ut Google Sheets mot en riktig databas med relations­integritet och fleranvändar­synk.

---

## 2. Datamodell

### 2.1 Kärnentiteter och relationer

```
                       ┌─────────────┐
                       │   platser   │  (hagar, stall, betesmarker)
                       └──────┬──────┘
                              │ 1
                              │ finns på (via förflyttningsjournal)
                              │ *
   ┌──────────┐  *      ┌─────┴──────┐
   │ foder-   ├────────►│  grupper   │  (djurgrupper)
   │ journal  │         └─────┬──────┘
   └──────────┘               │ *  (DjurGruppRelation = koppling M:N, med Aktiv-flagga)
                              │
                         ┌────┴─────┐
                         │   djur   │◄──── mor_id / far_id (självreferens, härstamning)
                         └────┬─────┘
        ┌───────────┬─────────┼──────────┬────────────┬──────────┐
        │           │         │          │            │          │
   läkemedels-  vägnings-  lamnings-  betäcknings-  hull-     behandlings-
   journal      journal    journal    journal       bedömning uppgifter (träckprov/parasit)
        │
        └── Slakt ──► SlaktAvräkning
                 └──► Slakteri
```

### 2.2 Tabeller (lagrade fält, 🔑 = del av nyckel)

**`djur`** — djurregistret (central entitet)
`id_djur`🔑, märkning, se_nummer, internt_namn, födelsedatum, kön (Enum), ras, `mor_id`→djur, far_id, status (Ja/Nej), datum_ingång, datum_utgång, orsak_utgång, foto (bild), anteckningar, `Lamnings_ID`→lamningsjournal, SlaktStatus, BeräknadSlaktDatum, SlaktKlar, SenasteSlaktViktPrognos.

**`platser`** — hagar/stall/betesmark
`id_plats`🔑, namn, typ, beskrivning, aktiv (Ja/Nej), position (LatLong — karta).

**`grupper`** — djurgrupper
`id_grupp`🔑, namn, beskrivning, aktuell_plats, datum_senast_flyttad, ÄrAktiv (Ja/Nej).
*Virtuella:* AktivaMedlemmar, aktuell_plats_virtual, AktivtAntal (se §3).

**`DjurGruppRelation`** — M:N-koppling djur↔grupp
`ID`🔑, `Ref_Djur`→djur, `Ref_Grupp`→grupper, Datum_Tillagd, Aktiv (Ja/Nej).

**`läkemedelsjournal`** — behandlingar med karens
`id_behandling`🔑, datum, `djur_id`→djur, läkemedel, dosering, administration, behandlande_person, orsak_diagnos, veterinär, karens_dagar, **karens_tom** (beräknad), anteckningar om hälsotillstånd, foto.

**`förflyttningsjournal`** — flytt av grupp mellan platser
`id_flytt`🔑, `Ref_Grupp`→grupper, `Ref_Platser`→platser, Datum_Flytt, Anteckning, Slutdatum, startdatum, AvslutOrsak.
*Virtuell:* Dagar_på_betet (se §3).

**`lamningsjournal`** — lamning
`id_lamning`🔑, `tacka_id`→djur, datum, antal_levande_lamm, döda, `lamm_id_1..3`→djur, anteckningar.
*Virtuell:* LammList.

**`betäckningsjournal`** — betäckning/dräktighet
id_betäckning, `tacka_id`🔑→djur, `bagge_id`→djur, startdatum, slutdatum, beräknad_lamning.

**`vägningsjournal`** — vägningar
`id_vägning`🔑, `djur_id`→djur, datum, vikt_kg (Decimal), typ_av_vägning.
*Virtuell:* märkning (= `[djur_id].[märkning]`).

**`hullbedömning`** — hullpoäng (body condition score)
ID🔑, Djur_ID→djur, Datum, Hullpoäng, Notering, Foto.

**`behandlingsuppgifter`** — träckprov / parasitanalys
`id_behandling`🔑, behandlingstyp (Enum), datum, resultat, `id_djur`→djur, id_grupp→grupper, anteckning, fil (File), samt parasit­värden: Trichostrongylida, Andel_Haemonchus (%), Andel_T_axei, Chab_oes, N_filaria, N_spathiger, N_battus, Capillaria.

**`foderjournal`** — foder per grupp
id_foder, datum, `grupp_id`🔑→grupper, fodertyp, mängd, anteckningar.

**`Slakt`** — slaktregistrering
`SlaktID`🔑, `DjurID`→djur, SlaktDatum, `SlakteriID`→Slakteri, Status (Enum: Planerad…), FaktiskSlaktvikt, Noteringar, RegistreradAv, RegistreringsDatum, klassning (Enum), fettgrupp (Enum), kr_per_kg, **intäkt** (= kr_per_kg × FaktiskSlaktvikt).
*Virtuell:* DisplayName.

**`SlaktAvräkning`** — avräkning från slakteri
`AvräkningID`🔑, SlaktID, AvräkningsDatum, SlaktVikt, Klassning, Fettgrupp, KgPris, Grundpris, PåslagAvdrag, SlaktKostnad, TransportKostnad, Summa, MomsBelopp, NettoSumma, AvräkningsFil.

**`Slakteri`** — slakterier
SlakteriID🔑, SlakteriNamn, Adress, Kontaktperson, Telefon, Email.

**`ÅrsrapportBegäran`** — begäran om årsrapport (utlöser rapportgenerering)
`ID`🔑, År, BegärdAv (Email), BegärdTid (DateTime), Bearbetad (Ja/Nej).

**`inställningar`** — nyckel/värde-inställningar (fältnamn🔑, värde).

**Temp-/hjälptabeller (kan ersättas med app-state, inte databastabeller):**
`LäggTillDjurTempR` (ValdaDjur EnumList + Ref_Grupp — massval av djur till grupp), `GruppBehandlingTemp` (formulär för att behandla en hel grupp på en gång), `HelperTable`, `Vykontroll` (styr en vy-flik).

**Systemtabeller (AppSheet-internt, byggs inte om):** `_Per User Settings`, samt fyra `Process … Table`/`Output`-tabeller som är AppSheets interna representation av automationerna i §4.

---

## 3. Beräknad logik (virtuella kolumner & formler)

Detta är logik som AppSheet räknar ut automatiskt och som måste **skrivas om som riktig kod** (i backend eller klient).

| Fält | Tabell | Formel (AppSheet) | Betydelse |
|---|---|---|---|
| `karens_tom` | läkemedelsjournal | `[datum] + [karens_dagar]` | Karenstid t.o.m. — får inte slaktas/mjölkas före. |
| `intäkt` | Slakt | `[kr_per_kg] * [FaktiskSlaktvikt]` | Slaktintäkt. |
| `märkning` | vägningsjournal | `[djur_id].[märkning]` | Denormaliserad uppslagning. |
| `id_lamning` | lamningsjournal | `CONCATENATE("L", YEAR([datum]), "-", UNIQUEID())` | Läsbart lamnings-ID per år. |
| `aktuell_plats_virtual` | grupper | `LOOKUP( MAXROW("förflyttningsjournal","Datum_Flytt", [Ref_Grupp]=[id_grupp]), … "Ref_Platser")` | Gruppens **nuvarande plats** = platsen i den senaste flyttraden. |
| `AktivtAntal` | grupper | `COUNT(SELECT(DjurGruppRelation[ID], AND([Ref_Grupp]=…, [Aktiv]=TRUE, ANY(djur.status) IN {"Aktiv","Växande"})))` | Antal aktiva djur i gruppen. |
| `AktivaMedlemmar` | grupper | `REF_ROWS("DjurGruppRelation_AktivaMedlemmar","Ref_Grupp")` | Lista över aktiva medlemmar. |
| `Dagar_på_betet` | förflyttningsjournal | `IF(slutdatum satt → slutdatum−flytt; annars nästa flytt−flytt; annars idag−flytt)` (i dygn) | Betesdagar för perioden. |

Dessutom **initialvärden** som ska replikeras: `UNIQUEID()` för nya nycklar, `TODAY()`/`NOW()` för datum, `status=TRUE` för nya djur, `USEREMAIL()` för registrerad-av, `Status=Planerad` för ny slakt m.fl.

---

## 4. Automationer (bots) — DOLD, KRITISK LOGIK

AppSheet-exporten visar att fyra automationer finns, men **inte deras exakta villkor/steg** (bara namnen). Detta är den viktigaste luckan att fylla (se §8). Utifrån namnen är avsikten:

1. **B0 – Skapa lamm vid lamning** — när en `lamningsjournal`-rad skapas genereras automatiskt nya `djur`-poster för lammen (kopplade via `Lamnings_ID`, med mor = tacka).
2. **B1 – Sätt slutdatum på tidigare rad** — när en ny `förflyttningsjournal`-rad läggs till stängs den föregående placeringen (dess `Slutdatum` sätts). Detta driver `aktuell_plats_virtual`.
3. **B2 – (okänt steg)** — troligen kopplat till gruppbehandling (`GruppBehandlingTemp` → skapar `läkemedelsjournal`-rader för varje djur i gruppen). Måste verifieras.
4. **B_Slakt_Add** — när en slakt registreras: (a) **markera djuret som slaktat** (sätt `status`/`SlaktStatus` på djuret) och (b) **stäng aktiva grupprelationer** för djuret (`DjurGruppRelation.Aktiv = FALSE`).

---

## 5. Slices (filtrerade dataset)

| Slice | Källtabell | Filter | Användning |
|---|---|---|---|
| `AktivaDjur` | djur | `[status]=TRUE` | Visa bara aktiva djur. |
| `VägningarAktivaDjur` | vägningsjournal | `[djur_id] IN aktiva djur` | Vägningar för aktiva djur. |
| `vikt_slice` | vägningsjournal | (alla kolumner) | Underlag för viktkurvor. |
| `DjurGruppRelation_AktivaMedlemmar` | DjurGruppRelation | `[Aktiv]=TRUE` (read-only) | Aktiva gruppmedlemmar. |
| `Flyttar_Senaste` | förflyttningsjournal | `TRUE` | Flytthistorik-vy. |
| `vyfilter` | Vykontroll | `[ID]="1"` | Vy-styrning. |

---

## 6. UX / vy-struktur

**Bottennavigering (5 flikar):** `djur` (tabell) · `Grupper` (tabell) · `Behandling` (tabell) · `Läkemedel` (tabell) · `Flytthistorik` (tabell).

**Meny (7 st):** `Produktionsplats` (deck) · `Lamning` (tabell) · `Slakt` (tabell) · `Viktöversikt` (**dashboard**) · `Platser` (tabell) · `Karta` (**map**, LatLong-positioner) · `Årsrapport` (card).

**Vytyper totalt:** 28 formulär, 27 tabeller, 26 detaljvyer, 2 kort, 1 deck, 1 dashboard, 1 karta, 1 diagram (viktkurva). De 75 "ref"-vyerna är auto-genererade detalj/formulär/inline-vyer per tabell — i native bygger de flesta som en enda återanvändbar detalj- + formulärskärm per entitet.

---

## 7. Funktionsområden (det appen faktiskt gör)

1. **Djurregister** med härstamning (mor/far), foto, status, in-/utgång.
2. **Grupper & platser** — M:N-medlemskap, aktuell plats via flyttlogik, betesdagar, karta.
3. **Förflyttningar** — flytta grupp mellan platser, auto-stängning av tidigare period.
4. **Lamning** — registrera lamning, auto-skapa lamm som nya djur.
5. **Betäckning** — beräknad lamningsdag.
6. **Vägning** — viktkurvor/diagram per djur.
7. **Läkemedel & karens** — behandlingar, karenstid t.o.m., gruppbehandling i bulk.
8. **Hullbedömning** — poäng över tid.
9. **Träckprov / parasit** — detaljerad parasitologi (Haemonchus-andel m.m.).
10. **Slakt** — planering, prognos, slaktvikt, klassning, intäkt, avräkning från slakteri, momsberäkning.
11. **Årsrapport** — begäran → genererad rapport (myndighets-/produktionsuppföljning).
12. **Bulkåtgärder** genomgående (massval av djur, gruppbehandling).

---

## 8. Vad jag behöver av dig (luckor att fylla)

Prioriterat, för att kunna bygga korrekt:

1. **De exakta automations­villkoren (bots B0–B2, B_Slakt_Add).** Exporten visar bara namnen. Bästa källan: skärmdumpar från AppSheet-editorn under *Automation*, eller att du delar appen med läsrättigheter. Detta är den enskilt viktigaste luckan.
2. **Åtkomst till/kopior av Google Sheets-data** för alla flikar (jag har bara sett `djur.xlsx`; kontrollera att t.ex. `hullbedömning`, `Slakteri`, `SlaktAvräkning` finns med fullständigt).
3. **Var ligger foton och filer idag?** (Google Drive?) Ska de migreras eller länkas?
4. **Antal användare & roller** — bara du, eller flera på gården samtidigt? Behövs olika behörigheter?
5. **Offline-krav** — måste appen fungera utan täckning i hage/stall (som AppSheet gör idag)? Påverkar arkitekturen mest av allt.
6. **Årsrapport & myndighetsexport** — vilket format/vilken myndighet? Vad ska rapporten innehålla?
7. **Publiceringsmål** — privat via TestFlight, eller publik App Store?

---

## 9. Föreslagen målarkitektur (utkast)

| Lager | Rekommendation | Motivering |
|---|---|---|
| **App** | Native **SwiftUI** (iOS 17+) | Bäst känsla/prestanda i fält, karta, foto, offline. |
| **Lokal lagring** | **SwiftData** eller GRDB/SQLite | Krävs för offline-first (fältarbete utan nät). |
| **Backend/synk** | **Supabase** (Postgres + auth + storage) *eller* Firebase | Riktig relations­databas ersätter Google Sheets; hanterar fleranvändar­synk, foton och filer. |
| **Affärslogik** | Delvis i databasen (vyer/triggers för karens, aktuell plats, slaktflöde), delvis i appen | Det som idag är virtuella kolumner + bots. |
| **Rapporter** | Server-genererad PDF (årsrapport, avräkning) | Motsvarar `ÅrsrapportBegäran`-flödet. |

Alternativ om Android också ska stödjas senare: **Flutter** eller **React Native** istället för SwiftUI (då tappar man lite native-känsla men får en kodbas för båda).

---

## 10. Komplexitet & risk

| Område | Komplexitet | Kommentar |
|---|---|---|
| Offline-synk | 🔴 Hög | Konflikthantering vid fleranvändar­synk är det svåraste. |
| Automationer (lamning/slakt/flytt) | 🟠 Medel–hög | Kaskadlogik som skapar/uppdaterar flera rader. Kräver exakt spec. |
| Slaktavräkning + moms | 🟠 Medel | Ekonomisk korrekthet, många fält. |
| Datamigrering Sheets→DB | 🟠 Medel | ID-mappning, referens­integritet, historik. |
| Datamodell/CRUD/vyer | 🟢 Låg–medel | Rakt fram när modellen är fastställd. |
| Karta, foto, viktkurvor | 🟢 Låg | Standardkomponenter i iOS. |

**Grov omfattning:** flera veckors utveckling för en fullvärdig motsvarighet; en avskalad MVP (djur, grupper, vägning, läkemedel utan offline-synk) går att få fram betydligt snabbare. Rekommendation: bygg MVP först, lägg offline-synk och automationer i steg 2.

---

## 11. Nästa steg

1. Du fyller luckorna i §8 (särskilt automations­logiken och offline-/användarfrågorna).
2. Jag omvandlar detta till en **detaljerad funktions- och datamodell­spec** (tabell-DDL + skärmflöden).
3. Vi beslutar arkitektur (native SwiftUI vs cross-platform, Supabase vs Firebase, offline ja/nej).
4. Jag sätter upp projekt­skelettet och bygger MVP steg för steg.

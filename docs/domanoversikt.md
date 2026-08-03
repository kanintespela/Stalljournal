# Fri Stalljournal — domänöversikt

Det här dokumentet beskriver **vad** Stalljournal behöver hålla reda på och **varför** — verksamheten hos en fårproducent, oberoende av hur appen är byggd tekniskt. Se `arkitektur.md` för den tekniska lösningen och den exakta datamodellen.

---

## 1. Vad appen är till för

Stalljournal är en digital stalljournal för fårproducenter: ett verktyg för att dokumentera djur, deras hälsa och rörelser genom verksamheten, samt de händelser som lagen och den egna driften kräver att man har koll på — lamning, behandlingar, förflyttningar, slakt.

Det är en riktig verksamhetsapp, inte en enkel lista. Tyngdpunkten ligger inte på gränssnittet utan på att:

- korrekt spegla hur ett fårs liv faktiskt går till (härstamning, gruppering, förflyttningar, hälsohändelser, till sist slakt),
- automatiskt sköta den bokföring som annars lätt glöms bort eller görs fel för hand (t.ex. karenstider, aktuell placering),
- fungera i fält utan mobiltäckning, eftersom stall och beten sällan har bra nät.

## 2. Kärnentiteter och deras samband

```
                       ┌─────────────┐
                       │   platser   │  (hagar, stall, betesmarker)
                       └──────┬──────┘
                              │ en grupp befinner sig på en plats åt gången
                              │ (historik förs via förflyttningar)
   ┌──────────┐         ┌─────┴──────┐
   │ foder-   ├────────►│  grupper   │  (djurgrupper, t.ex. "tackor med lamm")
   │ journal  │         └─────┬──────┘
   └──────────┘               │ ett djur kan tillhöra en grupp åt gången
                              │ (medlemskap har start- och slutdatum)
                         ┌────┴─────┐
                         │   djur   │◄──── varje djur har en mor och en far
                         └────┬─────┘      (härstamning, självrefererande)
        ┌───────────┬─────────┼──────────┬────────────┬──────────┐
        │           │         │          │            │          │
   behandlingar  vägningar  lamningar  betäckningar   hull-     prov-
                                                       bedömning tagningar
        │
        └── slakt ──► avräkning
                 └──► slakteri
```

**Djur** är navet i modellen: varje djur har en unik identitet, härstamning (mor/far, som själva är djur i registret), ett kön, en ras, ett status (aktivt/sålt/slaktat/dött/utgånget) och datum för när det kom in i och lämnade besättningen.

**Platser** är de fysiska ytorna — hagar, beten, stall. **Grupper** är de faktiska djurgrupperna man hanterar tillsammans (t.ex. en flock som betar ihop); en grupp befinner sig på en plats i taget, och den historiken (vilken grupp stod var, och hur länge) är värdefull för betesplanering.

## 3. Verksamhetsflöden

### Djurregister och härstamning
Varje djur registreras med märkning, eventuellt SE-nummer, namn, kön, ras och födelsedatum. Mor och far anges som referenser till andra djur i registret, vilket bygger upp en härstamningsgraf man kan följa bakåt och framåt (vilka avkommor ett visst djur har fått).

### Grupper och platser
Djur organiseras i grupper som flyttas mellan platser. Varje flytt registreras med datum, och den tidigare placeringens sluttid sätts automatiskt när en ny flytt sker — man ska aldrig manuellt behöva "stänga" en gammal placering. Det ger både en korrekt bild av var varje grupp befinner sig just nu, och en historik för hur länge olika beten utnyttjats (betesdagar).

### Förflyttningar till/från anläggningen
Utöver flyttar mellan egna platser (se ovan) registreras även när ett enskilt djur lämnar eller kommer till anläggningen — sålt till eller köpt från en annan besättning, skickat till slakteri, eller hämtat av en transportör. Varje sådan händelse registreras med datum, riktning (in/ut), djurets identitet och motpartens SE-nummer eller registreringsnummer (den mottagande/avsändande anläggningen, slakteriet eller transportören). Det är ett uttryckligt krav enligt EU:s djurhälsolag (AHL) och Jordbruksverkets föreskrifter — stalljournalen ska möjliggöra snabb smittspårning vid ett sjukdomsutbrott, och förflyttningshistoriken är den del som är svårast att rekonstruera i efterhand om den inte förs löpande.

Vid en "ut"-flytt får man frågan **vad som händer med djuren efter flytten**: kvar i besättningen (t.ex. tillfällig flytt eller bete), sålda, slaktade eller utgångna. Väljer man något annat än "kvar" markeras djuren med den statusen, får utgångsdatum och tas ur sina grupper — samma automatik som slaktflödet. Valet är alltid explicit (appen gissar aldrig utifrån motpartens typ), och för slakt med vikt/klassning/intäkt hänvisar formuläret till det riktiga slaktflödet som gör allt det plus statusändringen.

Felregistrerade journalrader (förflyttningar, vägningar, hullbedömningar, behandlingar, betäckningar, lamningar) kan tas bort direkt från djurkortet — folk gör fel ibland, och en journal man inte kan rätta blir fel för alltid. Borttagning är en soft delete (raden döljs och synkas som borttagen, försvinner på alla enheter). Obs: att ta bort en flytt som hann ändra djurets status återställer **inte** statusen automatiskt — det sägs i bekräftelsedialogen, och statusen ändras i så fall via Redigera på djurkortet. Samma princip gäller en borttagen betäckning (lammens far ändras inte i efterhand om betäckningen redan användes vid en lamning) och en borttagen lamning (lammen som skapades tas inte bort automatiskt, hantera dem själv via djurkortet).

Flera djur kan väljas samtidigt (kryssrutor med sök, samma mönster som gruppbehandling) — en förflyttning gäller sällan bara ett djur i taget, t.ex. vid leverans av flera lamm till slakt. Och lägger man till ett nytt djur som kommer utifrån (köpt/mottaget) kan man kryssa i det direkt i djurformuläret, så skapas djurposten och dess in-förflyttning i ett och samma steg — annars är det lätt att glömma den separata registreringen, exakt den lucka som ledde till att den här funktionen byggdes (se ovan).

Vid en "ut"-flytt kan appen dessutom fylla i och öppna Jordbruksverkets officiella **förflyttningsdokument** (blankett SJV JSB3.12) — den riktiga, nedladdningsbara PDF-blanketten, inte en egen efterbildning, ifylld med gårdens SE-nummer, motpartens SE-nummer, datum och ett bästa-gissning-förslag på varje djurs identitetskod (som alltid går att justera innan man skriver ut/sparar). Blanketten har bara 6 rader djur — fler djur ger flera hopslagna sidor i samma PDF automatiskt. Dokumentet ska **inte** skickas till Jordbruksverket utan följa med djuren och sparas av mottagaren.

Gårdens egna uppgifter (namn, adress, telefon, e-post, SE-nummer, transportfordon och transportörens tillståndsnummer) skrivs in en gång under **Mer → Gårdsuppgifter** och återanvänds därifrån — behöver inte fyllas i på nytt för varje flytt.

**Vad appen fortfarande inte gör:** den lagstadgade anmälan till Jordbruksverkets förflyttningsregister (inom 7 dagar efter händelsen, via myndighetens e-tjänst) är ett separat krav utöver journalföringen (48 timmar) och det ifyllda dokumentet — appen integrerar inte mot den e-tjänsten.

### Lamning
När en lamning registreras (tacka, datum, antal levande/döda lamm) skapas automatiskt en ny djurpost för varje levande lamm, med tackan satt som mor och — om en betäckning finns registrerad för samma tacka — baggen satt som far. Det sparar den manuella dubbelregistreringen av att först notera lamningen och sedan lägga in varje lamm för hand.

### Betäckning och dräktighet
En betäckning registreras med tacka, bagge och startdatum. Utifrån fårets dräktighetstid (ca 147 dagar) beräknas ett förväntat lamningsdatum automatiskt, som en prognos fram tills lamningen faktiskt registreras.

### Behandlingar och karens
Varje läkemedelsbehandling registreras med djur, preparat, dos, orsak och **karenstid** — antal dagar efter behandling som djuret inte får slaktas eller dess produkter användas. Appen räknar fram karensens sista dag automatiskt och varnar tydligt om ett djur med pågående karens riskerar att slaktas för tidigt. Behandlingar kan även registreras för en hel grupp på en gång, vilket skapar en journalpost per djur i gruppen — viktigt vid t.ex. avmaskning av en hel flock.

### Vägning
Djur vägs löpande för att följa tillväxt. Vägningshistoriken ritas som en viktkurva per djur, vilket gör avvikelser lätta att upptäcka.

### Hullbedömning
Ett djurs hull (kroppskondition) poängsätts periodvis på en skala, för att följa foderstatus och hälsa över tid.

### Provtagning (parasiter m.m.)
Träckprov och liknande provtagningar registreras per djur eller för en hel grupp, med resultat och eventuella detaljerade parasitvärden. Detta styr beslut om avmaskning och betesrotation.

### Foder
Utfodring registreras per grupp: fodertyp, mängd och datum.

### Dokument
Fristående handlingar — foderanalyser, träckprovsanalyser, ansökningar och
annat formellt underlag — sparas som PDF eller Excel-fil, valfritt kopplade
till ett djur eller en grupp. Fungerar som referensmaterial snarare än en
journalhändelse, och listas därför inte i journalflödet.

### Slakt och avräkning
När ett djur ska slaktas registreras en slaktpost (planerad → anmäld → slaktad) med slakteri, vikt, klassning och pris. Intäkten räknas fram automatiskt. Karensvakten hindrar att ett djur med pågående karens av misstag registreras som slaktat. När slakten är genomförd markeras djuret automatiskt som slaktat och tas ur sina aktiva grupper — ingen manuell efterstädning behövs. Slakteriernas kontaktuppgifter hålls i ett eget register.

### Årsrapport
En sammanställning per år ger en överblick över besättningsutveckling, lamningsresultat, tillväxt, slaktutfall och läkemedelsanvändning — till hjälp för den egna produktionsuppföljningen.

## 4. Genomgående principer

- **Automatik före manuellt bokförande.** Där ett samband kan härledas (aktuell plats från senaste flytt, karensens sista dag från behandlingsdatum och karenstid, lammens härstamning från lamningen) ska appen räkna ut det själv istället för att be användaren fylla i det för hand eller riskera att det blir inaktuellt.
- **Historik, inte bara nuläge.** Gruppmedlemskap och placeringar har start- och slutdatum, inte bara en flagga för "nu" — det gör att man i efterhand kan svara på frågor som "vilka djur var i den här gruppen i somras?".
- **Fältvänligt.** Registrering ska gå snabbt med en hand ute i stall och hage, med rimliga förval och möjlighet att registrera flera djur i följd utan omvägar.
- **Offline som förstahandsval.** Stall och beten har ofta dålig mobiltäckning — appen måste fungera fullt ut utan uppkoppling och synka i efterhand.

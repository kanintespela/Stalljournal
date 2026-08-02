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

### Slakt och avräkning
När ett djur ska slaktas registreras en slaktpost (planerad → anmäld → slaktad) med slakteri, vikt, klassning och pris. Intäkten räknas fram automatiskt. Karensvakten hindrar att ett djur med pågående karens av misstag registreras som slaktat. När slakten är genomförd markeras djuret automatiskt som slaktat och tas ur sina aktiva grupper — ingen manuell efterstädning behövs. Slakteriernas kontaktuppgifter hålls i ett eget register.

### Årsrapport
En sammanställning per år ger en överblick över besättningsutveckling, lamningsresultat, tillväxt, slaktutfall och läkemedelsanvändning — till hjälp för den egna produktionsuppföljningen.

## 4. Genomgående principer

- **Automatik före manuellt bokförande.** Där ett samband kan härledas (aktuell plats från senaste flytt, karensens sista dag från behandlingsdatum och karenstid, lammens härstamning från lamningen) ska appen räkna ut det själv istället för att be användaren fylla i det för hand eller riskera att det blir inaktuellt.
- **Historik, inte bara nuläge.** Gruppmedlemskap och placeringar har start- och slutdatum, inte bara en flagga för "nu" — det gör att man i efterhand kan svara på frågor som "vilka djur var i den här gruppen i somras?".
- **Fältvänligt.** Registrering ska gå snabbt med en hand ute i stall och hage, med rimliga förval och möjlighet att registrera flera djur i följd utan omvägar.
- **Offline som förstahandsval.** Stall och beten har ofta dålig mobiltäckning — appen måste fungera fullt ut utan uppkoppling och synka i efterhand.

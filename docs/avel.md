# Fri Stalljournal — avelsarbete

## 1. Sammanfattning

Appen har utökats med enkla verktyg för avelsarbete: du definierar själv vilka egenskaper som är intressanta för din avel — temperament, exteriör, ullfällning, vuxenvikt, eller vad du kommer på senare — och registrerar dem per djur. Till det finns en tillväxtjämförelse som korrigerar för kullstorlek.

Med en liten besättning är osäkerheten i alla jämförelser alltid stor. Verktygen är därför byggda för att vara ärliga om det: rangordningar varnar tydligt när få djur ligger till grund för jämförelsen, så det aldrig ser ut som säkrare underlag än det faktiskt är.

## 2. Vad som är byggt

### Foton
Djur kan få flera foton kopplade till sig, komprimerade och lagrade lokalt. Används för att följa exteriör och andra synliga egenskaper visuellt över tid (djurdetaljvyn).

### Egna avelsegenskaper (Mer → Avelsegenskaper)
Fri, användardefinierad egenskapstyp. Varje egenskap har namn, enhet, riktning (högre/lägre är bättre, eller ett målvärde), och en fritextbeskrivning för att skriva ner ett eget testprotokoll. Fyra förslag finns färdiga att fylla i och justera:

- **Temperament (rädsla för människor)** — ett enkelt närmandetest, poäng 1–5.
- **Exteriör – helhetsintryck** — övergripande kroppsbedömning, poäng 1–5.
- **Ullfällning (självfällning)** — relevant vid inkorsning av fällande raser, poäng 1–5.
- **Vuxenvikt** — med målvärde istället för "mer/mindre är bättre", eftersom varken för stora eller för små djur är önskvärt.

Värden registreras per djur (från djurkortet) och varje egenskap har en egen sida med rangordning av senast registrerade värde per djur. Rangordningen visar en tydlig varning när färre än tre djur är registrerade, eftersom jämförelsen då är särskilt osäker.

### Tillväxtjämförelse, korrigerad för kullstorlek (Mer → Tillväxtjämförelse)
Svarar på frågan "hur skapar man jämförbara tillväxtvärden?". Metoden är en **kontemporärgruppsjämförelse**, en enkel och beprövad teknik inom fårproduktion som inte kräver data från andra besättningar:

1. Djuret grupperas efter kullstorlek vid födsel (ensamfödd / tvilling / trilling eller fler), hämtat från lamningsregistreringen — konkurrensen om di och foder skiljer sig mycket mellan de grupperna, så det är den korrigeringen som gör tillväxtsiffror jämförbara.
2. Tillväxten (gram/dag) räknas ut mellan två vägningar inom ett valbart åldersfönster (dagar sedan födsel) — förvalda genvägar finns för digiperiod (dag 0–60) och grovfoderperiod (dag 60–150), men fönstret går att justera fritt.
3. Djurets tillväxt jämförs mot medeltillväxten för andra djur i samma kullstorlekskategori och period, som en procentandel av gruppsnittet.
4. Grupper med färre än tre djur märks tydligt som osäkra.

### Släktträd och släktskapsgrad (djurkort → Släktträd)
Varje djur har en egen släktträdssida med anor uppåt (mor, far, mor-/farföräldrar osv, så långt de finns registrerade) och avkommor nedåt i flera led, ritat som ett riktigt släktträd med kopplingslinjer mellan generationerna. Okända anor — vanligast på faderns sida vid inköpta baggar utan egen journal i appen — visas tydligt som "Okänd" istället för att gissas fram.

Till trädet hör en beräknad **släktskapsgrad (inavelskoefficient)**, med Wrights vedertagna metod (kinship/tabular method) tillämpad på de anor som faktiskt finns registrerade. Den räknas ut på två ställen:

- På djurkortet: djurets egen inavelskoefficient, utifrån dess två föräldrar.
- Vid registrering av betäckning: väntad inavelskoefficient för en tänkt avkomma av den valda tackan och baggen, med varning vid nära släktskap.

Samma ärlighetsprincip som resten av avelsverktygen gäller: en okänd anfader räknas som obesläktad i beräkningen. Det innebär att den verkliga släktskapsgraden kan vara högre än den visade siffran om anorna bakom en inköpt bagge i själva verket är släkt med besättningens egna djur — appen har helt enkelt ingen data om det.

## 3. Kvarstående idéer

Fler egenskaper och testprotokoll kan läggas till efter hand — det är hela poängen med att egenskaperna är fritt definierade snarare än en fast lista. Inga ytterligare steg är planerade just nu; nya behov tas upp när de dyker upp.

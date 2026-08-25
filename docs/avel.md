# Fri Stalljournal — avelsarbete

## 1. Sammanfattning

Appen har utökats med enkla verktyg för avelsarbete: du definierar själv vilka egenskaper som är intressanta för din avel — temperament, exteriör, ullfällning, vuxenvikt, eller vad du kommer på senare — och registrerar dem per djur. Till det finns en tillväxtjämförelse som korrigerar för kullstorlek.

Med en liten besättning är osäkerheten i alla jämförelser alltid stor. Verktygen är därför byggda för att vara ärliga om det: rangordningar varnar tydligt när få djur ligger till grund för jämförelsen, så det aldrig ser ut som säkrare underlag än det faktiskt är.

## 2. Vad som är byggt

### Foton
Djur kan få flera foton kopplade till sig, komprimerade och lagrade lokalt. Används för att följa exteriör och andra synliga egenskaper visuellt över tid (djurdetaljvyn). Fotona synkas till servern precis som övrig data (se `docs/synk.md`) så alla på gården ser samma bilder.

### Egna avelsegenskaper (Mer → Avelsegenskaper)
Fri, användardefinierad egenskapstyp. Varje egenskap har namn, enhet, riktning (högre/lägre är bättre, eller ett målvärde), och en fritextbeskrivning för att skriva ner ett eget testprotokoll. Fyra förslag finns färdiga att fylla i och justera:

- **Temperament (rädsla för människor)** — ett enkelt närmandetest, poäng 1–5.
- **Exteriör – helhetsintryck** — övergripande kroppsbedömning, poäng 1–5.
- **Ullfällning (självfällning)** — relevant vid inkorsning av fällande raser, poäng 1–5.
- **Vuxenvikt** — med målvärde istället för "mer/mindre är bättre", eftersom varken för stora eller för små djur är önskvärt.

Värden registreras per djur (från djurkortet) och varje egenskap har en egen sida med rangordning av senast registrerade värde per djur. Rangordningen visar en tydlig varning när färre än tre djur är registrerade, eftersom jämförelsen då är särskilt osäker.

Både egenskaperna och de registrerade värdena synkas till servern, precis som övrig data.

### Tillväxtjämförelse, korrigerad för kullstorlek (Mer → Tillväxtjämförelse)
Svarar på frågan "hur skapar man jämförbara tillväxtvärden?". Metoden är en **kontemporärgruppsjämförelse**, en enkel och beprövad teknik inom fårproduktion som inte kräver data från andra besättningar:

1. Djuret grupperas efter kullstorlek vid födsel (ensamfödd / tvilling / trilling eller fler), hämtat från lamningsregistreringen — konkurrensen om di och foder skiljer sig mycket mellan de grupperna, så det är den korrigeringen som gör tillväxtsiffror jämförbara.
2. Tillväxten (gram/dag) räknas ut mellan två vägningar inom ett valbart åldersfönster (dagar sedan födsel) — förvalda genvägar finns för digiperiod (dag 0–60) och grovfoderperiod (dag 60–150), men fönstret går att justera fritt.
3. Djurets tillväxt jämförs mot medeltillväxten för andra djur i samma kullstorlekskategori och period, som en procentandel av gruppsnittet.
4. Grupper med färre än tre djur märks tydligt som osäkra.

### Viktprognos (Mer → Viktprognos, samt djurkortet)
Svarar på frågan "vilket datum når det här djuret en målvikt (default 50 kg)?". Lammtillväxt avtar med åldern — en rak linje genom två vägningar överskattar därför hur snabbt ett äldre lamm når målvikten. Modellen är en **monomolekylär tillväxtkurva** (Brody-kurvan, ett vedertaget mått inom husdjursavel):

1. Djurets egna vägningar (kräver minst två, med känt födelsedatum) beskrivs som `W(t) = A - (A - W0) * e^(-k*(t-t0))`, där `(t0, W0)` är första vägningen, `A` är vikten kurvan planar ut mot och `k` hur snabbt den gör det.
2. Med **minst tre vägningar** skattas både `A` och `k` ur djurets egen data (minsta-kvadrat-anpassning).
3. Med bara **två vägningar** räcker punkterna inte till att skatta `k` (underbestämt) — då används istället en **besättnings-k**, skattad från de djur som faktiskt har tre eller fler vägningar, och bara `A` anpassas till det enskilda djurets två punkter. Samma idé som en gemensam mognadstakt med individuell skalningsparameter, som används i klassisk tillväxtkurveskattning för nötkreatur/får. Sådana prognoser märks tydligt som **osäkra**.
4. Ett djur vars skattade `A` ligger under målvikten flaggas som att det inte når målvikten vid nuvarande tillväxttakt, istället för att visa ett (felaktigt) datum.

Kullstorlek (se ovan) visas som kontext på varje rad, men driver ännu inte en egen kurva per kategori — det finns för få djur med fullständig vägningshistorik i olika kullstorleksklasser för det ännu (se `docs/avel.md` §3). Besättnings-`k` räknas om automatiskt från aktuell data varje gång, så prognosen blir bättre av sig själv i takt med att fler djur vägs regelbundet över en hel säsong.

### Släktträd och släktskapsgrad (djurkort → Släktträd)
Varje djur har en egen släktträdssida med anor uppåt (mor, far, mor-/farföräldrar osv, så långt de finns registrerade) och avkommor nedåt i flera led, ritat som ett riktigt släktträd med kopplingslinjer mellan generationerna. Okända anor — vanligast på faderns sida vid inköpta baggar utan egen journal i appen — visas tydligt som "Okänd" istället för att gissas fram.

Till trädet hör en beräknad **släktskapsgrad (inavelskoefficient)**, med Wrights vedertagna metod (kinship/tabular method) tillämpad på de anor som faktiskt finns registrerade. Den räknas ut på två ställen:

- På djurkortet: djurets egen inavelskoefficient, utifrån dess två föräldrar.
- Vid registrering av betäckning: väntad inavelskoefficient för en tänkt avkomma av den valda tackan och baggen, med varning vid nära släktskap.

Samma ärlighetsprincip som resten av avelsverktygen gäller: en okänd anfader räknas som obesläktad i beräkningen. Det innebär att den verkliga släktskapsgraden kan vara högre än den visade siffran om anorna bakom en inköpt bagge i själva verket är släkt med besättningens egna djur — appen har helt enkelt ingen data om det.

## 3. Kvarstående idéer

Fler egenskaper och testprotokoll kan läggas till efter hand — det är hela poängen med att egenskaperna är fritt definierade snarare än en fast lista.

Viktprognosens besättnings-`k` (se ovan) delas idag av alla djur oavsett kullstorlek. Så fort det finns tillräckligt många djur med fullständig vägningshistorik (tre eller fler vägningar) inom respektive kullstorlekskategori går det att skatta en egen `k` per kategori istället för en gemensam, och på så vis fånga att tvillingar/trillingar planar ut tidigare än ensamfödda. Naturligt nästa steg när ett par säsongers vägningsdata har samlats in.

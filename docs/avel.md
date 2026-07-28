# Stalljournal — avelsarbete: undersökning och byggd funktionalitet

## 1. Sammanfattning

Kan appen breddas till avelsarbete? **Ja.** Den viktigaste frågan från början — att själv beräkna BLUP-avelsvärden i appen — har ett rakt svar efter research: **det går inte att göra meningsfullt på en enskild besättnings data**, oavsett hur bra appen byggs (skälet finns i §2, oförändrat sedan första undersökningen). Elitlamm har dessutom ingen dokumenterad öppen import/export för tredjepartsverktyg (§3), så vägen dit är stängd tills vidare.

Efter det beskedet blev slutsatsen (bekräftad i samtal): sikta inte på att efterlikna Elitlamms fasta mönstringsfält. Bygg istället ett **enkelt, flexibelt verktyg där du själv definierar vilka egenskaper som är intressanta** för just din avel — temperament, exteriör, ullfällning, vuxenvikt, eller vad som helst du kommer på senare — och en **ärlig jämförelse** av dem inom den egna besättningen, tydligt märkt som just det: en jämförelse, inte ett avelsvärde. Med en liten besättning är osäkerheten alltid stor, så verktyget ska aldrig ge sken av högre precision än det har täckning för. §4 beskriver vad som är byggt.

## 2. Varför BLUP inte kan räknas fram lokalt i appen

BLUP-avelsvärdering för svenska får görs idag av **Växa Sverige** på hela den svenska poolade Elitlamm-datan (metod: BLUP djurmodell, paketet DMU), och publiceras två gånger om året. Det är inte en teknisk begränsning i vilken mjukvara som helst — det är en matematisk förutsättning:

- **Arvbarheter är populationsparametrar.** De går inte att skatta från en enda besättning på några tiotal djur — det krävs tusentals registreringar. Man kan låna publicerade värden från forskningen (t.ex. kullstorlek h²≈0,07–0,40, gotlandspäls h²≈0,20–0,48), men då räknar man med fasta, importerade parametrar — inte en egen skattning.
- **Kontemporärgrupper kollapsar i en liten besättning.** BLUP skiljer arv från miljö genom att jämföra djur inom samma besättning/år/säsong — men det kräver minst 2–3 baggar som producerat avkommor i samma grupp för att kunna särskilja baggens genetik från miljön. En hobbybesättning med en bagge per säsong ger grupper utan den kontrasten alls; det verktyget kan bara producera brus, inte ett tillförlitligt tal.
- **Jämförbarhet mellan besättningar kräver släktskapsbryggor** (delade baggar, semin, inköpta livdjur) mellan just de besättningar som ska jämföras. Utan det network blir talen inte jämförbara med något utanför gården.
- **Säkerheten blir låg.** Med bara djurets egen registrering är säkerheten ungefär √(arvbarhet) — för de flesta egenskaper 0,3–0,6. Hög säkerhet kräver många bedömda avkommor, vilket en liten besättning sällan har.

Detta gäller alla verktyg (BLUPF90, DMU, WOMBAT, R-paket som `sommer`/`nadiv`) — de löser samma statistiska modell givet vilken data man matar in, men uppfinner inte de populationsparametrar eller den släktskapsbrygga som krävs för ett tillförlitligt resultat.

**Så gör man i andra länder:** Australiens Sheep Genetics (LAMBPLAN) och USA:s NSIP fungerar på samma sätt — besättningen registrerar lokalt i ett gårdsverktyg (t.ex. Pedigree Master), exporterar, och en central instans (Sheep Genetics i Australien) kör den faktiska beräkningen på hela populationen. Ingen gård kör BLUP själv. Det är precis den modellen Elitlamm/Växa redan använder för Sverige.

## 3. Vad Elitlamm faktiskt är

Elitlamm är både gårdsprogram **och** Sveriges officiella stambok/register för fåravel, ägt av Svenska Fåravelsförbundet. Registrering sker direkt i Elitlamm (webb eller appen Elitlamm Puls) — det finns **ingen dokumenterad öppen import-API** som tredjepartsappar kan koppla mot. Strikta tidsgränser gäller: lamning ska registreras inom 3 månader, mönstring (~110 dagar) inom 3 månader, och grunddata (härstamning, födelsedatum, födelsevikt, 60-dagarsvikt) måste finnas registrerad *innan* mönstringen. Slaktdata kan i vissa fall hämtas automatiskt från slakteri (KLS Ugglarps).

**Öppen fråga:** om Elitlamm har någon odokumenterad möjlighet till filimport eller ett samarbete för tredjepartsverktyg. Det enda sättet att få ett säkert svar är att fråga `support@elitlamm.com` direkt — se §6.

## 4. Vad som är byggt

### Foton
Djur kan få flera foton kopplade till sig, komprimerade och lagrade lokalt. Används för att följa exteriör och andra synliga egenskaper visuellt över tid (djurdetaljvyn).

### Egna avelsegenskaper (Mer → Avelsegenskaper)
Fri, användardefinierad egenskapstyp — inte en fast Elitlamm-lik lista. Varje egenskap har namn, enhet, riktning (högre/lägre är bättre, eller ett målvärde), och en fritextbeskrivning för att skriva ner ett eget testprotokoll. Fyra förslag finns färdiga att fylla i och justera:

- **Temperament (rädsla för människor)** — ett enkelt närmandetest, poäng 1–5.
- **Exteriör – helhetsintryck** — övergripande kroppsbedömning, poäng 1–5.
- **Ullfällning (självfällning)** — relevant vid Dorper-inkorsning, poäng 1–5.
- **Vuxenvikt** — med målvärde istället för "mer/mindre är bättre", eftersom varken för stora eller för små djur är önskvärt.

Värden registreras per djur (från djurkortet) och varje egenskap har en egen sida med rangordning av senast registrerade värde per djur. Rangordningen visar en tydlig varning när färre än tre djur är registrerade, eftersom jämförelsen då är särskilt osäker.

### Tillväxtjämförelse, korrigerad för kullstorlek (Mer → Tillväxtjämförelse)
Svarar direkt på frågan "hur skapar man jämförbara tillväxtvärden?". Metoden är en **kontemporärgruppsjämförelse**: en äldre, enklare teknik än BLUP som använts internationellt för fårproduktion innan/vid sidan av BLUP, och som inte kräver data från andra besättningar.

Så fungerar den:
1. Djuret grupperas efter kullstorlek vid födsel (ensamfödd / tvilling / trilling eller fler), hämtat från lamningsregistreringen — konkurrensen om di och foder skiljer sig mycket mellan de grupperna, så det är den korrigeringen som gör tillväxtsiffror jämförbara.
2. Tillväxten (gram/dag) räknas ut mellan två vägningar inom ett valbart åldersfönster (dagar sedan födsel) — förvalda genvägar finns för digiperiod (dag 0–60) och grovfoderperiod (dag 60–150), men fönstret går att justera fritt.
3. Djurets tillväxt jämförs mot medeltillväxten för andra djur i samma kullstorlekskategori och period, som en procentandel av gruppsnittet.
4. Grupper med färre än tre djur märks tydligt som osäkra.

Detta ersätter det tidigare planerade spåret med Elitlamm-lika mönstringsfält (formklass/päls/ull vid ~110 dagar) — de fälten byggs inte, eftersom du efter research bedömde att ett friare, egendefinierat verktyg passar bättre för en liten besättning med egna avelsmål.

## 5. Kvarstående, lägre prioriterat

- **Elitlamm-redo export:** om det visar sig finnas ett sätt att skicka data till Elitlamm (se §6), kan en exportfunktion byggas som formaterar det appen redan har (härstamning, vikter, kullstorlek, slaktresultat) enligt vad Elitlamm förväntar sig.
- **Riktiga avelsvärden i appen:** om ett sådant datautbyte finns, kan Elitlamms halvårsvis publicerade avelsvärden visas som skrivskyddade fält på djurkortet. Utan det stannar det vid manuell avstämning i Elitlamm/Elitlamm Puls.

Båda punkterna är villkorade av svaret från Elitlamm-supporten och görs bara om det blir aktuellt.

## 6. Vad jag behöver av dig

**Maila support@elitlamm.com** och fråga om det finns någon dokumenterad import/export eller samarbetsmöjlighet för tredjepartsverktyg som Stalljournal — det är fortfarande den enda öppna frågan, och bara du kan skicka den mailen. Svaret avgör om §5 någonsin blir aktuellt.

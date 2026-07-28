# Stalljournal — avelsarbete och BLUP: undersökning och plan

## 1. Sammanfattning

Kan appen breddas till avelsarbete? **Ja, och mycket av grundarbetet finns redan** (härstamning, vägningar, kullstorlek, slaktresultat). Men den viktigaste frågan — att själv beräkna BLUP-avelsvärden i appen — har ett rakt svar efter research: **det går inte att göra meningsfullt på en enskild besättnings data**, oavsett hur bra appen byggs. Skälet finns i §2. Planen i §5 lägger därför upp två separata spår: dels göra appens registreringar redo för export till Elitlamm (vägen till riktiga, jämförbara avelsvärden), dels en enklare "besättningsindex"-funktion som kan byggas i appen men som måste hållas tydligt åtskild från ett riktigt avelsvärde.

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

**Öppen fråga jag inte kan besvara själv:** om Elitlamm har någon odokumenterad möjlighet till filimport eller ett samarbete för tredjepartsverktyg. Det enda sättet att få ett säkert svar är att fråga `support@elitlamm.com` direkt — det är en sak bara du kan göra, och svaret avgör om export blir en fil du laddar upp eller bara ett underlag du matar in för hand.

## 4. Vad appen redan har och vad som saknas

| Elitlamm-egenskap | Status i appen idag |
|---|---|
| Härstamning (mor/far, ras) | ✅ Finns (`mother_id`, `father_id`, `breed`) |
| Kullstorlek vid lamning | ✅ Finns (`lambing.live_count`/`dead_count`) |
| Födelsevikt | ✅ Finns (registreras som vägning av typen "Födelsevikt" vid lamning) |
| 60-dagarsvikt | 🟡 Går att registrera som vägning, men inget strukturerat stöd — ingen påminnelse, ingen tydlig koppling till Elitlamms 40–80-dagarsfönster |
| Mönstring (110 dagar): vikt | 🟡 Går att registrera som vägning, samma begränsning som ovan |
| Mönstring: formklass (kroppskonformation) | ❌ Finns inte — appens "hull"-poäng (1–5, foderstatus) är en annan sak än Elitlamms formklass |
| Pälsbedömning (gotlandsfår m.fl.) | ❌ Finns inte |
| Ullbedömning (finull, rya) | ❌ Finns inte |
| Slaktresultat (vikt, EUROP-klass, fettgrupp) | ✅ Finns redan väl utbyggt (`slaughters`) |
| Foton av djur (för exteriörbedömning) | ✅ Byggt (denna omgång) |
| Rasstandardiserade rasnamn | 🟡 Fritextfält idag — Elitlamm avelsvärderar bara 10 specifika raser |

Bilden är alltså bra: det mesta av grunddatan finns redan eller är enkel att lägga till. Det som helt saknas är mönstringens form-/päls-/ullbedömning, som är specifika bedömningsformulär appen inte har byggt än.

## 5. Föreslagen plan (faser)

### Fas 1 — Foton (klart denna omgång)
Djur kan nu få flera foton kopplade till sig, komprimerade och lagrade lokalt. Direkt användbart för exteriörbedömning ("kräver ett erfaret öga", enligt Fåravelsförbundets material) och för att följa ett djur visuellt över tid.

### Fas 2 — Strukturera mönstring och tillväxtmätning (näst högst prioritet)
- Lägg till 60-dagarsvikt som en egen, igenkänd vägningstyp med automatisk påminnelse (djur födda för 55–65 dagar sedan utan registrerad 60-dagarsvägning listas).
- Samma för mönstring vid ~110 dagar.
- Nytt registreringsformulär **Mönstring** (separat från dagens fria "hull"-registrering): formklass, ev. pälsbedömning (färgnyans, färgpoäng, lockstorlek m.fl. för gotlandsfår/leicester) och ullbedömning (finull/rya) — fälten aktiveras beroende på djurets ras.
- Rasfält blir en väljare med Elitlamms tio avelsvärderade raser + "annan/blandras", istället för fritext.

### Fas 3 — Elitlamm-redo export
- Exportfunktion (Excel/CSV) formaterad efter vad Elitlamm förväntar sig vid registrering, så uppgifterna som redan finns i Stalljournal kan matas in eller laddas upp där (beroende på svaret från support@elitlamm.com).
- Påminnelser i appen för Elitlamms 3-månadersgränser för lamning och mönstring.

### Fas 4 — Besättningsindex (sekundärt, tydligt separerat från avelsvärde)
En enklare, egen ranking av besättningens djur baserad på korrigerade mönstringsvikter och kullstorlek, med fasta arvbarhetsvärden hämtade från forskningslitteraturen per ras. **Måste visas med en helt annan skala och tydlig text** ("Besättningsindex — inte samma sak som Elitlamms avelsvärde") för att aldrig kunna förväxlas med ett riktigt avelsvärde. Nyttan är begränsad till att rangordna de egna djuren inbördes — inte jämförbar mellan besättningar. Lägre prioritet än fas 2–3 eftersom den faktiska nyttan för en liten besättning är osäker (se §2).

### Fas 5 — Riktiga avelsvärden i appen (villkorat)
Om svaret från Elitlamm-supporten visar att det finns någon form av datautbyte, kan importerade avelsvärden visas som skrivskyddade fält på djurkortet (hämtade från Elitlamms halvårsvisa publicering) — då slipper man hoppa mellan två system för att se värdena. Utan ett sådant utbyte stannar detta vid manuell avstämning.

## 6. Vad jag behöver av dig

1. **Maila support@elitlamm.com** och fråga om det finns någon dokumenterad import/export eller samarbetsmöjlighet för tredjepartsverktyg som Stalljournal. Svaret avgör om fas 3 blir en fil att ladda upp eller bara ett tydligt formaterat underlag.
2. **Bekräfta prioritering:** vill du att jag börjar med fas 2 (strukturerad mönstring/60-dagarsvikt) nu, eller ska jag invänta svaret från Elitlamm först ifall det påverkar vilka fält som behövs?

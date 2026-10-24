# PocketBase flyttar från GitHub

PocketBase, som synkservern bygger på, flyttar från GitHub till en egen plattform. Det här
dokumentet samlar vad det betyder för Stalljournal och vad som ska göras när flytten har skett.

**Källa:** utvecklarens meddelande
[pocketbase/pocketbase#7841](https://github.com/pocketbase/pocketbase/discussions/7841)
(2026-09-12). Läst och sammanfattat 2026-10-24.

## Läget 2026-10-24

- Flytten var planerad till mitten av oktober men har **inte skett än**. GitHub-repot är inte
  arkiverat, och v0.40.6 släpptes där 2026-10-23.
- Den nya adressen blir `ganigeorgiev.com/pocketbase/pocketbase`. Där finns inget ännu.
- Adressformatet för nedladdning av nya versioner är **inte bestämt**. Utvecklaren har lovat
  att publicera det.

## Vad flytten innebär

| Vad | Före | Efter flytten |
|---|---|---|
| Nya versioner | GitHub releases | Bara på den nya plattformen. Ingen spegel på GitHub |
| Gamla versioner (t.ex. v0.39.9) | GitHub releases | Ligger kvar på GitHub. Länkarna fortsätter fungera |
| Bevakning av nya versioner och säkerhetsluckor | GitHub "Watch" | Måste göras på nytt på den nya plattformen. Inget flyttas med |
| Säkerhetsrapporter (CVE) | GitHub | Andra kanaler, troligen MITRE direkt |
| Servern som redan körs | – | Påverkas inte. PocketBase uppdaterar sig inte själv |

## Vad i det här repot som pekar på GitHub

| Fil | Vad | Behöver ändras när |
|---|---|---|
| `docs/synk.md` §2 | Nedladdning av v0.39.9 och länk till releaselistan | Vi går upp till en version som bara finns på nya plattformen |
| `server/README.md` (Snabbstart) | Samma som ovan | Samma som ovan |
| `app/package.json` | JavaScript-biblioteket `pocketbase` (^0.27.0) från npm | Om biblioteket slutar publiceras på npm, se nedan |

Länkarna till v0.39.9 fungerar även efter flytten. Ingen ändring behövs förrän vi uppdaterar.

**JavaScript-biblioteket:** meddelandet gäller "all of my repositories", så även
`pocketbase/js-sdk` flyttar troligen. Meddelandet säger inget om npm. Kontrollera efter flytten:

```bash
npm view pocketbase version time.modified repository.url
```

Om nya versioner fortsätter komma ut på npm behövs ingen ändring.

## Checklista när flytten har skett

Så ser du om flytten har skett:

```bash
gh api repos/pocketbase/pocketbase -q .archived   # true = flyttat
```

1. **Bevaka PocketBase på den nya plattformen**, så att varningar om säkerhetsluckor kommer
   fram. Det är det viktigaste steget.
2. **Läs utvecklarens anvisning** om nedladdningsadress och kontrollsummor. Fyll i dem nedan
   under *Ny adress*.
3. **Kontrollera JavaScript-biblioteket** på npm (se ovan).
4. **Uppdatera länkarna** i tabellen ovan först när vi faktiskt går upp till en ny version.
   Länka till releaselistan på den nya plattformen i stället för på GitHub.
5. **Uppdatera det här dokumentet**: ändra *Läget* och bocka av.

## Före nästa uppdatering av servern

Servern kör v0.39.9, som migrationerna är skrivna för. Version v0.40 innehåller rättelser av
säkerhetsluckor i Go (`net/http`, i v0.40.5 och v0.40.6), men utvecklaren varnar för att v0.40
byter JSON-hantering och inte är helt bakåtkompatibel. Gör så här:

1. Ta en säkerhetskopia av `pb_data/` (se `synk.md` §8).
2. Prova den nya versionen på en **kopia** av `pb_data/`, på en annan port.
3. Kontrollera att migrationerna går igenom och att synken fungerar mot kopian.
4. Byt först därefter programfilen på servern och starta om tjänsten.

v0.40.6 finns fortfarande på GitHub. Den som vill uppdatera innan flytten kan alltså göra det
med de vanliga GitHub-länkarna.

## Ny adress

⚠️ Fylls i när utvecklaren har publicerat den.

- Projektsida: `https://ganigeorgiev.com/pocketbase/pocketbase` ⚠️ verifiera
- Nedladdning av en version: ⚠️ [adressformat]
- Kontrollsummor: ⚠️ [adress]
- Releaselista i maskinläsbart format (JSON) eller RSS: ⚠️ [adress, om sådan finns]

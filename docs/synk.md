# Stalljournal — sätta upp delad data (flera användare, egen server)

Det här är fas 5b: flera personer på gården ska kunna se och redigera samma djur, grupper, journaler osv., samtidigt som appen fortsätter fungera offline i fält som idag.

**Vald lösning:** en egen, självhostad server ([PocketBase](https://pocketbase.io)) på en dator/enhet du redan har hemma, nådd via [Tailscale](https://tailscale.com) så att den fungerar säkert både på hemma-wifi och ute i fält — utan molntjänst, utan månadskostnad, utan att öppna något mot internet.

---

## 1. Vad du behöver

- **En enhet som kan vara igång hela tiden**: Raspberry Pi, en NAS (Synology/QNAP), eller en dator som ändå brukar stå på. Kraven är minimala — PocketBase är en enda liten fil.
- **Tailscale-konto** (gratis för privat bruk, upp till 100 enheter): [tailscale.com](https://tailscale.com)
- 10–15 minuter.

## 2. Installera PocketBase på serverenheten

Migrationerna i repot (`server/pb_migrations/`) är skrivna för **PocketBase v0.39.x**. PocketBase har ibland ändrat migrations-API:t mellan större versioner — installera helst just v0.39.x för att slippa krångel; installerar du en nyare version och migrationerna inte verkar ta (`./pocketbase migrate up` säger "No new migrations" utan att skapa tabellerna), jämför `./pocketbase --version` mot [releaselistan](https://github.com/pocketbase/pocketbase/releases) och hör av dig så uppdaterar vi migrationerna.

```bash
# Byt ut mot rätt version för din plattform (linux_arm64 för Raspberry Pi,
# linux_amd64 för de flesta NAS/datorer) — se https://pocketbase.io/docs/
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.39.9/pocketbase_0.39.9_linux_arm64.zip
unzip pocketbase_0.39.9_linux_arm64.zip
```

Kopiera schemat från repot till samma mapp som `pocketbase`-programmet:

```bash
cp -r server/pb_migrations /sökväg/där/pocketbase/ligger/
```

Skapa ett superuser-konto (det här är bara för att sköta servern via Admin UI — inte samma som familjens inloggningar):

```bash
./pocketbase superuser upsert din@epost.se DittAdminLösenord
```

## 3. Kör servern som en tjänst (så den startar om automatiskt)

På en Raspberry Pi/Linux-server, skapa `/etc/systemd/system/pocketbase.service`:

```ini
[Unit]
Description=Stalljournal PocketBase-server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pocketbase
ExecStart=/home/pi/pocketbase/pocketbase serve --http=0.0.0.0:8090
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now pocketbase
```

(Kör du på en Synology/QNAP-NAS: använd Container Manager/Docker istället — sök efter en `pocketbase`-image, exponera port 8090, montera en volym för `pb_data` och lägg `pb_migrations` i containerns filsystem.)

## 4. Installera Tailscale

**På servern:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
Följ länken som visas för att logga in med ditt Tailscale-konto (samma konto ska användas på alla enheter). Notera adressen servern får, t.ex. `raspberrypi.tail1a2b3c.ts.net` eller en IP som `100.x.x.x` — den hittar du också med `tailscale ip -4`.

**På varje telefon/dator som ska använda appen:** installera Tailscale-appen från App Store/Play Store/tailscale.com, logga in med samma konto. Nu kan enheten nå servern på `http://<tailscale-adress>:8090` — var du än är, utan att något är öppet mot vanliga internet.

## 5. Skapa inloggningar för familjen

Öppna PocketBases adminpanel i webbläsaren: `http://<tailscale-adress>:8090/_/`, logga in med admin-kontot från steg 2.

Gå till **Collections → users → New record**. Skapa en post per person som ska använda appen (e-post + lösenord). Det är dessa uppgifter man loggar in med i appen — inte adminkontot.

## 6. Anslut appen

I Stalljournal: **Mer → Synkronisering**

1. Ange serveradress: `http://<tailscale-adress>:8090`
2. Logga in med den e-post/lösenord som skapades i steg 5.
3. Tryck **Synka nu**.

Gör om samma sak på varje enhet som ska dela data. Appen synkar sedan automatiskt i bakgrunden (vid appstart, var 5:e minut medan appen är öppen, och när nätet kommer tillbaka), plus när du trycker **Synka nu** manuellt.

## 7. Hur synken fungerar (bra att veta)

- **Appen fungerar offline precis som förut.** Servern behövs bara för att dela data mellan enheter — allt du gör i fält utan täckning sparas lokalt och synkas nästa gång du har nät.
- **Djurfoton synkas också**, inte bara textdata — en bild som tas på en enhet dyker upp på de andra vid nästa synk. Bilder skalas ner och komprimeras innan de laddas upp, men är ändå störst av det som synkas — första synken efter att foton lagts till kan därför ta en stund om det finns många bilder sedan tidigare.
- **Den som ändrar sist vinner** vid en verklig krock (samma djur redigerat på två enheter innan synk hunnit ske). Det är sällsynt i praktiken för en gårds storlek.
- **Inget skickas till någon molntjänst.** All data går bara mellan dina enheter och din egen server, via Tailscales krypterade tunnel.

## 8. Säkerhetskopiering

Allt ligger i mappen `pb_data` bredvid `pocketbase`-programmet — inklusive djurfotona, som lagras som vanliga filer under `pb_data/storage/`. Säkerhetskopiera den mappen (t.ex. med samma backup-rutin du redan har för NAS:en, eller ett enkelt cron-jobb som kopierar den till en annan plats med jämna mellanrum). PocketBase har också en inbyggd backup-funktion i adminpanelen under **Settings → Backups**. Tänk på att `pb_data` växer betydligt snabbare när foton används — se till att enheten har gott om ledigt lagringsutrymme.

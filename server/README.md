# Stalljournal — server (PocketBase)

Schemat för den självhostade synkservern. Se `../docs/synk.md` för fullständig installationsguide (PocketBase + Tailscale).

## Innehåll

`pb_migrations/` — PocketBase-migrationer som skapar alla 15 datacollections (samma fält som appens lokala datamodell, se `../docs/arkitektur.md` §3). Läggs i PocketBase-installationens `pb_migrations`-mapp och körs automatiskt vid start (`--automigrate` är på som standard).

## Snabbstart

```bash
# 1. Hämta PocketBase (byt ut mot din plattform, se https://pocketbase.io/docs/)
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.22.21/pocketbase_0.22.21_linux_amd64.zip
unzip pocketbase_0.22.21_linux_amd64.zip

# 2. Lägg migrationerna på plats
cp -r pb_migrations /sökväg/till/pocketbase/

# 3. Skapa en administratör (engångskommando)
./pocketbase admin create din@epost.se DittLösenord123

# 4. Starta servern
./pocketbase serve --http=0.0.0.0:8090
```

Skapa sedan en (eller flera) inloggningar för familjen under **Admin UI → Collections → users → New record** (inte admin-kontot — det är bara för att administrera servern, appen loggar in med en vanlig `users`-post).

## Schemadesign i korthet

- Varje tabell har `client_id` (appens egna UUID, unikt indexerad), `updated_at` (appens tidsstämpel — avgör vem som vinner vid samtidig redigering) och `deleted_at` (mjuk borttagning).
- Alla `number | null`-fält (t.ex. parasitvärden, slaktvikt) lagras som **text**, inte PocketBases nummerfälttyp — annars gör PocketBase om ett tomt värde till `0`, vilket gör "inget värde" och "värdet är faktiskt 0" omöjliga att skilja åt. Appen konverterar till/från tal vid synk.
- Korsreferenser mellan tabeller (t.ex. `animal_id`) är vanliga textfält med appens UUID, inte PocketBases relationsfälttyp — appen känner bara till sina egna ID:n, inte PocketBases interna.
- Behörighet: vem som helst som är inloggad får läsa/skriva allt (`@request.auth.id != ''`). Det är avsiktligt enkelt eftersom servern är till för en enskild gårds betrodda användare, inte en flergårdstjänst.

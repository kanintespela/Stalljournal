# Fri Stalljournal — server (PocketBase)

Schemat för den självhostade synkservern. Se `../docs/synk.md` för fullständig installationsguide (PocketBase + Tailscale).

## Innehåll

`pb_migrations/` — PocketBase-migrationer som skapar alla 18 datacollections (samma fält som appens lokala datamodell, se `../docs/arkitektur.md` §3). Läggs i PocketBase-installationens `pb_migrations`-mapp och körs automatiskt vid start (`--automigrate` är på som standard).

Kör du redan en server sedan tidigare räcker det att kopiera in de nya migrationsfilerna (`*_created_animal_photos.js`, `*_created_traits.js`, `*_created_trait_records.js`) och starta om — PocketBase kör bara de migrationer som inte redan applicerats.

## Snabbstart

Migrationerna är skrivna för **PocketBase v0.39.x** (nyare versioner byter ibland API för migrationsfiler och adminkommandon — kontrollera `./pocketbase --version` mot [releaselistan](https://github.com/pocketbase/pocketbase/releases) om du installerar en nyare version och migrationerna inte verkar ta).

```bash
# 1. Hämta PocketBase (byt ut mot din plattform, se https://pocketbase.io/docs/)
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.39.9/pocketbase_0.39.9_linux_amd64.zip
unzip pocketbase_0.39.9_linux_amd64.zip

# 2. Lägg migrationerna på plats
cp -r pb_migrations /sökväg/till/pocketbase/

# 3. Skapa ett superuser-konto (engångskommando — detta är bara för att
#    administrera servern via Admin UI, inte samma sak som familjens inloggningar)
./pocketbase superuser upsert din@epost.se DittLösenord123

# 4. Starta servern
./pocketbase serve --http=0.0.0.0:8090
```

Skapa sedan en (eller flera) inloggningar för familjen under **Admin UI → Collections → users → New record** (inte superuser-kontot — appen loggar in med en vanlig `users`-post).

## Schemadesign i korthet

- Varje tabell har `client_id` (appens egna UUID, unikt indexerad), `updated_at` (appens tidsstämpel — avgör vem som vinner vid samtidig redigering) och `deleted_at` (mjuk borttagning).
- Alla `number | null`-fält (t.ex. parasitvärden, slaktvikt) lagras som **text**, inte PocketBases nummerfälttyp — annars gör PocketBase om ett tomt värde till `0`, vilket gör "inget värde" och "värdet är faktiskt 0" omöjliga att skilja åt. Appen konverterar till/från tal vid synk.
- Korsreferenser mellan tabeller (t.ex. `animal_id`) är vanliga textfält med appens UUID, inte PocketBases relationsfälttyp — appen känner bara till sina egna ID:n, inte PocketBases interna.
- Behörighet: vem som helst som är inloggad får läsa/skriva allt (`@request.auth.id != ''`). Det är avsiktligt enkelt eftersom servern är till för en enskild gårds betrodda användare, inte en flergårdstjänst.
- Varje tabell har explicita `created`/`updated`-fält (typ `autodate`). De läggs inte till automatiskt av PocketBase i den här versionen — appens synk är beroende av `updated` för att effektivt avgöra vad som är nytt sedan sist, så en eventuell ny tabell måste ha båda fälten för att synkas korrekt.
- `animal_photos` är undantaget: fältet `photo` är ett riktigt PocketBase-filfält (max 8 MB, bara `image/jpeg`) istället för ett textfält, eftersom det faktiskt lagrar bilddata, inte bara en sökväg. Filerna hamnar under `pb_data/storage/` och ingår i den vanliga backup-rutinen (se `../docs/synk.md` §8) — se dock till att det finns tillräckligt med diskutrymme, eftersom foton normalt är mycket större än övrig data.

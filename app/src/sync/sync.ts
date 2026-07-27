import type { Table } from 'dexie'
import { ClientResponseError } from 'pocketbase'
import { db, nowIso } from '../db/db'
import { isLoggedIn, pb } from './client'

// Synkmotor: push/pull med updated_at + soft delete, last-write-wins per rad
// (arkitektur.md §A5). PocketBases eget "updated"-systemfält (satt av servern)
// används bara för att effektivt hämta "vad är nytt sedan sist" vid pull —
// själva konflikthanteringen avgörs alltid av vårt eget updated_at-fält, som
// sätts av klienten vid varje ändring och är jämförbart oavsett vilken enhet
// eller server som skrev raden.

type Row = Record<string, unknown> & { id: string; updated_at: string; deleted_at: string | null }

interface TableSpec {
  local: keyof typeof db & string
  collection: string
  /** Fält som lokalt är `string | null` — PocketBase lagrar tomt textfält som "", måste läsas tillbaka som null. */
  nullableText?: string[]
  /**
   * Fält som lokalt är `number | null`. Lagras som TEXT i PocketBase (inte
   * dess "number"-fälttyp) eftersom PocketBase annars tvingar ett tomt/null-
   * värde till 0 — vilket gör 0 och "inget värde" omöjliga att skilja åt
   * (viktigt här, t.ex. en parasiträkning på exakt 0 är ett giltigt resultat).
   */
  nullableNumber?: string[]
}

// deleted_at är alltid string|null på alla tabeller — läggs till automatiskt nedan.
const TABLES: TableSpec[] = [
  { local: 'places', collection: 'places', nullableNumber: ['lat', 'lng'] },
  { local: 'herd_groups', collection: 'herd_groups' },
  {
    local: 'animals',
    collection: 'animals',
    nullableText: ['birth_date', 'mother_id', 'father_id', 'entry_date', 'exit_date', 'lambing_id', 'planned_slaughter_date'],
  },
  { local: 'group_memberships', collection: 'group_memberships', nullableText: ['removed_on'] },
  { local: 'group_moves', collection: 'group_moves', nullableText: ['ended_on'] },
  { local: 'treatments', collection: 'treatments' },
  { local: 'weighings', collection: 'weighings' },
  { local: 'lambings', collection: 'lambings' },
  { local: 'matings', collection: 'matings', nullableText: ['end_date'] },
  { local: 'body_conditions', collection: 'body_conditions' },
  {
    local: 'parasite_samples',
    collection: 'parasite_samples',
    nullableText: ['animal_id', 'group_id', 'file_path'],
    nullableNumber: ['trichostrongylida', 'haemonchus_pct', 't_axei_pct', 'chab_oes', 'n_filaria', 'n_spathiger', 'n_battus', 'capillaria'],
  },
  { local: 'feedings', collection: 'feedings' },
  { local: 'slaughterhouses', collection: 'slaughterhouses' },
  {
    local: 'slaughters',
    collection: 'slaughters',
    nullableText: ['slaughterhouse_id'],
    nullableNumber: ['carcass_weight', 'price_per_kg'],
  },
  {
    local: 'slaughter_settlements',
    collection: 'slaughter_settlements',
    nullableText: ['file_path'],
    nullableNumber: ['carcass_weight', 'price_per_kg', 'base_amount', 'adjustments', 'slaughter_fee', 'transport_fee', 'total', 'vat', 'net_total'],
  },
]

const PULL_WATERMARK_KEY = 'stalljournal_sync_pull'
const PUSH_WATERMARK_KEY = 'stalljournal_sync_push'

function loadWatermarks(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}
function saveWatermarks(key: string, w: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(w))
}

function toRemote(row: Row, spec: TableSpec): Record<string, unknown> {
  const { id, ...rest } = row
  for (const f of spec.nullableNumber ?? []) {
    const v = rest[f]
    rest[f] = v === null || v === undefined ? null : String(v)
  }
  return { ...rest, client_id: id }
}

function fromRemote(record: Record<string, unknown>, spec: TableSpec): Row {
  const { id: _pbId, client_id, collectionId, collectionName, created, updated, expand, ...rest } = record
  void _pbId
  void collectionId
  void collectionName
  void created
  void updated
  void expand
  if (rest.deleted_at === '') rest.deleted_at = null
  for (const f of spec.nullableText ?? []) if (rest[f] === '') rest[f] = null
  for (const f of spec.nullableNumber ?? []) rest[f] = rest[f] === '' || rest[f] == null ? null : Number(rest[f])
  return { ...rest, id: client_id as string } as Row
}

export interface SyncResult {
  pulled: number
  pushed: number
  errors: string[]
}

export async function syncNow(): Promise<SyncResult> {
  const client = pb()
  if (!client || !client.authStore.isValid) throw new Error('Inte inloggad mot servern.')

  const pullWatermarks = loadWatermarks(PULL_WATERMARK_KEY)
  const pushWatermarks = loadWatermarks(PUSH_WATERMARK_KEY)
  const result: SyncResult = { pulled: 0, pushed: 0, errors: [] }

  for (const spec of TABLES) {
    const { local, collection } = spec
    const table = db[local] as unknown as Table<Row, string>

    // Rader som just skrivits lokalt av PULL nedan — måste undantas från PUSH
    // i samma cykel, annars studsar de tillbaka som "lokal ändring" även om
    // de bara är en kopia av vad servern redan har (skulle annars kapplöpa
    // mot push-vattenmärket, som inte hinner flyttas fram förrän cykeln är klar).
    const pulledIds = new Set<string>()

    // --- PULL ---
    try {
      const since = pullWatermarks[collection]
      const filter = since ? `updated >= "${since}"` : ''
      const records = await client.collection(collection).getFullList({ filter, sort: 'updated' })
      let maxUpdated = since ?? ''
      for (const rec of records as unknown as Record<string, unknown>[]) {
        const remoteRow = fromRemote(rec, spec)
        const serverUpdated = String(rec.updated ?? '')
        if (serverUpdated > maxUpdated) maxUpdated = serverUpdated
        const localRow = await table.get(remoteRow.id)
        if (!localRow || remoteRow.updated_at >= localRow.updated_at) {
          await table.put(remoteRow)
          pulledIds.add(remoteRow.id)
          result.pulled++
        }
      }
      pullWatermarks[collection] = maxUpdated
    } catch (e) {
      result.errors.push(`${collection} (hämta): ${errMessage(e)}`)
    }

    // --- PUSH ---
    try {
      const pushSince = pushWatermarks[local] ?? ''
      const changed = await table.filter((r) => r.updated_at > pushSince && !pulledIds.has(r.id)).toArray()
      for (const row of changed) {
        try {
          const existing = await client
            .collection(collection)
            .getFirstListItem(`client_id="${row.id}"`)
            .catch(() => null)
          if (existing) {
            await client.collection(collection).update(existing.id, toRemote(row, spec))
          } else {
            await client.collection(collection).create(toRemote(row, spec))
          }
          result.pushed++
        } catch (e) {
          result.errors.push(`${collection}/${row.id} (skicka): ${errMessage(e)}`)
        }
      }
      // Vattenmärket flyttas fram till senaste updated_at i hela lokala tabellen
      // (inte bara det vi push:ade), så nyss hämtade rader inte skickas tillbaka i onödan.
      const newest = await table.orderBy('updated_at').last()
      if (newest) pushWatermarks[local] = newest.updated_at
    } catch (e) {
      result.errors.push(`${collection} (skicka): ${errMessage(e)}`)
    }
  }

  saveWatermarks(PULL_WATERMARK_KEY, pullWatermarks)
  saveWatermarks(PUSH_WATERMARK_KEY, pushWatermarks)
  return result
}

function errMessage(e: unknown): string {
  if (e instanceof ClientResponseError) return e.message
  return e instanceof Error ? e.message : String(e)
}

// --- Bakgrundssynk + senaste-status, för automatisk körning och för att
// synk-sidan ska kunna visa resultat även av en synk som kördes i bakgrunden. ---

const LAST_SYNC_KEY = 'stalljournal_sync_last'

export interface LastSync {
  at: string
  pulled: number
  pushed: number
  errors: string[]
}

export function getLastSync(): LastSync | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY)
    return raw ? (JSON.parse(raw) as LastSync) : null
  } catch {
    return null
  }
}

/** Körs tyst i bakgrunden (appstart, periodiskt, vid återkommen nätanslutning). */
export async function backgroundSync(): Promise<void> {
  if (!isLoggedIn() || !navigator.onLine) return
  try {
    const r = await syncNow()
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify({ at: nowIso(), ...r } satisfies LastSync))
  } catch (e) {
    console.warn('Bakgrundssynk misslyckades:', errMessage(e))
  }
}

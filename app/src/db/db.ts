import Dexie, { type Table } from 'dexie'
import type {
  Animal,
  AnimalMovement,
  AnimalPhoto,
  BodyCondition,
  Document,
  FarmSetting,
  Feeding,
  GroupMembership,
  GroupMove,
  HerdGroup,
  Lambing,
  Mating,
  ParasiteSample,
  Place,
  Slaughter,
  Slaughterhouse,
  SlaughterSettlement,
  Trait,
  TraitRecord,
  Treatment,
  Weighing,
} from './types'

// Lokal sanningskälla (offline-first). Samma schema speglas i Supabase i fas 5;
// updated_at/deleted_at på varje rad driver synken.
export class StalljournalDB extends Dexie {
  animals!: Table<Animal, string>
  places!: Table<Place, string>
  herd_groups!: Table<HerdGroup, string>
  group_memberships!: Table<GroupMembership, string>
  group_moves!: Table<GroupMove, string>
  treatments!: Table<Treatment, string>
  weighings!: Table<Weighing, string>
  lambings!: Table<Lambing, string>
  matings!: Table<Mating, string>
  body_conditions!: Table<BodyCondition, string>
  parasite_samples!: Table<ParasiteSample, string>
  feedings!: Table<Feeding, string>
  slaughterhouses!: Table<Slaughterhouse, string>
  slaughters!: Table<Slaughter, string>
  slaughter_settlements!: Table<SlaughterSettlement, string>
  animal_photos!: Table<AnimalPhoto, string>
  traits!: Table<Trait, string>
  trait_records!: Table<TraitRecord, string>
  documents!: Table<Document, string>
  animal_movements!: Table<AnimalMovement, string>
  farm_settings!: Table<FarmSetting, string>

  constructor() {
    super('stalljournal')
    this.version(1).stores({
      animals: 'id, tag_number, se_number, status, mother_id, father_id, lambing_id, updated_at',
      places: 'id, name, active, updated_at',
      herd_groups: 'id, name, active, updated_at',
      group_memberships: 'id, animal_id, group_id, removed_on, updated_at',
      group_moves: 'id, group_id, place_id, moved_on, ended_on, updated_at',
      treatments: 'id, animal_id, date, updated_at',
      weighings: 'id, animal_id, date, updated_at',
      lambings: 'id, ewe_id, date, updated_at',
      matings: 'id, ewe_id, ram_id, start_date, updated_at',
      body_conditions: 'id, animal_id, date, updated_at',
      parasite_samples: 'id, animal_id, group_id, date, updated_at',
      feedings: 'id, group_id, date, updated_at',
      slaughterhouses: 'id, name, updated_at',
      slaughters: 'id, animal_id, slaughterhouse_id, date, status, updated_at',
      slaughter_settlements: 'id, slaughter_id, date, updated_at',
      app_settings: 'key',
    })
    // v2: foton kopplade till djur (lokal lagring, se docs/avel.md).
    this.version(2).stores({
      animal_photos: 'id, animal_id, taken_on, updated_at',
    })
    // v3: fritt definierade avelsegenskaper (se docs/avel.md §2).
    this.version(3).stores({
      traits: 'id, name, active, updated_at',
      trait_records: 'id, trait_id, animal_id, date, updated_at',
    })
    // v4: dokument (PDF/Excel) — foderanalys, träckprov, ansökningar m.m.
    this.version(4).stores({
      documents: 'id, animal_id, group_id, category, date, updated_at',
    })
    // v5: förflyttningar till/från anläggningen (smittspårning, se docs/domanoversikt.md §3).
    this.version(5).stores({
      animal_movements: 'id, animal_id, direction, date, updated_at',
    })
    // v6: gårdsuppgifter synkas (tidigare lokala app_settings, se arkitektur.md
    // revision 9). Befintliga ifyllda värden flyttas över; tomma hoppas över så
    // att en enhet som aldrig fyllt i något inte skriver över en annan enhets
    // uppgifter vid första synken.
    this.version(6)
      .stores({
        farm_settings: 'id, updated_at',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const old = (await tx.table('app_settings').toArray()) as { key: string; value: string }[]
        const rows = old
          .filter((s) => s.key && s.value)
          .map((s) => ({ id: s.key, value: s.value, updated_at: now, deleted_at: null }))
        if (rows.length) await tx.table('farm_settings').bulkPut(rows)
      })
    // v7: app_settings används inte längre (allt flyttat till farm_settings i v6).
    this.version(7).stores({
      app_settings: null,
    })
  }
}

export const db = new StalljournalDB()

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Dagens datum som YYYY-MM-DD (lokal tid). */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

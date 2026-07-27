import Dexie, { type Table } from 'dexie'
import type {
  Animal,
  AppSetting,
  BodyCondition,
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
  app_settings!: Table<AppSetting, string>

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

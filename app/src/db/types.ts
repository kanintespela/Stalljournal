// Datamodell v2 — se docs/arkitektur.md §3.
// Alla rader har id (uuid), updated_at (ISO) och deleted_at (soft delete, null = levande).

export interface BaseRow {
  id: string
  updated_at: string
  deleted_at: string | null
}

export type AnimalStatus = 'active' | 'sold' | 'slaughtered' | 'dead' | 'gone'
export type Sex = 'tacka' | 'bagge' | 'okänt'

export const ANIMAL_STATUS_LABELS: Record<AnimalStatus, string> = {
  active: 'Aktiv',
  sold: 'Såld',
  slaughtered: 'Slaktad',
  dead: 'Död',
  gone: 'Utgången',
}

export interface Animal extends BaseRow {
  tag_number: string
  se_number: string
  name: string
  birth_date: string | null
  sex: Sex
  breed: string
  mother_id: string | null
  father_id: string | null
  status: AnimalStatus
  entry_date: string | null
  exit_date: string | null
  exit_reason: string
  photo_path: string | null
  notes: string
  lambing_id: string | null
  slaughter_status: string
  planned_slaughter_date: string | null
}

export interface Place extends BaseRow {
  name: string
  type: string
  description: string
  active: boolean
  lat: number | null
  lng: number | null
}

export interface HerdGroup extends BaseRow {
  name: string
  description: string
  active: boolean
}

export interface GroupMembership extends BaseRow {
  animal_id: string
  group_id: string
  added_on: string
  removed_on: string | null
}

export interface GroupMove extends BaseRow {
  group_id: string
  place_id: string
  moved_on: string
  ended_on: string | null
  end_reason: string
  note: string
}

export interface Treatment extends BaseRow {
  animal_id: string
  date: string
  drug: string
  dose: string
  route: string
  treated_by: string
  diagnosis: string
  veterinarian: string
  withdrawal_days: number
  note: string
  photo_path: string | null
}

export interface Weighing extends BaseRow {
  animal_id: string
  date: string
  weight_kg: number
  type: string
}

export interface Lambing extends BaseRow {
  ewe_id: string
  date: string
  live_count: number
  dead_count: number
  note: string
}

export interface Mating extends BaseRow {
  ewe_id: string
  ram_id: string
  start_date: string
  end_date: string | null
}

export interface BodyCondition extends BaseRow {
  animal_id: string
  date: string
  score: number
  note: string
  photo_path: string | null
}

export interface ParasiteSample extends BaseRow {
  date: string
  animal_id: string | null
  group_id: string | null
  type: string
  result: string
  note: string
  file_path: string | null
  trichostrongylida: number | null
  haemonchus_pct: number | null
  t_axei_pct: number | null
  chab_oes: number | null
  n_filaria: number | null
  n_spathiger: number | null
  n_battus: number | null
  capillaria: number | null
}

export interface Feeding extends BaseRow {
  group_id: string
  date: string
  feed_type: string
  amount: string
  note: string
}

export interface Slaughterhouse extends BaseRow {
  name: string
  address: string
  contact: string
  phone: string
  email: string
}

export type SlaughterStatus = 'planned' | 'reported' | 'done'

export interface Slaughter extends BaseRow {
  animal_id: string
  slaughterhouse_id: string | null
  date: string
  status: SlaughterStatus
  carcass_weight: number | null
  grade: string
  fat_class: string
  price_per_kg: number | null
  note: string
  registered_by: string
  registered_at: string
}

export interface SlaughterSettlement extends BaseRow {
  slaughter_id: string
  date: string
  carcass_weight: number | null
  grade: string
  fat_class: string
  price_per_kg: number | null
  base_amount: number | null
  adjustments: number | null
  slaughter_fee: number | null
  transport_fee: number | null
  total: number | null
  vat: number | null
  net_total: number | null
  file_path: string | null
}

export interface AppSetting {
  key: string
  value: string
}

// Härledda värden — beräknas alltid, lagras aldrig (arkitektur.md §3).

/** Karens t.o.m. (sista karensdag), eller null om ingen karens. */
export function withdrawalUntil(t: Pick<Treatment, 'date' | 'withdrawal_days'>): Date | null {
  if (!t.withdrawal_days || t.withdrawal_days <= 0) return null
  const d = new Date(t.date)
  d.setDate(d.getDate() + t.withdrawal_days)
  return d
}

/** Pågår karens för denna behandling idag? */
export function isInWithdrawal(t: Pick<Treatment, 'date' | 'withdrawal_days'>, today = new Date()): boolean {
  const until = withdrawalUntil(t)
  if (!until) return false
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return until >= d0
}

/** Dräktighet får ~147 dagar: beräknad lamning från betäckningsstart. */
export function expectedLambingDate(m: Pick<Mating, 'start_date'>): Date {
  const d = new Date(m.start_date)
  d.setDate(d.getDate() + 147)
  return d
}

/** Slaktintäkt. */
export function slaughterIncome(s: Pick<Slaughter, 'price_per_kg' | 'carcass_weight'>): number | null {
  if (s.price_per_kg == null || s.carcass_weight == null) return null
  return s.price_per_kg * s.carcass_weight
}

// Foton kopplas till djur (flera per djur, t.ex. vid olika åldrar/exteriörbedömning).
// Lagras lokalt som Blob i IndexedDB; synkas inte mot servern ännu (se docs/avel.md).
export interface AnimalPhoto extends BaseRow {
  animal_id: string
  taken_on: string
  note: string
  blob: Blob
  width: number
  height: number
}

// Egna, fritt definierade egenskaper för avelsarbete (se docs/avel.md §4).
// Användaren definierar själv vilka egenskaper som är intressanta att följa
// (temperament, exteriör, ullfällning m.m.) istället för en fast lista.
export type TraitDirection = 'higher_better' | 'lower_better' | 'target'

export const TRAIT_DIRECTION_LABELS: Record<TraitDirection, string> = {
  higher_better: 'Högre värde är bättre',
  lower_better: 'Lägre värde är bättre',
  target: 'Ett målvärde är bäst (inte för högt eller lågt)',
}

export interface Trait extends BaseRow {
  name: string
  unit: string
  direction: TraitDirection
  target_value: number | null
  description: string
  active: boolean
}

export interface TraitRecord extends BaseRow {
  trait_id: string
  animal_id: string
  date: string
  value: number
  note: string
}

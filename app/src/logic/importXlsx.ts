import * as XLSX from 'xlsx'
import { db, newId, nowIso } from '../db/db'
import type {
  Animal,
  AnimalStatus,
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
  Sex,
  Slaughter,
  SlaughterSettlement,
  SlaughterStatus,
  Slaughterhouse,
  Treatment,
  Weighing,
} from '../db/types'

// Engångsimport från AppSheet-exporten (Google Sheets-arket exporterat som xlsx).
// Körs helt lokalt i webbläsaren: filen lämnar aldrig enheten, ingen data skickas
// till någon server. Se docs/kartlaggning.md §2 för den ursprungliga datamodellen.

export interface ImportPlan {
  animals: Animal[]
  places: Place[]
  herdGroups: HerdGroup[]
  groupMemberships: GroupMembership[]
  groupMoves: GroupMove[]
  treatments: Treatment[]
  weighings: Weighing[]
  lambings: Lambing[]
  matings: Mating[]
  bodyConditions: BodyCondition[]
  parasiteSamples: ParasiteSample[]
  feedings: Feeding[]
  slaughterhouses: Slaughterhouse[]
  slaughters: Slaughter[]
  slaughterSettlements: SlaughterSettlement[]
  appSettings: AppSetting[]
  warnings: string[]
  counts: Record<string, number>
}

export async function parseWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { type: 'array', cellDates: true })
}

// ---------- generiska värdehjälpare ----------

function rowsOf(wb: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
  return rows.filter((r) => Object.values(r).some((v) => v !== null && v !== ''))
}

/** Normaliserar ett cellvärde till en stabil sträng-nyckel för ID-matchning (t.ex. 18007.0 → "18007"). */
function normKey(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  const s = String(v).replace(/ /g, ' ').trim()
  return s === '' ? null : s
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  return String(v).trim()
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').toLowerCase().trim()
  return s === 'true' || s === 'ja' || s === 'yes' || s === '1'
}

/** Datum till YYYY-MM-DD. Hanterar riktiga Date-celler och text i både ISO- och MM/DD/YYYY-format. */
function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  const s = String(v).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    let [, a, b, y] = mdy
    // AppSheet exporterar med amerikanskt format MM/DD/ÅÅÅÅ; om första talet >12 är det ändå dag.
    if (Number(a) > 12) [a, b] = [b, a]
    return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
  }
  return null
}

function toLatLng(v: unknown): [number | null, number | null] {
  const s = toStr(v)
  const m = s.split(',').map((p) => Number(p.trim()))
  if (m.length === 2 && m.every((n) => !Number.isNaN(n))) return [m[0], m[1]]
  return [null, null]
}

function mapSex(v: unknown): Sex {
  const s = toStr(v).toLowerCase()
  if (s === 'tacka') return 'tacka'
  if (s === 'bagge') return 'bagge'
  return 'okänt'
}

function mapAnimalStatus(statusRaw: unknown, exitReason: string): AnimalStatus {
  if (toBool(statusRaw)) return 'active'
  const r = exitReason.toLowerCase()
  if (r.includes('slakt')) return 'slaughtered'
  if (r.includes('sål') || r.includes('sal')) return 'sold'
  if (r.includes('död') || r.includes('dod')) return 'dead'
  return 'gone'
}

function mapSlaughterStatus(v: unknown): SlaughterStatus {
  const s = toStr(v).toLowerCase()
  if (s.includes('skick') || s.includes('klar') || s.includes('avräkn')) return 'done'
  if (s.includes('anmäl') || s.includes('rapport')) return 'reported'
  return 'planned'
}

// ---------- huvudfunktion ----------

export function buildImportPlan(wb: XLSX.WorkBook): ImportPlan {
  const warnings: string[] = []
  const now = nowIso()

  const animalIdMap = new Map<string, string>()
  const placeIdMap = new Map<string, string>()
  const groupIdMap = new Map<string, string>()
  const slaughterhouseIdMap = new Map<string, string>()
  const lambingIdMap = new Map<string, string>()

  const resolve = (map: Map<string, string>, raw: unknown, context: string): string | null => {
    const key = normKey(raw)
    if (!key) return null
    const id = map.get(key)
    if (!id) warnings.push(`${context}: hittar ingen matchning för "${key}" — hoppar över referensen.`)
    return id ?? null
  }

  // -- platser --
  const places: Place[] = rowsOf(wb, 'platser').map((r) => {
    const id = newId()
    placeIdMap.set(normKey(r.id_plats) ?? id, id)
    const [lat, lng] = toLatLng(r.position)
    return {
      id,
      name: toStr(r.namn),
      type: toStr(r.typ),
      description: toStr(r.beskrivning),
      active: r.aktiv === null || r.aktiv === undefined ? true : toBool(r.aktiv),
      lat,
      lng,
      updated_at: now,
      deleted_at: null,
    }
  })

  // -- grupper --
  const herdGroups: HerdGroup[] = rowsOf(wb, 'grupper').map((r) => {
    const id = newId()
    groupIdMap.set(normKey(r.id_grupp) ?? id, id)
    return {
      id,
      name: toStr(r.namn),
      description: toStr(r.beskrivning),
      active: r.ÄrAktiv === null || r.ÄrAktiv === undefined ? true : toBool(r.ÄrAktiv),
      updated_at: now,
      deleted_at: null,
    }
  })

  // -- djur: pass 1 (skapa alla ID:n) --
  const djurRows = rowsOf(wb, 'djur')
  for (const r of djurRows) {
    const key = normKey(r.id_djur)
    if (key) animalIdMap.set(key, newId())
  }

  // mor_id/far_id kan i praktiken innehålla antingen id_djur eller märkning
  // (AppSheet-fältet far_id är fritext) — bygg en slagning på båda.
  const tagIdMap = new Map<string, string>()
  for (const r of djurRows) {
    const key = normKey(r.id_djur)
    const tag = normKey(r.märkning)
    if (key && tag) tagIdMap.set(tag, animalIdMap.get(key)!)
  }
  const resolveParent = (raw: unknown, context: string): string | null => {
    const key = normKey(raw)
    if (!key) return null
    return animalIdMap.get(key) ?? tagIdMap.get(key) ?? (warnings.push(`${context}: hittar ingen matchning för "${key}" — hoppar över referensen.`), null)
  }

  // -- djur: pass 2 (bygg poster, härstamning kan nu slås upp) --
  const animals: Animal[] = djurRows.map((r) => {
    const key = normKey(r.id_djur)!
    const id = animalIdMap.get(key)!
    const exitReason = toStr(r.orsak_utgång)
    return {
      id,
      tag_number: toStr(r.märkning) || key,
      se_number: toStr(r.se_nummer),
      name: toStr(r.internt_namn),
      birth_date: toIsoDate(r.födelsedatum),
      sex: mapSex(r.kön),
      breed: toStr(r.ras),
      mother_id: resolveParent(r.mor_id, `djur ${key}: mor_id`),
      father_id: resolveParent(r.far_id, `djur ${key}: far_id`),
      status: mapAnimalStatus(r.status, exitReason),
      entry_date: toIsoDate(r.datum_ingång),
      exit_date: toIsoDate(r.datum_utgång),
      exit_reason: exitReason,
      photo_path: null,
      notes: toStr(r.anteckningar),
      lambing_id: null, // fylls i efter lamningsjournal nedan
      slaughter_status: '',
      planned_slaughter_date: null,
      updated_at: now,
      deleted_at: null,
    }
  })
  const animalById = new Map(animals.map((a) => [a.id, a]))
  // pending lambing_id-kopplingar från djurets eget fält Lamnings_ID
  const pendingLambingByAnimal = new Map<string, string>() // animalId -> gammalt lamning-id
  djurRows.forEach((r) => {
    const key = normKey(r.id_djur)!
    const animalId = animalIdMap.get(key)!
    const lk = normKey(r.Lamnings_ID)
    if (lk) pendingLambingByAnimal.set(animalId, lk)
  })

  // -- DjurGruppRelation --
  const groupMemberships: GroupMembership[] = []
  for (const r of rowsOf(wb, 'DjurGruppRelation')) {
    const animalId = resolve(animalIdMap, r.Ref_Djur, 'DjurGruppRelation.Ref_Djur')
    const groupId = resolve(groupIdMap, r.Ref_Grupp, 'DjurGruppRelation.Ref_Grupp')
    if (!animalId || !groupId) continue
    const addedOn = toIsoDate(r.Datum_Tillagd) ?? '1970-01-01'
    const active = toBool(r.Aktiv)
    let removedOn: string | null = null
    if (!active) {
      const exitDate = animalById.get(animalId)?.exit_date ?? null
      removedOn = exitDate && exitDate >= addedOn ? exitDate : addedOn
    }
    groupMemberships.push({
      id: newId(),
      animal_id: animalId,
      group_id: groupId,
      added_on: addedOn,
      removed_on: removedOn,
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- förflyttningsjournal --
  const groupMoves: GroupMove[] = []
  for (const r of rowsOf(wb, 'förflyttningsjournal')) {
    const groupId = resolve(groupIdMap, r.Ref_Grupp, 'förflyttningsjournal.Ref_Grupp')
    const placeId = resolve(placeIdMap, r.Ref_Platser, 'förflyttningsjournal.Ref_Platser')
    if (!groupId || !placeId) continue
    const movedOn = toIsoDate(r.Datum_Flytt) ?? toIsoDate(r.startdatum)
    if (!movedOn) {
      warnings.push(`förflyttningsjournal ${normKey(r.id_flytt)}: saknar flyttdatum — hoppar över.`)
      continue
    }
    groupMoves.push({
      id: newId(),
      group_id: groupId,
      place_id: placeId,
      moved_on: movedOn,
      ended_on: toIsoDate(r.Slutdatum),
      end_reason: toStr(r.AvslutOrsak),
      note: toStr(r.Anteckning),
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- läkemedelsjournal --
  const treatments: Treatment[] = []
  for (const r of rowsOf(wb, 'läkemedelsjournal')) {
    const animalId = resolve(animalIdMap, r.djur_id, 'läkemedelsjournal.djur_id')
    if (!animalId) continue
    treatments.push({
      id: newId(),
      animal_id: animalId,
      date: toIsoDate(r.datum) ?? '1970-01-01',
      drug: toStr(r.läkemedel),
      dose: toStr(r.dosering),
      route: toStr(r.administration),
      treated_by: toStr(r.behandlande_person),
      diagnosis: toStr(r.orsak_diagnos),
      veterinarian: toStr(r.veterinär),
      withdrawal_days: toNum(r.karens_dagar) ?? 0,
      note: toStr(r['Anteckningar om hälsotillstånd']),
      photo_path: null,
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- vägningsjournal --
  const weighings: Weighing[] = []
  for (const r of rowsOf(wb, 'vägningsjournal')) {
    const animalId = resolve(animalIdMap, r.djur_id, 'vägningsjournal.djur_id')
    const weight = toNum(r.vikt_kg)
    if (!animalId || weight == null) continue
    weighings.push({
      id: newId(),
      animal_id: animalId,
      date: toIsoDate(r.datum) ?? '1970-01-01',
      weight_kg: weight,
      type: toStr(r.typ_av_vägning),
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- hullbedömning --
  const bodyConditions: BodyCondition[] = []
  for (const r of rowsOf(wb, 'hullbedömning')) {
    const animalId = resolve(animalIdMap, r.Djur_ID, 'hullbedömning.Djur_ID')
    const score = toNum(r.Hullpoäng)
    if (!animalId || score == null) continue
    bodyConditions.push({
      id: newId(),
      animal_id: animalId,
      date: toIsoDate(r.Datum) ?? '1970-01-01',
      score,
      note: toStr(r.Notering),
      photo_path: null,
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- behandlingsuppgifter → träckprov/provtagning --
  const parasiteSamples: ParasiteSample[] = []
  for (const r of rowsOf(wb, 'behandlingsuppgifter')) {
    const animalId = resolve(animalIdMap, r.id_djur, 'behandlingsuppgifter.id_djur')
    const groupId = resolve(groupIdMap, r.id_grupp, 'behandlingsuppgifter.id_grupp')
    if (!animalId && !groupId) continue
    parasiteSamples.push({
      id: newId(),
      date: toIsoDate(r.datum) ?? '1970-01-01',
      animal_id: animalId,
      group_id: groupId,
      type: toStr(r.behandlingstyp),
      result: toStr(r.resultat),
      note: toStr(r.anteckning),
      file_path: toStr(r.file) || null,
      trichostrongylida: toNum(r.Trichostrongylida),
      haemonchus_pct: toNum(r.Andel_Haemonchus),
      t_axei_pct: toNum(r.Andel_T_axei),
      chab_oes: toNum(r.Chab_oes),
      n_filaria: toNum(r.N_filaria),
      n_spathiger: toNum(r.N_spathiger),
      n_battus: toNum(r.N_battus),
      capillaria: toNum(r.Capillaria),
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- lamningsjournal --
  const lambings: Lambing[] = []
  for (const r of rowsOf(wb, 'lamningsjournal')) {
    const eweId = resolve(animalIdMap, r.tacka_id, 'lamningsjournal.tacka_id')
    if (!eweId) continue
    const id = newId()
    const oldKey = normKey(r.id_lamning)
    if (oldKey) lambingIdMap.set(oldKey, id)
    lambings.push({
      id,
      ewe_id: eweId,
      date: toIsoDate(r.datum) ?? '1970-01-01',
      live_count: toNum(r.antal_levande_lamm) ?? 0,
      dead_count: toNum(r.döda) ?? 0,
      note: toStr(r.anteckningar),
      updated_at: now,
      deleted_at: null,
    })
    // om lammen redan finns som djurposter (lamm_id_1..3), koppla dem till lamningen
    for (const col of ['lamm_id_1', 'lamm_id_2', 'lamm_id_3'] as const) {
      const lambAnimalId = resolve(animalIdMap, r[col], `lamningsjournal.${col}`)
      if (lambAnimalId) {
        const a = animalById.get(lambAnimalId)
        if (a) {
          a.lambing_id = id
          if (!a.mother_id) a.mother_id = eweId
        }
      }
    }
  }
  // koppla djurets eget Lamnings_ID-fält (om det pekar på en importerad lamning)
  for (const [animalId, oldLambingKey] of pendingLambingByAnimal) {
    const newLambingId = lambingIdMap.get(oldLambingKey)
    if (newLambingId) {
      const a = animalById.get(animalId)
      if (a) a.lambing_id = newLambingId
    }
  }

  // -- betäckningsjournal --
  const matings: Mating[] = []
  for (const r of rowsOf(wb, 'betäckningsjournal')) {
    const eweId = resolve(animalIdMap, r.tacka_id, 'betäckningsjournal.tacka_id')
    const ramId = resolve(animalIdMap, r.bagge_id, 'betäckningsjournal.bagge_id')
    if (!eweId || !ramId) continue
    matings.push({
      id: newId(),
      ewe_id: eweId,
      ram_id: ramId,
      start_date: toIsoDate(r.startdatum) ?? '1970-01-01',
      end_date: toIsoDate(r.slutdatum),
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- foderjournal --
  const feedings: Feeding[] = []
  for (const r of rowsOf(wb, 'foderjournal')) {
    const groupId = resolve(groupIdMap, r.grupp_id, 'foderjournal.grupp_id')
    if (!groupId) continue
    feedings.push({
      id: newId(),
      group_id: groupId,
      date: toIsoDate(r.datum) ?? '1970-01-01',
      feed_type: toStr(r.fodertyp),
      amount: toStr(r.mängd),
      note: toStr(r.anteckningar),
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- Slakteri --
  const slaughterhouses: Slaughterhouse[] = rowsOf(wb, 'Slakteri').map((r) => {
    const id = newId()
    slaughterhouseIdMap.set(normKey(r.SlakteriID) ?? id, id)
    return {
      id,
      name: toStr(r.SlakteriNamn),
      address: toStr(r.Adress),
      contact: toStr(r.Kontaktperson),
      phone: toStr(r.Telefon),
      email: toStr(r.Email),
      updated_at: now,
      deleted_at: null,
    }
  })

  // -- Slakt --
  const slaughterIdMap = new Map<string, string>()
  const slaughters: Slaughter[] = []
  for (const r of rowsOf(wb, 'Slakt')) {
    const animalId = resolve(animalIdMap, r.DjurID, 'Slakt.DjurID')
    if (!animalId) continue
    const id = newId()
    const oldKey = normKey(r.SlaktID)
    if (oldKey) slaughterIdMap.set(oldKey, id)
    slaughters.push({
      id,
      animal_id: animalId,
      slaughterhouse_id: resolve(slaughterhouseIdMap, r.SlakteriID, 'Slakt.SlakteriID'),
      date: toIsoDate(r.SlaktDatum) ?? '1970-01-01',
      status: mapSlaughterStatus(r.Status),
      carcass_weight: toNum(r.FaktiskSlaktvikt),
      grade: toStr(r.klassning),
      fat_class: toStr(r.fettgrupp),
      price_per_kg: toNum(r.kr_per_kg),
      note: toStr(r.Noteringar),
      registered_by: toStr(r.RegistreradAv),
      registered_at: toIsoDate(r.RegistreringsDatum) ?? now.slice(0, 10),
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- SlaktAvräkning --
  const slaughterSettlements: SlaughterSettlement[] = []
  for (const r of rowsOf(wb, 'SlaktAvräkning')) {
    const slaughterId = resolve(slaughterIdMap, r.SlaktID, 'SlaktAvräkning.SlaktID')
    if (!slaughterId) continue
    slaughterSettlements.push({
      id: newId(),
      slaughter_id: slaughterId,
      date: toIsoDate(r.AvräkningsDatum) ?? '1970-01-01',
      carcass_weight: toNum(r.SlaktVikt),
      grade: toStr(r.Klassning),
      fat_class: toStr(r.Fettgrupp),
      price_per_kg: toNum(r.KgPris),
      base_amount: toNum(r.Grundpris),
      adjustments: toNum(r.PåslagAvdrag),
      slaughter_fee: toNum(r.SlaktKostnad),
      transport_fee: toNum(r.TransportKostnad),
      total: toNum(r.Summa),
      vat: toNum(r.MomsBelopp),
      net_total: toNum(r.NettoSumma),
      file_path: toStr(r.AvräkningsFil) || null,
      updated_at: now,
      deleted_at: null,
    })
  }

  // -- inställningar --
  const appSettings: AppSetting[] = rowsOf(wb, 'inställningar').map((r) => ({
    key: toStr(r.fältnamn),
    value: toStr(r.värde),
  }))

  const counts = {
    Djur: animals.length,
    Platser: places.length,
    Grupper: herdGroups.length,
    Gruppmedlemskap: groupMemberships.length,
    Förflyttningar: groupMoves.length,
    Behandlingar: treatments.length,
    Vägningar: weighings.length,
    Lamningar: lambings.length,
    Betäckningar: matings.length,
    Hullbedömningar: bodyConditions.length,
    Provtagningar: parasiteSamples.length,
    Utfodringar: feedings.length,
    Slakterier: slaughterhouses.length,
    Slakter: slaughters.length,
    Avräkningar: slaughterSettlements.length,
    Inställningar: appSettings.length,
  }

  return {
    animals,
    places,
    herdGroups,
    groupMemberships,
    groupMoves,
    treatments,
    weighings,
    lambings,
    matings,
    bodyConditions,
    parasiteSamples,
    feedings,
    slaughterhouses,
    slaughters,
    slaughterSettlements,
    appSettings,
    warnings,
    counts,
  }
}

/** Skriver hela importplanen till den lokala databasen i en transaktion. */
export async function applyImportPlan(plan: ImportPlan): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.animals,
      db.places,
      db.herd_groups,
      db.group_memberships,
      db.group_moves,
      db.treatments,
      db.weighings,
      db.lambings,
      db.matings,
      db.body_conditions,
      db.parasite_samples,
      db.feedings,
      db.slaughterhouses,
      db.slaughters,
      db.slaughter_settlements,
      db.app_settings,
    ],
    async () => {
      if (plan.places.length) await db.places.bulkAdd(plan.places)
      if (plan.herdGroups.length) await db.herd_groups.bulkAdd(plan.herdGroups)
      if (plan.animals.length) await db.animals.bulkAdd(plan.animals)
      if (plan.groupMemberships.length) await db.group_memberships.bulkAdd(plan.groupMemberships)
      if (plan.groupMoves.length) await db.group_moves.bulkAdd(plan.groupMoves)
      if (plan.treatments.length) await db.treatments.bulkAdd(plan.treatments)
      if (plan.weighings.length) await db.weighings.bulkAdd(plan.weighings)
      if (plan.lambings.length) await db.lambings.bulkAdd(plan.lambings)
      if (plan.matings.length) await db.matings.bulkAdd(plan.matings)
      if (plan.bodyConditions.length) await db.body_conditions.bulkAdd(plan.bodyConditions)
      if (plan.parasiteSamples.length) await db.parasite_samples.bulkAdd(plan.parasiteSamples)
      if (plan.feedings.length) await db.feedings.bulkAdd(plan.feedings)
      if (plan.slaughterhouses.length) await db.slaughterhouses.bulkAdd(plan.slaughterhouses)
      if (plan.slaughters.length) await db.slaughters.bulkAdd(plan.slaughters)
      if (plan.slaughterSettlements.length) await db.slaughter_settlements.bulkAdd(plan.slaughterSettlements)
      for (const s of plan.appSettings) {
        if (s.key) await db.app_settings.put(s)
      }
    },
  )
}

/** Finns det redan importerad/skapad data i databasen? (skydd mot dubbelkörning) */
export async function hasExistingData(): Promise<boolean> {
  return (await db.animals.count()) > 0
}

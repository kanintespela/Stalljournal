import { db } from '../db/db'
import type { Animal } from '../db/types'

// Släktskap/inavelskoefficient — Wrights släktskapskoefficient ("tabular method"),
// beräknad rekursivt med memoisering. Se docs/avel.md för resonemang kring
// osäkerhet: okända anor (t.ex. inköpta baggar) räknas som obesläktade, så
// den verkliga graden kan i praktiken vara högre än vad som visas här.

const MAX_DEPTH = 20

async function getAnimal(id: string, cache: Map<string, Animal | undefined>): Promise<Animal | undefined> {
  if (!cache.has(id)) cache.set(id, await db.animals.get(id))
  return cache.get(id)
}

/** Sannolikheten att en slumpmässig allel från X och en från Y är identiska genom härstamning. */
export async function kinshipCoefficient(
  idX: string | null,
  idY: string | null,
  animalCache: Map<string, Animal | undefined> = new Map(),
  memo: Map<string, number> = new Map(),
  depth = 0,
): Promise<number> {
  if (!idX || !idY || depth > MAX_DEPTH) return 0
  const key = idX === idY ? `=${idX}` : [idX, idY].sort().join('|')
  const cached = memo.get(key)
  if (cached !== undefined) return cached

  let result: number
  if (idX === idY) {
    const a = await getAnimal(idX, animalCache)
    const f = a ? await kinshipCoefficient(a.mother_id, a.father_id, animalCache, memo, depth + 1) : 0
    result = 0.5 * (1 + f)
  } else {
    const a = await getAnimal(idX, animalCache)
    if (!a) {
      result = 0
    } else {
      const [k1, k2] = await Promise.all([
        kinshipCoefficient(a.mother_id, idY, animalCache, memo, depth + 1),
        kinshipCoefficient(a.father_id, idY, animalCache, memo, depth + 1),
      ])
      result = 0.5 * (k1 + k2)
    }
  }
  memo.set(key, result)
  return result
}

export type KinshipSeverity = 'none' | 'notice' | 'high'

export interface KinshipInfo {
  pct: number
  severity: KinshipSeverity
  label: string
}

/** Tolkar en släktskapskoefficient till en läsbar varningsnivå. Ungefärliga gränser
 *  hämtade från vedertagen avelspraxis: 1/16 (kusiner) resp. 1/4 (helsyskon/förälder-avkomma). */
export function describeKinship(f: number): KinshipInfo {
  const pct = f * 100
  if (f >= 0.25) {
    return { pct, severity: 'high', label: 'Mycket nära släktskap (motsvarande helsyskon eller förälder/avkomma)' }
  }
  if (f >= 1 / 16) {
    return { pct, severity: 'notice', label: 'Märkbart släktskap (motsvarande halvsyskon–kusiner eller närmare)' }
  }
  return { pct, severity: 'none', label: 'Inget nämnvärt släktskap enligt registrerade anor' }
}

// Anor uppåt — pyramid per generation. Rad 0 = djuret själv, rad 1 = [mor, far],
// rad 2 = [mormor, morfar, farmor, farfar], osv. Okänd anfader = null.

export async function getAncestorGenerations(
  rootId: string,
  maxGenerations = 4,
): Promise<(Animal | null)[][]> {
  const cache = new Map<string, Animal | undefined>()
  const root = (await getAnimal(rootId, cache)) ?? null
  const generations: (Animal | null)[][] = [[root]]
  let current: (Animal | null)[] = [root]

  for (let g = 1; g <= maxGenerations; g++) {
    const next: (Animal | null)[] = []
    for (const a of current) {
      const mother = a?.mother_id ? ((await getAnimal(a.mother_id, cache)) ?? null) : null
      const father = a?.father_id ? ((await getAnimal(a.father_id, cache)) ?? null) : null
      next.push(mother, father)
    }
    if (next.every((a) => a === null)) break
    generations.push(next)
    current = next
  }
  return generations
}

// Samma anor, omformade till ett nästlat träd för d3-hierarchy (se PedigreeTree.tsx).
// generations[g] är alltid en komplett binär heap: mor/far till nod i i generation g
// hamnar på index 2i/2i+1 i generation g+1 (följer direkt av push-ordningen i loopen
// ovan), så omformningen är en ren indexvandring — ingen ny databasåtkomst.

export interface AncestorHierarchyNode {
  id: string
  animal: Animal | null
  children: AncestorHierarchyNode[]
}

export function ancestorHierarchyFromGenerations(generations: (Animal | null)[][]): AncestorHierarchyNode {
  function node(g: number, i: number): AncestorHierarchyNode {
    const animal = generations[g][i]
    const hasNextGen = g + 1 < generations.length
    return {
      id: animal ? animal.id : `okänd-${g}-${i}`,
      animal,
      children: hasNextGen ? [node(g + 1, i * 2), node(g + 1, i * 2 + 1)] : [],
    }
  }
  return node(0, 0)
}

// Avkommor nedåt — rekursivt träd. Antalet grenar är obegränsat (till skillnad
// från anorna), så det representeras som ett vanligt nästlat träd, inte en pyramid.

export interface DescendantNode {
  id: string
  animal: Animal
  children: DescendantNode[]
}

export async function getDescendantTree(rootId: string, maxDepth = 6): Promise<DescendantNode[]> {
  async function children(id: string, depth: number): Promise<DescendantNode[]> {
    if (depth > maxDepth) return []
    const [asMother, asFather] = await Promise.all([
      db.animals.where('mother_id').equals(id).toArray(),
      db.animals.where('father_id').equals(id).toArray(),
    ])
    const kids = [...asMother, ...asFather].filter((a) => a.deleted_at === null)
    return Promise.all(kids.map(async (k) => ({ id: k.id, animal: k, children: await children(k.id, depth + 1) })))
  }
  return children(rootId, 1)
}

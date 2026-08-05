import type { ReactNode } from 'react'
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy'
import { linkVertical } from 'd3-shape'

// D3 räknar bara ut ren geometri (nod-x/y, länk-paths) från datan — React äger
// DOM:en och renderar SVG utifrån den beräkningen. Ingen d3.select() på en ref
// här (till skillnad från PlacesMap.tsx/Leaflet, som äger sin DOM direkt).

interface PedigreeNodeLike<T> {
  id: string
  children: T[]
}

interface Props<T extends PedigreeNodeLike<T>> {
  root: T
  orientation: 'up' | 'down'
  renderNode: (node: T) => ReactNode
  nodeWidth?: number
  nodeHeight?: number
}

const PAD = 16

export default function PedigreeTree<T extends PedigreeNodeLike<T>>({
  root,
  orientation,
  renderNode,
  nodeWidth = 108,
  nodeHeight = 42,
}: Props<T>) {
  const dx = nodeWidth + 14
  const dy = nodeHeight + 46

  const laidOut = tree<T>().nodeSize([dx, dy])(hierarchy<T>(root, (d) => d.children))
  const nodes = laidOut.descendants()
  const links = laidOut.links()

  const minX = Math.min(...nodes.map((n) => n.x))
  const maxX = Math.max(...nodes.map((n) => n.x))
  const maxY = Math.max(...nodes.map((n) => n.y))

  function pos(n: HierarchyPointNode<T>) {
    const cx = n.x - minX + nodeWidth / 2 + PAD
    const depthY = orientation === 'down' ? n.y : maxY - n.y
    const cy = depthY + nodeHeight / 2 + PAD
    return { cx, cy }
  }

  const linkPath = linkVertical<{ source: HierarchyPointNode<T>; target: HierarchyPointNode<T> }, HierarchyPointNode<T>>()
    .x((n) => pos(n).cx)
    .y((n) => pos(n).cy)

  const svgWidth = maxX - minX + nodeWidth + PAD * 2
  const svgHeight = maxY + nodeHeight + PAD * 2

  return (
    <div className="pedigree-scroll">
      <svg width={svgWidth} height={svgHeight} className="pedigree-tree">
        {/* Nycklas på position i listan, inte n.data.id: samma anfader kan förekomma
            på flera platser i trädet vid linjeavel (pedigree-collapse), vilket med
            en id-nyckel gav en React key-kollision. Noderna saknar egen lokal state
            och räknas om helt från `root` varje render, så en positionell nyckel är
            säker här. */}
        <g aria-hidden="true">
          {links.map(({ source, target }, i) => (
            <path key={i} className="pedigree-link" d={linkPath({ source, target }) ?? undefined} />
          ))}
        </g>
        <g>
          {nodes.map((n, i) => {
            const { cx, cy } = pos(n)
            return (
              <foreignObject key={i} x={cx - nodeWidth / 2} y={cy - nodeHeight / 2} width={nodeWidth} height={nodeHeight}>
                {renderNode(n.data)}
              </foreignObject>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export const RACKS_PER_ROW = 8
export const SLOTS_PER_RACK = 10
export const RACKS_PER_BLOCK = RACKS_PER_ROW * 2
export const RACK = { w: 1, h: 2.4, d: 1.1 }
export const BEZEL = { w: 0.86, h: 0.17, d: 0.05 }

const SPACING = 1.25
const AISLE = 2.4
const MIN_BLOCKS = 9
const ROW_OFFSET = AISLE / 2 + RACK.d / 2

export const ROW_LENGTH = RACKS_PER_ROW * SPACING
const BLOCK_X = ROW_LENGTH + AISLE
const BLOCK_Z = RACK.d * 2 + AISLE * 2

let cellCache = []

function getCells(count) {
  if (cellCache.length >= count) return cellCache

  const cells = []
  for (let ring = 0; cells.length < count; ring++) {
    const ringCells = []
    for (let x = -ring; x <= ring; x++) {
      for (let z = -ring; z <= ring; z++) {
        if (Math.max(Math.abs(x), Math.abs(z)) === ring) ringCells.push({ x, z })
      }
    }
    ringCells.sort(
      (a, b) =>
        Math.abs(a.z) - Math.abs(b.z) ||
        Math.abs(a.x) - Math.abs(b.x) ||
        a.x - b.x ||
        a.z - b.z,
    )
    cells.push(...ringCells)
  }
  cellCache = cells
  return cells
}

function slotNoise(rack, slot) {
  const v = Math.sin(rack * 12.9898 + slot * 78.233) * 43758.5453
  return v - Math.floor(v)
}

export function rackPlacement(n) {
  const index = n - 1
  const blockIndex = Math.floor(index / RACKS_PER_BLOCK)
  const within = index % RACKS_PER_BLOCK
  const rowInBlock = Math.floor(within / RACKS_PER_ROW)
  const col = within % RACKS_PER_ROW
  const cell = getCells(blockIndex + 1)[blockIndex]

  const side = rowInBlock === 0 ? -1 : 1
  const dir = -side
  const x = cell.x * BLOCK_X + (col - (RACKS_PER_ROW - 1) / 2) * SPACING
  const z = cell.z * BLOCK_Z + side * ROW_OFFSET

  return { x, z, dir, frontZ: z + dir * (RACK.d / 2) }
}

export function slotY(slot) {
  return 0.2 + (slot - 0.5) * ((RACK.h - 0.4) / SLOTS_PER_RACK)
}

export function buildLayout(gpus) {
  const maxRack = gpus.reduce((max, g) => Math.max(max, g.rack_no ?? 0), 0)
  const blockCount = Math.max(MIN_BLOCKS, Math.ceil(maxRack / RACKS_PER_BLOCK))
  const rackCount = blockCount * RACKS_PER_BLOCK
  const cells = getCells(blockCount)

  const byPosition = new Map()
  gpus.forEach((g) => {
    if (g.rack_no != null && g.slot_no != null) byPosition.set(`${g.rack_no}-${g.slot_no}`, g)
  })

  const frames = []
  const bezels = []
  const handles = []
  const leds = []
  const { w, h, d } = RACK

  for (let n = 1; n <= rackCount; n++) {
    const p = rackPlacement(n)
    const part = (name, lx, ly, lz, sx, sy, sz) =>
      frames.push({ key: `${n}-${name}`, position: [p.x + lx, ly, p.z + lz], scale: [sx, sy, sz] })

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        part(`post${sx}${sz}`, sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03), 0.06, h, 0.06)
      }
    }
    part('top', 0, h - 0.03, 0, w, 0.06, d)
    part('plinth', 0, 0.05, 0, w, 0.1, d)
    part('sideL', -(w / 2 - 0.01), h / 2, 0, 0.02, h - 0.16, d - 0.08)
    part('sideR', w / 2 - 0.01, h / 2, 0, 0.02, h - 0.16, d - 0.08)
    part('back', 0, h / 2, -p.dir * (d / 2 - 0.01), w - 0.08, h - 0.16, 0.02)

    for (let s = 1; s <= SLOTS_PER_RACK; s++) {
      const y = slotY(s)
      const key = `${n}-${s}`
      const gpu = byPosition.get(key)

      bezels.push({
        key,
        gpuId: gpu ? gpu.id : null,
        dir: p.dir,
        position: [p.x, y, p.frontZ - p.dir * 0.03],
        rotationY: p.dir === 1 ? 0 : Math.PI,
      })

      for (const side of [-1, 1]) {
        handles.push({
          key: `${key}-h${side}`,
          position: [p.x + side * 0.4, y, p.frontZ + p.dir * 0.015],
        })
      }

      let status = 'empty'
      if (gpu) status = gpu.status
      else if (slotNoise(n, s) < 0.5) status = 'idle'

      leds.push({
        key,
        gpuId: gpu ? gpu.id : null,
        status,
        position: [p.x + p.dir * 0.33, y, p.frontZ + p.dir * 0.012],
      })
    }
  }

  const trays = []
  const lights = []
  for (let b = 0; b < blockCount; b++) {
    const cx = cells[b].x * BLOCK_X
    const cz = cells[b].z * BLOCK_Z

    for (const side of [-1, 1]) {
      trays.push({
        key: `tray-${b}-${side}`,
        position: [cx, h + 0.28, cz + side * ROW_OFFSET],
        scale: [ROW_LENGTH, 0.05, 0.5],
      })
    }
    for (const dz of [-0.8, 0.8, BLOCK_Z / 2]) {
      lights.push({ key: `light-${b}-${dz}`, position: [cx, 4.3, cz + dz] })
    }
  }

  return { frames, trays, bezels, handles, leds, lights }
}
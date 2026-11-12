function seeded(seed) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MODELS = [
  { model: 'RTX 4090', vram: 24, price: 1.5 },
  { model: 'A100', vram: 80, price: 8 },
  { model: 'H100', vram: 80, price: 12 },
  { model: 'RTX 3080', vram: 10, price: 0.9 },
  { model: 'L40S', vram: 48, price: 3.2 },
]
const CITIES = ['Delhi', 'Mumbai', 'Pune', 'Bengaluru', 'Chennai']
const COUNTS = [1, 2, 4, 8]

function makeSample() {
  const random = seeded(7)
  const gpus = []
  let id = 1

  for (let rack = 1; rack <= 48; rack++) {
    for (let slot = 1; slot <= 10; slot++) {
      if (random() > 0.78) continue
      const roll = random()
      const status = roll < 0.55 ? 'available' : roll < 0.85 ? 'rented' : 'offline'
      const m = MODELS[Math.floor(random() * MODELS.length)]
      gpus.push({
        id: id++,
        model: m.model,
        vram_gb: m.vram,
        gpu_count: COUNTS[Math.floor(random() * COUNTS.length)],
        price_per_hour: m.price.toFixed(2),
        location: CITIES[Math.floor(random() * CITIES.length)],
        rack_no: rack,
        slot_no: slot,
        status,
      })
    }
  }
  return gpus
}

export const SAMPLE_GPUS = makeSample()
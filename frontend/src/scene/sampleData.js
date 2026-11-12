function seeded(seed) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSample() {
  const random = seeded(7)
  const models = ['RTX 4090', 'A100', 'H100', 'RTX 3080', 'L40S']
  const gpus = []
  let id = 1

  for (let rack = 1; rack <=  48; rack++) {
    for (let slot = 1; slot <= 10; slot++) {
      if (random() > 0.78) continue
      const roll = random()
      const status = roll < 0.55 ? 'available' : roll < 0.85 ? 'rented' : 'offline'
      gpus.push({
        id: id++,
        model: models[Math.floor(random() * models.length)],
        rack_no: rack,
        slot_no: slot,
        status,
      })
    }
  }
  return gpus
}

export const SAMPLE_GPUS = makeSample()
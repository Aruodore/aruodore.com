import { createRecord, weightedMean, effectiveSampleSize, normaliseLogWeights, sensor, type Settings } from './model'
import { C, figure, path, dot, histogram, text } from '../inference/figure'
import { attribute, mix, node, phase, setPath } from '../inference/motion'
export function createView(settings: Settings) {
  const r = createRecord(settings),
    k = Math.max(0, Math.min(30, Math.round(settings.inspect)))
  const current = r.frames[k]!,
    previous = r.frames[Math.max(0, k - 1)]!
  const population = current.positions.length
  const parent = (j: number) => previous.positions[current.ancestors[j]!]!
  const copies = previous.positions.map(() => 0)
  current.ancestors.forEach((i) => copies[i]!++)
  const distinct = copies.filter((count) => count > 0).length
  const orderedParents = previous.positions.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x)
  const ranks = Array<number>(population)
  orderedParents.forEach((p, rank) => {
    ranks[p.i] = rank
  })
  const children = current.ancestors
    .map((i, j) => ({ parent: i, j }))
    .sort((a, b) => ranks[a.parent]! - ranks[b.parent]!)
  const rankX = (rank: number, mobile: boolean) => 65 + ((rank + 0.5) / population) * (mobile ? 510 : 810)
  const prior = histogram(current.positions, current.priorWeights),
    posterior = histogram(current.positions, current.weights)
  const ceiling =
    Math.max(
      0.12,
      ...r.frames.flatMap((fr) =>
        [...histogram(fr.positions, fr.priorWeights), ...histogram(fr.positions, fr.weights)].map((p) => p.density),
      ),
    ) * 1.15
  const layout = (mobile: boolean) => {
    const f = figure(
      'pf',
      'Particle filtering',
      `Update ${k}. The density separates prediction and weighting. Below, ${population} weighted particles at step ${Math.max(0, k - 1)} supply ${population} children, using ${distinct} distinct parents. Parent positions are ranked by state; horizontal spacing in the ancestry diagram is not state distance.`,
      mobile,
    )
    return {
      f,
      density: f.plot(
        0,
        -40,
        40,
        0,
        ceiling,
        'hidden state x',
        `Step ${k}: ESS ${current.ess.toFixed(1)} / ${population}`,
        {
          top: 90,
          bottom: mobile ? 315 : 285,
        },
      ),
      parentY: mobile ? 485 : 425,
      childY: mobile ? 640 : 525,
    }
  }
  const indices = (mobile: boolean) =>
    current.positions.map((_, j) => j).filter((j) => j % Math.ceil(population / (mobile ? 64 : 128)) === 0)
  let lastProgress = -1
  let cached = { positions: current.positions, weights: current.weights, beta: 1, transport: 1 }
  const state = (p: number) => {
    if (p === lastProgress) return cached
    lastProgress = p
    const transport = phase(p, 0.23, 0.6),
      beta = phase(p, 0.64, 0.94)
    const positions = current.positions.map((x, j) => mix(parent(j), x, transport))
    const weights =
      beta === 1
        ? current.weights
        : normaliseLogWeights(
            current.priorWeights.map(
              (w, j) =>
                Math.log(w) -
                0.5 * beta * ((r.observations[k]! - sensor(current.positions[j]!)) / settings.sensorNoise) ** 2,
            ),
          )
    return (cached = { positions, weights, beta, transport })
  }
  const statsFor = (p: number) => {
    const s = state(p)
    return [
      {
        label: 'Effective sample size before resampling',
        value: `${effectiveSampleSize(s.weights).toFixed(1)} / ${population}`,
      },
      { label: 'Resample before next prediction', value: p < 0.94 ? 'Pending' : current.resampled ? 'Yes' : 'No' },
      {
        label: p < 0.94 ? 'Displayed state mean' : 'Filtered mean',
        value: weightedMean(s.positions, s.weights).toFixed(2),
      },
      { label: 'Observed sensor value', value: r.observations[k]!.toFixed(2) },
      { label: 'Distinct parents of this prediction', value: `${distinct} / ${population}` },
    ]
  }
  return {
    insight:
      previous.resampled && k > 0
        ? `Step ${k - 1} has ESS ${previous.ess.toFixed(1)} / ${population}. Step ${k} uses ${population} children from ${distinct} distinct parents. The fan shows copying; prediction and the new reading then change the cloud.`
        : `Follow one update: transport the particles, then multiply their weights by the reading's likelihood. The ancestry diagram shows ${distinct} distinct parents. ${k === 0 ? 'The initial cloud has no earlier resampling step.' : 'The preceding effective sample size did not require resampling.'}`,
    stats: statsFor(1),
    statsAt: statsFor,
    phase: (p: number) =>
      p < 0.23
        ? k > 0 && previous.resampled
          ? `Resample: ${distinct} parents → ${population} children`
          : 'Carry the weighted cloud'
        : p < 0.64
          ? 'Predict: separate copied particles with process noise'
          : p < 0.94
            ? 'Weight: apply the observation likelihood'
            : 'Prediction and weighting complete',
    render(mobile: boolean) {
      const { f, density, parentY, childY } = layout(mobile)
      const likelihood = Array.from({ length: 161 }, (_, i) => {
        const x = i / 2 - 40
        return { x, value: Math.exp(-0.5 * ((r.observations[k]! - sensor(x)) / settings.sensorNoise) ** 2) }
      })
      const peak = Math.max(...likelihood.map((p) => p.value))
      return (
        f.start +
        f.subtitle(
          mobile
            ? 'Teal: prediction · Navy: filtering'
            : 'Teal: prediction · Navy: filtering · Orange: scaled likelihood',
        ) +
        density.open +
        path(
          prior.map((p) => [density.x(p.x), density.y(p.density)]),
          C.prior,
          'stroke-dasharray="5 3" data-motion="prior-density"',
        ) +
        path(
          posterior.map((p) => [density.x(p.x), density.y(p.density)]),
          C.posterior,
          'data-motion="posterior-density"',
        ) +
        path(
          likelihood.map((p) => [density.x(p.x), density.y((p.value / peak) * ceiling * 0.85)]),
          C.observed,
          'data-motion="likelihood"',
        ) +
        indices(mobile)
          .map((j) =>
            dot(
              density.x(current.positions[j]!),
              density.bottom - 6 - (j % 3) * 5,
              1.2 + Math.min(3, Math.sqrt(current.weights[j]! * population)),
              C.posterior,
              `data-motion="rug-particle-${j}" opacity="${Math.max(0.08, Math.min(1, (current.weights[j]! * population) / 2))}"`,
            ),
          )
          .join('') +
        density.close +
        text(65, parentY - 48, `${distinct} distinct parents → ${population} children`) +
        text(
          65,
          parentY - 23,
          mobile
            ? 'Parent ranks · larger circles have more weight'
            : `Step ${Math.max(0, k - 1)}: parent ranks by state · larger circles have more weight`,
          `fill="${C.muted}" font-size="${mobile ? 18 : 13}"`,
        ) +
        children
          .map(
            (child, rank) =>
              `<line data-motion="copy-link-${child.j}" x1="${rankX(ranks[child.parent]!, mobile)}" y1="${parentY}" x2="${rankX(rank, mobile)}" y2="${childY}" stroke="${C.posterior}" opacity="0.15"/>` +
              dot(rankX(rank, mobile), childY, mobile ? 1.6 : 1.8, C.posterior, `data-motion="copy-${child.j}"`),
          )
          .join('') +
        orderedParents
          .map(({ i }, rank) =>
            dot(
              rankX(rank, mobile),
              parentY,
              0.7 + Math.min(5, 2 * Math.sqrt(previous.weights[i]! * population)),
              C.posterior,
              `data-motion="parent-${i}" opacity="${copies[i] ? 0.9 : 0.12}"`,
            ),
          )
          .join('') +
        text(
          65,
          childY + 30,
          `Step ${k}: ${population} children ${previous.resampled && k > 0 ? 'with equal weights before prediction' : 'carrying their inherited weights'}`,
          `fill="${C.muted}" font-size="${mobile ? 17 : 13}"`,
        ) +
        text(
          65,
          f.height - 12,
          mobile
            ? 'Faint parents: no offspring · Links: actual copies'
            : 'Faint parents received no offspring. Links show actual parent indices; spacing shows rank, not state distance.',
          `fill="${C.muted}" font-size="${mobile ? 17 : 12}"`,
        ) +
        f.end
      )
    },
    motion(svg: SVGSVGElement, mobile: boolean) {
      const { density, parentY, childY } = layout(mobile)
      const priorCurve = node(svg, 'prior-density'),
        posteriorCurve = node(svg, 'posterior-density'),
        likelihood = node(svg, 'likelihood')
      const particles = indices(mobile).map((j) => ({ j, dot: node(svg, `rug-particle-${j}`) }))
      const family = children.map((child, rank) => ({
        ...child,
        rank,
        link: node(svg, `copy-link-${child.j}`),
        dot: node(svg, `copy-${child.j}`),
      }))
      const parents = orderedParents.map(({ i }) => ({ i, dot: node(svg, `parent-${i}`) }))
      return (p: number) => {
        const s = state(p),
          split = phase(p, 0.01, 0.23)
        for (const child of family) {
          const x = mix(rankX(ranks[child.parent]!, mobile), rankX(child.rank, mobile), split),
            y = mix(parentY, childY, split)
          attribute(child.dot, 'cx', x)
          attribute(child.dot, 'cy', y)
          attribute(child.dot, 'opacity', split)
          attribute(child.link, 'x2', x)
          attribute(child.link, 'y2', y)
          attribute(child.link, 'opacity', split * 0.15)
        }
        for (const parent of parents) attribute(parent.dot, 'opacity', copies[parent.i] ? 0.9 : mix(0.9, 0.12, split))
        for (const particle of particles) {
          attribute(particle.dot, 'cx', density.x(s.positions[particle.j]!))
          attribute(particle.dot, 'r', 1.2 + Math.min(3, Math.sqrt(s.weights[particle.j]! * population)))
          attribute(particle.dot, 'opacity', Math.max(0.08, Math.min(1, (s.weights[particle.j]! * population) / 2)))
        }
        setPath(
          priorCurve,
          histogram(s.positions, current.priorWeights).map((p) => [density.x(p.x), density.y(p.density)]),
        )
        setPath(
          posteriorCurve,
          histogram(s.positions, s.weights).map((p) => [density.x(p.x), density.y(p.density)]),
        )
        attribute(posteriorCurve, 'opacity', s.beta)
        attribute(likelihood, 'opacity', phase(p, 0.59, 0.7))
      }
    },
  }
}

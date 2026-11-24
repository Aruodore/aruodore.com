import { createRecord, divergence, TARGET_MEAN, type Approximation, type Settings } from './model'
import { C, figure, path, dot, text } from '../inference/figure'
import { attribute, mix, node, phase, setPath, type Point } from '../inference/motion'
export function createView(settings: Settings) {
  const r = createRecord(settings),
    k = Math.max(0, Math.min(40, Math.round(settings.iteration))),
    previous = r.history[Math.max(0, k - 1)]!
  const current = (p: number): Approximation => {
    const first = phase(p, 0, 0.43),
      second = phase(p, 0.48, 0.92)
    return {
      mean: [mix(previous.mean[0], r.current.mean[0], first), mix(previous.mean[1], r.current.mean[1], second)],
      variance: [
        Math.exp(mix(Math.log(previous.variance[0]), Math.log(r.current.variance[0]), first)),
        Math.exp(mix(Math.log(previous.variance[1]), Math.log(r.current.variance[1]), second)),
      ],
    }
  }
  const klScale = (value: number) => Math.log1p(Math.max(0, value) / 0.1)
  const residual = Math.max(0, r.kl[k]! - r.optimumKl)
  const density = (x: number, mean: number, variance: number) =>
    Math.exp((-0.5 * (x - mean) ** 2) / variance) / Math.sqrt(2 * Math.PI * variance)
  const circle = Array.from(
    { length: 121 },
    (_, i) => [Math.cos((i / 120) * Math.PI * 2), Math.sin((i / 120) * Math.PI * 2)] as Point,
  )
  const history = (through: number): Point[] => {
    const points: Point[] = [[...r.history[0]!.mean]]
    for (let i = 1; i <= through; i++) {
      points.push([r.history[i]!.mean[0], r.history[i - 1]!.mean[1]], [...r.history[i]!.mean])
    }
    return points
  }
  const layout = (mobile: boolean) => {
    const f = figure(
      'vi',
      'Variational inference',
      'The independent Gaussian updates one coordinate at a time. Its contour moves with its mean and variances; the marginal and exact KL change with the same intermediate distribution.',
      mobile,
      mobile ? 1020 : 600,
    )
    const top = f.plot(
      0,
      -4,
      4,
      -4,
      4,
      'first coordinate',
      'Joint distributions',
      mobile ? { left: 140, right: 500, top: 90, bottom: 450 } : { left: 90, right: 350, top: 90, bottom: 350 },
    )
    const bottom = f.plot(
      1,
      0,
      40,
      0,
      klScale(Math.max(1, r.kl[0]!) * 1.05),
      'coordinate sweeps',
      'KL divergence: fitting error and family restriction',
      {
        top: mobile ? 840 : 440,
        bottom: mobile ? 930 : 520,
        formatY: (v) => (0.1 * Math.expm1(v)).toFixed(v < 1 ? 1 : 2),
      },
    )
    const peak = Math.max(0.5, 1 / Math.sqrt(2 * Math.PI * (1 - settings.correlation ** 2)))
    const marginal = f.plot(
      2,
      -4,
      4,
      0,
      peak * 1.1,
      'first coordinate',
      'First-coordinate marginal',
      mobile ? { top: 570, bottom: 710 } : { left: 480, right: 875, top: 90, bottom: 350 },
    )
    return { f, top, bottom, marginal }
  }
  const statsFor = (q: Approximation) => [
    { label: 'KL divergence', value: divergence(q, settings.correlation).toFixed(4) },
    { label: 'Irreducible family error (nats)', value: r.optimumKl.toFixed(4) },
    {
      label: 'Unfinished optimisation (nats)',
      value: Math.max(0, divergence(q, settings.correlation) - r.optimumKl).toFixed(4),
    },
    {
      label: 'Approximate marginal standard deviations',
      value: q.variance.map((v) => Math.sqrt(v).toFixed(3)).join(', '),
    },
    { label: 'Target marginal standard deviations', value: '1.000, 1.000' },
  ]
  return {
    complete: residual < 0.01,
    insight: `At the best fit, marginal SD is ${Math.sqrt(1 - settings.correlation ** 2).toFixed(3)} against the target's 1.000. The shaded KL floor is the family restriction; further fitting cannot remove it.`,
    stats: statsFor(r.current),
    statsAt: (p: number) => statsFor(current(p)),
    phase: (p: number) =>
      p < 0.45
        ? 'Fit the first coordinate'
        : p < 0.92
          ? 'Fit the second coordinate'
          : residual < 0.01
            ? 'Fitting error below 0.01 nats; family error remains'
            : 'Coordinate sweep complete',
    render(mobile: boolean) {
      const { f, top, bottom, marginal } = layout(mobile)
      let contours = ''
      for (const radius of [1, 2]) {
        contours += path(
          circle.map(([x, y]) => [
            top.x(TARGET_MEAN[0] + radius * x),
            top.y(TARGET_MEAN[1] + radius * (settings.correlation * x + Math.sqrt(1 - settings.correlation ** 2) * y)),
          ]),
          C.posterior,
          'opacity="0.55"',
        )
        contours += path(
          circle.map(([x, y]) => [
            top.x(r.current.mean[0] + radius * Math.sqrt(r.current.variance[0]) * x),
            top.y(r.current.mean[1] + radius * Math.sqrt(r.current.variance[1]) * y),
          ]),
          C.posterior,
          `stroke-dasharray="6 4" stroke-width="3" data-motion="q-${radius}"`,
        )
      }
      return (
        f.start +
        f.subtitle(
          mobile
            ? 'Solid: target · Dashed: approximation'
            : 'Solid navy: target · Dashed navy: approximation · Grey: mean iterates',
        ) +
        top.open +
        contours +
        path(
          history(k).map(([x, y]) => [top.x(x), top.y(y)]),
          C.muted,
          'data-motion="mean-path"',
        ) +
        dot(top.x(r.current.mean[0]), top.y(r.current.mean[1]), 5, C.posterior, 'data-motion="mean"') +
        top.close +
        marginal.open +
        path(
          Array.from({ length: 161 }, (_, i) => {
            const x = -4 + i / 20
            return [marginal.x(x), marginal.y(density(x, TARGET_MEAN[0], 1))]
          }),
        ) +
        path(
          Array.from({ length: 161 }, (_, i) => {
            const x = -4 + i / 20
            return [marginal.x(x), marginal.y(density(x, r.current.mean[0], r.current.variance[0]))]
          }),
          C.posterior,
          'stroke-dasharray="6 4" data-motion="marginal"',
        ) +
        marginal.close +
        bottom.open +
        `<rect x="${bottom.left}" y="${bottom.y(klScale(r.optimumKl))}" width="${bottom.right - bottom.left}" height="${bottom.bottom - bottom.y(klScale(r.optimumKl))}" fill="${C.posterior}" fill-opacity="0.12"/>` +
        path(
          r.kl.slice(0, k + 1).map((kl, i) => [bottom.x(i), bottom.y(klScale(kl))]),
          C.posterior,
          'data-motion="kl"',
        ) +
        path(
          [
            [bottom.left, bottom.y(klScale(r.optimumKl))],
            [bottom.right, bottom.y(klScale(r.optimumKl))],
          ],
          C.muted,
          'stroke-dasharray="4 4"',
        ) +
        bottom.close +
        text(
          65,
          f.height - 12,
          `Shaded floor: ${r.optimumKl.toFixed(3)} nats · Scale: log(1 + KL / 0.1)`,
          `fill="${C.muted}" font-size="${mobile ? 17 : 13}"`,
        ) +
        f.end
      )
    },
    motion(svg: SVGSVGElement, mobile: boolean) {
      const { top, bottom, marginal } = layout(mobile),
        contours = [node(svg, 'q-1'), node(svg, 'q-2')],
        mean = node(svg, 'mean'),
        meanPath = node(svg, 'mean-path'),
        marginalCurve = node(svg, 'marginal'),
        kl = node(svg, 'kl')
      const priorPath = history(Math.max(0, k - 1))
      return (p: number) => {
        const q = current(p),
          first = phase(p, 0, 0.43),
          second = phase(p, 0.48, 0.92)
        contours.forEach((element, i) =>
          setPath(
            element,
            circle.map(([x, y]) => [
              top.x(q.mean[0] + (i + 1) * Math.sqrt(q.variance[0]) * x),
              top.y(q.mean[1] + (i + 1) * Math.sqrt(q.variance[1]) * y),
            ]),
          ),
        )
        attribute(mean, 'cx', top.x(q.mean[0]))
        attribute(mean, 'cy', top.y(q.mean[1]))
        const points: Point[] = [...priorPath, [q.mean[0], previous.mean[1]]]
        if (second > 0) points.push([...q.mean])
        setPath(
          meanPath,
          points.map(([x, y]) => [top.x(x), top.y(y)]),
        )
        setPath(
          marginalCurve,
          Array.from({ length: 161 }, (_, i) => {
            const x = -4 + i / 20
            return [marginal.x(x), marginal.y(density(x, q.mean[0], q.variance[0]))]
          }),
        )
        setPath(kl, [
          ...r.kl.slice(0, k).map((value, i) => [bottom.x(i), bottom.y(klScale(value))] as Point),
          [bottom.x(Math.max(0, k - 1) + (first + second) / 2), bottom.y(klScale(divergence(q, settings.correlation)))],
        ])
      }
    },
  }
}

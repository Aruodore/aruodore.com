import { createRecord, suggest, GRID, objective, normalPdf, type Settings } from './model'
import { C, figure, path, line, dot, text } from '../inference/figure'
import { attribute, axis, mix, node, phase, setPath, type Point } from '../inference/motion'
export function createView(settings: Settings) {
  const r = createRecord(settings)
  const previous = suggest(r.observations.slice(0, -1), settings.lengthScale, settings.exploration)
  const winner = r.posterior[Math.round(r.nextX * 12)]!
  const alternative = r.posterior
    .filter(
      (point) => Math.abs(point.x - r.nextX) > 1e-8 && !r.observations.some((o) => Math.abs(o.x - point.x) < 1e-8),
    )
    .reduce((a, b) => (a.mean > b.mean ? a : b))
  const alternatives = [winner, alternative]
  const threshold = r.best + settings.exploration
  const score = (x: number) => r.acquisition[Math.round(x * 12)]!
  const latest = r.observations.at(-1)!
  const layout = (mobile: boolean) => {
    const f = figure(
      'bo',
      'Bayesian optimisation',
      'A new evaluation appears before the Gaussian process conditions on it. The posterior band contracts, expected improvement changes, and the selection cursor travels to the next candidate.',
      mobile,
      mobile ? 900 : 660,
    )
    const top = f.plot(0, 0, 10, -2.5, 2.5, 'input x', 'Posterior over the objective', {
      top: 90,
      bottom: mobile ? 270 : 255,
    })
    const maximum = Math.max(0.1, ...r.acquisition) * 1.15
    const lower = f.plot(1, 0, 10, 0, maximum, 'input x', 'Expected improvement', {
      top: mobile ? 355 : 315,
      bottom: mobile ? 465 : 405,
    })
    const comparisons = alternatives.map((point, i) =>
      f.plot(
        2 + i,
        -2.5,
        3.5,
        0,
        (normalPdf(0) / Math.max(1e-9, point.sd)) * 1.08,
        '',
        `${i ? 'B' : 'A'}: x = ${point.x.toFixed(2)}`,
        {
          left: mobile ? (i ? 385 : 70) : i ? 560 : 85,
          right: mobile ? (i ? 580 : 275) : i ? 875 : 400,
          top: mobile ? 660 : 510,
          bottom: mobile ? 790 : 595,
        },
      ),
    )
    return { f, top, lower, maximum, comparisons }
  }
  const stats = [
    { label: 'Observations', value: `${r.observations.length} / 18` },
    { label: 'Best observed value', value: r.best.toFixed(3) },
    { label: 'Suggested input', value: r.nextX.toFixed(3) },
  ]
  return {
    insight: `A predicts ${winner.mean.toFixed(2)} with SD ${winner.sd.toFixed(2)}; B predicts ${alternative.mean.toFixed(2)} with SD ${alternative.sd.toFixed(2)}. Expected improvement selects A: ${score(winner.x).toFixed(3)} against ${score(alternative.x).toFixed(3)}. Compare the shaded tails below.`,
    stats,
    phase: (p: number) =>
      p < 0.2
        ? `Evaluate at x = ${latest.x.toFixed(2)}`
        : p < 0.72
          ? 'Condition the Gaussian process'
          : p < 1
            ? 'Choose the next evaluation'
            : 'Evaluation complete',
    statsAt(p: number) {
      return [
        { label: 'Observations', value: `${r.observations.length - (p < 0.2 ? 1 : 0)} / 18` },
        { label: 'Best observed value', value: (p < 0.2 ? previous.best : r.best).toFixed(3) },
        {
          label: p < 1 ? 'Candidate input' : 'Suggested input',
          value: mix(previous.nextX, r.nextX, phase(p, 0.72, 1)).toFixed(3),
        },
      ]
    },
    render(mobile: boolean) {
      const { f, top, lower, comparisons } = layout(mobile)
      const band: Point[] = [
        ...r.posterior.map((p) => [top.x(p.x), top.y(p.mean + 1.96 * p.sd)] as Point),
        ...r.posterior.toReversed().map((p) => [top.x(p.x), top.y(p.mean - 1.96 * p.sd)] as Point),
      ]
      return (
        f.start +
        f.subtitle(
          mobile
            ? 'Orange: evaluations · Navy: posterior'
            : 'Orange: evaluations · Navy: posterior · Grey: hidden objective',
        ) +
        top.open +
        `<path data-motion="band" d="${line(band)}Z" fill="${C.posterior}" fill-opacity="0.12"/>` +
        path(
          GRID.map((x) => [top.x(x), top.y(objective(x))]),
          C.muted,
        ) +
        path(
          r.posterior.map((p) => [top.x(p.x), top.y(p.mean)]),
          C.posterior,
          'data-motion="mean"',
        ) +
        r.observations
          .map((o, i) =>
            dot(
              top.x(o.x),
              top.y(o.y),
              mobile ? 5 : 4,
              C.observed,
              i === r.observations.length - 1 ? 'data-motion="observation"' : '',
            ),
          )
          .join('') +
        `<line data-motion="selection" x1="${top.x(r.nextX)}" x2="${top.x(r.nextX)}" y1="${top.top}" y2="${top.bottom}" stroke="${C.posterior}" stroke-dasharray="4 4"/>` +
        `<line data-motion="threshold" x1="${top.left}" x2="${top.right}" y1="${top.y(threshold)}" y2="${top.y(threshold)}" stroke="${C.muted}" stroke-dasharray="2 5"/>` +
        text(
          top.right - 4,
          top.top + 15,
          'Threshold: best + ξ',
          `text-anchor="end" fill="${C.muted}" font-size="${mobile ? 17 : 12}"`,
        ) +
        top.close +
        lower.open +
        path(
          GRID.map((x, i) => [lower.x(x), lower.y(r.acquisition[i]!)]),
          C.posterior,
          'data-motion="acquisition"',
        ) +
        dot(lower.x(r.nextX), lower.y(Math.max(...r.acquisition)), 5, C.posterior, 'data-motion="candidate"') +
        lower.close +
        `<g data-motion="comparison">` +
        alternatives
          .map((point, i) => {
            const panel = comparisons[i]!
            const density = (x: number) =>
              normalPdf((x - point.mean) / Math.max(1e-9, point.sd)) / Math.max(1e-9, point.sd)
            const xs = [
              ...Array.from({ length: 241 }, (_, j) => -2.5 + j / 40),
              ...Array.from({ length: 161 }, (_, j) => point.mean + ((j - 80) / 20) * point.sd),
              threshold,
            ]
              .filter((x) => x >= -2.5 && x <= 3.5)
              .sort((a, b) => a - b)
            const curve: Point[] = xs.map((x) => [panel.x(x), panel.y(density(x))])
            const tail: Point[] = xs.filter((x) => x >= threshold).map((x) => [panel.x(x), panel.y(density(x))])
            return (
              panel.open +
              path(curve) +
              `<path d="${line([[panel.x(Math.max(-2.5, Math.min(3.5, threshold))), panel.bottom], ...tail, [panel.right, panel.bottom]])}Z" fill="${C.posterior}" fill-opacity="0.18"/>` +
              `<line x1="${panel.x(threshold)}" x2="${panel.x(threshold)}" y1="${panel.top}" y2="${panel.bottom}" stroke="${C.muted}" stroke-dasharray="2 4"/>` +
              panel.close +
              text(
                panel.left,
                panel.top - 5,
                `EI ${score(point.x).toFixed(3)} · σ ${point.sd.toFixed(2)}`,
                `fill="${C.muted}" font-size="${mobile ? 17 : 12}"`,
              )
            )
          })
          .join('') +
        '</g>' +
        text(
          65,
          f.height - 12,
          mobile
            ? 'Shaded: f > best + ξ · Separate density scales'
            : 'Horizontal: function value f. Shaded: f > best + ξ. Separate density scales; EI also weights improvement size.',
          `fill="${C.muted}" font-size="${mobile ? 17 : 12}"`,
        ) +
        f.end
      )
    },
    motion(svg: SVGSVGElement, mobile: boolean) {
      const { top, lower, maximum } = layout(mobile)
      const band = node(svg, 'band'),
        mean = node(svg, 'mean'),
        acquisition = node(svg, 'acquisition'),
        observation = node(svg, 'observation'),
        selection = node(svg, 'selection'),
        candidate = node(svg, 'candidate'),
        comparison = node(svg, 'comparison'),
        thresholdLine = node(svg, 'threshold')
      const updateAxis = axis(svg, 1, Math.max(0.1, ...previous.acquisition) * 1.15, maximum)
      const oldAtObservation = previous.posterior[Math.round(latest.x * 12)]!
      return (p: number) => {
        const condition = phase(p, 0.18, 0.72),
          choose = phase(p, 0.72, 1),
          observe = phase(p, 0, 0.2)
        attribute(comparison, 'opacity', phase(p, 0.72, 1))
        attribute(thresholdLine, 'y1', top.y(mix(previous.best, r.best, condition) + settings.exploration))
        attribute(thresholdLine, 'y2', top.y(mix(previous.best, r.best, condition) + settings.exploration))
        const posterior = r.posterior.map((point, i) => ({
          x: point.x,
          mean: mix(previous.posterior[i]!.mean, point.mean, condition),
          sd: Math.sqrt(mix(previous.posterior[i]!.sd ** 2, point.sd ** 2, condition)),
        }))
        setPath(
          mean,
          posterior.map((point) => [top.x(point.x), top.y(point.mean)]),
        )
        setPath(
          band,
          [
            ...posterior.map((point) => [top.x(point.x), top.y(point.mean + 1.96 * point.sd)] as Point),
            ...posterior.toReversed().map((point) => [top.x(point.x), top.y(point.mean - 1.96 * point.sd)] as Point),
          ],
          true,
        )
        attribute(observation, 'r', (mobile ? 5 : 4) * observe)
        attribute(observation, 'cy', top.y(mix(oldAtObservation.mean, latest.y, observe)))
        const height = updateAxis(condition),
          y = (v: number) => lower.bottom - (v / height) * (lower.bottom - lower.top)
        setPath(
          acquisition,
          GRID.map((x, i) => [lower.x(x), y(mix(previous.acquisition[i]!, r.acquisition[i]!, condition))]),
        )
        const x = mix(previous.nextX, r.nextX, choose)
        attribute(selection, 'x1', top.x(x))
        attribute(selection, 'x2', top.x(x))
        attribute(candidate, 'cx', lower.x(x))
        if (p < 0.72) {
          attribute(candidate, 'cy', y(Math.max(...previous.acquisition)))
          attribute(candidate, 'opacity', 1 - condition)
        } else {
          const index = x * 12,
            i = Math.min(GRID.length - 2, Math.floor(index))
          attribute(candidate, 'cy', y(mix(r.acquisition[i]!, r.acquisition[i + 1]!, index - i)))
          attribute(candidate, 'opacity', phase(p, 0.72, 0.84))
        }
      }
    },
  }
}

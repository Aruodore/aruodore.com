export interface Control {
  key: string
  label: string
  min: number
  max: number
  step: number
  digits?: number
  advanced?: boolean
  unit?: string
}
export interface View {
  complete?: boolean
  insight?: string
  motion?: (svg: SVGSVGElement, mobile: boolean) => (progress: number) => void
  phase?: (progress: number) => string
  statsAt?: (progress: number) => { label: string; value: string }[]
  render: (mobile: boolean) => string
  stats: { label: string; value: string }[]
}
export interface Definition {
  slug: string
  title: string
  alt: string
  defaults: { [key: string]: number }
  controls: Control[]
  stepLabel?: string
  presets?: { label: string; settings: { [key: string]: number } }[]
  duration?: number
  playKey: string
  compute: (settings: { [key: string]: number }) => View
}

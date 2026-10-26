// Pure helpers for Agent Radar: pricing, plain-language actions, formatting, SVG.

import type { AgentCard, TaskItem } from '../types'

/** Rough USD -> EUR rate used for the € estimate. */
export const EUR_PER_USD = 0.86

/** Claude orange for the main agent, then one vivid color per subagent. */
export const MAIN_COLOR = '#D97757'
export const PALETTE = [
  '#2E90FA', // bleu
  '#12B76A', // vert
  '#7A5AF8', // violet
  '#EE46BC', // rose
  '#F79009', // ambre
  '#06AED4', // cyan
  '#F04438', // rouge
  '#669F2A', // olive
]

export const INK = '#1F1E1D'
export const MUTED = '#6B6A66'
export const PAPER = '#FBFAF7'
export const CARD = '#FFFFFF'
export const LINE = '#E8E6DC'

// ---------------------------------------------------------------- pricing

type Rates = { input: number; output: number; cacheWrite: number; cacheRead: number }

/** USD per million tokens, from the public pricing page (October 2026). */
export function ratesFor(model: string, promptTokens: number): Rates {
  const m = model.toLowerCase()
  const r = (input: number, output: number, cacheWrite: number, cacheRead: number) => ({
    input,
    output,
    cacheWrite,
    cacheRead,
  })
  if (m.includes('fable') || m.includes('mythos')) {
    return m.includes('5-1') || m.includes('5.1') ? r(10, 50, 12.5, 0.25) : r(10, 50, 12.5, 1)
  }
  if (m.includes('opus')) {
    if (m.includes('5-5') || m.includes('5.5')) return r(4, 20, 5, 0.2)
    if (/opus-4-[01]\b|opus-4(?!-\d)/.test(m)) return r(15, 75, 18.75, 1.5)
    return r(5, 25, 6.25, 0.5)
  }
  if (m.includes('sonnet')) {
    if (m.includes('5-5') || m.includes('5.5')) return r(2, 10, 2.5, 0.1)
    if (m.includes('sonnet-5')) return r(2, 10, 2.5, 0.2)
    return r(3, 15, 3.75, 0.3)
  }
  if (m.includes('haiku')) {
    if (m.includes('5-5') || m.includes('5.5')) {
      return promptTokens > 100_000 ? r(0.5, 2.5, 0.625, 0.05) : r(0.1, 0.5, 0.125, 0.01)
    }
    if (m.includes('3-5')) return r(0.8, 4, 1, 0.08)
    return r(1, 5, 1.25, 0.1)
  }
  return r(4, 20, 5, 0.2)
}

export type Usage = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export function costUsd(model: string, u: Usage): number {
  const input = u.input_tokens ?? 0
  const output = u.output_tokens ?? 0
  const write = u.cache_creation_input_tokens ?? 0
  const read = u.cache_read_input_tokens ?? 0
  const rates = ratesFor(model, input + write + read)
  return (
    (input * rates.input + output * rates.output + write * rates.cacheWrite + read * rates.cacheRead) /
    1_000_000
  )
}

// ---------------------------------------------------------------- formatting

export function fmtTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace('.', ',') + ' k'
  return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M'
}

export function fmtEur(usd: number): string {
  const eur = usd * EUR_PER_USD
  if (eur > 0 && eur < 0.01) return '< 0,01 €'
  return eur.toFixed(2).replace('.', ',') + ' €'
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

export function fmtClock(at: number): string {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function tokensOf(a: AgentCard): number {
  return a.tokensIn + a.tokensOut + a.cacheRead + a.cacheWrite
}

function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

function baseName(path: unknown): string {
  if (typeof path !== 'string' || path === '') return 'un fichier'
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

function hostOf(url: unknown): string {
  if (typeof url !== 'string') return 'une page web'
  try {
    return new URL(url).host
  } catch {
    return clip(url, 40)
  }
}

// ---------------------------------------------------------------- plain words

/** What a tool call does, said the way a person would say it. */
export function describeTool(tool: string, args: Record<string, unknown>): string {
  const s = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : '')
  switch (tool) {
    case 'Read':
      return `Lit le fichier ${baseName(args.file_path)}`
    case 'Write':
      return `Écrit le fichier ${baseName(args.file_path)}`
    case 'Edit':
    case 'MultiEdit':
      return `Modifie ${baseName(args.file_path)}`
    case 'NotebookEdit':
      return `Modifie le notebook ${baseName(args.notebook_path)}`
    case 'Grep':
      return `Cherche « ${clip(s('pattern'), 40)} » dans le code`
    case 'Glob':
      return `Liste les fichiers ${clip(s('pattern'), 40)}`
    case 'Bash':
      return s('description') ? `Lance : ${clip(s('description'), 70)}` : `Lance une commande`
    case 'WebSearch':
      return `Recherche sur le web : « ${clip(s('query'), 50)} »`
    case 'WebFetch':
      return `Lit la page ${hostOf(args.url)}`
    case 'TodoWrite':
    case 'TaskCreate':
      return s('subject') ? `Planifie : ${clip(s('subject'), 60)}` : 'Met à jour son plan'
    case 'TaskUpdate':
      return s('status') === 'completed' ? 'Coche une tâche terminée ✓' : 'Met à jour la progression'
    case 'TaskList':
    case 'TaskGet':
      return 'Relit la liste des tâches'
    case 'Skill':
      return `Charge la compétence ${clip(s('skill'), 40)}`
    case 'ToolSearch':
      return 'Cherche les bons outils'
    case 'AskUserQuestion':
      return 'Te pose une question'
    case 'SendUserMessage':
      return "T'envoie un message"
    case 'SendUserFile':
      return "T'envoie un fichier"
    case 'Artifact':
      return 'Publie un artefact'
    default:
      break
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (mcp) {
    const server = mcp[1]!.replace(/_/g, ' ')
    const action = mcp[2]!.replace(/_/g, ' ')
    return `Utilise ${server} › ${action}`
  }
  return `Utilise l'outil ${tool}`
}

/** A short avatar label for an agent type. */
export function initials(type: string): string {
  const known: Record<string, string> = {
    main: 'C',
    Explore: 'EX',
    Plan: 'PL',
    'general-purpose': 'GP',
    'claude-code-guide': 'CG',
    fork: 'FK',
  }
  if (known[type]) return known[type]!
  const words = type.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const two =
    words.length >= 2 ? words[0]![0]! + words[1]![0]! : (words[0] ?? type).slice(0, 2)
  return two.toUpperCase()
}

export function statusWord(a: AgentCard): string {
  switch (a.status) {
    case 'running':
      return 'en cours'
    case 'done':
      return 'terminé'
    case 'error':
      return 'interrompu'
    default:
      return 'en attente'
  }
}

export function taskStats(tasks: readonly TaskItem[]) {
  const done = tasks.filter(t => t.status === 'completed').length
  const current = tasks.find(t => t.status === 'in_progress')
  return { done, total: tasks.length, current }
}

// ---------------------------------------------------------------- SVG

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const FONT = `font-family="Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"`

/** The agent's avatar: a pulsing orb with sonar rings while it works. */
export function avatarSvg(a: AgentCard): string {
  const c = a.color
  const label = esc(initials(a.type))
  const fs = label.length > 1 ? 12 : 15
  if (a.status === 'running') {
    const ring = (begin: string) =>
      `<circle cx="24" cy="24" r="12" fill="none" stroke="${c}" stroke-width="2.5" opacity="0">` +
      `<animate attributeName="r" values="12;23" dur="1.8s" begin="${begin}" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="0.7;0" dur="1.8s" begin="${begin}" repeatCount="indefinite"/>` +
      `</circle>`
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
      ring('0s') +
      ring('0.9s') +
      `<circle cx="24" cy="24" r="13" fill="${c}">` +
      `<animate attributeName="r" values="13;14.5;13" dur="1.2s" repeatCount="indefinite"/>` +
      `</circle>` +
      `<text x="24" y="${24 + fs * 0.36}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="#FFFFFF">${label}</text>` +
      `</svg>`
    )
  }
  const isError = a.status === 'error'
  const badge = isError
    ? `<circle cx="37" cy="37" r="7" fill="#FFFFFF"/><circle cx="37" cy="37" r="5.5" fill="#F04438"/>` +
      `<path d="M34.8 34.8l4.4 4.4M39.2 34.8l-4.4 4.4" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>`
    : a.status === 'done'
      ? `<circle cx="37" cy="37" r="7" fill="#FFFFFF"/><circle cx="37" cy="37" r="5.5" fill="#12B76A"/>` +
        `<path d="M34.6 37.1l1.7 1.7 3.2-3.4" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
      : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<circle cx="24" cy="24" r="14" fill="${c}" opacity="${a.status === 'idle' ? 0.85 : 0.45}"/>` +
    `<text x="24" y="${24 + fs * 0.36}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="#FFFFFF">${label}</text>` +
    badge +
    `</svg>`
  )
}

/** The banner: a radar sweep with one blip per working agent, LIVE badge and totals. */
export function bannerSvg(opts: {
  width: number
  isLive: boolean
  agents: readonly AgentCard[]
  tokens: number
  usd: number
  actions: number
}): string {
  const W = Math.round(opts.width)
  const H = 84
  const cx = 42
  const cy = 42
  const R = 30
  const running = opts.agents.filter(a => a.status === 'running')
  const blips = running
    .map((a, i) => {
      const angle = (i * 137.5 + 30) * (Math.PI / 180)
      const dist = R * (0.45 + 0.4 * ((i % 3) / 2))
      const x = (cx + Math.cos(angle) * dist).toFixed(1)
      const y = (cy + Math.sin(angle) * dist).toFixed(1)
      const delay = (i * 0.35).toFixed(2)
      return (
        `<circle cx="${x}" cy="${y}" r="4" fill="${a.color}" opacity="0.35">` +
        `<animate attributeName="r" values="4;9;4" dur="1.6s" begin="${delay}s" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" begin="${delay}s" repeatCount="indefinite"/>` +
        `</circle>` +
        `<circle cx="${x}" cy="${y}" r="4" fill="${a.color}"/>`
      )
    })
    .join('')
  const sweep = opts.isLive
    ? `<g><path d="M${cx} ${cy} L${cx + R} ${cy} A${R} ${R} 0 0 0 ${(cx + R * Math.cos(-Math.PI / 3)).toFixed(1)} ${(cy + R * Math.sin(-Math.PI / 3)).toFixed(1)} Z" fill="url(#sweep)"/>` +
      `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="2.6s" repeatCount="indefinite"/></g>`
    : ''
  const subs = running.filter(a => a.id !== 'main').length
  const subtitle = opts.isLive
    ? subs === 0
      ? `Claude travaille · ${opts.actions} actions`
      : `Claude + ${subs} sous-agent${subs > 1 ? 's' : ''} actif${subs > 1 ? 's' : ''} · ${opts.actions} actions`
    : opts.actions === 0
      ? 'En attente de ta première demande'
      : `En pause · ${opts.actions} actions au total`
  const live = opts.isLive
    ? `<circle cx="${W - 66}" cy="22" r="4.5" fill="#F04438"><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite"/></circle>` +
      `<text x="${W - 56}" y="26.5" ${FONT} font-size="12" font-weight="700" letter-spacing="1.2" fill="#F04438">LIVE</text>`
    : `<circle cx="${W - 74}" cy="22" r="4.5" fill="#B4B2A9"/>` +
      `<text x="${W - 64}" y="26.5" ${FONT} font-size="12" font-weight="700" letter-spacing="1.2" fill="#8C8A83">PAUSE</text>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${MAIN_COLOR}" stop-opacity="0.05"/><stop offset="1" stop-color="${MAIN_COLOR}" stop-opacity="0.45"/></linearGradient>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF4EE"/></linearGradient>` +
    `</defs>` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="url(#bg)" stroke="${LINE}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#FFFFFF" stroke="${LINE}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R * 0.62}" fill="none" stroke="${LINE}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R * 0.25}" fill="none" stroke="${LINE}"/>` +
    `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${LINE}"/>` +
    `<line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}" stroke="${LINE}"/>` +
    sweep +
    blips +
    `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${MAIN_COLOR}"/>` +
    `<text x="86" y="36" ${FONT} font-size="17" font-weight="700" fill="${INK}">Agent Radar</text>` +
    `<text x="86" y="56" ${FONT} font-size="12" fill="${MUTED}">${esc(subtitle)}</text>` +
    live +
    `<text x="${W - 16}" y="52" text-anchor="end" ${FONT} font-size="15" font-weight="700" fill="${INK}">${esc(fmtEur(opts.usd))}</text>` +
    `<text x="${W - 16}" y="68" text-anchor="end" ${FONT} font-size="11" fill="${MUTED}">${esc(fmtTokens(opts.tokens))} tokens</text>` +
    `</svg>`
  )
}

/** A progress bar: striped and moving while work goes on, solid when done. */
export function progressSvg(opts: {
  width: number
  ratio: number | null
  color: string
  isLive: boolean
}): string {
  const W = Math.round(opts.width)
  const H = 14
  const c = opts.color
  const track = `<rect x="0" y="0" width="${W}" height="${H}" rx="7" fill="#EFEDE6"/>`
  const stripes =
    `<pattern id="st" width="16" height="${H}" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">` +
    `<rect width="8" height="${H}" fill="#FFFFFF" opacity="0.28"/>` +
    (opts.isLive
      ? `<animateTransform attributeName="patternTransform" type="translate" from="0 0" to="16 0" dur="0.7s" repeatCount="indefinite" additive="sum"/>`
      : '') +
    `</pattern>`
  const grad =
    `<linearGradient id="pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${MAIN_COLOR}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
  let fill = ''
  if (opts.ratio === null) {
    // Indeterminate: a glowing segment that slides back and forth.
    const seg = Math.max(40, W * 0.28)
    fill = opts.isLive
      ? `<rect y="0" width="${seg.toFixed(0)}" height="${H}" rx="7" fill="url(#pg)"><animate attributeName="x" values="0;${(W - seg).toFixed(0)};0" dur="2.2s" repeatCount="indefinite"/></rect>`
      : ''
  } else {
    const w = Math.max(opts.ratio > 0 ? H : 0, W * Math.min(1, opts.ratio))
    fill =
      `<rect x="0" y="0" width="${w.toFixed(1)}" height="${H}" rx="7" fill="url(#pg)"/>` +
      `<rect x="0" y="0" width="${w.toFixed(1)}" height="${H}" rx="7" fill="url(#st)"/>`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${grad}${stripes}</defs>` +
    track +
    fill +
    `</svg>`
  )
}

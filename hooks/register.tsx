import { atom, read, update } from 'claude-code'
import type { ElementConstructor, EngineInterface, Register, SvgProps } from 'claude-code'

type Engine = EngineInterface

import type {
  AgentCard,
  FeedItem,
  Measure,
  RadarSession,
  Recap,
  Replay,
  Tape,
  TaskItem,
  TurnBase,
} from '../types'
import { STRINGS, detectLang, isLang, langFromName } from './i18n'
import type { Lang, Strings } from './i18n'
import {
  IDLE_REPLAY,
  autoSpeed,
  fmtClockMs,
  newTape,
  nextSpeed,
  record,
  replayPosition,
  stateAt,
  tapeDuration,
} from './replay'
import {
  CARD,
  INK,
  LINE,
  MAIN_COLOR,
  MUTED,
  PALETTE,
  PAPER,
  avatarSvg,
  bannerSvg,
  costUsd,
  describeTool,
  fmtClock,
  fmtDuration,
  fmtEur,
  fmtTokens,
  gaugeSvg,
  initials,
  levelColor,
  progressSvg,
  quotaName,
  recapSvg,
  recapText,
  resetLabel,
  statusWord,
  taskStats,
  textGauge,
  tokensOf,
} from './lib'

const PANE = 'agent-radar'
const TITLE = 'Agent Radar'
const MAIN = 'main'
const RECAP_FILE = 'agent-radar-bilan.svg'
/** A task counts as "long" (sound + toast at its end) past this. */
const LONG_TASK_MS = 20_000

const agentsAtom = atom({ plugin: 'agent-radar', key: 'agents' } as const, {} as Record<string, AgentCard>, {
  shape: 'agents-1',
})
const feedAtom = atom({ plugin: 'agent-radar', key: 'feed' } as const, [] as FeedItem[], {
  shape: 'feed-1',
})
const tasksAtom = atom({ plugin: 'agent-radar', key: 'tasks' } as const, [] as TaskItem[], {
  shape: 'tasks-1',
})
const sessionAtom = atom(
  { plugin: 'agent-radar', key: 'session' } as const,
  { startedAt: 0, isLive: false, hasAutoOpened: false, cwd: '', lang: 'fr', langSource: 'default' } as RadarSession,
  { shape: 'session-3' },
)
const measureAtom = atom(
  { plugin: 'agent-radar', key: 'measure' } as const,
  { at: 0, window: 0, rateLimits: [] } as Measure,
  { shape: 'measure-1' },
)
const turnBaseAtom = atom(
  { plugin: 'agent-radar', key: 'turnBase' } as const,
  { at: 0, prompt: '', actions: 0, tokens: 0, usd: 0, perAgent: {} } as TurnBase,
  { shape: 'turnBase-1' },
)
const recapAtom = atom({ plugin: 'agent-radar', key: 'recap' } as const, null as Recap | null, {
  shape: 'recap-1',
})
const liveTapeAtom = atom({ plugin: 'agent-radar', key: 'liveTape' } as const, null as Tape | null, {
  shape: 'tape-1',
})
const lastTapeAtom = atom({ plugin: 'agent-radar', key: 'lastTape' } as const, null as Tape | null, {
  shape: 'tape-1',
})
const replayAtom = atom({ plugin: 'agent-radar', key: 'replay' } as const, IDLE_REPLAY as Replay, {
  shape: 'replay-1',
})

function newCard(over: Partial<AgentCard> & Pick<AgentCard, 'id' | 'type' | 'label' | 'color' | 'order'>): AgentCard {
  return {
    description: '',
    status: 'idle',
    startedAt: Date.now(),
    action: '',
    actions: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheRead: 0,
    cacheWrite: 0,
    costUsd: 0,
    ...over,
  }
}

function mainCard(t: Strings): AgentCard {
  return newCard({
    id: MAIN,
    type: 'main',
    label: t.mainLabel,
    description: t.mainDesc,
    color: MAIN_COLOR,
    order: 0,
    action: t.waitingRequest,
  })
}

const loopKey = (agentId: string | undefined) => agentId ?? MAIN

/** The words of the language in force. */
async function words($: Engine): Promise<Strings> {
  const s = await read($, sessionAtom)
  return STRINGS[isLang(s.lang) ? s.lang : 'fr']
}

/** Claude's own `language` setting, else the machine's locale, when either names one of ours. */
async function langFromEnvironment($: Engine): Promise<Lang | undefined> {
  try {
    const fromSetting = langFromName(await $.settings.read({ key: 'language' }))
    if (fromSetting) return fromSetting
  } catch {
    // Settings unreadable here: try the locale.
  }
  try {
    return langFromName((await $.env.get('LC_ALL')) ?? (await $.env.get('LANG')))
  } catch {
    return undefined
  }
}

/** Makes sure a card exists for the loop, asking the engine who a new subagent is. */
async function ensureAgent($: Engine, agentId: string | undefined) {
  const id = loopKey(agentId)
  const known = await read($, agentsAtom)
  if (known[id]) return
  const t = await words($)
  let type = 'agent'
  let description = ''
  let parentId: string | undefined
  if (id !== MAIN) {
    try {
      const info = (await $.agent.list()).find(a => a.id === id)
      if (info) {
        type = info.type
        description = info.description
        parentId = info.parentId
      }
    } catch {
      // The list is a nicety: the card still shows.
    }
  }
  await update($, agentsAtom, all => {
    if (all[id]) return all
    if (id === MAIN) return { ...all, [MAIN]: mainCard(t) }
    const subs = Object.values(all).filter(a => a.id !== MAIN)
    const sameType = subs.filter(a => a.type === type).length
    const label = sameType > 0 ? `${type} #${sameType + 1}` : type
    return {
      ...all,
      [id]: newCard({
        id,
        type,
        label,
        description,
        parentId: parentId ?? MAIN,
        color: PALETTE[subs.length % PALETTE.length]!,
        order: subs.length + 1,
        status: 'running',
        action: t.starting,
      }),
    }
  })
  await recordCard($, id)
}

async function patchAgent($: Engine, agentId: string | undefined, fn: (a: AgentCard) => AgentCard) {
  const id = loopKey(agentId)
  await update($, agentsAtom, all => (all[id] ? { ...all, [id]: fn(all[id]!) } : all))
  await recordCard($, id)
}

async function pushFeed($: Engine, item: FeedItem) {
  await update($, feedAtom, list => [...list, item].slice(-80))
  await update($, liveTapeAtom, tape => record(tape, { t: Date.now(), kind: 'feed', item }))
}

/** Opens the pane the first time work starts in a session, never again on its own. */
async function autoOpen($: Engine) {
  const s = await read($, sessionAtom)
  if (s.hasAutoOpened) return
  await update($, sessionAtom, x => ({ ...x, hasAutoOpened: true }))
  void $.ui.open({ id: PANE, title: TITLE })
}

function totals(agents: Record<string, AgentCard>) {
  const list = Object.values(agents)
  return {
    actions: list.reduce((s, a) => s + a.actions, 0),
    tokens: list.reduce((s, a) => s + tokensOf(a), 0),
    usd: list.reduce((s, a) => s + a.costUsd, 0),
  }
}

// ------------------------------------------------------------ recording

/** Puts a card's current state on the tape of the task in progress. */
async function recordCard($: Engine, id: string) {
  const card = (await read($, agentsAtom))[id]
  if (card) await update($, liveTapeAtom, tape => record(tape, { t: Date.now(), kind: 'agent', card }))
}

async function recordTasks($: Engine) {
  const tasks = await read($, tasksAtom)
  await update($, liveTapeAtom, tape => record(tape, { t: Date.now(), kind: 'tasks', tasks }))
}

// ------------------------------------------------------------ replay

/** The timer that redraws a playing replay; a reload drops it and session.start restarts it. */
let ticker: { cancel: () => void } | undefined

function startTicker($: Engine) {
  ticker?.cancel()
  ticker = $.clock.every(250, () => {
    void tick($)
  })
}

function stopTicking() {
  ticker?.cancel()
  ticker = undefined
}

async function tick($: Engine) {
  const tape = await read($, lastTapeAtom)
  const replay = await read($, replayAtom)
  if (!tape || !replay.isActive || !replay.isPlaying) {
    stopTicking()
    return
  }
  const total = tapeDuration(tape)
  if (replayPosition(replay, Date.now()) >= total) {
    stopTicking()
    await update($, replayAtom, r => ({ ...r, isPlaying: false, offsetMs: total, frame: r.frame + 1 }))
    return
  }
  await update($, replayAtom, r => ({ ...r, frame: r.frame + 1 }))
}

async function startReplay($: Engine) {
  const tape = await read($, lastTapeAtom)
  if (!tape) return
  await update($, replayAtom, () => ({
    isActive: true,
    isPlaying: true,
    speed: autoSpeed(tapeDuration(tape)),
    wallStart: Date.now(),
    offsetMs: 0,
    frame: 0,
  }))
  startTicker($)
}

async function pauseReplay($: Engine) {
  stopTicking()
  await update($, replayAtom, r => ({ ...r, isPlaying: false, offsetMs: replayPosition(r, Date.now()) }))
}

async function resumeReplay($: Engine) {
  const tape = await read($, lastTapeAtom)
  await update($, replayAtom, r => ({
    ...r,
    isPlaying: true,
    wallStart: Date.now(),
    offsetMs: tape && r.offsetMs >= tapeDuration(tape) ? 0 : r.offsetMs,
  }))
  startTicker($)
}

async function changeSpeed($: Engine) {
  await update($, replayAtom, r => ({
    ...r,
    offsetMs: replayPosition(r, Date.now()),
    wallStart: Date.now(),
    speed: nextSpeed(r.speed),
  }))
}

async function exitReplay($: Engine) {
  stopTicking()
  await update($, replayAtom, () => IDLE_REPLAY)
}

/** Agents as a tree: Claude first, each subagent under the agent that spawned it. */
function treeOrder(agents: Record<string, AgentCard>): Array<{ a: AgentCard; depth: number }> {
  const children = new Map<string, AgentCard[]>()
  for (const a of Object.values(agents)) {
    if (a.id === MAIN) continue
    const parent = a.parentId && agents[a.parentId] ? a.parentId : MAIN
    children.set(parent, [...(children.get(parent) ?? []), a])
  }
  const out: Array<{ a: AgentCard; depth: number }> = []
  const walk = (id: string, depth: number) => {
    const a = agents[id]
    if (!a) return
    out.push({ a, depth })
    const kids = (children.get(id) ?? []).sort(
      (x, y) => Number(y.status === 'running') - Number(x.status === 'running') || y.order - x.order,
    )
    for (const k of kids) walk(k.id, Math.min(depth + 1, 3))
  }
  walk(MAIN, 0)
  return out
}

export const register: Register = (on, options) => {
  /** The language the person picked in the plugin's settings, or `auto`. */
  const chosen = isLang(options.language) ? options.language : undefined

  // ------------------------------------------------------------ session

  on('session.start', async ($, e, next) => {
    const lang = chosen ?? (await langFromEnvironment($))
    await update($, sessionAtom, s => ({
      ...s,
      startedAt: s.startedAt || Date.now(),
      cwd: e.cwd,
      ...(lang
        ? { lang, langSource: chosen ? ('config' as const) : ('setting' as const) }
        : s.langSource === 'config' || s.langSource === 'setting'
          ? { lang: 'fr' as const, langSource: 'default' as const }
          : {}),
    }))
    const t = await words($)
    await $.command.register({ name: 'radar', description: t.commandDesc })
    await update($, agentsAtom, all => (all[MAIN] ? all : { ...all, [MAIN]: mainCard(t) }))
    if ((await read($, replayAtom)).isPlaying) startTicker($)
    return next(e)
  })

  on('command.run', { command: 'radar' }, async $ => {
    await update($, sessionAtom, s => ({ ...s, hasAutoOpened: true }))
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: (await words($)).opened }
  })

  on('session.measure', async ($, e, next) => {
    await update($, measureAtom, () => ({
      at: Date.now(),
      contextPercent: e.context.percent,
      contextTokens: e.context.tokens,
      window: e.context.window,
      rateLimits: e.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
      costUsd: e.cost?.usd,
    }))
    return next(e)
  })

  // ------------------------------------------------------------ turns

  on('turn.start', async ($, e, next) => {
    const started = await next(e)
    const id = loopKey(e.agentId)
    if (id === MAIN) {
      // With no language picked or set, follow the person's own words.
      const guessed = detectLang(e.text)
      if (guessed) {
        await update($, sessionAtom, (s): RadarSession =>
          s.langSource === 'default' || s.langSource === 'prompt' ? { ...s, lang: guessed, langSource: 'prompt' } : s,
        )
      }
    }
    const t = await words($)
    await ensureAgent($, e.agentId)
    if (id === MAIN) {
      await autoOpen($)
      const all = await read($, agentsAtom)
      await update($, turnBaseAtom, () => ({
        at: Date.now(),
        prompt: e.text,
        ...totals(all),
        perAgent: Object.fromEntries(Object.values(all).map(a => [a.id, a.actions])),
      }))
      const tasks = await read($, tasksAtom)
      await update($, liveTapeAtom, () => newTape(all, tasks, Date.now()))
    }
    await patchAgent($, e.agentId, a => ({
      ...a,
      status: 'running',
      endedAt: undefined,
      startedAt: a.status === 'running' ? a.startedAt : Date.now(),
      action: id === MAIN ? t.readsRequest : t.readsMission,
    }))
    await update($, sessionAtom, s => ({ ...s, isLive: true, startedAt: s.startedAt || Date.now() }))
    if (id !== MAIN) {
      const all = await read($, agentsAtom)
      const card = all[id]
      if (card) {
        await pushFeed($, {
          id: `start-${id}-${e.turnId}`,
          at: Date.now(),
          agentId: id,
          text: t.starts(card.description),
          isDone: true,
        })
        const running = Object.values(all).filter(a => a.id !== MAIN && a.status === 'running')
        await patchAgent($, undefined, m => ({
          ...m,
          action: running.length > 1 ? t.coordinates(running.length) : t.delegates(card.label, card.description),
        }))
      }
    }
    return started
  })

  on('turn.step', async function* ($, e, next) {
    await ensureAgent($, e.agentId)
    if (e.index > 0) {
      const t = await words($)
      await patchAgent($, e.agentId, a => (a.status === 'running' ? { ...a, action: t.analyzing } : a))
    }
    const res = yield* next(e)
    const usage = res.usage
    if (usage) {
      const model = usage.model || e.model
      const usd = costUsd(model, usage)
      await patchAgent($, e.agentId, a => ({
        ...a,
        model,
        tokensIn: a.tokensIn + (usage.input_tokens ?? 0),
        tokensOut: a.tokensOut + (usage.output_tokens ?? 0),
        cacheRead: a.cacheRead + (usage.cache_read_input_tokens ?? 0),
        cacheWrite: a.cacheWrite + (usage.cache_creation_input_tokens ?? 0),
        costUsd: a.costUsd + usd,
      }))
    }
    return res
  })

  on('turn.complete', async ($, e, next) => {
    const id = loopKey(e.agentId)
    const t = await words($)
    const isError = e.reason === 'error' || e.reason === 'refusal' || e.isAborted
    if (id === MAIN) {
      await patchAgent($, undefined, a => ({
        ...a,
        status: isError ? 'error' : 'idle',
        endedAt: Date.now(),
        action: isError ? t.interrupted : t.answered,
      }))
      const before = await read($, agentsAtom)
      await update($, agentsAtom, all => {
        const out: Record<string, AgentCard> = {}
        for (const [k, a] of Object.entries(all)) {
          out[k] = a.status === 'running' && k !== MAIN ? { ...a, status: 'done', endedAt: Date.now() } : a
        }
        return out
      })
      for (const [k, a] of Object.entries(before)) if (a.status === 'running' && k !== MAIN) await recordCard($, k)
      await update($, sessionAtom, s => ({ ...s, isLive: false }))

      // The recap of the task this turn did.
      const all = await read($, agentsAtom)
      const base = await read($, turnBaseAtom)
      const now = totals(all)
      const actions = now.actions - base.actions
      if (actions > 0) {
        const agents = Object.values(all)
          .map(a => ({
            label: a.id === MAIN ? t.mainLabel : a.label,
            color: a.color,
            actions: a.actions - (base.perAgent[a.id] ?? 0),
          }))
          .filter(a => a.actions > 0)
          .sort((x, y) => y.actions - x.actions)
        const recap: Recap = {
          at: Date.now(),
          prompt: base.prompt,
          durationMs: e.durationMs,
          actions,
          tokens: Math.max(0, now.tokens - base.tokens),
          usd: Math.max(0, now.usd - base.usd),
          agents,
        }
        await update($, recapAtom, () => recap)
        const tape = await read($, liveTapeAtom)
        if (tape) await update($, lastTapeAtom, () => ({ ...tape, endedAt: Date.now() }))
        if (!isError && e.durationMs >= LONG_TASK_MS) {
          $.ui.toast(t.toastDone(fmtDuration(e.durationMs), actions, fmtEur(recap.usd, t)))
          try {
            await $.audio.play({ asset: 'sounds/done.wav' }, { gain: 0.6 })
          } catch {
            // No speaker where the session draws: the toast says it.
          }
        }
      }
    } else {
      await ensureAgent($, e.agentId)
      await patchAgent($, e.agentId, a => ({
        ...a,
        status: isError ? 'error' : 'done',
        endedAt: Date.now(),
        action: isError ? t.interrupted : t.missionDone,
      }))
      await pushFeed($, {
        id: `end-${id}-${e.turnId}`,
        at: Date.now(),
        agentId: id,
        text: isError ? t.wasInterrupted : t.endedIn(fmtDuration(e.durationMs)),
        isDone: true,
      })
      const all = await read($, agentsAtom)
      const still = Object.values(all).filter(a => a.id !== MAIN && a.status === 'running')
      await patchAgent($, undefined, m =>
        m.status === 'running' ? { ...m, action: still.length > 0 ? t.waitsSubs(still.length) : t.gathers } : m,
      )
    }
    return next(e)
  })

  // ------------------------------------------------------------ tool calls
  // The Agent and Workflow tools are left alone on purpose: a hook that wraps
  // them would sit above the subagent's loop and stop hearing its events.

  on('tool.call', { tool: /^(?!(Agent|Task|Workflow)$)/ }, async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    const tool = String(e.tool)
    const t = await words($)
    const text = describeTool(tool, args, t)
    const feedId = e.tool_use_id ?? crypto.randomUUID()
    await autoOpen($)
    await ensureAgent($, e.agentId)
    await patchAgent($, e.agentId, a => ({
      ...a,
      status: a.id === MAIN || a.status === 'running' ? 'running' : a.status,
      action: text,
      actions: a.actions + 1,
    }))
    await update($, sessionAtom, s => ({ ...s, isLive: true }))
    await pushFeed($, { id: feedId, at: Date.now(), agentId: loopKey(e.agentId), text, isDone: false })

    // Progress: Claude's own task list.
    if (tool === 'TodoWrite' && Array.isArray(args.todos)) {
      const todos = args.todos as Array<{ content?: string; activeForm?: string; status?: string }>
      await update($, tasksAtom, () =>
        todos.map((td, i) => ({
          id: String(i + 1),
          subject: td.content ?? td.activeForm ?? `#${i + 1}`,
          status: (td.status === 'completed' || td.status === 'in_progress' ? td.status : 'pending') as TaskItem['status'],
        })),
      )
      await recordTasks($)
    }

    const ran = await next(e)

    if (tool === 'TaskCreate' && typeof args.subject === 'string') {
      const r = ran as { result?: { task?: { id?: unknown }; id?: unknown }; text?: string }
      const fromResult = r.result?.task?.id ?? r.result?.id
      const fromText = typeof r.text === 'string' ? /#\s?(\d+)/.exec(r.text)?.[1] : undefined
      const subject = args.subject
      await update($, tasksAtom, (list): TaskItem[] => {
        const id = String(fromResult ?? fromText ?? list.length + 1)
        return list.some(x => x.id === id) ? list : [...list, { id, subject, status: 'pending' }]
      })
      await recordTasks($)
    }
    if (tool === 'TaskUpdate' && args.taskId !== undefined) {
      const id = String(args.taskId)
      const status = args.status
      await update($, tasksAtom, (list): TaskItem[] =>
        status === 'deleted'
          ? list.filter(x => x.id !== id)
          : list.map(x =>
              x.id === id
                ? {
                    ...x,
                    subject: typeof args.subject === 'string' ? args.subject : x.subject,
                    status: (status === 'completed' || status === 'in_progress' || status === 'pending'
                      ? status
                      : x.status) as TaskItem['status'],
                  }
                : x,
            ),
      )
      await recordTasks($)
    }

    await update($, feedAtom, list => list.map(f => (f.id === feedId ? { ...f, isDone: true } : f)))
    await update($, liveTapeAtom, tape => record(tape, { t: Date.now(), kind: 'feedDone', id: feedId }))
    return ran
  }).catch(($, e, next) => next(e))

  // ------------------------------------------------------------ drawing

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const T = $.ui.resolve(e)
    const { Box, Text, Button } = T
    const Svg = 'Svg' in T ? (T as unknown as { Svg: ElementConstructor<SvgProps> }).Svg : undefined
    const surface = e.surface

    const liveAgents = await read($, agentsAtom)
    const liveFeed = await read($, feedAtom)
    const liveTasks = await read($, tasksAtom)
    const session = await read($, sessionAtom)
    const measure = await read($, measureAtom)
    const recap = await read($, recapAtom)
    const replay = await read($, replayAtom)
    const lastTape = await read($, lastTapeAtom)
    const t = STRINGS[isLang(session.lang) ? session.lang : 'fr']

    // During a replay the pane draws the recorded task as it stood at the playback position.
    const tapeTotal = lastTape ? tapeDuration(lastTape) : 0
    const isReplay = replay.isActive && lastTape !== null
    const position = isReplay ? Math.min(tapeTotal, replayPosition(replay, Date.now())) : 0
    const isReplayOver = isReplay && position >= tapeTotal
    const replayed = isReplay && lastTape ? stateAt(lastTape, position) : undefined
    const agents = replayed?.agents ?? liveAgents
    const feed = replayed?.feed ?? liveFeed
    const tasks = replayed?.tasks ?? liveTasks

    const props = (e.props ?? {}) as { bodyColumns?: number }
    const cols = props.bodyColumns ?? e.viewport?.columns ?? 60
    const px = Math.max(260, Math.min(620, Math.round(cols * 7.6)))

    // Claude's own card speaks the language in force, whatever it was made in.
    const named = (a: AgentCard) => (a.id === MAIN ? { ...a, label: t.mainLabel, description: t.mainDesc } : a)
    const list = Object.values(agents).map(named)
    const tree = treeOrder(agents).map(n => ({ ...n, a: named(n.a) }))
    const { tokens: totalTokens, usd: totalUsd, actions: totalActions } = totals(agents)
    const byId = (id: string) => (agents[id] ? named(agents[id]!) : undefined)
    const isLive = isReplay ? replay.isPlaying && !isReplayOver : session.isLive
    const { done, total, current } = taskStats(tasks)
    const now = Date.now()

    const runningSubs = list.filter(a => a.id !== MAIN && a.status === 'running')
    const barColor = runningSubs[0]?.color ?? MAIN_COLOR

    // ---------------------------------------------------------- banner

    const header = Svg ? (
      <Svg
        source={bannerSvg({
          width: px,
          isLive,
          agents: list,
          tokens: totalTokens,
          usd: totalUsd,
          actions: totalActions,
          t,
          badge: isReplay ? t.replayBadge(replay.speed) : undefined,
        })}
        alt={t.altBanner(isLive, fmtTokens(totalTokens, t), fmtEur(totalUsd, t))}
        width={px}
        isInteractive
      />
    ) : (
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={INK}>
          {isReplay ? `▶ ${t.replayBadge(replay.speed)}  ` : isLive ? `● ${t.live}  ` : `○ ${t.pause}  `}Agent Radar
        </Text>
        <Text color={MUTED}>
          {fmtEur(totalUsd, t)} · {t.tokensApi(fmtTokens(totalTokens, t))}
        </Text>
      </Box>
    )

    // ---------------------------------------------------------- gauges

    const gaugeRow = (key: string, label: string, percent: number, detail: string) => (
      <Box key={key} flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" gap={1}>
          <Text color={INK} wrap="truncate-end">
            {label}
          </Text>
          <Text color={levelColor(percent)} bold>
            {Math.round(percent)} %
          </Text>
        </Box>
        {Svg ? (
          <Svg source={gaugeSvg({ width: px - 24, percent })} alt={`${label} : ${Math.round(percent)} %`} width={px - 24} />
        ) : (
          <Text color={levelColor(percent)}>{textGauge(percent)}</Text>
        )}
        {detail !== '' && (
          <Text color={MUTED} wrap="truncate-end">
            {detail}
          </Text>
        )}
      </Box>
    )

    const ctx = measure.contextPercent
    const gauges = (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Text bold color={INK}>
          {t.memoryQuota}
        </Text>
        {ctx === undefined ? (
          <Text color={MUTED}>{t.ctxPending}</Text>
        ) : (
          gaugeRow(
            'ctx',
            t.ctxLabel,
            ctx,
            t.ctxDetail(fmtTokens(measure.contextTokens ?? 0, t), fmtTokens(measure.window, t), ctx >= 80),
          )
        )}
        {measure.rateLimits.map(r =>
          gaugeRow(`quota-${r.kind}`, quotaName(r.kind, t), r.percentUsed, resetLabel(r.resetsAt, t)),
        )}
        {measure.costUsd !== undefined && <Text color={MUTED}>{t.sessionCost(fmtEur(measure.costUsd, t))}</Text>}
      </Box>
    )

    // ---------------------------------------------------------- progress

    const progressLabel =
      total > 0 ? t.tasks(done, total, current?.subject) : isLive ? t.liveProgress(totalActions, runningSubs.length) : t.noTasks
    const ratio = total > 0 ? done / total : null
    const textBar = (() => {
      const width = 24
      if (ratio === null) return isLive ? '▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱' : '▱'.repeat(width)
      const n = Math.round(ratio * width)
      return '▰'.repeat(n) + '▱'.repeat(width - n)
    })()

    const progress = (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={INK}>
            {t.progress}
          </Text>
          <Text color={MUTED}>{ratio === null ? '' : `${Math.round(ratio * 100)} %`}</Text>
        </Box>
        {Svg ? (
          <Svg
            source={progressSvg({ width: px - 24, ratio, color: barColor, isLive })}
            alt={progressLabel}
            width={px - 24}
            isInteractive
          />
        ) : (
          <Text color={barColor}>{textBar}</Text>
        )}
        <Text color={MUTED} wrap="truncate-end">
          {progressLabel}
        </Text>
      </Box>
    )

    // ---------------------------------------------------------- agent tree

    const visible = tree.slice(0, 7)
    const hidden = tree.length - visible.length

    const cards = visible.map(({ a, depth }) => {
      const elapsed = (a.endedAt ?? now) - a.startedAt
      return (
        <Box key={`agent-${a.id}`} flexDirection="row" marginLeft={depth * 3}>
          {depth > 0 && <Text color={LINE}>↳ </Text>}
          <Box
            flexDirection="row"
            flexGrow={1}
            flexShrink={1}
            gap={1}
            padding={1}
            borderStyle="round"
            borderColor={a.status === 'running' ? a.color : LINE}
            backgroundColor={CARD}
          >
            {Svg ? (
              <Svg source={avatarSvg(a)} alt={`${a.label}, ${statusWord(a, t)}`} width={48} height={48} isInteractive />
            ) : (
              <Text bold color={a.color}>
                {a.status === 'running' ? '◉' : a.status === 'done' ? '✓' : '○'} {initials(a.type)}
              </Text>
            )}
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <Box flexDirection="row" justifyContent="space-between" gap={1}>
                <Text bold color={a.color} wrap="truncate-end">
                  {a.label}
                </Text>
                <Text color={a.status === 'running' ? a.color : MUTED} bold={a.status === 'running'}>
                  {a.status === 'running' ? '● ' : ''}
                  {statusWord(a, t)}
                </Text>
              </Box>
              {a.description !== '' && (
                <Text color={MUTED} wrap="truncate-end">
                  {a.description}
                </Text>
              )}
              <Text color={INK} wrap="truncate-end">
                {a.status === 'running' ? '→ ' : ''}
                {a.action}
              </Text>
              <Text color={MUTED} wrap="truncate-end">
                ⏱ {fmtDuration(Math.max(0, elapsed))} · {t.actions(a.actions)} · {fmtTokens(tokensOf(a), t)} tokens ·{' '}
                {fmtEur(a.costUsd, t)} {t.api}
              </Text>
              {(a.id !== MAIN || list.length > 1) && (
                <Box flexDirection="row">
                  <Button
                    key={`view-${a.id}`}
                    label={a.id === MAIN ? t.viewMain : t.viewSub}
                    onPress={async () => {
                      const r = await $.ui.view(a.id === MAIN ? {} : { agentId: a.id })
                      if (r.deny) $.ui.toast(t.viewDeny(r.deny))
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )
    })

    // ---------------------------------------------------------- recap

    const recapBlock = recap && (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={INK}>
            {t.recapTitle}
          </Text>
          <Text color={MUTED}>{fmtClock(recap.at)}</Text>
        </Box>
        {Svg ? (
          <Svg
            source={recapSvg(recap, t)}
            alt={recapText(recap, t)}
            width={px - 24}
            height={Math.round(((px - 24) * 630) / 1200)}
          />
        ) : (
          <Text color={INK}>{recapText(recap, t)}</Text>
        )}
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {lastTape && !isReplay && (
            <Button key="replay-start" label={t.replayStart} variant="primary" onPress={() => startReplay($)} />
          )}
          <Button
            key="recap-copy"
            label={t.copyText}
            onPress={async () => {
              const r = await $.ui.copy({ text: recapText(recap, t), surface })
              $.ui.toast(r.isCopied ? t.copied : t.copyUnavailable)
            }}
          />
          <Button
            key="recap-export"
            label={t.exportImage}
            onPress={async () => {
              const s = await read($, sessionAtom)
              if (!s.cwd) {
                $.ui.toast(t.exportUnavailable)
                return
              }
              await $.fs.write(`${s.cwd.replace(/\/$/, '')}/${RECAP_FILE}`, recapSvg(recap, t))
              await $.prompt.submit({ text: t.exportPrompt(RECAP_FILE) })
              $.ui.toast(t.exportStarted)
            }}
          />
        </Box>
      </Box>
    )

    // ---------------------------------------------------------- feed

    const recent = feed.slice(-8).reverse()
    const activity = (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color={INK}>
          {t.feed}
        </Text>
        {recent.length === 0 && <Text color={MUTED}>{t.feedEmpty}</Text>}
        {recent.map(f => {
          const who = byId(f.agentId)
          return (
            <Box key={`feed-${f.id}`} flexDirection="row" gap={1}>
              <Text color={MUTED} mono>
                {fmtClock(f.at)}
              </Text>
              <Text color={who?.color ?? MUTED} bold>
                {f.isDone ? '●' : '◌'} {who?.label ?? 'agent'}
              </Text>
              <Text color={f.isDone ? MUTED : INK} wrap="truncate-end">
                {f.text}
              </Text>
            </Box>
          )
        })}
      </Box>
    )

    // ---------------------------------------------------------- replay bar

    const replayBar = isReplay && (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={MAIN_COLOR}>
            {isReplayOver ? t.replayDone : t.replayClock(fmtClockMs(position), fmtClockMs(tapeTotal))}
          </Text>
        </Box>
        {Svg ? (
          <Svg
            source={progressSvg({ width: px - 24, ratio: position / tapeTotal, color: MAIN_COLOR, isLive: false })}
            alt={t.replayClock(fmtClockMs(position), fmtClockMs(tapeTotal))}
            width={px - 24}
          />
        ) : (
          <Text color={MAIN_COLOR}>{textGauge((position / tapeTotal) * 100, 24)}</Text>
        )}
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {isReplayOver ? (
            <Button key="replay-restart" label={t.replayRestart} variant="primary" onPress={() => resumeReplay($)} />
          ) : replay.isPlaying ? (
            <Button key="replay-pause" label={t.replayPause} onPress={() => pauseReplay($)} />
          ) : (
            <Button key="replay-resume" label={t.replayResume} variant="primary" onPress={() => resumeReplay($)} />
          )}
          {!isReplayOver && <Button key="replay-speed" label={t.replaySpeed(nextSpeed(replay.speed))} onPress={() => changeSpeed($)} />}
          <Button key="replay-exit" label={t.replayExit} onPress={() => exitReplay($)} />
        </Box>
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} padding={1} backgroundColor={PAPER}>
        {header}
        {replayBar}
        {progress}
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
            <Text bold color={INK}>
              {t.agents}
            </Text>
            <Text color={MUTED}>{t.activeCount(runningSubs.length, list.length)}</Text>
          </Box>
          {cards}
          {hidden > 0 && <Text color={MUTED}>{t.others(hidden)}</Text>}
        </Box>
        {!isReplay && gauges}
        {(!isReplay || isReplayOver) && recapBlock}
        {activity}
        {!isReplay && (
        <Box flexDirection="row" justifyContent="flex-end">
          <Button
            key="reset"
            label={t.reset}
            onPress={async () => {
              await update($, agentsAtom, () => ({ [MAIN]: mainCard(t) }))
              await update($, feedAtom, () => [])
              await update($, tasksAtom, () => [])
              await update($, recapAtom, () => null)
              await update($, sessionAtom, s => ({ ...s, startedAt: Date.now(), isLive: false }))
            }}
          />
        </Box>
        )}
      </Box>
    )
  })
}

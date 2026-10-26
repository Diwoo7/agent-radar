import { atom, read, update } from 'claude-code'
import type { ElementConstructor, EngineInterface, Register, SvgProps } from 'claude-code'

type Engine = EngineInterface

import type { AgentCard, FeedItem, RadarSession, TaskItem } from '../types'
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
  initials,
  progressSvg,
  statusWord,
  taskStats,
  tokensOf,
} from './lib'

const PANE = 'agent-radar'
const TITLE = 'Agent Radar'
const MAIN = 'main'

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
  { startedAt: 0, isLive: false } as RadarSession,
  { shape: 'session-1' },
)

function newCard(over: Partial<AgentCard> & Pick<AgentCard, 'id' | 'type' | 'label' | 'color' | 'order'>): AgentCard {
  return {
    description: '',
    status: 'idle',
    startedAt: Date.now(),
    action: 'Prêt',
    actions: 0,
    tokensIn: 0,
    tokensOut: 0,
    cacheRead: 0,
    cacheWrite: 0,
    costUsd: 0,
    ...over,
  }
}

function mainCard(): AgentCard {
  return newCard({
    id: MAIN,
    type: 'main',
    label: 'Claude',
    description: 'Agent principal : comprend ta demande et coordonne',
    color: MAIN_COLOR,
    order: 0,
    action: 'En attente de ta demande',
  })
}

const loopKey = (agentId: string | undefined) => agentId ?? MAIN

/** Makes sure a card exists for the loop, asking the engine who a new subagent is. */
async function ensureAgent($: Engine, agentId: string | undefined) {
  const id = loopKey(agentId)
  const known = await read($, agentsAtom)
  if (known[id]) return
  let type = 'agent'
  let description = ''
  if (id !== MAIN) {
    try {
      const info = (await $.agent.list()).find(a => a.id === id)
      if (info) {
        type = info.type
        description = info.description
      }
    } catch {
      // The list is a nicety: the card still shows.
    }
  }
  await update($, agentsAtom, all => {
    if (all[id]) return all
    if (id === MAIN) return { ...all, [MAIN]: mainCard() }
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
        color: PALETTE[subs.length % PALETTE.length]!,
        order: subs.length + 1,
        status: 'running',
        action: 'Démarre…',
      }),
    }
  })
}

async function patchAgent(
  $: Engine,
  agentId: string | undefined,
  fn: (a: AgentCard) => AgentCard,
) {
  const id = loopKey(agentId)
  await update($, agentsAtom, all => (all[id] ? { ...all, [id]: fn(all[id]!) } : all))
}

async function pushFeed($: Engine, item: FeedItem) {
  await update($, feedAtom, list => [...list, item].slice(-80))
}

export const register: Register = on => {
  // ------------------------------------------------------------ session

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'radar',
      description: 'Ouvre Agent Radar : agents, actions, progression et consommation en direct',
    })
    await update($, agentsAtom, all => (all[MAIN] ? all : { ...all, [MAIN]: mainCard() }))
    await update($, sessionAtom, s => (s.startedAt ? s : { ...s, startedAt: Date.now() }))
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'radar' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Agent Radar est ouvert.' }
  })

  // ------------------------------------------------------------ turns

  on('turn.start', async ($, e, next) => {
    const started = await next(e)
    const id = loopKey(e.agentId)
    await ensureAgent($, e.agentId)
    await patchAgent($, e.agentId, a => ({
      ...a,
      status: 'running',
      endedAt: undefined,
      startedAt: a.status === 'running' ? a.startedAt : Date.now(),
      action: id === MAIN ? 'Lit ta demande et réfléchit' : 'Prend connaissance de sa mission',
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
          text: card.description ? `démarre : ${card.description}` : 'démarre',
          isDone: true,
        })
        const running = Object.values(all).filter(a => a.id !== MAIN && a.status === 'running')
        await patchAgent($, undefined, m => ({
          ...m,
          action:
            running.length > 1
              ? `Coordonne ${running.length} sous-agents en parallèle`
              : `Délègue à ${card.label}${card.description ? ` : ${card.description}` : ''}`,
        }))
      }
    }
    return started
  })

  on('turn.step', async function* ($, e, next) {
    await ensureAgent($, e.agentId)
    if (e.index > 0) {
      await patchAgent($, e.agentId, a =>
        a.status === 'running' ? { ...a, action: 'Analyse les résultats et décide de la suite' } : a,
      )
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
    const isError = e.reason === 'error' || e.reason === 'refusal' || e.isAborted
    if (id === MAIN) {
      await patchAgent($, undefined, a => ({
        ...a,
        status: isError ? 'error' : 'idle',
        endedAt: Date.now(),
        action: isError ? 'Interrompu' : 'A répondu · en attente de ta prochaine demande',
      }))
      await update($, agentsAtom, all => {
        const out: Record<string, AgentCard> = {}
        for (const [k, a] of Object.entries(all)) {
          out[k] = a.status === 'running' && k !== MAIN ? { ...a, status: 'done', endedAt: Date.now() } : a
        }
        return out
      })
      await update($, sessionAtom, s => ({ ...s, isLive: false }))
    } else {
      await ensureAgent($, e.agentId)
      await patchAgent($, e.agentId, a => ({
        ...a,
        status: isError ? 'error' : 'done',
        endedAt: Date.now(),
        action: isError ? 'Interrompu' : 'Mission terminée, rapport rendu',
      }))
      await pushFeed($, {
        id: `end-${id}-${e.turnId}`,
        at: Date.now(),
        agentId: id,
        text: isError ? 'a été interrompu' : `a terminé en ${fmtDuration(e.durationMs)}`,
        isDone: true,
      })
      const all = await read($, agentsAtom)
      const still = Object.values(all).filter(a => a.id !== MAIN && a.status === 'running')
      await patchAgent($, undefined, m =>
        m.status === 'running'
          ? {
              ...m,
              action:
                still.length > 0
                  ? `Attend ${still.length} sous-agent${still.length > 1 ? 's' : ''}`
                  : 'Rassemble les résultats des sous-agents',
            }
          : m,
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
    const text = describeTool(tool, args)
    const feedId = e.tool_use_id ?? crypto.randomUUID()
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
        todos.map((t, i) => ({
          id: String(i + 1),
          subject: t.content ?? t.activeForm ?? `Tâche ${i + 1}`,
          status: (t.status === 'completed' || t.status === 'in_progress' ? t.status : 'pending') as TaskItem['status'],
        })),
      )
    }

    const ran = await next(e)

    if (tool === 'TaskCreate' && typeof args.subject === 'string') {
      const r = ran as { result?: { task?: { id?: unknown }; id?: unknown }; text?: string }
      const fromResult = r.result?.task?.id ?? r.result?.id
      const fromText = typeof r.text === 'string' ? /#\s?(\d+)/.exec(r.text)?.[1] : undefined
      const subject = args.subject
      await update($, tasksAtom, (list): TaskItem[] => {
        const id = String(fromResult ?? fromText ?? list.length + 1)
        return list.some(t => t.id === id) ? list : [...list, { id, subject, status: 'pending' }]
      })
    }
    if (tool === 'TaskUpdate' && args.taskId !== undefined) {
      const id = String(args.taskId)
      const status = args.status
      await update($, tasksAtom, (list): TaskItem[] =>
        status === 'deleted'
          ? list.filter(t => t.id !== id)
          : list.map(t =>
              t.id === id
                ? {
                    ...t,
                    subject: typeof args.subject === 'string' ? args.subject : t.subject,
                    status: (status === 'completed' || status === 'in_progress' || status === 'pending'
                      ? status
                      : t.status) as TaskItem['status'],
                  }
                : t,
            ),
      )
    }

    await update($, feedAtom, list => list.map(f => (f.id === feedId ? { ...f, isDone: true } : f)))
    return ran
  }).catch(($, e, next) => next(e))

  // ------------------------------------------------------------ drawing

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const T = $.ui.resolve(e)
    const { Box, Text, Button } = T
    const Svg = 'Svg' in T ? (T as unknown as { Svg: ElementConstructor<SvgProps> }).Svg : undefined

    const agents = await read($, agentsAtom)
    const feed = await read($, feedAtom)
    const tasks = await read($, tasksAtom)
    const session = await read($, sessionAtom)

    const props = (e.props ?? {}) as { bodyColumns?: number }
    const cols = props.bodyColumns ?? e.viewport?.columns ?? 60
    const px = Math.max(260, Math.min(620, Math.round(cols * 7.6)))

    const list = Object.values(agents).sort((a, b) => {
      const rank = (x: AgentCard) => (x.status === 'running' ? 0 : x.id === MAIN ? 1 : 2)
      return rank(a) - rank(b) || b.order - a.order
    })
    const totalTokens = list.reduce((s, a) => s + tokensOf(a), 0)
    const totalUsd = list.reduce((s, a) => s + a.costUsd, 0)
    const totalActions = list.reduce((s, a) => s + a.actions, 0)
    const byId = (id: string) => agents[id]
    const isLive = session.isLive
    const { done, total, current } = taskStats(tasks)
    const now = Date.now()

    const runningSubs = list.filter(a => a.id !== MAIN && a.status === 'running')
    const barColor = runningSubs[0]?.color ?? MAIN_COLOR

    const header = Svg ? (
      <Svg
        source={bannerSvg({ width: px, isLive, agents: list, tokens: totalTokens, usd: totalUsd, actions: totalActions })}
        alt={`Agent Radar, ${isLive ? 'en direct' : 'en pause'}, ${fmtTokens(totalTokens)} tokens, ${fmtEur(totalUsd)}`}
        width={px}
        isInteractive
      />
    ) : (
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={INK}>
          {isLive ? '● LIVE  ' : '○ PAUSE  '}Agent Radar
        </Text>
        <Text color={MUTED}>
          {fmtTokens(totalTokens)} tokens · {fmtEur(totalUsd)}
        </Text>
      </Box>
    )

    const progressLabel =
      total > 0
        ? `${done}/${total} tâches${current ? ` · en cours : ${current.subject}` : ''}`
        : isLive
          ? `${totalActions} actions · ${runningSubs.length > 0 ? `${runningSubs.length} sous-agent(s) au travail` : 'Claude avance'}`
          : 'Aucune tâche planifiée pour le moment'
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
            Progression
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

    const visible = list.slice(0, 6)
    const hidden = list.length - visible.length

    const cards = visible.map(a => {
      const elapsed = (a.endedAt ?? (a.status === 'running' ? now : a.endedAt ?? now)) - a.startedAt
      const tokens = tokensOf(a)
      return (
        <Box
          key={`agent-${a.id}`}
          flexDirection="row"
          gap={1}
          padding={1}
          borderStyle="round"
          borderColor={a.status === 'running' ? a.color : LINE}
          backgroundColor={CARD}
        >
          {Svg ? (
            <Svg source={avatarSvg(a)} alt={`${a.label}, ${statusWord(a)}`} width={48} height={48} isInteractive />
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
                {statusWord(a)}
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
              ⏱ {fmtDuration(Math.max(0, elapsed))} · {a.actions} action{a.actions > 1 ? 's' : ''} · {fmtTokens(tokens)}{' '}
              tokens · {fmtEur(a.costUsd)}
            </Text>
          </Box>
        </Box>
      )
    })

    const recent = feed.slice(-8).reverse()
    const activity = (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color={INK}>
          Fil d'activité
        </Text>
        {recent.length === 0 && <Text color={MUTED}>Rien pour l'instant. Pose une question à Claude !</Text>}
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

    return (
      <Box flexDirection="column" gap={1} padding={1} backgroundColor={PAPER}>
        {header}
        {progress}
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
            <Text bold color={INK}>
              Agents
            </Text>
            <Text color={MUTED}>
              {runningSubs.length} actif{runningSubs.length > 1 ? 's' : ''} · {list.length} au total
            </Text>
          </Box>
          {cards}
          {hidden > 0 && (
            <Text color={MUTED}>
              + {hidden} agent{hidden > 1 ? 's' : ''} terminé{hidden > 1 ? 's' : ''}
            </Text>
          )}
        </Box>
        {activity}
        <Box flexDirection="row" justifyContent="flex-end">
          <Button
            key="reset"
            label="Remettre à zéro"
            onPress={async () => {
              await update($, agentsAtom, () => ({ [MAIN]: mainCard() }))
              await update($, feedAtom, () => [])
              await update($, tasksAtom, () => [])
              await update($, sessionAtom, () => ({ startedAt: Date.now(), isLive: false }))
            }}
          />
        </Box>
      </Box>
    )
  })
}

// Recording and playing back a task: pure functions over a Tape.

import type { AgentCard, FeedItem, Replay, TaskItem, Tape, TapeEvent } from '../types'

/** Events kept per task; past this the oldest go, the starting point stays. */
export const TAPE_LIMIT = 1200

/** Playback speeds offered, slowest first. */
export const SPEEDS = [1, 2, 5, 10, 20, 50, 100] as const

/** A replay lasts about this long at its automatic speed: the length of a short video. */
const TARGET_MS = 45_000

export const IDLE_REPLAY: Replay = { isActive: false, isPlaying: false, speed: 10, wallStart: 0, offsetMs: 0, frame: 0 }

export function newTape(agents: Record<string, AgentCard>, tasks: TaskItem[], at: number): Tape {
  return { startedAt: at, agents, tasks, events: [] }
}

export function record(tape: Tape | null, event: TapeEvent): Tape | null {
  if (!tape) return null
  return { ...tape, events: [...tape.events, event].slice(-TAPE_LIMIT) }
}

export function tapeDuration(tape: Tape): number {
  const last = tape.events[tape.events.length - 1]?.t ?? tape.startedAt
  return Math.max(1000, (tape.endedAt ?? last) - tape.startedAt)
}

/** The speed that brings the task down to about 45 s. */
export function autoSpeed(durationMs: number): number {
  const wanted = durationMs / TARGET_MS
  return SPEEDS.find(s => s >= wanted) ?? SPEEDS[SPEEDS.length - 1]!
}

export function nextSpeed(speed: number): number {
  const i = SPEEDS.findIndex(s => s === speed)
  return SPEEDS[(i + 1) % SPEEDS.length]!
}

/** Where the playback stands now, in task time (ms since the task started). */
export function replayPosition(replay: Replay, now: number): number {
  return replay.isPlaying ? replay.offsetMs + (now - replay.wallStart) * replay.speed : replay.offsetMs
}

/** The pane's state as it was `atMs` into the task. */
export function stateAt(tape: Tape, atMs: number) {
  const until = tape.startedAt + atMs
  const agents: Record<string, AgentCard> = { ...tape.agents }
  let tasks = tape.tasks
  const feed: FeedItem[] = []
  for (const e of tape.events) {
    if (e.t > until) break
    if (e.kind === 'agent') agents[e.card.id] = e.card
    else if (e.kind === 'tasks') tasks = e.tasks
    else if (e.kind === 'feed') feed.push(e.item)
    else {
      const i = feed.findIndex(f => f.id === e.id)
      if (i >= 0) feed[i] = { ...feed[i]!, isDone: true }
    }
  }
  // A card's clock runs on task time while it is replayed, so its timer reads as it did.
  const replayed: Record<string, AgentCard> = {}
  for (const [k, a] of Object.entries(agents)) {
    replayed[k] = a.status === 'running' && a.endedAt === undefined ? { ...a, endedAt: until } : a
  }
  return { agents: replayed, tasks, feed }
}

export function fmtClockMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

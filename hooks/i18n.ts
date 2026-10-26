// Every word Agent Radar shows, in French, English and Dutch.

export type Lang = 'fr' | 'en' | 'nl'

export const LANGS: readonly Lang[] = ['fr', 'en', 'nl']

export type Strings = {
  decimal: string
  eur: (amount: string) => string
  // plain-language actions
  aFile: string
  aPage: string
  readFile: (f: string) => string
  writeFile: (f: string) => string
  editFile: (f: string) => string
  editNotebook: (f: string) => string
  grep: (p: string) => string
  glob: (p: string) => string
  bashDesc: (d: string) => string
  bash: string
  webSearch: (q: string) => string
  webFetch: (h: string) => string
  plan: (s: string) => string
  planUpdate: string
  taskDone: string
  taskUpdate: string
  taskList: string
  skill: (s: string) => string
  toolSearch: string
  ask: string
  sendMsg: string
  sendFile: string
  artifact: string
  mcp: (server: string, action: string) => string
  tool: (name: string) => string
  // agent states
  running: string
  done: string
  error: string
  idle: string
  mainLabel: string
  mainDesc: string
  waitingRequest: string
  readsRequest: string
  readsMission: string
  starting: string
  analyzing: string
  coordinates: (n: number) => string
  delegates: (label: string, desc: string) => string
  answered: string
  interrupted: string
  missionDone: string
  waitsSubs: (n: number) => string
  gathers: string
  // banner
  live: string
  pause: string
  mainWorking: (actions: number) => string
  withSubs: (subs: number, actions: number) => string
  waitingFirst: string
  paused: (actions: number) => string
  tokensApi: (tokens: string) => string
  altBanner: (isLive: boolean, tokens: string, eur: string) => string
  // progress
  progress: string
  tasks: (done: number, total: number, current?: string) => string
  liveProgress: (actions: number, subs: number) => string
  noTasks: string
  // agents
  agents: string
  activeCount: (active: number, total: number) => string
  others: (n: number) => string
  actions: (n: number) => string
  api: string
  viewMain: string
  viewSub: string
  viewDeny: (why: string) => string
  // memory and quota
  memoryQuota: string
  ctxPending: string
  ctxLabel: string
  ctxDetail: (used: string, window: string, isNearFull: boolean) => string
  quota5h: string
  quota7d: string
  spendLimit: string
  resetAt: (hhmm: string) => string
  resetOn: (ddmm: string) => string
  sessionCost: (eur: string) => string
  // recap
  recapTitle: string
  copyText: string
  exportImage: string
  copied: string
  copyUnavailable: string
  exportUnavailable: string
  exportStarted: string
  exportPrompt: (file: string) => string
  cardKicker: string
  cardFallback: string
  duration: string
  actionsWord: string
  tokensWord: string
  apiEquivalent: string
  agentsCount: (n: number) => string
  recapHeader: string
  recapLine: (duration: string, actions: number, tokens: string, eur: string) => string
  recapAgents: (list: string, n: number) => string
  recapAlone: string
  // feed and the rest
  feed: string
  feedEmpty: string
  starts: (desc: string) => string
  endedIn: (duration: string) => string
  wasInterrupted: string
  toastDone: (duration: string, actions: number, eur: string) => string
  reset: string
  commandDesc: string
  opened: string
}

const s = (n: number) => (n > 1 ? 's' : '')

const fr: Strings = {
  decimal: ',',
  eur: a => `≈ ${a} €`,
  aFile: 'un fichier',
  aPage: 'une page web',
  readFile: f => `Lit le fichier ${f}`,
  writeFile: f => `Écrit le fichier ${f}`,
  editFile: f => `Modifie ${f}`,
  editNotebook: f => `Modifie le notebook ${f}`,
  grep: p => `Cherche « ${p} » dans le code`,
  glob: p => `Liste les fichiers ${p}`,
  bashDesc: d => `Lance : ${d}`,
  bash: 'Lance une commande',
  webSearch: q => `Recherche sur le web : « ${q} »`,
  webFetch: h => `Lit la page ${h}`,
  plan: x => `Planifie : ${x}`,
  planUpdate: 'Met à jour son plan',
  taskDone: 'Coche une tâche terminée ✓',
  taskUpdate: 'Met à jour la progression',
  taskList: 'Relit la liste des tâches',
  skill: x => `Charge la compétence ${x}`,
  toolSearch: 'Cherche les bons outils',
  ask: 'Te pose une question',
  sendMsg: "T'envoie un message",
  sendFile: "T'envoie un fichier",
  artifact: 'Publie un artefact',
  mcp: (a, b) => `Utilise ${a} › ${b}`,
  tool: n => `Utilise l'outil ${n}`,
  running: 'en cours',
  done: 'terminé',
  error: 'interrompu',
  idle: 'en attente',
  mainLabel: 'Claude',
  mainDesc: 'Agent principal : comprend ta demande et coordonne',
  waitingRequest: 'En attente de ta demande',
  readsRequest: 'Lit ta demande et réfléchit',
  readsMission: 'Prend connaissance de sa mission',
  starting: 'Démarre…',
  analyzing: 'Analyse les résultats et décide de la suite',
  coordinates: n => `Coordonne ${n} sous-agents en parallèle`,
  delegates: (l, d) => `Délègue à ${l}${d ? ` : ${d}` : ''}`,
  answered: 'A répondu · en attente de ta prochaine demande',
  interrupted: 'Interrompu',
  missionDone: 'Mission terminée, rapport rendu',
  waitsSubs: n => `Attend ${n} sous-agent${s(n)}`,
  gathers: 'Rassemble les résultats des sous-agents',
  live: 'LIVE',
  pause: 'PAUSE',
  mainWorking: a => `Claude travaille · ${a} actions`,
  withSubs: (n, a) => `Claude + ${n} sous-agent${s(n)} actif${s(n)} · ${a} actions`,
  waitingFirst: 'En attente de ta première demande',
  paused: a => `En pause · ${a} actions au total`,
  tokensApi: t => `${t} tokens · équivalent API`,
  altBanner: (l, t, e) => `Agent Radar, ${l ? 'en direct' : 'en pause'}, ${t} tokens, ${e} en équivalent API`,
  progress: 'Progression',
  tasks: (d, t, c) => `${d}/${t} tâches${c ? ` · en cours : ${c}` : ''}`,
  liveProgress: (a, n) => `${a} actions · ${n > 0 ? `${n} sous-agent${s(n)} au travail` : 'Claude avance'}`,
  noTasks: 'Aucune tâche planifiée pour le moment',
  agents: 'Agents',
  activeCount: (a, t) => `${a} actif${s(a)} · ${t} au total`,
  others: n => `+ ${n} autre${s(n)} agent${s(n)}`,
  actions: n => `${n} action${s(n)}`,
  api: 'API',
  viewMain: 'Fil principal',
  viewSub: 'Voir son fil',
  viewDeny: w => `Impossible d'ouvrir ce fil ici : ${w}`,
  memoryQuota: 'Mémoire et quota',
  ctxPending: 'La jauge de contexte apparaît après la première réponse de Claude.',
  ctxLabel: 'Contexte de la conversation',
  ctxDetail: (u, w, f) => `${u} / ${w} tokens${f ? ' · bientôt plein : Claude va résumer la conversation' : ''}`,
  quota5h: 'Quota 5 h',
  quota7d: 'Quota 7 jours',
  spendLimit: 'Plafond de dépense',
  resetAt: h => `repart à ${h}`,
  resetOn: d => `repart le ${d}`,
  sessionCost: e => `Session entière selon Claude : ${e} en équivalent API (ton abonnement n'est pas facturé au token)`,
  recapTitle: 'Bilan de la dernière tâche',
  copyText: 'Copier le texte',
  exportImage: 'Exporter en image',
  copied: 'Bilan copié, prêt à coller dans ton post',
  copyUnavailable: "La copie n'est pas disponible ici",
  exportUnavailable: 'Export indisponible : dossier de travail inconnu',
  exportStarted: "Export lancé : Claude va t'envoyer l'image",
  exportPrompt: f =>
    `Agent Radar : convertis le fichier ${f} du dossier de travail en PNG 1200×630 et envoie-le-moi, sans autre commentaire.`,
  cardKicker: 'AGENT RADAR · BILAN',
  cardFallback: 'Tâche terminée',
  duration: 'durée',
  actionsWord: 'actions',
  tokensWord: 'tokens',
  apiEquivalent: 'équivalent API',
  agentsCount: n => `${n} agent${s(n)}`,
  recapHeader: '🛰️ Agent Radar : bilan de ma dernière tâche avec Claude',
  recapLine: (d, a, t, e) => `⏱ ${d} · ⚙️ ${a} actions · 🔢 ${t} tokens · 💶 ${e} en équivalent API`,
  recapAgents: (l, n) => `🤖 ${n} agents : ${l}`,
  recapAlone: '🤖 Claude a tout fait seul',
  feed: "Fil d'activité",
  feedEmpty: "Rien pour l'instant. Pose une question à Claude !",
  starts: d => (d ? `démarre : ${d}` : 'démarre'),
  endedIn: d => `a terminé en ${d}`,
  wasInterrupted: 'a été interrompu',
  toastDone: (d, a, e) => `✓ Tâche terminée en ${d} · ${a} actions · ${e} équiv. API`,
  reset: 'Remettre à zéro',
  commandDesc: 'Ouvre Agent Radar : agents, actions, progression et consommation en direct',
  opened: 'Agent Radar est ouvert.',
}

const en: Strings = {
  decimal: '.',
  eur: a => `≈ €${a}`,
  aFile: 'a file',
  aPage: 'a web page',
  readFile: f => `Reads ${f}`,
  writeFile: f => `Writes ${f}`,
  editFile: f => `Edits ${f}`,
  editNotebook: f => `Edits the notebook ${f}`,
  grep: p => `Searches the code for “${p}”`,
  glob: p => `Lists files ${p}`,
  bashDesc: d => `Runs: ${d}`,
  bash: 'Runs a command',
  webSearch: q => `Searches the web: “${q}”`,
  webFetch: h => `Reads the page ${h}`,
  plan: x => `Plans: ${x}`,
  planUpdate: 'Updates its plan',
  taskDone: 'Ticks off a finished task ✓',
  taskUpdate: 'Updates progress',
  taskList: 'Rereads the task list',
  skill: x => `Loads the skill ${x}`,
  toolSearch: 'Looks for the right tools',
  ask: 'Asks you a question',
  sendMsg: 'Sends you a message',
  sendFile: 'Sends you a file',
  artifact: 'Publishes an artifact',
  mcp: (a, b) => `Uses ${a} › ${b}`,
  tool: n => `Uses the ${n} tool`,
  running: 'working',
  done: 'done',
  error: 'interrupted',
  idle: 'waiting',
  mainLabel: 'Claude',
  mainDesc: 'Main agent: understands your request and coordinates',
  waitingRequest: 'Waiting for your request',
  readsRequest: 'Reads your request and thinks',
  readsMission: 'Reads its assignment',
  starting: 'Starting…',
  analyzing: 'Reviews the results and decides what next',
  coordinates: n => `Coordinates ${n} subagents in parallel`,
  delegates: (l, d) => `Delegates to ${l}${d ? `: ${d}` : ''}`,
  answered: 'Answered · waiting for your next request',
  interrupted: 'Interrupted',
  missionDone: 'Assignment done, report handed back',
  waitsSubs: n => `Waits for ${n} subagent${s(n)}`,
  gathers: "Gathers the subagents' results",
  live: 'LIVE',
  pause: 'PAUSED',
  mainWorking: a => `Claude is working · ${a} actions`,
  withSubs: (n, a) => `Claude + ${n} active subagent${s(n)} · ${a} actions`,
  waitingFirst: 'Waiting for your first request',
  paused: a => `Paused · ${a} actions in total`,
  tokensApi: t => `${t} tokens · API equivalent`,
  altBanner: (l, t, e) => `Agent Radar, ${l ? 'live' : 'paused'}, ${t} tokens, ${e} API equivalent`,
  progress: 'Progress',
  tasks: (d, t, c) => `${d}/${t} tasks${c ? ` · now: ${c}` : ''}`,
  liveProgress: (a, n) => `${a} actions · ${n > 0 ? `${n} subagent${s(n)} at work` : 'Claude is moving on'}`,
  noTasks: 'No tasks planned yet',
  agents: 'Agents',
  activeCount: (a, t) => `${a} active · ${t} in total`,
  others: n => `+ ${n} more agent${s(n)}`,
  actions: n => `${n} action${s(n)}`,
  api: 'API',
  viewMain: 'Main thread',
  viewSub: 'Open its thread',
  viewDeny: w => `Can't open this thread here: ${w}`,
  memoryQuota: 'Memory and quota',
  ctxPending: "The context gauge shows after Claude's first answer.",
  ctxLabel: 'Conversation context',
  ctxDetail: (u, w, f) => `${u} / ${w} tokens${f ? ' · nearly full: Claude will summarize the conversation' : ''}`,
  quota5h: '5-hour quota',
  quota7d: '7-day quota',
  spendLimit: 'Spend limit',
  resetAt: h => `resets at ${h}`,
  resetOn: d => `resets on ${d}`,
  sessionCost: e => `Whole session, as Claude counts it: ${e} API equivalent (your plan is not billed per token)`,
  recapTitle: 'Last task recap',
  copyText: 'Copy text',
  exportImage: 'Export image',
  copied: 'Recap copied, ready to paste in your post',
  copyUnavailable: "Copying isn't available here",
  exportUnavailable: 'Export unavailable: unknown working folder',
  exportStarted: 'Export started: Claude will send you the image',
  exportPrompt: f =>
    `Agent Radar: convert the file ${f} in the working folder to a 1200×630 PNG and send it to me, with no other comment.`,
  cardKicker: 'AGENT RADAR · RECAP',
  cardFallback: 'Task done',
  duration: 'duration',
  actionsWord: 'actions',
  tokensWord: 'tokens',
  apiEquivalent: 'API equivalent',
  agentsCount: n => `${n} agent${s(n)}`,
  recapHeader: '🛰️ Agent Radar: recap of my last task with Claude',
  recapLine: (d, a, t, e) => `⏱ ${d} · ⚙️ ${a} actions · 🔢 ${t} tokens · 💶 ${e} API equivalent`,
  recapAgents: (l, n) => `🤖 ${n} agents: ${l}`,
  recapAlone: '🤖 Claude did it all alone',
  feed: 'Activity',
  feedEmpty: 'Nothing yet. Ask Claude something!',
  starts: d => (d ? `starts: ${d}` : 'starts'),
  endedIn: d => `finished in ${d}`,
  wasInterrupted: 'was interrupted',
  toastDone: (d, a, e) => `✓ Task done in ${d} · ${a} actions · ${e} API eq.`,
  reset: 'Reset',
  commandDesc: 'Opens Agent Radar: agents, actions, progress and consumption, live',
  opened: 'Agent Radar is open.',
}

const nl: Strings = {
  decimal: ',',
  eur: a => `≈ € ${a}`,
  aFile: 'een bestand',
  aPage: 'een webpagina',
  readFile: f => `Leest ${f}`,
  writeFile: f => `Schrijft ${f}`,
  editFile: f => `Bewerkt ${f}`,
  editNotebook: f => `Bewerkt het notebook ${f}`,
  grep: p => `Zoekt „${p}” in de code`,
  glob: p => `Lijst bestanden ${p}`,
  bashDesc: d => `Voert uit: ${d}`,
  bash: 'Voert een commando uit',
  webSearch: q => `Zoekt op het web: „${q}”`,
  webFetch: h => `Leest de pagina ${h}`,
  plan: x => `Plant: ${x}`,
  planUpdate: 'Werkt zijn plan bij',
  taskDone: 'Vinkt een afgeronde taak af ✓',
  taskUpdate: 'Werkt de voortgang bij',
  taskList: 'Herleest de takenlijst',
  skill: x => `Laadt de vaardigheid ${x}`,
  toolSearch: 'Zoekt de juiste tools',
  ask: 'Stelt je een vraag',
  sendMsg: 'Stuurt je een bericht',
  sendFile: 'Stuurt je een bestand',
  artifact: 'Publiceert een artefact',
  mcp: (a, b) => `Gebruikt ${a} › ${b}`,
  tool: n => `Gebruikt de tool ${n}`,
  running: 'bezig',
  done: 'klaar',
  error: 'onderbroken',
  idle: 'wacht',
  mainLabel: 'Claude',
  mainDesc: 'Hoofdagent: begrijpt je vraag en coördineert',
  waitingRequest: 'Wacht op je vraag',
  readsRequest: 'Leest je vraag en denkt na',
  readsMission: 'Leest zijn opdracht',
  starting: 'Start…',
  analyzing: 'Bekijkt de resultaten en beslist wat volgt',
  coordinates: n => `Coördineert ${n} subagents tegelijk`,
  delegates: (l, d) => `Delegeert aan ${l}${d ? `: ${d}` : ''}`,
  answered: 'Heeft geantwoord · wacht op je volgende vraag',
  interrupted: 'Onderbroken',
  missionDone: 'Opdracht klaar, verslag afgeleverd',
  waitsSubs: n => `Wacht op ${n} subagent${n > 1 ? 's' : ''}`,
  gathers: 'Verzamelt de resultaten van de subagents',
  live: 'LIVE',
  pause: 'PAUZE',
  mainWorking: a => `Claude werkt · ${a} acties`,
  withSubs: (n, a) => `Claude + ${n} actieve subagent${n > 1 ? 's' : ''} · ${a} acties`,
  waitingFirst: 'Wacht op je eerste vraag',
  paused: a => `Gepauzeerd · ${a} acties in totaal`,
  tokensApi: t => `${t} tokens · API-equivalent`,
  altBanner: (l, t, e) => `Agent Radar, ${l ? 'live' : 'gepauzeerd'}, ${t} tokens, ${e} API-equivalent`,
  progress: 'Voortgang',
  tasks: (d, t, c) => `${d}/${t} taken${c ? ` · bezig: ${c}` : ''}`,
  liveProgress: (a, n) => `${a} acties · ${n > 0 ? `${n} subagent${n > 1 ? 's' : ''} aan het werk` : 'Claude gaat verder'}`,
  noTasks: 'Nog geen taken gepland',
  agents: 'Agents',
  activeCount: (a, t) => `${a} actief · ${t} in totaal`,
  others: n => `+ ${n} andere agent${n > 1 ? 's' : ''}`,
  actions: n => `${n} actie${n > 1 ? 's' : ''}`,
  api: 'API',
  viewMain: 'Hoofdthread',
  viewSub: 'Thread openen',
  viewDeny: w => `Kan deze thread hier niet openen: ${w}`,
  memoryQuota: 'Geheugen en quota',
  ctxPending: 'De contextmeter verschijnt na het eerste antwoord van Claude.',
  ctxLabel: 'Context van het gesprek',
  ctxDetail: (u, w, f) => `${u} / ${w} tokens${f ? ' · bijna vol: Claude gaat het gesprek samenvatten' : ''}`,
  quota5h: 'Quota 5 u',
  quota7d: 'Quota 7 dagen',
  spendLimit: 'Uitgavenlimiet',
  resetAt: h => `opnieuw om ${h}`,
  resetOn: d => `opnieuw op ${d}`,
  sessionCost: e => `Hele sessie volgens Claude: ${e} API-equivalent (je abonnement wordt niet per token gefactureerd)`,
  recapTitle: 'Samenvatting van de laatste taak',
  copyText: 'Tekst kopiëren',
  exportImage: 'Als afbeelding exporteren',
  copied: 'Samenvatting gekopieerd, klaar om te plakken',
  copyUnavailable: 'Kopiëren kan hier niet',
  exportUnavailable: 'Exporteren kan niet: werkmap onbekend',
  exportStarted: 'Export gestart: Claude stuurt je de afbeelding',
  exportPrompt: f =>
    `Agent Radar: zet het bestand ${f} in de werkmap om naar een PNG van 1200×630 en stuur het me, zonder verdere uitleg.`,
  cardKicker: 'AGENT RADAR · SAMENVATTING',
  cardFallback: 'Taak klaar',
  duration: 'duur',
  actionsWord: 'acties',
  tokensWord: 'tokens',
  apiEquivalent: 'API-equivalent',
  agentsCount: n => `${n} agent${n > 1 ? 's' : ''}`,
  recapHeader: '🛰️ Agent Radar: samenvatting van mijn laatste taak met Claude',
  recapLine: (d, a, t, e) => `⏱ ${d} · ⚙️ ${a} acties · 🔢 ${t} tokens · 💶 ${e} API-equivalent`,
  recapAgents: (l, n) => `🤖 ${n} agents: ${l}`,
  recapAlone: '🤖 Claude deed alles alleen',
  feed: 'Activiteit',
  feedEmpty: 'Nog niets. Stel Claude een vraag!',
  starts: d => (d ? `start: ${d}` : 'start'),
  endedIn: d => `klaar in ${d}`,
  wasInterrupted: 'werd onderbroken',
  toastDone: (d, a, e) => `✓ Taak klaar in ${d} · ${a} acties · ${e} API-eq.`,
  reset: 'Opnieuw beginnen',
  commandDesc: 'Opent Agent Radar: agents, acties, voortgang en verbruik, live',
  opened: 'Agent Radar is open.',
}

export const STRINGS: Record<Lang, Strings> = { fr, en, nl }

export function isLang(value: unknown): value is Lang {
  return value === 'fr' || value === 'en' || value === 'nl'
}

/** Maps a setting or locale value ("french", "fr_BE.UTF-8", "Nederlands") to a language. */
export function langFromName(value: unknown): Lang | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim().toLowerCase()
  if (v === '' || v === 'c' || v.startsWith('c.') || v === 'posix') return undefined
  if (/^(fr|french|français|francais)\b|^fr[_-]/.test(v)) return 'fr'
  if (/^(nl|dutch|nederlands|flemish|vlaams)\b|^nl[_-]/.test(v)) return 'nl'
  if (/^(en|english|anglais)\b|^en[_-]/.test(v)) return 'en'
  return undefined
}

const MARKERS: Record<Lang, readonly string[]> = {
  fr: ['le', 'la', 'les', 'des', 'est', 'une', 'pour', 'dans', 'avec', 'pas', 'que', 'qui', 'je', 'tu', 'fais', 'moi', 'ce', 'sur', 'et', 'du', 'mon', 'ton', 'peux', 'veux'],
  en: ['the', 'and', 'is', 'are', 'to', 'of', 'for', 'with', 'this', 'that', 'you', 'can', 'please', 'make', 'my', 'it', 'what', 'how', 'in', 'on', 'want', 'i'],
  nl: ['de', 'het', 'een', 'en', 'is', 'van', 'voor', 'met', 'niet', 'dat', 'die', 'ik', 'je', 'mijn', 'kan', 'wil', 'maak', 'wat', 'hoe', 'op', 'dit', 'graag'],
}

/** Guesses the language of a prompt by its small words; undefined when unsure. */
export function detectLang(text: string): Lang | undefined {
  const words = text.toLowerCase().match(/[a-zà-ÿ']+/g) ?? []
  if (words.length < 3) return undefined
  const score: Record<Lang, number> = { fr: 0, en: 0, nl: 0 }
  for (const w of words) {
    for (const l of LANGS) if (MARKERS[l].includes(w)) score[l] += 1
  }
  if (/[éèêàçù]/.test(text)) score.fr += 2
  const best = [...LANGS].sort((a, b) => score[b] - score[a])
  const [first, second] = best as [Lang, Lang, Lang]
  return score[first] >= 2 && score[first] > score[second] ? first : undefined
}

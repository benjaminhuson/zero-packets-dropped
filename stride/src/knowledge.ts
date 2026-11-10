// What Cancara knows about the journey. Built from the stage content, so it stays in step with the screens.
import { STAGES, type Step } from './stages';
import { LOCATIONS } from './locations';

interface Entry {
  title: string;
  text: string;
  stage?: number;
}

const STOP = new Set(['what', 'when', 'where', 'which', 'with', 'this', 'that', 'have', 'does', 'about', 'your', 'into', 'from', 'will', 'there', 'they', 'them', 'how', 'can', 'the', 'and', 'for', 'are', 'you', 'got', 'need', 'want', 'tell', 'me', 'is', 'it', 'to', 'do', 'my', 'a', 'an', 'of', 'in', 'on', 'at', 'be', 'or']);

const words = (s: string) => s.toLowerCase().match(/[a-z0-9@.]+/g) ?? [];

function stepText(step: Step): string {
  const parts = [step.body ?? '', ...(step.paragraphs ?? []), ...(step.sections ?? []).map((x) => `${x.title}. ${x.text}`)];
  for (const list of Object.values(step.guides ?? {})) for (const g of list ?? []) parts.push(`${g.title}. ${g.text}`);
  return parts.join(' ');
}

const ENTRIES: Entry[] = [];
for (const stage of STAGES) {
  ENTRIES.push({
    title: `Stage ${stage.id}: ${stage.name}`,
    text: `${stage.summary} Next stage unlocks when: ${stage.trigger.toLowerCase()}.`,
    stage: stage.id,
  });
  for (const step of stage.steps) {
    ENTRIES.push({ title: `${step.title} (Stage ${stage.id})`, text: stepText(step), stage: stage.id });
  }
}
for (const [key, loc] of Object.entries(LOCATIONS)) {
  ENTRIES.push({ title: `Working in ${loc.label}`, text: `${loc.address} ${loc.getThere} ${loc.firstDaySteps.map((r) => `${r.time}: ${r.text}`).join(' ')} Reception: ${loc.reception}.`, stage: 5 });
  void key;
}

// Returns the best matching journey answer, or null when nothing fits well enough.
export function findJourneyAnswer(question: string): { text: string; stage?: number } | null {
  // "What unlocks stage 3?" -> the trigger on the stage before it
  const stageNo = question.match(/stage\s*(\d)/i);
  if (stageNo && /unlock|open|next|get to|move/i.test(question)) {
    const n = parseInt(stageNo[1], 10);
    if (n >= 1 && n < STAGES.length) {
      return { text: `Stage ${n}: ${STAGES[n].name} unlocks when: ${STAGES[n - 1].trigger.toLowerCase()}.`, stage: n };
    }
  }
  // "What do I need to do in stage 1?" -> that stage's steps and its unlock rule
  if (stageNo && /need|do|steps|what.*stage/i.test(question)) {
    const n = parseInt(stageNo[1], 10);
    const stage = STAGES[n];
    if (stage) {
      const todo = stage.steps.map((st) => st.title).join('; ');
      return { text: `Stage ${stage.id}: ${stage.name}. ${stage.summary} Steps: ${todo}. Next stage unlocks when: ${stage.trigger.toLowerCase()}.`, stage: stage.id };
    }
  }
  const qWords = [...new Set(words(question))].filter((w) => w.length > 2 && !STOP.has(w));
  if (qWords.length === 0) return null;
  let best: { entry: Entry; score: number } | null = null;
  for (const entry of ENTRIES) {
    const hay = new Set(words(`${entry.text}`));
    const titleHay = new Set(words(entry.title));
    // A match in the title (e.g. "London", "device") counts double
    const score = qWords.reduce((n, w) => n + (hay.has(w) ? 1 : 0) + (titleHay.has(w) ? 3 : 0), 0);
    if (!best || score > best.score) best = { entry, score };
  }
  if (!best || best.score < 3) return null;
  const where = best.entry.stage !== undefined ? ` (Stage ${best.entry.stage})` : '';
  return { text: `${best.entry.title}: ${best.entry.text}${where}`, stage: best.entry.stage };
}

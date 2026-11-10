// Cancara, the AI buddy.
// Prototype: a rule-based responder so the flows can be tested end to end. Replace `answer`
// with a call to the approved AI service once it is connected.

export type ChatMessage = {
  id: string;
  from: 'you' | 'cancara';
  text: string;
  sentAt: string;
  // Set on Cancara replies that could not be answered from Stride content
  escalate?: boolean;
  // A button Cancara offers, e.g. booking a check-in at the end of a stage
  action?: { kind: 'checkin'; stage: number; slots?: { date: string; time: string; label: string }[] };
};

// Things the line manager needs to do in each week, sent to them in Teams
const MANAGER_ACTIONS: Record<number, string> = {
  1: 'Agree your first objectives with the new starter and check they have booked coffees with the team',
  2: 'Check the induction e-learning is on track',
  5: 'Hold the Day 30 check-in. The agenda is in Stride',
  9: 'Ask for Day 60 feedback from the new starter',
  13: 'Run the Day 90 review and agree next steps',
};

export function managerActionFor(week: number): string | null {
  return MANAGER_ACTIONS[week] ?? null;
}

// Keyword-based answers that cover the common new-starter questions
const RULES: { words: string[]; reply: string; escalate?: boolean }[] = [
  {
    words: ['values', 'value'],
    reply: 'Our five values are People-first, Bold, Inclusive, Sustainable and Trust. Tap each icon on the Our values page to read what it means in practice.',
  },
  {
    words: ['purpose', 'prosper'],
    reply: 'Our purpose is to help Britain prosper. It is the reason behind most of the decisions we make.',
  },
  {
    words: ['laptop', 'mfa', 'login', 'password', 'access'],
    reply: 'For laptop and login issues, use the IT self-service portal. If you are still stuck, your manager can help you raise it.',
    escalate: true,
  },
  {
    words: ['holiday', 'leave', 'annual'],
    reply: 'Holiday is booked through the leave portal. Your manager approves it, so it is worth talking it through at your next check-in.',
    escalate: true,
  },
  {
    words: ['pay', 'salary', 'payslip', 'benefits'],
    reply: 'Pay and benefits questions are best answered by HR. I can pass your question to your manager on Teams so they can point you in the right direction.',
    escalate: true,
  },
  {
    words: ['buddy', 'ben', 'who'],
    reply: 'Your buddy is your first port of call for anything that feels unclear. You can also see everyone you will work with on the Our team page.',
  },
  {
    words: ['next', 'week', 'today', 'do'],
    reply: null as unknown as string, // filled in from the current page below
  },
];

export function answer(question: string, currentWeek: number, currentTitle: string): { text: string; escalate: boolean } {
  const q = question.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => new RegExp(`\\b${w}\\b`).test(q))) {
      if (rule.reply === null) {
        const label = currentWeek === 0 ? 'Offer day' : `Week ${currentWeek}`;
        return {
          text: `You are on ${label}: ${currentTitle}. The next step is in the timeline below. Each page has a few tasks, and you can tick them off on the page or in your checklist.`,
          escalate: false,
        };
      }
      return { text: rule.reply, escalate: !!rule.escalate };
    }
  }
  return {
    text: `I am not sure about that one. I can pass it to your manager on Teams so they can reply. Would you like me to?`,
    escalate: true,
  };
}

export function nextManagerActions(fromWeek: number, toWeek: number): string[] {
  const out: string[] = [];
  for (let w = fromWeek; w <= toWeek; w++) {
    const a = managerActionFor(w);
    if (a) out.push(`Week ${w}: ${a}`);
  }
  return out;
}


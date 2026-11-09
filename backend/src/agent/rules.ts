// Section 4: Cancara, rule-based responder. Used until the approved AI service is connected.
import type { AgentGateway } from '../contracts.js';
import { MANAGER_NAME } from '../content/journey.js';

const RULES: { words: string[]; reply: string; escalate?: boolean }[] = [
  { words: ['values', 'value'], reply: 'Our five values are People-first, Bold, Inclusive, Sustainable and Trust. Tap each icon on the Our values page to read what it means in practice.' },
  { words: ['purpose', 'prosper'], reply: 'Our purpose is to help Britain prosper. It is the reason behind most of the decisions we make.' },
  { words: ['laptop', 'mfa', 'login', 'password', 'access'], reply: 'For laptop and login issues, use the IT self-service portal. If you are still stuck, your line manager can help you raise it.', escalate: true },
  { words: ['holiday', 'leave', 'annual'], reply: 'Holiday is booked through the leave portal. Your line manager approves it, so it is worth talking it through at your next check-in.', escalate: true },
  { words: ['pay', 'salary', 'payslip', 'benefits'], reply: 'Pay and benefits questions are best answered by HR. I can pass your question to your line manager on Teams.', escalate: true },
  { words: ['buddy', 'who'], reply: 'Your human buddy is your first port of call for anything that feels unclear. You can see everyone you will work with on the Our team page.' },
];

export class RulesAgent implements AgentGateway {
  async answer(question: string, context: { week: number; pageTitle: string }) {
    const q = question.toLowerCase();
    for (const rule of RULES) {
      if (rule.words.some((w) => new RegExp(`\\b${w}\\b`).test(q))) {
        return { text: rule.reply, escalate: !!rule.escalate };
      }
    }
    if (/\b(next|today|do)\b/.test(q)) {
      const label = context.week === 0 ? 'Offer day' : `Week ${context.week}`;
      return { text: `You are on ${label}: ${context.pageTitle}. Each page has a few tasks you can tick off.`, escalate: false };
    }
    return { text: `I am not sure about that one. I can pass it to ${MANAGER_NAME.split(' ')[0]} on Teams. Would you like me to?`, escalate: true };
  }
}

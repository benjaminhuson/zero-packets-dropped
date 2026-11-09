// Section 4 (Azure): AI-backed Cancara. Not implemented yet.
// Plan: answer only from approved Stride content, refuse anything about pay or individual HR cases,
// and mark escalate=true when unsure. Keep the shared model quota small.
import type { AgentGateway } from '../contracts.js';

export class AiAgent implements AgentGateway {
  async answer(_question: string, _context: { week: number; pageTitle: string }): Promise<{ text: string; escalate: boolean }> {
    throw new Error('AiAgent is not implemented yet. Set AGENT=rules.');
  }
}

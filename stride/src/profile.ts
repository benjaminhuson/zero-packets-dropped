// Which demo scenario this session uses. Pick one with ?scenario=1 to 25 in the address bar.
// Without it, a scenario is chosen once per browser and kept, so a demo stays consistent.
import { SCENARIOS, type Scenario } from './mock/people';

function pickIndex(): number {
  const fromUrl = new URLSearchParams(window.location.search).get('scenario');
  const n = fromUrl ? parseInt(fromUrl, 10) : NaN;
  if (n >= 1 && n <= SCENARIOS.length) {
    localStorage.setItem('stride-scenario', String(n - 1));
    return n - 1;
  }
  const saved = parseInt(localStorage.getItem('stride-scenario') ?? '', 10);
  if (saved >= 0 && saved < SCENARIOS.length) return saved;
  const picked = Math.floor(Math.random() * SCENARIOS.length);
  localStorage.setItem('stride-scenario', String(picked));
  return picked;
}

const index = pickIndex();
export const scenarioNumber = index + 1;
export const scenario: Scenario = SCENARIOS[index];
export const managerFirstName = scenario.manager.name.split(' ')[0];

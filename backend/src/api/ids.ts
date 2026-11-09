// The checklist task ids the front end and the API agree on.
import { TASKS } from '../content/journey.js';

export const CHECKLIST_IDS = TASKS.map((t) => ({ id: t.id, group: t.group, manager: !!t.manager }));

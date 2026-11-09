// Section 5: scheduled job. Runs the idempotent catch-up for every user, so weekly reminders and
// overdue nudges still go out when nobody opens Stride. Schedule it daily (Azure: a timer trigger).
import type { JourneyService } from '../api/service.js';
import type { Store } from '../contracts.js';

export async function runCatchUp(store: Store, service: JourneyService): Promise<{ users: number; sent: number }> {
  const userIds = await store.listUserIds();
  let sent = 0;
  for (const userId of userIds) {
    try {
      const drafts = await service.catchUpCurrentWeek(userId);
      sent += drafts.length;
    } catch (err) {
      // One bad record must not stop the whole run. Log and carry on.
      console.error(`catch-up failed for ${userId}:`, err instanceof Error ? err.message : err);
    }
  }
  return { users: userIds.length, sent };
}

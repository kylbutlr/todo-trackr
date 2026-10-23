import { database } from "../netlify/functions/lib/database.js";
import { processTaskAlarm } from "../netlify/functions/lib/task-alarms.js";

export async function deliverDueAlarms(): Promise<number> {
  const rows = await database()`
    SELECT id, alarm_at FROM tasks
    WHERE deleted_at IS NULL AND status = 'open'
      AND alarm_at <= now() AND alarm_cleared_at IS NULL AND alarm_notified_at IS NULL
    ORDER BY alarm_at LIMIT 50
  `;
  let delivered = 0;
  for (const row of rows) {
    const alarmAt = row.alarm_at instanceof Date ? row.alarm_at.toISOString() : String(row.alarm_at);
    if (await processTaskAlarm(String(row.id), alarmAt)) delivered += 1;
  }
  return delivered;
}

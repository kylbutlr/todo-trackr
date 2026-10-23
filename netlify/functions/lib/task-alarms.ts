import { database } from "./database.js";
import { notifyTaskAlarm } from "./push-notifications.js";

type TaskAlarmRow = {
  id: string;
  title: string;
};

export async function processTaskAlarm(
  taskId: string,
  expectedAlarmAt: string,
  now = new Date(),
): Promise<boolean> {
  const sql = database();
  const alarms = await sql`
    UPDATE tasks
    SET
      alarm_notified_at = ${now.toISOString()},
      alarm_trigger_run_id = NULL,
      updated_at = now()
    WHERE id = ${taskId}
      AND deleted_at IS NULL
      AND status = 'open'
      AND alarm_at = ${expectedAlarmAt}
      AND alarm_at <= ${now.toISOString()}
      AND alarm_cleared_at IS NULL
      AND alarm_notified_at IS NULL
    RETURNING id, title
  ` as unknown as TaskAlarmRow[];

  if (!alarms[0]) return false;
  await notifyTaskAlarm(alarms[0]);
  return true;
}

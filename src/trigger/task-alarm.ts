import { task } from "@trigger.dev/sdk";

export type TaskAlarmPayload = {
  taskId: string;
  alarmAt: string;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const deliverTaskAlarm = task({
  id: "deliver-task-alarm",
  maxDuration: 30,
  run: async (payload: TaskAlarmPayload) => {
    const callbackBaseUrl = requiredEnvironment("TODO_TRACKR_TRIGGER_CALLBACK_URL").replace(/\/$/u, "");
    const ingestToken = requiredEnvironment("TODO_TRACKR_INGEST_TOKEN");
    const response = await fetch(`${callbackBaseUrl}/${encodeURIComponent(payload.taskId)}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ingestToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ alarmAt: payload.alarmAt }),
    });

    if (!response.ok) {
      throw new Error(`Todo Trackr alarm callback failed with HTTP ${response.status}.`);
    }

    return await response.json() as { delivered: boolean };
  },
});

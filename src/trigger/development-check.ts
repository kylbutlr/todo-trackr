import { logger, task } from "@trigger.dev/sdk";

type DevelopmentCheckPayload = {
  requestedBy: string;
};

export const todoTrackrDevelopmentCheck = task({
  id: "todo-trackr-development-check",
  maxDuration: 30,
  run: async (payload: DevelopmentCheckPayload, { ctx }) => {
    const checkedAt = new Date().toISOString();
    logger.info("Todo Trackr Trigger.dev development check completed", {
      requestedBy: payload.requestedBy,
      runId: ctx.run.id,
      checkedAt,
    });

    return { status: "ready", requestedBy: payload.requestedBy, checkedAt };
  },
});

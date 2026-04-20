import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { serializeQueues } from "../../queue/resolver";
import type { Session } from "../../types/config";
import type { FlowPanelContext } from "../context";

const jobsInputSchema = z.object({
  queueId: z.string(),
  state: z.enum(["active", "waiting", "completed", "failed", "delayed", "paused"]).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

const jobDetailSchema = z.object({
  queueId: z.string(),
  jobId: z.string(),
});

const queueOpSchema = z.object({
  queueId: z.string(),
});

const cleanSchema = z.object({
  queueId: z.string(),
  state: z.enum(["completed", "failed"]),
  olderThanMs: z.number().int().min(0).optional(),
});

function requireQueue(ctx: FlowPanelContext, queueId: string) {
  const q = ctx.queues?.[queueId];
  if (!q) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Queue "${queueId}" not found.`,
    });
  }
  return q;
}

export function createQueueProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  t: { procedure: any; router: (routes: any) => any },
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  authedProcedure: any,
) {
  return t.router({
    /** List configured queues with capabilities. */
    schema: authedProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }: { ctx: FlowPanelContext & { session: Session } }) => {
        if (!ctx.queues) return { queues: {} };
        return { queues: serializeQueues(ctx.queues) };
      }),

    /** Counts by state. */
    status: authedProcedure
      .input(queueOpSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof queueOpSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          return q.adapter.getStatus();
        },
      ),

    /** List jobs. */
    jobs: authedProcedure
      .input(jobsInputSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof jobsInputSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          return q.adapter.getJobs({
            state: input.state,
            limit: input.limit,
            offset: input.offset,
          });
        },
      ),

    /** Fetch a single job by id. */
    job: authedProcedure
      .input(jobDetailSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof jobDetailSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          const job = await q.adapter.getJob(input.jobId);
          if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
          return job;
        },
      ),

    /** Retry a failed job. */
    retry: authedProcedure
      .input(jobDetailSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof jobDetailSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          await q.adapter.retry(input.jobId);
          return { ok: true as const };
        },
      ),

    /** Remove a job. */
    remove: authedProcedure
      .input(jobDetailSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof jobDetailSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          await q.adapter.remove(input.jobId);
          return { ok: true as const };
        },
      ),

    pause: authedProcedure
      .input(queueOpSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof queueOpSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          if (!q.adapter.pause) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Queue does not support pause." });
          }
          await q.adapter.pause();
          return { ok: true as const };
        },
      ),

    resume: authedProcedure
      .input(queueOpSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof queueOpSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          if (!q.adapter.resume) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Queue does not support resume." });
          }
          await q.adapter.resume();
          return { ok: true as const };
        },
      ),

    drain: authedProcedure
      .input(queueOpSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof queueOpSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          if (!q.adapter.drain) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Queue does not support drain." });
          }
          await q.adapter.drain();
          return { ok: true as const };
        },
      ),

    clean: authedProcedure
      .input(cleanSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof cleanSchema>;
        }) => {
          const q = requireQueue(ctx, input.queueId);
          if (!q.adapter.clean) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Queue does not support clean." });
          }
          const removed = await q.adapter.clean(input.state, input.olderThanMs);
          return { removed };
        },
      ),
  });
}

import { z } from "zod";
import type { repositoryRead } from "../repository-read";

export type McpEnv = Parameters<typeof repositoryRead>[0];
export const repository = z
    .string()
    .regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/);
export const runId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const page = z.number().int().min(1).max(1000).default(1);
export const limit = z.number().int().min(1).max(30).default(10);
export const annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  };
export const writeAnnotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  };
export const environmentName = z
    .string()
    .min(1)
    .max(255)
    .refine((v) => v !== "." && v !== ".." && !/[\x00-\x1f]/.test(v));
export const variableName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,254}$/);

export function repositoryAllowed(env: McpEnv, repo: string): boolean {
  return (env.ORB_CI_REPOSITORIES ?? "").split(",").map(v => v.trim().toLowerCase()).includes(repo.toLowerCase());
}
export function reply(value: unknown, isError = false) {
  return { isError, content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

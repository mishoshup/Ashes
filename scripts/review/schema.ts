import { z } from "zod";

export const severitySchema = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof severitySchema>;

export const findingSchema = z.object({
  severity: severitySchema,
  ruleId: z.string().min(2).max(32),
  path: z.string().min(1).max(500),
  line: z.number().int().positive(),
  evidence: z.string().min(4).max(400),
  why: z.string().min(1).max(600),
  fix: z.string().min(1).max(600),
});
export type Finding = z.infer<typeof findingSchema>;

export const reviewResultSchema = z.object({
  verdict: z.enum(["approve", "request_changes", "needs_human"]),
  summary: z.string().min(1).max(1200),
  findings: z.array(findingSchema).max(40),
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;

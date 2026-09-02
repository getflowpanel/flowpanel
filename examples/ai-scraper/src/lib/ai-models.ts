/** One current model roster shared by the seed and the admin config. */
export interface AiModel {
  provider: "openai" | "anthropic" | "google";
  model: string;
  label: string;
}

export const AI_MODELS: readonly AiModel[] = [
  { provider: "openai", model: "gpt-5", label: "GPT-5" },
  { provider: "openai", model: "gpt-5-mini", label: "GPT-5 mini" },
  { provider: "anthropic", model: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { provider: "anthropic", model: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { provider: "google", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { provider: "google", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

const LABEL_BY_MODEL = new Map(AI_MODELS.map((m) => [m.model, m.label]));

/** Clean display name for a model slug, or the raw slug if it's unknown. */
export const modelLabel = (model: string | null | undefined): string =>
  model == null ? "—" : (LABEL_BY_MODEL.get(model) ?? model);

/** The lighter/cheaper tier from `AI_MODELS` — what the match-tagging pipeline uses. */
export const MATCH_MODELS = ["gpt-5-mini", "claude-haiku-4-5", "gemini-2.5-flash"] as const;

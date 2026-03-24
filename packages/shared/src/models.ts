/**
 * Centralized model definitions and reasoning configuration.
 *
 * All packages import model-related types and validation from here
 * to ensure consistent behavior across control plane, web UI, and Slack bot.
 *
 * All models route through OpenRouter as the single LLM provider.
 */

/**
 * Valid model names supported by the system.
 * All models use "openrouter/vendor/model" format.
 */
export const VALID_MODELS = [
  "openrouter/anthropic/claude-haiku-4-5",
  "openrouter/anthropic/claude-sonnet-4-5",
  "openrouter/anthropic/claude-sonnet-4-6",
  "openrouter/anthropic/claude-opus-4-5",
  "openrouter/anthropic/claude-opus-4-6",
  "openrouter/openai/gpt-5.2",
  "openrouter/openai/gpt-5.4",
  "openrouter/openai/gpt-5.2-codex",
  "openrouter/openai/gpt-5.3-codex",
  "openrouter/openai/gpt-5.3-codex-spark",
  "openrouter/google/gemini-3.1-pro",
  "openrouter/google/gemini-3.1-flash",
] as const;

export type ValidModel = (typeof VALID_MODELS)[number];

/**
 * Default model to use when none specified or invalid.
 */
export const DEFAULT_MODEL: ValidModel = "openrouter/anthropic/claude-sonnet-4-6";

/**
 * Reasoning effort levels supported across providers.
 *
 * - "none": No reasoning (OpenAI only)
 * - "low"/"medium"/"high"/"xhigh": Progressive reasoning depth
 * - "max": Maximum reasoning budget (Anthropic extended thinking)
 */
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelReasoningConfig {
  efforts: ReasoningEffort[];
  default: ReasoningEffort | undefined;
}

/**
 * Per-model reasoning configuration.
 * Models not listed here do not support reasoning controls.
 */
export const MODEL_REASONING_CONFIG: Partial<Record<ValidModel, ModelReasoningConfig>> = {
  "openrouter/anthropic/claude-haiku-4-5": { efforts: ["high", "max"], default: "max" },
  "openrouter/anthropic/claude-sonnet-4-5": { efforts: ["high", "max"], default: "max" },
  "openrouter/anthropic/claude-sonnet-4-6": { efforts: ["low", "medium", "high", "max"], default: "high" },
  "openrouter/anthropic/claude-opus-4-5": { efforts: ["high", "max"], default: "max" },
  "openrouter/anthropic/claude-opus-4-6": { efforts: ["low", "medium", "high", "max"], default: "high" },
  "openrouter/openai/gpt-5.2": { efforts: ["none", "low", "medium", "high", "xhigh"], default: undefined },
  "openrouter/openai/gpt-5.4": { efforts: ["none", "low", "medium", "high", "xhigh"], default: undefined },
  "openrouter/openai/gpt-5.2-codex": { efforts: ["low", "medium", "high", "xhigh"], default: "high" },
  "openrouter/openai/gpt-5.3-codex": { efforts: ["low", "medium", "high", "xhigh"], default: "high" },
  "openrouter/openai/gpt-5.3-codex-spark": { efforts: ["low", "medium", "high", "xhigh"], default: "high" },
};

export interface ModelDisplayInfo {
  id: ValidModel;
  name: string;
  description: string;
}

export interface ModelCategory {
  category: string;
  models: ModelDisplayInfo[];
}

/**
 * Model options grouped by vendor, for use in UI dropdowns.
 */
export const MODEL_OPTIONS: ModelCategory[] = [
  {
    category: "Anthropic",
    models: [
      {
        id: "openrouter/anthropic/claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        description: "Fast and efficient",
      },
      {
        id: "openrouter/anthropic/claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        description: "Balanced performance",
      },
      {
        id: "openrouter/anthropic/claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        description: "Latest balanced, fast coding",
      },
      {
        id: "openrouter/anthropic/claude-opus-4-5",
        name: "Claude Opus 4.5",
        description: "Most capable",
      },
      {
        id: "openrouter/anthropic/claude-opus-4-6",
        name: "Claude Opus 4.6",
        description: "Latest, most capable",
      },
    ],
  },
  {
    category: "OpenAI",
    models: [
      { id: "openrouter/openai/gpt-5.2", name: "GPT 5.2", description: "400K context, fast" },
      { id: "openrouter/openai/gpt-5.4", name: "GPT 5.4", description: "Latest flagship model" },
      { id: "openrouter/openai/gpt-5.2-codex", name: "GPT 5.2 Codex", description: "Optimized for code" },
      { id: "openrouter/openai/gpt-5.3-codex", name: "GPT 5.3 Codex", description: "Latest codex" },
      {
        id: "openrouter/openai/gpt-5.3-codex-spark",
        name: "GPT 5.3 Codex Spark",
        description: "Low-latency codex variant",
      },
    ],
  },
  {
    category: "Google",
    models: [
      {
        id: "openrouter/google/gemini-3.1-pro",
        name: "Gemini 3.1 Pro",
        description: "Google flagship",
      },
      {
        id: "openrouter/google/gemini-3.1-flash",
        name: "Gemini 3.1 Flash",
        description: "Google fast",
      },
    ],
  },
];

/**
 * Models enabled by default when no preferences are stored.
 */
export const DEFAULT_ENABLED_MODELS: ValidModel[] = [
  "openrouter/anthropic/claude-haiku-4-5",
  "openrouter/anthropic/claude-sonnet-4-5",
  "openrouter/anthropic/claude-sonnet-4-6",
  "openrouter/anthropic/claude-opus-4-5",
  "openrouter/anthropic/claude-opus-4-6",
  "openrouter/openai/gpt-5.2",
  "openrouter/openai/gpt-5.4",
  "openrouter/openai/gpt-5.2-codex",
  "openrouter/openai/gpt-5.3-codex",
  "openrouter/openai/gpt-5.3-codex-spark",
  "openrouter/google/gemini-3.1-pro",
  "openrouter/google/gemini-3.1-flash",
];

// === Normalization ===

/**
 * Normalize a model ID to canonical "provider/vendor/model" format.
 * Handles legacy bare Claude model names and old "anthropic/" or "openai/" prefixed formats
 * by routing them through OpenRouter.
 */
export function normalizeModelId(modelId: string): string {
  // Already an openrouter model
  if (modelId.startsWith("openrouter/")) return modelId;
  // Legacy "anthropic/model" -> "openrouter/anthropic/model"
  if (modelId.startsWith("anthropic/")) return `openrouter/${modelId}`;
  // Legacy "openai/model" -> "openrouter/openai/model"
  if (modelId.startsWith("openai/")) return `openrouter/${modelId}`;
  // Legacy bare "claude-xxx" -> "openrouter/anthropic/claude-xxx"
  if (modelId.startsWith("claude-")) return `openrouter/anthropic/${modelId}`;
  return modelId;
}

// === Validation helpers ===

/**
 * Check if a model name is valid.
 * Accepts legacy formats and normalizes them before checking.
 */
export function isValidModel(model: string): model is ValidModel {
  return VALID_MODELS.includes(normalizeModelId(model) as ValidModel);
}

/**
 * Check if a model supports reasoning controls.
 */
export function supportsReasoning(model: string): boolean {
  return getReasoningConfig(model) !== undefined;
}

/**
 * Get reasoning configuration for a model, or undefined if not supported.
 */
export function getReasoningConfig(model: string): ModelReasoningConfig | undefined {
  const normalized = normalizeModelId(model);
  if (!isValidModel(normalized)) return undefined;
  return MODEL_REASONING_CONFIG[normalized as ValidModel];
}

/**
 * Get the default reasoning effort for a model, or undefined if not supported.
 */
export function getDefaultReasoningEffort(model: string): ReasoningEffort | undefined {
  return getReasoningConfig(model)?.default;
}

/**
 * Check if a reasoning effort is valid for a given model.
 */
export function isValidReasoningEffort(model: string, effort: string): boolean {
  const config = getReasoningConfig(model);
  if (!config) return false;
  return config.efforts.includes(effort as ReasoningEffort);
}

/**
 * Extract provider and model from a model ID.
 *
 * Normalizes first, then splits on the first "/".
 * For OpenRouter models this yields provider="openrouter", model="vendor/model-name".
 *
 * @example
 * extractProviderAndModel("openrouter/anthropic/claude-sonnet-4-6") // { provider: "openrouter", model: "anthropic/claude-sonnet-4-6" }
 * extractProviderAndModel("claude-haiku-4-5") // { provider: "openrouter", model: "anthropic/claude-haiku-4-5" }
 */
export function extractProviderAndModel(modelId: string): { provider: string; model: string } {
  const normalized = normalizeModelId(modelId);
  if (normalized.includes("/")) {
    const [provider, ...modelParts] = normalized.split("/");
    return { provider, model: modelParts.join("/") };
  }
  // Fallback for truly unknown models
  return { provider: "openrouter", model: normalized };
}

/**
 * Get a valid model or fall back to default.
 * Accepts legacy formats; always returns canonical format.
 */
export function getValidModelOrDefault(model: string | undefined | null): ValidModel {
  if (model && isValidModel(model)) {
    return normalizeModelId(model) as ValidModel;
  }
  return DEFAULT_MODEL;
}

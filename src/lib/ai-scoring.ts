/**
 * Server-only, provider-agnostic AI rubric scoring.
 *
 * The assessment stores AI output as an advisory suggestion. A staff member
 * must accept or replace it with a human score before it is treated as a
 * reviewed answer. No candidate identity is sent to the model provider.
 */

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_RESPONSE_CHARS = 4_000;

export interface AiRubricResult {
  score: number;
  rationale: string;
  confidence: number;
  model: string;
}

export class AiScoringError extends Error {
  readonly code: "not_configured" | "provider_error" | "invalid_response";

  constructor(
    code: AiScoringError["code"],
    message: string,
  ) {
    super(message);
    this.name = "AiScoringError";
    this.code = code;
  }
}

function config() {
  const apiKey = process.env.AI_SCORING_API_KEY ?? process.env.OPENAI_API_KEY;
  const endpoint = process.env.AI_SCORING_API_URL ?? DEFAULT_ENDPOINT;
  const model = process.env.AI_SCORING_MODEL ?? DEFAULT_MODEL;
  return { apiKey, endpoint, model };
}

export function isAiScoringConfigured(): boolean {
  return Boolean(config().apiKey);
}

/**
 * Endpoints already known to reject `response_format`, keyed by
 * `endpoint|model`. Populated on first failure so later calls skip the
 * doomed structured-output attempt.
 */
const structuredOutputUnsupported = new Set<string>();

/**
 * True when a 400 body indicates the provider does not implement JSON mode
 * rather than indicating a genuinely bad request. Matched narrowly so real
 * 400s (bad model, bad auth, oversized payload) are still surfaced.
 */
function isStructuredOutputUnsupported(body: string): boolean {
  return /structured[-_ ]?outputs?|response_format|json_object|json_schema|does not support feature/i.test(
    body,
  );
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    // Some models prepend a short sentence. Try the first complete JSON object.
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }
    throw new AiScoringError("invalid_response", "The AI provider returned invalid JSON");
  }
}

function parseResult(content: string, model: string): AiRubricResult {
  const raw = extractJson(content);
  if (!raw || typeof raw !== "object") {
    throw new AiScoringError("invalid_response", "The AI response was not an object");
  }

  const value = raw as Record<string, unknown>;
  const numericScore = Number(value.score);
  const numericConfidence = Number(value.confidence);
  const rationale = typeof value.rationale === "string" ? value.rationale.trim() : "";

  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 4) {
    throw new AiScoringError("invalid_response", "AI score must be between 0 and 4");
  }
  if (!Number.isFinite(numericConfidence) || numericConfidence < 0 || numericConfidence > 1) {
    throw new AiScoringError("invalid_response", "AI confidence must be between 0 and 1");
  }
  if (!rationale) {
    throw new AiScoringError("invalid_response", "AI response did not include a rationale");
  }

  return {
    score: Math.round(numericScore * 100) / 100,
    rationale: rationale.slice(0, 2_000),
    confidence: Math.round(numericConfidence * 100) / 100,
    model,
  };
}

/**
 * Ask an OpenAI-compatible chat-completions endpoint for a rubric suggestion.
 * The caller supplies only the question, rubric and candidate response text.
 */
export async function suggestRubricScore(input: {
  question: string;
  section?: string;
  response: string;
}): Promise<AiRubricResult> {
  const { apiKey, endpoint, model } = config();
  if (!apiKey) {
    throw new AiScoringError(
      "not_configured",
      "AI scoring is not configured. Set AI_SCORING_API_KEY (or OPENAI_API_KEY) on the server.",
    );
  }

  const responseText = input.response.trim().slice(0, MAX_RESPONSE_CHARS);
  if (!responseText) {
    throw new AiScoringError("invalid_response", "There is no written response to score");
  }

  const system = [
    "You are an assessment scoring assistant for Africinnovate.",
    "Score the candidate response against the supplied 0-4 rubric.",
    "Assess only the evidence in the response; do not infer ability, identity or demographics.",
    "Return JSON only with: score (number 0-4), rationale (string under 80 words), confidence (number 0-1).",
    "Do not include markdown, commentary, or personal data.",
  ].join(" ");

  const user = [
    `Section: ${input.section ?? "Unknown"}`,
    `Question: ${input.question}`,
    `Candidate response: ${responseText}`,
    "Rubric: 0 = no relevant response; 1 = minimal/off-topic; 2 = partial; 3 = solid/mostly complete; 4 = excellent/well structured.",
  ].join("\n\n");

  const timeoutMs = Number(process.env.AI_SCORING_TIMEOUT_MS ?? 30_000);

  const callProvider = async (useStructuredOutput: boolean) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          // Many OpenAI-compatible providers do not implement
          // `response_format`. Omitting it makes the model fall back to
          // prose, which `extractJson` still parses (it strips ``` fences).
          ...(useStructuredOutput ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        return { ok: false as const, status: response.status, body: (await response.text()).slice(0, 500) };
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new AiScoringError("invalid_response", "AI provider returned no completion");
      }
      return { ok: true as const, content };
    } catch (error) {
      if (error instanceof AiScoringError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiScoringError("provider_error", "AI scoring timed out");
      }
      throw new AiScoringError(
        "provider_error",
        error instanceof Error ? error.message : "Could not reach the AI provider",
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  // Prefer JSON mode, but transparently retry without it when the provider
  // rejects the parameter, then remember that for subsequent calls so we do
  // not pay for a guaranteed 400 on every request.
  const cacheKey = `${endpoint}|${model}`;
  const attempts: boolean[] = structuredOutputUnsupported.has(cacheKey) ? [false] : [true, false];

  let lastFailure: { status: number; body: string } | null = null;
  for (const useStructuredOutput of attempts) {
    const result = await callProvider(useStructuredOutput);
    if (result.ok) return parseResult(result.content, model);

    lastFailure = result;
    if (result.status === 400 && isStructuredOutputUnsupported(result.body)) {
      structuredOutputUnsupported.add(cacheKey);
      continue;
    }
    break;
  }

  throw new AiScoringError(
    "provider_error",
    `AI provider returned ${lastFailure?.status ?? "?"}${lastFailure?.body ? `: ${lastFailure.body}` : ""}`,
  );
}

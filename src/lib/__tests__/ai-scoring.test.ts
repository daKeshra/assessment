import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestRubricScore } from "@/lib/ai-scoring";

const originalFetch = globalThis.fetch;
const originalKey = process.env.AI_SCORING_API_KEY;
const originalUrl = process.env.AI_SCORING_API_URL;
const originalModel = process.env.AI_SCORING_MODEL;

describe("suggestRubricScore", () => {
  beforeEach(() => {
    process.env.AI_SCORING_API_KEY = "test-key";
    process.env.AI_SCORING_API_URL = "https://provider.test/chat";
    process.env.AI_SCORING_MODEL = "test-model";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.AI_SCORING_API_KEY;
    else process.env.AI_SCORING_API_KEY = originalKey;
    if (originalUrl === undefined) delete process.env.AI_SCORING_API_URL;
    else process.env.AI_SCORING_API_URL = originalUrl;
    if (originalModel === undefined) delete process.env.AI_SCORING_MODEL;
    else process.env.AI_SCORING_MODEL = originalModel;
  });

  it("returns a validated suggestion from a JSON response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "```json\n{\"score\":3,\"rationale\":\"Clear and relevant.\",\"confidence\":0.82}\n```",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await suggestRubricScore({
      question: "How would you improve this workflow?",
      section: "F · Simulation",
      response: "Map the steps, automate the repetitive work and keep a review step.",
    });

    expect(result).toEqual({
      score: 3,
      rationale: "Clear and relevant.",
      confidence: 0.82,
      model: "test-model",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.test/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails clearly when the provider is not configured", async () => {
    delete process.env.AI_SCORING_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      suggestRubricScore({ question: "Question", response: "Answer" }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("rejects an out-of-range provider score", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"score":8,"rationale":"Too high","confidence":0.5}',
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      suggestRubricScore({ question: "Question", response: "Answer" }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

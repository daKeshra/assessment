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

  describe("providers without structured-output support", () => {
    const unsupportedBody = JSON.stringify({
      error: {
        message: "Provider returned error",
        code: 400,
        metadata: {
          raw:
            '{"code":400,"reason":"INVALID_REQUEST_BODY","message":"model: test-model does not support feature: structured-outputs"}',
        },
      },
    });

    it("retries without response_format when the provider rejects it", async () => {
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        if ("response_format" in body) {
          return new Response(unsupportedBody, { status: 400 });
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '```json\n{"score":3,"rationale":"Workable plan.","confidence":0.7}\n```',
                },
              },
            ],
          }),
          { status: 200 },
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await suggestRubricScore({
        question: "How would you organise this?",
        response: "Keep a register and review it weekly.",
      });

      expect(result.score).toBe(3);
      expect(result.rationale).toBe("Workable plan.");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
      const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as Record<string, unknown>;
      expect(firstBody).toHaveProperty("response_format");
      expect(secondBody).not.toHaveProperty("response_format");
    });

    it("remembers the unsupported provider and skips the doomed retry", async () => {
      // A distinct endpoint/model gives this test its own cache entry, which
      // also proves the memo is keyed per provider rather than global.
      process.env.AI_SCORING_API_URL = "https://other-provider.test/chat";
      process.env.AI_SCORING_MODEL = "other-model";

      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        if ("response_format" in body) {
          return new Response(unsupportedBody, { status: 400 });
        }
        return new Response(
          JSON.stringify({
            choices: [
              { message: { content: '{"score":2,"rationale":"Partial.","confidence":0.6}' } },
            ],
          }),
          { status: 200 },
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const input = { question: "Q", response: "Some written answer." };
      await suggestRubricScore(input);
      expect(fetchMock).toHaveBeenCalledTimes(2); // 400 + retry

      fetchMock.mockClear();
      await suggestRubricScore(input);
      expect(fetchMock).toHaveBeenCalledTimes(1); // cached: no doomed attempt

      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
      expect(body).not.toHaveProperty("response_format");
    });

    it("does not retry on unrelated 400 errors", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "Invalid model" } }), { status: 400 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        suggestRubricScore({ question: "Q", response: "Some written answer." }),
      ).rejects.toMatchObject({ code: "provider_error" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

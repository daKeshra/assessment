import { HttpError } from "@/lib/api";

export function validateAnswers(
  type: string,
  options: { text: string; isCorrect: boolean; score: number }[],
  orderingItemCount = 0,
): void {
  if (type === "ORDERING") {
    if (orderingItemCount < 2) {
      throw new HttpError(400, "Ordering questions need at least two items");
    }
    if (options.length > 0) {
      throw new HttpError(400, "Ordering questions cannot use answer options");
    }
    return;
  }
  if (type === "OPEN_ENDED") {
    if (options.length > 0) {
      throw new HttpError(400, "Open-ended questions cannot use answer options");
    }
    return;
  }
  if (type === "LIKERT") {
    if (options.length !== 5) {
      throw new HttpError(400, "Likert questions need exactly 5 options");
    }
    if (options.some((o) => o.score < 1 || o.score > 5)) {
      throw new HttpError(400, "Likert option scores must be between 1 and 5");
    }
  }
  if (type === "MULTIPLE_CHOICE" || type === "VISUAL") {
    if (options.filter((o) => o.isCorrect).length !== 1) {
      throw new HttpError(
        400,
        "Multiple choice and visual questions need exactly one correct answer",
      );
    }
  }
  if (type === "MULTIPLE_SELECT" && options.filter((o) => o.isCorrect).length < 2) {
    throw new HttpError(400, "Multiple select questions need at least two correct answers");
  }
  if (type === "SCENARIO") {
    if (options.length < 2) {
      throw new HttpError(400, "Scenario questions need at least two options");
    }
    if (options.some((o) => o.score < 0 || o.score > 4)) {
      throw new HttpError(400, "Scenario option scores must be between 0 and 4");
    }
    if (options.filter((o) => o.score === 4).length !== 1) {
      throw new HttpError(400, "Scenario questions need exactly one option scored 4");
    }
  }
}

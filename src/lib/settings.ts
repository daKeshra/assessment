import { COMPONENTS, SETTING_KEYS, TIMER_MODES, type Component } from "@/lib/constants";
import { db } from "@/lib/db";
import type { RecommendationSettings, ScoringSettings } from "@/lib/types";

export interface SettingRow {
  key: string;
  value: string;
  group: string;
  label: string;
  type: string;
  options: string | null;
}

export type SettingsMap = Record<string, string>;

/** All settings as strings (fast, one query). */
export async function getAllSettings(): Promise<SettingsMap> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function numOf(map: SettingsMap, key: string, fallback: number): number {
  const raw = map[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function boolOf(map: SettingsMap, key: string, fallback: boolean): boolean {
  const raw = map[key];
  if (raw == null || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

export function scoringSettingsOf(map: SettingsMap): ScoringSettings {
  return {
    componentWeights: {
      [COMPONENTS.COGNITIVE]: numOf(map, SETTING_KEYS.W_COGNITIVE, 40),
      [COMPONENTS.SIMULATION]: numOf(map, SETTING_KEYS.W_SIMULATION, 30),
      [COMPONENTS.BEHAVIOUR]: numOf(map, SETTING_KEYS.W_BEHAVIOUR, 15),
      [COMPONENTS.INTEREST]: numOf(map, SETTING_KEYS.W_INTEREST, 10),
      [COMPONENTS.MOTIVATION]: numOf(map, SETTING_KEYS.W_MOTIVATION, 5),
    } as Record<Component, number>,
  };
}

export function recommendationSettingsOf(map: SettingsMap): RecommendationSettings {
  return {
    minScore: numOf(map, SETTING_KEYS.MIN_RECOMMEND_SCORE, 65),
    multiPathRange: numOf(map, SETTING_KEYS.MULTI_PATH_RANGE, 5),
    secondaryRange: numOf(map, SETTING_KEYS.SECONDARY_RANGE, 5),
    confidenceHighTop: numOf(map, SETTING_KEYS.CONF_HIGH_TOP, 80),
    confidenceHighGap: numOf(map, SETTING_KEYS.CONF_HIGH_GAP, 7),
    confidenceHighPractical: numOf(map, SETTING_KEYS.CONF_HIGH_PRACTICAL, 70),
    confidenceModerateGap: numOf(map, SETTING_KEYS.CONF_MODERATE_GAP, 3),
    minCompletenessHigh: numOf(map, SETTING_KEYS.MIN_COMPLETENESS_HIGH, 0.9),
    minCompletenessModerate: numOf(map, SETTING_KEYS.MIN_COMPLETENESS_MODERATE, 0.8),
  };
}

export function timerOf(map: SettingsMap): { mode: string; minutes: number } {
  const mode = map[SETTING_KEYS.TIMER_MODE] ?? TIMER_MODES.OVERALL;
  return { mode, minutes: numOf(map, SETTING_KEYS.DURATION_MINUTES, 60) };
}

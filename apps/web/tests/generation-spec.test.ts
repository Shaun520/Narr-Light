import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERATION_SPEC_CONFIG,
  buildGenerationSpec,
} from "@/lib/generation/spec";

describe("buildGenerationSpec", () => {
  it("scales structure and words for longer scripts", () => {
    const shortSpec = buildGenerationSpec({
      players: 6,
      duration: 3,
      genre: "hardcore",
      difficulty: "advanced",
    });
    const longSpec = buildGenerationSpec({
      players: 6,
      duration: 8,
      genre: "hardcore",
      difficulty: "advanced",
    });

    expect(longSpec.actCount).toBeGreaterThan(shortSpec.actCount);
    expect(longSpec.searchRoundCount).toBeGreaterThan(shortSpec.searchRoundCount);
    expect(longSpec.minClueCount).toBeGreaterThan(shortSpec.minClueCount);
    expect(longSpec.minCharacterScriptWords).toBeGreaterThan(
      shortSpec.minCharacterScriptWords,
    );
  });

  it("raises words for harder genres and difficulties", () => {
    const lightSpec = buildGenerationSpec({
      players: 6,
      duration: 5,
      genre: "funny",
      difficulty: "beginner",
    });
    const denseSpec = buildGenerationSpec({
      players: 6,
      duration: 5,
      genre: "hardcore",
      difficulty: "expert",
    });

    expect(denseSpec.minCharacterScriptWords).toBeGreaterThan(
      lightSpec.minCharacterScriptWords,
    );
  });

  it("uses admin supplied spec config", () => {
    const spec = buildGenerationSpec(
      {
        players: 6,
        duration: 8,
        genre: "hardcore",
        difficulty: "advanced",
      },
      {
        ...DEFAULT_GENERATION_SPEC_CONFIG,
        baseWordsPerHour: 10000,
        durationBands: [
          { minDuration: 2, maxDuration: 8, actCount: 8, searchRoundCount: 7 },
        ],
      },
    );

    expect(spec.actCount).toBe(8);
    expect(spec.searchRoundCount).toBe(7);
    expect(spec.minCharacterScriptWords).toBeGreaterThan(9000);
  });

  it("derives character script pieces from act count", () => {
    const spec = buildGenerationSpec(
      {
        players: 6,
        duration: 8,
        genre: "hardcore",
        difficulty: "advanced",
      },
      {
        ...DEFAULT_GENERATION_SPEC_CONFIG,
        characterScriptMode: "per_act",
      },
    );

    expect(spec.scriptsPerPlayer).toBe(spec.actCount);
    expect(spec.totalCharacterScriptCount).toBe(6 * spec.actCount);
    expect(spec.minWordsPerCharacterScriptPiece).toBeLessThan(spec.minCharacterScriptWords);
  });

  it("supports custom character script pieces per player", () => {
    const spec = buildGenerationSpec(
      {
        players: 5,
        duration: 5,
        genre: "emotion",
        difficulty: "intermediate",
      },
      {
        ...DEFAULT_GENERATION_SPEC_CONFIG,
        characterScriptMode: "custom",
        customScriptsPerPlayer: 3,
      },
    );

    expect(spec.scriptsPerPlayer).toBe(3);
    expect(spec.totalCharacterScriptCount).toBe(15);
  });
});

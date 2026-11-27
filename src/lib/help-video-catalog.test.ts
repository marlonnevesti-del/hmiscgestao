import { describe, expect, it } from "vitest";
import { HELP_SECTORS } from "./help-tutorials";
import { helpVideoSource } from "./help-video";

describe("vídeos narrados da Central de Ajuda", () => {
  it("oferece um vídeo reproduzível para cada um dos 12 setores sem substituir o conteúdo escrito", () => {
    expect(HELP_SECTORS).toHaveLength(12);
    for (const sector of HELP_SECTORS) {
      expect(sector.steps.length).toBeGreaterThan(0);
      expect(sector.video, sector.id).toBeDefined();
      expect(helpVideoSource(sector.video?.url ?? "")?.kind, sector.id).toBe("file");
      expect(sector.video?.url, sector.id).toMatch(/\.mp4$/);
    }
  });

  it("mantém capítulos ordenados e dentro da duração de cada vídeo", () => {
    for (const sector of HELP_SECTORS) {
      const video = sector.video;
      expect(video?.chapters?.length, sector.id).toBeGreaterThan(0);
      expect(video?.chapters?.[0]?.seconds, sector.id).toBe(0);
      const times = video?.chapters?.map((chapter) => chapter.seconds) ?? [];
      expect([...times].sort((a, b) => a - b), sector.id).toEqual(times);
      for (const seconds of times) {
        expect(seconds, sector.id).toBeGreaterThanOrEqual(0);
        expect(seconds, sector.id).toBeLessThan(video?.durationSeconds ?? 0);
      }
    }
  });
});

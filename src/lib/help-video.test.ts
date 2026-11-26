import { describe, expect, it } from "vitest";
import { helpVideoSource } from "./help-video";

describe("help video sources", () => {
  it("accepts same-origin MP4 files for the physical server", () => {
    expect(helpVideoSource("/tutoriais/recepcao.mp4")).toEqual({ kind: "file", url: "/tutoriais/recepcao.mp4", seekable: true });
  });
  it("converts a YouTube link with the selected chapter", () => {
    expect(helpVideoSource("https://youtu.be/abcdefghijk", 80)?.url).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?start=80");
  });
  it("converts Vimeo chapters", () => {
    expect(helpVideoSource("https://vimeo.com/123456", 120)?.url).toBe("https://player.vimeo.com/video/123456#t=120s");
  });
  it("does not promise chapter seeking on Drive", () => {
    expect(helpVideoSource("https://drive.google.com/file/d/example/view")?.seekable).toBe(false);
  });
  it("rejects executable, insecure and unrecognized embeds", () => {
    for (const url of ["javascript:alert(1)", "//external.test/file.mp4", "http://external.test/file.mp4", "https://external.test/embed/123", "https://youtube.com.evil.test/watch?v=abcdefghijk", "https://user:password@external.test/file.mp4"]) {
      expect(helpVideoSource(url)).toBeNull();
    }
  });
});
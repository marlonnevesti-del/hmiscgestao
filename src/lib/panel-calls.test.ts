import { describe, expect, it } from "vitest";
import { addRoomName, announcement, pushCall, removeRoomName } from "./panel-calls";
describe("painel de chamadas", () => {
  it("adiciona consultório novo e rejeita duplicado", () => {
    expect(addRoomName(["Consultório 01"], " Consultório  03 ")).toEqual(["Consultório 01", "Consultório 03"]);
    expect(() => addRoomName(["Consultório 01"], "consultório 01")).toThrow();
  });
  it("não remove o último local", () => { expect(() => removeRoomName(["Triagem"], "Triagem")).toThrow(); });
  it("anuncia nome e consultório", () => { expect(announcement({ patientName: "Maria Silva", room: "Consultório 01" })).toBe("Maria Silva, dirigir-se ao Consultório 01."); });
  it("mantém a chamada mais recente primeiro", () => {
    const c = (id: string) => ({ id, patientName: id, room: "T", at: "" });
    expect(pushCall([c("a")], c("b")).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

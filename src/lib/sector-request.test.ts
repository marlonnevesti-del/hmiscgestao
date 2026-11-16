import { describe, expect, it } from "vitest";
import { REQUEST_SECTORS, productArea } from "./sector-request";
describe("solicitação ao almoxarifado", () => {
  it("tem os 41 setores do anexo", () => { expect(REQUEST_SECTORS).toHaveLength(41); expect(REQUEST_SECTORS).toContain("UTI Ped"); });
  it("separa administrativo de assistencial", () => { expect(productArea("PAPEL A4 RESMA")).toBe("Administrativo"); expect(productArea("ACICLOVIR 250MG FA EV")).toBe("Assistencial"); });
});

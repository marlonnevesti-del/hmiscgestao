import { describe, expect, it } from "vitest";
import { DOCTOR_CATALOG, findDoctor, learnDoctor, mergeDoctors } from "./doctors";
describe("doctors", () => {
  it("imports all 633 HMISC professionals", () => expect(DOCTOR_CATALOG).toHaveLength(633));
  it("known doctor has CRM", () => expect(findDoctor(mergeDoctors([]), "larissa chaiane orth")?.crm).toBe("CRM/RS 48145"));
  it("learns CRM for a catalog doctor without one", () => {
    const l = learnDoctor([], "Maria Caroline Seraphim Mello", "CRM/SC 1234");
    expect(findDoctor(mergeDoctors(l), "MARIA CAROLINE SERAPHIM MELLO")?.crm).toBe("CRM/SC 1234");
  });
});

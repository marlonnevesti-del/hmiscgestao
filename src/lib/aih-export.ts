import { zipSync } from "fflate";
import { CNES } from "./institution";

/** Names observed in the supplied Salux package; content remains the DATASUS text interface. */
export function aihFileName(competence: string, cnes = CNES): string {
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(competence)) throw new Error("Competência AIH inválida.");
  const code = cnes.replace(/\D/g, "");
  if (code.length !== 7) throw new Error("CNES deve ter 7 dígitos.");
  return `${competence}AIH${code}.txt`;
}

/** Blob charset labels do not encode strings: create actual single-byte text. */
export function aihTextBytes(content: string): Uint8Array {
  const lines = content.split("\r\n");
  if (lines.at(-1) !== "") throw new Error("Remessa AIH deve terminar com CRLF.");
  for (const line of lines.slice(0, -1)) {
    if (line.length !== 1800) throw new Error("Registro AIH deve ter 1800 posições na interface texto.");
  }
  return Uint8Array.from(content, (char) => {
    const code = char.charCodeAt(0);
    if (code > 255) throw new Error("Caractere incompatível com a remessa AIH.");
    return code;
  });
}

export function aihZip(content: string, competence: string, cnes = CNES): Uint8Array {
  return zipSync({ [aihFileName(competence, cnes)]: aihTextBytes(content) });
}
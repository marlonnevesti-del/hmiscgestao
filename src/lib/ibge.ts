/** Preenchimento automático de endereço e código IBGE (ViaCEP + API de localidades do IBGE). */
export type CepAddress = { street: string; streetType: string; neighborhood: string; city: string; state: string; cityCode: string };

export const normalizeCity = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const TYPES = ["Rua", "Avenida", "Travessa", "Rodovia", "Estrada", "Servidão", "Alameda", "Praça", "Largo", "Beco"];
export function splitStreet(full: string): { streetType: string; street: string } {
  const t = TYPES.find((x) => normalizeCity(full).startsWith(normalizeCity(x) + " "));
  return t ? { streetType: t, street: full.slice(t.length).trim() } : { streetType: "", street: full };
}

export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await res.json();
    if (!res.ok || j.erro) return null;
    return { ...splitStreet(j.logradouro || ""), neighborhood: j.bairro || "", city: j.localidade || "", state: j.uf || "", cityCode: j.ibge || "" };
  } catch { return null; }
}

const cache = new Map<string, Array<{ id: number; nome: string }>>();
export async function lookupCityCode(state: string, city: string): Promise<string> {
  const uf = state.trim().toUpperCase();
  if (uf.length !== 2 || !city.trim()) return "";
  try {
    if (!cache.has(uf)) {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
      if (!res.ok) return "";
      cache.set(uf, await res.json());
    }
    const n = normalizeCity(city);
    return String(cache.get(uf)!.find((m) => normalizeCity(m.nome) === n)?.id ?? "");
  } catch { return ""; }
}

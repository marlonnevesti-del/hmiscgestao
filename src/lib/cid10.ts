export type CidSpecialty = 'obstetricia' | 'pediatria' | 'neonatologia' | 'geral';
export type Cid = { code: string; name: string; specialty: CidSpecialty; frequent?: boolean };
export const CID_SPECIALTIES: { id: CidSpecialty; label: string }[] = [
  { id: 'obstetricia', label: 'Obstetrícia' }, { id: 'pediatria', label: 'Pediatria' },
  { id: 'neonatologia', label: 'Neonatologia' }, { id: 'geral', label: 'Geral / Urgência' },
];
const raw: Array<[string, string, CidSpecialty] | [string, string, CidSpecialty, boolean]> = [
  ['O80', 'Parto único espontâneo', 'obstetricia', true], ['O82', 'Parto único por cesariana', 'obstetricia', true],
  ['O47', 'Falso trabalho de parto', 'obstetricia', true], ['O60', 'Trabalho de parto pré-termo', 'obstetricia', true],
  ['O14', 'Hipertensão gestacional com proteinúria (pré-eclâmpsia)', 'obstetricia', true], ['O13', 'Hipertensão gestacional sem proteinúria', 'obstetricia', true],
  ['O15', 'Eclâmpsia', 'obstetricia'], ['O20', 'Hemorragia do início da gravidez', 'obstetricia', true],
  ['O03', 'Aborto espontâneo', 'obstetricia'], ['O00', 'Gravidez ectópica', 'obstetricia'],
  ['O21', 'Vômitos excessivos na gravidez (hiperêmese)', 'obstetricia', true], ['O23', 'Infecção do trato geniturinário na gravidez', 'obstetricia', true],
  ['O24', 'Diabetes mellitus na gravidez', 'obstetricia'], ['O36', 'Assistência materna por problemas fetais', 'obstetricia'],
  ['O41', 'Anormalidades do líquido amniótico e membranas', 'obstetricia'], ['O42', 'Ruptura prematura de membranas', 'obstetricia', true],
  ['O44', 'Placenta prévia', 'obstetricia'], ['O45', 'Descolamento prematuro da placenta', 'obstetricia'],
  ['O48', 'Gravidez prolongada', 'obstetricia'], ['O68', 'Trabalho de parto com sofrimento fetal', 'obstetricia'],
  ['O72', 'Hemorragia pós-parto', 'obstetricia', true], ['O85', 'Infecção puerperal', 'obstetricia'],
  ['O91', 'Infecções mamárias associadas ao parto (mastite)', 'obstetricia'], ['Z34', 'Supervisão de gravidez normal', 'obstetricia', true],
  ['Z39', 'Assistência e exame pós-natal', 'obstetricia'],
  ['J21', 'Bronquiolite aguda', 'pediatria', true], ['J06', 'Infecção aguda das vias aéreas superiores', 'pediatria', true],
  ['J03', 'Amigdalite aguda', 'pediatria', true], ['J02', 'Faringite aguda', 'pediatria'], ['H66', 'Otite média supurativa', 'pediatria', true],
  ['J18', 'Pneumonia por microrganismo não especificado', 'pediatria', true], ['J45', 'Asma', 'pediatria', true],
  ['J20', 'Bronquite aguda', 'pediatria'], ['J05', 'Laringite obstrutiva aguda (crupe)', 'pediatria'],
  ['A09', 'Diarreia e gastroenterite de origem infecciosa presumível', 'pediatria', true], ['E86', 'Desidratação', 'pediatria', true],
  ['R50', 'Febre de origem desconhecida', 'pediatria', true], ['R56', 'Convulsões (inclui febril)', 'pediatria'],
  ['B34', 'Infecção viral de localização não especificada', 'pediatria', true], ['B01', 'Varicela', 'pediatria'],
  ['B08', 'Outras infecções virais com lesões de pele (mão-pé-boca)', 'pediatria'], ['A90', 'Dengue', 'pediatria'],
  ['N39', 'Infecção do trato urinário', 'pediatria'], ['L20', 'Dermatite atópica', 'pediatria'], ['T78', 'Reação alérgica', 'pediatria'],
  ['K59', 'Constipação', 'pediatria'], ['R11', 'Náusea e vômitos', 'pediatria'],
  ['P59', 'Icterícia neonatal', 'neonatologia', true], ['P22', 'Desconforto respiratório do recém-nascido', 'neonatologia', true],
  ['P07', 'Prematuridade / baixo peso ao nascer', 'neonatologia', true], ['P36', 'Sepse bacteriana do recém-nascido', 'neonatologia', true],
  ['P39', 'Outras infecções do período perinatal', 'neonatologia'], ['P21', 'Asfixia ao nascer', 'neonatologia'],
  ['P70', 'Distúrbios transitórios do metabolismo de carboidratos (hipoglicemia)', 'neonatologia', true],
  ['P92', 'Problemas de alimentação do recém-nascido', 'neonatologia'], ['P08', 'Recém-nascido pós-termo / grande para IG', 'neonatologia'],
  ['P05', 'Crescimento fetal retardado / pequeno para IG', 'neonatologia'], ['P38', 'Onfalite do recém-nascido', 'neonatologia'],
  ['P81', 'Distúrbios da regulação térmica do RN', 'neonatologia'], ['Z38', 'Nascido vivo', 'neonatologia', true],
  ['R10', 'Dor abdominal e pélvica', 'geral', true], ['R51', 'Cefaleia', 'geral', true], ['I10', 'Hipertensão essencial', 'geral'],
  ['E11', 'Diabetes mellitus tipo 2', 'geral'], ['R07', 'Dor de garganta e no peito', 'geral'], ['R06', 'Anormalidades da respiração (dispneia)', 'geral'],
  ['T14', 'Traumatismo de região não especificada', 'geral'], ['S09', 'Traumatismo da cabeça', 'geral'], ['T30', 'Queimadura', 'geral'],
  ['T65', 'Intoxicação', 'geral'], ['F41', 'Transtorno de ansiedade', 'geral'], ['D64', 'Anemia', 'geral'], ['Z00', 'Exame geral sem queixa', 'geral'],
];
export const CID10: Cid[] = raw.map((r) => ({ code: r[0], name: r[1], specialty: r[2], frequent: r[3] ?? false }));
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function searchCid(q: string, limit = 12): Cid[] {
  const n = norm(q); if (!n) return [];
  return CID10.filter((c) => norm(c.code).startsWith(n) || norm(c.name).includes(n))
    .sort((a, b) => Number(norm(b.code).startsWith(n)) - Number(norm(a.code).startsWith(n))).slice(0, limit);
}
export const defaultSpecialty = (type: string): CidSpecialty => type === 'gestante' ? 'obstetricia' : type === 'rn' ? 'neonatologia' : 'pediatria';

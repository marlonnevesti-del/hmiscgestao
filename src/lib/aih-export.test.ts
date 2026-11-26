import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { aihFileName, aihTextBytes, aihZip } from './aih-export';
import { aihFile, type SusRow } from './sus-billing';
import { DEFAULT_INSTITUTION } from './institution';

const row: SusRow = {
  encounter: { id: 'test', number: 'FIA-TESTE', patientId: 'test', openedAt: '2026-12-05T10:00:00Z', type: 'Pronto Socorro', specialty: '', complaint: '', history: [], status_fluxo: 'ALTA_HOSPITALAR' },
  kind: 'AIH', date: '2026-12-05', cns: '700000000000001', cpf: '', name: 'PACIENTE FICTICIO TESTE', birthDate: '1990-01-01', sex: 'F', motherName: 'MAE FICTICIA', cityCode: '420460', cid: 'J189', procedure: '0303140151', issues: [], aihNumber: '4226100123456', aihAuthorizedAt: '2026-12-05', exitReason: '12', births: [],
};
const prof = { name: 'MEDICO TESTE', cns: '708006369271128', cbo: '225125' };

describe('pacote AIH', () => {
  it('usa a nomenclatura AAAAMMAIH2594277.txt do Salux', () => {
    expect(aihFileName('202610')).toBe('202610AIH2594277.txt');
    expect(aihFileName('202612')).toBe('202612AIH2594277.txt');
    expect(() => aihFileName('202613')).toThrow();
  });
  it('ZIP contém um TXT de mesmo nome e mesmos bytes', () => {
    const content = aihFile([row], '202612', prof);
    const entries = unzipSync(aihZip(content, '202612'));
    expect(Object.keys(entries)).toEqual(['202612AIH2594277.txt']);
    expect(entries['202612AIH2594277.txt']).toEqual(aihTextBytes(content));
    expect(aihTextBytes(content).length).toBe(1802);
  });
  it('preserva competência e órgão emissor E420000012 observado no arquivo de referência', () => {
    const line = aihFile([row], '202612', prof);
    expect(line.slice(11, 17)).toBe('202612');
    expect(line.slice(20, 30)).toBe('E420000012');
    expect(line.slice(30, 37)).toBe('2594277');
    expect(aihFile([row], '202612', prof, { ...DEFAULT_INSTITUTION, orgaoEmissorAih: 'M420460001' }).slice(20, 30)).toBe('M420460001');
  });
  it('não mascara registros com largura errada', () => {
    expect(() => aihTextBytes('123\r\n')).toThrow();
  });
});
import { describe, expect, it } from 'vitest';
import { previewDoctorGrid, reviewedDoctors } from './doctor-import';
import { documentCns, mergeImportedDoctors, resolveDoctor } from './doctors';

const header = ['Nome', 'Conselho', 'Nº Conselho', 'UF', 'Especialidades', 'CNS', 'Equipe(s)'];
const row = ['Médica Teste', 'CRM', '1234', 'SC', 'Pediatria, Neonatologia', '700000000000005', 'Ambulatório'];
describe('importação de corpo clínico', () => {
  it('unifica o mesmo CRM/UF nas duas planilhas e preserva especialidades', () => {
    const a = previewDoctorGrid([header, row], 'SANITAS');
    const b = previewDoctorGrid([header, [...row.slice(0, 4), 'Pediatria, Cardiologia Pediátrica', row[5] ?? '', 'Obstetrícia']], 'TERRES');
    const doctors = reviewedDoctors([...a, ...b]);
    expect(doctors).toHaveLength(1);
    expect(doctors[0]?.specialty).toBe('Pediatria; Neonatologia; Cardiologia Pediátrica');
    expect(doctors[0]?.sources).toBe('SANITAS; TERRES');
  });
  it('não preenche CNS inválido ou ausente', () => {
    expect(documentCns({ name: 'Teste', cns: '123456789012345' })).toBe('');
    expect(documentCns({ name: 'Teste' })).toBe('');
  });
  it('não preenche CNS compartilhado por médicos diferentes', () => {
    const other = [...row]; other[0] = 'Outro médico'; other[2] = '5678';
    const doctors = reviewedDoctors(previewDoctorGrid([header, row, other], 'Teste'));
    expect(doctors).toHaveLength(2);
    expect(doctors.every((d) => d.cnsStatus === 'Conferir CNS repetido')).toBe(true);
    expect(doctors.map(documentCns)).toEqual(['', '']);
  });
  it('reimportar não duplica nem apaga um CNS já registrado', () => {
    const existing = [{ name: 'Teste', crm: 'CRM/SC 1234', cns: '700000000000005' }];
    const next = mergeImportedDoctors(existing, [{ name: 'Teste', crm: 'CRM/SC 1234', cns: '' }]);
    expect(next).toHaveLength(1); expect(next[0]?.cns).toBe(existing[0]?.cns);
  });
  it('identifica pelo CRM/UF sem vincular pelo nome parcial', () => {
    const doctors = [{ name: 'Maria Teste', crm: 'CRM/SC 1234' }, { name: 'Maria Teste', crm: 'CRM/RS 1234' }];
    expect(resolveDoctor(doctors, 'Maria', 'CRM/SC 1234')?.crm).toBe('CRM/SC 1234');
    expect(resolveDoctor(doctors, 'Maria')).toBeUndefined();
    expect(resolveDoctor(doctors, 'Maria Teste')).toBeUndefined();
  });
  it('mantém o número da linha original e rejeita CRM ausente', () => {
    const bad = [...row]; bad[2] = '';
    const preview = previewDoctorGrid([['Título'], ['Fonte'], header, bad], 'Teste');
    expect(preview[0]?.row).toBe(4); expect(preview[0]?.errors).toContain('CRM/UF inválido');
    expect(reviewedDoctors(preview)).toHaveLength(0);
  });
});
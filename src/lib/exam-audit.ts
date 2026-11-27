import type { Encounter } from './care-flow';
import type { Patient } from './hospital-data';
import { defaultProviderForKind, type ExamAuditStatus, type ExamKind, type ExamProvider, type ExamRequest } from './exam-requests';

export interface ExamAuditRow {
  encounterId: string;
  encounterNumber: string;
  patientId: string;
  patientName: string;
  prontuario: string;
  sector: string;
  requestId: string;
  orderNumber: string;
  requestedAt: string;
  month: string;
  kind: ExamKind;
  provider: ExamProvider;
  providerName: string;
  exams: string;
  sigtapCodes: string[];
  susValue: number;
  requestedBy: string;
  council: string;
  status: ExamRequest['status'];
  hasReport: boolean;
  auditStatus: ExamAuditStatus;
  auditNote: string;
  auditedBy: string;
  auditedAt: string;
}

export interface ExamAuditFilters {
  month?: string;
  provider?: ExamProvider | '';
  kind?: ExamKind | '';
  auditStatus?: ExamAuditStatus | '';
  query?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

export function collectExamAuditRows(
  encounters: readonly Encounter[],
  patients: readonly Patient[],
  filters: ExamAuditFilters = {},
): ExamAuditRow[] {
  const pMap = new Map(patients.map((p) => [p.id, p]));
  const rows: ExamAuditRow[] = [];
  for (const e of encounters) {
    const p = pMap.get(e.patientId);
    const encNum = e.fia?.number || e.number;
    for (const r of e.examRequests ?? []) {
      const month = r.requestedAt.slice(0, 7);
      const provider = r.provider ?? defaultProviderForKind(r.kind);
      const auditStatus: ExamAuditStatus = r.auditStatus ?? 'Pendente';
      const sigtapCodes = (r.items ?? []).map((it) => it.sigtapCode).filter((c): c is string => Boolean(c));
      const susValue = (r.items ?? []).reduce((sum, it) => sum + (it.valueSus ?? 0), 0);
      const row: ExamAuditRow = {
        encounterId: e.id,
        encounterNumber: encNum,
        patientId: e.patientId,
        patientName: p?.name ?? 'Paciente não localizado',
        prontuario: p?.prontuario ?? '',
        sector: e.type,
        requestId: r.id,
        orderNumber: r.orderNumber || `LEG-${r.id.slice(0, 6).toUpperCase()}`,
        requestedAt: r.requestedAt,
        month,
        kind: r.kind,
        provider,
        providerName: r.providerName || (provider === 'terceirizada' ? 'Laboratório Terceirizado' : 'HMISC'),
        exams: r.exams,
        sigtapCodes,
        susValue,
        requestedBy: r.requestedBy,
        council: r.council,
        status: r.status,
        hasReport: Boolean(r.report?.trim()),
        auditStatus,
        auditNote: r.auditNote ?? '',
        auditedBy: r.auditedBy ?? '',
        auditedAt: r.auditedAt ?? '',
      };
      if (filters.month && row.month !== filters.month) continue;
      if (filters.provider && row.provider !== filters.provider) continue;
      if (filters.kind && row.kind !== filters.kind) continue;
      if (filters.auditStatus && row.auditStatus !== filters.auditStatus) continue;
      if (filters.query?.trim()) {
        const q = norm(filters.query);
        const hay = norm(`${row.orderNumber} ${row.patientName} ${row.encounterNumber} ${row.exams} ${row.sigtapCodes.join(' ')} ${row.requestedBy}`);
        if (!hay.includes(q)) continue;
      }
      rows.push(row);
    }
  }
  return rows.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export interface ReconciliationResult {
  matched: { line: string; row: ExamAuditRow }[];
  notFoundInHospital: string[];
  missingReport: ExamAuditRow[];
}

/** Cruza linhas coladas da fatura terceirizada (nº PED, código SIGTAP ou nome do paciente) com os pedidos do hospital. */
export function reconcileExternalList(rows: readonly ExamAuditRow[], pastedText: string): ReconciliationResult {
  const lines = pastedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const matched: { line: string; row: ExamAuditRow }[] = [];
  const notFoundInHospital: string[] = [];
  for (const line of lines) {
    const pedMatch = line.match(/PED-\d{4}-\d{6}/i);
    const sigtapMatch = line.match(/\b02\d{8}\b/);
    const lineNorm = norm(line);
    let found: ExamAuditRow | undefined;
    if (pedMatch) {
      const ped = pedMatch[0].toUpperCase();
      found = rows.find((r) => r.orderNumber.toUpperCase() === ped);
    }
    if (!found && sigtapMatch) {
      const code = sigtapMatch[0];
      found = rows.find((r) => r.sigtapCodes.includes(code) && (lineNorm.includes(norm(r.patientName.split(' ')[0] ?? '')) || line.replace(/\D/g, '').length === 10));
    }
    if (!found && lineNorm.length >= 4) {
      found = rows.find((r) => lineNorm.includes(norm(r.patientName)) || norm(r.patientName).includes(lineNorm));
    }
    if (found) matched.push({ line, row: found });
    else notFoundInHospital.push(line);
  }
  const missingReport = rows.filter((r) => r.status !== 'Cancelado' && !r.hasReport);
  return { matched, notFoundInHospital, missingReport };
}
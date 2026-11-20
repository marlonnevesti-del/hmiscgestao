export type Semaphore = 'red' | 'yellow' | 'green';

/** Vermelho = dados do paciente (bloqueia); amarelo = profissional, SIGTAP padrão ou documento; verde = pronto. */
export function semaphoreOf(issues: string[], opts?: { defaultProcedure?: boolean; gaps?: unknown[] }): Semaphore {
  if (issues.some((i) => i !== 'Profissional sem CNS' && i !== 'Profissional sem CBO')) return 'red';
  if (issues.length || opts?.defaultProcedure || opts?.gaps?.length) return 'yellow';
  return 'green';
}

export function semaphoreSummary(rows: { level: Semaphore }[]) {
  const counts = { red: 0, yellow: 0, green: 0 };
  for (const row of rows) counts[row.level]++;
  return counts;
}

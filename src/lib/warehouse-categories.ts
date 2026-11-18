/** Macro-categorias do almoxarifado, agrupando os Grupos de Compra do relatório de saldos. */
export const WAREHOUSE_CATEGORIES = [
  { id: "hospitalar", label: "Material hospitalar & EPIs" },
  { id: "medicamento", label: "Medicamentos" },
  { id: "escritorio", label: "Escritório & TI" },
  { id: "alimentacao", label: "Alimentação & Nutrição" },
  { id: "higiene", label: "Higiene, limpeza & manutenção" },
] as const;
export type WarehouseCategory = (typeof WAREHOUSE_CATEGORIES)[number]["id"];
/** Grupo de Compra do relatório (número) → macro-categoria. */
export const PURCHASE_GROUP_CATEGORY: Record<number, WarehouseCategory> = { 1: "hospitalar", 2: "hospitalar", 8: "hospitalar", 9: "medicamento", 3: "escritorio", 7: "escritorio", 5: "alimentacao", 10: "alimentacao", 6: "higiene", 13: "higiene" };
export const categoryLabel = (id?: string) => WAREHOUSE_CATEGORIES.find((c) => c.id === id)?.label ?? "Sem categoria";

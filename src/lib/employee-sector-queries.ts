import { queryOptions } from "@tanstack/react-query";
import { listEmployeeSectorDefinitions, listEmployeeSectors } from "./employees.functions";

export const employeeSectorListQuery = queryOptions({ queryKey: ["employee-sectors"], queryFn: () => listEmployeeSectors() });
export const employeeSectorDefinitionsQuery = queryOptions({ queryKey: ["employee-sector-definitions"], queryFn: () => listEmployeeSectorDefinitions() });

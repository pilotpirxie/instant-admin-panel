import { DatabaseConfig } from "./configInterface";

export interface Constraint {
  name: string;
  type: ConstraintType;
  columns: string[];
  definition?: string;
}

export type ConstraintType = 
  | "PRIMARY KEY" 
  | "FOREIGN KEY" 
  | "UNIQUE" 
  | "CHECK" 
  | "NOT NULL" 
  | "DEFAULT";

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  primaryKey?: string[];
  foreignKeys?: ForeignKey[];
  constraints?: Constraint[];
}

export enum UnifiedColumnType {
  INTEGER = "integer",
  FLOAT = "float",
  DECIMAL = "decimal",
  STRING = "string",
  BOOLEAN = "boolean",
  DATE = "date",
  TIME = "time", 
  DATETIME = "datetime",
  BINARY = "binary",
  JSON = "json",
  ARRAY = "array",
  OBJECT = "object",
  UNKNOWN = "unknown"
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  unifiedType: UnifiedColumnType;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: DatabaseValue;
}

export type ForeignKeyAction = 
  | "CASCADE" 
  | "SET NULL" 
  | "SET DEFAULT" 
  | "RESTRICT" 
  | "NO ACTION";

export interface ForeignKey {
  column: string;
  foreignTable: string;
  foreignColumn: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface TableData<T extends Record<string, DatabaseValue>> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface FilterValue {
  column: string;
  operator: FilterOperator;
  value?: DatabaseValue;
}

export type FilterOperator = 
  | "eq" 
  | "neq" 
  | "gt" 
  | "gte" 
  | "lt" 
  | "lte" 
  | "in" 
  | "nin" 
  | "like" 
  | "contains" 
  | "isNull" 
  | "isNotNull";

export interface TableDataOptions {
  perPage?: number;
  page?: number;
  orderBy?: { column: string; direction: "asc" | "desc" }[];
  filters?: FilterValue[];
}

export type DatabaseValue = 
  | string 
  | number 
  | boolean 
  | Date 
  | null 
  | undefined;

export type DatabaseAdapter = {
  connect: (connection: DatabaseConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  healthCheck: () => Promise<boolean>;

  getTableList: () => Promise<string[]>;
  getTableSchema: (tableName: string) => Promise<TableSchema>;

  getTableData: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    options: TableDataOptions
  ) => Promise<TableData<T>>;

  createRecord: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    record: T
  ) => Promise<T>;

  updateRecord: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    where: Record<string, DatabaseValue>,
    record: Partial<T>
  ) => Promise<T>;

  deleteRecord: (
    tableName: string, 
    where: Record<string, DatabaseValue>
  ) => Promise<boolean>;

  executeStatement: <T extends Record<string, DatabaseValue>>(
    statement: string,
    params?: DatabaseValue[]
  ) => Promise<T[]>;
};
import { DatabaseConfig } from "./configInterface";


export interface TableSchema {
  name: string;
  comment?: string;
  columns: ColumnInfo[];
  primaryKey?: string[];
  foreignKeys?: ForeignKey[];
  indexes?: Index[];
  constraints?: Constraint[];
}

export interface ColumnInfo {
  name: string;
  comment?: string;
  dataType: ColumnType;
  unifiedDataType: UnifiedColumnType;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: DatabaseValue;
}

export interface ForeignKey {
  name: string;
  column: string;
  foreignTable: string;
  foreignColumn: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface Index {
  name: string;
  columns: string[];
  isUnique: boolean;
  type?: IndexType;
}

export interface Constraint {
  name: string;
  type: ConstraintType;
  columns: string[];
  definition?: string;
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

export type OrderDirection = "asc" | "desc";

export interface OrderOrder {
  column: string;
  direction: OrderDirection;
}

export interface TableDataOptions {
  perPage?: number;
  page?: number;
  orderBy?: OrderOrder[];
  filters?: FilterValue[];
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
  | "startsWith" 
  | "endsWith" 
  | "isNull" 
  | "isNotNull";

export type ForeignKeyAction = 
  | "CASCADE" 
  | "SET NULL" 
  | "SET DEFAULT" 
  | "RESTRICT" 
  | "NO ACTION";

export type IndexType = 
  | "BTREE" 
  | "HASH" 
  | "GIST" 
  | "SPGIST" 
  | "GIN" 
  | "BRIN" 
  | "FULLTEXT" 
  | "SPATIAL" 
  | "RTREE" 
  | "UNKNOWN";

export type ConstraintType = 
  | "PRIMARY KEY" 
  | "FOREIGN KEY" 
  | "UNIQUE" 
  | "CHECK" 
  | "NOT NULL" 
  | "DEFAULT";

export type IsolationLevel = 
  | "READ UNCOMMITTED" 
  | "READ COMMITTED" 
  | "REPEATABLE READ" 
  | "SERIALIZABLE";

export interface Transaction {
  id: string;
  isolationLevel: IsolationLevel;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

export type RelationshipType = 
  | "ONE_TO_ONE" 
  | "ONE_TO_MANY" 
  | "MANY_TO_MANY";

export type ColumnType = string;

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
  getColumnList: (tableName: string) => Promise<string[]>;
  beginTransaction: (options?: { isolationLevel?: IsolationLevel }) => Promise<Transaction>;
  commitTransaction: () => Promise<void>;
  rollbackTransaction: () => Promise<void>;
  getTableSchema: (tableName: string) => Promise<TableSchema>;
  getTableData: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    options: TableDataOptions
  ) => Promise<TableData<T>>;
  createRecord: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    record: T
  ) => Promise<T>;
  createBulkRecords: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    records: T[]
  ) => Promise<T[]>;
  updateRecord: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    where: Record<string, DatabaseValue>,
    record: Partial<T>
  ) => Promise<T>;
  updateBulkRecords: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    records: {
      where: Record<string, DatabaseValue>;
      data: Partial<T>;
    }[]
  ) => Promise<T[]>;
  deleteRecord: (
    tableName: string, 
    where: Record<string, DatabaseValue>
  ) => Promise<boolean>;
  deleteBulkRecords: (
    tableName: string, 
    whereConditions: Record<string, DatabaseValue>[]
  ) => Promise<number>;
  getRecord: <T extends Record<string, DatabaseValue>>(
    tableName: string, 
    where: Record<string, DatabaseValue>
  ) => Promise<T | null>;
  getRecordCount: (
    tableName: string, 
    filters?: Record<string, FilterValue>
  ) => Promise<number>;
  executeStatement: <T extends Record<string, DatabaseValue>>(
    statement: string,
    params?: DatabaseValue[]
  ) => Promise<T[]>;
  getIndexes: (tableName: string) => Promise<Index[]>;
  getConstraints: (tableName: string) => Promise<Constraint[]>;
};
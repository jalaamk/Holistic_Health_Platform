/**
 * Database interface - abstracts database provider
 */
export interface IDatabase {
  collection<T>(name: string): ICollection<T>;
}

export interface ICollection<T> {
  doc(id: string): IDocument<T>;
  query(): IQuery<T>;
  add(data: Omit<T, 'id'>): Promise<string>;
}

export interface IDocument<T> {
  get(): Promise<T | null>;
  set(data: T): Promise<void>;
  update(data: Partial<T>): Promise<void>;
  delete(): Promise<void>;
}

export interface IQuery<T> {
  where(field: string, op: WhereOperator, value: unknown): IQuery<T>;
  orderBy(field: string, direction?: 'asc' | 'desc'): IQuery<T>;
  limit(count: number): IQuery<T>;
  get(): Promise<T[]>;
}

export type WhereOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';

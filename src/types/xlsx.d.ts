// Minimal XLSX type declarations.
// The `xlsx` package ships without its own typings; these stubs keep
// TypeScript happy while letting us use the full runtime API.
declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
    Props?: WorkBookProps;
    [key: string]: unknown;
  }

  export interface WorkSheet {
    [cell: string]: unknown;
  }

  export interface WorkBookProps {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
    [key: string]: unknown;
  }

  export interface WritingOptions {
    type?: string;
    bookType?: string;
    [key: string]: unknown;
  }

  export type CellObject = {
    v?: string | number | boolean | Date;
    t?: string;
    s?: Record<string, unknown>;
    w?: string;
  };

  export interface Utils {
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name?: string): void;
    aoa_to_sheet(data: unknown[][]): WorkSheet;
    sheet_add_aoa(data: unknown[][], sheet: WorkSheet): WorkSheet;
    json_to_sheet(data: unknown[], opts?: Record<string, unknown>): WorkSheet;
    sheet_to_json<T = unknown>(sheet: WorkSheet, opts?: Record<string, unknown>): T[];
    cell_range(range: string): unknown;
    decode_range(range: string): unknown;
    encode_cell(c: { c: number; r: number }): string;
    encode_col(n: number): string;
    encode_row(n: number): string;
  }

  export const utils: Utils;
  export function writeFile(wb: WorkBook, filename: string, opts?: WritingOptions): void;
  export function write(wb: WorkBook, opts?: WritingOptions): string | ArrayBuffer;
  export function utils_to_style(style: Record<string, unknown>): unknown;
}

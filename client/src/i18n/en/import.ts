import type { Currency } from '../../types';
import type { ColumnRole, DateOrder, DecimalSeparator } from '../../utils/csv';

// Importing a CSV or Excel file into an account: the dialog and what the readers say.
export default {
  title: 'Import Transactions',
  dismiss: 'Dismiss',
  back: 'Back',
  upload: {
    drop: 'Drag and drop a CSV or Excel file, or click to browse',
    supports: 'Supports .csv, .xlsx and .xls files',
    demo: "Demo: your file stays in this browser tab and isn't saved.",
    fileLabel: 'CSV or Excel file',
  },
  map: {
    intro_one: 'Map each column to a field. Found {{count}} row.',
    intro_other: 'Map each column to a field. Found {{count}} rows.',
    sheet: 'Sheet',
    /** The name of a column's field picker: "Column Fecha" */
    column: 'Column {{header}}',
    firstRow: 'First row reads as <strong>{{date}}, {{amount}}</strong>.',
    preview: 'Preview',
    checking: 'Checking...',
  },
  /** What a column of the file holds, keyed by `ColumnRole` */
  role: {
    date: 'Date',
    payee: 'Payee',
    amount: 'Amount',
    inflow: 'Inflow',
    outflow: 'Outflow',
    amountUYU: 'Amount in pesos',
    amountUSD: 'Amount in dollars',
    currency: 'Currency',
    notes: 'Notes',
    skip: 'Skip',
  } satisfies Record<ColumnRole, string>,
  conventions: {
    dates: 'Dates',
    dateOrder: {
      'day-first': 'Day first (31/12/2026)',
      'month-first': 'Month first (12/31/2026)',
    } satisfies Record<DateOrder, string>,
    decimals: 'Decimals',
    decimal: {
      comma: 'Comma (1.234,56)',
      point: 'Point (1,234.56)',
    } satisfies Record<DecimalSeparator, string>,
  },
  chargesPositive: {
    label: 'Purchases are positive in this file',
    hint: 'Card statements often are. Every sign is turned around: purchases become money going out, payments and refunds money coming in.',
  },
  /** A currency inside a sentence ("rows in dollars"), keyed by `Currency` */
  currencyWord: {
    UYU: 'pesos',
    USD: 'dollars',
  } satisfies Record<Currency, string>,
  otherCurrency: {
    /** The label of the account picker: "Rows in dollars go to [account]" */
    goTo: 'Rows in {{currency}} go to',
    notImported: 'Not imported',
    count_one: '{{count}} row of this file is in {{currency}}, and this account holds {{own}}.',
    count_other: '{{count}} rows of this file are in {{currency}}, and this account holds {{own}}.',
    addAccount: 'Add an account in {{currency}} to import them.',
  },
  problems: {
    summary_one:
      "{{count}} row can't be read and won't be imported. Check the Dates and Decimals choices.",
    summary_other:
      "{{count}} rows can't be read and won't be imported. Check the Dates and Decimals choices.",
    row: 'Row {{row}}: {{message}}',
    more: 'and {{more}} more',
    date: 'Can\'t read the date "{{cell}}"',
    amount: 'Can\'t read the amount "{{cell}}"',
    currency: 'Can\'t read the currency "{{cell}}"',
  },
  preview: {
    found_one: '{{count}} transaction found.',
    found_other: '{{count}} transactions found.',
    duplicates_one: '{{count}} duplicate detected.',
    duplicates_other: '{{count}} duplicates detected.',
    willImport_one: '{{count}} will be imported.',
    willImport_other: '{{count}} will be imported.',
    leftOut_one: "{{count}} row in {{currency}} won't be imported.",
    leftOut_other: "{{count}} rows in {{currency}} won't be imported.",
    /** The name of a row's checkbox */
    importRow: 'Import {{payee}} on {{date}}',
    importUnnamedRow: 'Import row on {{date}}',
    duplicate: 'duplicate',
    importing: 'Importing...',
    import_one: 'Import {{count}} Transaction',
    import_other: 'Import {{count}} Transactions',
  },
  done: {
    title: 'Import complete',
    summary: '{{imported}} imported, {{skipped}} skipped',
    close: 'Done',
  },
  errors: {
    readFile: 'Could not read the file',
    noRows: 'Could not find any rows in the file',
    dateRequired: 'Date column is required',
    amountRequired: 'At least one amount column is required',
    everyRowOther: 'Every row is in {{currency}}. Choose the account they go to.',
    noneReadable_one: 'The only row could not be read. Check the Dates and Decimals choices.',
    noneReadable_other:
      'None of the {{count}} rows could be read. Check the Dates and Decimals choices.',
    noValidRows: 'No valid rows found',
    previewFailed: 'Preview failed',
    noneSelected: 'No rows selected',
    importFailed: 'Import failed',
    /** `done` is the accounts that were imported into, joined with commas */
    partial:
      'Imported into {{done}}, but not into {{failed}}: {{reason}}. Import again to finish: rows already imported are skipped.',
  },
  /** Why an Excel file can't be read (`SpreadsheetError`) */
  spreadsheet: {
    /** A sheet the workbook gives no name */
    sheetName: 'Sheet {{number}}',
    damaged: "This Excel file is damaged and can't be read.",
    tooLarge: 'This Excel file is too large to import.',
    notWorkbook: "This file isn't an Excel workbook.",
    tooOld:
      'This Excel file is in a format from before 1997. Open it and save it as .xlsx or .csv.',
    passwordProtected:
      'This Excel file is protected with a password. Save a copy without one to import it.',
  },
} as const;

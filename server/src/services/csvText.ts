// The words the server writes in the CSV files it builds (routes/export.ts): header rows, the
// words it supplies in cells and the file names, in the language of the request. Everything
// else in a file reads the same in both: dates (YYYY-MM-DD), amounts (1234.56), currency codes.
import type { Language } from '../utils/language.js';

interface CsvText {
  transactions: {
    fileName: string;
    /** In the order of the file's columns */
    header: {
      date: string;
      account: string;
      group: string;
      currency: string;
      payee: string;
      category: string;
      notes: string;
      amount: string;
      reconciled: string;
    };
    yes: string;
    no: string;
  };
  exchangeRates: {
    fileName: string;
    /** In the order of the file's columns */
    header: { date: string; rate: string; source: string };
    enteredByHand: string;
    fetched: string;
  };
}

const CSV_TEXT: Record<Language, CsvText> = {
  en: {
    transactions: {
      fileName: 'transactions.csv',
      header: {
        date: 'Date',
        account: 'Account',
        group: 'Group',
        currency: 'Currency',
        payee: 'Payee',
        category: 'Category',
        notes: 'Notes',
        amount: 'Amount',
        reconciled: 'Reconciled',
      },
      yes: 'Yes',
      no: 'No',
    },
    exchangeRates: {
      fileName: 'exchange-rates.csv',
      header: { date: 'Date', rate: 'Pesos per dollar', source: 'Source' },
      enteredByHand: 'Entered by hand',
      fetched: 'Fetched',
    },
  },
  es: {
    transactions: {
      fileName: 'transacciones.csv',
      header: {
        date: 'Fecha',
        account: 'Cuenta',
        group: 'Grupo',
        currency: 'Moneda',
        payee: 'Beneficiario',
        category: 'Categoría',
        notes: 'Notas',
        amount: 'Monto',
        reconciled: 'Conciliada',
      },
      yes: 'Sí',
      no: 'No',
    },
    exchangeRates: {
      fileName: 'tipos-de-cambio.csv',
      header: { date: 'Fecha', rate: 'Pesos por dólar', source: 'Origen' },
      enteredByHand: 'Ingresado a mano',
      fetched: 'Obtenido',
    },
  },
};

/** The words of the server's CSV files in a language */
export const csvText = (language: Language): CsvText => CSV_TEXT[language];

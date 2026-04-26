/**
 * Unit tests for receipt content builder
 */

import { describe, it, expect } from 'vitest';
import { buildReceipt, type ReceiptVariant } from './receipt-content';
import type { Transaction, BirSettings, PrinterProfile, XReading, ZReading } from '../types';

const defaultProfile: PrinterProfile = {
  id: 'printer-1',
  label: 'Test Printer',
  connectionType: 'usb',
  address: '',
  paperWidth: 58,
  characterSet: 'US',
  autocut: true,
  partialCut: false,
  role: 'both',
  isDefault: true,
  status: 'online',
};

const defaultBir: BirSettings = {
  tin: '123-456-789',
  registeredName: 'Test Pharmacy',
  registeredAddress: '123 Main St',
  vatRegistered: true,
  ptuNumber: 'PTU-001',
  machineSerial: 'POS-001',
  accreditationNumber: 'ACC-001',
  orSeriesStart: 1,
  orSeriesEnd: 9999,
  currentOrNumber: 100,
  zReadingCutoffTime: '23:59',
};

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'TXN-001',
    localNumber: 'OR-100',
    items: [],
    customerId: 'CUST-001',
    cashierId: 'cashier1',
    createdAt: '2024-01-15T10:30:00',
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    paid: 0,
    change: 0,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    paymentReference: '',
    syncStatus: 'synced',
    ...overrides,
  };
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('buildReceipt - normal variant', () => {
  it('should build a basic receipt and return Uint8Array', () => {
    const tx = makeTransaction();
    const result = buildReceipt('normal', defaultProfile, defaultBir, tx);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include registered name from BIR settings', () => {
    const tx = makeTransaction();
    const result = buildReceipt('normal', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('Test Pharmacy');
  });

  it('should include TIN from BIR settings', () => {
    const tx = makeTransaction();
    const result = buildReceipt('normal', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('123-456-789');
  });

  it('should include transaction local number (OR #)', () => {
    const tx = makeTransaction({ localNumber: 'OR-100' });
    const result = buildReceipt('normal', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('OR-100');
  });

  it('should include item details', () => {
    const tx = makeTransaction({
      items: [
        {
          productId: 'PROD-001',
          productName: 'Aspirin 500mg',
          price: 50,
          quantity: 3,
          lineTotal: 150,
        },
      ],
      subtotal: 150,
      tax: 15,
      total: 165,
      paid: 165,
      change: 0,
    });
    const profile80mm: PrinterProfile = { ...defaultProfile, paperWidth: 80 };
    const result = buildReceipt('normal', profile80mm, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('Aspirin 500mg');
  });

  it('should include totals', () => {
    const tx = makeTransaction({
      subtotal: 500,
      discount: 0,
      tax: 50,
      total: 550,
      paid: 550,
      change: 0,
    });
    const result = buildReceipt('normal', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('500');
    expect(text).toContain('550');
  });

  it('should show CARD for external-terminal payment method', () => {
    const tx = makeTransaction({
      paymentMethod: 'external-terminal',
      subtotal: 100,
      total: 100,
      paid: 100,
    });
    const result = buildReceipt('normal', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('CARD');
  });

  it('should show CASH for cash payment method', () => {
    const tx = makeTransaction({
      paymentMethod: 'cash',
      subtotal: 100,
      total: 100,
      paid: 100,
    });
    const result = buildReceipt('normal', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('CASH');
  });

  it('should work without BIR settings', () => {
    const tx = makeTransaction();
    const result = buildReceipt('normal', defaultProfile, undefined, tx);
    expect(result).toBeInstanceOf(Uint8Array);
    const text = decode(result);
    expect(text).toContain('PharmaPOS PH Drug Store');
  });
});

describe('buildReceipt - void variant', () => {
  it('should include VOID indicator', () => {
    const tx = makeTransaction();
    const result = buildReceipt('void', defaultProfile, defaultBir, tx, { voidReason: 'Customer request' });
    const text = decode(result);
    expect(text).toContain('VOID');
  });

  it('should include void reason when provided', () => {
    const tx = makeTransaction();
    const result = buildReceipt('void', defaultProfile, defaultBir, tx, { voidReason: 'Customer request' });
    const text = decode(result);
    expect(text).toContain('Customer request');
  });
});

describe('buildReceipt - reprint variant', () => {
  it('should include REPRINT indicator', () => {
    const tx = makeTransaction();
    const result = buildReceipt('reprint', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('REPRINT');
  });

  it('should include NOT AN ORIGINAL text', () => {
    const tx = makeTransaction();
    const result = buildReceipt('reprint', defaultProfile, defaultBir, tx);
    const text = decode(result);
    expect(text).toContain('NOT AN ORIGINAL');
  });
});

describe('buildReceipt - x-reading variant', () => {
  const xReading: XReading = {
    id: 'XR-001',
    reportDate: '2024-01-15',
    reportTime: '14:30',
    machineSerial: 'POS-001',
    beginningOrNumber: 1,
    lastOrNumber: 25,
    grossSales: 5000,
    vatableSales: 4000,
    vatExemptSales: 500,
    vatAmount: 480,
    zeroRatedSales: 200,
    scDiscount: 150,
    pwdDiscount: 100,
    promotionalDiscount: 50,
    totalDiscounts: 300,
    totalVoids: 2,
    voidAmount: 200,
    totalReturns: 1,
    returnAmount: 100,
    netSales: 4500,
    generatedBy: 'cashier1',
    generatedAt: '2024-01-15T14:30:00',
  };

  it('should build X-reading report and return Uint8Array', () => {
    const result = buildReceipt('x-reading', defaultProfile, defaultBir, xReading);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include X-READING REPORT title', () => {
    const result = buildReceipt('x-reading', defaultProfile, defaultBir, xReading);
    const text = decode(result);
    expect(text).toContain('X-READING');
  });

  it('should include BIR information', () => {
    const result = buildReceipt('x-reading', defaultProfile, defaultBir, xReading);
    const text = decode(result);
    expect(text).toContain('123-456-789');
    expect(text).toContain('Test Pharmacy');
  });

  it('should include sales figures', () => {
    const result = buildReceipt('x-reading', defaultProfile, defaultBir, xReading);
    const text = decode(result);
    expect(text).toContain('5,000.00');
    expect(text).toContain('4,500.00');
  });

  it('should include report date', () => {
    const result = buildReceipt('x-reading', defaultProfile, defaultBir, xReading);
    const text = decode(result);
    expect(text).toContain('2024-01-15');
  });
});

describe('buildReceipt - z-reading variant', () => {
  const zReading: ZReading = {
    id: 'ZR-001',
    reportDate: '2024-01-15',
    reportTime: '23:59',
    machineSerial: 'POS-001',
    beginningOrNumber: 1,
    lastOrNumber: 50,
    grossSales: 10000,
    vatableSales: 8000,
    vatExemptSales: 1000,
    vatAmount: 960,
    zeroRatedSales: 400,
    scDiscount: 300,
    pwdDiscount: 200,
    promotionalDiscount: 100,
    totalDiscounts: 600,
    totalVoids: 3,
    voidAmount: 500,
    totalReturns: 2,
    returnAmount: 200,
    netSales: 9000,
    generatedBy: 'cashier1',
    generatedAt: '2024-01-15T23:59:00',
    storeName: 'Test Pharmacy',
    tin: '123-456-789',
    ptuNumber: 'PTU-001',
    transactionCount: 50,
    endingOrNumber: 50,
    resetFlag: true,
  };

  it('should build Z-reading report and return Uint8Array', () => {
    const result = buildReceipt('z-reading', defaultProfile, defaultBir, zReading);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include Z-READING REPORT title', () => {
    const result = buildReceipt('z-reading', defaultProfile, defaultBir, zReading);
    const text = decode(result);
    expect(text).toContain('Z-READING');
  });

  it('should include ending OR number from ZReading', () => {
    const result = buildReceipt('z-reading', defaultProfile, defaultBir, zReading);
    const text = decode(result);
    expect(text).toContain('50');
  });

  it('should include net sales', () => {
    const result = buildReceipt('z-reading', defaultProfile, defaultBir, zReading);
    const text = decode(result);
    expect(text).toContain('9,000.00');
  });
});

import * as XLSX from 'xlsx';

const COL_WIDTHS = {
  sales: [
    { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 22 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 36 },
  ],
  payments: [
    { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 18 }, { wch: 20 },
  ],
};

const sheetFromRows = (rows) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  return ws;
};

const applySheetLayout = (ws, colWidths, freezeRow = 1) => {
  ws['!cols'] = colWidths;
  ws['!freeze'] = { xSplit: 0, ySplit: freezeRow, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '');
const fmtMoney = (n) => (n != null && !Number.isNaN(Number(n)) ? Number(n) : 0);

const paymentSummary = (payments) => {
  if (!payments?.length) return 'No payments recorded';
  return payments
    .map((p) => {
      const parts = [`${(p.method || '').toUpperCase()}: ETB ${fmtMoney(p.amount).toLocaleString()}`];
      if (p.bank) parts.push(p.bank);
      if (p.reference) parts.push(`Ref ${p.reference}`);
      return parts.join(' | ');
    })
    .join('; ');
};

export const exportToExcel = (data, fileName) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportSalesToExcel = (sales, t = (k) => k) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const totalRevenue = sales.reduce((a, s) => a + fmtMoney(s.total_amount), 0);
  const totalPaid = sales.reduce((a, s) => a + fmtMoney(s.amount_paid), 0);
  const totalBalance = sales.reduce((a, s) => a + fmtMoney(s.balance ?? s.total_amount - s.amount_paid), 0);

  const wb = XLSX.utils.book_new();

  // ── Summary sheet ──
  const S = (k, fallback) => { const v = t(k); return v !== k ? v : fallback; };
  const summaryRows = [
    ['LEGASONA MOTORS'],
    [S('sales', 'Sales') + ' & ' + S('reports', 'Payments').toLowerCase() + ' ' + S('reports', 'Report')],
    [],
    [S('date', 'Date'), dateStr],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Metric', 'Value'],
    ['Total ' + S('sales', 'Transactions'), sales.length],
    [S('totalRevenue', 'Total Revenue') + ' (ETB)', totalRevenue],
    ['Total Collected (ETB)', totalPaid],
    ['Outstanding Balance (ETB)', totalBalance],
    [S('completed', 'Completed'), sales.filter((s) => s.status === 'completed').length],
    [S('pending', 'Pending'), sales.filter((s) => s.status === 'pending').length],
  ];
  const wsSummary = sheetFromRows(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Sales detail sheet ──
  const salesHeader = [
    S('receiptNum', 'Receipt #'), S('date', 'Date'), S('customer', 'Customer'), S('phoneNumber', 'Phone'), S('item', 'Item'),
    S('chassisNumber', 'Chassis (VIN)'), S('motorNumber', 'Motor #'), S('propulsionType', 'Propulsion'), S('saleType', 'Sale Type'), S('status', 'Status'),
    S('totalAmount', 'Contract') + ' (ETB)', 'Paid (ETB)', 'Balance (ETB)', S('paymentDetails', 'Payment Details'),
  ];
  const salesRows = sales.map((s) => [
    s.sale_number,
    fmtDate(s.sale_date),
    s.customer_name,
    s.customer_phone || '',
    s.item_name || s.category || s.sale_type,
    s.chassis_number || '',
    s.motor_number || '',
    s.power_type || '',
    s.sale_type,
    s.status,
    fmtMoney(s.total_amount),
    fmtMoney(s.amount_paid),
    fmtMoney(s.balance ?? s.total_amount - s.amount_paid),
    paymentSummary(s.payments),
  ]);
  const wsSales = sheetFromRows([salesHeader, ...salesRows]);
  applySheetLayout(wsSales, COL_WIDTHS.sales, 1);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales');

  // ── Payment lines sheet (one row per payment) ──
  const payHeader = [
    S('receiptNum', 'Receipt #'), S('date', 'Date'), S('customer', 'Customer'), S('method', 'Method'), S('bankName', 'Bank'),
    S('amount', 'Amount') + ' (ETB)', S('reference', 'Reference'), S('date', 'Payment Date'),
  ];
  const payRows = [];
  sales.forEach((s) => {
    if (s.payments?.length) {
      s.payments.forEach((p) => {
        payRows.push([
          s.sale_number,
          fmtDate(s.sale_date),
          s.customer_name,
          (p.method || '').toUpperCase(),
          p.bank || '',
          fmtMoney(p.amount),
          p.reference || '',
          fmtDate(p.date),
        ]);
      });
    } else {
      payRows.push([
        s.sale_number,
        fmtDate(s.sale_date),
        s.customer_name,
        '',
        '',
        fmtMoney(s.amount_paid),
        '',
        '',
      ]);
    }
  });
  const wsPayments = sheetFromRows([payHeader, ...payRows]);
  applySheetLayout(wsPayments, COL_WIDTHS.payments, 1);
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');

  XLSX.writeFile(wb, `Legasona_Sales_Report_${dateStr}.xlsx`);
};

const INVENTORY_COL_WIDTHS = {
  vehicles: [
    { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 14 },
  ],
  parts: [
    { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 14 },
  ],
};

export const exportInventoryToExcel = (items, type, t = (k) => k) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const wb = XLSX.utils.book_new();
  const S = (k, fallback) => { const v = t(k); return v !== k ? v : fallback; };

  if (type === 'vehicles') {
    const headers = [
      S('vehicleModelName', 'Model'), 'VIN', S('chassisNumber', 'Chassis #'), S('motorNumber', 'Motor #'),
      S('bodyClassification', 'Type'), S('propulsionType', 'Propulsion'), S('primaryColor', 'Color'), S('status', 'Status'),
      S('sellingPrice', 'Selling Price') + ' (ETB)', S('acquisitionCost', 'Cost Price') + ' (ETB)', S('branch', 'Branch'),
    ];
    const rows = items.map((v) => [
      v.model || '',
      v.vin || '',
      v.chassis_number || '',
      v.engine_number || '',
      v.type || '',
      v.power_type || '',
      v.color || '',
      v.status || '',
      fmtMoney(v.selling_price),
      fmtMoney(v.cost_price),
      `Branch ${v.branch_id}` || '',
    ]);
    const titleRows = [
      ['LEGASONA MOTORS'],
      [S('vehicles', 'Vehicles') + ' ' + S('inventoryTitle', 'Inventory')],
      [`Generated: ${new Date().toLocaleString()}`, `${S('vehicles', 'Vehicles')}: ${items.length}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, headers, ...rows]);
    ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' };
    ws['!cols'] = INVENTORY_COL_WIDTHS.vehicles;
    XLSX.utils.book_append_sheet(wb, ws, S('vehicles', 'Vehicles'));
  } else {
    const headers = [
      S('componentName', 'Part Name'), S('partNumberSku', 'Part #'), S('category', 'Category'), S('quantity', 'Qty'),
      S('unitPrice', 'Unit Price') + ' (ETB)', S('landedCost', 'Cost Price') + ' (ETB)', S('branch', 'Branch'),
    ];
    const rows = items.map((p) => [
      p.name || '',
      p.part_number || '',
      p.category || '',
      p.quantity ?? 0,
      fmtMoney(p.unit_price),
      fmtMoney(p.cost_price),
      p.branch_name || p.branch_id || '',
    ]);
    const titleRows = [
      ['LEGASONA MOTORS'],
      [S('spareParts', 'Spare Parts') + ' ' + S('inventoryTitle', 'Inventory')],
      [`Generated: ${new Date().toLocaleString()}`, `${S('spareParts', 'Parts')}: ${items.length}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, headers, ...rows]);
    ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' };
    ws['!cols'] = INVENTORY_COL_WIDTHS.parts;
    XLSX.utils.book_append_sheet(wb, ws, S('spareParts', 'Spare Parts'));
  }

  XLSX.writeFile(wb, `Legasona_${S('inventoryTitle', 'Inventory')}_${dateStr}.xlsx`);
};

const REPORT_COL_WIDTHS = {
  summary: [{ wch: 30 }, { wch: 22 }],
  payments: [
    { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 16 },
  ],
};

export const exportReportsToExcel = (payments, stats, profit, t = (k) => k) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const wb = XLSX.utils.book_new();
  const S = (k, fallback) => { const v = t(k); return v !== k ? v : fallback; };

  // ── Summary sheet ──
  const summaryRows = [
    ['LEGASONA MOTORS'],
    [S('reportsTitle', 'Financial Report')],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ['METRIC', 'VALUE'],
    [S('netProfitMargin', 'Net Profit Margin'), `${profit?.margin || 0}%`],
    [S('totalRevenue', 'Total Revenue') + ' (ETB)', fmtMoney(profit?.revenue)],
    [S('grossProfit', 'Gross Profit') + ' (ETB)', fmtMoney(profit?.gross_profit)],
    [S('operationalExpenses', 'Operational Expenses') + ' (ETB)', fmtMoney(profit?.expenses)],
    ['Cost of Goods Sold (ETB)', fmtMoney(profit?.cogs)],
    ['Net Profit (ETB)', fmtMoney(profit?.net_profit)],
    [],
    [S('totalCollected', 'Total Payments Collected'), fmtMoney(payments.reduce((a, p) => a + fmtMoney(p.amount), 0))],
    [S('totalPurchases', 'Total Transactions'), payments.length],
  ];
  if (stats?.stats) {
    stats.stats.forEach((s) => {
      summaryRows.push([s.name, s.value]);
    });
  }
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = REPORT_COL_WIDTHS.summary;
  wsSummary['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' };
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Payments sheet ──
  if (payments.length > 0) {
    const headers = [
      S('receiptNum', 'Sale #'), S('date', 'Date'), S('customer', 'Customer'), S('method', 'Method'),
      S('bankName', 'Bank'), S('accountHolder', 'Account Holder'), S('reference', 'Reference'), S('amount', 'Amount') + ' (ETB)',
    ];
    const rows = payments.map((p) => [
      p.sale_number || '',
      fmtDate(p.payment_date),
      p.customer_name || '',
      (p.payment_method || '').toUpperCase(),
      p.bank_name || '',
      p.account_holder || '',
      p.transaction_reference || '',
      fmtMoney(p.amount),
    ]);
    const titleRows = [
      ['LEGASONA MOTORS'],
      [S('paymentRecords', 'Payment Records')],
      [`Generated: ${new Date().toLocaleString()}`, `${S('payments', 'Payments')}: ${payments.length}`],
      [],
    ];
    const wsPayments = XLSX.utils.aoa_to_sheet([...titleRows, headers, ...rows]);
    wsPayments['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' };
    wsPayments['!cols'] = REPORT_COL_WIDTHS.payments;
    XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');
  }

  XLSX.writeFile(wb, `Legasona_${S('reportsTitle', 'Report')}_${dateStr}.xlsx`);
};

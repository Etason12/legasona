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

export const exportSalesToExcel = (sales) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const totalRevenue = sales.reduce((a, s) => a + fmtMoney(s.total_amount), 0);
  const totalPaid = sales.reduce((a, s) => a + fmtMoney(s.amount_paid), 0);
  const totalBalance = sales.reduce((a, s) => a + fmtMoney(s.balance ?? s.total_amount - s.amount_paid), 0);

  const wb = XLSX.utils.book_new();

  // ── Summary sheet ──
  const summaryRows = [
    ['LEGASONA MOTORS'],
    ['Sales & Payment Report'],
    [],
    ['Report Date', dateStr],
    ['Generated At', new Date().toLocaleString()],
    [],
    ['Metric', 'Value'],
    ['Total Transactions', sales.length],
    ['Total Contract Value (ETB)', totalRevenue],
    ['Total Collected (ETB)', totalPaid],
    ['Outstanding Balance (ETB)', totalBalance],
    ['Completed Sales', sales.filter((s) => s.status === 'completed').length],
    ['Pending Sales', sales.filter((s) => s.status === 'pending').length],
  ];
  const wsSummary = sheetFromRows(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Sales detail sheet ──
  const salesHeader = [
    'Receipt #', 'Sale Date', 'Customer', 'Phone', 'Vehicle / Item',
    'Chassis (VIN)', 'Motor Number', 'Propulsion', 'Sale Type', 'Status',
    'Contract (ETB)', 'Paid (ETB)', 'Balance (ETB)', 'Payment Details',
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
    'Receipt #', 'Sale Date', 'Customer', 'Method', 'Bank',
    'Amount (ETB)', 'Reference', 'Payment Date',
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

export const exportInventoryToExcel = (items, type) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const wb = XLSX.utils.book_new();

  if (type === 'vehicles') {
    const headers = [
      'Model', 'VIN', 'Chassis #', 'Motor #',
      'Type', 'Propulsion', 'Color', 'Status',
      'Selling Price (ETB)', 'Cost Price (ETB)', 'Branch',
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
      ['Vehicles Inventory Report'],
      [`Generated: ${new Date().toLocaleString()}`, `Total Vehicles: ${items.length}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, headers, ...rows]);
    ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' };
    ws['!cols'] = INVENTORY_COL_WIDTHS.vehicles;
    XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');
  } else {
    const headers = [
      'Part Name', 'Part #', 'Category', 'Quantity',
      'Unit Price (ETB)', 'Cost Price (ETB)', 'Branch',
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
      ['Spare Parts Inventory Report'],
      [`Generated: ${new Date().toLocaleString()}`, `Total Parts: ${items.length}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, headers, ...rows]);
    ws['!freeze'] = { xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft', state: 'frozen' };
    ws['!cols'] = INVENTORY_COL_WIDTHS.parts;
    XLSX.utils.book_append_sheet(wb, ws, 'Spare Parts');
  }

  XLSX.writeFile(wb, `Legasona_Inventory_${dateStr}.xlsx`);
};

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { capitalizeName } from '../utils/format';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const buildItemDescription = (saleData) => {
  const lines = [];
  const model = saleData.itemName && saleData.itemName !== "vehicle" && saleData.itemName !== "spare_part"
    ? saleData.itemName
    : saleData.vehicleModel || null;

  if (model) lines.push(`Model: ${model}`);
  if (saleData.chassisNumber) lines.push(`Chassis (VIN): ${saleData.chassisNumber}`);
  if (saleData.motorNumber) lines.push(`Motor Number: ${saleData.motorNumber}`);
  if (saleData.powerType) lines.push(`Propulsion: ${saleData.powerType}`);

  if (lines.length === 0) {
    if (saleData.saleType === "vehicle") {
      return "Vehicle (details not recorded)";
    }
    return saleData.itemName || "Item";
  }
  return lines.join("\n");
};

export const generateReceipt = async (saleData) => {
  const doc = new jsPDF({ unit: "mm", format: [80, 180] });

  const pageWidth = 80;
  const margin = 5;
  const centerX = pageWidth / 2;
  const rightAlignX = pageWidth - margin;
  let y = 10;

  const line = (yy) => {
    doc.setDrawColor(200);
    doc.line(margin, yy, rightAlignX, yy);
    return yy + 4;
  };

  doc.setFontSize(14);
  doc.setTextColor(14, 165, 233);
  doc.text("LEGASONA MOTORS", centerX, y, { align: "center" });
  y += 5;

  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text("Multi-Branch Vehicle Dealership", centerX, y, { align: "center" });
  y += 4;
  doc.text(`${saleData.branch || "Main"} Branch`, centerX, y, { align: "center" });
  y += 4;
  doc.text("Phone: +251 911 000 000", centerX, y, { align: "center" });
  y = line(y + 2);

  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT FOR PURCHASE", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Receipt #: ${saleData.receiptNumber}`, margin, y);
  y += 4;
  doc.text(`Date: ${saleData.date || new Date().toLocaleString()}`, margin, y);
  y += 4;
  if (saleData.cashierName) {
    doc.text(`Cashier: ${saleData.cashierName}`, margin, y);
    y += 4;
  }
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER DETAILS", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${capitalizeName(saleData.customerName)}`, margin, y);
  y += 4;
  doc.text(`Phone: ${saleData.customerPhone || "N/A"}`, margin, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("ITEM DESCRIPTION", margin, y);
  y = line(y + 1);
  doc.setFont("helvetica", "normal");
  const itemText = buildItemDescription(saleData);
  const splitItem = doc.splitTextToSize(itemText, pageWidth - margin * 2);
  doc.text(splitItem, margin, y);
  y += splitItem.length * 4 + 3;

  doc.setFont("helvetica", "bold");
  doc.text("Contract Amount:", margin, y);
  doc.text(
    `ETB ${parseFloat(saleData.totalAmount || 0).toLocaleString()}`,
    rightAlignX,
    y,
    { align: "right" }
  );
  y += 6;
  y = line(y);

  const totalAmount = parseFloat(saleData.totalAmount || 0);
  const balance = parseFloat(saleData.balance || 0);
  const paidTotal =
    saleData.amountPaid != null
      ? parseFloat(saleData.amountPaid)
      : Math.max(0, totalAmount - balance);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAID", margin, y);
  y += 5;
  doc.text(`ETB ${paidTotal.toLocaleString()}`, margin, y);
  y += 5;
  if (balance > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Balance Due: ETB ${balance.toLocaleString()}`, margin, y);
    y += 6;
  }

  try {
    const qrText = [
      `Receipt: ${saleData.receiptNumber}`,
      `Cashier: ${saleData.cashierName || "N/A"}`,
      `Customer: ${capitalizeName(saleData.customerName)}`,
      buildItemDescription(saleData),
      `Amount: ETB ${saleData.totalAmount}`,
    ].join("\n");
    const qrDataUrl = await QRCode.toDataURL(qrText);
    doc.addImage(qrDataUrl, "PNG", centerX - 10, y, 20, 20);
    y += 24;
  } catch (err) {
    console.error("QR Generation failed", err);
  }

  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("Thank you for choosing Legasona Motors!", centerX, y, { align: "center" });
  doc.text("Computer-generated receipt.", centerX, y + 4, { align: "center" });

  const fileName = `Receipt-${saleData.receiptNumber}.pdf`;
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();
  if (isNative) {
    try {
      const blob = doc.output('blob');
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache
        });
        await Share.share({
          title: 'Receipt',
          text: `Receipt ${saleData.receiptNumber}`,
          url: saved.uri,
          dialogTitle: 'Save or share receipt'
        });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to save receipt on device', err);
    }
  } else {
    doc.save(fileName);
  }
};

export enum DocumentType {
  COO = 'COO',
  COA = 'COA',
  HEALTH = 'Health/Veterinary',
  HALAL = 'MUI Halal certified',
  HALAL_SINGAPORE = 'MUI Singapore Halal Certified',
  HALAL_JAKIM = 'Jakim Halal Certified',
  RADIOACTIVITY = 'Radioactivity',
  WAIVER = 'Waiver',
  PACKING_LIST = 'Packing list',
  OTHER = 'Other customs documents',
  BL = 'B / L',
  BL_TELEX = 'B / L Telex release',
  BOOKING_SHEET = 'Booking sheet',
  EUR1 = 'EUR1',
  INVOICE = 'Invoice',
  INVOICE_COMMERCIAL = 'Commercial invoice / packing list',
  KOSHER = 'Kosher',
  BL_MASTER = 'Master B / L',
  MSDS = 'MSDS',
  SHIPPING_LABELS = 'Shipping Labels',
  WAREHOUSE_RECEIPT = 'Warehouse Receipt',
  IMPORT_PERMIT = 'Import Permit',
  QUALITY_CERTIFICATE = 'Quality Certification',
  SEAWAY_BILL = 'Seaway Bill',
}

export function getDocumentTypes(): Record<string, string> {
  const result = {};
  Object.entries(DocumentType).map(([key, value]) => Object.assign(result, { [key]: value }));
  return result;
}

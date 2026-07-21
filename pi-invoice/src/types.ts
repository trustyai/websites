export type DocType = 'PI' | 'Invoice';

export interface Party {
  name: string;
  address: string;
  contact: string;
  email: string;
  phone: string;
  taxId: string;
}

export interface LineItem {
  id: string;
  name: string;
  model: string;
  /** Free-form equipment parameters / specs */
  parameters: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  imageUrl: string;
  videoUrl: string;
  remarks: string;
}

export interface DocumentData {
  type: DocType;
  number: string;
  date: string;
  currency: string;
  seller: Party;
  buyer: Party;
  items: LineItem[];
  paymentTerms: string;
  deliveryTerms: string;
  validity: string;
  bankInfo: string;
  notes: string;
}

export function emptyParty(): Party {
  return {
    name: '',
    address: '',
    contact: '',
    email: '',
    phone: '',
    taxId: '',
  };
}

export function createLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    model: '',
    parameters: '',
    quantity: 1,
    unit: 'SET',
    unitPrice: 0,
    imageUrl: '',
    videoUrl: '',
    remarks: '',
  };
}

export function createEmptyDocument(type: DocType = 'PI'): DocumentData {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = type === 'PI' ? 'PI' : 'INV';
  const stamp = today.replace(/-/g, '');
  return {
    type,
    number: `${prefix}-${stamp}-001`,
    date: today,
    currency: 'USD',
    seller: {
      name: '',
      address: '',
      contact: '',
      email: '',
      phone: '',
      taxId: '',
    },
    buyer: emptyParty(),
    items: [createLineItem()],
    paymentTerms: 'T/T 30% deposit, 70% before shipment',
    deliveryTerms: 'FOB Shenzhen',
    validity: type === 'PI' ? '15 days' : '',
    bankInfo: '',
    notes: '',
  };
}

export function lineAmount(item: LineItem): number {
  return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
}

export function documentTotal(doc: DocumentData): number {
  return doc.items.reduce((sum, item) => sum + lineAmount(item), 0);
}

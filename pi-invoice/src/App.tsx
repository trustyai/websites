import { useEffect, useState, type FormEvent } from 'react';
import type { DocumentData, LineItem, Party } from './types';
import {
  createEmptyDocument,
  createLineItem,
  documentTotal,
  lineAmount,
} from './types';
import { formatMoney, safeUrl } from './lib/format';
import { loadDraft, saveDraft } from './lib/storage';
import './App.css';

export default function App() {
  const [doc, setDoc] = useState<DocumentData>(() => loadDraft());
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    saveDraft(doc);
  }, [doc]);

  useEffect(() => {
    if (!expandedId && doc.items[0]) {
      setExpandedId(doc.items[0].id);
    }
  }, [doc.items, expandedId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  function updateDoc<K extends keyof DocumentData>(key: K, value: DocumentData[K]) {
    setDoc((prev) => ({ ...prev, [key]: value }));
  }

  function updateParty(side: 'seller' | 'buyer', patch: Partial<Party>) {
    setDoc((prev) => ({
      ...prev,
      [side]: { ...prev[side], ...patch },
    }));
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setDoc((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addItem() {
    const item = createLineItem();
    setDoc((prev) => ({ ...prev, items: [...prev.items, item] }));
    setExpandedId(item.id);
  }

  function removeItem(id: string) {
    setDoc((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((i) => i.id !== id) };
    });
  }

  function switchType(type: DocumentData['type']) {
    setDoc((prev) => {
      const next = { ...prev, type };
      const oldPrefix = prev.type === 'PI' ? 'PI' : 'INV';
      const newPrefix = type === 'PI' ? 'PI' : 'INV';
      if (prev.number.startsWith(oldPrefix)) {
        next.number = prev.number.replace(oldPrefix, newPrefix);
      }
      if (type === 'PI' && !prev.validity) next.validity = '15 days';
      return next;
    });
  }

  function resetDoc() {
    if (!window.confirm('Clear the current draft and start a new document?')) return;
    const next = createEmptyDocument(doc.type);
    setDoc(next);
    setExpandedId(next.items[0]?.id ?? null);
    setToast('New draft ready');
  }

  async function handleExport(kind: 'pdf' | 'excel') {
    setBusy(kind);
    try {
      if (kind === 'pdf') {
        const { exportPdf } = await import('./lib/exportPdf');
        await exportPdf(doc);
      } else {
        const { exportExcel } = await import('./lib/exportExcel');
        await exportExcel(doc);
      }
      setToast(kind === 'pdf' ? 'PDF downloaded' : 'Excel downloaded');
    } catch (err) {
      console.error(err);
      setToast('Export failed — check console');
    } finally {
      setBusy(null);
    }
  }

  function loadSample() {
    const items = [
      {
        id: crypto.randomUUID(),
        name: 'Automatic Carton Sealing Machine',
        model: 'KP-FX-450',
        parameters:
          'Power: 220V / 50Hz / 1.5kW\nCapacity: 20–40 cartons/min\nMachine size: 1800×900×1450 mm\nWeight: 420 kg',
        quantity: 2,
        unit: 'SET',
        unitPrice: 2850,
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        remarks: 'Includes spare belts',
      },
      {
        id: crypto.randomUUID(),
        name: 'Semi-auto Strapping Machine',
        model: 'KP-ST-200',
        parameters:
          'Strap width: 9–15 mm\nTension: adjustable\nTable height: 750 mm\nPower: 0.75 kW',
        quantity: 1,
        unit: 'SET',
        unitPrice: 1680,
        imageUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800',
        videoUrl: 'https://vimeo.com/347119375',
        remarks: '',
      },
    ];
    setDoc({
      type: 'PI',
      number: `PI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-DEMO`,
      date: new Date().toISOString().slice(0, 10),
      currency: 'USD',
      seller: {
        name: 'Dongguan Kingpack Machinery Co., Ltd.',
        address: 'Dongguan, Guangdong, China',
        contact: 'Bruce',
        email: 'bruce@dgkingpack.com',
        phone: '+86-0000-0000000',
        taxId: '',
      },
      buyer: {
        name: 'Sample Buyer Trading LLC',
        address: '123 Commerce Ave, Rotterdam, Netherlands',
        contact: 'Purchase Dept.',
        email: 'buyer@example.com',
        phone: '+31-00-0000000',
        taxId: 'NL000000000B00',
      },
      items,
      paymentTerms: 'T/T 30% deposit, 70% before shipment',
      deliveryTerms: 'FOB Shenzhen',
      validity: '15 days',
      bankInfo:
        'Beneficiary: Dongguan Kingpack Machinery Co., Ltd.\nBank: Bank of China\nAccount: 0000 0000 0000\nSWIFT: BKCHCNBJXXX',
      notes: 'Wooden case packing. Lead time 25–30 days after deposit.',
    });
    setExpandedId(items[0].id);
    setToast('Sample document loaded');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
  }

  const total = documentTotal(doc);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <p className="brand-name">Kingpack Docs</p>
            <p className="brand-sub">PI &amp; Invoice with equipment media</p>
          </div>
        </div>

        <div className="type-toggle" role="group" aria-label="Document type">
          <button
            type="button"
            className={doc.type === 'PI' ? 'active' : ''}
            onClick={() => switchType('PI')}
          >
            Proforma Invoice
          </button>
          <button
            type="button"
            className={doc.type === 'Invoice' ? 'active' : ''}
            onClick={() => switchType('Invoice')}
          >
            Commercial Invoice
          </button>
        </div>

        <div className="actions">
          <button type="button" className="ghost" onClick={loadSample}>
            Sample
          </button>
          <button type="button" className="ghost" onClick={resetDoc}>
            New
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!!busy}
            onClick={() => handleExport('excel')}
          >
            {busy === 'excel' ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!!busy}
            onClick={() => handleExport('pdf')}
          >
            {busy === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </header>

      <main className="layout">
        <form className="editor" onSubmit={onSubmit}>
          <section className="panel meta-panel">
            <h2>Document</h2>
            <div className="grid-3">
              <label>
                <span>Number</span>
                <input
                  value={doc.number}
                  onChange={(e) => updateDoc('number', e.target.value)}
                  required
                />
              </label>
              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={doc.date}
                  onChange={(e) => updateDoc('date', e.target.value)}
                />
              </label>
              <label>
                <span>Currency</span>
                <select
                  value={doc.currency}
                  onChange={(e) => updateDoc('currency', e.target.value)}
                >
                  {['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'AUD'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid-2">
              <label>
                <span>Payment terms</span>
                <input
                  value={doc.paymentTerms}
                  onChange={(e) => updateDoc('paymentTerms', e.target.value)}
                  placeholder="T/T 30% deposit, 70% before shipment"
                />
              </label>
              <label>
                <span>Delivery terms</span>
                <input
                  value={doc.deliveryTerms}
                  onChange={(e) => updateDoc('deliveryTerms', e.target.value)}
                  placeholder="FOB Shenzhen / CIF Rotterdam"
                />
              </label>
              {doc.type === 'PI' && (
                <label>
                  <span>Validity</span>
                  <input
                    value={doc.validity}
                    onChange={(e) => updateDoc('validity', e.target.value)}
                    placeholder="15 days"
                  />
                </label>
              )}
            </div>
          </section>

          <section className="parties">
            <PartyBlock
              title="Seller / Exporter"
              party={doc.seller}
              onChange={(p) => updateParty('seller', p)}
            />
            <PartyBlock
              title="Buyer / Consignee"
              party={doc.buyer}
              onChange={(p) => updateParty('buyer', p)}
            />
          </section>

          <section className="panel items-panel">
            <div className="panel-head">
              <div>
                <h2>Equipment line items</h2>
                <p className="hint">
                  Add parameters, image URL and video URL for each machine. Exported PDF / Excel
                  keep clickable links so customers can open every video.
                </p>
              </div>
              <button type="button" className="secondary" onClick={addItem}>
                + Add item
              </button>
            </div>

            <ul className="item-list">
              {doc.items.map((item, index) => {
                const open = expandedId === item.id;
                const videoOk = !!safeUrl(item.videoUrl);
                const imageOk = !!safeUrl(item.imageUrl);
                return (
                  <li key={item.id} className={`item ${open ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="item-summary"
                      onClick={() => setExpandedId(open ? null : item.id)}
                      aria-expanded={open}
                    >
                      <span className="idx">{index + 1}</span>
                      <span className="summary-text">
                        <strong>{item.name || 'Untitled equipment'}</strong>
                        <em>
                          {item.model ? `${item.model} · ` : ''}
                          {item.quantity} {item.unit} ·{' '}
                          {formatMoney(lineAmount(item), doc.currency)}
                        </em>
                      </span>
                      <span className="media-badges">
                        {videoOk && <span className="badge video">Video</span>}
                        {imageOk && <span className="badge image">Image</span>}
                        {!videoOk && !imageOk && <span className="badge muted">No media</span>}
                      </span>
                      <span className="chevron" aria-hidden>
                        {open ? '−' : '+'}
                      </span>
                    </button>

                    {open && (
                      <div className="item-body">
                        <div className="grid-2">
                          <label>
                            <span>Product / equipment name</span>
                            <input
                              value={item.name}
                              onChange={(e) => updateItem(item.id, { name: e.target.value })}
                              placeholder="Automatic carton sealing machine"
                            />
                          </label>
                          <label>
                            <span>Model</span>
                            <input
                              value={item.model}
                              onChange={(e) => updateItem(item.id, { model: e.target.value })}
                              placeholder="KP-FX-450"
                            />
                          </label>
                        </div>

                        <label>
                          <span>Equipment parameters</span>
                          <textarea
                            rows={4}
                            value={item.parameters}
                            onChange={(e) =>
                              updateItem(item.id, { parameters: e.target.value })
                            }
                            placeholder={
                              'Power: 220V/50Hz/1.5kW\nCapacity: 20–40 cartons/min\nMachine size: 1800×900×1450 mm\nWeight: 420 kg'
                            }
                          />
                        </label>

                        <div className="grid-3">
                          <label>
                            <span>Quantity</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  quantity: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>Unit</span>
                            <input
                              value={item.unit}
                              onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                              placeholder="SET"
                            />
                          </label>
                          <label>
                            <span>Unit price ({doc.currency})</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  unitPrice: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </label>
                        </div>

                        <div className="media-fields">
                          <label>
                            <span>Video link</span>
                            <input
                              type="url"
                              value={item.videoUrl}
                              onChange={(e) =>
                                updateItem(item.id, { videoUrl: e.target.value })
                              }
                              placeholder="https://youtube.com/watch?v=… or cloud video URL"
                            />
                            {item.videoUrl && (
                              <a
                                className="url-preview"
                                href={safeUrl(item.videoUrl) || undefined}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {videoOk ? 'Open video ↗' : 'Invalid URL'}
                              </a>
                            )}
                          </label>
                          <label>
                            <span>Image link</span>
                            <input
                              type="url"
                              value={item.imageUrl}
                              onChange={(e) =>
                                updateItem(item.id, { imageUrl: e.target.value })
                              }
                              placeholder="https://…/machine-photo.jpg"
                            />
                            {item.imageUrl && (
                              <a
                                className="url-preview"
                                href={safeUrl(item.imageUrl) || undefined}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {imageOk ? 'Open image ↗' : 'Invalid URL'}
                              </a>
                            )}
                          </label>
                        </div>

                        {imageOk && (
                          <div className="thumb-wrap">
                            <img
                              src={item.imageUrl}
                              alt={item.name || 'Equipment'}
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        <label>
                          <span>Remarks</span>
                          <input
                            value={item.remarks}
                            onChange={(e) => updateItem(item.id, { remarks: e.target.value })}
                            placeholder="Optional notes for this line"
                          />
                        </label>

                        <div className="item-footer">
                          <p className="line-total">
                            Line total:{' '}
                            <strong>{formatMoney(lineAmount(item), doc.currency)}</strong>
                          </p>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => removeItem(item.id)}
                            disabled={doc.items.length <= 1}
                          >
                            Remove item
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel">
            <h2>Bank &amp; notes</h2>
            <label>
              <span>Bank information</span>
              <textarea
                rows={4}
                value={doc.bankInfo}
                onChange={(e) => updateDoc('bankInfo', e.target.value)}
                placeholder={
                  'Beneficiary: …\nBank name: …\nAccount No.: …\nSWIFT: …'
                }
              />
            </label>
            <label>
              <span>Additional notes</span>
              <textarea
                rows={3}
                value={doc.notes}
                onChange={(e) => updateDoc('notes', e.target.value)}
                placeholder="Packing, warranty, inspection, or other remarks"
              />
            </label>
          </section>
        </form>

        <aside className="preview" aria-label="Document preview">
          <div className="preview-sheet">
            <p className="preview-kicker">
              {doc.type === 'PI' ? 'Proforma Invoice' : 'Commercial Invoice'}
            </p>
            <h1>{doc.number || '—'}</h1>
            <p className="preview-meta">
              {doc.date} · {doc.currency}
            </p>

            <div className="preview-parties">
              <div>
                <span>From</span>
                <strong>{doc.seller.name || 'Seller'}</strong>
              </div>
              <div>
                <span>To</span>
                <strong>{doc.buyer.name || 'Buyer'}</strong>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item, i) => (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{item.name || 'Untitled'}</strong>
                      {item.model && <small>{item.model}</small>}
                      <span className="preview-links">
                        {safeUrl(item.videoUrl) && (
                          <a href={item.videoUrl} target="_blank" rel="noreferrer">
                            Video
                          </a>
                        )}
                        {safeUrl(item.imageUrl) && (
                          <a href={item.imageUrl} target="_blank" rel="noreferrer">
                            Image
                          </a>
                        )}
                      </span>
                    </td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>{formatMoney(lineAmount(item), doc.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="preview-total">
              Total <strong>{formatMoney(total, doc.currency)}</strong>
            </p>

            <p className="preview-tip">
              Exports include a media section / sheet where every equipment video and image is a
              clickable link.
            </p>
          </div>
        </aside>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function PartyBlock({
  title,
  party,
  onChange,
}: {
  title: string;
  party: Party;
  onChange: (patch: Partial<Party>) => void;
}) {
  return (
    <section className="panel party-panel">
      <h2>{title}</h2>
      <label>
        <span>Company name</span>
        <input
          value={party.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Company Ltd."
        />
      </label>
      <label>
        <span>Address</span>
        <textarea
          rows={2}
          value={party.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Street, city, country"
        />
      </label>
      <div className="grid-2">
        <label>
          <span>Contact</span>
          <input
            value={party.contact}
            onChange={(e) => onChange({ contact: e.target.value })}
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            value={party.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={party.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </label>
        <label>
          <span>Tax / VAT ID</span>
          <input
            value={party.taxId}
            onChange={(e) => onChange({ taxId: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}

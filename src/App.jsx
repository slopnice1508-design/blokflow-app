import React, { useEffect, useMemo, useRef, useState } from 'react';

const starterDevices = [
  {
    id: 'BLK-001',
    type: 'BLOKFLOW Basic',
    pump: 'Panasonic Aquarea 7 kW',
    serial: 'BF-2026-001',
    client: 'Anna Malinowska',
    clientId: 'CLI-1',
    installer: 'Klima Serwis Gdańsk',
    nextService: '2027-02-10',
    status: 'Aktywne',
    note: '',
  },
];

const DEFAULT_USE_LIVE_API = true;
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxFp8d5tzAy49jOFwIzkPinELhulapff0KHvBJJT0Nu68UhmvnDz5Bp85BT8VnbaXvSFQ/exec';

const INSTALLERS_SHEET = 'INSTALATORZY';
const CLIENTS_SHEET = 'KLIENCI';
const DEVICES_SHEET = 'URZADZENIA';
const SERVICE_SHEET = 'SERWIS';

const INSTALLERS_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(INSTALLERS_SHEET)}`;
const CLIENTS_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(CLIENTS_SHEET)}`;
const DEVICES_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(DEVICES_SHEET)}`;
const SERVICE_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(SERVICE_SHEET)}`;

function Card({ children, id, style, onClick }) {
  return (
    <div
      id={id}
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardContent({ children, style }) {
  return <div style={{ padding: 18, ...style }}>{children}</div>;
}

function FieldLabel({ children }) {
  return <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{children}</label>;
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '12px 14px',
        border: '1px solid #d1d5db',
        borderRadius: 12,
        fontSize: 14,
        ...(props.style || {}),
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        minHeight: 92,
        padding: '12px 14px',
        border: '1px solid #d1d5db',
        borderRadius: 12,
        fontSize: 14,
        resize: 'vertical',
        ...(props.style || {}),
      }}
    />
  );
}

function SelectInput(props) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '12px 14px',
        border: '1px solid #d1d5db',
        borderRadius: 12,
        fontSize: 14,
        background: '#fff',
        ...(props.style || {}),
      }}
    />
  );
}

function Button({ children, variant = 'secondary', ...props }) {
  const base = {
    padding: '12px 14px',
    borderRadius: 12,
    fontSize: 14,
    cursor: 'pointer',
    border: '1px solid #d1d5db',
  };
  const variants = {
    primary: { background: '#111827', color: '#fff', borderColor: '#111827' },
    secondary: { background: '#fff', color: '#111827' },
    ghost: { background: '#f8fafc', color: '#111827' },
    pill: { background: '#fff', color: '#111827', borderRadius: 999 },
    activePill: { background: '#111827', color: '#fff', borderColor: '#111827', borderRadius: 999 },
  };
  return (
    <button {...props} style={{ ...base, ...(variants[variant] || variants.secondary), ...(props.style || {}) }}>
      {children}
    </button>
  );
}

function Badge({ children, tone = 'default' }) {
  const tones = {
    default: { background: '#eef2ff', color: '#3730a3' },
    premium: { background: '#fef3c7', color: '#92400e' },
    active: { background: '#dcfce7', color: '#166534' },
    new: { background: '#dbeafe', color: '#1d4ed8' },
    red: { background: '#fef2f2', color: '#b91c1c' },
    orange: { background: '#fff7ed', color: '#c2410c' },
    green: { background: '#ecfdf5', color: '#047857' },
    gray: { background: '#f8fafc', color: '#475569' },
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        ...(tones[tone] || tones.default),
      }}
    >
      {children}
    </span>
  );
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardContent>
        <div style={{ fontSize: 14, color: '#64748b' }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{value}</div>
      </CardContent>
    </Card>
  );
}

function toYes(value) {
  if (value === true) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['tak', 'true', '1', 'yes', 'y', 'premium', 'aktywny', 'nowy'].includes(normalized);
}

function ensureArray(payload) {
  return Array.isArray(payload) ? payload : [];
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function parseDateOnly(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getServiceDiffDays(value) {
  const serviceDate = parseDateOnly(value);
  if (!serviceDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((serviceDate - today) / (1000 * 60 * 60 * 24));
}

function getReminderLabel(value) {
  const diffDays = getServiceDiffDays(value);
  if (diffDays === null) return '';
  if (diffDays < 0) return 'Po terminie';
  if (diffDays === 0) return 'Dzisiaj';
  if (diffDays <= 7) return 'Pilne';
  if (diffDays <= 30) return 'W ciągu 30 dni';
  return '';
}

function addMonthsToDateString(value, months = 12) {
  const parsed = parseDateOnly(value);
  if (!parsed) return '';
  const shifted = new Date(parsed.getFullYear(), parsed.getMonth() + months, parsed.getDate());
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}

function scrollToId(id) {
  const node = document.getElementById(id);
  if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function fetchSheetData(url) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { Accept: 'application/json, text/plain;q=0.9,*/*;q=0.8' },
  });

  const rawText = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${rawText || 'Brak odpowiedzi serwera'}`);

  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.error) {
      throw new Error(String(parsed.error));
    }
    return ensureArray(parsed);
  } catch {
    throw new Error(`Nie udało się odczytać JSON z API. Odpowiedź: ${rawText.slice(0, 300)}`);
  }
}

async function postSheetData(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${rawText || 'Brak odpowiedzi serwera'}`);

  const parsed = JSON.parse(rawText);
  if (parsed && typeof parsed === 'object' && parsed.ok === false) {
    throw new Error(parsed.error || 'Apps Script odrzucił zapis.');
  }
  return parsed;
}

function mapInstaller(row, index) {
  return {
    id: row['ID INSTALATORA'] || `INS-${index + 1}`,
    company: row['Nazwa Firmy'] || '',
    owner: row['Imię i Nazwisko'] || '',
    phone: row['Telefon'] || '',
    email: row['E-mail'] || '',
    city: row['Miasto'] || '',
    region: row['Województwo'] || '',
    type: row['Typ instalatora'] || 'Pompy ciepła',
    plan: toYes(row['status premium']) ? 'Premium' : toYes(row['status aktywny']) ? 'Aktywny' : toYes(row['status nowy']) ? 'Nowy' : 'Brak',
    registrationDate: row['Data rejestracji'] || '',
  };
}

function mapClient(row, index) {
  return {
    id: row['ID KLIENTA'] || `CLI-${index + 1}`,
    name: row['Imię i Nazwisko'] || row['Nazwa klienta'] || row['Klient'] || '',
    city: row['Miasto'] || '',
    phone: row['Telefon'] || '',
    address: row['Adres'] || row['Adres montażu'] || '',
    installer: row['Instalator'] || row['Nazwa Firmy'] || '',
    source: row['Źródło'] || row['Zrodlo'] || 'Formularz',
    note: row['Notatka'] || '',
  };
}

function mapDevice(row, index) {
  const nextService = row['Termin przeglądu'] || row['Termin pierwszego przeglądu'] || row['Termin przegladu'] || '';
  return {
    id: row['ID URZĄDZENIA'] || row['ID URZADZENIA'] || `BLK-${index + 1}`,
    type: row['Typ'] || row['Typ urządzenia'] || row['Typ urzadzenia'] || 'BLOKFLOW',
    client: row['Klient'] || row['Imię i Nazwisko'] || row['Nazwa klienta'] || '',
    clientId: row['ID KLIENTA'] || row['Klient ID'] || row['Client ID'] || '',
    installer: row['Instalator'] || row['Nazwa Firmy'] || '',
    serial: row['Numer seryjny'] || row['Nr seryjny'] || row['Serial'] || '',
    status: row['Status'] || 'Aktywne',
    pump: row['Model'] || row['Pompa'] || row['Model / Pompa'] || row['Model / pompa'] || '',
    nextService,
    reminder: getReminderLabel(nextService),
    note: row['Notatka'] || row['Notatka montażowa'] || '',
  };
}

function mapServiceTicket(row, index) {
  const nextService = row['Następny przegląd'] || row['Nastepny przeglad'] || '';
  return {
    id: row['ID SERWISU'] || `SER-${index + 1}`,
    client: row['Klient'] || '',
    device: row['Urządzenie'] || '',
    kind: row['Typ zgłoszenia'] || 'Serwis',
    priority: row['Priorytet'] || 'Niski',
    description: row['Opis'] || '',
    preferredDate: row['Preferowany termin'] || '',
    nextService,
    status: row['Status'] || 'Nowe',
  };
}

function ReminderBlock({ title, items, tone }) {
  const toneMap = { red: 'red', orange: 'orange', green: 'green', gray: 'gray' };
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 14, color: '#64748b' }}>Brak.</div>
        ) : (
          items.map((r) => (
            <div key={`${title}-${r.id}`} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.client || 'Brak klienta'}</div>
                  <div style={{ fontSize: 14, color: '#64748b' }}>{r.type}</div>
                  {r.serial ? <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Nr seryjny: {r.serial}</div> : null}
                </div>
                <Badge tone={toneMap[tone] || 'gray'}>{r.level}</Badge>
              </div>
              <div style={{ fontSize: 14, marginTop: 10 }}>Termin przeglądu: {r.nextService}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {r.diffDays < 0 ? `Opóźnienie: ${Math.abs(r.diffDays)} dni` : r.diffDays === 0 ? 'Przegląd dzisiaj' : `Za ${r.diffDays} dni`}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ClientCardModal({ client, devices, serviceTickets, onClose, onAddService }) {
  const safeText = (value) => String(value ?? '').trim().toLowerCase();
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({
    serviceDate: todayString,
    serviceType: 'Przegląd',
    note: '',
    deviceSerial: '',
    nextService: addMonthsToDateString(todayString, 12),
  });

  useEffect(() => {
    setShowServiceForm(false);
    setServiceDraft({
      serviceDate: todayString,
      serviceType: 'Przegląd',
      note: '',
      deviceSerial: '',
      nextService: addMonthsToDateString(todayString, 12),
    });
  }, [client]);

  if (!client) return null;

  const clientName = safeText(client?.name);
  const clientDevices = (Array.isArray(devices) ? devices : []).filter((d) => {
    const byId = client?.id && d?.clientId && String(d.clientId) === String(client.id);
    const byName = safeText(d?.client) === clientName;
    return byId || byName;
  });
  const clientServices = (Array.isArray(serviceTickets) ? serviceTickets : []).filter((s) => {
    const byClient = safeText(s?.client) === clientName;
    const byDevice = clientDevices.some((d) => safeText(d?.serial) && safeText(d?.serial) === safeText(s?.device));
    return byClient || byDevice;
  });

  async function handleSubmitClientService() {
    const chosenDevice = clientDevices.find((d) => String(d?.serial || '') === String(serviceDraft.deviceSerial || ''));
    await onAddService({
      clientName: client.name || '',
      deviceSerial: serviceDraft.deviceSerial,
      deviceLabel: chosenDevice ? `${chosenDevice.type}${chosenDevice.serial ? ` / ${chosenDevice.serial}` : ''}` : serviceDraft.deviceSerial,
      serviceType: serviceDraft.serviceType,
      serviceDate: serviceDraft.serviceDate,
      note: serviceDraft.note,
      nextService: serviceDraft.nextService,
    });
    setShowServiceForm(false);
    setServiceDraft({
      serviceDate: todayString,
      serviceType: 'Przegląd',
      note: '',
      deviceSerial: '',
      nextService: addMonthsToDateString(todayString, 12),
    });
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(15,23,42,0.2)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Karta klienta</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Wszystkie najważniejsze dane w jednym miejscu.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => setShowServiceForm((prev) => !prev)}>{showServiceForm ? 'Ukryj formularz serwisu' : 'Dodaj serwis'}</Button>
            <Button onClick={onClose}>Zamknij</Button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {showServiceForm ? (
            <Card>
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Nowy wpis serwisowy</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                    <div>
                      <FieldLabel>Data serwisu</FieldLabel>
                      <TextInput type="date" value={serviceDraft.serviceDate} onChange={(e) => setServiceDraft((prev) => ({ ...prev, serviceDate: e.target.value, nextService: addMonthsToDateString(e.target.value, 12) || prev.nextService }))} />
                    </div>
                    <div>
                      <FieldLabel>Typ serwisu</FieldLabel>
                      <TextInput value={serviceDraft.serviceType} onChange={(e) => setServiceDraft((prev) => ({ ...prev, serviceType: e.target.value }))} placeholder="np. Przegląd" />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Urządzenie klienta</FieldLabel>
                    <SelectInput value={serviceDraft.deviceSerial} onChange={(e) => setServiceDraft((prev) => ({ ...prev, deviceSerial: e.target.value }))}>
                      <option value="">Wybierz urządzenie</option>
                      {clientDevices.map((d) => (
                        <option key={d.id} value={d.serial || ''}>{d.type}{d.serial ? ` / ${d.serial}` : ''}</option>
                      ))}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Następny przegląd</FieldLabel>
                    <TextInput type="date" value={serviceDraft.nextService} onChange={(e) => setServiceDraft((prev) => ({ ...prev, nextService: e.target.value }))} />
                  </div>
                  <div>
                    <FieldLabel>Notatka serwisowa</FieldLabel>
                    <TextArea placeholder="Co zostało zrobione, co wymaga obserwacji, jakie były uwagi" value={serviceDraft.note} onChange={(e) => setServiceDraft((prev) => ({ ...prev, note: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    <Button onClick={() => setShowServiceForm(false)}>Anuluj</Button>
                    <Button variant="primary" onClick={handleSubmitClientService}>Zapisz serwis</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{client.name || 'Klient bez nazwy'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Telefon</div><div style={{ fontSize: 14 }}>{client.phone || 'Brak'}</div></div>
                <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Miasto</div><div style={{ fontSize: 14 }}>{client.city || 'Brak'}</div></div>
                <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Adres</div><div style={{ fontSize: 14 }}>{client.address || 'Brak'}</div></div>
                <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Źródło</div><div style={{ fontSize: 14 }}>{client.source || 'Brak'}</div></div>
              </div>
              {client.note ? <div style={{ marginTop: 14 }}><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Notatka</div><div style={{ fontSize: 14 }}>{client.note}</div></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Urządzenia klienta</div>
                <Badge tone="gray">{clientDevices.length}</Badge>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {clientDevices.length === 0 ? (
                  <div style={{ fontSize: 14, color: '#64748b' }}>Brak urządzeń przypisanych do tego klienta.</div>
                ) : (
                  clientDevices.map((d) => (
                    <div key={d.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{d.type}</div>
                          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{d.pump || 'Brak modelu'}</div>
                        </div>
                        <Badge tone={d.reminder === 'Po terminie' ? 'red' : d.reminder === 'Dzisiaj' ? 'green' : d.reminder === 'Pilne' ? 'orange' : d.reminder === 'W ciągu 30 dni' ? 'gray' : 'default'}>{d.reminder || d.status || 'Aktywne'}</Badge>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 12 }}>
                        <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Numer seryjny</div><div style={{ fontSize: 14 }}>{d.serial || 'Brak'}</div></div>
                        <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Termin przeglądu</div><div style={{ fontSize: 14 }}>{d.nextService || 'Brak'}</div></div>
                        <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Status</div><div style={{ fontSize: 14 }}>{d.status || 'Brak'}</div></div>
                      </div>
                      {d.note ? <div style={{ marginTop: 12 }}><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Notatka</div><div style={{ fontSize: 14 }}>{d.note}</div></div> : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Historia serwisów</div>
                <Badge tone="gray">{clientServices.length}</Badge>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {clientServices.length === 0 ? (
                  <div style={{ fontSize: 14, color: '#64748b' }}>Brak zgłoszeń serwisowych dla tego klienta.</div>
                ) : (
                  clientServices.map((s) => (
                    <div key={s.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.kind}</div>
                          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{s.device || 'Brak urządzenia'}</div>
                        </div>
                        <Badge tone={s.priority === 'Pilny' ? 'red' : s.priority === 'Średni' ? 'orange' : 'gray'}>{s.priority || 'Niski'}</Badge>
                      </div>
                      {s.description ? <div style={{ fontSize: 14, marginTop: 10 }}>{s.description}</div> : null}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 12 }}>
                        <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Preferowany termin</div><div style={{ fontSize: 14 }}>{s.preferredDate || 'Brak'}</div></div>
                        <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Status</div><div style={{ fontSize: 14 }}>{s.status || 'Nowe'}</div></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function BlokflowPanel() {
  const [filterType, setFilterType] = useState('Wszyscy');
  const [viewMode, setViewMode] = useState('admin');
  const [adminTab, setAdminTab] = useState('instalatorzy');
  const [installers, setInstallers] = useState([]);
  const [clients, setClients] = useState([]);
  const [devices, setDevices] = useState(starterDevices);
  const [serviceTickets, setServiceTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState({ installers: false, clients: false, devices: false, service: false });
  const [errors, setErrors] = useState({ installers: '', clients: '', devices: '', service: '' });
  const [isConnected, setIsConnected] = useState(true);
  const [useLiveApi, setUseLiveApi] = useState(DEFAULT_USE_LIVE_API);
  const [submitState, setSubmitState] = useState({ type: '', message: '' });
  const [selectedClient, setSelectedClient] = useState(null);
  const hasLoadedRef = useRef(false);

  const [clientForm, setClientForm] = useState({ name: '', phone: '', city: '', address: '', source: 'Własny klient', note: '' });
  const [deviceForm, setDeviceForm] = useState({ type: 'BLOKFLOW Basic', client: '', clientId: '', serial: '', status: 'Aktywne', pump: '', nextService: '', reminderCycle: '12', note: '' });
  const [serviceForm, setServiceForm] = useState({ client: '', clientId: '', device: '', deviceSerial: '', kind: 'Przegląd', priority: 'Niski', description: '', preferredDate: '', nextService: '' });

  useEffect(() => {
    if (DEFAULT_USE_LIVE_API) {
      setUseLiveApi(true);
      setIsConnected(true);
    }
  }, []);

  useEffect(() => {
    if (!useLiveApi || !isConnected || hasLoadedRef.current) return;
    let cancelled = false;
    hasLoadedRef.current = true;

    async function loadAll() {
      setLoading({ installers: true, clients: true, devices: true, service: true });
      setErrors({ installers: '', clients: '', devices: '', service: '' });

      const [installersResult, clientsResult, devicesResult, serviceResult] = await Promise.allSettled([
        fetchSheetData(INSTALLERS_API),
        fetchSheetData(CLIENTS_API),
        fetchSheetData(DEVICES_API),
        fetchSheetData(SERVICE_API),
      ]);

      if (cancelled) return;

      if (installersResult.status === 'fulfilled') setInstallers(installersResult.value.map(mapInstaller));
      else setErrors((prev) => ({ ...prev, installers: installersResult.reason instanceof Error ? installersResult.reason.message : 'Nieznany błąd pobierania instalatorów.' }));

      if (clientsResult.status === 'fulfilled') setClients(clientsResult.value.map(mapClient));
      else setErrors((prev) => ({ ...prev, clients: clientsResult.reason instanceof Error ? clientsResult.reason.message : 'Nieznany błąd pobierania klientów.' }));

      if (devicesResult.status === 'fulfilled') setDevices(devicesResult.value.length > 0 ? devicesResult.value.map(mapDevice) : starterDevices);
      else setErrors((prev) => ({ ...prev, devices: devicesResult.reason instanceof Error ? devicesResult.reason.message : 'Nieznany błąd pobierania urządzeń.' }));

      if (serviceResult.status === 'fulfilled') setServiceTickets(serviceResult.value.map(mapServiceTicket));
      else setErrors((prev) => ({ ...prev, service: serviceResult.reason instanceof Error ? serviceResult.reason.message : 'Nieznany błąd pobierania serwisu.' }));

      setLoading({ installers: false, clients: false, devices: false, service: false });
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [isConnected, useLiveApi]);

  const filteredInstallers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return installers;
    return installers.filter((i) => [i.company, i.owner, i.city, i.region, i.phone, i.email, i.plan, i.type].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [installers, search]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => [c.name, c.city, c.phone, c.installer, c.source, c.address].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [clients, search]);

  const filteredDevices = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return devices;
    return devices.filter((d) => [d.type, d.client, d.installer, d.serial, d.status, d.pump].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [devices, search]);

  const installerQuickStats = useMemo(() => {
    const activeDevices = devices.filter((d) => (d.status || '').toLowerCase() !== 'nieaktywne').length;
    return { clients: clients.length, devices: devices.length, activeDevices };
  }, [clients, devices]);

  const upcomingReminders = useMemo(() => {
    return devices
      .map((d) => {
        const nextService = d.nextService || '';
        const diffDays = getServiceDiffDays(nextService);
        if (diffDays === null) return null;
        const level = diffDays < 0 ? 'Po terminie' : diffDays === 0 ? 'Dzisiaj' : diffDays <= 7 ? 'Pilne' : diffDays <= 30 ? 'W ciągu 30 dni' : '';
        if (!level) return null;
        return { id: d.id, client: d.client, type: d.type, serial: d.serial, nextService, diffDays, level };
      })
      .filter(Boolean)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [devices]);

  const groupedReminders = useMemo(() => ({
    overdue: upcomingReminders.filter((r) => r.level === 'Po terminie'),
    today: upcomingReminders.filter((r) => r.level === 'Dzisiaj'),
    week: upcomingReminders.filter((r) => r.level === 'Pilne'),
    month: upcomingReminders.filter((r) => r.level === 'W ciągu 30 dni'),
  }), [upcomingReminders]);

  function refreshLiveData() {
    hasLoadedRef.current = false;
    setIsConnected(false);
    setTimeout(() => setIsConnected(true), 50);
  }

  function resetClientForm() {
    setClientForm({ name: '', phone: '', city: '', address: '', source: 'Własny klient', note: '' });
  }

  function resetDeviceForm() {
    setDeviceForm({ type: 'BLOKFLOW Basic', client: '', clientId: '', serial: '', status: 'Aktywne', pump: '', nextService: '', note: '' });
  }

  function resetServiceForm() {
    setServiceForm({ client: '', clientId: '', device: '', deviceSerial: '', kind: 'Przegląd', priority: 'Niski', description: '', preferredDate: '', nextService: '' });
  }

  async function handleSaveClient() {
    if (!clientForm.name.trim()) {
      setSubmitState({ type: 'error', message: 'Uzupełnij nazwę klienta.' });
      return;
    }

    const record = {
      id: makeId('CLI'),
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim(),
      city: clientForm.city.trim(),
      address: clientForm.address.trim(),
      installer: 'Moja firma instalatorska',
      source: clientForm.source,
      note: clientForm.note.trim(),
    };

    try {
      if (useLiveApi) {
        await postSheetData({
          action: 'append',
          sheet: CLIENTS_SHEET,
          row: {
            'ID KLIENTA': record.id,
            'Imię i Nazwisko': record.name,
            Telefon: record.phone,
            Miasto: record.city,
            Adres: record.address,
            Instalator: record.installer,
            'Źródło': record.source,
            Notatka: record.note,
          },
        });
      }
      setClients((prev) => [record, ...prev]);
      resetClientForm();
      setSubmitState({ type: 'success', message: 'Klient został zapisany.' });
    } catch (error) {
      setSubmitState({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się zapisać klienta.' });
    }
  }

  async function handleSaveDevice() {
    if (!deviceForm.client.trim() || !deviceForm.type.trim()) {
      setSubmitState({ type: 'error', message: 'Wybierz klienta z listy i uzupełnij typ urządzenia.' });
      return;
    }

    const record = {
      id: makeId('BLK'),
      type: deviceForm.type.trim(),
      client: deviceForm.client.trim(),
      clientId: deviceForm.clientId || '',
      installer: 'Moja firma instalatorska',
      serial: deviceForm.serial.trim(),
      status: deviceForm.status.trim() || 'Aktywne',
      pump: deviceForm.pump.trim(),
      nextService: deviceForm.nextService.trim(),
      note: deviceForm.note.trim(),
      reminder: getReminderLabel(deviceForm.nextService.trim()),
    };

    try {
      if (useLiveApi) {
        await postSheetData({
          action: 'append',
          sheet: DEVICES_SHEET,
          row: {
            'Typ urządzenia': record.type,
            'ID KLIENTA': record.clientId,
            Klient: record.client,
            'Numer seryjny': record.serial,
            Status: record.status,
            'Model / Pompa': record.pump,
            'Termin przeglądu': record.nextService,
            Notatka: record.note,
          },
        });
      }
      setDevices((prev) => [record, ...prev]);
      resetDeviceForm();
      setSubmitState({ type: 'success', message: 'Urządzenie zostało zapisane.' });
    } catch (error) {
      setSubmitState({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się zapisać urządzenia.' });
    }
  }

  async function handleSaveService() {
    if (!serviceForm.clientId || !serviceForm.deviceSerial) {
      setSubmitState({ type: 'error', message: 'Wybierz klienta i urządzenie z listy.' });
      return;
    }

    const record = {
      id: makeId('SER'),
      client: serviceForm.client,
      device: serviceForm.deviceSerial,
      kind: serviceForm.kind.trim(),
      priority: serviceForm.priority.trim(),
      description: serviceForm.description.trim(),
      preferredDate: serviceForm.preferredDate.trim(),
      nextService: serviceForm.nextService.trim(),
      status: 'Nowe',
    };

    try {
      if (useLiveApi) {
        await postSheetData({
          action: 'append',
          sheet: SERVICE_SHEET,
          row: {
            'ID SERWISU': record.id,
            Klient: record.client,
            Urządzenie: record.device,
            'Typ zgłoszenia': record.kind,
            Priorytet: record.priority,
            Opis: record.description,
            'Preferowany termin': record.preferredDate,
            'Następny przegląd': record.nextService,
            Status: record.status,
          },
        });
      }
      setServiceTickets((prev) => [record, ...prev]);
      if (record.device && record.nextService) {
        setDevices((prev) => prev.map((device) => device.serial === record.device ? { ...device, nextService: record.nextService, reminder: getReminderLabel(record.nextService) } : device));
      }
      resetServiceForm();
      setSubmitState({ type: 'success', message: 'Zgłoszenie serwisowe zapisane poprawnie.' });
    } catch (error) {
      setSubmitState({ type: 'error', message: error instanceof Error ? error.message : 'Błąd zapisu serwisu.' });
    }
  }

  async function handleAddServiceFromClientCard(payload) {
    if (!payload.clientName || !payload.serviceType) {
      setSubmitState({ type: 'error', message: 'Brakuje danych do zapisu serwisu.' });
      return;
    }

    const descriptionLines = [
      payload.note ? `Notatka: ${payload.note}` : '',
      payload.serviceDate ? `Data serwisu: ${payload.serviceDate}` : '',
      payload.nextService ? `Następny przegląd: ${payload.nextService}` : '',
    ].filter(Boolean);

    const newService = {
      id: makeId('SER'),
      client: payload.clientName,
      device: payload.deviceLabel || payload.deviceSerial || '',
      kind: payload.serviceType,
      priority: 'Niski',
      description: descriptionLines.join(' | '),
      preferredDate: payload.serviceDate || '',
      status: 'Zapisane',
    };

    try {
      if (useLiveApi) {
        await postSheetData({
          action: 'append',
          sheet: SERVICE_SHEET,
          row: {
            'ID SERWISU': newService.id,
            Klient: newService.client,
            Urządzenie: newService.device,
            'Typ zgłoszenia': newService.kind,
            Priorytet: newService.priority,
            Opis: newService.description,
            'Preferowany termin': newService.preferredDate,
            Status: newService.status,
          },
        });
      }

      setServiceTickets((prev) => [newService, ...prev]);

      if (payload.deviceSerial && payload.nextService) {
        setDevices((prev) =>
          prev.map((device) =>
            device.serial === payload.deviceSerial
              ? { ...device, nextService: payload.nextService, reminder: getReminderLabel(payload.nextService) }
              : device
          )
        );
      }

      setSubmitState({ type: 'success', message: 'Serwis został dodany z karty klienta.' });
    } catch (error) {
      setSubmitState({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się zapisać serwisu z karty klienta.' });
    }
  }

  const clientCards = filteredClients.map((c) => (
    <Card key={c.id} onClick={() => setSelectedClient(c)} style={{ cursor: 'pointer' }}>
      <CardContent>
        <div style={{ fontWeight: 600 }}>{c.name}</div>
        <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{c.city || 'Brak miasta'}</div>
        {c.phone ? <div style={{ fontSize: 14, marginTop: 4 }}>{c.phone}</div> : null}
        <div style={{ marginTop: 10 }}><Badge>{c.source}</Badge></div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>Kliknij, aby otworzyć kartę klienta.</div>
      </CardContent>
    </Card>
  ));

  return (
    <div style={{ padding: 24, background: '#f5f7fb', minHeight: '100vh', color: '#111827' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>BLOKFLOW PANEL</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>Jeden system, dwa widoki: admin i instalator.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 4, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
            <Button variant={viewMode === 'admin' ? 'primary' : 'secondary'} onClick={() => setViewMode('admin')}>Panel admina</Button>
            <Button variant={viewMode === 'installer' ? 'primary' : 'secondary'} onClick={() => setViewMode('installer')}>Panel instalatora</Button>
          </div>
          <div style={{ minWidth: 260, maxWidth: 360, width: '100%' }}>
            <TextInput placeholder="Szukaj..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {submitState.message ? (
          <Card>
            <CardContent>
              <div style={{ fontSize: 14, color: submitState.type === 'error' ? '#b91c1c' : '#047857' }}>{submitState.message}</div>
            </CardContent>
          </Card>
        ) : null}

        {viewMode === 'admin' ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Button variant="primary" onClick={() => { setUseLiveApi(true); setIsConnected(true); hasLoadedRef.current = false; }}>Połącz z Google Sheets</Button>
              <div style={{ fontSize: 14, color: '#64748b' }}>Dane ładują się automatycznie, ten przycisk działa też jako odśwież.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
              <StatCard label="Instalatorzy" value={installers.length} />
              <StatCard label="Klienci" value={clients.length} />
              <StatCard label="Urządzenia" value={devices.length} />
              <StatCard label="Aktywni / Premium" value={installers.filter((i) => i.plan === 'Aktywny' || i.plan === 'Premium').length} />
            </div>

            <Card>
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Mapa instalatorów (MVP)</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {['Wszyscy', 'Pompy ciepła', 'Klimatyzacja'].map((t) => (
                    <Button key={t} variant={filterType === t ? 'activePill' : 'pill'} onClick={() => setFilterType(t)}>{t}</Button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  {installers.filter((i) => filterType === 'Wszyscy' || i.type === filterType).map((i) => (
                    <div key={i.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
                      <div style={{ fontWeight: 600 }}>{i.company}</div>
                      <div style={{ fontSize: 14, color: '#64748b' }}>{i.city}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{i.type}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['instalatorzy', 'klienci', 'urzadzenia', 'serwis'].map((tab) => (
                <Button key={tab} variant={tab === adminTab ? 'primary' : 'secondary'} onClick={() => setAdminTab(tab)}>
                  {tab === 'instalatorzy' ? 'Instalatorzy' : tab === 'klienci' ? 'Klienci' : tab === 'urzadzenia' ? 'Urządzenia' : 'Serwis'}
                </Button>
              ))}
            </div>

            {adminTab === 'instalatorzy' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {loading.installers ? <Card><CardContent><div style={{ fontSize: 14, color: '#64748b' }}>Ładowanie instalatorów...</div></CardContent></Card> : null}
                {errors.installers ? <Card><CardContent><div style={{ fontSize: 14, color: '#b91c1c' }}>Błąd pobierania instalatorów: {errors.installers}</div></CardContent></Card> : null}
                {filteredInstallers.map((i) => (
                  <Card key={i.id}>
                    <CardContent>
                      <div style={{ fontWeight: 600 }}>{i.company}</div>
                      {i.owner ? <div style={{ fontSize: 14 }}>{i.owner}</div> : null}
                      <div style={{ fontSize: 14 }}>{i.city}</div>
                      <div style={{ marginTop: 8 }}>
                        <Badge tone={i.plan === 'Premium' ? 'premium' : i.plan === 'Aktywny' ? 'active' : i.plan === 'Nowy' ? 'new' : 'default'}>{i.plan}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {adminTab === 'klienci' && <div style={{ display: 'grid', gap: 12 }}>{clientCards}</div>}

            {adminTab === 'urzadzenia' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredDevices.map((d) => (
                  <Card key={d.id}>
                    <CardContent>
                      <div style={{ fontWeight: 600 }}>{d.type}</div>
                      <div style={{ fontSize: 14 }}>Klient: {d.client || 'Brak danych'}</div>
                      <div style={{ fontSize: 14 }}>Termin przeglądu: {d.nextService || 'Brak'}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {adminTab === 'serwis' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {serviceTickets.length === 0 ? (
                  <Card><CardContent><div style={{ fontSize: 14, color: '#64748b' }}>Brak zgłoszeń serwisowych.</div></CardContent></Card>
                ) : null}
                {serviceTickets.map((s) => (
                  <Card key={s.id}>
                    <CardContent>
                      <div style={{ fontWeight: 600 }}>{s.kind}</div>
                      <div style={{ fontSize: 14 }}>Klient: {s.client}</div>
                      <div style={{ fontSize: 14 }}>Urządzenie: {s.device}</div>
                      <div style={{ fontSize: 14 }}>Priorytet: {s.priority}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <StatCard label="Moi klienci" value={installerQuickStats.clients} />
              <StatCard label="Urządzenia" value={installerQuickStats.devices} />
              <StatCard label="Aktywne" value={installerQuickStats.activeDevices} />
            </div>

            <Card>
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Zakładki instalatora</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  <Button onClick={() => scrollToId('clientForm')} style={{ textAlign: 'left' }}>Klienci</Button>
                  <Button onClick={() => scrollToId('deviceForm')} style={{ textAlign: 'left' }}>Urządzenia</Button>
                  <Button onClick={() => scrollToId('serviceForm')} style={{ textAlign: 'left' }}>Serwis</Button>
                  <Button onClick={() => scrollToId('remindersSection')} style={{ textAlign: 'left' }}>Przypomnienia</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Moi klienci</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {filteredClients.length === 0 ? <div style={{ fontSize: 14, color: '#64748b' }}>Brak klientów do wyświetlenia.</div> : clientCards}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Szybkie akcje instalatora</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  <Button variant="ghost" onClick={() => scrollToId('clientForm')} style={{ textAlign: 'left' }}>Dodaj klienta</Button>
                  <Button onClick={() => scrollToId('deviceForm')} style={{ textAlign: 'left' }}>Dodaj urządzenie</Button>
                  <Button onClick={() => scrollToId('serviceForm')} style={{ textAlign: 'left' }}>Zgłoś serwis</Button>
                  <Button onClick={() => scrollToId('remindersSection')} style={{ textAlign: 'left' }}>Moje przypomnienia</Button>
                  <Button onClick={refreshLiveData} style={{ textAlign: 'left', gridColumn: '1 / -1' }}>Odśwież dane</Button>
                </div>
              </CardContent>
            </Card>

            <Card id="clientForm">
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Dodaj klienta</div>
                <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Mobilny formularz dla instalatora — prosty, szybki i gotowy do spięcia z Google Sheets.</div>
                <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                  <div>
                    <FieldLabel>Imię i nazwisko / nazwa klienta</FieldLabel>
                    <TextInput placeholder="np. Anna Nowak" value={clientForm.name} onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    <div>
                      <FieldLabel>Telefon</FieldLabel>
                      <TextInput placeholder="np. 500 600 700" value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} />
                    </div>
                    <div>
                      <FieldLabel>Miasto</FieldLabel>
                      <TextInput placeholder="np. Gdańsk" value={clientForm.city} onChange={(e) => setClientForm((prev) => ({ ...prev, city: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Adres montażu</FieldLabel>
                    <TextInput placeholder="Ulica, numer domu" value={clientForm.address} onChange={(e) => setClientForm((prev) => ({ ...prev, address: e.target.value }))} />
                  </div>
                  <div>
                    <FieldLabel>Źródło klienta</FieldLabel>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['Własny klient', 'Lead BLOKFLOW', 'Polecenie'].map((option) => (
                        <Button key={option} variant={clientForm.source === option ? 'activePill' : 'pill'} onClick={() => setClientForm((prev) => ({ ...prev, source: option }))}>{option}</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Notatka</FieldLabel>
                    <TextArea placeholder="Krótka informacja o kliencie, budynku lub planowanym montażu" value={clientForm.note} onChange={(e) => setClientForm((prev) => ({ ...prev, note: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    <Button onClick={resetClientForm}>Wyczyść</Button>
                    <Button variant="primary" onClick={handleSaveClient}>Zapisz klienta</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="deviceForm">
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Dodaj urządzenie</div>
                <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Drugi krok po kliencie — rejestracja BLOKFLOW lub innego urządzenia z numerem seryjnym i statusem.</div>
                <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                  <div>
                    <FieldLabel>Typ urządzenia</FieldLabel>
                    <TextInput placeholder="np. BLOKFLOW Basic" value={deviceForm.type} onChange={(e) => setDeviceForm((prev) => ({ ...prev, type: e.target.value }))} />
                  </div>
                  <div>
                    <FieldLabel>Klient</FieldLabel>
                    <SelectInput
                      value={deviceForm.clientId}
                      onChange={(e) => {
                        const chosen = clients.find((client) => client.id === e.target.value);
                        setDeviceForm((prev) => ({
                          ...prev,
                          clientId: e.target.value,
                          client: chosen ? chosen.name : '',
                        }));
                      }}
                    >
                      <option value="">Wybierz klienta z listy</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}{client.city ? ` / ${client.city}` : ''}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    <div>
                      <FieldLabel>Numer seryjny</FieldLabel>
                      <TextInput placeholder="np. BF-2026-001" value={deviceForm.serial} onChange={(e) => setDeviceForm((prev) => ({ ...prev, serial: e.target.value }))} />
                    </div>
                    <div>
                      <FieldLabel>Status</FieldLabel>
                      <TextInput placeholder="np. Aktywne" value={deviceForm.status} onChange={(e) => setDeviceForm((prev) => ({ ...prev, status: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Model / pompa</FieldLabel>
                    <TextInput placeholder="np. Panasonic Aquarea 7 kW" value={deviceForm.pump} onChange={(e) => setDeviceForm((prev) => ({ ...prev, pump: e.target.value }))} />
                  </div>
                  <div>
                    <FieldLabel>Cykl przypomnienia</FieldLabel>
                    <SelectInput value={deviceForm.reminderCycle} onChange={(e) => setDeviceForm((prev) => ({ ...prev, reminderCycle: e.target.value }))}>
                      <option value="3">Co 3 miesiące</option>
                      <option value="6">Co 6 miesięcy</option>
                      <option value="12">Co 12 miesięcy</option>
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Termin pierwszego przeglądu</FieldLabel>
                    <TextInput type="date" value={deviceForm.nextService} onChange={(e) => setDeviceForm((prev) => ({ ...prev, nextService: e.target.value }))} />
                  </div>
                  <div>
                    <FieldLabel>Notatka montażowa</FieldLabel>
                    <TextArea placeholder="Informacje o montażu, konfiguracji, miejscu ustawienia lub uwagach serwisowych" value={deviceForm.note} onChange={(e) => setDeviceForm((prev) => ({ ...prev, note: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    <Button onClick={resetDeviceForm}>Wyczyść</Button>
                    <Button variant="primary" onClick={handleSaveDevice}>Zapisz urządzenie</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="serviceForm">
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Zgłoś serwis</div>
                <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Wybierz klienta i jego urządzenie – system zrobi resztę.</div>
                <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                  <div>
                    <FieldLabel>Klient</FieldLabel>
                    <SelectInput
                      value={serviceForm.clientId}
                      onChange={(e) => {
                        const chosen = clients.find((c) => c.id === e.target.value);
                        setServiceForm((prev) => ({
                          ...prev,
                          clientId: e.target.value,
                          client: chosen ? chosen.name : '',
                          device: '',
                          deviceSerial: '',
                          nextService: '',
                        }));
                      }}
                    >
                      <option value="">Wybierz klienta</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </SelectInput>
                  </div>

                  <div>
                    <FieldLabel>Urządzenie</FieldLabel>
                    <SelectInput
                      value={serviceForm.deviceSerial}
                      onChange={(e) => setServiceForm((prev) => ({ ...prev, deviceSerial: e.target.value }))}
                    >
                      <option value="">Wybierz urządzenie</option>
                      {devices.filter((d) => String(d.clientId || '') === String(serviceForm.clientId || '')).map((d) => (
                        <option key={d.id} value={d.serial}>{d.type} / {d.serial}</option>
                      ))}
                    </SelectInput>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    <div>
                      <FieldLabel>Typ</FieldLabel>
                      <TextInput value={serviceForm.kind} onChange={(e) => setServiceForm((prev) => ({ ...prev, kind: e.target.value }))} />
                    </div>
                    <div>
                      <FieldLabel>Priorytet</FieldLabel>
                      <TextInput value={serviceForm.priority} onChange={(e) => setServiceForm((prev) => ({ ...prev, priority: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Opis</FieldLabel>
                    <TextArea value={serviceForm.description} onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>

                  <div>
                    <FieldLabel>Termin</FieldLabel>
                    <TextInput type="date" value={serviceForm.preferredDate} onChange={(e) => setServiceForm((prev) => ({ ...prev, preferredDate: e.target.value, nextService: addMonthsToDateString(e.target.value, 12) || prev.nextService }))} />
                  </div>

                  <div>
                    <FieldLabel>Następny przegląd</FieldLabel>
                    <TextInput type="date" value={serviceForm.nextService} onChange={(e) => setServiceForm((prev) => ({ ...prev, nextService: e.target.value }))} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    <Button onClick={resetServiceForm}>Wyczyść</Button>
                    <Button variant="primary" onClick={handleSaveService}>Zapisz serwis</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="remindersSection">
              <CardContent>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Moje przypomnienia przeglądów</div>
                <div style={{ display: 'grid', gap: 16 }}>
                  <ReminderBlock title="🔴 Po terminie" items={groupedReminders.overdue} tone="red" />
                  <ReminderBlock title="🟢 Dzisiaj" items={groupedReminders.today} tone="green" />
                  <ReminderBlock title="🟠 Na ten tydzień" items={groupedReminders.week} tone="orange" />
                  <ReminderBlock title="🟡 W ciągu 30 dni" items={groupedReminders.month} tone="gray" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <ClientCardModal
        client={selectedClient}
        devices={devices}
        serviceTickets={serviceTickets}
        onClose={() => setSelectedClient(null)}
        onAddService={handleAddServiceFromClientCard}
      />
    </div>
  );
}

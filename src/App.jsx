import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const starterDevices = [
  {
    id: 'BLK-001',
    type: 'BLOKFLOW Basic',
    pump: 'Panasonic Aquarea 7 kW',
    serial: 'BF-2026-001',
    client: 'Anna Malinowska',
    installer: 'Klima Serwis Gdańsk',
    installDate: '2026-02-10',
    nextService: '2027-02-10',
    status: 'Aktywne',
  },
];

const DEFAULT_USE_LIVE_API = true;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxFp8d5tzAy49jOFwIzkPinELhulapff0KHvBJJT0Nu68UhmvnDz5Bp85BT8VnbaXvSFQ/exec';
const INSTALLERS_SHEET = 'INSTALATORZY';
const CLIENTS_SHEET = 'KLIENCI';
const DEVICES_SHEET = 'URZADZENIA';
const SERVICE_SHEET = 'SERWIS';

const INSTALLERS_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(INSTALLERS_SHEET)}`;
const CLIENTS_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(CLIENTS_SHEET)}`;
const DEVICES_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(DEVICES_SHEET)}`;
const SERVICE_API = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(SERVICE_SHEET)}`;

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

async function fetchSheetData(url) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      Accept: 'application/json, text/plain;q=0.9,*/*;q=0.8',
    },
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${rawText || 'Brak odpowiedzi serwera'}`);
  }

  try {
    const parsed = JSON.parse(rawText);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.error) {
      throw new Error(String(parsed.error));
    }

    return ensureArray(parsed);
  } catch (error) {
    throw new Error(`Nie udało się odczytać JSON z API. Odpowiedź: ${rawText.slice(0, 300)}`);
  }
}

async function postSheetData(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${rawText || 'Brak odpowiedzi serwera'}`);
  }

  try {
    const parsed = JSON.parse(rawText);

    if (parsed && typeof parsed === 'object' && parsed.ok === false) {
      throw new Error(parsed.error || 'Apps Script odrzucił zapis.');
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Nie udało się odczytać odpowiedzi POST. Odpowiedź: ${rawText}`);
  }
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
    plan: toYes(row['status premium'])
      ? 'Premium'
      : toYes(row['status aktywny'])
        ? 'Aktywny'
        : toYes(row['status nowy'])
          ? 'Nowy'
          : 'Brak',
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
  const nextService = row['Termin przeglądu'] || row['Termin pierwszego przeglądu'] || '';
  let reminder = '';

  if (nextService) {
    const today = new Date();
    const serviceDate = new Date(nextService);
    const diffDays = Math.floor((serviceDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) reminder = 'Pilne';
    else if (diffDays <= 30) reminder = 'Nadchodzi';
  }

  return {
    id: row['ID URZĄDZENIA'] || row['ID URZADZENIA'] || `BLK-${index + 1}`,
    type: row['Typ'] || row['Typ urządzenia'] || row['Typ urzadzenia'] || 'BLOKFLOW',
    client: row['Klient'] || row['Imię i Nazwisko'] || row['Nazwa klienta'] || '',
    installer: row['Instalator'] || row['Nazwa Firmy'] || '',
    serial: row['Numer seryjny'] || row['Nr seryjny'] || row['Serial'] || '',
    status: row['Status'] || 'Aktywne',
    pump: row['Model'] || row['Pompa'] || row['Model / pompa'] || '',
    nextService,
    reminder,
    note: row['Notatka'] || row['Notatka montażowa'] || '',
  };
}

function mapServiceTicket(row, index) {
  return {
    id: row['ID SERWISU'] || `SER-${index + 1}`,
    client: row['Klient'] || '',
    device: row['Urządzenie'] || '',
    kind: row['Typ zgłoszenia'] || 'Serwis',
    priority: row['Priorytet'] || 'Niski',
    description: row['Opis'] || '',
    preferredDate: row['Preferowany termin'] || '',
    status: row['Status'] || 'Nowe',
  };
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function BlokflowPanel() {
  const [filterType, setFilterType] = useState('Wszyscy');
  const [viewMode, setViewMode] = useState('admin');
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
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (DEFAULT_USE_LIVE_API) {
      setUseLiveApi(true);
      setIsConnected(true);
    }
  }, []);

  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    source: 'Własny klient',
    note: '',
  });

  const [deviceForm, setDeviceForm] = useState({
    type: 'BLOKFLOW Basic',
    client: '',
    serial: '',
    status: 'Aktywne',
    pump: '',
    nextService: '',
    note: '',
  });

  const [serviceForm, setServiceForm] = useState({
    client: '',
    device: '',
    kind: 'Przegląd',
    priority: 'Niski',
    description: '',
    preferredDate: '',
  });

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

      if (installersResult.status === 'fulfilled') {
        setInstallers(installersResult.value.map(mapInstaller));
      } else {
        setInstallers([]);
        setErrors((prev) => ({
          ...prev,
          installers: installersResult.reason instanceof Error
            ? installersResult.reason.message
            : 'Nieznany błąd pobierania instalatorów.',
        }));
      }

      if (clientsResult.status === 'fulfilled') {
        setClients(clientsResult.value.map(mapClient));
      } else {
        setClients([]);
        setErrors((prev) => ({
          ...prev,
          clients: clientsResult.reason instanceof Error
            ? clientsResult.reason.message
            : 'Nieznany błąd pobierania klientów.',
        }));
      }

      if (devicesResult.status === 'fulfilled') {
        setDevices(devicesResult.value.length > 0 ? devicesResult.value.map(mapDevice) : starterDevices);
      } else {
        setDevices(starterDevices);
        setErrors((prev) => ({
          ...prev,
          devices: devicesResult.reason instanceof Error
            ? devicesResult.reason.message
            : 'Nieznany błąd pobierania urządzeń.',
        }));
      }

      if (serviceResult.status === 'fulfilled') {
        setServiceTickets(serviceResult.value.map(mapServiceTicket));
      } else {
        setServiceTickets([]);
        setErrors((prev) => ({
          ...prev,
          service: serviceResult.reason instanceof Error
            ? serviceResult.reason.message
            : 'Nieznany błąd pobierania serwisu.',
        }));
      }

      setLoading({ installers: false, clients: false, devices: false, service: false });
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  const filteredInstallers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return installers;
    return installers.filter((i) =>
      [i.company, i.owner, i.city, i.region, i.phone, i.email, i.plan]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [installers, search]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.city, c.phone, c.installer, c.source, c.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [clients, search]);

  const filteredDevices = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return devices;
    return devices.filter((d) =>
      [d.type, d.client, d.installer, d.serial, d.status, d.pump]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [devices, search]);

  const installerQuickStats = useMemo(() => {
    const activeDevices = devices.filter((d) => (d.status || '').toLowerCase() !== 'nieaktywne').length;
    return {
      clients: clients.length,
      devices: devices.length,
      activeDevices,
    };
  }, [clients, devices]);

  const upcomingReminders = useMemo(() => {
    const today = new Date();

    return devices
      .map((d) => {
        const nextService = d.nextService || '';
        if (!nextService) return null;

        const serviceDate = new Date(nextService);
        const diffDays = Math.floor((serviceDate - today) / (1000 * 60 * 60 * 24));

        let level = '';
        if (diffDays < 0) level = 'Po terminie';
        else if (diffDays <= 7) level = 'Pilne';
        else if (diffDays <= 30) level = 'W ciągu 30 dni';
        else return null;

        return {
          id: d.id,
          client: d.client,
          type: d.type,
          serial: d.serial,
          nextService,
          diffDays,
          level,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [devices]);

  function resetClientForm() {
    setClientForm({
      name: '',
      phone: '',
      city: '',
      address: '',
      source: 'Własny klient',
      note: '',
    });
  }

  function resetDeviceForm() {
    setDeviceForm({
      type: 'BLOKFLOW Basic',
      client: '',
      serial: '',
      status: 'Aktywne',
      pump: '',
      nextService: '',
      note: '',
    });
  }

  function resetServiceForm() {
    setServiceForm({
      client: '',
      device: '',
      kind: 'Przegląd',
      priority: 'Niski',
      description: '',
      preferredDate: '',
    });
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
        const result = await postSheetData({
          action: 'append',
          sheet: CLIENTS_SHEET,
          row: {
            'ID KLIENTA': record.id,
            'Imię i Nazwisko': record.name,
            'Telefon': record.phone,
            'Miasto': record.city,
            'Adres': record.address,
            'Instalator': record.installer,
            'Źródło': record.source,
            'Notatka': record.note,
          },
        });

        console.log('ODPOWIEDŹ Z APPS SCRIPT:', result);
      }

      setClients((prev) => [record, ...prev]);
      resetClientForm();
      setSubmitState({ type: 'success', message: 'Klient został zapisany.' });
    } catch (error) {
      console.error('BŁĄD ZAPISU:', error);
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Nie udało się zapisać klienta.',
      });
    }
  }

  async function handleSaveDevice() {
    if (!deviceForm.client.trim() || !deviceForm.type.trim()) {
      setSubmitState({ type: 'error', message: 'Uzupełnij klienta i typ urządzenia.' });
      return;
    }

    const record = {
      id: makeId('BLK'),
      type: deviceForm.type.trim(),
      client: deviceForm.client.trim(),
      installer: 'Moja firma instalatorska',
      serial: deviceForm.serial.trim(),
      status: deviceForm.status.trim() || 'Aktywne',
      pump: deviceForm.pump.trim(),
      nextService: deviceForm.nextService.trim(),
      note: deviceForm.note.trim(),
    };

    try {
      if (useLiveApi) {
        await postSheetData({
          action: 'append',
          sheet: DEVICES_SHEET,
          row: {
            'ID URZADZENIA': record.id,
            'Typ': record.type,
            'Klient': record.client,
            'Instalator': record.installer,
            'Numer seryjny': record.serial,
            'Status': record.status,
            'Model': record.pump,
            'Termin przeglądu': record.nextService,
            'Notatka montażowa': record.note,
          },
        });
      }

      setDevices((prev) => [record, ...prev]);
      resetDeviceForm();
      setSubmitState({ type: 'success', message: 'Urządzenie zostało zapisane.' });
    } catch (error) {
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Nie udało się zapisać urządzenia.',
      });
    }
  }

  async function handleSaveService() {
    if (!serviceForm.client.trim() || !serviceForm.description.trim()) {
      setSubmitState({ type: 'error', message: 'Uzupełnij klienta i opis zgłoszenia.' });
      return;
    }

    const record = {
      id: makeId('SER'),
      client: serviceForm.client.trim(),
      device: serviceForm.device.trim(),
      kind: serviceForm.kind.trim(),
      priority: serviceForm.priority.trim(),
      description: serviceForm.description.trim(),
      preferredDate: serviceForm.preferredDate.trim(),
      status: 'Nowe',
    };

    try {
      if (useLiveApi) {
        await postSheetData({
          action: 'append',
          sheet: SERVICE_SHEET,
          row: {
            'ID SERWISU': record.id,
            'Klient': record.client,
            'Urządzenie': record.device,
            'Typ zgłoszenia': record.kind,
            'Priorytet': record.priority,
            'Opis': record.description,
            'Preferowany termin': record.preferredDate,
            'Status': record.status,
          },
        });
      }

      setServiceTickets((prev) => [record, ...prev]);
      resetServiceForm();
      setSubmitState({ type: 'success', message: 'Zgłoszenie serwisowe zostało zapisane.' });
    } catch (error) {
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Nie udało się wysłać zgłoszenia.',
      });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">BLOKFLOW PANEL</h1>
          <p className="text-sm text-slate-500 mt-1">Jeden system, dwa widoki: admin i instalator.</p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border p-1 bg-white">
          <button
            type="button"
            onClick={() => setViewMode('admin')}
            className={`px-3 py-2 rounded-md text-sm ${viewMode === 'admin' ? 'bg-black text-white' : 'text-slate-600'}`}
          >
            Panel admina
          </button>
          <button
            type="button"
            onClick={() => setViewMode('installer')}
            className={`px-3 py-2 rounded-md text-sm ${viewMode === 'installer' ? 'bg-black text-white' : 'text-slate-600'}`}
          >
            Panel instalatora
          </button>
        </div>

        <Input
          placeholder="Szukaj..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {submitState.message ? (
        <Card>
          <CardContent className={`p-4 text-sm ${submitState.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
            {submitState.message}
          </CardContent>
        </Card>
      ) : null}

      {viewMode === 'admin' ? (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={() => { setUseLiveApi(true); setIsConnected(true); }}
              disabled={false}
              className="px-4 py-2 rounded-md text-white text-sm bg-black"
            >
              Połącz z Google Sheets
            </button>
            <p className="text-sm text-slate-500">
              Kliknij, aby połączyć z Google Sheets (może wyskoczyć zgoda – to normalne).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Instalatorzy" value={installers.length} />
            <StatCard label="Klienci" value={clients.length} />
            <StatCard label="Urządzenia" value={devices.length} />
            <StatCard label="Aktywni / Premium" value={installers.filter((i) => i.plan === 'Aktywny' || i.plan === 'Premium').length} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="font-semibold mb-3">Szybki podgląd biznesowy</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-slate-500">Nowi instalatorzy</p>
                    <p className="text-xl font-semibold mt-1">{installers.filter((i) => i.plan === 'Nowy').length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-slate-500">Instalatorzy premium</p>
                    <p className="text-xl font-semibold mt-1">{installers.filter((i) => i.plan === 'Premium').length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-slate-500">Klienci przypisani</p>
                    <p className="text-xl font-semibold mt-1">{clients.filter((c) => c.installer).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="font-semibold mb-3">Szybkie akcje</p>
                <div className="space-y-2">
                  <button type="button" className="w-full rounded-md border px-3 py-2 text-left text-sm">Dodaj instalatora</button>
                  <button type="button" className="w-full rounded-md border px-3 py-2 text-left text-sm">Dodaj klienta</button>
                  <button type="button" className="w-full rounded-md border px-3 py-2 text-left text-sm">Dodaj urządzenie</button>
                  <button type="button" className="w-full rounded-md border px-3 py-2 text-left text-sm">Przejdź do mapy partnerów</button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MAPA INSTALATORÓW (MVP) */}
          <Card>
            <CardContent className="p-4">
              <p className="font-semibold mb-3">Mapa instalatorów (MVP)</p>

              <div className="flex gap-2 mb-3">
                {['Wszyscy','Pompy ciepła','Klimatyzacja'].map(t => (
                  <button key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1 text-xs rounded-full border ${filterType===t ? 'bg-black text-white':'bg-white'}`}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {installers
                  .filter(i => filterType==='Wszyscy' || i.type===filterType)
                  .map(i => (
                    <div key={i.id} className="border rounded-lg p-3 text-sm">
                      <div className="font-medium">{i.company}</div>
                      <div className="text-slate-500">{i.city}</div>
                      <div className="text-xs mt-1">{i.type}</div>
                    </div>
                  ))}
              </div>

            </CardContent>
          </Card>

          <Tabs defaultValue="instalatorzy">
            <TabsList>
              <TabsTrigger value="instalatorzy">Instalatorzy</TabsTrigger>
              <TabsTrigger value="klienci">Klienci</TabsTrigger>
              <TabsTrigger value="urzadzenia">Urządzenia</TabsTrigger>
              <TabsTrigger value="serwis">Serwis</TabsTrigger>
            </TabsList>

            <TabsContent value="instalatorzy" className="space-y-3">
              {loading.installers ? (
                <Card><CardContent className="p-4 text-sm text-slate-500">Ładowanie instalatorów...</CardContent></Card>
              ) : errors.installers ? (
                <Card><CardContent className="p-4 text-sm text-red-600">Błąd pobierania instalatorów: {errors.installers}<div className="mt-2 break-all text-xs text-slate-500">{INSTALLERS_API}</div></CardContent></Card>
              ) : filteredInstallers.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-slate-500">Brak instalatorów do wyświetlenia.</CardContent></Card>
              ) : (
                filteredInstallers.map((i) => (
                  <Card key={i.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{i.company}</p>
                      {i.owner ? <p className="text-sm">{i.owner}</p> : null}
                      <p className="text-sm">{i.city}</p>
                      <Badge variant={i.plan === 'Premium' ? 'default' : 'secondary'}>{i.plan}</Badge>
                      {i.region ? <p className="text-sm text-slate-500 mt-1">{i.region}</p> : null}
                      {i.registrationDate ? <p className="text-xs text-slate-500">Rejestracja: {i.registrationDate}</p> : null}
                      {i.phone ? <p className="text-sm mt-1">{i.phone}</p> : null}
                      {i.email ? <p className="text-sm">{i.email}</p> : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="klienci" className="space-y-3">
              {loading.clients ? (
                <Card><CardContent className="p-4 text-sm text-slate-500">Ładowanie klientów...</CardContent></Card>
              ) : errors.clients ? (
                <Card><CardContent className="p-4 text-sm text-red-600">Błąd pobierania klientów: {errors.clients}<div className="mt-2 break-all text-xs text-slate-500">{CLIENTS_API}</div></CardContent></Card>
              ) : filteredClients.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-slate-500">Brak klientów do wyświetlenia.</CardContent></Card>
              ) : (
                filteredClients.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm">{c.city}</p>
                      {c.phone ? <p className="text-sm">{c.phone}</p> : null}
                      {c.installer ? <p className="text-sm">Instalator: {c.installer}</p> : null}
                      <Badge>{c.source}</Badge>
                      {c.name ? <div className="mt-2 text-xs text-slate-500">Karta klienta gotowa do rozbudowy o zgłoszenia i historię serwisową.</div> : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="urzadzenia" className="space-y-3">
              {loading.devices ? (
                <Card><CardContent className="p-4 text-sm text-slate-500">Ładowanie urządzeń...</CardContent></Card>
              ) : errors.devices ? (
                <Card><CardContent className="p-4 text-sm text-red-600">Błąd pobierania urządzeń: {errors.devices}<div className="mt-2 break-all text-xs text-slate-500">{DEVICES_API}</div></CardContent></Card>
              ) : filteredDevices.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-slate-500">Brak urządzeń do wyświetlenia.</CardContent></Card>
              ) : (
                filteredDevices.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{d.type}</p>
                      <p className="text-sm">Klient: {d.client || 'Brak danych'}</p>
                      <p className="text-sm">Instalator: {d.installer || 'Brak danych'}</p>
                      <p className="text-sm">Nr seryjny: {d.serial || 'Brak danych'}</p>
                      <p className="text-sm">Status: {d.status || 'Brak danych'}</p>
                      {d.client || d.installer ? <div className="mt-2 text-xs text-slate-500">Urządzenie gotowe do połączenia z przeglądami, gwarancją i historią serwisu.</div> : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="serwis" className="space-y-3">
              {loading.service ? (
                <Card>
                  <CardContent className="p-4 text-sm text-slate-500">
                    Ładowanie zgłoszeń serwisowych...
                  </CardContent>
                </Card>
              ) : errors.service ? (
                <Card>
                  <CardContent className="p-4 text-sm text-red-600">
                    Błąd pobierania serwisu: {errors.service}
                    <div className="mt-2 break-all text-xs text-slate-500">{SERVICE_API}</div>
                  </CardContent>
                </Card>
              ) : serviceTickets.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-slate-500">
                    Brak zgłoszeń serwisowych.
                  </CardContent>
                </Card>
              ) : (
                serviceTickets.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{s.kind}</p>
                      <p className="text-sm">Klient: {s.client}</p>
                      <p className="text-sm">Urządzenie: {s.device}</p>
                      <p className="text-sm">Priorytet: {s.priority}</p>
                      <p className="text-sm text-slate-500">{s.description}</p>
                      {s.preferredDate ? <p className="text-xs text-slate-400 mt-1">Termin: {s.preferredDate}</p> : null}
                      <p className="text-xs text-slate-400 mt-1">Status: {s.status}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="space-y-4 max-w-md mx-auto">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Moi klienci" value={installerQuickStats.clients} />
            <StatCard label="Urządzenia" value={installerQuickStats.devices} />
            <StatCard label="Aktywne" value={installerQuickStats.activeDevices} />
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="font-semibold mb-3">Szybkie akcje instalatora</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => document.getElementById('clientForm')?.scrollIntoView({behavior:'smooth'})} type="button" className="rounded-xl border px-3 py-4 text-sm text-left bg-slate-50">Dodaj klienta</button>
                <button onClick={() => document.getElementById('deviceForm')?.scrollIntoView({behavior:'smooth'})} type="button" className="rounded-xl border px-3 py-4 text-sm text-left">Dodaj urządzenie</button>
                <button onClick={() => document.getElementById('serviceForm')?.scrollIntoView({behavior:'smooth'})} type="button" className="rounded-xl border px-3 py-4 text-sm text-left">Zgłoś serwis</button>
                <button onClick={() => document.getElementById('remindersSection')?.scrollIntoView({behavior:'smooth'})} type="button" className="rounded-xl border px-3 py-4 text-sm text-left">Moje przypomnienia</button>
              </div>
            </CardContent>
          </Card>

          <div id="clientForm"><Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="font-semibold">Dodaj klienta</p>
                <p className="text-sm text-slate-500 mt-1">Mobilny formularz dla instalatora — prosty, szybki i gotowy do spięcia z Google Sheets.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Imię i nazwisko / nazwa klienta</label>
                  <Input placeholder="np. Anna Nowak" className="mt-1" value={clientForm.name} onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Telefon</label>
                    <Input placeholder="np. 500 600 700" className="mt-1" value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Miasto</label>
                    <Input placeholder="np. Gdańsk" className="mt-1" value={clientForm.city} onChange={(e) => setClientForm((prev) => ({ ...prev, city: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Adres montażu</label>
                  <Input placeholder="Ulica, numer domu" className="mt-1" value={clientForm.address} onChange={(e) => setClientForm((prev) => ({ ...prev, address: e.target.value }))} />
                </div>

                <div>
                  <label className="text-sm font-medium">Źródło klienta</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Własny klient', 'Lead BLOKFLOW', 'Polecenie'].map((option) => (
                      <button key={option} type="button" onClick={() => setClientForm((prev) => ({ ...prev, source: option }))} className={`rounded-full border px-3 py-1 text-xs ${clientForm.source === option ? 'bg-black text-white' : 'bg-white'}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Notatka</label>
                  <textarea className="mt-1 min-h-[90px] w-full rounded-md border px-3 py-2 text-sm" placeholder="Krótka informacja o kliencie, budynku lub planowanym montażu" value={clientForm.note} onChange={(e) => setClientForm((prev) => ({ ...prev, note: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="rounded-xl border px-3 py-3 text-sm" onClick={resetClientForm}>Wyczyść</button>
                <button type="button" className="rounded-xl bg-black text-white px-3 py-3 text-sm" onClick={handleSaveClient}>Zapisz klienta</button>
              </div>
            </CardContent>
          </Card></div>

          <div id="deviceForm"><Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="font-semibold">Dodaj urządzenie</p>
                <p className="text-sm text-slate-500 mt-1">Drugi krok po kliencie — rejestracja BLOKFLOW lub innego urządzenia z numerem seryjnym i statusem.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Typ urządzenia</label>
                  <Input placeholder="np. BLOKFLOW Basic" className="mt-1" value={deviceForm.type} onChange={(e) => setDeviceForm((prev) => ({ ...prev, type: e.target.value }))} />
                </div>

                <div>
                  <label className="text-sm font-medium">Klient</label>
                  <Input placeholder="np. Anna Nowak" className="mt-1" value={deviceForm.client} onChange={(e) => setDeviceForm((prev) => ({ ...prev, client: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Numer seryjny</label>
                    <Input placeholder="np. BF-2026-001" className="mt-1" value={deviceForm.serial} onChange={(e) => setDeviceForm((prev) => ({ ...prev, serial: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Input placeholder="np. Aktywne" className="mt-1" value={deviceForm.status} onChange={(e) => setDeviceForm((prev) => ({ ...prev, status: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Model / pompa</label>
                  <Input placeholder="np. Panasonic Aquarea 7 kW" className="mt-1" value={deviceForm.pump} onChange={(e) => setDeviceForm((prev) => ({ ...prev, pump: e.target.value }))} />
                </div>

                <div>
                  <label className="text-sm font-medium">Termin pierwszego przeglądu</label>
                  <Input type="date" className="mt-1" value={deviceForm.nextService} onChange={(e) => setDeviceForm((prev) => ({ ...prev, nextService: e.target.value }))} />
                </div>

                <div>
                  <label className="text-sm font-medium">Notatka montażowa</label>
                  <textarea className="mt-1 min-h-[90px] w-full rounded-md border px-3 py-2 text-sm" placeholder="Informacje o montażu, konfiguracji, miejscu ustawienia lub uwagach serwisowych" value={deviceForm.note} onChange={(e) => setDeviceForm((prev) => ({ ...prev, note: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="rounded-xl border px-3 py-3 text-sm" onClick={resetDeviceForm}>Wyczyść</button>
                <button type="button" className="rounded-xl bg-black text-white px-3 py-3 text-sm" onClick={handleSaveDevice}>Zapisz urządzenie</button>
              </div>
            </CardContent>
          </Card></div>

          <div id="serviceForm"><Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="font-semibold">Zgłoś serwis</p>
                <p className="text-sm text-slate-500 mt-1">Szybkie zgłoszenie przeglądu lub awarii dla istniejącego urządzenia.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Klient</label>
                  <Input placeholder="np. Anna Nowak" className="mt-1" value={serviceForm.client} onChange={(e) => setServiceForm((prev) => ({ ...prev, client: e.target.value }))} />
                </div>

                <div>
                  <label className="text-sm font-medium">Urządzenie / nr seryjny</label>
                  <Input placeholder="np. BF-2026-001" className="mt-1" value={serviceForm.device} onChange={(e) => setServiceForm((prev) => ({ ...prev, device: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Typ zgłoszenia</label>
                    <Input placeholder="np. Przegląd / Awaria" className="mt-1" value={serviceForm.kind} onChange={(e) => setServiceForm((prev) => ({ ...prev, kind: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Priorytet</label>
                    <Input placeholder="np. Niski / Pilny" className="mt-1" value={serviceForm.priority} onChange={(e) => setServiceForm((prev) => ({ ...prev, priority: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Opis problemu</label>
                  <textarea className="mt-1 min-h-[90px] w-full rounded-md border px-3 py-2 text-sm" placeholder="Opisz problem lub zakres przeglądu" value={serviceForm.description} onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>

                <div>
                  <label className="text-sm font-medium">Preferowany termin</label>
                  <Input type="date" className="mt-1" value={serviceForm.preferredDate} onChange={(e) => setServiceForm((prev) => ({ ...prev, preferredDate: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="rounded-xl border px-3 py-3 text-sm" onClick={resetServiceForm}>Wyczyść</button>
                <button type="button" className="rounded-xl bg-black text-white px-3 py-3 text-sm" onClick={handleSaveService}>Wyślij zgłoszenie</button>
              </div>
            </CardContent>
          </Card></div>

          <Card id="remindersSection">
            <CardContent className="p-4">
              <p className="font-semibold mb-3">Moje przypomnienia przeglądów</p>
              <div className="space-y-3">
                {upcomingReminders.length === 0 ? (
                  <p className="text-sm text-slate-500">Brak nadchodzących przypomnień.</p>
                ) : (
                  upcomingReminders.slice(0, 8).map((r) => (
                    <div key={r.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{r.client || 'Brak klienta'}</p>
                          <p className="text-sm text-slate-500">{r.type}</p>
                          {r.serial ? <p className="text-xs text-slate-400 mt-1">Nr seryjny: {r.serial}</p> : null}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full border ${r.level === 'Po terminie' ? 'text-red-600 border-red-200 bg-red-50' : r.level === 'Pilne' ? 'text-orange-600 border-orange-200 bg-orange-50' : 'text-slate-600 border-slate-200 bg-slate-50'}`}>
                          {r.level}
                        </div>
                      </div>
                      <p className="text-sm mt-2">Termin przeglądu: {r.nextService}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {r.diffDays < 0 ? `Opóźnienie: ${Math.abs(r.diffDays)} dni` : r.diffDays === 0 ? 'Przegląd dzisiaj' : `Za ${r.diffDays} dni`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="font-semibold mb-3">Ostatnie zgłoszenia</p>
              <div className="space-y-3">
                {serviceTickets.length === 0 ? (
                  <p className="text-sm text-slate-500">Brak zgłoszeń do wyświetlenia.</p>
                ) : (
                  serviceTickets.slice(0, 5).map((ticket) => (
                    <div key={ticket.id} className="rounded-xl border p-3">
                      <p className="font-medium">{ticket.kind}</p>
                      <p className="text-sm text-slate-500">Klient: {ticket.client}</p>
                      <p className="text-sm text-slate-500">Priorytet: {ticket.priority}</p>
                      <p className="text-xs text-slate-400 mt-1">Status: {ticket.status}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="font-semibold mb-3">Moi klienci</p>
              <div className="space-y-3">
                {filteredClients.length === 0 ? (
                  <p className="text-sm text-slate-500">Brak klientów do wyświetlenia.</p>
                ) : (
                  filteredClients.slice(0, 5).map((c) => (
                    <div key={c.id} className="rounded-xl border p-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-slate-500">{c.city}</p>
                      {c.phone ? <p className="text-sm mt-1">{c.phone}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="font-semibold mb-3">Moje urządzenia</p>
              <div className="space-y-3">
                {filteredDevices.length === 0 ? (
                  <p className="text-sm text-slate-500">Brak urządzeń do wyświetlenia.</p>
                ) : (
                  filteredDevices.slice(0, 5).map((d) => (
                    <div key={d.id} className="rounded-xl border p-3">
                      <p className="font-medium">{d.type}</p>
                      <p className="text-sm text-slate-500">Klient: {d.client || 'Brak danych'}</p>
                      <p className="text-sm text-slate-500">Status: {d.status || 'Brak danych'}</p>
                      {d.serial ? <p className="text-xs text-slate-400 mt-1">Nr seryjny: {d.serial}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

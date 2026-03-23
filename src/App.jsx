
import React, { useEffect, useMemo, useRef, useState } from 'react';

const starterDevices=[{id:'BLK-001',type:'BLOKFLOW Basic',pump:'Panasonic Aquarea 7 kW',serial:'BF-2026-001',client:'Anna Malinowska',installer:'Klima Serwis Gdańsk',nextService:'2027-02-10',status:'Aktywne',note:''}];
const DEFAULT_USE_LIVE_API=false;
const APPS_SCRIPT_URL=window.__API_URL__;
const INSTALLERS_SHEET='INSTALATORZY';
const CLIENTS_SHEET='KLIENCI';
const DEVICES_SHEET='URZADZENIA';
const SERVICE_SHEET='SERWIS';
const INSTALLERS_API=`${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(INSTALLERS_SHEET)}`;
const CLIENTS_API=`${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(CLIENTS_SHEET)}`;
const DEVICES_API=`${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(DEVICES_SHEET)}`;

const Card=({children})=><div className="card">{children}</div>;
const CardContent=({children,className=''})=><div className={`card-body ${className}`.trim()}>{children}</div>;
const Input=(props)=><input {...props} />;
const Badge=({children,plan})=>{const cls=plan==='Premium'?'badge premium':plan==='Aktywny'?'badge active':plan==='Nowy'?'badge new':'badge';return <span className={cls}>{children}</span>;};
const StatCard=({label,value})=><Card><CardContent><p className="stat-label">{label}</p><p className="stat-value">{value}</p></CardContent></Card>;

function toYes(value){if(value===true)return true;const n=String(value??'').trim().toLowerCase();return ['tak','true','1','yes','y','premium','aktywny','nowy'].includes(n)}
function ensureArray(payload){return Array.isArray(payload)?payload:[]}
function makeId(prefix){return `${prefix}-${Date.now()}-${Math.floor(Math.random()*1000)}`}
async function fetchSheetData(url){const r=await fetch(url,{method:'GET',redirect:'follow',headers:{Accept:'application/json, text/plain;q=0.9,*/*;q=0.8'}});const t=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${t||'Brak odpowiedzi serwera'}`);const p=JSON.parse(t);if(p&&typeof p==='object'&&!Array.isArray(p)&&p.error)throw new Error(String(p.error));return ensureArray(p)}
async function postSheetData(payload){const r=await fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});const t=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${t||'Brak odpowiedzi serwera'}`);try{return JSON.parse(t)}catch{return {ok:true,raw:t}}}
function mapInstaller(row,index){return {id:row['ID INSTALATORA']||`INS-${index+1}`,company:row['Nazwa Firmy']||'',owner:row['Imię i Nazwisko']||'',phone:row['Telefon']||'',email:row['E-mail']||'',city:row['Miasto']||'',region:row['Województwo']||'',plan:toYes(row['status premium'])?'Premium':toYes(row['status aktywny'])?'Aktywny':toYes(row['status nowy'])?'Nowy':'Brak',registrationDate:row['Data rejestracji']||''}}
function mapClient(row,index){return {id:row['ID KLIENTA']||`CLI-${index+1}`,name:row['Imię i Nazwisko']||row['Nazwa klienta']||row['Klient']||'',city:row['Miasto']||'',phone:row['Telefon']||'',address:row['Adres']||row['Adres montażu']||'',installer:row['Instalator']||row['Nazwa Firmy']||'',source:row['Źródło']||row['Zrodlo']||'Formularz',note:row['Notatka']||''}}
function mapDevice(row,index){return {id:row['ID URZĄDZENIA']||row['ID URZADZENIA']||`BLK-${index+1}`,type:row['Typ']||row['Typ urządzenia']||row['Typ urzadzenia']||'BLOKFLOW',client:row['Klient']||row['Imię i Nazwisko']||row['Nazwa klienta']||'',installer:row['Instalator']||row['Nazwa Firmy']||'',serial:row['Numer seryjny']||row['Nr seryjny']||row['Serial']||'',status:row['Status']||'Aktywne',pump:row['Model']||row['Pompa']||row['Model / pompa']||'',nextService:row['Termin przeglądu']||row['Termin pierwszego przeglądu']||'',note:row['Notatka']||row['Notatka montażowa']||''}}

export default function App(){
const [viewMode,setViewMode]=useState('admin'); const [activeTab,setActiveTab]=useState('instalatorzy');
const [installers,setInstallers]=useState([]); const [clients,setClients]=useState([]); const [devices,setDevices]=useState(starterDevices);
const [serviceTickets,setServiceTickets]=useState([]); const [search,setSearch]=useState('');
const [loading,setLoading]=useState({installers:false,clients:false,devices:false}); const [errors,setErrors]=useState({installers:'',clients:'',devices:''});
const [isConnected,setIsConnected]=useState(false); const [useLiveApi,setUseLiveApi]=useState(DEFAULT_USE_LIVE_API); const [submitState,setSubmitState]=useState({type:'',message:''}); const hasLoadedRef=useRef(false);
const [clientForm,setClientForm]=useState({name:'',phone:'',city:'',address:'',source:'Własny klient',note:''});
const [deviceForm,setDeviceForm]=useState({type:'BLOKFLOW Basic',client:'',serial:'',status:'Aktywne',pump:'',nextService:'',note:''});
const [serviceForm,setServiceForm]=useState({client:'',device:'',kind:'Przegląd',priority:'Niski',description:'',preferredDate:''});

useEffect(()=>{if(!useLiveApi||!isConnected||hasLoadedRef.current)return; let cancelled=false; hasLoadedRef.current=true;
(async()=>{setLoading({installers:true,clients:true,devices:true}); setErrors({installers:'',clients:'',devices:''});
const [ir,cr,dr]=await Promise.allSettled([fetchSheetData(INSTALLERS_API),fetchSheetData(CLIENTS_API),fetchSheetData(DEVICES_API)]);
if(cancelled)return;
if(ir.status==='fulfilled') setInstallers(ir.value.map(mapInstaller)); else {setInstallers([]); setErrors(p=>({...p,installers:ir.reason instanceof Error?ir.reason.message:'Nieznany błąd pobierania instalatorów.'}))}
if(cr.status==='fulfilled') setClients(cr.value.map(mapClient)); else {setClients([]); setErrors(p=>({...p,clients:cr.reason instanceof Error?cr.reason.message:'Nieznany błąd pobierania klientów.'}))}
if(dr.status==='fulfilled') setDevices(dr.value.length>0?dr.value.map(mapDevice):starterDevices); else {setDevices(starterDevices); setErrors(p=>({...p,devices:dr.reason instanceof Error?dr.reason.message:'Nieznany błąd pobierania urządzeń.'}))}
setLoading({installers:false,clients:false,devices:false});
})(); return ()=>{cancelled=true}},[isConnected,useLiveApi]);

const filteredInstallers=useMemo(()=>{const q=search.toLowerCase().trim(); if(!q)return installers; return installers.filter(i=>[i.company,i.owner,i.city,i.region,i.phone,i.email,i.plan].filter(Boolean).join(' ').toLowerCase().includes(q))},[installers,search]);
const filteredClients=useMemo(()=>{const q=search.toLowerCase().trim(); if(!q)return clients; return clients.filter(c=>[c.name,c.city,c.phone,c.installer,c.source,c.address].filter(Boolean).join(' ').toLowerCase().includes(q))},[clients,search]);
const filteredDevices=useMemo(()=>{const q=search.toLowerCase().trim(); if(!q)return devices; return devices.filter(d=>[d.type,d.client,d.installer,d.serial,d.status,d.pump].filter(Boolean).join(' ').toLowerCase().includes(q))},[devices,search]);
const installerQuickStats=useMemo(()=>{const activeDevices=devices.filter(d=>(d.status||'').toLowerCase()!=='nieaktywne').length; return {clients:clients.length,devices:devices.length,activeDevices}},[clients,devices]);

function resetClientForm(){setClientForm({name:'',phone:'',city:'',address:'',source:'Własny klient',note:''})}
function resetDeviceForm(){setDeviceForm({type:'BLOKFLOW Basic',client:'',serial:'',status:'Aktywne',pump:'',nextService:'',note:''})}
function resetServiceForm(){setServiceForm({client:'',device:'',kind:'Przegląd',priority:'Niski',description:'',preferredDate:''})}

async function handleSaveClient(){if(!clientForm.name.trim()){setSubmitState({type:'error',message:'Uzupełnij nazwę klienta.'});return}
const record={id:makeId('CLI'),name:clientForm.name.trim(),phone:clientForm.phone.trim(),city:clientForm.city.trim(),address:clientForm.address.trim(),installer:'Moja firma instalatorska',source:clientForm.source,note:clientForm.note.trim()};
try{if(useLiveApi){await postSheetData({action:'append',sheet:CLIENTS_SHEET,row:{'ID KLIENTA':record.id,'Imię i Nazwisko':record.name,'Telefon':record.phone,'Miasto':record.city,'Adres':record.address,'Instalator':record.installer,'Źródło':record.source,'Notatka':record.note}})}
setClients(prev=>[record,...prev]); resetClientForm(); setSubmitState({type:'success',message:'Klient został zapisany.'})}catch(error){setSubmitState({type:'error',message:error instanceof Error?error.message:'Nie udało się zapisać klienta.'})}}
async function handleSaveDevice(){if(!deviceForm.client.trim()||!deviceForm.type.trim()){setSubmitState({type:'error',message:'Uzupełnij klienta i typ urządzenia.'});return}
const record={id:makeId('BLK'),type:deviceForm.type.trim(),client:deviceForm.client.trim(),installer:'Moja firma instalatorska',serial:deviceForm.serial.trim(),status:deviceForm.status.trim()||'Aktywne',pump:deviceForm.pump.trim(),nextService:deviceForm.nextService.trim(),note:deviceForm.note.trim()};
try{if(useLiveApi){await postSheetData({action:'append',sheet:DEVICES_SHEET,row:{'ID URZADZENIA':record.id,'Typ':record.type,'Klient':record.client,'Instalator':record.installer,'Numer seryjny':record.serial,'Status':record.status,'Model':record.pump,'Termin przeglądu':record.nextService,'Notatka montażowa':record.note}})}
setDevices(prev=>[record,...prev]); resetDeviceForm(); setSubmitState({type:'success',message:'Urządzenie zostało zapisane.'})}catch(error){setSubmitState({type:'error',message:error instanceof Error?error.message:'Nie udało się zapisać urządzenia.'})}}
async function handleSaveService(){if(!serviceForm.client.trim()||!serviceForm.description.trim()){setSubmitState({type:'error',message:'Uzupełnij klienta i opis zgłoszenia.'});return}
const record={id:makeId('SER'),client:serviceForm.client.trim(),device:serviceForm.device.trim(),kind:serviceForm.kind.trim(),priority:serviceForm.priority.trim(),description:serviceForm.description.trim(),preferredDate:serviceForm.preferredDate.trim(),status:'Nowe'};
try{if(useLiveApi){await postSheetData({action:'append',sheet:SERVICE_SHEET,row:{'ID SERWISU':record.id,'Klient':record.client,'Urządzenie':record.device,'Typ zgłoszenia':record.kind,'Priorytet':record.priority,'Opis':record.description,'Preferowany termin':record.preferredDate,'Status':record.status}})}
setServiceTickets(prev=>[record,...prev]); resetServiceForm(); setSubmitState({type:'success',message:'Zgłoszenie serwisowe zostało zapisane.'})}catch(error){setSubmitState({type:'error',message:error instanceof Error?error.message:'Nie udało się wysłać zgłoszenia.'})}}

return <div className="wrap">
  <div className="topbar">
    <div className="title"><h1>BLOKFLOW PANEL</h1><p>Jeden system, dwa widoki: admin i instalator.</p></div>
    <div className="segmented"><button className={viewMode==='admin'?'active':''} onClick={()=>setViewMode('admin')}>Panel admina</button><button className={viewMode==='installer'?'active':''} onClick={()=>setViewMode('installer')}>Panel instalatora</button></div>
    <Input className="search" placeholder="Szukaj..." value={search} onChange={(e)=>setSearch(e.target.value)} />
  </div>

  {submitState.message?<div className={`notice ${submitState.type==='error'?'error':'success'}`}>{submitState.message}</div>:null}

  {viewMode==='admin'?<>
    <div className="connect-row">
      <button className="connect-btn" onClick={()=>{setUseLiveApi(true);setIsConnected(true)}}>Połącz z Google Sheets</button>
      <span className="small muted">Po hostingu to jest właściwy przycisk do włączenia live danych.</span>
    </div>

    <div className="grid-4">
      <StatCard label="Instalatorzy" value={installers.length} />
      <StatCard label="Klienci" value={clients.length} />
      <StatCard label="Urządzenia" value={devices.length} />
      <StatCard label="Aktywni / Premium" value={installers.filter(i=>i.plan==='Aktywny'||i.plan==='Premium').length} />
    </div>

    <div className="grid-2" style={{marginTop:16}}>
      <Card><CardContent><p className="section-title">Szybki podgląd biznesowy</p><div className="subcards">
        <div className="subcard"><div className="muted small">Nowi instalatorzy</div><div className="stat-value" style={{fontSize:24}}>{installers.filter(i=>i.plan==='Nowy').length}</div></div>
        <div className="subcard"><div className="muted small">Instalatorzy premium</div><div className="stat-value" style={{fontSize:24}}>{installers.filter(i=>i.plan==='Premium').length}</div></div>
        <div className="subcard"><div className="muted small">Klienci przypisani</div><div className="stat-value" style={{fontSize:24}}>{clients.filter(c=>c.installer).length}</div></div>
      </div></CardContent></Card>
      <Card><CardContent><p className="section-title">Szybkie akcje</p><div style={{display:'grid',gap:10}}>
        <button className="quick-btn">Dodaj instalatora</button><button className="quick-btn">Dodaj klienta</button><button className="quick-btn">Dodaj urządzenie</button><button className="quick-btn">Przejdź do mapy partnerów</button>
      </div></CardContent></Card>
    </div>

    <div className="tabs">{['instalatorzy','klienci','urzadzenia'].map(tab=><button key={tab} className={`tab-btn ${activeTab===tab?'active':''}`} onClick={()=>setActiveTab(tab)}>{tab==='instalatorzy'?'Instalatorzy':tab==='klienci'?'Klienci':'Urządzenia'}</button>)}</div>

    {activeTab==='instalatorzy'&&<div className="list">{loading.installers?<Card><CardContent className="small muted">Ładowanie instalatorów...</CardContent></Card>:errors.installers?<Card><CardContent className="small" style={{color:'#b91c1c'}}>Błąd pobierania instalatorów: {errors.installers}<div className="tiny" style={{wordBreak:'break-all',marginTop:8}}>{INSTALLERS_API}</div></CardContent></Card>:filteredInstallers.length===0?<Card><CardContent className="small muted">Brak instalatorów do wyświetlenia.</CardContent></Card>:filteredInstallers.map(i=><div className="item" key={i.id}><h4>{i.company}</h4>{i.owner?<div className="small">{i.owner}</div>:null}<div className="small">{i.city}</div><Badge plan={i.plan}>{i.plan}</Badge>{i.region?<div className="small muted" style={{marginTop:8}}>{i.region}</div>:null}{i.registrationDate?<div className="tiny">Rejestracja: {i.registrationDate}</div>:null}{i.phone?<div className="small" style={{marginTop:8}}>{i.phone}</div>:null}{i.email?<div className="small">{i.email}</div>:null}</div>)}</div>}
    {activeTab==='klienci'&&<div className="list">{loading.clients?<Card><CardContent className="small muted">Ładowanie klientów...</CardContent></Card>:errors.clients?<Card><CardContent className="small" style={{color:'#b91c1c'}}>Błąd pobierania klientów: {errors.clients}<div className="tiny" style={{wordBreak:'break-all',marginTop:8}}>{CLIENTS_API}</div></CardContent></Card>:filteredClients.length===0?<Card><CardContent className="small muted">Brak klientów do wyświetlenia.</CardContent></Card>:filteredClients.map(c=><div className="item" key={c.id}><h4>{c.name}</h4><div className="small">{c.city}</div>{c.phone?<div className="small">{c.phone}</div>:null}{c.installer?<div className="small">Instalator: {c.installer}</div>:null}<span className="badge">{c.source}</span><div className="tiny" style={{marginTop:10}}>Karta klienta gotowa do rozbudowy o zgłoszenia i historię serwisową.</div></div>)}</div>}
    {activeTab==='urzadzenia'&&<div className="list">{loading.devices?<Card><CardContent className="small muted">Ładowanie urządzeń...</CardContent></Card>:errors.devices?<Card><CardContent className="small" style={{color:'#b91c1c'}}>Błąd pobierania urządzeń: {errors.devices}<div className="tiny" style={{wordBreak:'break-all',marginTop:8}}>{DEVICES_API}</div></CardContent></Card>:filteredDevices.length===0?<Card><CardContent className="small muted">Brak urządzeń do wyświetlenia.</CardContent></Card>:filteredDevices.map(d=><div className="item" key={d.id}><h4>{d.type}</h4><div className="small">Klient: {d.client||'Brak danych'}</div><div className="small">Instalator: {d.installer||'Brak danych'}</div><div className="small">Nr seryjny: {d.serial||'Brak danych'}</div><div className="small">Status: {d.status||'Brak danych'}</div><div className="tiny" style={{marginTop:10}}>Urządzenie gotowe do połączenia z przeglądami, gwarancją i historią serwisu.</div></div>)}</div>}
  </>:<div className="panel-installer">
    <div className="stats-mobile"><StatCard label="Moi klienci" value={installerQuickStats.clients} /><StatCard label="Urządzenia" value={installerQuickStats.devices} /><StatCard label="Aktywne" value={installerQuickStats.activeDevices} /></div>
    <div className="section"><CardContent><h3 className="section-title">Szybkie akcje instalatora</h3><div className="quick-grid"><button className="quick-btn">Dodaj klienta</button><button className="quick-btn">Dodaj urządzenie</button><button className="quick-btn">Zgłoś serwis</button><button className="quick-btn">Moje przypomnienia</button></div></CardContent></div>
    <div className="section"><CardContent><div><h3 className="section-title">Dodaj klienta</h3><div className="muted small">Mobilny formularz dla instalatora — prosty, szybki i gotowy do spięcia z Google Sheets.</div></div>
      <div className="field"><label>Imię i nazwisko / nazwa klienta</label><Input value={clientForm.name} onChange={(e)=>setClientForm(prev=>({...prev,name:e.target.value}))} placeholder="np. Anna Nowak" /></div>
      <div className="field-row-2"><div className="field"><label>Telefon</label><Input value={clientForm.phone} onChange={(e)=>setClientForm(prev=>({...prev,phone:e.target.value}))} placeholder="np. 500 600 700" /></div><div className="field"><label>Miasto</label><Input value={clientForm.city} onChange={(e)=>setClientForm(prev=>({...prev,city:e.target.value}))} placeholder="np. Gdańsk" /></div></div>
      <div className="field"><label>Adres montażu</label><Input value={clientForm.address} onChange={(e)=>setClientForm(prev=>({...prev,address:e.target.value}))} placeholder="Ulica, numer domu" /></div>
      <div className="field"><label>Źródło klienta</label><div className="chip-row">{['Własny klient','Lead BLOKFLOW','Polecenie'].map(option=><button key={option} type="button" onClick={()=>setClientForm(prev=>({...prev,source:option}))} className={`chip ${clientForm.source===option?'active':''}`}>{option}</button>)}</div></div>
      <div className="field"><label>Notatka</label><textarea value={clientForm.note} onChange={(e)=>setClientForm(prev=>({...prev,note:e.target.value}))} placeholder="Krótka informacja o kliencie, budynku lub planowanym montażu" /></div>
      <div className="button-row"><button className="ghost-btn" onClick={resetClientForm}>Wyczyść</button><button className="primary-btn" onClick={handleSaveClient}>Zapisz klienta</button></div>
    </CardContent></div>
    <div className="section"><CardContent><div><h3 className="section-title">Dodaj urządzenie</h3><div className="muted small">Drugi krok po kliencie — rejestracja BLOKFLOW lub innego urządzenia z numerem seryjnym i statusem.</div></div>
      <div className="field"><label>Typ urządzenia</label><Input value={deviceForm.type} onChange={(e)=>setDeviceForm(prev=>({...prev,type:e.target.value}))} placeholder="np. BLOKFLOW Basic" /></div>
      <div className="field"><label>Klient</label><Input value={deviceForm.client} onChange={(e)=>setDeviceForm(prev=>({...prev,client:e.target.value}))} placeholder="np. Anna Nowak" /></div>
      <div className="field-row-2"><div className="field"><label>Numer seryjny</label><Input value={deviceForm.serial} onChange={(e)=>setDeviceForm(prev=>({...prev,serial:e.target.value}))} placeholder="np. BF-2026-001" /></div><div className="field"><label>Status</label><Input value={deviceForm.status} onChange={(e)=>setDeviceForm(prev=>({...prev,status:e.target.value}))} placeholder="np. Aktywne" /></div></div>
      <div className="field"><label>Model / pompa</label><Input value={deviceForm.pump} onChange={(e)=>setDeviceForm(prev=>({...prev,pump:e.target.value}))} placeholder="np. Panasonic Aquarea 7 kW" /></div>
      <div className="field"><label>Termin pierwszego przeglądu</label><Input value={deviceForm.nextService} onChange={(e)=>setDeviceForm(prev=>({...prev,nextService:e.target.value}))} placeholder="np. 2027-02-10" /></div>
      <div className="field"><label>Notatka montażowa</label><textarea value={deviceForm.note} onChange={(e)=>setDeviceForm(prev=>({...prev,note:e.target.value}))} placeholder="Informacje o montażu, konfiguracji, miejscu ustawienia lub uwagach serwisowych" /></div>
      <div className="button-row"><button className="ghost-btn" onClick={resetDeviceForm}>Wyczyść</button><button className="primary-btn" onClick={handleSaveDevice}>Zapisz urządzenie</button></div>
    </CardContent></div>
    <div className="section"><CardContent><div><h3 className="section-title">Zgłoś serwis</h3><div className="muted small">Szybkie zgłoszenie przeglądu lub awarii dla istniejącego urządzenia.</div></div>
      <div className="field"><label>Klient</label><Input value={serviceForm.client} onChange={(e)=>setServiceForm(prev=>({...prev,client:e.target.value}))} placeholder="np. Anna Nowak" /></div>
      <div className="field"><label>Urządzenie / nr seryjny</label><Input value={serviceForm.device} onChange={(e)=>setServiceForm(prev=>({...prev,device:e.target.value}))} placeholder="np. BF-2026-001" /></div>
      <div className="field-row-2"><div className="field"><label>Typ zgłoszenia</label><Input value={serviceForm.kind} onChange={(e)=>setServiceForm(prev=>({...prev,kind:e.target.value}))} placeholder="np. Przegląd / Awaria" /></div><div className="field"><label>Priorytet</label><Input value={serviceForm.priority} onChange={(e)=>setServiceForm(prev=>({...prev,priority:e.target.value}))} placeholder="np. Niski / Pilny" /></div></div>
      <div className="field"><label>Opis problemu</label><textarea value={serviceForm.description} onChange={(e)=>setServiceForm(prev=>({...prev,description:e.target.value}))} placeholder="Opisz problem lub zakres przeglądu" /></div>
      <div className="field"><label>Preferowany termin</label><Input value={serviceForm.preferredDate} onChange={(e)=>setServiceForm(prev=>({...prev,preferredDate:e.target.value}))} placeholder="np. 2026-04-15" /></div>
      <div className="button-row"><button className="ghost-btn" onClick={resetServiceForm}>Wyczyść</button><button className="primary-btn" onClick={handleSaveService}>Wyślij zgłoszenie</button></div>
    </CardContent></div>
    <div className="section"><CardContent><h3 className="section-title">Ostatnie zgłoszenia</h3><div className="list">{serviceTickets.length===0?<p className="small muted">Brak zgłoszeń do wyświetlenia.</p>:serviceTickets.slice(0,5).map(ticket=><div className="item" key={ticket.id}><h4>{ticket.kind}</h4><div className="small muted">Klient: {ticket.client}</div><div className="small muted">Priorytet: {ticket.priority}</div><div className="tiny" style={{marginTop:8}}>Status: {ticket.status}</div></div>)}</div></CardContent></div>
    <div className="section"><CardContent><h3 className="section-title">Moi klienci</h3><div className="list">{filteredClients.length===0?<p className="small muted">Brak klientów do wyświetlenia.</p>:filteredClients.slice(0,5).map(c=><div className="item" key={c.id}><h4>{c.name}</h4><div className="small muted">{c.city}</div>{c.phone?<div className="small" style={{marginTop:8}}>{c.phone}</div>:null}</div>)}</div></CardContent></div>
    <div className="section"><CardContent><h3 className="section-title">Moje urządzenia</h3><div className="list">{filteredDevices.length===0?<p className="small muted">Brak urządzeń do wyświetlenia.</p>:filteredDevices.slice(0,5).map(d=><div className="item" key={d.id}><h4>{d.type}</h4><div className="small muted">Klient: {d.client||'Brak danych'}</div><div className="small muted">Status: {d.status||'Brak danych'}</div>{d.serial?<div className="tiny" style={{marginTop:8}}>Nr seryjny: {d.serial}</div>:null}</div>)}</div></CardContent></div>
    <div className="bottom-nav"><div className="bottom-grid"><button>Start</button><button>Klienci</button><button>Urządzenia</button><button>Konto</button></div></div>
  </div>}
</div>
}

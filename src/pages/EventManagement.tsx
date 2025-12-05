import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Search, Upload, Plus, Download, Settings, 
  Printer, Users, UserCheck, Loader2, ExternalLink, Trash2, Pencil,
  Monitor, Wifi, History, Clock, Image as ImageIcon, Smartphone, QrCode
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- INTERFACES ---
interface Event {
  id: string;
  name: string;
  date: string;
  wifi_ssid: string | null;
  wifi_pass: string | null;
  wifi_img_url: string | null;
  photo_url: string | null;
  photo_img_url: string | null;
}

interface Guest {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  checked_in: boolean;
  checkin_time: string | null;
}

interface ActivityLog {
  id: string;
  created_at: string;
  user_email: string | null;
  action: string;
  details: string | null;
}

// --- FUNÇÃO DE NOME INTELIGENTE (1º Nome + 2 Sobrenomes) ---
const formatNameForBadge = (fullName: string) => {
  if (!fullName) return "";
  
  const prepositions = ["da", "de", "do", "das", "dos", "e"];
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length <= 3) {
    return parts.map((word, index) => {
      const lower = word.toLowerCase();
      if (prepositions.includes(lower) && index !== 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
  }

  let formattedName = [];
  let surnamesCount = 0;

  for (let i = 0; i < parts.length; i++) {
    let word = parts[i].toLowerCase();
    
    let displayWord = word;
    if (!prepositions.includes(word) || i === 0) {
      displayWord = word.charAt(0).toUpperCase() + word.slice(1);
    }

    formattedName.push(displayWord);

    if (i > 0 && !prepositions.includes(word)) {
      surnamesCount++;
    }

    if (surnamesCount >= 2) break;
  }
  
  return formattedName.join(' ');
};

// --- UPLOAD BOX ---
function UploadBox({ label, icon, previewUrl, onUpload }: { label: string, icon?: 'qr-code' | 'image', previewUrl?: string | null, onUpload: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('event-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('event-images').getPublicUrl(fileName);
      onUpload(data.publicUrl);
      toast({ title: "Sucesso", description: "Imagem salva." });
    } catch (error: any) {
      const url = URL.createObjectURL(file);
      onUpload(url);
      toast({ title: "Aviso", description: "Salvando localmente.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-border bg-card/50 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group relative overflow-hidden" onClick={() => !uploading && inputRef.current?.click()}>
      <input type="file" hidden ref={inputRef} onChange={handleFileChange} accept="image/*" disabled={uploading} />
      {uploading ? <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="text-xs text-muted-foreground">Enviando...</span></div> : previewUrl ? <div className="absolute inset-0 w-full h-full"><img src={previewUrl} className="w-full h-full object-contain p-4" alt="Preview" /><div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm"><span className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform">Trocar</span></div></div> : <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-primary transition-colors"><div className="p-4 bg-secondary rounded-full group-hover:bg-primary/20 transition-colors">{icon === 'image' ? <ImageIcon size={28} /> : <Upload size={28} />}</div><div className="text-center"><span className="block text-sm font-bold uppercase tracking-widest">{label}</span><span className="text-xs opacity-60">Clique para selecionar</span></div></div>}
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function EventManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isEquipe } = useAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', company: '', role: '' });
  const [adding, setAdding] = useState(false);
  const [printingGuest, setPrintingGuest] = useState<Guest | null>(null);
  const [previewGuest, setPreviewGuest] = useState<Guest | null>(null);

  const [editGuestOpen, setEditGuestOpen] = useState(false);
  const [guestToEdit, setGuestToEdit] = useState<Guest | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', company: '', role: '' });

  const [eventSettings, setEventSettings] = useState({
    name: '', date: '', wifi_ssid: '', wifi_pass: '', photo_url: '', wifi_img_url: '', photo_img_url: ''
  });

  const canImportExport = isAdmin || isEquipe;
  const canDeleteGuests = isAdmin;
  const canEditGuests = isAdmin || isEquipe;
  const canAccessSettings = isAdmin || isEquipe;
  const canAccessHistory = isAdmin || isEquipe;

  const logActivity = async (action: string, details: string) => {
    if (!user || !id) return;
    await supabase.from('activity_logs').insert({ event_id: id, user_id: user.id, user_email: user.email, action, details });
  };

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { if (id && user) { fetchEvent(); fetchGuests(); subscribeToGuests(); } }, [id, user]);
  useEffect(() => {
    const handleAfterPrint = () => setPrintingGuest(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const fetchEvent = async () => {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error || !data) { toast({ title: 'Erro', description: 'Evento não encontrado.', variant: 'destructive' }); navigate('/dashboard'); } 
    else {
      setEvent(data);
      setEventSettings({
        name: data.name, date: new Date(data.date).toISOString().slice(0, 16),
        wifi_ssid: data.wifi_ssid || '', wifi_pass: data.wifi_pass || '',
        photo_url: data.photo_url || '', wifi_img_url: data.wifi_img_url || '', photo_img_url: data.photo_img_url || ''
      });
    }
    setLoading(false);
  };

  const fetchGuests = async () => { const { data, error } = await supabase.from('guests').select('*').eq('event_id', id).order('name'); if (!error) setGuests(data || []); };
  const fetchActivityLogs = async () => { if (!canAccessHistory) return; setLogsLoading(true); const { data, error } = await supabase.from('activity_logs').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(100); if (!error) setActivityLogs(data || []); setLogsLoading(false); };
  const subscribeToGuests = () => { const channel = supabase.channel('guests-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${id}` }, () => fetchGuests()).subscribe(); return () => { supabase.removeChannel(channel); }; };

  const handleToggleCheckIn = async (guest: Guest) => {
    const newCheckedIn = !guest.checked_in;
    const checkinTime = newCheckedIn ? new Date().toISOString() : null;

    // ATUALIZAÇÃO OTIMISTA: muda na tela ANTES de esperar o banco
    setGuests(prev => prev.map(g =>
      g.id === guest.id
        ? { ...g, checked_in: newCheckedIn, checkin_time: checkinTime }
        : g
    ));

    // Requisição ao banco em background
    const { error } = await supabase
      .from('guests')
      .update({ checked_in: newCheckedIn, checkin_time: checkinTime })
      .eq('id', guest.id);

    if (error) {
      // Reverte se der erro
      setGuests(prev => prev.map(g =>
        g.id === guest.id
          ? { ...g, checked_in: guest.checked_in, checkin_time: guest.checkin_time }
          : g
      ));
      toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' });
    } else {
      // Log em background (sem await - não bloqueia)
      logActivity(newCheckedIn ? 'Check-in' : 'Check-out', guest.name);
    }
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault(); setAdding(true);
    const { error } = await supabase.from('guests').insert({ event_id: id, name: newGuest.name, company: newGuest.company || null, role: newGuest.role || null });
    if (error) toast({ title: 'Erro', description: 'Falha ao adicionar.', variant: 'destructive' }); 
    else { toast({ title: 'Sucesso', description: 'Convidado adicionado!' }); await logActivity('Adicionou', `${newGuest.name}`); await fetchGuests(); setAddGuestOpen(false); setNewGuest({ name: '', company: '', role: '' }); }
    setAdding(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!guestToEdit) return; setAdding(true);
    const { error } = await supabase.from('guests').update({ name: editFormData.name, company: editFormData.company || null, role: editFormData.role || null }).eq('id', guestToEdit.id);
    if (error) toast({ title: 'Erro', description: 'Falha ao editar.', variant: 'destructive' }); else { toast({ title: 'Sucesso', description: 'Convidado atualizado!' }); await logActivity('Editou', `${editFormData.name}`); await fetchGuests(); setEditGuestOpen(false); setGuestToEdit(null); }
    setAdding(false);
  };

  const handleDeleteGuest = async (guest: Guest) => { if (!canDeleteGuests) return; const { error } = await supabase.from('guests').delete().eq('id', guest.id); if (error) toast({ title: 'Erro', description: 'Falha ao excluir.', variant: 'destructive' }); else { await logActivity('Excluiu', `${guest.name}`); await fetchGuests(); } };
  
  const handleOpenPreview = (guest: Guest) => {
    setPreviewGuest(guest);
  };

  const handleConfirmPrint = () => {
    if (!previewGuest) return;
    setPrintingGuest(previewGuest);
    setPreviewGuest(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canImportExport) return; const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result; const workbook = XLSX.read(data, { type: 'binary' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
        const guestsToInsert = jsonData.map((row: any) => {
          const keys = Object.keys(row);
          const nameKey = keys.find(k => k.toLowerCase().match(/(nome|name|participante|convidado|fullname)/));
          const companyKey = keys.find(k => k.toLowerCase().match(/(empresa|company|organizacao|instituicao|org)/));
          const roleKey = keys.find(k => k.toLowerCase().match(/(cargo|role|funcao|ocupacao)/));
          if (!nameKey) return null; return { event_id: id, name: row[nameKey], company: companyKey ? row[companyKey] : null, role: roleKey ? row[roleKey] : null };
        }).filter((g: any) => g && g.name);
        if (guestsToInsert.length === 0) { toast({ title: 'Erro', description: 'Colunas inválidas.', variant: 'destructive' }); return; }
        const { error } = await supabase.from('guests').insert(guestsToInsert);
        if (error) toast({ title: 'Erro', description: 'Falha no banco.', variant: 'destructive' }); else { toast({ title: 'Sucesso', description: `${guestsToInsert.length} importados!` }); await logActivity('Importou', 'Excel'); await fetchGuests(); }
      } catch (err) { toast({ title: 'Erro', description: 'Arquivo inválido.', variant: 'destructive' }); }
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const handleExportExcel = async () => { if (!canImportExport) return; const ws = XLSX.utils.json_to_sheet(guests.map(g => ({ Nome: g.name, Empresa: g.company || '', Cargo: g.role || '', 'Check-in': g.checked_in ? 'Sim' : 'Não', 'Hora': g.checkin_time ? new Date(g.checkin_time).toLocaleString('pt-BR') : '' }))); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Convidados'); XLSX.writeFile(wb, `${event?.name}_convidados.xlsx`); await logActivity('Exportou', 'Excel'); };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); if (!canAccessSettings) return; setSaving(true);
    const { error } = await supabase.from('events').update({
      name: eventSettings.name, date: new Date(eventSettings.date).toISOString(),
      wifi_ssid: eventSettings.wifi_ssid || null, wifi_pass: eventSettings.wifi_pass || null,
      photo_url: eventSettings.photo_url || null, wifi_img_url: eventSettings.wifi_img_url || null, photo_img_url: eventSettings.photo_img_url || null
    }).eq('id', id);
    if (error) toast({ title: 'Erro', description: 'Falha ao salvar.', variant: 'destructive' }); else { toast({ title: 'Sucesso', description: 'Salvo!' }); await logActivity('Atualizou configurações', 'Alterações salvas'); fetchEvent(); }
    setSaving(false);
  };

  const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.company?.toLowerCase().includes(searchTerm.toLowerCase()));
  const formatLogTime = (ts: string) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (authLoading || loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      
      {/* CSS IMPRESSÃO BLINDADO: ORIENTAÇÃO TRAVADA EM LANDSCAPE */}
      <style>{`
        @media print {
          /* FORÇA ORIENTAÇÃO HORIZONTAL (LANDSCAPE) */
          @page {
            size: 90mm 35mm landscape;
            margin: 0;
            orientation: landscape;
          }

          /* Esconde o corpo do site e força fundo branco */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 90mm !important;
            height: 35mm !important;
            background: white !important;
            background-color: white !important;
          }

          body * { visibility: hidden; }

          /* Container de impressão */
          .print-container {
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 90mm !important;
            height: 35mm !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            background: white !important;
            background-color: white !important;
          }

          /* Força visibilidade e cores corretas */
          .print-container,
          .print-container *,
          .print-label,
          .print-label *,
          .guest-name,
          .guest-company {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .print-label {
            position: relative !important;
            width: 90mm !important;
            height: 35mm !important;
            min-width: 90mm !important;
            min-height: 35mm !important;
            max-width: 90mm !important;
            max-height: 35mm !important;

            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            text-align: center !important;

            background: white !important;
            color: black !important;

            padding: 0 3mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* NOME: 14pt e NUNCA QUEBRA LINHA */
          .guest-name {
            display: block !important;
            opacity: 1 !important;
            position: relative !important;
            font-family: 'Inter', Arial, sans-serif !important;
            font-weight: 800 !important;
            font-size: 17pt !important;
            line-height: 1.1 !important;
            width: 100% !important;

            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;

            margin: 0 0 1.5mm 0 !important;
            padding: 0 !important;
            color: black !important;
          }

          /* EMPRESA: 14pt e NUNCA QUEBRA LINHA */
          .guest-company {
            display: block !important;
            opacity: 1 !important;
            position: relative !important;
            font-family: 'Inter', Arial, sans-serif !important;
            font-weight: 500 !important;
            font-size: 10pt !important;
            line-height: 1.2 !important;
            width: 100% !important;

            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;

            margin: 0 !important;
            padding: 0 !important;
            color: black !important;
          }
        }
      `}</style>

      {/* CONTAINER DE IMPRESSÃO - UMA ETIQUETA */}
      {printingGuest && (
        <div className="print-container">
          <div className="print-label">
            <div className="guest-name">{formatNameForBadge(printingGuest.name)}</div>
            {printingGuest.company && <div className="guest-company">{printingGuest.company}</div>}
          </div>
        </div>
      )}

      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-5 w-5" /></Button><h1 className="text-lg font-semibold text-foreground truncate">{event?.name}</h1></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-border" onClick={() => window.open(`/totem/${id}`, '_blank')}><Monitor className="h-4 w-4 mr-2" />Totem</Button>
            <Button variant="outline" size="sm" className="border-border" onClick={() => window.open(`/wifi/${id}`, '_blank')}><Wifi className="h-4 w-4 mr-2" />TV</Button>
            <Button variant="outline" size="sm" className="border-border" onClick={() => window.open(`/wifi/${id}?view=qr`, '_blank')}><Smartphone className="h-4 w-4 mr-2" />Celular</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 print:hidden">
        <Tabs defaultValue="guests" className="space-y-6" onValueChange={(v) => { if(v === 'history') fetchActivityLogs(); }}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="guests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Convidados</TabsTrigger>
            {canAccessHistory && <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Histórico</TabsTrigger>}
            {canAccessSettings && <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Configurações</TabsTrigger>}
          </TabsList>

          <TabsContent value="guests" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-6"><div className="flex items-center gap-3 mb-2"><Users className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Total</span></div><p className="text-5xl font-bold text-primary">{guests.length}</p></div>
              <div className="bg-card border border-border rounded-xl p-6"><div className="flex items-center gap-3 mb-2"><UserCheck className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Presentes</span></div><p className="text-5xl font-bold text-primary">{guests.filter(g=>g.checked_in).length}</p></div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar convidado..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-card border-border" /></div>
              {canImportExport && <><label className="cursor-pointer"><input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" /><Button variant="outline" className="border-border" asChild><span><Upload className="h-4 w-4 mr-2" />Importar</span></Button></label><Button variant="outline" className="border-border" onClick={handleExportExcel}><Download className="h-4 w-4 mr-2" />Exportar</Button></>}
              <Dialog open={addGuestOpen} onOpenChange={setAddGuestOpen}><DialogTrigger asChild><Button variant="outline" className="border-border"><Plus className="h-4 w-4 mr-2" />Manual</Button></DialogTrigger><DialogContent className="bg-card border-border"><DialogHeader><DialogTitle>Adicionar Convidado</DialogTitle></DialogHeader><form onSubmit={handleAddGuest} className="space-y-4 mt-4"><Input placeholder="Nome" value={newGuest.name} onChange={e=>setNewGuest({...newGuest, name: e.target.value})} required className="bg-secondary border-border" /><Input placeholder="Empresa" value={newGuest.company} onChange={e=>setNewGuest({...newGuest, company: e.target.value})} className="bg-secondary border-border" /><Input placeholder="Cargo" value={newGuest.role} onChange={e=>setNewGuest({...newGuest, role: e.target.value})} className="bg-secondary border-border" /><Button type="submit" className="w-full bg-primary" disabled={adding}>Adicionar</Button></form></DialogContent></Dialog>
            </div>
            <div className="space-y-3">
              {filteredGuests.length===0?<div className="text-center py-12 text-muted-foreground">Nenhum convidado encontrado.</div>:filteredGuests.map((g,i)=>(<div key={g.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in" style={{animationDelay:`${i*30}ms`}}><div className="flex-1 min-w-0"><div className="flex items-center gap-3"><h3 className="font-semibold text-foreground truncate">{g.name}</h3>{g.checked_in&&<Badge className="bg-primary text-primary-foreground">Presente</Badge>}</div>{(g.role||g.company)&&<p className="text-sm text-muted-foreground mt-1 truncate">{[g.role,g.company].filter(Boolean).join(' • ')}</p>}</div><div className="flex items-center gap-3 shrink-0">{canEditGuests && <Button variant="ghost" size="icon" onClick={() => { setGuestToEdit(g); setEditFormData({ name: g.name, company: g.company || '', role: g.role || '' }); setEditGuestOpen(true); }}><Pencil className="h-4 w-4"/></Button>}<Button variant="ghost" size="icon" onClick={()=>handleOpenPreview(g)}><Printer className="h-4 w-4"/></Button>{canDeleteGuests&&<Button variant="ghost" size="icon" onClick={()=>handleDeleteGuest(g)} className="hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>}<Switch checked={g.checked_in} onCheckedChange={()=>handleToggleCheckIn(g)}/></div></div>))}
            </div>
          </TabsContent>

          {canAccessHistory && (
            <TabsContent value="history" className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-4"><History className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Histórico</h3></div>
              {logsLoading ? <Loader2 className="animate-spin text-primary mx-auto" /> : <div className="space-y-2">{activityLogs.map(log=><div key={log.id} className="bg-card border border-border rounded-lg p-4 flex gap-4"><div className="flex items-center gap-2 text-muted-foreground shrink-0"><Clock className="h-4 w-4"/><span className="text-sm font-mono">{formatLogTime(log.created_at)}</span></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><Badge variant="outline" className="border-primary text-primary">{log.action}</Badge><span className="text-sm text-muted-foreground">{log.user_email}</span></div>{log.details && <p className="text-sm text-foreground mt-1">{log.details}</p>}</div></div>)}</div>}
            </TabsContent>
          )}

          {canAccessSettings && (
            <TabsContent value="settings" className="space-y-6 animate-fade-in">
              <form onSubmit={handleSaveSettings} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Nome do Evento</Label><Input value={eventSettings.name} onChange={e=>setEventSettings({...eventSettings, name: e.target.value})} className="bg-card border-border" /></div>
                  <div className="space-y-2"><Label>Data</Label><Input type="datetime-local" value={eventSettings.date} onChange={e=>setEventSettings({...eventSettings, date: e.target.value})} className="bg-card border-border" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-card border border-border rounded-xl p-6 shadow-lg col-span-1"><div className="flex items-center gap-2 border-b border-border pb-4 mb-4"><Monitor className="text-primary" /><h3 className="font-bold">Totem (Térreo)</h3></div><div className="text-sm text-muted-foreground p-4 bg-secondary/30 rounded-lg border border-border text-center"><QrCode className="mx-auto mb-2 opacity-50" size={32} />Gera QR Code automático para check-in. (Sem upload)</div></div>
                  <div className="bg-card border border-border rounded-xl p-6 shadow-lg col-span-1"><div className="flex items-center gap-2 border-b border-border pb-4 mb-4"><Wifi className="text-primary" /><h3 className="font-bold">TV (12º Andar)</h3></div><div className="space-y-4"><Label>Arte Horizontal (1920x1080)</Label><UploadBox label="Arraste a Arte da TV" icon="image" previewUrl={eventSettings.wifi_img_url} onUpload={(url) => setEventSettings({...eventSettings, wifi_img_url: url})} /><p className="text-xs text-muted-foreground">Esta imagem aparecerá na TV.</p></div></div>
                  <div className="bg-card border border-border rounded-xl p-6 shadow-lg col-span-1"><div className="flex items-center gap-2 border-b border-border pb-4 mb-4"><Smartphone className="text-primary" /><h3 className="font-bold">Celular / Dados</h3></div><div className="space-y-4"><Label>Arte Vertical (Mobile)</Label><UploadBox label="Arraste a Arte do Celular" icon="image" previewUrl={eventSettings.photo_img_url} onUpload={(url) => setEventSettings({...eventSettings, photo_img_url: url})} /><div className="space-y-1"><Label>SSID Wi-Fi</Label><Input value={eventSettings.wifi_ssid} onChange={e=>setEventSettings({...eventSettings, wifi_ssid: e.target.value})} className="bg-secondary border-border"/></div><div className="space-y-1"><Label>Senha Wi-Fi</Label><Input value={eventSettings.wifi_pass} onChange={e=>setEventSettings({...eventSettings, wifi_pass: e.target.value})} className="bg-secondary border-border"/></div><div className="space-y-1"><Label>Link Moments</Label><Input value={eventSettings.photo_url} onChange={e=>setEventSettings({...eventSettings, photo_url: e.target.value})} className="bg-secondary border-border"/></div></div></div>
                </div>
                <div className="pt-6 border-t border-border flex justify-end"><Button type="submit" className="bg-primary hover:bg-primary/90 px-8 py-6 h-auto text-lg" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Salvar Tudo'}</Button></div>
              </form>
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={editGuestOpen} onOpenChange={setEditGuestOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Editar Convidado</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} required className="bg-secondary border-border" /></div>
              <div className="space-y-2"><Label>Empresa</Label><Input value={editFormData.company} onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })} className="bg-secondary border-border" /></div>
              <div className="space-y-2"><Label>Cargo</Label><Input value={editFormData.role} onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })} className="bg-secondary border-border" /></div>
              <Button type="submit" className="w-full bg-primary" disabled={adding}>Salvar Alterações</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL PREVIEW DA ETIQUETA - ESTILO BARTENDER */}
        <Dialog open={!!previewGuest} onOpenChange={(open) => !open && setPreviewGuest(null)}>
          <DialogContent className="bg-[#2a2a2a] border-[#444] max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <Printer className="h-5 w-5 text-yellow-500" />
                Preview da Etiqueta
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              {/* Área de preview com fundo escuro estilo editor */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 relative">
                {/* Régua superior */}
                <div className="flex justify-between text-[10px] text-gray-500 mb-2 px-1">
                  <span>0mm</span>
                  <span>45mm</span>
                  <span>90mm</span>
                </div>

                {/* Container da etiqueta com sombra e proporção exata */}
                <div className="relative mx-auto" style={{ width: '340px', height: '132px' }}>
                  {/* Sombra da etiqueta */}
                  <div
                    className="absolute inset-0 bg-black/30 rounded-sm"
                    style={{ transform: 'translate(4px, 4px)' }}
                  />

                  {/* ETIQUETA - Réplica exata da impressão */}
                  <div
                    className="relative bg-white rounded-sm overflow-hidden"
                    style={{
                      width: '340px',  /* 90mm em escala */
                      height: '132px', /* 35mm em escala */
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                    }}
                  >
                    {/* Conteúdo centralizado - IDÊNTICO ao print-label */}
                    <div
                      className="w-full h-full flex flex-col justify-center items-center text-center"
                      style={{ padding: '0 11px' }} /* 3mm em escala */
                    >
                      {/* Nome - 17pt convertido para escala */}
                      <div
                        className="w-full truncate text-black"
                        style={{
                          fontFamily: "'Inter', Arial, sans-serif",
                          fontWeight: 800,
                          fontSize: '21px', /* 17pt em escala proporcional */
                          lineHeight: 1.1,
                          marginBottom: '6px' /* 1.5mm em escala */
                        }}
                      >
                        {previewGuest && formatNameForBadge(previewGuest.name)}
                      </div>

                      {/* Empresa - 10pt convertido para escala */}
                      {previewGuest?.company && (
                        <div
                          className="w-full truncate text-black"
                          style={{
                            fontFamily: "'Inter', Arial, sans-serif",
                            fontWeight: 500,
                            fontSize: '12px', /* 10pt em escala proporcional */
                            lineHeight: 1.2
                          }}
                        >
                          {previewGuest.company}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Régua lateral */}
                <div className="absolute right-2 top-10 bottom-10 flex flex-col justify-between text-[10px] text-gray-500">
                  <span>0</span>
                  <span>17</span>
                  <span>35mm</span>
                </div>
              </div>

              {/* Info da etiqueta */}
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  90mm × 35mm
                </span>
                <span>Bematech LB-1000</span>
                <span>Landscape</span>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-[#555] text-gray-300 hover:bg-[#333] hover:text-white"
                  onClick={() => setPreviewGuest(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-semibold"
                  onClick={handleConfirmPrint}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

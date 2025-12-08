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
  Monitor, Wifi, History, Clock, Image as ImageIcon, Smartphone, QrCode,
  Minus, PlusIcon, Type, RotateCcw, HardHat
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
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
  event_logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  tertiary_color: string | null;
  event_logo_size: number | null;
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

interface Staff {
  id: string;
  name: string;
  role: string | null;
  checked_in: boolean;
  checkin_time: string | null;
}

// --- FUNÇÃO PARA NORMALIZAR TEXTO (remover acentos para busca) ---
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

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
  const [previewGuest, setPreviewGuest] = useState<Guest | null>(null);

  // Estados para ajuste de fonte da etiqueta (valores em pt)
  const [nameFontSize, setNameFontSize] = useState(17);
  const [companyFontSize, setCompanyFontSize] = useState(10);

  const [editGuestOpen, setEditGuestOpen] = useState(false);
  const [guestToEdit, setGuestToEdit] = useState<Guest | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', company: '', role: '' });

  // Estados para Equipe
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: '' });
  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<Staff | null>(null);
  const [editStaffFormData, setEditStaffFormData] = useState({ name: '', role: '' });
  const [previewStaff, setPreviewStaff] = useState<Staff | null>(null);

  const [eventSettings, setEventSettings] = useState({
    name: '', date: '', wifi_ssid: '', wifi_pass: '', photo_url: '', wifi_img_url: '', photo_img_url: '',
    event_logo_url: '', primary_color: '#f37021', secondary_color: '', tertiary_color: '', event_logo_size: 150
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
  useEffect(() => { if (id && user) { fetchEvent(); fetchGuests(); fetchStaff(); subscribeToGuests(); subscribeToStaff(); } }, [id, user]);

  const fetchEvent = async () => {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error || !data) { toast({ title: 'Erro', description: 'Evento não encontrado.', variant: 'destructive' }); navigate('/dashboard'); }
    else {
      setEvent(data);
      setEventSettings({
        name: data.name, date: new Date(data.date).toISOString().slice(0, 16),
        wifi_ssid: data.wifi_ssid || '', wifi_pass: data.wifi_pass || '',
        photo_url: data.photo_url || '', wifi_img_url: data.wifi_img_url || '', photo_img_url: data.photo_img_url || '',
        event_logo_url: data.event_logo_url || '', primary_color: data.primary_color || '#f37021',
        secondary_color: data.secondary_color || '', tertiary_color: data.tertiary_color || '',
        event_logo_size: data.event_logo_size || 150
      });
    }
    setLoading(false);
  };

  const fetchGuests = async () => { const { data, error } = await supabase.from('guests').select('*').eq('event_id', id).order('name'); if (!error) setGuests(data || []); };
  const fetchStaff = async () => { const { data, error } = await supabase.from('staff').select('*').eq('event_id', id).order('name'); if (!error) setStaff(data || []); };
  const fetchActivityLogs = async () => { if (!canAccessHistory) return; setLogsLoading(true); const { data, error } = await supabase.from('activity_logs').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(100); if (!error) setActivityLogs(data || []); setLogsLoading(false); };
  const subscribeToGuests = () => { const channel = supabase.channel('guests-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${id}` }, () => fetchGuests()).subscribe(); return () => { supabase.removeChannel(channel); }; };
  const subscribeToStaff = () => { const channel = supabase.channel('staff-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'staff', filter: `event_id=eq.${id}` }, () => fetchStaff()).subscribe(); return () => { supabase.removeChannel(channel); }; };

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

  // --- FUNÇÕES STAFF ---
  const handleToggleStaffCheckIn = async (s: Staff) => {
    const newCheckedIn = !s.checked_in;
    const checkinTime = newCheckedIn ? new Date().toISOString() : null;
    setStaff(prev => prev.map(st => st.id === s.id ? { ...st, checked_in: newCheckedIn, checkin_time: checkinTime } : st));
    const { error } = await supabase.from('staff').update({ checked_in: newCheckedIn, checkin_time: checkinTime }).eq('id', s.id);
    if (error) {
      setStaff(prev => prev.map(st => st.id === s.id ? { ...st, checked_in: s.checked_in, checkin_time: s.checkin_time } : st));
      toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' });
    } else {
      logActivity(newCheckedIn ? 'Check-in Equipe' : 'Check-out Equipe', s.name);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault(); setAdding(true);
    const { error } = await supabase.from('staff').insert({ event_id: id, name: newStaff.name, role: newStaff.role || null });
    if (error) toast({ title: 'Erro', description: 'Falha ao adicionar.', variant: 'destructive' });
    else { toast({ title: 'Sucesso', description: 'Membro da equipe adicionado!' }); await logActivity('Adicionou Equipe', `${newStaff.name}`); await fetchStaff(); setAddStaffOpen(false); setNewStaff({ name: '', role: '' }); }
    setAdding(false);
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault(); if (!staffToEdit) return; setAdding(true);
    const { error } = await supabase.from('staff').update({ name: editStaffFormData.name, role: editStaffFormData.role || null }).eq('id', staffToEdit.id);
    if (error) toast({ title: 'Erro', description: 'Falha ao editar.', variant: 'destructive' });
    else { toast({ title: 'Sucesso', description: 'Membro atualizado!' }); await logActivity('Editou Equipe', `${editStaffFormData.name}`); await fetchStaff(); setEditStaffOpen(false); setStaffToEdit(null); }
    setAdding(false);
  };

  const handleDeleteStaff = async (s: Staff) => {
    if (!canDeleteGuests) return;
    const { error } = await supabase.from('staff').delete().eq('id', s.id);
    if (error) toast({ title: 'Erro', description: 'Falha ao excluir.', variant: 'destructive' });
    else { await logActivity('Excluiu Equipe', `${s.name}`); await fetchStaff(); }
  };

  const handleOpenStaffPreview = (s: Staff) => { setPreviewStaff(s); };
  const handleOpenPreview = (guest: Guest) => { setPreviewGuest(guest); };

  // Função de impressão via iframe - mais confiável
  const printViaIframe = (name: string, subtitle: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '90mm';
    iframe.style.height = '35mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: 90mm 35mm;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            width: 90mm;
            height: 35mm;
            margin: 0;
            padding: 0;
            background: white;
          }
          .label {
            width: 90mm;
            height: 35mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 0 3mm;
            background: white;
            font-family: 'Inter', Arial, sans-serif;
          }
          .name {
            font-weight: 800;
            font-size: ${nameFontSize}pt;
            line-height: 1.1;
            color: #000000;
            margin-bottom: 1.5mm;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .subtitle {
            font-weight: 500;
            font-size: ${companyFontSize}pt;
            line-height: 1.2;
            color: #000000;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="name">${name}</div>
          ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    // Aguarda a fonte carregar antes de imprimir
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Remove o iframe após um tempo
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    };
  };

  const handleConfirmStaffPrint = () => {
    if (!previewStaff) return;
    const name = formatNameForBadge(previewStaff.name);
    const role = previewStaff.role || 'Equipe';
    setPreviewStaff(null);
    setTimeout(() => {
      printViaIframe(name, role);
    }, 100);
  };

  const handleConfirmPrint = () => {
    if (!previewGuest) return;
    const name = formatNameForBadge(previewGuest.name);
    const company = previewGuest.company || '';
    setPreviewGuest(null);
    setTimeout(() => {
      printViaIframe(name, company);
    }, 100);
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
      photo_url: eventSettings.photo_url || null, wifi_img_url: eventSettings.wifi_img_url || null, photo_img_url: eventSettings.photo_img_url || null,
      event_logo_url: eventSettings.event_logo_url || null, primary_color: eventSettings.primary_color || '#f37021',
      secondary_color: eventSettings.secondary_color || null, tertiary_color: eventSettings.tertiary_color || null,
      event_logo_size: eventSettings.event_logo_size || 150
    }).eq('id', id);
    if (error) toast({ title: 'Erro', description: 'Falha ao salvar.', variant: 'destructive' }); else { toast({ title: 'Sucesso', description: 'Salvo!' }); await logActivity('Atualizou configurações', 'Alterações salvas'); fetchEvent(); }
    setSaving(false);
  };

  const filteredGuests = guests
    .filter(g => normalizeText(g.name).includes(normalizeText(searchTerm)) || normalizeText(g.company || '').includes(normalizeText(searchTerm)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const filteredStaff = staff
    .filter(s => normalizeText(s.name).includes(normalizeText(staffSearchTerm)) || normalizeText(s.role || '').includes(normalizeText(staffSearchTerm)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const formatLogTime = (ts: string) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  // Cores do evento
  const eventColor = eventSettings.primary_color || '#f37021';
  const secondaryColor = eventSettings.secondary_color || eventColor; // Fallback para primária

  if (authLoading || loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      
      {/* CSS IMPRESSÃO DINÂMICO: USA VALORES AJUSTÁVEIS */}
      <style>{`
        @media print {
          @page {
            size: 90mm 35mm landscape;
            margin: 0;
            orientation: landscape;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 90mm !important;
            height: 35mm !important;
            background: white !important;
          }

          body * { visibility: hidden; }

          .print-container {
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 90mm !important;
            height: 35mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .print-container *,
          .print-label *,
          .guest-name,
          .guest-company {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-label {
            width: 90mm !important;
            height: 35mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            text-align: center !important;
            background: white !important;
            padding: 0 3mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .guest-name {
            font-family: 'Inter', Arial, sans-serif !important;
            font-weight: 800 !important;
            font-size: ${nameFontSize}pt !important;
            line-height: 1.1 !important;
            width: 100% !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            margin: 0 0 1.5mm 0 !important;
            color: black !important;
          }

          .guest-company {
            font-family: 'Inter', Arial, sans-serif !important;
            font-weight: 500 !important;
            font-size: ${companyFontSize}pt !important;
            line-height: 1.2 !important;
            width: 100% !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            margin: 0 !important;
            color: black !important;
          }
        }
      `}</style>

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
        {/* CSS dinâmico para cores do evento */}
        <style>{`
          .event-tabs [role="tablist"] button[data-state="active"] {
            background-color: ${eventColor} !important;
            color: white !important;
          }
          .event-tabs [role="tablist"] button[data-state="active"]:hover {
            background-color: ${eventColor} !important;
          }
          .event-tabs button[role="switch"][data-state="checked"] {
            background-color: ${secondaryColor} !important;
          }
          .event-tabs button.inline-flex:hover:not([role="switch"]):not([data-state]) {
            background-color: ${eventColor}20 !important;
            color: ${eventColor} !important;
          }
          .event-tabs .bg-primary {
            background-color: ${eventColor} !important;
          }
          .event-tabs .bg-primary:hover {
            background-color: ${eventColor}dd !important;
          }
          .event-tabs .text-primary {
            color: ${eventColor} !important;
          }
          .event-tabs .border-primary {
            border-color: ${eventColor} !important;
          }
          .event-tabs .hover\\:border-primary:hover {
            border-color: ${eventColor} !important;
          }
          .event-tabs .hover\\:bg-primary\\/5:hover {
            background-color: ${eventColor}10 !important;
          }
        `}</style>

        <Tabs defaultValue="guests" className="space-y-6 event-tabs" onValueChange={(v) => { if(v === 'history') fetchActivityLogs(); }}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="guests">Convidados</TabsTrigger>
            <TabsTrigger value="staff">Equipe</TabsTrigger>
            {canAccessHistory && <TabsTrigger value="history">Histórico</TabsTrigger>}
            {canAccessSettings && <TabsTrigger value="settings">Configurações</TabsTrigger>}
          </TabsList>

          <TabsContent value="guests" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-6"><div className="flex items-center gap-3 mb-2"><Users className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Total</span></div><p className="text-5xl font-bold" style={{ color: eventColor }}>{guests.length}</p></div>
              <div className="bg-card border border-border rounded-xl p-6"><div className="flex items-center gap-3 mb-2"><UserCheck className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Presentes</span></div><p className="text-5xl font-bold" style={{ color: eventColor }}>{guests.filter(g=>g.checked_in).length}</p></div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar convidado..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-card border-border" /></div>
              {canImportExport && <><label className="cursor-pointer"><input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" /><Button variant="outline" className="border-border" asChild><span><Upload className="h-4 w-4 mr-2" />Importar</span></Button></label><Button variant="outline" className="border-border" onClick={handleExportExcel}><Download className="h-4 w-4 mr-2" />Exportar</Button></>}
              <Dialog open={addGuestOpen} onOpenChange={setAddGuestOpen}><DialogTrigger asChild><Button variant="outline" className="border-border"><Plus className="h-4 w-4 mr-2" />Manual</Button></DialogTrigger><DialogContent className="bg-card border-border"><DialogHeader><DialogTitle>Adicionar Convidado</DialogTitle></DialogHeader><form onSubmit={handleAddGuest} className="space-y-4 mt-4"><Input placeholder="Nome" value={newGuest.name} onChange={e=>setNewGuest({...newGuest, name: e.target.value})} required className="bg-secondary border-border" /><Input placeholder="Empresa" value={newGuest.company} onChange={e=>setNewGuest({...newGuest, company: e.target.value})} className="bg-secondary border-border" /><Input placeholder="Cargo" value={newGuest.role} onChange={e=>setNewGuest({...newGuest, role: e.target.value})} className="bg-secondary border-border" /><Button type="submit" className="w-full bg-primary" disabled={adding}>Adicionar</Button></form></DialogContent></Dialog>
            </div>
            <div className="space-y-3">
              {filteredGuests.length===0?<div className="text-center py-12 text-muted-foreground">Nenhum convidado encontrado.</div>:filteredGuests.map((g,i)=>(<div key={g.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in" style={{animationDelay:`${i*30}ms`}}><div className="flex-1 min-w-0"><div className="flex items-center gap-3"><h3 className="font-semibold text-foreground truncate">{g.name}</h3>{g.checked_in&&<Badge style={{ backgroundColor: eventColor }} className="text-white">Presente</Badge>}</div>{(g.role||g.company)&&<p className="text-sm text-muted-foreground mt-1 truncate">{[g.role,g.company].filter(Boolean).join(' • ')}</p>}</div><div className="flex items-center gap-3 shrink-0">{canEditGuests && <Button variant="ghost" size="icon" onClick={() => { setGuestToEdit(g); setEditFormData({ name: g.name, company: g.company || '', role: g.role || '' }); setEditGuestOpen(true); }}><Pencil className="h-4 w-4"/></Button>}<Button variant="ghost" size="icon" onClick={()=>handleOpenPreview(g)}><Printer className="h-4 w-4"/></Button>{canDeleteGuests&&<Button variant="ghost" size="icon" onClick={()=>handleDeleteGuest(g)} className="hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>}<Switch checked={g.checked_in} onCheckedChange={()=>handleToggleCheckIn(g)}/></div></div>))}
            </div>
          </TabsContent>

          {/* ABA Equipe */}
          <TabsContent value="staff" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2"><HardHat className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Total Equipe</span></div>
                <p className="text-5xl font-bold" style={{ color: eventColor }}>{staff.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2"><UserCheck className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Presentes</span></div>
                <p className="text-5xl font-bold" style={{ color: eventColor }}>{staff.filter(s => s.checked_in).length}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar na equipe..." value={staffSearchTerm} onChange={(e) => setStaffSearchTerm(e.target.value)} className="pl-10 bg-card border-border" />
              </div>
              <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-border"><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle>Adicionar Membro da Equipe</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddStaff} className="space-y-4 mt-4">
                    <Input placeholder="Nome" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} required className="bg-secondary border-border" />
                    <Input placeholder="Função (ex: Recepção, Audiovisual)" value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} className="bg-secondary border-border" />
                    <Button type="submit" className="w-full bg-primary" disabled={adding}>Adicionar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {filteredStaff.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum membro da equipe encontrado.</div>
              ) : filteredStaff.map((s, i) => (
                <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                      <Badge style={{ backgroundColor: eventColor }} className="text-white">Equipe</Badge>
                      {s.checked_in && <Badge style={{ backgroundColor: eventColor }} className="text-white">Presente</Badge>}
                    </div>
                    {s.role && <p className="text-sm text-muted-foreground mt-1 truncate">{s.role}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {canEditGuests && (
                      <Button variant="ghost" size="icon" onClick={() => { setStaffToEdit(s); setEditStaffFormData({ name: s.name, role: s.role || '' }); setEditStaffOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleOpenStaffPreview(s)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    {canDeleteGuests && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteStaff(s)} className="hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Switch checked={s.checked_in} onCheckedChange={() => handleToggleStaffCheckIn(s)} />
                  </div>
                </div>
              ))}
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
                {/* BRANDING DO EVENTO */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Identidade Visual do Evento
                  </h3>
                  {/* Logo do Evento */}
                  <div className="space-y-3 mb-6">
                    <Label>Logo do Evento</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <UploadBox
                          label="Logo do Evento"
                          icon="image"
                          previewUrl={eventSettings.event_logo_url}
                          onUpload={(url) => setEventSettings({...eventSettings, event_logo_url: url})}
                        />
                      </div>
                      {eventSettings.event_logo_url && (
                        <div className="space-y-4">
                          <div className="bg-secondary/30 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-3">Preview do tamanho:</p>
                            <div className="flex items-center justify-center bg-black/50 rounded-lg p-4 min-h-[120px]">
                              <img
                                src={eventSettings.event_logo_url}
                                alt="Logo Preview"
                                style={{ width: `${eventSettings.event_logo_size}px`, height: 'auto', maxHeight: '100px', objectFit: 'contain' }}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Tamanho da Logo</Label>
                              <span className="text-sm text-muted-foreground">{eventSettings.event_logo_size}px</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEventSettings({...eventSettings, event_logo_size: Math.max(50, eventSettings.event_logo_size - 10)})}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Slider
                                value={[eventSettings.event_logo_size]}
                                onValueChange={(v) => setEventSettings({...eventSettings, event_logo_size: v[0]})}
                                min={50}
                                max={300}
                                step={10}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEventSettings({...eventSettings, event_logo_size: Math.min(300, eventSettings.event_logo_size + 10)})}
                              >
                                <PlusIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Ajuste o tamanho da logo no Totem e TV (50px a 300px)</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Aparecerá no Totem e na TV</p>
                  </div>

                  {/* Cores do Evento - 3 cores */}
                  <div className="space-y-4">
                      <Label>Paleta de Cores do Evento (até 3 cores)</Label>
                      <p className="text-xs text-muted-foreground">Defina as cores que representam a identidade visual do evento</p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Cor Principal */}
                        <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">Cor Principal</span>
                            <span className="text-xs text-muted-foreground">Obrigatória</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={eventSettings.primary_color}
                              onChange={e => setEventSettings({...eventSettings, primary_color: e.target.value})}
                              className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                            />
                            <Input
                              value={eventSettings.primary_color}
                              onChange={e => setEventSettings({...eventSettings, primary_color: e.target.value})}
                              className="bg-card border-border font-mono text-sm flex-1"
                              placeholder="#f37021"
                            />
                          </div>
                          <div className="h-3 rounded-full" style={{ backgroundColor: eventSettings.primary_color }} />
                        </div>

                        {/* Cor Secundária */}
                        <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">Cor Secundária</span>
                            <span className="text-xs text-muted-foreground">Opcional</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={eventSettings.secondary_color || '#888888'}
                              onChange={e => setEventSettings({...eventSettings, secondary_color: e.target.value})}
                              className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                            />
                            <Input
                              value={eventSettings.secondary_color}
                              onChange={e => setEventSettings({...eventSettings, secondary_color: e.target.value})}
                              className="bg-card border-border font-mono text-sm flex-1"
                              placeholder="#888888"
                            />
                          </div>
                          <div className="h-3 rounded-full" style={{ backgroundColor: eventSettings.secondary_color || '#444' }} />
                        </div>

                        {/* Cor Terciária */}
                        <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">Cor Terciária</span>
                            <span className="text-xs text-muted-foreground">Opcional</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={eventSettings.tertiary_color || '#cccccc'}
                              onChange={e => setEventSettings({...eventSettings, tertiary_color: e.target.value})}
                              className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                            />
                            <Input
                              value={eventSettings.tertiary_color}
                              onChange={e => setEventSettings({...eventSettings, tertiary_color: e.target.value})}
                              className="bg-card border-border font-mono text-sm flex-1"
                              placeholder="#cccccc"
                            />
                          </div>
                          <div className="h-3 rounded-full" style={{ backgroundColor: eventSettings.tertiary_color || '#666' }} />
                        </div>
                      </div>

                      {/* Preview combinado das 3 cores */}
                      <div className="mt-4 p-4 bg-black/20 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Preview da paleta:</p>
                        <div className="flex gap-2 h-10">
                          <div className="flex-[3] rounded-lg" style={{ backgroundColor: eventSettings.primary_color }} />
                          {eventSettings.secondary_color && (
                            <div className="flex-[2] rounded-lg" style={{ backgroundColor: eventSettings.secondary_color }} />
                          )}
                          {eventSettings.tertiary_color && (
                            <div className="flex-1 rounded-lg" style={{ backgroundColor: eventSettings.tertiary_color }} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

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

        {/* MODAL EDITAR STAFF */}
        <Dialog open={editStaffOpen} onOpenChange={setEditStaffOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Editar Membro da Equipe</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveEditStaff} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={editStaffFormData.name} onChange={(e) => setEditStaffFormData({ ...editStaffFormData, name: e.target.value })} required className="bg-secondary border-border" /></div>
              <div className="space-y-2"><Label>Função</Label><Input value={editStaffFormData.role} onChange={(e) => setEditStaffFormData({ ...editStaffFormData, role: e.target.value })} placeholder="Ex: Recepção, Audiovisual" className="bg-secondary border-border" /></div>
              <Button type="submit" className="w-full bg-primary" disabled={adding}>Salvar Alterações</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL PREVIEW DA ETIQUETA - ESTILO BARTENDER COM AJUSTES */}
        <Dialog open={!!previewGuest} onOpenChange={(open) => !open && setPreviewGuest(null)}>
          <DialogContent className="bg-[#1e1e1e] border-[#333] max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <Printer className="h-5 w-5" style={{ color: eventColor }} />
                Preview da Etiqueta
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* PREVIEW DA ETIQUETA - Escala: 1mm = 3.78px (96dpi) */}
              <div className="bg-[#0d0d0d] rounded-lg p-4">
                {/* Régua superior */}
                <div className="flex justify-between text-[9px] text-gray-600 mb-1 font-mono" style={{ width: '340px', margin: '0 auto' }}>
                  <span>|0</span>
                  <span>45|</span>
                  <span>90mm|</span>
                </div>

                {/* Container da etiqueta */}
                <div className="flex justify-center">
                  <div className="relative" style={{ width: '340px', height: '132px' }}>
                    {/* Sombra */}
                    <div className="absolute inset-0 bg-black/40 rounded" style={{ transform: 'translate(3px, 3px)' }} />

                    {/* ETIQUETA - 90mm x 35mm em escala */}
                    <div
                      className="relative bg-white rounded overflow-hidden border border-gray-300"
                      style={{ width: '340px', height: '132px' }}
                    >
                      {/* Conteúdo centralizado */}
                      <div
                        className="w-full h-full flex flex-col justify-center items-center text-center"
                        style={{ padding: '0 11px' }}
                      >
                        {/* NOME - Usa o valor ajustável */}
                        <div
                          style={{
                            width: '100%',
                            fontFamily: "'Inter', Arial, sans-serif",
                            fontWeight: 800,
                            fontSize: `${nameFontSize * 1.24}px`,
                            lineHeight: 1.1,
                            marginBottom: '6px',
                            color: '#000000',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {previewGuest ? formatNameForBadge(previewGuest.name) : ''}
                        </div>

                        {/* EMPRESA - Usa o valor ajustável */}
                        {previewGuest?.company && (
                          <div
                            style={{
                              width: '100%',
                              fontFamily: "'Inter', Arial, sans-serif",
                              fontWeight: 500,
                              fontSize: `${companyFontSize * 1.2}px`,
                              lineHeight: 1.2,
                              color: '#000000',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {previewGuest.company}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex justify-center gap-3 mt-2 text-[10px] text-gray-500">
                  <span>90mm × 35mm</span>
                  <span>•</span>
                  <span>Landscape</span>
                </div>
              </div>

              {/* CONTROLES DE AJUSTE DE FONTE */}
              <div className="bg-[#252525] rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Ajustar Fontes
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white h-7 px-2"
                    onClick={() => { setNameFontSize(17); setCompanyFontSize(10); }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>

                {/* Controle do Nome */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Nome</span>
                    <span className="text-xs font-mono" style={{ color: eventColor }}>{nameFontSize}pt</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]"
                      onClick={() => setNameFontSize(Math.max(10, nameFontSize - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Slider
                      value={[nameFontSize]}
                      onValueChange={(v) => setNameFontSize(v[0])}
                      min={10}
                      max={28}
                      step={1}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]"
                      onClick={() => setNameFontSize(Math.min(28, nameFontSize + 1))}
                    >
                      <PlusIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Controle da Empresa */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Empresa</span>
                    <span className="text-xs font-mono" style={{ color: eventColor }}>{companyFontSize}pt</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]"
                      onClick={() => setCompanyFontSize(Math.max(6, companyFontSize - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Slider
                      value={[companyFontSize]}
                      onValueChange={(v) => setCompanyFontSize(v[0])}
                      min={6}
                      max={18}
                      step={1}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]"
                      onClick={() => setCompanyFontSize(Math.min(18, companyFontSize + 1))}
                    >
                      <PlusIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-[#444] text-gray-300 hover:bg-[#333] hover:text-white"
                  onClick={() => setPreviewGuest(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 text-white font-semibold"
                  style={{ backgroundColor: eventColor }}
                  onClick={handleConfirmPrint}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* MODAL PREVIEW DA ETIQUETA STAFF - ESTILO BARTENDER */}
        <Dialog open={!!previewStaff} onOpenChange={(open) => !open && setPreviewStaff(null)}>
          <DialogContent className="bg-[#1e1e1e] border-[#333] max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <HardHat className="h-5 w-5" style={{ color: eventColor }} />
                Preview da Etiqueta - Equipe
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-[#0d0d0d] rounded-lg p-4">
                <div className="flex justify-between text-[9px] text-gray-600 mb-1 font-mono" style={{ width: '340px', margin: '0 auto' }}>
                  <span>|0</span>
                  <span>45|</span>
                  <span>90mm|</span>
                </div>
                <div className="flex justify-center">
                  <div className="relative" style={{ width: '340px', height: '132px' }}>
                    <div className="absolute inset-0 bg-black/40 rounded" style={{ transform: 'translate(3px, 3px)' }} />
                    <div className="relative bg-white rounded overflow-hidden border border-gray-300" style={{ width: '340px', height: '132px' }}>
                      <div className="w-full h-full flex flex-col justify-center items-center text-center" style={{ padding: '0 11px' }}>
                        <div
                          style={{
                            width: '100%',
                            fontFamily: "'Inter', Arial, sans-serif",
                            fontWeight: 800,
                            fontSize: `${nameFontSize * 1.24}px`,
                            lineHeight: 1.1,
                            marginBottom: '6px',
                            color: '#000000',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {previewStaff ? formatNameForBadge(previewStaff.name) : ''}
                        </div>
                        <div
                          style={{
                            width: '100%',
                            fontFamily: "'Inter', Arial, sans-serif",
                            fontWeight: 500,
                            fontSize: `${companyFontSize * 1.2}px`,
                            lineHeight: 1.2,
                            color: '#000000',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {previewStaff?.role || 'Equipe'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-3 mt-2 text-[10px] text-gray-500">
                  <span style={{ color: eventColor }}>Equipe</span>
                  <span>•</span>
                  <span>90mm × 35mm</span>
                </div>
              </div>

              {/* CONTROLES DE AJUSTE DE FONTE */}
              <div className="bg-[#252525] rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 flex items-center gap-2"><Type className="h-4 w-4" />Ajustar Fontes</span>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-7 px-2" onClick={() => { setNameFontSize(17); setCompanyFontSize(10); }}>
                    <RotateCcw className="h-3 w-3 mr-1" />Reset
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Nome</span><span className="text-xs font-mono" style={{ color: eventColor }}>{nameFontSize}pt</span></div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]" onClick={() => setNameFontSize(Math.max(10, nameFontSize - 1))}><Minus className="h-3 w-3" /></Button>
                    <Slider value={[nameFontSize]} onValueChange={(v) => setNameFontSize(v[0])} min={10} max={28} step={1} className="flex-1" />
                    <Button variant="outline" size="icon" className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]" onClick={() => setNameFontSize(Math.min(28, nameFontSize + 1))}><PlusIcon className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Função</span><span className="text-xs font-mono" style={{ color: eventColor }}>{companyFontSize}pt</span></div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]" onClick={() => setCompanyFontSize(Math.max(6, companyFontSize - 1))}><Minus className="h-3 w-3" /></Button>
                    <Slider value={[companyFontSize]} onValueChange={(v) => setCompanyFontSize(v[0])} min={6} max={18} step={1} className="flex-1" />
                    <Button variant="outline" size="icon" className="h-7 w-7 border-[#444] text-gray-400 hover:text-white hover:bg-[#333]" onClick={() => setCompanyFontSize(Math.min(18, companyFontSize + 1))}><PlusIcon className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-[#444] text-gray-300 hover:bg-[#333] hover:text-white" onClick={() => setPreviewStaff(null)}>Cancelar</Button>
                <Button className="flex-1 text-white font-semibold" style={{ backgroundColor: eventColor }} onClick={handleConfirmStaffPrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

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
  Printer, Users, UserCheck, Loader2, ExternalLink, Trash2,
  Monitor, Wifi, History, Clock, Image as ImageIcon, LayoutTemplate
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
  layout_mode: 'standard' | 'full_screen' | null;
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

// --- COMPONENTE VISUAL: CAIXA DE UPLOAD (CORRIGIDO PARA UPLOAD REAL) ---
function UploadBox({ label, icon, previewUrl, onUpload }: { label: string, icon?: 'qr-code' | 'image', previewUrl?: string | null, onUpload: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false); // Estado de carregamento
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true); // Ativa o spinner
    try {
      // 1. Gera um nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // 2. Envia para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 3. Pega a URL pública do arquivo
      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName);

      // 4. Passa a URL real para o formulário
      onUpload(data.publicUrl);
      toast({ title: "Sucesso", description: "Imagem carregada na nuvem!" });

    } catch (error: any) {
      console.error('Erro upload:', error);
      // Fallback: Se der erro (ex: bucket não criado), usa preview local
      const url = URL.createObjectURL(file);
      onUpload(url);
      toast({ title: "Aviso", description: "Usando modo offline (Verifique o Storage).", variant: "destructive" });
    } finally {
      setUploading(false); // Desativa o spinner
    }
  };

  return (
    <div 
      className="border-2 border-dashed border-border bg-card/50 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group relative overflow-hidden"
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input type="file" hidden ref={inputRef} onChange={handleFileChange} accept="image/*" disabled={uploading} />
      
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Enviando...</span>
        </div>
      ) : previewUrl ? (
        <div className="absolute inset-0 w-full h-full">
          <img src={previewUrl} className="w-full h-full object-contain p-4" alt="Preview" />
          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
            <span className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform">
              Trocar Imagem
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
          <div className="p-4 bg-secondary rounded-full group-hover:bg-primary/20 transition-colors">
            {icon === 'image' ? <ImageIcon size={28} /> : <Upload size={28} />}
          </div>
          <div className="text-center">
            <span className="block text-sm font-bold uppercase tracking-widest">{label}</span>
            <span className="text-xs opacity-60">Clique para selecionar</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function EventManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isEquipe } = useAuth();
  const { toast } = useToast();
  
  // Estados de Dados
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de Modal e Ações
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', company: '', role: '' });
  const [adding, setAdding] = useState(false);
  const [printingGuest, setPrintingGuest] = useState<Guest | null>(null);

  // Estados de Configuração
  const [eventSettings, setEventSettings] = useState({
    name: '',
    date: '',
    wifi_ssid: '',
    wifi_pass: '',
    photo_url: '',
    wifi_img_url: '',
    photo_img_url: '',
    layout_mode: 'standard',
  });
  const [photoMode, setPhotoMode] = useState<'auto' | 'upload'>('auto');

  // Permissões
  const canImportExport = isAdmin || isEquipe;
  const canDeleteGuests = isAdmin;
  const canAccessSettings = isAdmin || isEquipe;
  const canAccessHistory = isAdmin || isEquipe;

  const logActivity = async (action: string, details: string) => {
    if (!user || !id) return;
    await supabase.from('activity_logs').insert({
      event_id: id,
      user_id: user.id,
      user_email: user.email,
      action,
      details,
    });
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchEvent();
      fetchGuests();
      subscribeToGuests();
    }
  }, [id, user]);

  // --- CARREGAMENTO DE DADOS ---
  const fetchEvent = async () => {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error || !data) {
      toast({ title: 'Erro', description: 'Evento não encontrado.', variant: 'destructive' });
      navigate('/dashboard');
    } else {
      setEvent(data);
      setEventSettings({
        name: data.name,
        date: new Date(data.date).toISOString().slice(0, 16),
        wifi_ssid: data.wifi_ssid || '',
        wifi_pass: data.wifi_pass || '',
        photo_url: data.photo_url || '',
        wifi_img_url: data.wifi_img_url || '',
        photo_img_url: data.photo_img_url || '',
        layout_mode: (data.layout_mode as any) || 'standard',
      });
      if (data.photo_img_url) setPhotoMode('upload');
    }
    setLoading(false);
  };

  const fetchGuests = async () => {
    const { data, error } = await supabase.from('guests').select('*').eq('event_id', id).order('name');
    if (!error) setGuests(data || []);
  };

  const fetchActivityLogs = async () => {
    if (!canAccessHistory) return;
    setLogsLoading(true);
    const { data, error } = await supabase.from('activity_logs').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(100);
    if (!error) setActivityLogs(data || []);
    setLogsLoading(false);
  };

  const subscribeToGuests = () => {
    const channel = supabase.channel('guests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${id}` }, () => fetchGuests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  // --- AÇÕES DE CONVIDADOS ---
  const handleToggleCheckIn = async (guest: Guest) => {
    const newCheckedIn = !guest.checked_in;
    const { error } = await supabase.from('guests').update({
      checked_in: newCheckedIn,
      checkin_time: newCheckedIn ? new Date().toISOString() : null,
    }).eq('id', guest.id);

    if (error) toast({ title: 'Erro', description: 'Falha ao atualizar check-in.', variant: 'destructive' });
    else await logActivity(newCheckedIn ? 'Check-in' : 'Check-out', `${guest.name}${guest.company ? ` (${guest.company})` : ''}`);
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const { error } = await supabase.from('guests').insert({
      event_id: id,
      name: newGuest.name,
      company: newGuest.company || null,
      role: newGuest.role || null,
    });
    if (error) toast({ title: 'Erro', description: 'Falha ao adicionar.', variant: 'destructive' });
    else {
      toast({ title: 'Sucesso', description: 'Convidado adicionado!' });
      await logActivity('Adicionou convidado', `${newGuest.name}`);
      await fetchGuests(); // Atualiza lista na hora
      setAddGuestOpen(false);
      setNewGuest({ name: '', company: '', role: '' });
    }
    setAdding(false);
  };

  const handleDeleteGuest = async (guest: Guest) => {
    if (!canDeleteGuests) return;
    const { error } = await supabase.from('guests').delete().eq('id', guest.id);
    if (error) toast({ title: 'Erro', description: 'Falha ao excluir.', variant: 'destructive' });
    else {
      await logActivity('Excluiu convidado', `${guest.name}`);
      await fetchGuests(); // Atualiza lista na hora
    }
  };

  const handlePrint = (guest: Guest) => {
    setPrintingGuest(guest);
    setTimeout(() => { window.print(); setPrintingGuest(null); }, 100);
  };

 // --- SUPER IMPORTADOR DE EXCEL (Aceita qualquer nome de coluna) ---
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canImportExport) return;
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

      // LÓGICA INTELIGENTE: Procura qualquer coluna que pareça ser Nome/Empresa
      const guestsToInsert = jsonData.map((row: any) => {
        const keys = Object.keys(row);
        
        // 1. Acha a coluna do NOME (procurando por variações comuns)
        const nameKey = keys.find(k => 
          k.toLowerCase().includes('nome') || 
          k.toLowerCase().includes('name') || 
          k.toLowerCase().includes('participante') ||
          k.toLowerCase().includes('convidado') ||
          k.toLowerCase().includes('fullname')
        );
        
        // 2. Acha a coluna da EMPRESA
        const companyKey = keys.find(k => 
          k.toLowerCase().includes('empresa') || 
          k.toLowerCase().includes('company') || 
          k.toLowerCase().includes('organizacao') ||
          k.toLowerCase().includes('instituicao')
        );
        
        // 3. Acha a coluna do CARGO
        const roleKey = keys.find(k => 
          k.toLowerCase().includes('cargo') || 
          k.toLowerCase().includes('role') || 
          k.toLowerCase().includes('funcao') ||
          k.toLowerCase().includes('ocupacao')
        );

        // Se não tiver nome, ignora a linha
        if (!nameKey) return null;

        return {
          event_id: id,
          name: row[nameKey], 
          company: companyKey ? row[companyKey] : null,
          role: roleKey ? row[roleKey] : null,
        };
      }).filter((g: any) => g !== null && g.name); // Remove vazios

      if (guestsToInsert.length === 0) {
        toast({ title: 'Erro na Leitura', description: 'Não consegui identificar a coluna de nomes. Verifique se o cabeçalho da planilha tem "Nome", "Participante" ou similar.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('guests').insert(guestsToInsert);
      
      if (error) {
        console.error(error);
        toast({ title: 'Erro', description: 'Falha ao salvar no banco de dados.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso Total', description: `${guestsToInsert.length} convidados importados!` });
        await logActivity('Importou convidados', `${guestsToInsert.length} via Excel`);
        await fetchGuests(); // Atualiza a lista na hora
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // --- SALVAR CONFIGURAÇÕES ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAccessSettings) return;
    setSaving(true);
    const { error } = await supabase.from('events').update({
      name: eventSettings.name,
      date: new Date(eventSettings.date).toISOString(),
      wifi_ssid: eventSettings.wifi_ssid || null,
      wifi_pass: eventSettings.wifi_pass || null,
      photo_url: eventSettings.photo_url || null,
      wifi_img_url: eventSettings.wifi_img_url || null,
      photo_img_url: eventSettings.photo_img_url || null,
      layout_mode: eventSettings.layout_mode,
    }).eq('id', id);

    if (error) toast({ title: 'Erro', description: 'Falha ao salvar.', variant: 'destructive' });
    else {
      toast({ title: 'Sucesso', description: 'Configurações salvas!' });
      await logActivity('Atualizou configurações', 'Alterações salvas');
      fetchEvent();
    }
    setSaving(false);
  };

  // --- AUXILIARES ---
  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatLogTime = (ts: string) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (authLoading || loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      
      {/* CORREÇÃO 2: CSS DE IMPRESSÃO COM FONTE FIXA */}
     <style>{`
        @media print {
          /* Configuração exata da página para não soltar papel em branco */
          @page { 
            size: 90mm 35mm; 
            margin: 0; 
          }
          
          body * { visibility: hidden; }
          
          /* Garante que só a etiqueta apareça */
          .print-label, .print-label * { visibility: visible !important; }
          
          .print-label {
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 90mm; 
            height: 35mm;
            
            /* Centralização perfeita */
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center;
            text-align: center;
            
            background: white; 
            color: black;
            
            /* Margem de segurança interna */
            padding: 2mm; 
            box-sizing: border-box;
            overflow: hidden; /* Corta qualquer excesso que tentaria criar nova página */
          }
          
          .label-page-break { page-break-after: always; }
          
          /* ESTILO LINDO E FUNCIONAL */
          .guest-name {
            font-family: 'Inter', sans-serif; /* Fonte moderna */
            font-weight: 800; /* Negrito forte */
            font-size: 14pt !important; /* Tamanho ideal: nem gigante, nem pequeno */
            line-height: 1.1; 
            
            /* Permite quebra de linha inteligente */
            width: 100%; 
            white-space: normal; 
            word-wrap: break-word;
            
            margin-bottom: 1.5mm;
            text-transform: uppercase; /* Caixa alta elegante */
          }
          
          .guest-company {
            font-family: 'Inter', sans-serif; 
            font-weight: 500;
            font-size: 10pt !important; 
            width: 100%; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis;
            color: #333;
          }
        }
      `}</style>

      {printingGuest && (
        <>
          <div className="print-label label-page-break">
            <div className="guest-name">{printingGuest.name}</div>
            {printingGuest.company && <div className="guest-company">{printingGuest.company}</div>}
          </div>
          <div className="print-label">
            <div className="guest-name">{printingGuest.name}</div>
            {printingGuest.company && <div className="guest-company">{printingGuest.company}</div>}
          </div>
        </>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-lg font-semibold text-foreground truncate">{event?.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-border" onClick={() => window.open(`/totem/${id}`, '_blank')}>
              <Monitor className="h-4 w-4 mr-2" />Totem
            </Button>
            <Button variant="outline" size="sm" className="border-border" onClick={() => window.open(`/wifi/${id}`, '_blank')}>
              <Wifi className="h-4 w-4 mr-2" />Display TV
            </Button>
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

          {/* === ABA 1: CONVIDADOS === */}
          <TabsContent value="guests" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2"><Users className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Total</span></div>
                <p className="text-5xl font-bold text-primary">{guests.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2"><UserCheck className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">Presentes</span></div>
                <p className="text-5xl font-bold text-primary">{guests.filter(g=>g.checked_in).length}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar convidado..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-card border-border" />
              </div>
              {canImportExport && (
                <>
                  <label className="cursor-pointer">
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
                    <Button variant="outline" className="border-border" asChild><span><Upload className="h-4 w-4 mr-2" />Importar</span></Button>
                  </label>
                  <Button variant="outline" className="border-border" onClick={handleExportExcel}><Download className="h-4 w-4 mr-2" />Exportar</Button>
                </>
              )}
              <Dialog open={addGuestOpen} onOpenChange={setAddGuestOpen}>
                <DialogTrigger asChild><Button variant="outline" className="border-border"><Plus className="h-4 w-4 mr-2" />Manual</Button></DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="text-foreground">Adicionar Convidado</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddGuest} className="space-y-4 mt-4">
                    <div className="space-y-2"><Label>Nome *</Label><Input value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} required className="bg-secondary border-border" /></div>
                    <div className="space-y-2"><Label>Empresa</Label><Input value={newGuest.company} onChange={(e) => setNewGuest({ ...newGuest, company: e.target.value })} className="bg-secondary border-border" /></div>
                    <div className="space-y-2"><Label>Cargo</Label><Input value={newGuest.role} onChange={(e) => setNewGuest({ ...newGuest, role: e.target.value })} className="bg-secondary border-border" /></div>
                    <Button type="submit" className="w-full bg-primary" disabled={adding}>Adicionar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {filteredGuests.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nenhum convidado encontrado.</div> : filteredGuests.map((guest, index) => (
                <div key={guest.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground truncate">{guest.name}</h3>
                      {guest.checked_in && <Badge className="bg-primary text-primary-foreground">Presente</Badge>}
                    </div>
                    {(guest.role || guest.company) && <p className="text-sm text-muted-foreground mt-1 truncate">{[guest.role, guest.company].filter(Boolean).join(' • ')}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handlePrint(guest)}><Printer className="h-4 w-4" /></Button>
                    {canDeleteGuests && <Button variant="ghost" size="icon" onClick={() => handleDeleteGuest(guest)} className="hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>}
                    <Switch checked={guest.checked_in} onCheckedChange={() => handleToggleCheckIn(guest)} />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* === ABA 2: HISTÓRICO === */}
          {canAccessHistory && (
            <TabsContent value="history" className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-4"><History className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Histórico de Atividades</h3></div>
              {logsLoading ? <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : (
                <div className="space-y-2">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground shrink-0"><Clock className="h-4 w-4"/><span className="text-sm font-mono">{formatLogTime(log.created_at)}</span></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="border-primary text-primary">{log.action}</Badge>
                          <span className="text-sm text-muted-foreground">{log.user_email}</span>
                        </div>
                        {log.details && <p className="text-sm text-foreground mt-1">{log.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* === ABA 3: CONFIGURAÇÕES === */}
          {canAccessSettings && (
            <TabsContent value="settings" className="space-y-6 animate-fade-in">
              <form onSubmit={handleSaveSettings} className="space-y-8">
                
                <div className="bg-secondary/50 border border-border rounded-xl p-6">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-primary" /> Modo de Exibição Pública</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${eventSettings.layout_mode === 'standard' ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`} onClick={() => setEventSettings({...eventSettings, layout_mode: 'standard'})}>
                      <div className="font-bold text-foreground mb-1">Layout Padrão</div>
                      <p className="text-xs text-muted-foreground">Sistema desenha a tela com SSID/Senha.</p>
                    </div>
                    <div className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${eventSettings.layout_mode === 'full_screen' ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'}`} onClick={() => setEventSettings({...eventSettings, layout_mode: 'full_screen'})}>
                      <div className="font-bold text-foreground mb-1">Arte Digital</div>
                      <p className="text-xs text-muted-foreground">Exibe apenas a imagem (100% da tela).</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Nome</Label><Input value={eventSettings.name} onChange={e=>setEventSettings({...eventSettings, name: e.target.value})} className="bg-card border-border" /></div>
                  <div className="space-y-2"><Label>Data</Label><Input type="datetime-local" value={eventSettings.date} onChange={e=>setEventSettings({...eventSettings, date: e.target.value})} className="bg-card border-border" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 border-b border-border pb-4 mb-6"><div className="p-2.5 bg-primary/10 rounded-lg text-primary"><Wifi size={24} /></div><h3 className="text-lg font-bold">Display TV</h3></div>
                    {eventSettings.layout_mode === 'standard' ? (
                      <div className="space-y-4">
                        <div className="space-y-1"><Label>SSID</Label><Input value={eventSettings.wifi_ssid} onChange={e=>setEventSettings({...eventSettings, wifi_ssid: e.target.value})} className="bg-secondary border-border"/></div>
                        <div className="space-y-1"><Label>Senha</Label><Input value={eventSettings.wifi_pass} onChange={e=>setEventSettings({...eventSettings, wifi_pass: e.target.value})} className="bg-secondary border-border"/></div>
                        <div className="mt-4 pt-4 border-t border-border">
                          <Label className="block mb-3">QR Code do Wi-Fi</Label>
                          <UploadBox label="Arraste o QR Code" icon="qr-code" previewUrl={eventSettings.wifi_img_url} onUpload={(url) => setEventSettings({...eventSettings, wifi_img_url: url})} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4"><Label>Upload da Arte Horizontal</Label><UploadBox label="Arte Horizontal" icon="image" previewUrl={eventSettings.wifi_img_url} onUpload={(url) => setEventSettings({...eventSettings, wifi_img_url: url})} /></div>
                    )}
                  </div>

                  <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 border-b border-border pb-4 mb-6"><div className="p-2.5 bg-primary/10 rounded-lg text-primary"><ExternalLink size={24} /></div><h3 className="text-lg font-bold">Moments / Totem</h3></div>
                    {eventSettings.layout_mode === 'standard' ? (
                      <div className="space-y-4">
                        <div className="space-y-1"><Label>Link Galeria Moments</Label><Input value={eventSettings.photo_url} onChange={e=>setEventSettings({...eventSettings, photo_url: e.target.value})} className="bg-secondary border-border" placeholder="https://..." /></div>
                        <div className="mt-4 pt-4 border-t border-border">
                          <Label className="block mb-3">QR Code</Label>
                          <div className="flex gap-2 mb-4 p-1 bg-secondary rounded-lg border border-border">
                            <button type="button" onClick={()=>setPhotoMode('auto')} className={`flex-1 py-2 text-xs font-bold rounded ${photoMode==='auto'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>AUTO</button>
                            <button type="button" onClick={()=>setPhotoMode('upload')} className={`flex-1 py-2 text-xs font-bold rounded ${photoMode==='upload'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>UPLOAD</button>
                          </div>
                          <div className="h-64 flex items-center justify-center bg-background border-2 border-dashed border-border rounded-xl overflow-hidden">
                            {photoMode === 'auto' ? (
                              <div className="text-center p-4">
                                {eventSettings.photo_url ? <div className="bg-white p-4 rounded-xl"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(eventSettings.photo_url)}`} alt="QR" className="w-[150px] h-[150px]" /></div> : <span className="text-muted-foreground text-sm">Cole o link</span>}
                              </div>
                            ) : (
                              <div className="w-full h-full p-2"><UploadBox label="Capa" icon="image" previewUrl={eventSettings.photo_img_url} onUpload={(url) => setEventSettings({...eventSettings, photo_img_url: url})} /></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4"><Label>Upload da Arte Vertical</Label><UploadBox label="Arte Vertical" icon="image" previewUrl={eventSettings.photo_img_url} onUpload={(url) => setEventSettings({...eventSettings, photo_img_url: url})} /></div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border flex justify-end">
                  <Button type="submit" className="bg-primary hover:bg-primary/90 px-8 py-6 h-auto text-lg" disabled={saving}>
                    {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Settings className="h-5 w-5 mr-2" />} Salvar Alterações
                  </Button>
                </div>
              </form>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

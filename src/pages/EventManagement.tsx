import { useState, useEffect } from 'react';
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
  Monitor, Wifi, History, Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

export default function EventManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isEquipe } = useAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', company: '', role: '' });
  const [adding, setAdding] = useState(false);
  const [printingGuest, setPrintingGuest] = useState<Guest | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Settings state
  const [eventSettings, setEventSettings] = useState({
    name: '',
    date: '',
    wifi_ssid: '',
    wifi_pass: '',
    photo_url: '',
  });
  const [saving, setSaving] = useState(false);

  // Role-based permissions
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
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchEvent();
      fetchGuests();
      subscribeToGuests();
    }
  }, [id, user]);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

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
      });
    }
    setLoading(false);
  };

  const fetchGuests = async () => {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('event_id', id)
      .order('name');

    if (!error) {
      setGuests(data || []);
    }
  };

  const fetchActivityLogs = async () => {
    if (!canAccessHistory) return;
    
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error) {
      setActivityLogs(data || []);
    }
    setLogsLoading(false);
  };

  const subscribeToGuests = () => {
    const channel = supabase
      .channel('guests-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${id}` },
        () => {
          fetchGuests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleToggleCheckIn = async (guest: Guest) => {
    const newCheckedIn = !guest.checked_in;
    const { error } = await supabase
      .from('guests')
      .update({
        checked_in: newCheckedIn,
        checkin_time: newCheckedIn ? new Date().toISOString() : null,
      })
      .eq('id', guest.id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar check-in.', variant: 'destructive' });
    } else {
      await logActivity(
        newCheckedIn ? 'Check-in' : 'Check-out',
        `${guest.name}${guest.company ? ` (${guest.company})` : ''}`
      );
    }
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

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao adicionar convidado.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Convidado adicionado!' });
      await logActivity('Adicionou convidado', `${newGuest.name}${newGuest.company ? ` - ${newGuest.company}` : ''}`);
      setAddGuestOpen(false);
      setNewGuest({ name: '', company: '', role: '' });
    }
    setAdding(false);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canImportExport) return;
    
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<{ nome?: string; name?: string; empresa?: string; company?: string; cargo?: string; role?: string }>(sheet);

      const guestsToInsert = jsonData.map((row) => ({
        event_id: id,
        name: row.nome || row.name || '',
        company: row.empresa || row.company || null,
        role: row.cargo || row.role || null,
      })).filter(g => g.name);

      if (guestsToInsert.length === 0) {
        toast({ title: 'Erro', description: 'Nenhum convidado válido encontrado.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('guests').insert(guestsToInsert);

      if (error) {
        toast({ title: 'Erro', description: 'Falha ao importar convidados.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `${guestsToInsert.length} convidados importados!` });
        await logActivity('Importou convidados', `${guestsToInsert.length} convidados via Excel`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExportExcel = async () => {
    if (!canImportExport) return;
    
    const exportData = guests.map(g => ({
      Nome: g.name,
      Empresa: g.company || '',
      Cargo: g.role || '',
      'Check-in': g.checked_in ? 'Sim' : 'Não',
      'Hora Check-in': g.checkin_time ? new Date(g.checkin_time).toLocaleString('pt-BR') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Convidados');
    XLSX.writeFile(wb, `${event?.name || 'evento'}_convidados.xlsx`);
    
    await logActivity('Exportou convidados', `${guests.length} convidados para Excel`);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAccessSettings) return;
    
    setSaving(true);

    const { error } = await supabase
      .from('events')
      .update({
        name: eventSettings.name,
        date: new Date(eventSettings.date).toISOString(),
        wifi_ssid: eventSettings.wifi_ssid || null,
        wifi_pass: eventSettings.wifi_pass || null,
        photo_url: eventSettings.photo_url || null,
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar configurações.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Configurações salvas!' });
      await logActivity('Atualizou configurações', 'Configurações do evento alteradas');
      fetchEvent();
    }
    setSaving(false);
  };

  const handleDeleteGuest = async (guest: Guest) => {
    if (!canDeleteGuests) return;
    
    const { error } = await supabase.from('guests').delete().eq('id', guest.id);
    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir convidado.', variant: 'destructive' });
    } else {
      await logActivity('Excluiu convidado', `${guest.name}${guest.company ? ` (${guest.company})` : ''}`);
    }
  };

  const handlePrint = (guest: Guest) => {
    setPrintingGuest(guest);
    setTimeout(() => {
      window.print();
      setPrintingGuest(null);
    }, 100);
  };

  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalGuests = guests.length;
  const checkedInGuests = guests.filter(g => g.checked_in).length;

  const formatLogTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Print Labels */}
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

      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate">{event?.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => window.open(`/totem/${id}`, '_blank')}
            >
              <Monitor className="h-4 w-4 mr-2" />
              Abrir Totem
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => window.open(`/wifi/${id}`, '_blank')}
            >
              <Wifi className="h-4 w-4 mr-2" />
              Display TV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 print:hidden">
        <Tabs defaultValue="guests" className="space-y-6" onValueChange={(value) => {
          if (value === 'history') fetchActivityLogs();
        }}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="guests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Convidados
            </TabsTrigger>
            {canAccessHistory && (
              <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Histórico
              </TabsTrigger>
            )}
            {canAccessSettings && (
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Configurações
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="guests" className="space-y-6 animate-fade-in">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm font-medium">Total</span>
                </div>
                <p className="text-5xl font-bold text-primary">{totalGuests}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <UserCheck className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm font-medium">Presentes</span>
                </div>
                <p className="text-5xl font-bold text-primary">{checkedInGuests}</p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar convidado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
              
              {canImportExport && (
                <label className="cursor-pointer">
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
                  <Button variant="outline" className="border-border" asChild>
                    <span><Upload className="h-4 w-4 mr-2" />Importar</span>
                  </Button>
                </label>
              )}

              <Dialog open={addGuestOpen} onOpenChange={setAddGuestOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-border">
                    <Plus className="h-4 w-4 mr-2" />Manual
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Adicionar Convidado</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddGuest} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">Nome *</Label>
                      <Input
                        value={newGuest.name}
                        onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                        className="bg-secondary border-border"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Empresa</Label>
                      <Input
                        value={newGuest.company}
                        onChange={(e) => setNewGuest({ ...newGuest, company: e.target.value })}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Cargo</Label>
                      <Input
                        value={newGuest.role}
                        onChange={(e) => setNewGuest({ ...newGuest, role: e.target.value })}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={adding}>
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {canImportExport && (
                <Button variant="outline" className="border-border" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />Exportar
                </Button>
              )}
            </div>

            {/* Guest List */}
            <div className="space-y-3">
              {filteredGuests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm ? 'Nenhum convidado encontrado.' : 'Nenhum convidado cadastrado.'}
                </div>
              ) : (
                filteredGuests.map((guest, index) => (
                  <div
                    key={guest.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground truncate">{guest.name}</h3>
                        {guest.checked_in && (
                          <Badge className="bg-primary text-primary-foreground shrink-0">Presente</Badge>
                        )}
                      </div>
                      {(guest.role || guest.company) && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {[guest.role, guest.company].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePrint(guest)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {canDeleteGuests && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGuest(guest)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Switch
                        checked={guest.checked_in}
                        onCheckedChange={() => handleToggleCheckIn(guest)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {canAccessHistory && (
            <TabsContent value="history" className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Histórico de Atividades</h3>
              </div>

              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma atividade registrada.
                </div>
              ) : (
                <div className="space-y-2">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-card border border-border rounded-lg p-4 flex items-start gap-4"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-mono">{formatLogTime(log.created_at)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="border-primary text-primary">
                            {log.action}
                          </Badge>
                          <span className="text-sm text-muted-foreground truncate">
                            {log.user_email}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-foreground mt-1">{log.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {canAccessSettings && (
            <TabsContent value="settings" className="space-y-6 animate-fade-in">
              <form onSubmit={handleSaveSettings} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <Label className="text-foreground">Nome do Evento</Label>
                  <Input
                    value={eventSettings.name}
                    onChange={(e) => setEventSettings({ ...eventSettings, name: e.target.value })}
                    className="bg-card border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Data e Hora</Label>
                  <Input
                    type="datetime-local"
                    value={eventSettings.date}
                    onChange={(e) => setEventSettings({ ...eventSettings, date: e.target.value })}
                    className="bg-card border-border"
                    required
                  />
                </div>
                
                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-4">Wi-Fi do Evento</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">Nome da Rede (SSID)</Label>
                      <Input
                        value={eventSettings.wifi_ssid}
                        onChange={(e) => setEventSettings({ ...eventSettings, wifi_ssid: e.target.value })}
                        className="bg-card border-border"
                        placeholder="Ex: EventoWiFi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Senha</Label>
                      <Input
                        value={eventSettings.wifi_pass}
                        onChange={(e) => setEventSettings({ ...eventSettings, wifi_pass: e.target.value })}
                        className="bg-card border-border"
                        placeholder="Ex: senha123"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-4">Galeria de Fotos</h3>
                  <div className="space-y-2">
                    <Label className="text-foreground">Link da Galeria</Label>
                    <Input
                      value={eventSettings.photo_url}
                      onChange={(e) => setEventSettings({ ...eventSettings, photo_url: e.target.value })}
                      className="bg-card border-border"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                  Salvar Configurações
                </Button>
              </form>

              <div className="pt-6 border-t border-border">
                <h3 className="font-semibold text-foreground mb-4">Telas Públicas</h3>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => window.open(`/totem/${id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Totem
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => window.open(`/wifi/${id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Display Wi-Fi
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => window.open(`/guest/${id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Check-in Mobile
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

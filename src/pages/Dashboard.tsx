import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, LogOut, Loader2, Users, KeyRound, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
// ESTAS LINHAS VOLTARAM (IMPORTANTE)
import UserManagement from '@/components/admin/UserManagement';
import AccessCodeManagement from '@/components/admin/AccessCodeManagement';

interface Event {
  id: string;
  name: string;
  date: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading, role, isAdmin, isRecepcao } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const fetchEvents = async () => {
    // CORREÇÃO: Removemos o filtro .eq('user_id', user.id) para mostrar TODOS os eventos
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao carregar eventos.', variant: 'destructive' });
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    const { error } = await supabase.from('events').insert({
      name: newEventName,
      date: new Date(newEventDate).toISOString(),
      user_id: user.id,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao criar evento.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Evento criado!' });
      setCreateDialogOpen(false);
      setNewEventName('');
      setNewEventDate('');
      fetchEvents();
    }
    setCreating(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const getRoleBadge = () => {
    if (!role) return null;
    const colors: any = {
      admin: 'bg-primary/20 text-primary border-primary/30',
      team: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      receptionist: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    const labels: any = {
      admin: 'Admin',
      team: 'Equipe',
      receptionist: 'Recepção',
    };
    return (
      <Badge className={`${colors[role] || 'bg-gray-500'} border`}>
        {labels[role] || role}
      </Badge>
    );
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
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary" />
            <span className="font-semibold text-lg text-foreground">Floripa Square</span>
            {getRoleBadge()}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isAdmin ? (
          <Tabs defaultValue="events" className="space-y-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="events" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                Eventos
              </TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="h-4 w-4 mr-2" />
                Gerenciar Equipe
              </TabsTrigger>
              <TabsTrigger value="access" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <KeyRound className="h-4 w-4 mr-2" />
                Chaves de Acesso
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              <EventsSection 
                events={events}
                createDialogOpen={createDialogOpen}
                setCreateDialogOpen={setCreateDialogOpen}
                newEventName={newEventName}
                setNewEventName={setNewEventName}
                newEventDate={newEventDate}
                setNewEventDate={setNewEventDate}
                handleCreateEvent={handleCreateEvent}
                creating={creating}
                navigate={navigate}
                canCreate={!isRecepcao}
              />
            </TabsContent>

            {/* AQUI ESTÃO OS COMPONENTES QUE EU TINHA REMOVIDO */}
            <TabsContent value="users">
              <div className="bg-card border border-border rounded-xl p-6">
                <UserManagement />
              </div>
            </TabsContent>

            <TabsContent value="access">
              <div className="bg-card border border-border rounded-xl p-6">
                <AccessCodeManagement />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <EventsSection 
            events={events}
            createDialogOpen={createDialogOpen}
            setCreateDialogOpen={setCreateDialogOpen}
            newEventName={newEventName}
            setNewEventName={setNewEventName}
            newEventDate={newEventDate}
            setNewEventDate={setNewEventDate}
            handleCreateEvent={handleCreateEvent}
            creating={creating}
            navigate={navigate}
            canCreate={!isRecepcao}
          />
        )}
      </main>
    </div>
  );
}

// --- SUB-COMPONENTE DA LISTA DE EVENTOS ---
interface EventsSectionProps {
  events: Event[];
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  newEventName: string;
  setNewEventName: (name: string) => void;
  newEventDate: string;
  setNewEventDate: (date: string) => void;
  handleCreateEvent: (e: React.FormEvent) => void;
  creating: boolean;
  navigate: (path: string) => void;
  canCreate: boolean;
}

function EventsSection({
  events, createDialogOpen, setCreateDialogOpen,
  newEventName, setNewEventName, newEventDate, setNewEventDate,
  handleCreateEvent, creating, navigate, canCreate
}: EventsSectionProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground">Eventos</h1>
        {canCreate && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-orange-900/20">
                <Plus className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Criar Novo Evento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEvent} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="eventName" className="text-foreground">Nome do Evento</Label>
                  <Input id="eventName" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="Ex: Conferência 2025" className="bg-secondary border-border" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventDate" className="text-foreground">Data e Hora</Label>
                  <Input id="eventDate" type="datetime-local" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="bg-secondary border-border" required />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Evento'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 animate-fade-in border-2 border-dashed border-border rounded-xl">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum evento encontrado</h3>
          <p className="text-muted-foreground">
            {canCreate ? 'Crie seu primeiro evento para começar.' : 'Aguarde a criação de eventos.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event, index) => (
            <div
              key={event.id}
              onClick={() => navigate(`/event/${event.id}`)}
              className="bg-card hover:bg-secondary border border-border rounded-xl p-6 cursor-pointer transition-all duration-200 hover:border-primary/50 animate-fade-in group relative overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2">{event.name}</h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  {format(new Date(event.date), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

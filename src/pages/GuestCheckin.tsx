import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, Copy, Camera, Wifi } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  wifi_ssid: string | null;
  wifi_pass: string | null;
  photo_url: string | null;
}

export default function GuestCheckin() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, name, wifi_ssid, wifi_pass, photo_url')
      .eq('id', id)
      .single();

    setEvent(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);

    // Check if guest exists
    const { data: existingGuest } = await supabase
      .from('guests')
      .select('id, name')
      .eq('event_id', id)
      .ilike('name', name.trim())
      .maybeSingle();

    if (existingGuest) {
      // Update existing guest
      await supabase
        .from('guests')
        .update({
          checked_in: true,
          checkin_time: new Date().toISOString(),
        })
        .eq('id', existingGuest.id);

      setGuestName(existingGuest.name);
    } else {
      // Create walk-in guest
      const { data: newGuest } = await supabase
        .from('guests')
        .insert({
          event_id: id,
          name: name.trim(),
          checked_in: true,
          checkin_time: new Date().toISOString(),
        })
        .select('name')
        .single();

      setGuestName(newGuest?.name || name.trim());
    }

    setCheckedIn(true);
    setSubmitting(false);
  };

  const copyPassword = () => {
    if (event?.wifi_pass) {
      navigator.clipboard.writeText(event.wifi_pass);
      toast({ title: 'Copiado!', description: 'Senha copiada para a área de transferência.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground text-lg">Evento não encontrado</p>
      </div>
    );
  }

  if (checkedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Obrigado por comparecer!</h1>
          <p className="text-2xl text-primary font-semibold mb-8">{guestName}</p>

          {event.wifi_ssid && (
            <div className="bg-card border border-border rounded-2xl p-6 mb-4 text-left animate-slide-in">
              <div className="flex items-center gap-3 mb-4">
                <Wifi className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Wi-Fi do Evento</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Rede</p>
                  <p className="text-lg font-medium text-foreground">{event.wifi_ssid}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Senha</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-medium text-foreground">{event.wifi_pass}</p>
                    <Button variant="ghost" size="icon" onClick={copyPassword} className="h-8 w-8">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {event.photo_url && (
            <Button
              className="w-full bg-primary hover:bg-primary/90 h-16 text-xl font-bold uppercase tracking-wide"
              onClick={() => window.open(event.photo_url!, '_blank')}
            >
              <Camera className="h-6 w-6 mr-3" />
              ACESSAR FOTOS NO MOMENTS
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
          <p className="text-muted-foreground mt-2">Faça seu check-in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Seu nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-14 text-lg bg-card border-border"
            required
            autoFocus
          />
          <Button
            type="submit"
            className="w-full h-14 text-lg bg-primary hover:bg-primary/90 glow-primary"
            disabled={submitting || !name.trim()}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar Check-in'}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'react-qr-code';
import { Loader2 } from 'lucide-react';

interface Event {
  id: string;
  name: string;
}

export default function Totem() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', id)
      .single();

    setEvent(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-xl">Evento não encontrado</p>
      </div>
    );
  }

  const checkinUrl = `${window.location.origin}/guest/${id}`;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{event.name}</h1>
        <p className="text-xl text-muted-foreground">Escaneie o QR Code para fazer check-in</p>
      </div>

      <div className="bg-foreground p-8 rounded-3xl shadow-2xl animate-scale-in">
        <QRCode
          value={checkinUrl}
          size={300}
          level="H"
          bgColor="#fafafa"
          fgColor="#000000"
        />
      </div>

      <p className="mt-8 text-muted-foreground text-center max-w-md">
        Aponte a câmera do seu celular para o código acima
      </p>
    </div>
  );
}

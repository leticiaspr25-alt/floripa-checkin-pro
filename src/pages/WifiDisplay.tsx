import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'react-qr-code';
import { Loader2, Wifi } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  wifi_ssid: string | null;
  wifi_pass: string | null;
}

export default function WifiDisplay() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, name, wifi_ssid, wifi_pass')
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

  const wifiQRValue = `WIFI:T:WPA;S:${event.wifi_ssid || ''};P:${event.wifi_pass || ''};;`;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6">
          <Wifi className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-2">Wi-Fi</h1>
        <p className="text-xl text-muted-foreground">{event.name}</p>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
        {event.wifi_ssid && (
          <div className="bg-foreground p-6 rounded-3xl shadow-2xl animate-scale-in">
            <QRCode
              value={wifiQRValue}
              size={200}
              level="H"
              bgColor="#fafafa"
              fgColor="#000000"
            />
          </div>
        )}

        <div className="text-center lg:text-left space-y-6 animate-fade-in">
          <div>
            <p className="text-muted-foreground text-lg mb-2">Rede</p>
            <p className="text-5xl md:text-7xl font-bold text-primary break-all">
              {event.wifi_ssid || '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-lg mb-2">Senha</p>
            <p className="text-5xl md:text-7xl font-bold text-foreground break-all">
              {event.wifi_pass || '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'react-qr-code';
import { Loader2, Wifi, Image } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  wifi_ssid: string | null;
  wifi_pass: string | null;
  photo_img_url: string | null;
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
      .select('id, name, wifi_ssid, wifi_pass, photo_img_url')
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content - Split Screen 50/50 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Side - WiFi QR Code */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-border">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <Wifi className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">Wi-Fi</h2>
            <p className="text-muted-foreground mt-2">{event.name}</p>
          </div>

          {event.wifi_ssid && (
            <div className="bg-foreground p-6 lg:p-8 rounded-3xl shadow-2xl animate-scale-in">
              <QRCode
                value={wifiQRValue}
                size={220}
                level="H"
                bgColor="#fafafa"
                fgColor="#000000"
              />
            </div>
          )}
        </div>

        {/* Right Side - Event Photos/Gallery */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 bg-surface/50">
          {event.photo_img_url ? (
            <div className="w-full max-w-md animate-fade-in">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
                  <Image className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-foreground">Fotos do Evento</h2>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={event.photo_img_url}
                  alt="Fotos do Evento"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted/30 mb-4">
                <Image className="w-12 h-12 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg">Galeria de fotos</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Large SSID and Password */}
      <div className="bg-surface border-t border-border p-6 lg:p-10">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="text-muted-foreground text-sm uppercase tracking-wider mb-1">Rede</p>
            <p className="text-4xl lg:text-6xl xl:text-7xl font-bold text-primary break-all">
              {event.wifi_ssid || '—'}
            </p>
          </div>
          <div className="hidden lg:block w-px h-20 bg-border" />
          <div className="text-center lg:text-left">
            <p className="text-muted-foreground text-sm uppercase tracking-wider mb-1">Senha</p>
            <p className="text-4xl lg:text-6xl xl:text-7xl font-bold text-foreground break-all">
              {event.wifi_pass || '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

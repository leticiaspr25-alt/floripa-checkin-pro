import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, ExternalLink } from "lucide-react";

interface EventData {
  name: string;
  wifi_ssid: string | null;
  wifi_pass: string | null;
  wifi_img_url: string | null;
  photo_url: string | null;
  photo_img_url: string | null;
  layout_mode: 'standard' | 'full_screen' | null;
}

export default function WifiDisplay() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventData | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;
      const { data } = await supabase.from("events").select("*").eq("id", id).single();
      if (data) setEvent(data as unknown as EventData);
    }
    fetchEvent();
  }, [id]);

  if (!event) return <div className="h-screen bg-black flex items-center justify-center text-white">Carregando...</div>;

  // MODO ARTE TOTAL (FULL SCREEN)
  if (event.layout_mode === 'full_screen') {
    return (
      <div className="h-screen w-screen bg-black overflow-hidden flex items-center justify-center">
        {event.wifi_img_url ? (
          <img src={event.wifi_img_url} alt="Display TV" className="w-full h-full object-contain" />
        ) : (
          <div className="text-white">Aguardando arte digital...</div>
        )}
      </div>
    );
  }

  // MODO PADRÃO (SPLIT SCREEN)
  return (
    <div className="h-screen bg-black flex flex-col justify-between p-12 border-[20px] border-[#111] overflow-hidden">
      <div className="text-center pt-8">
        <h1 className="text-6xl font-black text-white tracking-tight uppercase">Conecte-se & Compartilhe</h1>
        <p className="text-xl text-gray-500 mt-4 tracking-widest uppercase">{event.name}</p>
      </div>

      <div className="flex flex-row items-center justify-center gap-32">
        {/* Bloco Wi-Fi */}
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-3xl mb-8 transform scale-110 shadow-[0_0_20px_rgba(243,112,33,0.3)]">
            {event.wifi_img_url ? (
              <img src={event.wifi_img_url} className="w-64 h-64 object-contain" alt="QR Wifi" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-black font-bold">SEM QR</div>
            )}
          </div>
          <div className="flex gap-3 text-[#f37021]">
            <Wifi size={32} />
            <span className="text-2xl font-bold">WI-FI GRÁTIS</span>
          </div>
        </div>

        {/* Divisor */}
        <div className="h-64 w-px bg-gradient-to-b from-transparent via-gray-700 to-transparent"></div>

        {/* Bloco Fotos */}
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-3xl mb-8 transform scale-110 shadow-[0_0_20px_rgba(243,112,33,0.3)]">
             {/* Usando API de QR Code para evitar erro de biblioteca */}
             <img 
               src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(event.photo_url || '#')}`} 
               className="w-64 h-64" 
               alt="QR Galeria"
             />
          </div>
          <div className="flex gap-3 text-white">
            <ExternalLink size={32} />
            <span className="text-2xl font-bold">GALERIA DE FOTOS</span>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 p-8 flex justify-around items-center shadow-2xl">
        <div className="text-center w-1/2 border-r border-gray-700">
          <p className="text-gray-500 text-xs uppercase tracking-[0.2em] mb-2 font-bold">REDE / NETWORK</p>
          <p className="text-5xl font-bold text-white tracking-tight">{event.wifi_ssid || '---'}</p>
        </div>
        <div className="text-center w-1/2">
          <p className="text-gray-500 text-xs uppercase tracking-[0.2em] mb-2 font-bold">SENHA / PASSWORD</p>
          <p className="text-5xl font-mono font-bold text-[#f37021] tracking-widest">{event.wifi_pass || '---'}</p>
        </div>
      </div>
    </div>
  );
}

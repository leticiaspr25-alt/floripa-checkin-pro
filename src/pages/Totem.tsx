import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Monitor } from "lucide-react";

interface EventData {
  name: string;
  photo_img_url: string | null;
  layout_mode: 'standard' | 'full_screen' | null;
}

export default function Totem() {
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
        {event.photo_img_url ? (
          <img src={event.photo_img_url} alt="Totem Vertical" className="w-full h-full object-contain" />
        ) : (
          <div className="text-white">Aguardando arte vertical...</div>
        )}
      </div>
    );
  }

  // MODO PADRÃO (CHECK-IN)
  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      <div className="mb-8 p-4 bg-[#f37021]/10 rounded-full animate-bounce">
        <Monitor size={40} className="text-[#f37021]" />
      </div>
      
      <div className="bg-white p-6 rounded-3xl shadow-[0_0_120px_rgba(243,112,33,0.3)] mb-12 transform hover:scale-105 transition-transform duration-500">
        <img 
           src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + '/guest/' + id)}`} 
           className="w-[250px] h-[250px]"
           alt="QR Check-in"
        />
      </div>
      
      <h1 className="text-7xl font-black text-white mb-6 tracking-tighter">CHECK-IN</h1>
      <div className="w-24 h-1.5 bg-[#f37021] rounded-full mb-8"></div>
      <p className="text-3xl text-gray-400 font-light">{event.name}</p>
      
      <div className="mt-16 flex items-center gap-3 text-gray-600">
        <span className="text-sm uppercase tracking-widest font-bold">Aponte a câmera do seu celular</span>
      </div>
    </div>
  );
}

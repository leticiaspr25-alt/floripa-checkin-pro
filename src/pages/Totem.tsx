import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Monitor } from "lucide-react";

interface EventData {
  name: string;
  event_logo_url: string | null;
  primary_color: string | null;
}

export default function Totem() {
  const { id } = useParams<{ id: string }>();
  const [eventData, setEventData] = useState<EventData>({
    name: "",
    event_logo_url: null,
    primary_color: "#f37021"
  });

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;
      const { data } = await supabase
        .from("events")
        .select("name, event_logo_url, primary_color")
        .eq("id", id)
        .single();
      if (data) {
        setEventData({
          name: data.name,
          event_logo_url: data.event_logo_url,
          primary_color: data.primary_color || "#f37021"
        });
      }
    }
    fetchEvent();
  }, [id]);

  const primaryColor = eventData.primary_color || "#f37021";

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      {/* Logo do Evento ou Ícone Padrão */}
      {eventData.event_logo_url ? (
        <div className="mb-8">
          <img
            src={eventData.event_logo_url}
            alt="Logo do Evento"
            className="w-32 h-32 object-contain"
          />
        </div>
      ) : (
        <div
          className="mb-8 p-4 rounded-full animate-bounce"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <Monitor size={40} style={{ color: primaryColor }} />
        </div>
      )}

      {/* QR Code com sombra colorida */}
      <div
        className="bg-white p-6 rounded-3xl mb-12 transform hover:scale-105 transition-transform duration-500"
        style={{ boxShadow: `0 0 120px ${primaryColor}50` }}
      >
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + '/guest/' + id)}`}
          className="w-[250px] h-[250px]"
          alt="QR Check-in"
        />
      </div>

      <h1 className="text-7xl font-black text-white mb-6 tracking-tighter">CHECK-IN</h1>

      {/* Barra colorida */}
      <div
        className="w-24 h-1.5 rounded-full mb-8"
        style={{ backgroundColor: primaryColor }}
      />

      <p className="text-3xl text-gray-400 font-light">{eventData.name}</p>

      <div className="mt-16 flex items-center gap-3 text-gray-600">
        <span className="text-sm uppercase tracking-widest font-bold">
          Aponte a câmera do seu celular
        </span>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown } from "lucide-react";

interface EventData {
  name: string;
}

export default function Totem() {
  const { id } = useParams<{ id: string }>();
  const [eventData, setEventData] = useState<EventData>({ name: "" });

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;
      const { data } = await supabase
        .from("events")
        .select("name")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        setEventData({ name: data.name });
      }
    }
    fetchEvent();
  }, [id]);

  const primaryColor = "#f37021";

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      {/* Setinha com cor primária do evento */}
      <div className="mb-6 animate-bounce" style={{ color: primaryColor }}>
        <ChevronDown size={60} strokeWidth={3} />
      </div>

      {/* QR Code com sombra colorida */}
      <div
        className="bg-white p-6 rounded-3xl mb-10 transform hover:scale-105 transition-transform duration-500"
        style={{ boxShadow: `0 0 120px ${primaryColor}50` }}
      >
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(window.location.origin + '/guest/' + id)}`}
          className="w-[280px] h-[280px]"
          alt="QR Check-in"
        />
      </div>

      <h1 className="text-7xl font-black text-white mb-6 tracking-tighter">CHECK-IN</h1>

      {/* Barra colorida */}
      <div className="w-24 h-1.5 rounded-full mb-8" style={{ backgroundColor: primaryColor }} />

      {/* Nome do evento */}
      <p className="text-3xl text-gray-400 font-light">{eventData.name}</p>

      <div className="mt-12 flex items-center gap-3 text-gray-600">
        <span className="text-sm uppercase tracking-widest font-bold">
          Aponte a câmera do seu celular
        </span>
      </div>
    </div>
  );
}

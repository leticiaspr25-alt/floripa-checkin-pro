import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Camera, Wifi } from 'lucide-react';

export default function GuestCheckin() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (data) setEvent(data);
      setLoading(false);
    }
    fetchEvent();
  }, [id]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCheckinLoading(true);
    
    // 1. Cria o convidado na lista (Auto Check-in)
    const { error } = await supabase.from('guests').insert({
      event_id: id,
      name: name,
      company: company || null,
      checked_in: true, // Já marca como presente
      checkin_time: new Date().toISOString()
    });

    setCheckinLoading(false);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível realizar o check-in.", variant: "destructive" });
    } else {
      setConfirmed(true);
      // Log de atividade (Opcional)
      await supabase.from('activity_logs').insert({
        event_id: id,
        action: 'Auto Check-in',
        details: `${name} (Via Mobile)`
      });
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#f37021]" /></div>;

  if (!event) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Evento não encontrado.</div>;

  return (
    <div className="min-h-screen bg-black p-6 flex flex-col items-center justify-center">
      
      {/* TELA DE SUCESSO (PÓS CONFIRMAÇÃO) */}
      {confirmed ? (
        <div className="w-full max-w-md text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="flex justify-center">
            <div className="h-24 w-24 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo(a)!</h1>
            <p className="text-xl text-[#f37021] font-semibold">{name}</p>
            <p className="text-gray-400 mt-2">Seu check-in foi realizado com sucesso.</p>
          </div>

          <div className="space-y-4">
            {/* BOTÃO MOMENTS (O QUE O USUÁRIO PEDIU) */}
            {event.photo_url && (
              <Button 
                className="w-full py-8 text-lg font-bold bg-[#f37021] hover:bg-[#d95d10] shadow-[0_0_20px_rgba(243,112,33,0.3)] transition-all hover:scale-105 text-white"
                onClick={() => window.open(event.photo_url, '_blank')}
              >
                <Camera className="mr-2 h-6 w-6" />
                ACESSAR FOTOS NO MOMENTS
              </Button>
            )}

            {/* CARD WI-FI */}
            {(event.wifi_ssid || event.wifi_pass) && (
              <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6 text-left">
                <div className="flex items-center gap-2 mb-4 text-gray-400">
                  <Wifi className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-wider font-bold">Wi-Fi do Evento</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Rede</p>
                    <p className="text-white font-mono text-lg">{event.wifi_ssid || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Senha (Toque para copiar)</p>
                    <p 
                      className="text-[#f37021] font-mono text-xl font-bold cursor-pointer active:opacity-50"
                      onClick={() => {
                        navigator.clipboard.writeText(event.wifi_pass || '');
                        toast({ title: "Copiado!", description: "Senha do Wi-Fi copiada." });
                      }}
                    >
                      {event.wifi_pass || '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mt-8">Floripa Square Eventos</p>
        </div>
      ) : (
        /* TELA DE CHECK-IN (FORMULÁRIO) */
        <Card className="w-full max-w-md bg-[#1A1A1A] border-[#333]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">{event.name}</CardTitle>
            <CardDescription>Confirme sua presença para acessar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Seu Nome Completo</Label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Ex: João Silva" 
                  className="bg-black border-[#333] text-white h-12 text-lg focus:border-[#f37021]"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Empresa (Opcional)</Label>
                <Input 
                  value={company} 
                  onChange={e => setCompany(e.target.value)} 
                  placeholder="Ex: Floripa Square" 
                  className="bg-black border-[#333] text-white focus:border-[#f37021]"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold bg-[#f37021] hover:bg-[#d95d10] text-white"
                disabled={checkinLoading}
              >
                {checkinLoading ? <Loader2 className="animate-spin" /> : 'CONFIRMAR PRESENÇA'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

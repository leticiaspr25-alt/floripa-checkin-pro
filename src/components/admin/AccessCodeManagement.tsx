import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccessCodeManagement() {
  const [keys, setKeys] = useState({ admin: '', team: '', receptionist: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Busca as chaves atuais do banco
  const fetchKeys = async () => {
    const { data, error } = await supabase.from('access_keys').select('*');
    
    if (error) {
      toast({ title: "Erro", description: "Falha ao carregar chaves.", variant: "destructive" });
    } else if (data) {
      const newKeys = { admin: '', team: '', receptionist: '' };
      data.forEach((k: any) => {
        if (k.key_type === 'admin') newKeys.admin = k.key_value;
        if (k.key_type === 'team') newKeys.team = k.key_value;
        if (k.key_type === 'receptionist') newKeys.receptionist = k.key_value;
      });
      // Se vier vazio do banco, mantém os padrões para visualização
      if (!newKeys.admin) newKeys.admin = 'MASTER_FLORIPA';
      if (!newKeys.team) newKeys.team = 'EQUIPE_2025';
      if (!newKeys.receptionist) newKeys.receptionist = 'RECEPCAO_EVENTO';
      
      setKeys(newKeys);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    
    const updates = [
      { key_type: 'admin', key_value: keys.admin },
      { key_type: 'team', key_value: keys.team },
      { key_type: 'receptionist', key_value: keys.receptionist }
    ];

    const { error } = await supabase.from('access_keys').upsert(updates);

    if (error) {
      toast({ title: "Erro", description: "Falha ao salvar.", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Novos códigos de acesso salvos!" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Gerenciar Códigos de Cadastro</h3>
      </div>
      
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label className="text-foreground">Código Admin (Acesso Total)</Label>
          <div className="flex gap-2">
            <Input 
              value={keys.admin} 
              onChange={e => setKeys({...keys, admin: e.target.value})} 
              className="bg-secondary border-border font-mono text-primary" 
            />
          </div>
          <p className="text-xs text-muted-foreground">Use este código para criar novos administradores.</p>
        </div>
        
        <div className="space-y-2">
          <Label className="text-foreground">Código da Equipe</Label>
          <Input 
            value={keys.team} 
            onChange={e => setKeys({...keys, team: e.target.value})} 
            className="bg-secondary border-border font-mono" 
          />
          <p className="text-xs text-muted-foreground">Permite criar eventos e editar listas.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Código da Recepção</Label>
          <Input 
            value={keys.receptionist} 
            onChange={e => setKeys({...keys, receptionist: e.target.value})} 
            className="bg-secondary border-border font-mono" 
          />
          <p className="text-xs text-muted-foreground">Apenas check-in e visualização (sem excluir).</p>
        </div>
      </div>

      <div className="pt-4">
        <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Novos Códigos
        </Button>
      </div>
    </div>
  );
}

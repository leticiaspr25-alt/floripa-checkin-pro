import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, KeyRound, Save, Shield } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AccessCode {
  id: string;
  role: AppRole;
  code: string;
}

export default function AccessCodeManagement() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});
  const [editedCodes, setEditedCodes] = useState<Record<string, string>>({});

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .order('role');

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao carregar códigos.', variant: 'destructive' });
    } else {
      setCodes(data || []);
      const initialEdited: Record<string, string> = {};
      data?.forEach(code => {
        initialEdited[code.role as string] = code.code;
      });
      setEditedCodes(initialEdited);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleSave = async () => {
    setSaving(true);

    for (const code of codes) {
      const roleKey = code.role as string;
      const newCode = editedCodes[roleKey];
      if (newCode && newCode !== code.code) {
        const { error } = await supabase
          .from('access_codes')
          .update({ code: newCode, updated_at: new Date().toISOString() })
          .eq('role', code.role);

        if (error) {
          toast({ title: 'Erro', description: `Falha ao atualizar código de ${code.role}.`, variant: 'destructive' });
          setSaving(false);
          return;
        }
      }
    }

    toast({ title: 'Sucesso', description: 'Códigos de acesso atualizados!' });
    fetchCodes();
    setSaving(false);
  };

  const toggleShowCode = (role: string) => {
    setShowCodes(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      equipe: 'Equipe',
      recepcao: 'Recepção'
    };
    return labels[role] || role;
  };

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      admin: 'Acesso total: gerencia eventos, usuários e configurações',
      equipe: 'Cria eventos e gerencia convidados',
      recepcao: 'Apenas check-in e impressão de etiquetas'
    };
    return descriptions[role] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Configurar Chaves de Acesso</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Estes códigos são usados durante o cadastro para determinar o nível de acesso do novo usuário.
      </p>

      <div className="space-y-4">
        {codes.map((code) => (
          <div key={code.id} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <Label className="text-foreground font-medium flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Código {getRoleLabel(code.role)}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {getRoleDescription(code.role)}
                </p>
              </div>
            </div>
            <div className="relative mt-3">
              <Input
                type={showCodes[code.role] ? 'text' : 'password'}
                value={editedCodes[code.role] || ''}
                onChange={(e) => setEditedCodes(prev => ({ ...prev, [code.role]: e.target.value }))}
                className="bg-secondary border-border pr-10 font-mono"
                placeholder="Digite o novo código"
              />
              <button
                type="button"
                onClick={() => toggleShowCode(code.role)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCodes[code.role] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button 
        onClick={handleSave} 
        className="w-full bg-primary hover:bg-primary/90"
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Salvar Alterações
      </Button>
    </div>
  );
}

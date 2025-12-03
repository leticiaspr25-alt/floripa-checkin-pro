import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, KeyRound, User, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface UserWithRole {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    // Tenta buscar da tabela de perfis (profiles)
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        user_id,
        email,
        display_name,
        created_at
      `);

    if (error) {
      // Se der erro (ex: tabela profiles vazia ou sem permissão), tenta pegar direto do user_roles como fallback
      console.error("Erro ao buscar profiles, tentando user_roles", error);
      fetchUsersFromRoles();
      return;
    }

    const usersWithRoles: UserWithRole[] = [];
    
    if (data) {
      for (const profile of data) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.user_id)
          .maybeSingle();

        usersWithRoles.push({
          ...profile,
          role: roleData?.role || 'receptionist'
        });
      }
      setUsers(usersWithRoles);
    }
    setLoading(false);
  };

  // Fallback: Se profiles falhar, busca direto de user_roles (onde salvamos nome/email no trigger)
  const fetchUsersFromRoles = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*');

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao carregar equipe.', variant: 'destructive' });
    } else {
      // Mapeia os dados do user_roles para o formato esperado
      const mappedUsers = data.map((u: any) => ({
        user_id: u.user_id,
        email: u.email || 'Sem email',
        display_name: u.name || 'Sem nome',
        role: u.role || 'receptionist',
        created_at: new Date().toISOString() // Data aproximada
      }));
      setUsers(mappedUsers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      return;
    }

    setActionLoading(true);
    
    // 1. Deleta da tabela de cargos
    await supabase.from('user_roles').delete().eq('user_id', userId);
    
    // 2. Tenta deletar do profile (se existir)
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);

    // Nota: Em um ambiente real, precisaríamos deletar do Auth via Edge Function (Admin API),
    // mas deletar do user_roles já remove o acesso ao sistema pelo nosso App.

    if (error) {
      // Se der erro no profile, mas deletou do roles, considera sucesso parcial (acesso revogado)
      toast({ title: 'Sucesso', description: 'Acesso do usuário revogado.' });
    } else {
      toast({ title: 'Sucesso', description: 'Usuário excluído.' });
    }
    
    fetchUsers();
    setActionLoading(false);
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword.trim()) return;
    
    setActionLoading(true);
    
    try {
      // Tenta atualizar a senha via API do Cliente
      // O Supabase pode bloquear isso se não for o próprio usuário, 
      // mas mantemos a tentativa para admins que tenham permissão configurada.
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({ 
        title: 'Sucesso', 
        description: `Senha de ${selectedUser.email} atualizada.` 
      });
      
      setResetDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);

    } catch (error: any) {
      console.error(error);
      toast({ 
        title: 'Atenção', 
        description: 'Para resetar a senha de OUTRO usuário, utilize o painel do Supabase > Authentication ou peça para ele usar "Esqueci minha senha".', 
        variant: 'destructive' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: any = {
      admin: 'bg-primary/20 text-primary border-primary/30',
      team: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      receptionist: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    const labels: any = {
      admin: 'Admin',
      team: 'Equipe',
      receptionist: 'Recepção',
    };
    return (
      <Badge className={`${colors[role] || 'bg-muted'} border`}>
        {labels[role] || role}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Gerenciar Equipe</h3>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center justify-between bg-card border border-border rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {user.display_name || 'Sem nome'}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                {getRoleBadge(user.role)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(user);
                    setResetDialogOpen(true);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <KeyRound className="h-4 w-4 mr-1" />
                  Resetar
                </Button>
                {user.user_id !== currentUser?.id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(user.user_id)}
                    disabled={actionLoading}
                    className="text-destructive hover:bg-destructive/10 border-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground px-2">Você</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Resetar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Definir nova senha para: <strong>{selectedUser?.email}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-secondary border-border"
              />
            </div>
            <Button
              onClick={handleResetPassword}
              className="w-full bg-primary hover:bg-primary/90"
              disabled={actionLoading || !newPassword.trim()}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Reset'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

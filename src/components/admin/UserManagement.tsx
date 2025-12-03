import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, KeyRound, User, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserWithRole {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        user_id,
        email,
        display_name,
        created_at
      `);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao carregar usuários.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch roles for each user
    const usersWithRoles: UserWithRole[] = [];
    for (const profile of data || []) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.user_id)
        .single();

      usersWithRoles.push({
        ...profile,
        role: roleData?.role || 'unknown'
      });
    }

    setUsers(usersWithRoles);
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
    
    // Delete from user_roles first
    await supabase.from('user_roles').delete().eq('user_id', userId);
    
    // Delete from profiles
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir usuário.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Usuário excluído.' });
      fetchUsers();
    }
    setActionLoading(false);
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword.trim()) return;
    
    setActionLoading(true);
    
    // Note: This requires admin privileges via Edge Function in production
    // For now, we'll show a message about the limitation
    toast({ 
      title: 'Atenção', 
      description: 'Reset de senha requer configuração de Edge Function com service_role. Entre em contato com o suporte.',
      variant: 'default'
    });
    
    setActionLoading(false);
    setResetDialogOpen(false);
    setNewPassword('');
    setSelectedUser(null);
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-primary/20 text-primary border-primary/30',
      equipe: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      recepcao: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    const labels = {
      admin: 'Admin',
      equipe: 'Equipe',
      recepcao: 'Recepção',
    };
    return (
      <Badge className={`${colors[role as keyof typeof colors] || 'bg-muted'} border`}>
        {labels[role as keyof typeof labels] || role}
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
              className="flex items-center justify-between bg-surface border border-border rounded-lg p-4"
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
                  Resetar Senha
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteUser(user.user_id)}
                  disabled={actionLoading}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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

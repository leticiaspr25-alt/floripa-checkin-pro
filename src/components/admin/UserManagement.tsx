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
    
    // Deleta da tabela de cargos primeiro
    await supabase.from('user_roles').delete().eq('user_id', userId);
    
    // Deleta do perfil
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
    
    try {
      // Tenta atualizar a senha
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({ 
        title: 'Sucesso', 
        description: `Senha de ${selectedUser.email} atualizada com sucesso.` 
      });
      
      setResetDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);

    } catch (error: any) {
      console.error(error);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível atualizar a senha. O Supabase bloqueia alteração de terceiros pelo navegador por segurança.', 
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
                  <User className="h

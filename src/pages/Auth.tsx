import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "Senhas não conferem.", variant: "destructive" });
      return;
    }

    // --- VALIDAÇÃO DAS CHAVES (CODIGOS FIXOS) ---
    let role = '';
    if (accessCode === 'MASTER_FLORIPA') role = 'admin';
    else if (accessCode === 'EQUIPE_2025') role = 'team';
    else if (accessCode === 'RECEPCAO_EVENTO') role = 'receptionist';
    else {
      toast({ title: "Erro", description: "Código de acesso inválido. Verifique com o administrador.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Passamos o cargo (role) e o nome junto com o cadastro
      await signUp(newEmail, newPassword, { full_name: newName, role: role });
      toast({ title: "Sucesso!", description: "Conta criada. Verifique seu e-mail (se necessário) ou faça login." });
      // Opcional: Já logar direto ou pedir login
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-[#1A1A1A] border-[#333] text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-[#f37021]">Floripa Event Manager</CardTitle>
          <CardDescription className="text-center text-gray-400">Acesse o sistema para gerenciar</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-black mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="bg-black border-[#333] text-white" /></div>
                <div className="space-y-2"><Label>Senha</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="bg-black border-[#333] text-white" /></div>
                <Button type="submit" className="w-full bg-[#f37021] hover:bg-[#d95d10]" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : 'Acessar'}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} required className="bg-black border-[#333] text-white" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} required className="bg-black border-[#333] text-white" /></div>
                <div className="space-y-2"><Label>Senha</Label><Input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required className="bg-black border-[#333] text-white" /></div>
                <div className="space-y-2"><Label>Confirmar Senha</Label><Input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required className="bg-black border-[#333] text-white" /></div>
                
                {/* CAMPO DE CÓDIGO DE ACESSO */}
                <div className="space-y-2">
                  <Label className="text-[#f37021]">Código de Acesso</Label>
                  <Input 
                    value={accessCode} 
                    onChange={e=>setAccessCode(e.target.value)} 
                    placeholder="Solicite ao administrador"
                    required 
                    className="bg-black border-[#f37021]/50 text-white" 
                  />
                </div>

                <Button type="submit" className="w-full bg-[#f37021] hover:bg-[#d95d10]" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : 'Criar Conta'}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

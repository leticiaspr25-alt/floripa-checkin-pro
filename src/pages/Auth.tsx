import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff } from 'lucide-react'; // Importamos os ícones do olho
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Estados de Visibilidade da Senha
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({ title: "Erro no Login", description: error.message, variant: "destructive" });
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    // --- VALIDAÇÃO DAS CHAVES ---
    // Nota: Em produção real, o ideal é validar isso no Backend (Edge Function),
    // mas para este MVP, validamos aqui e salvamos o role no metadata.
    
    // Buscamos a chave no banco de dados (simulação via código fixo ou busca)
    // Aqui mantemos a lógica simples de comparação direta para garantir funcionamento imediato
    let role = '';
    if (accessCode === 'MASTER_FLORIPA') role = 'admin';
    else if (accessCode === 'EQUIPE_2025') role = 'team';
    else if (accessCode === 'RECEPCAO_EVENTO') role = 'receptionist';
    else {
      toast({ title: "Acesso Negado", description: "O código de acesso informado é inválido.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: {
        data: {
          full_name: newName,
          role: role, // Salva o cargo no perfil do usuário
        },
      },
    });

    if (error) {
      toast({ title: "Erro no Cadastro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso!", description: "Conta criada com sucesso! Entrando..." });
      if (data.session) {
        navigate('/dashboard');
      } else {
        // Fallback: Tenta logar manualmente se a sessão não vier automática
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: newEmail, password: newPassword });
        if (!loginError) navigate('/dashboard');
      }
    }
    setLoading(false);
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
            <TabsList className="grid w-full grid-cols-2 bg-black mb-6 border border-[#333]">
              <TabsTrigger value="login" className="data-[state=active]:bg-[#f37021] data-[state=active]:text-white">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-[#f37021] data-[state=active]:text-white">Criar Conta</TabsTrigger>
            </TabsList>
            
            {/* --- FORMULÁRIO DE LOGIN --- */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={e=>setEmail(e.target.value)} 
                    required 
                    className="bg-black border-[#333] text-white focus:border-[#f37021]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e=>setPassword(e.target.value)} 
                      required 
                      className="bg-black border-[#333] text-white focus:border-[#f37021] pr-10" 
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#f37021] hover:bg-[#d95d10] text-white font-bold" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : 'Acessar Sistema'}
                </Button>
              </form>
            </TabsContent>

            {/* --- FORMULÁRIO DE CADASTRO --- */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input 
                    value={newName} 
                    onChange={e=>setNewName(e.target.value)} 
                    required 
                    className="bg-black border-[#333] text-white focus:border-[#f37021]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Corporativo</Label>
                  <Input 
                    type="email" 
                    value={newEmail} 
                    onChange={e=>setNewEmail(e.target.value)} 
                    required 
                    className="bg-black border-[#333] text-white focus:border-[#f37021]" 
                  />
                </div>
                
                {/* Senha com Olhinho */}
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={newPassword} 
                      onChange={e=>setNewPassword(e.target.value)} 
                      required 
                      className="bg-black border-[#333] text-white focus:border-[#f37021] pr-10" 
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Confirmar Senha com Olhinho */}
                <div className="space-y-2">
                  <Label>Confirmar Senha</Label>
                  <div className="relative">
                    <Input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword} 
                      onChange={e=>setConfirmPassword(e.target.value)} 
                      required 
                      className="bg-black border-[#333] text-white focus:border-[#f37021] pr-10" 
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-white"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                {/* Código de Acesso (SEM PLACEHOLDER REVELADOR) */}
                <div className="space-y-2 pt-2 border-t border-[#333] mt-2">
                  <Label className="text-[#f37021] font-bold">Código de Acesso Corporativo</Label>
                  <Input 
                    value={accessCode} 
                    onChange={e=>setAccessCode(e.target.value)} 
                    placeholder="Digite o código fornecido pelo Administrador"
                    required 
                    className="bg-black border-[#f37021]/50 text-white focus:border-[#f37021]" 
                  />
                  <p className="text-[10px] text-gray-500">Este código define seu nível de permissão.</p>
                </div>

                <Button type="submit" className="w-full bg-[#f37021] hover:bg-[#d95d10] text-white font-bold mt-4" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : 'Criar Conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

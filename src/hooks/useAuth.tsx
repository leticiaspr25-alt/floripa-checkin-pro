import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'equipe' | 'recepcao' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName: string, accessCode: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isEquipe: boolean;
  isRecepcao: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>(null);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (data?.role) {
      setRole(data.role as AppRole);
    } else {
      setRole(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, displayName: string, accessCode: string) => {
    // First validate the access code
    const { data: codeData, error: codeError } = await supabase
      .from('access_codes')
      .select('role')
      .eq('code', accessCode)
      .single();

    if (codeError || !codeData) {
      return { error: new Error('Código de acesso inválido. Verifique com o administrador.') };
    }

    const validatedRole = codeData.role as AppRole;

    const redirectUrl = `${window.location.origin}/`;
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { display_name: displayName }
      }
    });

    if (signUpError) {
      return { error: signUpError as Error };
    }

    // Assign role to user
    if (authData.user) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: authData.user.id, role: validatedRole });

      if (roleError) {
        console.error('Error assigning role:', roleError);
      }

      // Update profile with display name
      await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('user_id', authData.user.id);
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  const isAdmin = role === 'admin';
  const isEquipe = role === 'equipe';
  const isRecepcao = role === 'recepcao';

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      role,
      signIn, 
      signUp, 
      signOut,
      isAdmin,
      isEquipe,
      isRecepcao
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

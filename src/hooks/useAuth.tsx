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
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
        return;
      }
      
      if (data?.role) {
        setRole(data.role as AppRole);
      } else {
        setRole(null);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
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
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, displayName: string, accessCode: string) => {
    try {
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

      // Assign role using secure server-side function
      // This validates the access code and assigns the role in one atomic operation
      if (authData.user) {
        const { data: assignedRole, error: roleError } = await supabase
          .rpc('assign_role_with_code', {
            _user_id: authData.user.id,
            _access_code: accessCode
          });

        if (roleError) {
          console.error('Error assigning role:', roleError);
          return { error: new Error('Erro ao validar código de acesso. Tente novamente.') };
        }

        if (!assignedRole) {
          // Invalid access code - the function returned NULL
          return { error: new Error('Código de acesso inválido. Verifique com o administrador.') };
        }

        // Update profile with display name
        await supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('user_id', authData.user.id);
      }

      return { error: null };
    } catch (error) {
      console.error('Error during signup:', error);
      return { error: error as Error };
    }
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

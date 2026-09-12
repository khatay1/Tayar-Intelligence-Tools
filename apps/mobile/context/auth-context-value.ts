import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

export type SignUpResult = { needsEmailConfirmation: boolean };

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

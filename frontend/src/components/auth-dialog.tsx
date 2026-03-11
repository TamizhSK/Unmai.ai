'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { User, Mail, Lock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError('');
  };

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setError('');
  };

  const validateForm = (): string | null => {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least 1 uppercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least 1 number';
    if (mode === 'signup' && !displayName.trim()) return 'Display name is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, displayName.trim());
      }
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {mode === 'login' ? 'Sign in to' : 'Sign up for'}{' '}
            <span
              className="bg-clip-text text-transparent font-bold"
              style={{ backgroundImage: 'linear-gradient(to left, #4285F4 0%, #DB4437 33%, #F4B400 66%, #0F9D58 100%)' }}
            >
              unmai.ai
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-muted p-1 mb-4">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === 'signup'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="displayName" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Display Name
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ chars, 1 uppercase, 1 number"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

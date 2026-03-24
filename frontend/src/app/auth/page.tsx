'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { User, Mail, Lock, Loader2, ArrowLeft, Shield, Search, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

export default function AuthPage() {
  const router = useRouter();
  const { login, signup, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

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
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, label: 'AI-Powered Verification', desc: 'Detect deepfakes, misinformation, and manipulated media' },
    { icon: Search, label: 'Multi-Source Fact Checking', desc: 'Cross-reference claims across trusted databases' },
    { icon: Brain, label: 'Smart Analysis', desc: 'Text, image, video, audio, and URL analysis' },
  ];

  return (
    <div className="min-h-[100svh] flex flex-col lg:flex-row">
      {/* Left side - Branding & Image (top on mobile, left on desktop) */}
      <div className="relative lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-br from-[#4285F4]/10 via-[#EA4335]/5 to-[#34A853]/10 dark:from-[#4285F4]/20 dark:via-[#EA4335]/10 dark:to-[#34A853]/20">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="max-w-md w-full space-y-6 lg:space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image src="/unmaiai.png" alt="Unmai.ai" width={48} height={48} className="rounded-xl" />
            <h1 className="text-3xl lg:text-4xl font-bold">
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(to left, #4285F4 0%, #DB4437 33%, #F4B400 66%, #0F9D58 100%)' }}
              >
                unmai.ai
              </span>
            </h1>
          </div>

          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Verify credibility and uncover truth with AI-powered analysis
          </p>

          {/* Feature highlights */}
          <div className="space-y-4 hidden sm:block">
            {features.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'login'
                ? 'Sign in to access your analysis history'
                : 'Join unmai.ai to save and track your verifications'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
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
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
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
                <label htmlFor="displayName" className="text-sm font-medium mb-1.5 flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Display Name
                </label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-11"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="text-sm font-medium mb-1.5 flex items-center gap-2">
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
                className="h-11"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium mb-1.5 flex items-center gap-2">
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
                className="h-11"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 gap-2 text-base font-medium"
              disabled={loading}
              style={{
                background: loading ? undefined : 'linear-gradient(135deg, #4285F4, #34A853)',
              }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading
                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

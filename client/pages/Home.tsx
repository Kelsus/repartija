import { useState } from 'react';
import { useLocation } from 'wouter';
import { LogIn, Wallet, Sparkles } from 'lucide-react';
import {
  saveHostToken, saveName, getSavedName, getSavedPayTarget, savePayTarget
} from '../lib/storage';
import BrandMark from '../components/BrandMark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Home() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [title, setTitle] = useState('');
  const [name, setName] = useState(getSavedName());
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = getSavedPayTarget();
  const [identifier, setIdentifier] = useState(saved?.identifier ?? '');

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const id = identifier.trim();
      const paymentTarget = id ? { identifier: id, label: name.trim() || 'Host' } : null;
      const paymentMode = paymentTarget ? 'host' : 'cash';

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Nuestra mesa',
          paymentMode,
          paymentTarget
        })
      });
      if (!res.ok) throw new Error('No se pudo crear la sesión');
      const data = (await res.json()) as { code: string; hostToken: string };
      saveHostToken(data.code, data.hostToken);
      if (name.trim()) saveName(name.trim());
      savePayTarget(paymentTarget);
      setLocation(`/s/${data.code}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    if (name.trim()) saveName(name.trim());
    setLocation(`/s/${code}`);
  }

  return (
    <main className="relative mx-auto w-full max-w-xl px-4 py-10 flex flex-col gap-6">
      <header className="text-center space-y-4 pb-2">
        <div className="flex justify-center">
          <BrandMark size={140} />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <span className="bg-gradient-to-br from-jungle-200 via-jungle-100 to-jungle-300 bg-clip-text text-transparent">
            Repartija
          </span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
          La <em className="text-accent not-italic font-medium">lagartija</em> que splitea
          la cuenta con tus amigos. Sin cuenta, sin drama.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="lg"
          variant={mode === 'create' ? 'default' : 'outline'}
          className="w-full"
          onClick={() => setMode('create')}
        >
          <Sparkles className="h-4 w-4" />
          Nueva mesa
        </Button>
        <Button
          type="button"
          size="lg"
          variant={mode === 'join' ? 'secondary' : 'outline'}
          className="w-full"
          onClick={() => setMode('join')}
        >
          <LogIn className="h-4 w-4" />
          Unirme
        </Button>
      </div>

      {mode === 'create' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Crear mesa
            </CardTitle>
            <CardDescription>
              Abrí una mesa nueva y compartí el QR o el código con el resto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createSession} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-name">Tu nombre</Label>
                <Input
                  id="create-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setMode('create')}
                  placeholder="ej. Juan"
                  maxLength={40}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-title" className="flex items-center gap-2">
                  Nombre de la mesa
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="create-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={() => setMode('create')}
                  placeholder="ej. Cumple de Ana"
                  maxLength={80}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-identifier" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-accent" />
                  Alias / usuario / CBU / CVU / link
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="create-identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onFocus={() => setMode('create')}
                  placeholder="juan.mp  ·  @usuario  ·  2710…  ·  https://…"
                  maxLength={200}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {identifier.trim()
                    ? 'Cada invitado podrá copiarlo o abrir su app favorita (MP, PayPal, Venmo, Ualá, PIX).'
                    : 'Si lo dejás vacío, la mesa queda en modo efectivo.'}
                </p>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Creando…' : 'Crear mesa'}
              </Button>

              {error && (
                <p className="text-sm text-destructive text-center" role="alert">
                  {error}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-accent" />
              Unirme a una mesa
            </CardTitle>
            <CardDescription>
              Entrá con el código que te compartieron y sumate a la cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={join} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="join-name">Tu nombre</Label>
                <Input
                  id="join-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setMode('join')}
                  placeholder="ej. Ana"
                  maxLength={40}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="join-code">Código de la mesa</Label>
                <Input
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onFocus={() => setMode('join')}
                  placeholder="ABC123"
                  maxLength={8}
                  className="text-center text-2xl font-mono tracking-[0.4em] uppercase h-14"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <Button type="submit" variant="secondary" size="lg" className="w-full">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

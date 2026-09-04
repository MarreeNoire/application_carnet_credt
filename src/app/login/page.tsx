'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { setupOnlineListener } from '@/lib/syncService';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>( 'phone' );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize online listener on mount (also done in layout, but safe)
  // useEffect(() => {
  //   return setupOnlineListener();
  // }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (step === 'phone') {
        // Validate phone number (simple check)
        const cleaned = phoneNumber.replace(/\s/g, '');
        if (!/^\+225\d{8,10}$/.test(cleaned)) {
          throw new Error('Veuillez entrer un numéro de téléphone valide au format +225XXXXXXXX');
        }
        const { error: authError } = await supabase.auth.signInWithOtp({
          phone: cleaned,
        });
        if (authError) throw authError;
        setStep('otp');
        setSuccess('Code OTP envoyé. Veuillez le saisir.');
      } else if (step === 'otp') {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          phone: phoneNumber.replace(/\s/g, ''),
          token: otp,
          type: 'sms',
        });
        if (verifyError) throw verifyError;
        // OTP verified, now ensure merchant profile exists
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error('Utilisateur non trouvé');

        // Check if merchant profile exists
        const { data: merchantExists, error: merchantCheckError } = await supabase
          .from('merchants')
          .select('id')
          .eq('phone_number', phoneNumber.replace(/\s/g, ''))
          .single();

        if (merchantCheckError && merchantCheckError.code !== 'PGRST116') {
          throw merchantCheckError;
        }

        if (!merchantExists) {
          // Create merchant profile
          const { error: insertError } = await supabase
            .from('merchants')
            .insert({
              id: userId,
              phone_number: phoneNumber.replace(/\s/g, ''),
              shop_name: `Boutique de ${userData.user?.email?.split('@')[0] ?? 'Utilisateur'}`,
            });

          if (insertError) throw insertError;
        }

        setSuccess('Connexion réussie ! Redirection...');
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Carnet de Crédit Numérique
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'phone' ? (
            <>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Numéro de téléphone
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+225 XX XX XX XX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full"
                autoComplete="tel"
              />
            </>
          ) : (
            <>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                Code OTP à 6 chiffres
              </label>
              <Input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full"
                autoComplete="one-time-code"
              />
            </>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Vérification...' : step === 'phone' ? 'Envoyer le code' : 'Vérifier le code'}
          </Button>
        </form>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600">{success}</p>
        )}
        <p className="text-xs text-gray-500 text-center">
          Une fois connecté, vous pourrez gérer vos clients et transactions hors-ligne.
        </p>
      </div>
    </div>
  );
}
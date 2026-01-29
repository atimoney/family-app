import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { useSearchParams } from 'src/routes/hooks';

import { Iconify } from 'src/components/iconify';
import { Form, Field, schemaUtils, zodResolver } from 'src/components/hook-form';

import { useAuthContext } from '../../hooks';
import { getErrorMessage } from '../../utils';
import { FormHead } from '../../components/form-head';
import { signInWithGoogle, signInWithPassword } from '../../context/supabase';

// ----------------------------------------------------------------------

export const SignInSchema = z.object({
  email: schemaUtils.email(),
  password: z
    .string()
    .min(1, { message: 'Password is required!' }),
});

export type SignInSchemaType = z.infer<typeof SignInSchema>;

// ----------------------------------------------------------------------

export function SupabaseSignInView() {
  const { loading: authLoading, checkUserSession } = useAuthContext();

  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const password = useBoolean();
  const showEmailForm = useBoolean();
  const isGoogleLoading = useBoolean();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultValues: SignInSchemaType = {
    email: '',
    password: '',
  };

  const methods = useForm<SignInSchemaType>({
    resolver: zodResolver(SignInSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      setErrorMessage(null);

      const { error } = await signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await checkUserSession?.();
    } catch (error) {
      console.error(error);
      const feedbackMessage = getErrorMessage(error);
      setErrorMessage(feedbackMessage);
    }
  });

  const handleGoogleSignIn = async () => {
    try {
      setErrorMessage(null);
      isGoogleLoading.onTrue();

      // Pass returnTo path for redirect after OAuth
      await signInWithGoogle(returnTo || undefined);

      // Note: The page will redirect to Google, so we won't reach here
      // The loading state will remain true until redirect
    } catch (error) {
      console.error(error);
      const feedbackMessage = getErrorMessage(error);
      setErrorMessage(feedbackMessage);
      isGoogleLoading.onFalse();
    }
  };

  // Show splash while auth is initializing
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <FormHead
        title="Sign in to Family Hub"
        description="Enter your credentials to continue"
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column', mb: 3 }}>
        <Button
          fullWidth
          size="large"
          variant="outlined"
          color="inherit"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading.value || isSubmitting}
          startIcon={
            isGoogleLoading.value ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <Iconify width={24} icon="socials:google" />
            )
          }
        >
          {isGoogleLoading.value ? 'Redirecting...' : 'Continue with Google'}
        </Button>
      </Box>

      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          color="text.secondary"
          onClick={showEmailForm.onToggle}
          sx={{ cursor: 'pointer' }}
        >
          {showEmailForm.value ? 'Hide email sign in' : 'Sign in with email and password'}
        </Link>
      </Box>

      <Collapse in={showEmailForm.value}>
        <Form methods={methods} onSubmit={onSubmit}>
          <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
            <Field.Text
              name="email"
              label="Email address"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Text
              name="password"
              label="Password"
              type={password.value ? 'text' : 'password'}
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={password.onToggle} edge="end">
                        <Iconify icon={password.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <LoadingButton
              fullWidth
              color="inherit"
              size="large"
              type="submit"
              variant="contained"
              loading={isSubmitting}
              loadingIndicator="Signing in..."
            >
              Sign in
            </LoadingButton>
          </Box>
        </Form>
      </Collapse>
    </>
  );
}

import type { InviteValidation } from '@family/shared';

import { varAlpha } from 'minimal-shared/utils';
import { useParams, useNavigate } from 'react-router';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { useInviteValidation } from 'src/features/family';
import { acceptInvite, declineInvite } from 'src/features/family/api';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function InviteAcceptView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { authenticated, loading: authLoading } = useAuthContext();

  const { validation, loading: validating } = useInviteValidation(token ?? null);
  const [processing, setProcessing] = useState(false);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!authLoading && !authenticated && validation && validation.valid) {
      // Store the invite token and redirect to sign-in
      sessionStorage.setItem('pendingInviteToken', token || '');
      navigate(paths.auth.supabase.signIn, { replace: true });
    }
  }, [authLoading, authenticated, validation, token, navigate]);

  // Check for pending invite after sign-in
  useEffect(() => {
    if (authenticated && !token) {
      const pendingToken = sessionStorage.getItem('pendingInviteToken');
      if (pendingToken) {
        navigate(`/invite/${pendingToken}`, { replace: true });
      }
    }
  }, [authenticated, token, navigate]);

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setProcessing(true);
    try {
      await acceptInvite(token);
      sessionStorage.removeItem('pendingInviteToken');
      toast.success(`Welcome to ${validation?.familyName}!`);
      navigate('/family', { replace: true });
    } catch (err) {
      console.error('Failed to accept invite:', err);
      toast.error('Failed to accept invite');
    } finally {
      setProcessing(false);
    }
  }, [token, validation?.familyName, navigate]);

  const handleDecline = useCallback(async () => {
    if (!token) return;
    setProcessing(true);
    try {
      await declineInvite(token);
      sessionStorage.removeItem('pendingInviteToken');
      toast.info('Invite declined');
      navigate('/family', { replace: true });
    } catch (err) {
      console.error('Failed to decline invite:', err);
      toast.error('Failed to decline invite');
    } finally {
      setProcessing(false);
    }
  }, [token, navigate]);

  // Loading state
  if (validating || authLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Validating invite...
          </Typography>
        </Stack>
      </Box>
    );
  }

  // No token
  if (!token) {
    return <InviteErrorState message="Invalid invite link" />;
  }

  // Invalid or error
  if (!validation || !validation.valid) {
    const errorMessage = getErrorMessage(validation);
    return <InviteErrorState message={errorMessage} validation={validation} />;
  }

  // Not authenticated
  if (!authenticated) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Card sx={{ maxWidth: 420, width: '100%', p: 4 }}>
          <Stack alignItems="center" spacing={3}>
            <Iconify icon="solar:users-group-rounded-bold-duotone" width={64} sx={{ color: 'primary.main' }} />
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom>
                Join {validation.familyName}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Sign in or create an account to accept this invitation
              </Typography>
            </Box>

            <Label variant="soft" color="info">
              as {validation.role}
            </Label>

            <Button
              fullWidth
              size="large"
              variant="contained"
              onClick={() => navigate(paths.auth.supabase.signIn)}
            >
              Sign In to Continue
            </Button>
          </Stack>
        </Card>
      </Box>
    );
  }

  // Valid invite, authenticated user
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Card sx={{ maxWidth: 420, width: '100%', p: 4 }}>
        <Stack alignItems="center" spacing={3}>
          <Iconify icon="solar:users-group-rounded-bold-duotone" width={64} sx={{ color: 'primary.main' }} />
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              Join {validation.familyName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              You&apos;ve been invited to join this family
            </Typography>
          </Box>

          <Box
            sx={[
              (theme) => ({
                p: 2,
                borderRadius: 1.5,
                bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                border: `1px solid ${varAlpha(theme.vars.palette.primary.mainChannel, 0.16)}`,
                width: '100%',
              }),
            ]}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Family
                </Typography>
                <Typography variant="subtitle2">{validation.familyName}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Your Role
                </Typography>
                <Label
                  variant="soft"
                  color={validation.role === 'admin' ? 'info' : 'default'}
                >
                  {validation.role === 'admin' ? 'Admin' : 'Member'}
                </Label>
              </Stack>
              {validation.email && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Invite for
                  </Typography>
                  <Typography variant="body2">{validation.email}</Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            By accepting, you&apos;ll gain access to the family&apos;s shared calendars, tasks, shopping lists, and more.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              onClick={handleDecline}
              disabled={processing}
            >
              Decline
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleAccept}
              disabled={processing}
              startIcon={processing ? <CircularProgress size={16} /> : undefined}
            >
              {processing ? 'Joining...' : 'Accept & Join'}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}

// ----------------------------------------------------------------------

function getErrorMessage(validation: InviteValidation | null): string {
  if (!validation) return 'Invalid invite link';
  
  switch (validation.reason) {
    case 'not_found':
      return 'This invite link is invalid or has been revoked';
    case 'expired':
      return 'This invite has expired';
    case 'already_used':
      return 'This invite has already been used';
    case 'email_mismatch':
      return 'This invite was sent to a different email address';
    case 'already_member':
      return 'You are already a member of this family';
    default:
      return 'Invalid invite';
  }
}

// ----------------------------------------------------------------------

type InviteErrorStateProps = {
  message: string;
  validation?: InviteValidation | null;
};

function InviteErrorState({ message, validation }: InviteErrorStateProps) {
  const navigate = useNavigate();

  const getIcon = () => {
    if (!validation) return 'solar:danger-triangle-bold';
    
    switch (validation.reason) {
      case 'expired':
        return 'solar:clock-circle-bold';
      case 'already_member':
        return 'solar:check-circle-bold';
      case 'email_mismatch':
        return 'solar:letter-bold';
      default:
        return 'solar:danger-triangle-bold';
    }
  };

  const getColor = () => {
    if (!validation) return 'error';
    if (validation.reason === 'already_member') return 'success';
    if (validation.reason === 'expired') return 'warning';
    return 'error';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Card sx={{ maxWidth: 420, width: '100%', p: 4 }}>
        <Stack alignItems="center" spacing={3}>
          <Iconify
            icon={getIcon() as any}
            width={64}
            sx={{ color: `${getColor()}.main` }}
          />
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              {validation?.reason === 'already_member' ? 'Already a Member' : 'Invalid Invite'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {message}
            </Typography>
          </Box>

          {validation?.familyName && (
            <Typography variant="body2">
              Family: <strong>{validation.familyName}</strong>
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate('/family')}
          >
            Go to Dashboard
          </Button>

          {validation?.reason === 'email_mismatch' && (
            <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Please sign in with the email address the invite was sent to, or ask for a new invite.
            </Typography>
          )}
        </Stack>
      </Card>
    </Box>
  );
}

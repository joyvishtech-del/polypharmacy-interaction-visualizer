import {
  Alert,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Link,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { authService } from '../services/authService';

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

const resetSchema = z
  .object({
    new_password: passwordField,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>();

  const onSubmit = async (raw: ResetFormValues): Promise<void> => {
    const parsed = resetSchema.safeParse(raw);
    if (!parsed.success) {
      toast({
        title: 'Invalid input',
        description: parsed.error.issues[0]?.message ?? 'Check the form',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      return;
    }
    try {
      await authService.resetPassword({
        token,
        new_password: parsed.data.new_password,
      });
      toast({
        title: 'Password updated',
        description: 'You can now log in with your new password.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Reset failed'
        : 'Unexpected error';
      toast({
        title: 'Reset failed',
        description: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <PageWrapper>
      <VStack spacing={6} py={{ base: 8, md: 12 }} align="center">
        <Heading
          as="h1"
          size="xl"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
        >
          Choose a new password
        </Heading>

        {!token && (
          <Alert status="error" maxW="md" borderRadius="md">
            <AlertIcon />
            Missing or invalid reset token. Please use the link from your email.
          </Alert>
        )}

        <GlassCard hoverable={false} maxW="md" w="100%">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <VStack spacing={4} align="stretch">
              <FormControl isInvalid={Boolean(errors.new_password)}>
                <FormLabel htmlFor="reset-new-password">New password</FormLabel>
                <Input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  {...register('new_password', {
                    required: 'Password is required',
                    validate: (v) =>
                      passwordField.safeParse(v).success ||
                      'Password must be at least 8 characters',
                  })}
                />
                <FormErrorMessage>{errors.new_password?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={Boolean(errors.confirm_password)}>
                <FormLabel htmlFor="reset-confirm-password">
                  Confirm password
                </FormLabel>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  {...register('confirm_password', {
                    required: 'Please confirm your password',
                  })}
                />
                <FormErrorMessage>
                  {errors.confirm_password?.message}
                </FormErrorMessage>
              </FormControl>

              <GradientButton
                type="submit"
                isLoading={isSubmitting}
                isDisabled={!token}
                w="100%"
              >
                Reset password
              </GradientButton>
            </VStack>
          </form>
        </GlassCard>

        <Text fontSize="sm" color="gray.600">
          <Link as={RouterLink} to="/login" color="purple.500" fontWeight="medium">
            Back to login
          </Link>
        </Text>
      </VStack>
    </PageWrapper>
  );
}

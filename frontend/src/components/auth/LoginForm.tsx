import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  VStack,
  useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo = '/profile' }: LoginFormProps): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>();

  const onSubmit = async (raw: LoginFormValues): Promise<void> => {
    const parsed = loginSchema.safeParse(raw);
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
      await login(parsed.data.email, parsed.data.password);
      toast({
        title: 'Welcome back',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Login failed'
        : 'Unexpected error';
      toast({
        title: 'Login failed',
        description: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <GlassCard hoverable={false} maxW="md" w="100%">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <VStack spacing={4} align="stretch">
          <FormControl isInvalid={Boolean(errors.email)}>
            <FormLabel htmlFor="login-email">Email</FormLabel>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              {...register('email', {
                required: 'Email is required',
                validate: (v) =>
                  loginSchema.shape.email.safeParse(v).success ||
                  'Enter a valid email address',
              })}
            />
            <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
          </FormControl>

          <FormControl isInvalid={Boolean(errors.password)}>
            <FormLabel htmlFor="login-password">Password</FormLabel>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              {...register('password', {
                required: 'Password is required',
                validate: (v) =>
                  loginSchema.shape.password.safeParse(v).success ||
                  'Password must be at least 8 characters',
              })}
            />
            <FormErrorMessage>{errors.password?.message}</FormErrorMessage>
          </FormControl>

          <GradientButton type="submit" isLoading={isSubmitting} w="100%">
            Log in
          </GradientButton>
        </VStack>
      </form>
    </GlassCard>
  );
}

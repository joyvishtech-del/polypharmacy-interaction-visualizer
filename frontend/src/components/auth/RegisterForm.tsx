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

const registerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  redirectTo?: string;
}

export function RegisterForm({
  redirectTo = '/profile',
}: RegisterFormProps): JSX.Element {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>();

  const onSubmit = async (raw: RegisterFormValues): Promise<void> => {
    const parsed = registerSchema.safeParse(raw);
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
      await registerUser(
        parsed.data.email,
        parsed.data.password,
        parsed.data.full_name
      );
      toast({
        title: 'Account created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Registration failed'
        : 'Unexpected error';
      toast({
        title: 'Registration failed',
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
          <FormControl isInvalid={Boolean(errors.full_name)}>
            <FormLabel htmlFor="register-name">Full name</FormLabel>
            <Input
              id="register-name"
              type="text"
              autoComplete="name"
              {...register('full_name', {
                required: 'Full name is required',
                validate: (v) =>
                  registerSchema.shape.full_name.safeParse(v).success ||
                  'Full name is required',
              })}
            />
            <FormErrorMessage>{errors.full_name?.message}</FormErrorMessage>
          </FormControl>

          <FormControl isInvalid={Boolean(errors.email)}>
            <FormLabel htmlFor="register-email">Email</FormLabel>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              {...register('email', {
                required: 'Email is required',
                validate: (v) =>
                  registerSchema.shape.email.safeParse(v).success ||
                  'Enter a valid email address',
              })}
            />
            <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
          </FormControl>

          <FormControl isInvalid={Boolean(errors.password)}>
            <FormLabel htmlFor="register-password">Password</FormLabel>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              {...register('password', {
                required: 'Password is required',
                validate: (v) =>
                  registerSchema.shape.password.safeParse(v).success ||
                  'Password must be at least 8 characters',
              })}
            />
            <FormErrorMessage>{errors.password?.message}</FormErrorMessage>
          </FormControl>

          <GradientButton type="submit" isLoading={isSubmitting} w="100%">
            Create account
          </GradientButton>
        </VStack>
      </form>
    </GlassCard>
  );
}

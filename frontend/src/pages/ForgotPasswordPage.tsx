import {
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
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { z } from 'zod';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { authService } from '../services/authService';

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage(): JSX.Element {
  const [submitted, setSubmitted] = useState<boolean>(false);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>();

  const onSubmit = async (raw: ForgotFormValues): Promise<void> => {
    const parsed = forgotSchema.safeParse(raw);
    if (!parsed.success) {
      toast({
        title: 'Invalid email',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    try {
      await authService.forgotPassword({ email: parsed.data.email });
      setSubmitted(true);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Could not send reset email'
        : 'Unexpected error';
      toast({
        title: 'Request failed',
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
          Reset your password
        </Heading>
        <Text color="gray.600" textAlign="center" maxW="md">
          Enter your email and we'll send a link to reset your password.
        </Text>

        <GlassCard hoverable={false} maxW="md" w="100%">
          {submitted ? (
            <VStack spacing={3} align="stretch">
              <Heading as="h2" size="md">
                Check your inbox
              </Heading>
              <Text color="gray.600">
                If an account exists for that email, a reset link is on its way.
              </Text>
            </VStack>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <VStack spacing={4} align="stretch">
                <FormControl isInvalid={Boolean(errors.email)}>
                  <FormLabel htmlFor="forgot-email">Email</FormLabel>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    {...register('email', {
                      required: 'Email is required',
                      validate: (v) =>
                        forgotSchema.shape.email.safeParse(v).success ||
                        'Enter a valid email address',
                    })}
                  />
                  <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
                </FormControl>
                <GradientButton type="submit" isLoading={isSubmitting} w="100%">
                  Send reset link
                </GradientButton>
              </VStack>
            </form>
          )}
        </GlassCard>

        <Text fontSize="sm" color="gray.600">
          Remembered it?{' '}
          <Link as={RouterLink} to="/login" color="purple.500" fontWeight="medium">
            Back to login
          </Link>
        </Text>
      </VStack>
    </PageWrapper>
  );
}

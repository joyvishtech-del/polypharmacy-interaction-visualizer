import {
  Badge,
  Center,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Heading,
  Input,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { useAuth } from '../hooks/useAuth';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(120),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfilePage(): JSX.Element {
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileFormValues>({
    defaultValues: { full_name: user?.full_name ?? '' },
  });

  if (!user) {
    return (
      <PageWrapper>
        <Center minH="40vh">
          <Spinner size="xl" color="purple.500" thickness="3px" />
        </Center>
      </PageWrapper>
    );
  }

  const onSubmit = async (raw: ProfileFormValues): Promise<void> => {
    const parsed = profileSchema.safeParse(raw);
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
      await updateProfile({ full_name: parsed.data.full_name });
      reset({ full_name: parsed.data.full_name });
      toast({
        title: 'Profile updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Update failed'
        : 'Unexpected error';
      toast({
        title: 'Update failed',
        description: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <PageWrapper>
      <VStack spacing={6} align="stretch" maxW="3xl" mx="auto">
        <Heading
          as="h1"
          size="xl"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
        >
          Your profile
        </Heading>

        <GlassCard hoverable={false}>
          <VStack spacing={4} align="stretch">
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Stat>
                <StatLabel>Email</StatLabel>
                <StatNumber fontSize="md">{user.email}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Role</StatLabel>
                <HStack>
                  <Badge
                    colorScheme={user.role === 'admin' ? 'purple' : 'gray'}
                    textTransform="capitalize"
                  >
                    {user.role}
                  </Badge>
                  {user.is_verified ? (
                    <Badge colorScheme="green">Verified</Badge>
                  ) : (
                    <Badge colorScheme="yellow">Unverified</Badge>
                  )}
                </HStack>
              </Stat>
            </SimpleGrid>

            <Divider />

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <VStack spacing={4} align="stretch">
                <FormControl isInvalid={Boolean(errors.full_name)}>
                  <FormLabel htmlFor="profile-full-name">Full name</FormLabel>
                  <Input
                    id="profile-full-name"
                    type="text"
                    autoComplete="name"
                    {...register('full_name', {
                      required: 'Full name is required',
                      validate: (v) =>
                        profileSchema.shape.full_name.safeParse(v).success ||
                        'Full name is required',
                    })}
                  />
                  <FormErrorMessage>{errors.full_name?.message}</FormErrorMessage>
                </FormControl>

                <HStack justify="flex-end">
                  <GradientButton
                    type="submit"
                    isLoading={isSubmitting}
                    isDisabled={!isDirty}
                  >
                    Save changes
                  </GradientButton>
                </HStack>
              </VStack>
            </form>

            <Divider />

            <Text fontSize="sm" color="gray.500">
              Member since {new Date(user.created_at).toLocaleDateString()}
            </Text>
          </VStack>
        </GlassCard>
      </VStack>
    </PageWrapper>
  );
}

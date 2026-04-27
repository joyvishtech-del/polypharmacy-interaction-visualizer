import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Button,
  Divider,
  HStack,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const DELETE_ACCOUNT_PATH = '/auth/me';

export function SettingsPage(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await api.delete(DELETE_ACCOUNT_PATH);
      toast({
        title: 'Account deleted',
        description: 'Your account has been removed.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      await logout();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 404 || status === 405 || status === 501) {
        toast({
          title: 'Coming soon',
          description:
            'Account deletion is not yet available. Please contact support to remove your account.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      } else {
        const detail = axios.isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail
          : undefined;
        toast({
          title: 'Could not delete account',
          description: detail ?? 'Please try again later.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  if (!user) {
    return (
      <PageWrapper>
        <VStack py={20}>
          <Text>Loading…</Text>
        </VStack>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <VStack spacing={6} align="stretch" maxW="3xl" mx="auto">
        <VStack spacing={1} align="flex-start">
          <Heading
            as="h1"
            size="xl"
            bgGradient="linear(to-r, brand.500, pink.500)"
            bgClip="text"
          >
            Settings
          </Heading>
          <Text color="gray.500">
            Manage your account preferences and session.
          </Text>
        </VStack>

        <GlassCard hoverable={false}>
          <VStack align="stretch" spacing={4}>
            <Heading as="h2" size="md">
              Account
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Stat>
                <StatLabel>Email</StatLabel>
                <StatNumber fontSize="md" wordBreak="break-all">
                  {user.email}
                </StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Role</StatLabel>
                <HStack mt={1}>
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
            <Text fontSize="sm" color="gray.500">
              Member since {new Date(user.created_at).toLocaleDateString()}
            </Text>
          </VStack>
        </GlassCard>

        <GlassCard hoverable={false}>
          <VStack align="stretch" spacing={4}>
            <Heading as="h2" size="md">
              Session
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Sign out of this device. You can sign back in any time.
            </Text>
            <HStack justify="flex-end">
              <GradientButton
                onClick={handleLogout}
                isLoading={isLoggingOut}
                aria-label="Log out"
              >
                Log out
              </GradientButton>
            </HStack>
          </VStack>
        </GlassCard>

        <GlassCard hoverable={false}>
          <VStack align="stretch" spacing={4}>
            <Heading as="h2" size="md" color="red.500">
              Danger zone
            </Heading>
            <Divider />
            <Text fontSize="sm" color="gray.500">
              Permanently delete your account, medications, and analysis
              history. This cannot be undone.
            </Text>
            <HStack justify="flex-end">
              <Button
                colorScheme="red"
                variant="outline"
                onClick={onOpen}
                aria-label="Delete account"
              >
                Delete account
              </Button>
            </HStack>
          </VStack>
        </GlassCard>
      </VStack>

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete account
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure? All medications, analyses, and personal data tied to{' '}
              <strong>{user.email}</strong> will be permanently removed. This
              action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                onClick={onClose}
                isDisabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleConfirmDelete}
                ml={3}
                isLoading={isDeleting}
              >
                Yes, delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </PageWrapper>
  );
}

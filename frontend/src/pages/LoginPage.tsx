import { Heading, Link, Text, VStack } from '@chakra-ui/react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { PageWrapper } from '../components/layout/PageWrapper';

interface LocationState {
  from?: { pathname?: string };
}

export function LoginPage(): JSX.Element {
  const location = useLocation();
  const state = location.state as LocationState | null;
  const redirectTo = state?.from?.pathname ?? '/dashboard';

  return (
    <PageWrapper>
      <VStack spacing={6} py={{ base: 8, md: 12 }} align="center">
        <Heading
          as="h1"
          size="xl"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
        >
          Welcome back
        </Heading>
        <Text color="gray.600">Log in to your Polypharmacy Visualizer account.</Text>
        <LoginForm redirectTo={redirectTo} />
        <VStack spacing={1} fontSize="sm">
          <Text color="gray.600">
            Need an account?{' '}
            <Link as={RouterLink} to="/register" color="purple.500" fontWeight="medium">
              Create one
            </Link>
          </Text>
          <Link
            as={RouterLink}
            to="/forgot-password"
            color="purple.500"
            fontWeight="medium"
          >
            Forgot your password?
          </Link>
        </VStack>
      </VStack>
    </PageWrapper>
  );
}

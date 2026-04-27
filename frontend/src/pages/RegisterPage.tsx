import { Heading, Link, Text, VStack } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm';
import { PageWrapper } from '../components/layout/PageWrapper';

export function RegisterPage(): JSX.Element {
  return (
    <PageWrapper>
      <VStack spacing={6} py={{ base: 8, md: 12 }} align="center">
        <Heading
          as="h1"
          size="xl"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
        >
          Create your account
        </Heading>
        <Text color="gray.600" textAlign="center" maxW="md">
          Save your medications and review past interaction analyses securely.
        </Text>
        <RegisterForm />
        <Text fontSize="sm" color="gray.600">
          Already have an account?{' '}
          <Link as={RouterLink} to="/login" color="purple.500" fontWeight="medium">
            Log in
          </Link>
        </Text>
      </VStack>
    </PageWrapper>
  );
}

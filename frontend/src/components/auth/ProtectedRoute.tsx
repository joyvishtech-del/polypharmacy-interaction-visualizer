import { Center, Spinner } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Gate that renders its children only for authenticated users. While the
 * AuthProvider is hydrating from localStorage we render a spinner so we
 * don't bounce a soon-to-be-authenticated user to /login.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" color="purple.500" thickness="3px" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the axios module BEFORE importing anything that pulls in services/api.
vi.mock('axios', () => {
  const instance = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn(),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };

  const axiosMock = {
    create: vi.fn(() => instance),
    isAxiosError: (e: unknown) =>
      typeof e === 'object' && e !== null && 'isAxiosError' in e,
    get: vi.fn(),
    post: vi.fn(),
  };

  return {
    default: axiosMock,
    ...axiosMock,
    __instance: instance,
  };
});

import axios from 'axios';
import { authService } from '../../services/authService';
import { AuthProvider } from '../../context/AuthContext';
import { LoginPage } from '../../pages/LoginPage';

function renderPage() {
  return render(
    <ChakraProvider>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    // Reset the shared axios-instance mocks between tests.
    const inst = (axios as unknown as { __instance: { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } }).__instance;
    inst.post.mockReset();
    inst.get.mockReset();
    localStorage.clear();
  });

  it('renders email + password fields and a submit button', async () => {
    renderPage();
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('calls authService.login on submit with valid credentials', async () => {
    const spy = vi
      .spyOn(authService, 'login')
      .mockResolvedValue({
        access_token: 'a',
        token_type: 'bearer',
      });
    vi.spyOn(authService, 'me').mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      full_name: null,
      is_active: true,
      is_verified: false,
      role: 'user',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    });

    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });
});

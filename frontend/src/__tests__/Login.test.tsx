import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '@/components/Login'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockSignIn = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: '/signin' }),
  }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    user: null,
    profile: null,
    loading: false,
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and password inputs and the submit button', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/your password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders a link to /signup for new users', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /create one free/i })).toHaveAttribute('href', '/signup')
  })

  it('calls signIn with the entered email and password', async () => {
    mockSignIn.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'alice@example.com')
    await user.type(screen.getByPlaceholderText(/your password/i), 'Secret@99')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('alice@example.com', 'Secret@99')
    })
  })

  it('shows an error message when signIn returns an error', async () => {
    mockSignIn.mockResolvedValueOnce({ error: new Error('Invalid email or password') })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'bad@example.com')
    await user.type(screen.getByPlaceholderText(/your password/i), 'WrongPass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  it('shows a generic error for non-credential errors', async () => {
    mockSignIn.mockResolvedValueOnce({ error: new Error('Service unavailable') })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'a@b.com')
    await user.type(screen.getByPlaceholderText(/your password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument()
    })
  })

  it('shows an error and does not call signIn when email is empty', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText(/your password/i), 'somepass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('shows an error and does not call signIn when password is empty', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'a@b.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('disables the submit button while signing in', async () => {
    // Simulate slow network
    mockSignIn.mockImplementationOnce(() => new Promise(() => {}))
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'a@b.com')
    await user.type(screen.getByPlaceholderText(/your password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
  })

  it('toggles password visibility with the eye button', async () => {
    const user = userEvent.setup()
    renderLogin()

    const pwdInput = screen.getByPlaceholderText(/your password/i)
    expect(pwdInput).toHaveAttribute('type', 'password')

    const toggleBtn = pwdInput.closest('div')!.querySelector('button')!
    await user.click(toggleBtn)
    expect(pwdInput).toHaveAttribute('type', 'text')

    await user.click(toggleBtn)
    expect(pwdInput).toHaveAttribute('type', 'password')
  })
})

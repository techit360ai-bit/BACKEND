import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Signup from '@/components/SignUp'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockSignUp = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSignup() {
  return render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>,
  )
}

async function fillStep1(user: ReturnType<typeof userEvent.setup>, first = 'Alice', last = 'Smith') {
  await user.type(screen.getByPlaceholderText(/first name/i), first)
  await user.type(screen.getByPlaceholderText(/last name/i), last)
  await user.click(screen.getByRole('button', { name: /continue/i }))
}

async function fillStep2(user: ReturnType<typeof userEvent.setup>, email = 'alice@example.com') {
  await user.type(screen.getByPlaceholderText(/email address/i), email)
  await user.click(screen.getByRole('button', { name: /continue/i }))
}

const STRONG_PASSWORD = 'Secret@99!'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Step 1 ─────────────────────────────────────────────────────────────────

  describe('Step 1 — Your Details', () => {
    it('renders first and last name inputs', () => {
      renderSignup()
      expect(screen.getByPlaceholderText(/first name/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/last name/i)).toBeInTheDocument()
    })

    it('Continue button is disabled when fields are empty', () => {
      renderSignup()
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    })

    it('Continue becomes enabled when both names are at least 2 chars', async () => {
      const user = userEvent.setup()
      renderSignup()
      await user.type(screen.getByPlaceholderText(/first name/i), 'Al')
      await user.type(screen.getByPlaceholderText(/last name/i), 'Bo')
      expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
    })

    it('shows inline validation when name is too short', async () => {
      const user = userEvent.setup()
      renderSignup()
      await user.type(screen.getByPlaceholderText(/first name/i), 'A')
      expect(screen.getByText(/minimum 2 characters/i)).toBeInTheDocument()
    })

    it('advances to step 2 on valid names', async () => {
      const user = userEvent.setup()
      renderSignup()
      await fillStep1(user)
      await waitFor(() => {
        expect(screen.getByText(/step 02/i)).toBeInTheDocument()
      })
    })
  })

  // ── Step 2 ─────────────────────────────────────────────────────────────────

  describe('Step 2 — Role & Email', () => {
    it('shows all four role options', async () => {
      const user = userEvent.setup()
      renderSignup()
      await fillStep1(user)

      expect(screen.getByText('Founder')).toBeInTheDocument()
      expect(screen.getByText('Collaborator')).toBeInTheDocument()
      expect(screen.getByText('Investor')).toBeInTheDocument()
      expect(screen.getByText('Organisation')).toBeInTheDocument()
    })

    it('shows email input', async () => {
      const user = userEvent.setup()
      renderSignup()
      await fillStep1(user)
      expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument()
    })

    it('Continue disabled for invalid email', async () => {
      const user = userEvent.setup()
      renderSignup()
      await fillStep1(user)
      await user.type(screen.getByPlaceholderText(/email address/i), 'not-an-email')
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    })

    it('shows email validation error for invalid format', async () => {
      const user = userEvent.setup()
      renderSignup()
      await fillStep1(user)
      await user.type(screen.getByPlaceholderText(/email address/i), 'bad')
      expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    })

    it('advances to step 3 with valid email', async () => {
      const user = userEvent.setup()
      renderSignup()
      await fillStep1(user)
      await fillStep2(user)
      await waitFor(() => {
        expect(screen.getByText(/step 03/i)).toBeInTheDocument()
      })
    })

    it('Back button returns to step 1', async () => {
      const user = userEvent.setup()
      renderSignup()
      await fillStep1(user)
      const backBtn = screen.getByRole('button', { name: '' }) // back arrow
      await user.click(backBtn)
      expect(screen.getByText(/step 01/i)).toBeInTheDocument()
    })
  })

  // ── Step 3 ─────────────────────────────────────────────────────────────────

  describe('Step 3 — Password', () => {
    async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
      renderSignup()
      await fillStep1(user)
      await fillStep2(user)
      await waitFor(() => screen.getByText(/step 03/i))
    }

    it('shows password and confirm password inputs', async () => {
      const user = userEvent.setup()
      await goToStep3(user)
      const inputs = screen.getAllByPlaceholderText(/password/i)
      expect(inputs.length).toBeGreaterThanOrEqual(2)
    })

    it('shows password strength errors when password is weak', async () => {
      const user = userEvent.setup()
      await goToStep3(user)
      await user.type(screen.getByPlaceholderText(/password \(min/i), 'weak')
      expect(screen.getByText(/password must contain/i)).toBeInTheDocument()
    })

    it('shows mismatch error when passwords differ', async () => {
      const user = userEvent.setup()
      await goToStep3(user)
      await user.type(screen.getByPlaceholderText(/password \(min/i), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText(/confirm password/i), 'Different@99!')
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    it('Create Account button is disabled without agreeing to terms', async () => {
      const user = userEvent.setup()
      await goToStep3(user)
      await user.type(screen.getByPlaceholderText(/password \(min/i), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText(/confirm password/i), STRONG_PASSWORD)
      // Terms not checked
      expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
    })

    it('calls signUp with correct data on valid submission', async () => {
      mockSignUp.mockResolvedValueOnce({ error: null })
      const user = userEvent.setup()
      await goToStep3(user)

      await user.type(screen.getByPlaceholderText(/password \(min/i), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText(/confirm password/i), STRONG_PASSWORD)

      // Check terms checkbox
      const checkbox = screen.getByText(/i agree to the/i).closest('label')!
        .querySelector('div')!
      await user.click(checkbox)

      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'alice@example.com',
            password: STRONG_PASSWORD,
            firstName: 'Alice',
            lastName: 'Smith',
            role: 'founder',
          }),
        )
      })
    })

    it('shows API error toast when signUp returns an error', async () => {
      mockSignUp.mockResolvedValueOnce({ error: new Error('Email already in use') })
      const user = userEvent.setup()
      await goToStep3(user)

      await user.type(screen.getByPlaceholderText(/password \(min/i), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText(/confirm password/i), STRONG_PASSWORD)
      const checkbox = screen.getByText(/i agree to the/i).closest('label')!
        .querySelector('div')!
      await user.click(checkbox)
      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText(/email already in use/i)).toBeInTheDocument()
      })
    })

    it('navigates to founder/setup after successful signup as founder', async () => {
      mockSignUp.mockResolvedValueOnce({ error: null })
      const user = userEvent.setup()
      await goToStep3(user)

      await user.type(screen.getByPlaceholderText(/password \(min/i), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText(/confirm password/i), STRONG_PASSWORD)
      const checkbox = screen.getByText(/i agree to the/i).closest('label')!
        .querySelector('div')!
      await user.click(checkbox)
      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/founder/setup')
      }, { timeout: 2000 })
    })
  })

  // ── "Already a member" link ────────────────────────────────────────────────

  it('renders a link to /signin for existing members', () => {
    renderSignup()
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin')
  })
})

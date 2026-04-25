import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- Mock data ----

const mockStudent = {
  id: '1',
  full_name: 'Test Student',
  chinese_name: '',
  class_name: '6A',
  class_number: 1,
  gender: 'M',
  graduated: false,
  is_graduated: false,
  year_of_study: 6,
  preferred_name: '',
  date_of_birth: '2008-05-15',
  address: '',
  phone: '',
  email: '',
  candidate_number: '',
  financial_aid_flag: false,
  preferred_language: 'en',
  personal_statement: '',
  created_at: '2024-01-01',
};

const mockAccount = {
  id: '1',
  username: 'admin',
  role: 'admin',
};

// ---- Mock all API modules used by StudentProfile ----
// vi.mock calls are hoisted to top of file by Vitest

const mockGetStudent = vi.fn();
const mockGraduateStudent = vi.fn();
vi.mock('../../api/students', () => ({
  getStudent: (...args) => mockGetStudent(...args),
  graduateStudent: (...args) => mockGraduateStudent(...args),
}));

const mockGetAccount = vi.fn();
vi.mock('../../api/account', () => ({
  getAccount: (...args) => mockGetAccount(...args),
}));

const mockGetGrades = vi.fn();
const mockCreateGrade = vi.fn();
const mockDeleteGrade = vi.fn();
const mockGetSubjects = vi.fn();
vi.mock('../../api/grades', () => ({
  getGrades: (...args) => mockGetGrades(...args),
  createGrade: (...args) => mockCreateGrade(...args),
  deleteGrade: (...args) => mockDeleteGrade(...args),
  getSubjects: (...args) => mockGetSubjects(...args),
}));

vi.mock('../../api/transcripts', () => ({
  uploadTranscript: vi.fn(),
  getTranscript: vi.fn(),
}));

vi.mock('../../api/plan', () => ({
  generatePlan: vi.fn(),
  getPlanHistory: vi.fn().mockResolvedValue([]),
  deletePlanHistory: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('not mocked')),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../api/schoolsV2', () => ({
  searchSchools: vi.fn().mockResolvedValue([]),
}));

// Mock useAuth to return authenticated admin
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { role: 'admin' }, token: 'test-token' }),
}));

// Import component AFTER mocks are defined
import StudentProfile from './StudentProfile';

// ---- Test helper ----

function renderWithProviders(ui, { route = '/students/1/profile' } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/students/:id/profile" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  });
}

// ---- Characterization Tests ----

describe('StudentProfile (characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStudent.mockResolvedValue(mockStudent);
    mockGetAccount.mockResolvedValue(mockAccount);
    mockGetSubjects.mockResolvedValue([]);
    mockGetGrades.mockResolvedValue([]);
  });

  test('renders student name in header', async () => {
    renderWithProviders(<StudentProfile />);

    const heading = await screen.findByText('Test Student');
    expect(heading).toBeInTheDocument();
  });

  test('renders all 7 tab labels', async () => {
    renderWithProviders(<StudentProfile />);

    // Wait for data to load
    await screen.findByText('Test Student');

    const tabLabels = ['Personal', 'Grades', 'Language', 'Teacher Evaluations', 'Activities', 'Notes', 'Plans'];
    for (const label of tabLabels) {
      const tab = screen.getByRole('tab', { name: label });
      expect(tab).toBeInTheDocument();
    }
  });

  test('Personal tab is active by default', async () => {
    renderWithProviders(<StudentProfile />);

    await screen.findByText('Test Student');

    const personalTab = screen.getByRole('tab', { name: 'Personal' });
    expect(personalTab).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking Grades tab switches active tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentProfile />);

    await screen.findByText('Test Student');

    const gradesTab = screen.getByRole('tab', { name: 'Grades' });
    await user.click(gradesTab);

    expect(gradesTab).toHaveAttribute('aria-selected', 'true');

    const personalTab = screen.getByRole('tab', { name: 'Personal' });
    expect(personalTab).toHaveAttribute('aria-selected', 'false');
  });

  test('shows loading state while data is fetching', () => {
    // Make getStudent hang (never resolve) so loading state persists
    mockGetStudent.mockReturnValue(new Promise(() => {}));
    mockGetAccount.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<StudentProfile />);

    const spinner = screen.getByText(/loading/i);
    expect(spinner).toBeInTheDocument();
  });

  test('tab switch does not trigger a page reload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentProfile />);

    await screen.findByText('Test Student');

    const gradesTab = screen.getByRole('tab', { name: 'Grades' });
    await user.click(gradesTab);

    // We are still on the student profile page — student name still visible
    expect(screen.getByText('Test Student')).toBeInTheDocument();
    // All tabs should still be present
    expect(screen.getByRole('tab', { name: 'Grades' })).toBeInTheDocument();
  });
});

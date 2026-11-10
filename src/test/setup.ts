import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Most tests describe the site after launch, so payments read as open.
// A test of the pre-launch behaviour overrides this with its own vi.mock.
vi.mock('../hooks/site/usePaymentsLive', () => ({ usePaymentsLive: () => true }));

// Global test setup — runs before every test file
import '@testing-library/jest-dom';

// Mock IntersectionObserver for components like FeedImpressionTracker
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

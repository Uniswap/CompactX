import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

// A simple counter component to test
const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(prev => prev + 1)}>Increment</button>
    </div>
  );
};

describe('Sample Tests', () => {
  it('renders counter with initial count', () => {
    render(<Counter />);
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });

  it('increments count when button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    
    const button = screen.getByText('Increment');
    await user.click(button);
    
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  // Basic test to verify test environment
  it('supports basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect({ name: 'test' }).toEqual({ name: 'test' });
    expect([1, 2, 3]).toContain(2);
  });
});

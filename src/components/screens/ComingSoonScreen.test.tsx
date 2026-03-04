import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComingSoonScreen } from './ComingSoonScreen';

describe('ComingSoonScreen', () => {
  it('renders game detail and returns to the menu', () => {
    const onBack = vi.fn();

    render(
      <ComingSoonScreen
        title="Vs."
        description="Face off in a fast musical showdown."
        onBack={onBack}
      />,
    );

    expect(screen.getByRole('heading', { name: /^vs\.$/i })).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.getByText(/musical showdown/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

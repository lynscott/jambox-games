import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsScreen } from './PermissionsScreen';

describe('PermissionsScreen', () => {
  it('shows permission checklist and continues when requested', () => {
    const onRequestPermissions = vi.fn();

    render(
      <PermissionsScreen
        cameraReady={false}
        audioReady={true}
        isBusy={false}
        onRequestPermissions={onRequestPermissions}
      />,
    );

    expect(screen.getByText('Camera', { selector: '.permission-name' })).toBeInTheDocument();
    expect(screen.getByText('Audio', { selector: '.permission-name' })).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enable camera \+ audio/i }));
    expect(onRequestPermissions).toHaveBeenCalledTimes(1);
  });
});

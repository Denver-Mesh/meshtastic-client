import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import NotificationToggle from './NotificationToggle';

describe('NotificationToggle', () => {
  it('shows mute label and aria-pressed=false when unmuted', () => {
    render(<NotificationToggle notifMuted={false} onToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /mute notifications/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows unmute label and aria-pressed=true when muted', () => {
    render(<NotificationToggle notifMuted={true} onToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /unmute notifications/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle(true) when clicked while unmuted', async () => {
    const onToggle = vi.fn();
    render(<NotificationToggle notifMuted={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /mute notifications/i }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('calls onToggle(false) when clicked while muted', async () => {
    const onToggle = vi.fn();
    render(<NotificationToggle notifMuted={true} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /unmute notifications/i }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

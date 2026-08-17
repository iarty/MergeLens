import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/features/command-palette/CommandPalette';
import { createCommandContext } from '@/features/command-palette/commands/context';
import { getCommandShortcut } from '@/features/command-palette';

const context = createCommandContext('https://github.com/facebook/react/pull/42')!;

const renderPalette = (overrides = {}) => {
  const props = {
    isOpen: true,
    context,
    onClose: vi.fn(),
    onExecute: vi.fn().mockResolvedValue(undefined),
    returnFocus: null,
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
};

describe('CommandPalette', () => {
  it('defines readable text colors independently from GitHub page styles', () => {
    const stylesheet = readFileSync(
      path.resolve(process.cwd(), 'features/command-palette/CommandPalette.css'),
      'utf8',
    );

    expect(stylesheet).toMatch(/\.command-palette\s*\{[^}]*color:\s*#1f2328/s);
    expect(stylesheet).toMatch(/\.command-palette__header h2\s*\{[^}]*color:\s*#1f2328/s);
    expect(stylesheet).toMatch(/\.command-palette__input\s*\{[^}]*color:\s*#1f2328/s);
    expect(stylesheet).toMatch(/\.command-palette__command\s*\{[^}]*color:\s*#1f2328/s);
  });

  it('renders an accessible dialog and available commands', async () => {
    renderPalette();

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Open current pull request' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
  });

  it('renders the configured opening shortcut as palette metadata', () => {
    renderPalette({ shortcut: getCommandShortcut('primary-shift-k')! });

    expect(screen.getByText('Ctrl / Cmd Shift K')).toBeVisible();
  });

  it('filters commands without exposing unavailable actions', () => {
    renderPalette({
      context: createCommandContext('https://github.com/settings/profile')!,
    });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'settings' } });
    expect(screen.getByRole('option', { name: 'Open MergeLens settings' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Open repository' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unmatched' } });
    expect(screen.getByRole('status')).toHaveTextContent('No commands found');
  });

  it('navigates with arrow keys and executes the selected command', async () => {
    const { onExecute } = renderPalette();
    const input = screen.getByRole('searchbox');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Open repository' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onExecute).toHaveBeenCalledWith('open-repository');
  });

  it('closes on Escape and backdrop click', () => {
    const { onClose } = renderPalette();

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('restores focus after closing', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const props = {
      isOpen: true,
      context,
      onClose: vi.fn(),
      onExecute: vi.fn().mockResolvedValue(undefined),
      returnFocus: opener,
    };
    const { rerender } = render(<CommandPalette {...props} />);

    rerender(<CommandPalette {...props} isOpen={false} />);

    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });
});

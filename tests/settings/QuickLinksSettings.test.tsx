import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickLinksSettings } from '@/features/settings/QuickLinksSettings'
import {
  readConfiguredQuickLinks,
  removeConfiguredQuickLink,
  saveConfiguredQuickLink,
} from '@/modules/quick-links/settings'

vi.mock('@/modules/quick-links/settings', () => ({
  readConfiguredQuickLinks: vi.fn(),
  removeConfiguredQuickLink: vi.fn(),
  saveConfiguredQuickLink: vi.fn(),
}))

const link = { id: 'docs', label: 'Docs', url: 'https://docs.example.com/' }

describe('QuickLinksSettings', () => {
  beforeEach(() => {
    vi.mocked(readConfiguredQuickLinks).mockResolvedValue([link])
    vi.mocked(saveConfiguredQuickLink).mockResolvedValue([link])
    vi.mocked(removeConfiguredQuickLink).mockResolvedValue([])
  })

  it('adds a validated project link', async () => {
    render(<QuickLinksSettings />)
    await screen.findByRole('link', { name: 'Docs' })
    fireEvent.change(screen.getByLabelText('Label'), {
      target: { value: 'Preview' },
    })
    fireEvent.change(screen.getByLabelText('HTTPS URL'), {
      target: { value: 'https://preview.example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }))
    await waitFor(() =>
      expect(saveConfiguredQuickLink).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Preview',
          url: 'https://preview.example.com/',
        }),
      ),
    )
  })

  it('supports edit and remove actions', async () => {
    render(<QuickLinksSettings />)
    const editButton = await screen.findByRole('button', { name: 'Edit Docs' })
    const removeButton = screen.getByRole('button', { name: 'Remove Docs' })

    expect(editButton.parentElement).toBe(removeButton.parentElement)
    expect(editButton.parentElement).toHaveClass(
      'quick-links-settings__actions',
    )

    fireEvent.click(editButton)
    expect(screen.getByLabelText('Label')).toHaveValue('Docs')
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }))
    await waitFor(() =>
      expect(saveConfiguredQuickLink).toHaveBeenCalledWith(link),
    )
    fireEvent.click(removeButton)
    await waitFor(() =>
      expect(removeConfiguredQuickLink).toHaveBeenCalledWith('docs'),
    )
  })
})

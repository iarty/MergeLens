import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReviewTemplatesSettings,
  type ReviewTemplatesTransport,
} from '@/features/settings/ReviewTemplatesSettings'
import {
  MAX_REVIEW_TEMPLATE_BODY_LENGTH,
  MAX_REVIEW_TEMPLATE_COUNT,
  MAX_REVIEW_TEMPLATE_TITLE_LENGTH,
  type ReviewTemplate,
} from '@/modules/local-review'

const createTemplate = (
  id: string,
  title: string,
  body = `${title} body`,
): ReviewTemplate => ({
  id,
  title,
  body,
  createdAt: '2026-08-14T01:00:00.000Z',
  updatedAt: '2026-08-14T01:00:00.000Z',
})

const alpha = createTemplate('alpha', 'Alpha')
const beta = createTemplate('beta', 'Beta')

const createTransport = (): ReviewTemplatesTransport => ({
  listTemplates: vi.fn().mockResolvedValue({
    status: 'success',
    correlationId: 'correlation-1',
    data: { templates: [] },
  }),
  upsertTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
})

const createCorrelationIds = () => {
  let sequence = 0
  return () => `correlation-${++sequence}`
}

describe('ReviewTemplatesSettings', () => {
  let transport: ReviewTemplatesTransport

  beforeEach(() => {
    transport = createTransport()
  })

  it('renders accessible loading and empty states', async () => {
    let resolveList:
      | ((
          value: Awaited<ReturnType<ReviewTemplatesTransport['listTemplates']>>,
        ) => void)
      | undefined
    vi.mocked(transport.listTemplates).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve
      }),
    )

    render(
      <ReviewTemplatesSettings
        transport={transport}
        nextCorrelationId={createCorrelationIds()}
      />,
    )

    expect(
      screen.getByRole('region', { name: 'Review templates' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading review templates',
    )
    expect(screen.getByLabelText('Title')).toBeDisabled()

    resolveList?.({
      status: 'success',
      correlationId: 'correlation-1',
      data: { templates: [] },
    })

    expect(await screen.findByText('No review templates yet.')).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Review templates' }),
    ).toHaveAttribute('aria-busy', 'false')
  })

  it('creates a template and renders the authoritative response order', async () => {
    vi.mocked(transport.upsertTemplate).mockResolvedValue({
      status: 'success',
      correlationId: 'correlation-2',
      data: { template: beta, templates: [alpha, beta] },
    })
    render(
      <ReviewTemplatesSettings
        transport={transport}
        nextCorrelationId={createCorrelationIds()}
      />,
    )
    await screen.findByText('No review templates yet.')

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Beta' },
    })
    fireEvent.change(screen.getByLabelText('Template content'), {
      target: { value: 'Beta body' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add template' }))

    await waitFor(() => {
      expect(transport.upsertTemplate).toHaveBeenCalledWith(
        { id: undefined, title: 'Beta', body: 'Beta body' },
        'correlation-2',
      )
    })
    const items = within(
      screen.getByRole('list', { name: 'Saved review templates' }),
    ).getAllByRole('listitem')
    expect(
      items.map((item) => item.querySelector('strong')?.textContent),
    ).toEqual(['Alpha', 'Beta'])
    expect(screen.getByLabelText('Title')).toHaveValue('')
  })

  it('edits an existing template and uses the mutation response as authority', async () => {
    vi.mocked(transport.listTemplates).mockResolvedValue({
      status: 'success',
      correlationId: 'correlation-1',
      data: { templates: [beta] },
    })
    const updated = createTemplate('beta', 'Updated', 'Updated body')
    vi.mocked(transport.upsertTemplate).mockResolvedValue({
      status: 'success',
      correlationId: 'correlation-2',
      data: { template: updated, templates: [updated] },
    })
    render(
      <ReviewTemplatesSettings
        transport={transport}
        nextCorrelationId={createCorrelationIds()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Beta' }))
    expect(screen.getByLabelText('Title')).toHaveValue('Beta')
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Updated' },
    })
    fireEvent.change(screen.getByLabelText('Template content'), {
      target: { value: 'Updated body' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }))

    await waitFor(() => {
      expect(transport.upsertTemplate).toHaveBeenCalledWith(
        { id: 'beta', title: 'Updated', body: 'Updated body' },
        'correlation-2',
      )
    })
    expect(await screen.findByText('Updated')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save template' })).toBeNull()
  })

  it('requires explicit confirmation before applying authoritative deletion', async () => {
    vi.mocked(transport.listTemplates).mockResolvedValue({
      status: 'success',
      correlationId: 'correlation-1',
      data: { templates: [beta] },
    })
    vi.mocked(transport.deleteTemplate).mockResolvedValue({
      status: 'success',
      correlationId: 'correlation-2',
      data: { templates: [] },
    })
    render(
      <ReviewTemplatesSettings
        transport={transport}
        nextCorrelationId={createCorrelationIds()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Beta' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete template?' })
    expect(dialog).toHaveTextContent('Beta will be removed')
    expect(transport.deleteTemplate).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Beta' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete',
      }),
    )

    await waitFor(() => {
      expect(transport.deleteTemplate).toHaveBeenCalledWith(
        'beta',
        'correlation-2',
      )
    })
    expect(await screen.findByText('No review templates yet.')).toBeVisible()
  })

  it('validates required fields and exposes configured limits', async () => {
    render(
      <ReviewTemplatesSettings
        transport={transport}
        nextCorrelationId={createCorrelationIds()}
      />,
    )
    await screen.findByText('No review templates yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Add template' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a template title.',
    )
    expect(transport.upsertTemplate).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Title')).toHaveAttribute(
      'maxlength',
      String(MAX_REVIEW_TEMPLATE_TITLE_LENGTH),
    )
    expect(screen.getByLabelText('Template content')).toHaveAttribute(
      'maxlength',
      String(MAX_REVIEW_TEMPLATE_BODY_LENGTH),
    )
    expect(screen.getByText(`0 / ${MAX_REVIEW_TEMPLATE_COUNT}`)).toBeVisible()
  })

  it('blocks creation at the count limit while keeping edits available', async () => {
    const templates = Array.from(
      { length: MAX_REVIEW_TEMPLATE_COUNT },
      (_, index) => createTemplate(`template-${index}`, `Template ${index}`),
    )
    vi.mocked(transport.listTemplates).mockResolvedValue({
      status: 'success',
      correlationId: 'correlation-1',
      data: { templates },
    })
    render(
      <ReviewTemplatesSettings
        transport={transport}
        nextCorrelationId={createCorrelationIds()}
      />,
    )

    expect(
      await screen.findByText(`100 / ${MAX_REVIEW_TEMPLATE_COUNT}`),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add template' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Template 0' }))
    expect(screen.getByRole('button', { name: 'Save template' })).toBeEnabled()
  })

  it('shows recoverable load errors and retries through the message transport', async () => {
    vi.mocked(transport.listTemplates)
      .mockResolvedValueOnce({
        status: 'error',
        correlationId: 'correlation-1',
        error: {
          code: 'storage-unavailable',
          message: 'Storage unavailable',
        },
      })
      .mockResolvedValueOnce({
        status: 'success',
        correlationId: 'correlation-2',
        data: { templates: [alpha] },
      })
    render(
      <ReviewTemplatesSettings
        transport={transport}
        nextCorrelationId={createCorrelationIds()}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Local review storage is unavailable',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('button', { name: 'Edit Alpha' }),
    ).toBeVisible()
    expect(transport.listTemplates).toHaveBeenCalledTimes(2)
  })
})

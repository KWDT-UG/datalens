import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installCrudFetchMock, mutationCall } from '../test/mockApi';
import { renderWithProviders } from '../test/render';
import { ReferenceDataPage } from './ReferenceDataPage';

const thematicArea = { id: 9, code: 'WASH', name: 'WASH', status: 'active' };
const program = {
  id: 10,
  thematic_area: 9,
  thematic_area_name: 'WASH',
  code: 'WATER',
  name: 'Water',
  status: 'active'
};
const category = {
  id: 11,
  program: 10,
  program_name: 'Water',
  thematic_area: 9,
  thematic_area_name: 'WASH',
  code: 'BOREHOLE',
  name: 'Borehole',
  status: 'active'
};

describe('ReferenceDataPage', () => {
  it('shows the hierarchy and creates a program beneath a thematic area', async () => {
    const fetchMock = installCrudFetchMock({
      programs: [program],
      resourceCategories: [category],
      thematicAreas: [thematicArea]
    });
    const user = userEvent.setup();
    renderWithProviders(<ReferenceDataPage />);

    expect(await screen.findByRole('heading', { name: 'Resource Classification' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Thematic areas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Programs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resource categories' })).toBeInTheDocument();
    expect((await screen.findAllByText('WASH')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Water')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Borehole')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Thematic area'), '9');
    await user.click(screen.getByRole('button', { name: 'Add program' }));
    const dialog = screen.getByRole('dialog', { name: 'Add program' });
    expect(within(dialog).getByLabelText('Thematic area')).toHaveValue('9');
    await user.type(within(dialog).getByLabelText('Name'), 'Sanitation Services');
    await user.type(within(dialog).getByLabelText('Code'), 'sanitation services');
    await user.click(within(dialog).getByRole('button', { name: 'Save program' }));

    await waitFor(() => {
      const mutation = mutationCall(fetchMock);
      expect(mutation.path).toBe('/api/v1/programs/');
      expect(mutation.body).toMatchObject({
        code: 'SANITATION_SERVICES',
        name: 'Sanitation Services',
        thematic_area: 9
      });
    });
  });
});

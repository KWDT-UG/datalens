import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCreateProgramMutation,
  useCreateResourceCategoryMutation,
  useCreateThematicAreaMutation,
  useProgramsQuery,
  useResourceCategoriesQuery,
  useThematicAreasQuery,
  useUpdateProgramMutation,
  useUpdateResourceCategoryMutation,
  useUpdateThematicAreaMutation
} from '../api/queries';
import type { Program, ResourceCategory, ThematicArea } from '../api/types';
import { FormDialog, FormErrorSummary } from '../components/FormDialog';
import { StatusBadge } from '../components/StatusBadge';

type DialogTarget =
  | { kind: 'thematic-area'; record?: ThematicArea }
  | { kind: 'program'; record?: Program; thematicAreaId?: number }
  | { kind: 'category'; record?: ResourceCategory; programId?: number };

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

const resourceTypeOptions = [
  { value: '', label: 'No default' },
  { value: 'livestock', label: 'Livestock' },
  { value: 'tool', label: 'Tool' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'land_plot', label: 'Land plot' },
  { value: 'grant', label: 'Grant' },
  { value: 'cash_asset', label: 'Cash asset' },
  { value: 'building_material', label: 'Building material' },
  { value: 'other', label: 'Other' }
];

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function ThematicAreaDialog({ onClose, record }: { onClose: () => void; record?: ThematicArea }) {
  const create = useCreateThematicAreaMutation();
  const update = useUpdateThematicAreaMutation();
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: {
      code: record?.code ?? '',
      description: record?.description ?? '',
      name: record?.name ?? '',
      status: record?.status ?? 'active'
    }
  });
  const error = create.error ?? update.error;
  const pending = create.isPending || update.isPending;

  return (
    <FormDialog
      open
      title={record ? 'Edit thematic area' : 'Add thematic area'}
      description="Thematic areas are organization-wide and change infrequently."
      onClose={onClose}
    >
      <form className="record-form" onSubmit={handleSubmit(async (values) => {
        const payload = { ...values, code: normalizeCode(values.code), name: values.name.trim() };
        try {
          if (record) {
            await update.mutateAsync({ id: record.id, payload });
          } else {
            await create.mutateAsync(payload);
          }
          onClose();
        } catch {
          // Rendered below.
        }
      })}>
        <FormErrorSummary error={error} />
        <div className="form-grid">
          <label className="form-field">
            <span>Name</span>
            <input autoFocus {...register('name', { required: 'Enter a thematic-area name.' })} />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Code</span>
            <input {...register('code', { required: 'Enter a short unique code.' })} />
            {errors.code ? <small>{errors.code.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
        </div>
        <label className="form-field">
          <span>Description</span>
          <textarea rows={3} {...register('description')} />
        </label>
        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button--primary" disabled={pending}>{pending ? 'Saving...' : 'Save thematic area'}</button>
        </footer>
      </form>
    </FormDialog>
  );
}

function ProgramDialog({
  onClose,
  record,
  thematicAreaId,
  thematicAreas
}: {
  onClose: () => void;
  record?: Program;
  thematicAreaId?: number;
  thematicAreas: ThematicArea[];
}) {
  const create = useCreateProgramMutation();
  const update = useUpdateProgramMutation();
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: {
      code: record?.code ?? '',
      description: record?.description ?? '',
      display_order: String(record?.display_order ?? 0),
      name: record?.name ?? '',
      status: record?.status ?? 'active',
      thematic_area: String(record?.thematic_area ?? thematicAreaId ?? '')
    }
  });
  const error = create.error ?? update.error;
  const pending = create.isPending || update.isPending;

  return (
    <FormDialog
      open
      title={record ? 'Edit program' : 'Add program'}
      description="Every program belongs to exactly one thematic area."
      onClose={onClose}
    >
      <form className="record-form" onSubmit={handleSubmit(async (values) => {
        const payload = {
          ...values,
          code: normalizeCode(values.code),
          display_order: Number(values.display_order || 0),
          name: values.name.trim(),
          thematic_area: Number(values.thematic_area)
        };
        try {
          if (record) {
            await update.mutateAsync({ id: record.id, payload, syncVersion: record.sync_version });
          } else {
            await create.mutateAsync(payload);
          }
          onClose();
        } catch {
          // Rendered below.
        }
      })}>
        <FormErrorSummary error={error} />
        <div className="form-grid">
          <label className="form-field">
            <span>Thematic area</span>
            <select autoFocus {...register('thematic_area', { required: 'Select a thematic area.' })}>
              <option value="">Select thematic area</option>
              {thematicAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
            {errors.thematic_area ? <small>{errors.thematic_area.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Name</span>
            <input {...register('name', { required: 'Enter a program name.' })} />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Code</span>
            <input {...register('code', { required: 'Enter a short code.' })} />
            {errors.code ? <small>{errors.code.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Display order</span>
            <input inputMode="numeric" type="number" min="0" {...register('display_order')} />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
        </div>
        <label className="form-field">
          <span>Description</span>
          <textarea rows={3} {...register('description')} />
        </label>
        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button--primary" disabled={pending}>{pending ? 'Saving...' : 'Save program'}</button>
        </footer>
      </form>
    </FormDialog>
  );
}

function CategoryDialog({
  onClose,
  programId,
  programs,
  record
}: {
  onClose: () => void;
  programId?: number;
  programs: Program[];
  record?: ResourceCategory;
}) {
  const create = useCreateResourceCategoryMutation();
  const update = useUpdateResourceCategoryMutation();
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: {
      code: record?.code ?? '',
      default_resource_type: record?.default_resource_type ?? '',
      description: record?.description ?? '',
      display_order: String(record?.display_order ?? 0),
      name: record?.name ?? '',
      program: String(record?.program ?? programId ?? ''),
      status: record?.status ?? 'active'
    }
  });
  const error = create.error ?? update.error;
  const pending = create.isPending || update.isPending;

  return (
    <FormDialog
      open
      title={record ? 'Edit resource category' : 'Add resource category'}
      description="Categories are reusable resource types within a program."
      onClose={onClose}
    >
      <form className="record-form" onSubmit={handleSubmit(async (values) => {
        const payload = {
          ...values,
          code: normalizeCode(values.code),
          default_resource_type: values.default_resource_type || undefined,
          display_order: Number(values.display_order || 0),
          name: values.name.trim(),
          program: Number(values.program)
        };
        try {
          if (record) {
            await update.mutateAsync({ id: record.id, payload, syncVersion: record.sync_version });
          } else {
            await create.mutateAsync(payload);
          }
          onClose();
        } catch {
          // Rendered below.
        }
      })}>
        <FormErrorSummary error={error} />
        <div className="form-grid">
          <label className="form-field">
            <span>Program</span>
            <select autoFocus {...register('program', { required: 'Select a program.' })}>
              <option value="">Select program</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.thematic_area_name} · {program.name}</option>)}
            </select>
            {errors.program ? <small>{errors.program.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Name</span>
            <input {...register('name', { required: 'Enter a category name.' })} />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Code</span>
            <input {...register('code', { required: 'Enter a short code.' })} />
            {errors.code ? <small>{errors.code.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Default resource type</span>
            <select {...register('default_resource_type')}>{resourceTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <label className="form-field">
            <span>Display order</span>
            <input inputMode="numeric" type="number" min="0" {...register('display_order')} />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
        </div>
        <label className="form-field">
          <span>Description</span>
          <textarea rows={3} {...register('description')} />
        </label>
        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button--primary" disabled={pending}>{pending ? 'Saving...' : 'Save category'}</button>
        </footer>
      </form>
    </FormDialog>
  );
}

export function ReferenceDataPage() {
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [selectedThematicArea, setSelectedThematicArea] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const thematicAreasQuery = useThematicAreasQuery();
  const programsQuery = useProgramsQuery(undefined, true, null);
  const categoriesQuery = useResourceCategoriesQuery(undefined, true, null);
  const thematicAreas = thematicAreasQuery.data?.results ?? [];
  const programs = programsQuery.data?.results ?? [];
  const categories = categoriesQuery.data?.results ?? [];
  const visiblePrograms = selectedThematicArea
    ? programs.filter((program) => program.thematic_area === Number(selectedThematicArea))
    : programs;
  const visibleCategories = selectedProgram
    ? categories.filter((category) => category.program === Number(selectedProgram))
    : categories;

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Resource Classification</h1>
          <p className="page-header__description">
            Govern the shared Thematic Area → Program → Resource Category hierarchy.
          </p>
        </div>
      </div>

      {thematicAreasQuery.isLoading || programsQuery.isLoading || categoriesQuery.isLoading ? (
        <div className="state-box">Loading resource classification...</div>
      ) : null}
      {thematicAreasQuery.isError || programsQuery.isError || categoriesQuery.isError ? (
        <div className="state-box state-box--error">Unable to load resource classification.</div>
      ) : null}

      <div className="reference-data-columns">
        <section className="reference-data-panel">
          <header>
            <div><span>Level 1</span><h2>Thematic areas</h2></div>
            <button className="button button--primary" type="button" onClick={() => setDialog({ kind: 'thematic-area' })}>Add thematic area</button>
          </header>
          <p>Stable organization-wide reporting areas.</p>
          <div className="reference-data-list">
            {thematicAreas.map((area) => (
              <article key={area.id}>
                <div><strong>{area.name}</strong><code>{area.code}</code></div>
                <StatusBadge status={area.status} />
                <button className="text-action" type="button" onClick={() => setDialog({ kind: 'thematic-area', record: area })}>Edit</button>
              </article>
            ))}
          </div>
        </section>

        <section className="reference-data-panel">
          <header>
            <div><span>Level 2</span><h2>Programs</h2></div>
            <button className="button button--primary" type="button" onClick={() => setDialog({ kind: 'program', thematicAreaId: selectedThematicArea ? Number(selectedThematicArea) : undefined })}>Add program</button>
          </header>
          <label className="compact-filter">
            <span>Thematic area</span>
            <select value={selectedThematicArea} onChange={(event) => { setSelectedThematicArea(event.target.value); setSelectedProgram(''); }}>
              <option value="">All thematic areas</option>
              {thematicAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          <div className="reference-data-list">
            {visiblePrograms.map((program) => (
              <article key={program.id}>
                <div><small>{program.thematic_area_name}</small><strong>{program.name}</strong><code>{program.code}</code></div>
                <StatusBadge status={program.status} />
                <button className="text-action" type="button" onClick={() => setDialog({ kind: 'program', record: program })}>Edit</button>
              </article>
            ))}
          </div>
        </section>

        <section className="reference-data-panel">
          <header>
            <div><span>Level 3</span><h2>Resource categories</h2></div>
            <button className="button button--primary" type="button" onClick={() => setDialog({ kind: 'category', programId: selectedProgram ? Number(selectedProgram) : undefined })}>Add category</button>
          </header>
          <label className="compact-filter">
            <span>Program</span>
            <select value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)}>
              <option value="">All programs</option>
              {visiblePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </label>
          <div className="reference-data-list">
            {visibleCategories.map((category) => (
              <article key={category.id}>
                <div><small>{category.program_name}</small><strong>{category.name}</strong><code>{category.code}</code></div>
                <StatusBadge status={category.status} />
                <button className="text-action" type="button" onClick={() => setDialog({ kind: 'category', record: category })}>Edit</button>
              </article>
            ))}
          </div>
        </section>
      </div>

      {dialog?.kind === 'thematic-area' ? <ThematicAreaDialog record={dialog.record} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'program' ? <ProgramDialog record={dialog.record} thematicAreaId={dialog.thematicAreaId} thematicAreas={thematicAreas} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'category' ? <CategoryDialog record={dialog.record} programId={dialog.programId} programs={programs} onClose={() => setDialog(null)} /> : null}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useUpdateProfileMutation } from '../api/queries';
import type { ProfileUpdateInput } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { FormErrorSummary } from '../components/FormDialog';

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  position_title: string;
  current_password: string;
  new_password: string;
  confirm_password: string;
};

function formatLabel(value?: string | null) {
  if (!value) {
    return 'Not assigned';
  }
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function ProfilePage() {
  const auth = useAuth();
  const updateProfile = useUpdateProfileMutation();
  const [saved, setSaved] = useState(false);
  const {
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset
  } = useForm<ProfileForm>({
    defaultValues: {
      first_name: auth.user?.first_name ?? '',
      last_name: auth.user?.last_name ?? '',
      email: auth.user?.email ?? '',
      position_title: auth.user?.position_title ?? '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    }
  });

  useEffect(() => {
    if (!auth.user) {
      return;
    }
    reset({
      first_name: auth.user.first_name,
      last_name: auth.user.last_name,
      email: auth.user.email,
      position_title: auth.user.position_title,
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
  }, [auth.user, reset]);

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile</h1>
          <p className="page-header__description">
            Keep your contact details current and manage your password.
          </p>
        </div>
      </div>

      <div className="profile-layout">
        <section className="profile-card" aria-labelledby="profile-details-title">
          <div className="profile-card__header">
            <h2 id="profile-details-title">Personal details</h2>
            <p>Changes here update your own account only.</p>
          </div>
          <form
            className="record-form"
            onSubmit={handleSubmit(async (values) => {
              setSaved(false);
              const payload: ProfileUpdateInput = {
                first_name: values.first_name.trim(),
                last_name: values.last_name.trim(),
                email: values.email.trim(),
                position_title: values.position_title.trim(),
                ...(values.new_password
                  ? {
                      current_password: values.current_password,
                      new_password: values.new_password
                    }
                  : {})
              };

              try {
                await updateProfile.mutateAsync(payload);
                await auth.refreshUser();
                setSaved(true);
              } catch {
                // The mutation error is rendered below.
              }
            })}
          >
            <FormErrorSummary error={updateProfile.error} />
            {saved ? (
              <div className="form-alert form-alert--success" role="status">
                Profile updated.
              </div>
            ) : null}

            <div className="form-grid">
              <label className="form-field">
                <span>First name</span>
                <input autoComplete="given-name" {...register('first_name')} />
              </label>

              <label className="form-field">
                <span>Last name</span>
                <input autoComplete="family-name" {...register('last_name')} />
              </label>

              <label className="form-field">
                <span>Email</span>
                <input
                  autoComplete="email"
                  type="email"
                  {...register('email', {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address.'
                    }
                  })}
                />
                {errors.email ? <small>{errors.email.message}</small> : null}
              </label>

              <label className="form-field">
                <span>Position / title</span>
                <input autoComplete="organization-title" {...register('position_title')} />
              </label>
            </div>

            <div className="profile-password">
              <div className="profile-card__header">
                <h2>Change password</h2>
                <p>Leave these fields blank to keep your current password.</p>
              </div>
              <div className="form-grid">
                <label className="form-field">
                  <span>Current password</span>
                  <input
                    autoComplete="current-password"
                    type="password"
                    {...register('current_password', {
                      validate: (value) =>
                        !getValues('new_password') ||
                        Boolean(value) ||
                        'Enter your current password.'
                    })}
                  />
                  {errors.current_password ? (
                    <small>{errors.current_password.message}</small>
                  ) : null}
                </label>

                <label className="form-field">
                  <span>New password</span>
                  <input
                    autoComplete="new-password"
                    type="password"
                    {...register('new_password', {
                      minLength: {
                        value: 8,
                        message: 'Use at least 8 characters.'
                      }
                    })}
                  />
                  {errors.new_password ? <small>{errors.new_password.message}</small> : null}
                </label>

                <label className="form-field">
                  <span>Confirm new password</span>
                  <input
                    autoComplete="new-password"
                    type="password"
                    {...register('confirm_password', {
                      validate: (value) =>
                        value === getValues('new_password') || 'Passwords do not match.'
                    })}
                  />
                  {errors.confirm_password ? (
                    <small>{errors.confirm_password.message}</small>
                  ) : null}
                </label>
              </div>
            </div>

            <footer className="record-form__actions">
              <button
                className="button button--primary"
                disabled={updateProfile.isPending}
                type="submit"
              >
                {updateProfile.isPending ? 'Saving...' : 'Save profile'}
              </button>
            </footer>
          </form>
        </section>

        <aside className="profile-card profile-card--access" aria-labelledby="access-title">
          <div className="profile-card__header">
            <h2 id="access-title">Access</h2>
            <p>Role and workforce assignments are managed by an administrator.</p>
          </div>
          <dl className="profile-readout">
            <div>
              <dt>Username</dt>
              <dd>{auth.user?.username}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{auth.user?.roles.map(formatLabel).join(', ') || 'Not assigned'}</dd>
            </div>
            <div>
              <dt>Workforce type</dt>
              <dd>{formatLabel(auth.user?.workforce_type)}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>{auth.user?.is_active ? 'Active' : 'Inactive'}</dd>
            </div>
          </dl>
          <div className="profile-capabilities">
            <h3>Effective permissions</h3>
            <div>
              {auth.user?.capabilities.map((capability) => (
                <span className="capability-chip" key={capability}>
                  {formatLabel(capability)}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

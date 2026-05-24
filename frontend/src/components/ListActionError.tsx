import { ApiClientError } from '../api/client';

type ListActionErrorProps = {
  error: unknown;
};

export function ListActionError({ error }: ListActionErrorProps) {
  if (!error) {
    return null;
  }

  const message =
    error instanceof ApiClientError
      ? error.errors[0]?.detail ?? error.message
      : error instanceof Error
        ? error.message
        : 'The selected action could not be completed.';

  return (
    <div className="state-box state-box--error" role="alert">
      {message}
    </div>
  );
}

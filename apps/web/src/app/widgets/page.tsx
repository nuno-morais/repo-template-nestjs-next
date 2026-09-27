'use client';

import { useState, type FormEvent } from 'react';
import { useCreateWidget, useWidgets } from '../../hooks/use-widgets';

export default function WidgetsPage() {
  const { data: widgets, isPending, isError } = useWidgets();
  const createWidget = useCreateWidget();
  const [name, setName] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createWidget.mutateAsync({ name: trimmed });
      setName('');
    } catch {
      // Mutation error remains visible below form; input stays available for retry.
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Widgets</h1>
      <form className="mt-6 flex flex-wrap gap-2" onSubmit={submit}>
        <label htmlFor="widget-name" className="sr-only">
          Widget name
        </label>
        <input
          id="widget-name"
          className="min-w-0 flex-1 rounded border px-3 py-2"
          required
          maxLength={255}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Widget name"
        />
        <button
          type="submit"
          disabled={createWidget.isPending}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          Create
        </button>
      </form>
      {createWidget.isError && (
        <p role="alert" className="mt-3 text-red-700">
          Could not create widget. Please retry.
        </p>
      )}
      {isPending ? (
        <p className="mt-4" role="status">
          Loading widgets…
        </p>
      ) : isError ? (
        <p role="alert" className="mt-4 text-red-700">
          Could not load widgets.
        </p>
      ) : (
        <ul className="mt-4 list-inside list-disc" data-testid="widget-list">
          {widgets?.map((widget) => (
            <li key={widget.id}>{widget.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

import type { components } from '../../types/api-contract';
import { apiFetch } from './client';

export type Widget = components['schemas']['WidgetResponseDto'];

export function listWidgets(token: string): Promise<Widget[]> {
  return apiFetch<Widget[]>('/widgets', token);
}

export function createWidget(
  token: string,
  input: { name: string; description?: string },
): Promise<Widget> {
  return apiFetch<Widget>('/widgets', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

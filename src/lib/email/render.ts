import { type ReactElement } from 'react';

/**
 * Renders a React email component to an HTML string.
 * Uses a dynamic import of react-dom/server to avoid Next.js
 * webpack restrictions on importing it at the module level.
 */
export async function renderEmailToHtml(component: ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(component);
}

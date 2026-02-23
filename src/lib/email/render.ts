import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders a React email component to an HTML string.
 * Uses ReactDOMServer.renderToStaticMarkup for clean HTML output
 * without React-specific data attributes.
 */
export function renderEmailToHtml(component: ReactElement): string {
  return renderToStaticMarkup(component);
}

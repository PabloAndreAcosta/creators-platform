/**
 * Felknappens lilla gemensamma läge, utan React-kontext. Knappen sitter i
 * rotlayouten medan felsidorna och fetch-lyssnaren ligger på helt andra ställen
 * i trädet; en kontext skulle kräva att allt låg under samma provider.
 *
 * - attention: något gick nyss fel (5xx eller nätfel), knappen tänds.
 * - errorScreens: antal felsidor som visas just nu. Då göms hörnknappen,
 *   eftersom felsidan har en egen, större.
 */
export type FeedbackState = {
  attention: boolean;
  errorScreens: number;
};

let state: FeedbackState = { attention: false, errorScreens: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<FeedbackState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function getFeedbackState(): FeedbackState {
  return state;
}

export function subscribeFeedback(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function flagAttention(): void {
  if (!state.attention) set({ attention: true });
}

export function clearAttention(): void {
  if (state.attention) set({ attention: false });
}

/** Felsidan anmäler sig när den visas. Returnerar avanmälan. */
export function registerErrorScreen(): () => void {
  set({ errorScreens: state.errorScreens + 1 });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    set({ errorScreens: Math.max(0, state.errorScreens - 1) });
  };
}

/** Bara för tester. */
export function resetFeedbackState(): void {
  state = { attention: false, errorScreens: 0 };
  listeners.clear();
}

// Pure, opt-in helpers; no network or database writes.
export function lifecycleEnabled(context: any) {
  return ['offer', 'after_sale'].includes(context?.lifecycle?.mode);
}

export function orderedConfig(config: any, context: any, previous: string | null) {
  return lifecycleEnabled(context) && previous
    ? { ...config, __previous_event: previous }
    : config;
}

export function lifecycleDraft(mode: string) {
  return mode === 'after_sale'
    ? { version: 1, mode: 'after_sale' }
    : { version: 1, mode: 'offer', stop_stage_ids: [] };
}

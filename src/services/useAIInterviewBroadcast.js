/**
 * services/useAIInterviewBroadcast.js
 *
 * Compatibility shim. The real, maintained implementation now lives at
 * `src/hooks/useAIInterviewBroadcast.js` (the correct location for a React
 * hook). This file only exists so any code still importing from the old
 * `services/` path keeps working — do not add logic here, edit the hook.
 */
export { useAIInterviewBroadcast, default } from '../hooks/useAIInterviewBroadcast';

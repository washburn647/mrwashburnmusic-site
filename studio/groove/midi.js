/* A MIDI keyboard for Groove Lab: notes on and off from every connected input, through Web
   MIDI (Chrome, Edge and Firefox; Safari has none). Inputs plugged in later join. */

let access = null;

export const supported = () => typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';

/* A message's note: { on, note, vel }, or null for anything else (clock, knobs, pedals). A note
   on at velocity 0 is a note off. */
export function parse(data) {
  const [st, note, vel] = data || [];
  const type = st & 0xf0;
  if (type === 0x90 && vel > 0) return { on: true, note, vel };
  if (type === 0x80 || (type === 0x90 && vel === 0)) return { on: false, note, vel: 0 };
  return null;
}

export const names = () => (access ? [...access.inputs.values()].filter((i) => i.state !== 'disconnected').map((i) => i.name || 'MIDI') : []);

/* Asks the browser for MIDI (it may ask the user), then calls onNote for each note and
   onInputs with the inputs' names whenever they change. */
export async function connect(onNote, onInputs) {
  disconnect();
  const a = await navigator.requestMIDIAccess();
  access = a;
  const hook = () => {
    if (access !== a) return;
    for (const input of a.inputs.values()) input.onmidimessage = (e) => { const x = parse(e.data); if (x) onNote(x); };
    onInputs(names());
  };
  a.onstatechange = hook;
  hook();
}

export function disconnect() {
  if (!access) return;
  for (const input of access.inputs.values()) input.onmidimessage = null;
  access.onstatechange = null;
  access = null;
}

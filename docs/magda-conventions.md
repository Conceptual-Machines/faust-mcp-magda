# MAGDA Faust Conventions

When writing Faust DSP code for MAGDA, follow these conventions to ensure
parameters are correctly mapped, persisted, and automatable.

## Parameter Metadata Annotations

MAGDA's FaustPlugin parses metadata annotations from parameter labels.
Annotations use the standard Faust `[key:value]` syntax inside labels.

### Slot Index — `[idx:N]`

Assigns a parameter to a specific slot (0–63) in MAGDA's fixed parameter pool.
This guarantees stable automation/macro/MIDI Learn assignments across
recompiles.

```faust
gain = hslider("Gain [idx:0] [unit:dB]", 0, -60, 12, 0.1);
```

- Range: 0–63. Duplicates are rejected (second claim is skipped).
- Parameters without `[idx:N]` are assigned to free slots in encounter order.
- **Best practice**: always assign `[idx:N]` to parameters you expect users
  to automate or link to macros.

### Unit — `[unit:X]`

Declares the unit for display purposes:

```faust
freq = hslider("Frequency [idx:1] [unit:Hz]", 440, 20, 20000, 1);
```

Common units: `Hz`, `dB`, `ms`, `%`, `semitones`.

### Scale — `[scale:log]`

Requests logarithmic scaling for the parameter knob:

```faust
freq = hslider("Cutoff [idx:2] [unit:Hz] [scale:log]", 1000, 20, 20000, 1);
```

Values: `log`, `exp`. Default is linear.

### Menu / Radio — `[style:menu{'Label1':val1;'Label2':val2}]`

Renders the parameter as a dropdown menu instead of a knob:

```faust
mode = nentry("Mode [idx:3] [style:menu{'Clean':0;'Warm':1;'Hot':2}]", 0, 0, 2, 1);
```

## Parameter Pool

MAGDA's FaustPlugin maintains a pool of **64 fixed parameter slots** that
survive DSP recompiles. This is critical because:

- Automation lanes reference parameters by slot index
- Macro links and MIDI Learn bindings persist across code changes
- LFO/envelope modulation targets are stable

### Two-Pass Binding

1. **Pass 1**: Parameters with explicit `[idx:N]` are assigned to their
   requested slot.
2. **Pass 2**: Remaining parameters fill free slots in encounter order
   (the order `buildUserInterface()` visits them).

## I/O Conventions

- **Effect plugins**: 2 inputs, 2 outputs (stereo pass-through)
- **Instrument plugins**: 0 inputs, 2 outputs (synthesizer)
- MAGDA auto-detects the type from the I/O count

## Example: Stereo Effect

```faust
import("stdfaust.lib");

drive = hslider("Drive [idx:0]", 0.5, 0, 1, 0.01);
tone  = hslider("Tone [idx:1] [unit:Hz] [scale:log]", 1000, 200, 8000, 1);
mix   = hslider("Mix [idx:2]", 0.5, 0, 1, 0.01);

distortion(x) = x : *(drive * 10 + 1) : ma.tanh;
toneFilter = fi.lowpass(1, tone);

process = _, _ : par(i, 2,
    _ <: (_, distortion : *(1-mix), *(mix) :> _) : toneFilter
) : _, _;
```

## Metadata Declares

Group-level metadata can be set with `declare`:

```faust
declare name "My Effect";
declare author "Your Name";
declare version "1.0";
declare description "A stereo distortion effect";
```

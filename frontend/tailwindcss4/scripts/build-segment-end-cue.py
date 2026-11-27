"""Build public/clozzz/segment-end-cue.wav from Sean's countdown upload + final chime."""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"c:\Users\26071164r\AppData\Roaming\Cursor\User\globalStorage"
    r"\anysphere.cursor-agent-worker\worker-data"
    r"\cursor-agent-worker-097ef0a40b\projects"
    r"\c-Users-26071164r-projects-developer-site\uploads"
    r"\5-second-countdown-sound--hjmjpfg6_d820.wav"
)
OUT = ROOT / "public" / "clozzz" / "segment-end-cue.wav"
LICENSE = ROOT / "public" / "clozzz" / "segment-end-cue.LICENSE.txt"

COUNTDOWN_SEC = 5.0


def main() -> None:
    with wave.open(str(SRC), "rb") as w:
        ch = w.getnchannels()
        width = w.getsampwidth()
        rate = w.getframerate()
        raw = w.readframes(w.getnframes())

    if width != 2:
        raise SystemExit(f"expected 16-bit PCM, got width={width}")

    frames: list[list[float]] = []
    step = width * ch
    for i in range(0, len(raw), step):
        vals = [
            struct.unpack_from("<h", raw, i + c * 2)[0] / 32768.0 for c in range(ch)
        ]
        frames.append(vals)

    countdown = frames[: int(rate * COUNTDOWN_SEC)]

    # Soft fade-out last 40ms so the final chime isn't clipped against a tick.
    fade = int(rate * 0.04)
    for i in range(fade):
        g = (fade - i) / fade
        idx = len(countdown) - fade + i
        if 0 <= idx < len(countdown):
            countdown[idx] = [x * g for x in countdown[idx]]

    random.seed(7)

    def soft_final_chime(n_ch: int, amp: float = 0.32) -> list[list[float]]:
        dur = 1.25
        n = int(rate * dur)
        out_frames: list[list[float]] = []
        fund = 523.25  # C5 — clear, calm, distinct from ticks
        for i in range(n):
            t = i / rate
            env = min(1.0, t / 0.018) * math.exp(-t * 2.4)
            v = (
                0.62 * math.sin(2 * math.pi * fund * t)
                + 0.28
                * math.sin(2 * math.pi * fund * 2.01 * t)
                * math.exp(-t * 2.0)
                + 0.12
                * math.sin(2 * math.pi * fund * 3.02 * t)
                * math.exp(-t * 3.5)
                + 0.05
                * math.sin(2 * math.pi * fund * 4.5 * t)
                * math.exp(-t * 6.0)
            )
            v += (random.random() * 2 - 1) * 0.008 * math.exp(-t * 8)
            s = max(-1.0, min(1.0, amp * env * v))
            out_frames.append([s] * n_ch)
        return out_frames

    combined = countdown + soft_final_chime(ch)
    peak = max(max(abs(x) for x in fr) for fr in combined) or 1.0
    gain = min(1.0, (10 ** (-1.5 / 20)) / peak)
    combined = [[max(-1.0, min(1.0, x * gain)) for x in fr] for fr in combined]

    with wave.open(str(OUT), "w") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(rate)
        buf = bytearray()
        for fr in combined:
            for x in fr:
                buf += struct.pack("<h", int(x * 32767))
        w.writeframes(bytes(buf))

    LICENSE.write_text(
        "\n".join(
            [
                "segment-end-cue.wav",
                "===================",
                "",
                "Countdown bed: first 5.0s of user-provided 5-second-countdown-sound",
                "(upload: 5-second-countdown-sound--hjmjpfg6).",
                "",
                "Final: original Clozzz soft bell chime (distinct next-exercise cue), CC0.",
                "",
                "Playback is hard-synced to the on-screen overlay timer.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(
        f"wrote {OUT.name} sec={len(combined)/rate:.2f} ch={ch} "
        f"peak_in={peak:.3f} gain={gain:.3f}"
    )


if __name__ == "__main__":
    main()

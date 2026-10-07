# The first look back

The first arrival climb triggers a 28-second first-person pause at the hill crest, three metres beyond the final tread of the east landing flight. The original 21-second camera and gull timeline now plays at 0.75x speed. The player settles for about 1.33 seconds, turns **left** over 6.67 seconds through the low western sun, takes in the ocean for 10.67 seconds with a longer glance following three passing gulls, turns back to the right over 8 seconds, and rests facing the lighthouse for 1.33 seconds. The gulls pass closer, about 14 metres out from the crest at the centre of the glance, with a gentle bank and an oblique flight path that shows their wings. The camera keeps its normal field of view and standing position, with a small breathing motion and no roll. Island ambience, the music, and the departing landing boat keep their original speed; story time holds during the camera moment. Saved shot progress retains authored time so older mid-scene saves preserve their pose.

The camera returns directly from the gull-following heading to the lighthouse, without first resetting to the ocean view. Historical stair notes disappear immediately when the scene starts; pending stair passages are closed so they cannot reappear afterward. Their full text remains in Papers. Arrival history captions stay hidden throughout the musical walk. The working-station tip now follows reading the Board's letter, with a six-second gap after the reading panel closes, and waits if the music is still playing. The tip remains in Papers as well.

The scene is saved in progress and resumes at the saved pose. Completion or **Continue / Esc** marks it seen for this watch. Skipping retains the current heading to avoid a camera snap. Later watches and headset views do not trigger it. Photo mode, a hidden tab and mobile pause hold the sequence and departure. The normal story save remains version 1 and accepts older saves.

Open `island-reveal.html` or `?setting=flannan&islandRevealPreview` to review directly at the stair crest. This uses `sevenhunters.island-reveal-preview.v1`, separate from normal-watch saves. Backtick opens **First look back · edit**, where Replay repeats the moment without reloading.

## Editing controls

- **Replay from start**, **Play from mark**, and **Pause / Resume from here** control the preview transport.
- **Scene position** and the scrub slider seek in real scene seconds. Scrubbing holds the camera and music until Resume. **Replay mark** chooses where Play from mark begins.
- **Camera speed** adjusts the camera and gull timeline together. Default 0.75x takes 28 seconds; allowed speeds are 0.25–2x. The music keeps its original speed.
- **Music in-point** chooses an offset within the track. **Music starts at** delays its entrance to a chosen scene time. **Music level**, **Fade in**, and **Out** adjust its mix. Zero-second fades are supported.
- **Reset timing & mix** restores the defaults. Settings persist in `sevenhunters.island-reveal-edit.v1` and are also used on the normal watch. Replay and scrubbing are available only in the isolated preview; the normal menu links to it.

Opening the debug panel holds both camera and audio. Replays reset the preview's crest pose, arrival daylight and departing boat so successive takes are comparable. Saved normal-watch progress is not reset. Scene and music time readouts are in seconds.

## Music

`src/audio/RevealMusic.js` exports `ISLAND_REVEAL_MUSIC`, now selecting the user-supplied Suno track `public/audio/the-three-note-reach.mp3`. The cue plays for up to 45 seconds, with a 2.5-second entrance and 4-second exit. The music timeline continues independently after the brief camera moment releases the player. Playback uses the existing master volume, mute and limiter. Pauses stop the voice; resuming seeks to the cue's current offset. Slow decoding starts at the current offset instead of delaying the camera. Setting `file: null` disables the score.

After the camera handoff, walking and normal interactions remain available, but sprint is held until the music cue ends. The limit follows the selected in-point, delay and decoded file length; unavailable or disabled music does not leave a sprint restriction. The mobile Hurry control is disabled for the same interval. Default timing gives roughly 17 seconds of walking after the 28-second camera moment.

The landing boat now travels for up to eight minutes before leaving the rendered scene. It keeps its original speed and route; it is never reset or teleported to fit the shot. A very slow climb can naturally leave it too distant to pick out.

## Checks

- `node test/island-reveal.mjs`: 30/60/120 fps camera continuity, trigger boundaries, pause states, saved pose, skip, preview replay, paused scrubbing, speed changes, quiet-walk timing, shared audio routing, music in-point/delay, zero fades and trimmed ending.
- `node test/intro-lessons.mjs`: silent approach, history after the Board letter, caption deferral during music, route gates and reading progress.
- `node test/stair-movement.mjs`: the real walker obeys the sprint restriction and regains sprint afterwards; existing stair movement checks remain in place.
- `node test/demo-story.mjs`: real controller walks the last six metres of the built east stairs and onto the hill crest; trigger, ocean heading, departure, held clock, mid-scene restore, lighthouse-facing handoff, independent music timeline and no replay after save/load.
- `node test/boat-arrival.mjs`: flotation and longer departure visibility.

The supplied `Recording 2026-10-05 101407.mp4` was reviewed locally for the crest, bay and lighthouse composition. Device comfort and the final score still need play/listening review.

`node tools/shots/island-reveal.mjs` renders the actual director at 0, 4.67, 8.67, 14, 16.53 and 28 real seconds into `artifacts/stair-crest/`, including a six-view contact sheet of the left turn, bay, longer bird glance and lighthouse return.

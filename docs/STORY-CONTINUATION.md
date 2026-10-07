# Seven Hunters: fixed story and the next watch

Author document, including spoilers. The new playable stretch runs from the first journal on 4 January through the clear evening on 6 January 1901. The later month, revelation, storm and relief below are the fixed writing direction, not implemented chapters.

## The whole story

Walter believes competent work will keep things under control. Cate believes watching hard enough will prevent another disappearance. Both learn to act without pretending to know more than they can see. Cate is a real woman on Lewis. Walter survives, relief arrives, and she reports uncertainty instead of disguising it as reassurance. Player answers change intimacy, disclosure and the journal; they do not change the causes of events or the ending.

1. **The first watch, 3 January:** approach by boat, the withdrawal of human company, ordinary lightkeeping, first contact, fog, the islet light and the gate. Existing playable opening.
2. **A place at the table, 4–6 January:** kitchen, stores, daylight inspection of the upper hauling shed, a sleeping berth, Cate's report of a small light while Walter slept, the remote chain job and smoke at home. On the next clear evening he asks whether she saw the house. This is the playable continuation.
3. **Things worth keeping, next selected watch:** unpack the camera and discover ordinary belongings in the other bedrooms. Photograph the landing damage and familiar station views. Mary asks for ordinary news; Cate becomes someone Walter wants to spend time signalling.
4. **An unreliable distance, mid-posting:** several days of fog interrupt contact. A fragment begins like a familiar group and ends before it can become a message. On the next clear evening Cate says she was away at that time. The received fragment remains exactly as received; Walter cannot quote a completed sentence.
5. **What she told them:** Cate admits she reported reassurance in December when weather prevented her from seeing the light. She cannot know whether reporting sooner would have saved anyone. The admission happens in every playthrough. Walter can be angry, compassionate or guarded.
6. **The coming weather:** open the workshop, repair a weakness established earlier, bring up oil, secure the station and recognise the unsafe lower landing route. Cate promises to report a loss of contact honestly this time.
7. **The extra large sea:** a light below the west landing resembles distress. Walter investigates from the upper lookout. The sea destroys the route below; he must return and keep the station operating. Cate reports that she cannot confirm his safety. No mandatory descent into a clearly condemned route.
8. **Someone comes:** relief lands. Walter hands over a functioning station and the player's journal. The developed photographs show ordinary machinery and a vulnerable landing: evidence of how small the human foothold was, with no figure revealed as a final jump scare. Walter writes Mary an ordinary letter. The last exchange with Cate resolves their relationship; the possibility of another presence remains unsettled.

These are selected watches across roughly a month. Quiet days are dated transitions. Later dialogue and photography interactions still need writing and implementation; their emotional outcome and the above sequence are fixed.

## Causes and evidence

The player can remain uncertain. The author cannot manufacture a different culprit for different answers.

| Incident | Fixed author cause | What can reach the player |
|---|---|---|
| Cate sees a small light after two | A brief reflected glimpse of the operating main light is misidentified at distance. It is not Walter using his hand lantern, and no visitor is introduced. | Cate is firm about the time, less certain about the source. Walter's recorded rest spans 00.24–02.24 on 5 January when using the watch skip. His hand lantern was extinguished. There is no replay proving the reflection. |
| Smoke while Walter is at the shed | Coals remain beneath the ash. A changing draught lifts smoke despite the banked stove. | The player banks the stove before leaving. The damper remains as left; warm coals and kettle remain on return. The remote plume is real. The explanation is plausible, not presented as a solved-case popup. |
| Later familiar fragment during fog | A distant vessel lamp is intermittently occluded by sea and weather. Its incomplete rhythm happens to resemble the learned group. | Only the actual flashes and missing tail are recorded. No decoded invented reply, narrator certainty or confirmed imitation. This later event is not yet built. |
| Apparent distress at the storm landing | A loose service lantern below the upper lookout moves with the hauling gear and spray. | Walter sees an incomplete pattern, then the sea removes the lower route. Survival and lightkeeping resolve; certainty about an occupant does not. This climax is not yet built. |

The first-night islet/gate behaviour remains as implemented. The fictional plot does not explain the historical December disappearance or turn invented evidence into a claim about the real keepers. New room dimensions, furniture, the small shed and the incidents are authored reconstructions, not surveyed plans or recovered inventory.

## The playable continuation

- Sign the first-night journal. It saves and opens the kitchen morning.
- Open the kitchen door under the clock. Make tea, unpack stores and read the marked routine code groups.
- Follow the west tramway to inspect the brake in daylight. Return through the south gate and rest in the berth through the kitchen.
- Light and wind the second evening's lamp. Exchange ordinary conversation and a little Gaelic.
- Keep watch at the stool/chair until the small hours. Wind fully, then take two hours in the berth. The main lamp keeps burning; the hand lantern is out. Wind again and keep watch until dawn.
- Record the second watch. Make tea, rest and exhibit the lamp again. Cate casually asks about the little light after two the previous night.
- Take the storm lantern. Bank the kitchen stove and go to secure the retaining chain at the upper hauling shed, above the landing stairs.
- The job finishes without a reading page, fade, forced camera movement or discovery sound. The only objective is **Return to the station.** Step out, choose where to look and walk home.
- Fog prevents reassurance from Gallan Head. At home, the stove has warm embers beneath ash; its damper remains where Walter left it. Keep the remaining watch, record it and rest.
- The next clear evening: **COULD YOU SEE THE HOUSE LAST NIGHT / ONLY THE TOWER. WHY**. Tell Cate about smoke or leave it. If the player never noticed the plume, the smoke answer is unavailable. The journal can include the actual observation or omit it.

Time caps keep authored windows available during exploration. Reading and choices pause the clock. Routine watch skips explicitly account for winding. The final chapter checkpoint persists and allows staying on the island; it does not claim to be the relief ending.

## Signals and Gaelic

Raw Morse appears as completed received marks, alongside decoded letters. A partly received letter stays incomplete. Looking away stops reading. The stores' code book teaches `1 K → LIGHT SEEN. K` and `4 → ALL WELL.`; these shortcuts and faster familiar reading apply after the first day. Personal messages still take time. Space can still read on. Saved conversations retain received progress and pending replies.

The lamp link and exact numbered groups are intentional fiction. The game uses **K** to invite a reply; goodbyes close an exchange in words. Routine transmissions aim for five to fifteen words, allowing shorter acknowledgements and farewells. Compress practical information without making either character sound mechanical. Ceit introduces herself with “Call me Cate,” establishing the familiar name used in later watches. Her December recollection describes what she could not see, rather than presenting the weather as a certainty. The longest current transmission is thirteen words. Dialogue node IDs, option order, time costs and evidence flags retain their existing meanings.

Gaelic remains in the message line, with English beneath it after receipt. The two occasional phrases used here are **Tapadh leat** (Thank you) and **Oidhche mhath** (Good night). They were checked against LearnGaelic: [thanks and farewells](https://learngaelic.scot/sol/episodes/ep.jsp?clip=7&prog=2), [good night](https://learngaelic.scot/sol/episodes/ep.jsp?clip=3&prog=10). Morse transmits the written letters; this pass adds no spoken Gaelic performance.

The contemporary Flannan report describes balls or discs on poles projecting from the balcony. A related daylight system can be developed later; it is not part of this language pass. Source: [Muirhead's 8 January 1901 report](https://www.nlb.org.uk/history/flannan-isles/).

## Local review and saves

`npm run dev -- --port 5191` then open `http://127.0.0.1:5191/next-watch.html` for chapter starts. `chapterPreview=kitchen`, `report`, `remote`, `return`, and `after` each use their own `sevenhunters.chapter-preview.<scene>.v1` save, leaving `sevenhunters.night1.v1` untouched. The normal route continues seamlessly after the first journal.

Named door state saves preserve the kitchen and berth. Older positional saves map only to the original gallery, house and two gate leaves.

Verification: `npm test` covers the real story director, lamp, terrain and walking colliders, including the continuation; `node test/demo-story.mjs --say` covers the alternate first-night choice as it flows into the same authored events. `npm run shots` renders the real new rooms and return view. Browser review checks the local UI. These do not establish physical mobile/headset controls, speaker audibility or long-session performance.

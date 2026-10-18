---
status: accepted
---

# Sort new phrasings into existing cards

A new upload or capture is sorted against the project's existing cards, rather than regrouping the project's whole history, so a card keeps its identity, its lesson, and its return stamp from one upload to the next. Phrasings that match nothing stay unsorted and go into the next sort, so a later borrow can still turn them into a card. The model only places phrasings and names new skills; code checks every id and still counts and dates the borrows from timestamps.

## Considered options

- **Regroup everything on every upload.** Uses the proof of concept's group request as it is, but skill names and groupings shift between runs, so return stamps and lessons would have to be matched to cards again by name, and big histories would cost more on every upload.

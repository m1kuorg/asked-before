---
name: asked-before
description: Records the learner's how-to questions onto their Asked Before library cards and runs cold reps in the chat. Use when the learner asks how to do something, when a recorded question lands on a card they asked before, when they ask for a cold rep or which cards are still borrowed, and when they answer a cold rep's problem.
---

# Asked Before

Asked Before keeps the learner's library cards. A card is one skill they asked a chatbot how to do more than once, such as "Undo a git commit", with a borrow for each time they asked; its count is how many borrows it has. A cold rep is a fresh problem of the card's skill that the learner answers without AI. Passing one stamps the card returned; asking the same thing after that makes it borrowed again. The tools below come from the `asked-before` MCP server.

## When the learner asks how to do something

A how-to question asks how to do a task the learner could learn to do alone: "how do I undo my last commit?", "what's the flag that makes grep ignore case?", "how do I center a div?". Asks for work on their code, such as "fix this test" or "add a login page", aren't how-to questions, and stay unrecorded.

1. Before you answer, call `record_question` with the learner's own words: their question as they wrote it, word for word. Send only those words. Leave out everything else in their message (pasted code, logs, file contents, paths) and anything secret (keys, tokens, passwords, personal details). Never send your answer, your code, or your rewording of the question. If nothing of their own question is left, record nothing.
2. Name the `shelf` when you know it. If `record_question` asks which shelf, call `list_shelves`, ask the learner which one their questions go to, and use it for the rest of the session.
3. Read what `record_question` gives back:
   - **A card they asked before.** Tell the learner they've asked this before, naming the card's skill and how many times they've borrowed it, and, when it's borrowed again, the date they returned it. Then offer a cold rep on it before you answer, since an answer in view would warm the rep. If they take it, run the cold rep below; if not, answer as usual.
   - **New, waiting unsorted.** Answer as usual.
   - **Recorded less than ten minutes ago.** No borrow was added. Carry on from where the first one left off, without a second offer.
   - **A tool error.** The question wasn't recorded. Tell the learner Asked Before's message in one line, then answer as usual. Send it again only if they ask.

## Cold reps

Start one when the learner takes your offer, or asks for a cold rep on a card. When they name no card, offer the top card from `list_cards` with `not_returned`.

1. Call `start_cold_rep` with the card's `card_id`.
2. Show the lesson, when one comes back, and the problem, both exactly as written. Then wait for the learner's answer.
3. While the rep is open, the learner works alone, so the rep stays cold: no hints, no explanations, no worked steps, no corrections, no answer, and no commands, file reads, or searches toward it. If they ask for help, say a cold rep is answered without AI: they can answer as best they can, or stop here, and the next cold rep on the card brings a different problem.
4. Pass their answer to `check_answer` with the `rep_id`, exactly as they wrote it: their typos, gaps, and formatting kept, with nothing of yours added.
5. Tell them the verdict and its reason as `check_answer` gives them. A pass stamps the card returned with today's date. After a fail, offer another cold rep: it brings a different problem and the lesson again. Once the verdict is in, the rep is over, and you can explain and answer as usual.

## Listing cards

When the learner asks what they keep asking, or which cards still need a cold rep, call `list_cards`, with `not_returned` for only the cards still borrowed or borrowed again. Give each card's skill, count, and status, most borrowed first.

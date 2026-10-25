# Asked Before

Asked Before turns the questions you keep asking a chatbot into library cards, and won't stamp a card returned until you pass a cold rep without AI. The app's screens, and the MCP server and the plugin's skill, say some of these terms in plainer words, given under _On screen_; the API, the SDK, and the docs page's API reference keep the terms.

## Language

### Your history

**Export**:
The conversations file a chatbot gives you when you request your data.
_Avoid_: Dump, backup, history file

**Phrasing**:
One of your own messages to a chatbot, in your words, with the time you sent it.
_On screen_: Your message, or your words; a count says "messages", as in "27 of your own messages", the privacy line's words.
_Avoid_: Prompt, query

**Upload**:
One export loaded onto a shelf. Only its phrasings leave your computer.
_Avoid_: Import, sync

**Capture**:
A phrasing an agent records as you ask it, rather than one read from an export.
_Avoid_: Log, track

**Shelf**:
One named part of your life's history, such as Work or Bootcamp, holding its own uploads, cards, and reps. Shelves never share cards.
_Avoid_: Project, workspace, folder

### Cards

**Skill**:
What a set of phrasings asks how to do, named the way a reference book titles an entry, such as "Undo a git commit".
_Avoid_: Topic, category, intent

**Card**:
One skill you asked about more than once, with its borrows.
_Avoid_: Flashcard, item

**Borrow**:
One time you asked, stamped with the date of the phrasing's own timestamp.
_On screen_: An ask, as in "asked 9 times" and "Every time you asked". A card never returned is To prove.
_Avoid_: Occurrence, hit, repeat

**Area**:
One stop on the Roadmap's fixed path of developer skills, such as Git or CSS, with its own list of words. A card goes on the area whose words its skill's name holds most, the earlier area on a tie; a name with none is off the path.
_Avoid_: Category, track, level

**Re-ask**:
A borrow that isn't its card's first, by time: so a card's borrows less one. Analysis counts them.
_On screen_: Asked before, as in "15 of your 27 messages asked something you'd asked before."
_Avoid_: Repeat, duplicate

**Unsorted**:
A shelf's phrasings that aren't on a card, because nothing else so far asks the same thing.
_On screen_: Not on a card. Never "asked once", since the sort misses some repeats.
_Avoid_: Inbox, orphans, singletons

**Sort**:
Placing new phrasings onto a shelf's cards, or into new cards, or leaving them unsorted.
_Avoid_: Regroup, classify, cluster

### Reps

**Lesson**:
The idea behind a card, written once with its first cold rep and shown again after a failed one.
_Avoid_: Explanation, tutorial

**Cold rep**:
A fresh problem of a card's skill, answered without AI.
_Avoid_: Quiz, test, flashcard review

**Returned**:
A card whose latest passed cold rep came after its latest borrow, stamped with the date it passed.
_On screen_: Proven, as in "Proven Oct 23, 2026".
_Avoid_: Done, mastered, learned

**Borrowed again**:
A returned card with a borrow dated after its return stamp, which needs a fresh cold rep.
_On screen_: Asked since proven, with "asked again" and the borrow's date on a card's row.
_Avoid_: Relapsed, overdue, expired

**Desk**:
The circulation desk: the cards still borrowed across your shelves, with your latest borrows and returns.
_On screen_: Home. The cards still borrowed, To prove and Asked since proven together, are the cards that "need a cold rep".
_Avoid_: Dashboard, overview

### Guests

**Guest**:
A visitor signed in as the one shared Guest account, without a password or an account of their own, and with no settings.
_Avoid_: Anonymous user, demo user, visitor

**Guest workspace**:
The shelves, uploads, cards, and reps every guest shares, wiped at midnight UTC each day back to one sorted demo shelf.
_Avoid_: Sandbox, playground, demo account

### Developers

**Playground**:
The app's screen at `/app/playground` that sends one real request to the API and shows the answer. The word means this screen only, never the guest workspace.
_Avoid_: Sandbox, console, API explorer

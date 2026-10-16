// Shared by the page and the server. Request and response shapes follow
// m1kuorg/basics#25's Requests table; the screen contracts follow its
// Screens and ownership table.

/** One of your own messages. `time` is Unix seconds. */
export type Message = { id: string; conversationId: string; text: string; time: number };

/** One stamp on a card. `date` is ISO yyyy-mm-dd, in UTC. */
export type Borrow = { messageId: string; text: string; date: string };

export type Card = {
  skill: string;
  count: number;
  firstMonth: string;
  lastMonth: string;
  borrows: Borrow[];
};

export type GroupRequest = { messages: { id: string; text: string }[] };
export type GroupResponse = { skills: { name: string; messageIds: string[] }[] };
export type RepRequest = {
  skill: string;
  phrasings: string[];
  earlierProblems: string[];
  withLesson: boolean;
};
export type RepResponse = { lesson?: string; problem: string };
export type CheckRequest = { skill: string; problem: string; answer: string };
export type CheckResponse = { verdict: "pass" | "fail"; reason: string };
export type ErrorResponse = { error: string };

// Screens. The page entry mounts one at a time into an emptied root.

export type LoadProps = {
  /** The parsed messages, or the parser's error message. */
  state: { messages: Message[] } | { error: string };
  onLoad: () => void;
  /** Asks the page entry to fetch and parse the export again. */
  onRetry: () => void;
};

export type StackProps = {
  /** The same array on every remount within one load, so the stack can keep its cards. */
  messages: Message[];
  /** Returned cards: skill -> ISO yyyy-mm-dd. */
  returned: ReadonlyMap<string, string>;
  onOpen: (card: Card) => void;
};

export type RepProps = {
  card: Card;
  /** Hands back today's date, ISO yyyy-mm-dd. */
  onReturned: (date: string) => void;
};

// The proof of concept's shapes, shared by its model routes (server/routes/)
// and the checks that still read the demo export with its parser. Request
// and response shapes follow m1kuorg/basics#25's Requests table.

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

// The landing's type chapters, in the sheet's order around the showcase and
// how it works (page.tsx): the hero, the nine phrasings, what leaves your
// computer, the agents, the questions, the closing question, and the footer.
// Every word is the brief's copy deck (sections 5 and 7); the lines with
// product or privacy weight come from copy.ts.
import { Fragment } from "react";
import { cn } from "cn";
import { AskStrip } from "@/components/ask-strip";
import { DemoChip } from "@/components/demo-chip";
import { Phrasing } from "@/components/phrasing";
import { Time } from "@/components/time";
import { GUEST_NOTE, PRIVACY_LINE } from "@/lib/copy";
import { months, plural } from "@/lib/format";
import { AsciiField } from "./ascii-field";
import { AXIS, CARD_A } from "./demo";
import { GuestAction, PINK } from "./guest";
import { Footage, Photo } from "./photo";
import CREDITS from "../../../public/images/credits.json";

export function HeroChapter() {
  return (
    <section aria-labelledby="hero-title" data-chapter-ink="light" className="relative isolate flex min-h-svh flex-col justify-between bg-plum-field px-(--margin) pt-[16svh] pb-6 md:pt-[15svh] md:pb-12">
      <AsciiField src="/images/exam-hall-1958.jpg" focus={[0.15, 0.77]} zoom={1.4} edge={0.3} className="-z-10" />
      <h1 id="hero-title" className="t-display text-[21vw] lg:text-[15.6vw]">
        <span className="line">
          <span className="load-line" data-n="1">
            Asked
          </span>
        </span>{" "}
        <span className="line">
          <span className="load-line" data-n="2">
            before?
          </span>
        </span>
      </h1>
      <p className="t-lead load-fade mt-16 w-[86%] text-pretty md:ml-auto md:w-[36%] md:min-w-[22rem]">
        If you keep asking a chatbot the same how-to, Asked Before finds those questions in your own chat history, then tests you on each one without AI.
      </p>
    </section>
  );
}

/** The idea's set piece: card A's nine phrasings, word for word, each with its date; then a photograph of a card catalog, on the phrasings' column. */
export function NineWaysChapter() {
  const asks = CARD_A.borrows;
  const first = asks[0]!.at;
  const last = asks.at(-1)!.at;
  return (
    <section aria-labelledby="nine-title" data-chapter-ink="dark" className="min-h-svh bg-white px-(--margin) py-28 text-navy-ink md:py-40">
      <div className="grid grid-cols-12 gap-x-6 gap-y-6">
        <h2 id="nine-title" data-reveal="" className="t-head col-span-12 max-w-[14ch] text-balance md:col-span-7">
          Nine ways to ask one thing
        </h2>
        <div data-reveal="" data-delay="1" className="col-span-12 flex flex-col gap-2 self-end md:col-span-4 md:col-start-9">
          <p className="t-lead font-semibold">{CARD_A.skill}</p>
          <p className="t-body">
            Asked {plural(asks.length, "time")}, {months(first, last)}, never in the same words twice.
          </p>
          <span data-ui className="[--radius:10px]">
            <DemoChip />
          </span>
        </div>
        <div data-ui data-reveal="fade" data-delay="2" className="col-span-12 mt-6 [--radius:10px] md:mt-10">
          <AskStrip axis={AXIS} asks={asks.map((ask) => ask.at)} className="h-6" />
        </div>
      </div>
      <ol className="mt-12 flex flex-col gap-5 md:mt-16 md:gap-6" aria-label={`The ${asks.length} messages, oldest first`}>
        {asks.map((ask, i) => (
          <li key={ask.at} data-reveal="" data-delay={String(Math.min(i, 10))} className="grid grid-cols-12 items-baseline gap-x-6 gap-y-1">
            <Time iso={ask.at} className="t-small col-span-12 text-muted-foreground md:col-span-2" />
            <p className="col-span-12 text-[clamp(1rem,4.4vw,1.25rem)] leading-[1.06] sm:text-[min(4vw,4rem)] font-semibold tracking-[-0.035em] text-pretty md:col-span-10">
              <Phrasing text={ask.text} />
            </p>
          </li>
        ))}
      </ol>
      <Photo
        src="/images/card-catalog-1932.jpg"
        width={2400}
        height={2006}
        alt="Two men in shirtsleeves at long wooden card-catalog cabinets; the nearer one draws a single card from an open drawer of entries filed under Jones."
        caption="A card catalog"
        date="1932"
        drift
        frame="h-[min(56svh,72vw)] md:h-[min(80svh,52vw)]"
        position="object-[50%_62%]"
        className="mt-16 pt-12 pb-4 md:mt-24 md:ml-[calc((100%-11*1.5rem)/12*2+3rem)]"
      />
    </section>
  );
}

const PROOF_ROWS: [what: string, leaves: string, model: string][] = [
  ["Your own messages", "Yes", "Your words only"],
  ["When you sent them", "Yes", "Never"],
  ["Each message's id in the export, so a re-upload isn't counted twice", "Yes", "Never"],
  ["The chatbot's answers", "Never", "Never"],
  ["Conversation titles", "Never", "Never"],
  ["System and tool messages", "Never", "Never"],
  ["Messages over 2,000 characters", "Never", "Never"],
];

/** What leaves your computer, as a table with no lines: rows told apart by tone. */
export function ProofChapter() {
  return (
    <section aria-labelledby="proof-title" data-chapter-ink="light" className="relative isolate min-h-svh bg-plum-surface px-(--margin) py-28 md:py-40">
      <AsciiField src="/images/pupil-blackboard-1956.jpg" dots focus={[0.4, 0.3]} className="-z-10" />
      <h2 id="proof-title" className="t-display text-[11vw] md:text-[clamp(3rem,5.6vw,5.5rem)]">
        <span className="line" data-reveal="line">
          <span>Your words,</span>
        </span>{" "}
        <span className="line pl-[calc((100%-11*1.5rem)/12*2+3rem)]" data-reveal="line" data-delay="1">
          <span>not your data</span>
        </span>
      </h2>
      <table className="t-body mt-14 w-full border-collapse md:mt-[72px]">
        <caption className="sr-only">What leaves your computer when you upload a chat export, and what the model sees</caption>
        <thead className="max-md:sr-only">
          <tr className="t-small text-muted-on-dark">
            <th scope="col" className="w-1/2 px-4 pb-3 text-left font-medium md:px-5">
              What
            </th>
            <th scope="col" className="w-1/4 px-4 pb-3 text-left font-medium md:px-5">
              Leaves your computer
            </th>
            <th scope="col" className="w-1/4 px-4 pb-3 text-right font-medium md:px-5">
              The model sees it
            </th>
          </tr>
        </thead>
        <tbody>
          {PROOF_ROWS.map(([what, leaves, model], i) => (
            <tr key={what} data-reveal="" data-delay={String(i)} className="flex flex-col px-4 py-3.5 even:bg-plum-black md:table-row md:p-0">
              <th scope="row" className="text-left font-semibold md:px-5 md:py-3.5">
                {what}
              </th>
              <td className="text-muted-on-dark md:px-5 md:py-3.5 md:text-white">
                <span className="md:sr-only">Leaves your computer: </span>
                {leaves}
              </td>
              <td className="text-muted-on-dark md:px-5 md:py-3.5 md:text-right md:text-white">
                <span className="md:sr-only">The model sees it: </span>
                {model}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-14 grid grid-cols-12 gap-x-6 gap-y-6 md:mt-20">
        <p data-reveal="" className="t-lead col-span-12 text-pretty md:col-span-7">
          {PRIVACY_LINE}
        </p>
        <p data-reveal="" data-delay="1" className="t-body col-span-12 text-muted-on-dark md:col-span-4 md:col-start-9 md:self-end">
          The server logs requests, never your words.
        </p>
      </div>
    </section>
  );
}

const AGENT_ROWS: [title: string, body: string, terms: [string, string, string]][] = [
  ["Claude Code plugin", "One install brings the MCP server and a skill that says when to use it.", ["plugin", "skill", "one command"]],
  ["MCP server", "For Claude Desktop, Cursor, or Claude Code without the plugin.", ["stdio", "an API key", "captures"]],
  ["TypeScript SDK", "A typed client for every endpoint, and the same export readers the upload page uses.", ["Bun", "Node", "the browser"]],
  ["HTTP API", "Version 1, with an API key or your session.", ["JSON", "Bearer keys", "documented"]],
];

/** The statement cell and the dark rows: what your coding agent can do with it. */
export function FeaturesChapter() {
  return (
    <section aria-labelledby="agents-title" className="grid md:grid-cols-2">
      <div data-chapter-ink="dark" className="flex min-h-svh flex-col justify-between gap-16 bg-panel px-(--margin) py-24 text-navy-ink md:py-28">
        <h2 id="agents-title" className="t-display text-[11vw] md:text-[clamp(3rem,5.6vw,5.5rem)]">
          <span className="line text-left" data-reveal="line">
            <span>Agents file it</span>
          </span>{" "}
          <span className="line text-right" data-reveal="line" data-delay="1">
            <span>as you ask.</span>
          </span>
        </h2>
        {/* Below 1024px the sentence and the link are spread apart too, so a full screen of panel never leaves half of it empty. */}
        <div className="flex flex-col items-start gap-8 max-lg:contents lg:flex-row lg:items-end lg:justify-between">
          <p data-reveal="" className="t-body max-w-[34ch]">
            The MCP server and the Claude Code plugin record the how-to questions you ask your coding agent, in your words only, and tell you when one is on a card you've asked before.
          </p>
          <a data-reveal="" data-delay="1" href="/docs" className="ink-link t-lead shrink-0 font-semibold" data-rest="underlined">
            Read the docs
          </a>
        </div>
      </div>
      {/* The field lies over the rows' two tones and under their words: the canvas comes first, and the words are positioned after it. */}
      <div data-chapter-ink="light" className="relative isolate grid min-h-svh bg-plum-black">
        <AsciiField src="/images/exam-dictation-1946.jpg" focus={[0.62, 0.4]} peak={0.25} />
        <ul className="grid grid-rows-4">
          {AGENT_ROWS.map(([title, body, terms], i) => (
            <li key={title} data-reveal="" data-delay={String(i)} className="flex flex-col gap-3 px-(--margin) py-8 odd:bg-plum-black even:bg-plum-surface lg:grid lg:grid-cols-12 lg:gap-x-5 lg:py-7 lg:pr-8">
              <h3 className="t-lead relative font-semibold lg:col-span-5">{title}</h3>
              <p className="t-body relative lg:col-span-4">{body}</p>
              <p className="t-small relative text-muted-on-dark lg:hidden">{terms.join(", ")}</p>
              <ul className="t-small relative hidden text-muted-on-dark lg:col-span-3 lg:block" aria-label={`${title} in three words`}>
                {terms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const FAQ: [question: string, answer: string][] = [
  ["What's a cold rep?", "A fresh problem of the same skill, answered in a plain box without AI. Fail, and you get the reason, the lesson again, and a different problem. Pass, and the card is marked Proven with today's date."],
  ["Which exports work?", "ChatGPT's and Claude's. Drop the zip they email you as it came, or the conversations.json inside it."],
  ["What does the model see?", "Your own messages' words. Never your dates, the chatbot's answers, or your titles."],
  ["How do I get my export?", "In ChatGPT, open Settings, then Data controls, and choose Export data. In Claude, open Settings, then Privacy, and choose Export data. Each emails you a link to a zip that works for 24 hours."],
  ["What if I ask again after proving it?", "The card becomes Asked since proven and needs a fresh cold rep."],
  ["Is there a daily limit?", "Yes. Asked Before runs on Cloudflare's free plan, so the whole app shares 20 model requests and 8,000 messages a day, guests included. More open at midnight UTC."],
  ["What does a guest see?", GUEST_NOTE],
  ["Can I delete my data?", "Download all of it as one JSON file, or delete your account and everything in it, from Settings. Anything you delete stays in the backups of Cloudflare, Asked Before's host, for up to 7 days."],
  ["What counts as a card?", "A how-to you asked more than once, even in different words. The sort catches most repeats, not every one."],
  ["Can my coding agent use it?", "Yes, with an API key from Settings: the MCP server, the Claude Code plugin, or the SDK."],
];

/** Answers as reading text: each question a run-in, two columns on a wide screen, with a film of a written examination under the heading (under the answers on a tablet). */
export function FaqChapter() {
  return (
    <section aria-labelledby="faq-title" data-chapter-ink="dark" className="grid min-h-svh grid-cols-12 gap-x-6 gap-y-10 bg-white px-(--margin) py-28 text-navy-ink md:py-40 lg:grid-rows-[auto_1fr]">
      <h2 id="faq-title" data-reveal="" className="t-head col-span-12 md:col-span-3 lg:col-span-4">
        Fair questions
      </h2>
      <Footage
        src="/images/exam-dictation-1946.mp4"
        poster="/images/exam-dictation-1946.jpg"
        width={688}
        height={550}
        caption="The dictation in an examination in Frisian, Leeuwarden, 1946"
        className="col-span-12 md:col-span-8 md:col-start-5 md:row-start-2 lg:col-span-4 lg:col-start-1"
      />
      <div className="t-body col-span-12 gap-x-14 md:col-span-8 md:col-start-5 md:row-start-1 lg:row-span-2 lg:columns-2">
        {FAQ.map(([question, answer]) => (
          // Reading text, so it's there when the eye arrives: no entrance, only the heading above it moves.
          <p key={question} className="mb-5 break-inside-avoid text-pretty">
            <span className="font-semibold">{question}</span> {answer}
          </p>
        ))}
      </div>
    </section>
  );
}

/** The question at both edges, and between them the two answers. */
export function CtaChapter() {
  return (
    <section
      aria-labelledby="cta-title"
      data-chapter-ink="light"
      className="relative isolate flex min-h-svh items-center justify-center bg-plum-field px-(--margin) pt-[calc(var(--cta)*0.9+8.5rem)] pb-[calc(var(--cta)*0.9+4.5rem)] [--cta:18vw] [--ring:var(--ring-on-dark)] md:[--cta:clamp(110px,11vw,168px)]"
    >
      <AsciiField src="/images/pupil-blackboard-1956.jpg" focus={[0.5, 0.36]} edge={0.6} className="-z-10" />
      <h2 id="cta-title" className="t-display absolute inset-x-(--margin) top-24 bottom-6 flex flex-col items-center justify-between text-center text-(length:--cta)">
        <span className="line" data-reveal="line">
          <span>Asked it</span>
        </span>{" "}
        <span className="line" data-reveal="line" data-delay="1">
          <span>before?</span>
        </span>
      </h2>
      <div className="relative flex w-full flex-col items-center gap-6">
        <div className="grid w-[72%] items-start gap-3 sm:w-auto sm:grid-cols-[13rem_auto_13rem] sm:gap-10">
          <GuestAction align="center" className="h-14 w-full sm:w-52" />
          <span className="t-body self-center text-center text-muted-on-dark">or</span>
          <a href="/signup" className={cn(PINK, "t-body flex h-14 w-full items-center justify-center bg-white hover:bg-panel sm:w-52")}>
            Sign up
          </a>
        </div>
        <p className="t-body max-w-[56ch] text-center text-pretty">
          {GUEST_NOTE}
        </p>
      </div>
    </section>
  );
}

/** The links, the credits, the legal line, then the name at full width, cut by the bottom edge; on a tall screen the room goes between the credits and the legal line. */
export function Footer() {
  return (
    <footer data-chapter-ink="light" className="@container relative isolate flex min-h-svh flex-col overflow-clip bg-plum-black px-(--margin) pt-28 text-white [--ring:var(--ring-on-dark)] md:pt-32">
      <AsciiField src="/images/exam-hall-1958.jpg" focus={[0.5, 0.5]} className="-z-10" />
      <div className="grid grid-cols-12 gap-x-6 gap-y-14">
        {/* Each link is at least 44px tall, for a finger. */}
        <ul className="col-span-12 flex flex-col gap-1 text-[clamp(1.25rem,1.1rem+0.7vw,1.625rem)] leading-[1.1] font-semibold tracking-[-0.035em] md:col-span-5 lg:text-[min(4vw,4rem)]">
          <li>
            <a href="/docs" className="ink-link inline-flex min-h-11 items-center text-pink">
              Docs
            </a>
          </li>
          <li>
            <a href="/login" className="ink-link inline-flex min-h-11 items-center text-pink">
              Log in
            </a>
          </li>
          <li>
            <a href="/signup" className="ink-link inline-flex min-h-11 items-center text-pink">
              Sign up
            </a>
          </li>
          <li>
            <GuestAction look="link" align="start" className="inline-flex min-h-11 items-center" />
          </li>
          <li>
            <a href="/privacy" className="ink-link inline-flex min-h-11 items-center text-pink">
              Privacy
            </a>
          </li>
        </ul>
        <div className="t-body col-span-12 flex flex-col gap-4 md:col-span-6 md:col-start-7">
          <p>
            Pictures and footage, also rendered as type:{" "}
            {CREDITS.map((credit, i) => (
              <Fragment key={credit.file}>
                {i > 0 && "; "}
                <a className="ink-link" data-rest="underlined" href={credit.page}>
                  “{credit.title}”
                </a>{" "}
                by {credit.creator},{" "}
                <a className="ink-link" data-rest="underlined" href={credit.licenseUrl}>
                  {credit.license}
                </a>
                , via {credit.via}
              </Fragment>
            ))}
            .
          </p>
          <p className="text-muted-on-dark">Set in Schibsted Grotesk, under the SIL Open Font License.</p>
        </div>
      </div>
      <div className="t-small mt-auto flex items-baseline justify-between gap-6 pt-20 md:pt-24">
        <p>The demo data is made up.</p>
        <a href="#top" className="ink-link" data-rest="underlined">
          Back to top
        </a>
      </div>
      {/* Sized to the footer's width: the name's ink runs 6.109em at this weight and tracking, so 1/6.15 of the width fits it between the margins at every width, cut by the bottom edge only. */}
      <p aria-hidden="true" className="t-display mt-12 -mb-[0.1em] text-[length:calc(100cqw/6.15)] leading-[0.8] whitespace-nowrap md:mt-16">
        Asked Before
      </p>
    </footer>
  );
}

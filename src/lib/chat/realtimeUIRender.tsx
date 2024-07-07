//@ts-nocheck
import "server-only";

import {
  RBotCard,
  RBotMessage,
  RSystemMessage,
  Realtime,
} from "@/components/genUI/realtime";
import { spinner } from "@/components/ui/spinner";

import { talkToPPLX } from "./utilities";

import { z } from "zod";

import { RealtimeSkeleton } from "@/components/genUI/realtime/realtime-skeleton";
import AgentLoader from "@/components/ui/AgentLoader";
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid,
} from "@/lib/utils";

import {
  SpinnerMessage,
  UserMessage,
} from "@/components/genUI/realtime/message";
export async function renderRUI(
  aiState: any,
  openai: any,
  render: any,
  createStreamableValue: any
) {
  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>;
  let textNode: undefined | React.ReactNode;

  const ui = render({
    model: "gpt-4-turbo",
    provider: openai,
    initial: <SpinnerMessage />,
    messages: [
      {
        role: "system",
        content: `\
        You are a realtime information based conversation bot and you can help users get information of a topic. You will be handling the query, send only the last relevant user message to perplexity ai and retrieve the answer and share it with the user.
        You and the user can discuss a topic or about a question and the user can ask for the realtime answer of a query.
        Messages inside [] means that it's a UI element or a user event. For example:
        - "[Answer = "Yes there is a lakers game today..."]" means that an interface of the answer with the content of the same is shown to the user.
    
        If the user requests checking the realtime information call \`show_realtime\` to show the realtime answer UI.
        If the user wants to complete another impossible task, respond that you are a demo and cannot do that.

        Besides that, you can also chat with users and do some calculations if needed.`,
      },
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name,
      })),
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue("");
        textNode = <RBotMessage content={textStream.value} />;
      }

      if (done) {
        textStream.done();
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: "assistant",
              content,
            },
          ],
        });
      } else {
        textStream.update(delta);
      }

      return textNode;
    },
    functions: {
      showRealtime: {
        description:
          "Display the realtime answer for a query that the user has made",
        parameters: z.object({
          answer: z
            .string()
            .describe(
              "the answer returned from perplexity ai for the query made by the user, which requires some piece of realtime information from the web"
            ),
        }),
        render: async function* ({ answer }: any) {
          yield (
            <RBotCard>
              <AgentLoader text="Connecting with realtime scraper agent" />
              <RealtimeSkeleton />
            </RBotCard>
          );

          let pplxAnswer = await talkToPPLX(aiState);
          answer = pplxAnswer.choices[0].message.content;

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: "function",
                name: "showRealtime",
                content: JSON.stringify({ answer }),
              },
            ],
          });

          return (
            <RBotCard>
              <AgentLoader text="Recieved realtime information. displaying" />

              <Realtime answer={answer} />
            </RBotCard>
          );
        },
      },
    },
  });

  return ui;
}

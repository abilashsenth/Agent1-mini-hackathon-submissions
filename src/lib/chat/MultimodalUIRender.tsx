// @ts-nocheck
import "server-only";

import {
  VBotCard,
  VBotMessage,
  VSystemMessage,
  Vision,
} from "@/components/genUI/vision";
import { spinner } from "@/components/ui/spinner";
import AgentLoader from "@/components/ui/AgentLoader";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { VisionSkeleton } from "@/components/genUI/vision/vision-skeleton";
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid,
} from "@/lib/utils";

import { SpinnerMessage, UserMessage } from "@/components/genUI/vision/message";
export async function renderVUI(
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
        You are a screen/camera vision based conversation bot and you can help users look at something through camera OR by looking at their screen and answer questions or use the visual information to do further operations.
        You and the user can discuss the information shown via the camera or their current screen. User communicates to you via microphone inside the mode.
        If the user requests camera based multimodal vision assistance, wants to know whats happening in their camera call \`open_camera\` to show the vision trigger UI for camera.
        If the user requests screen based multimodal vision assistance, wants to know whats happening in their screen call \`open_screen\` to show the vision trigger UI for screen.
        DO NOT ask the user to click on any buttons, simply call functions.
        Messages inside [] means that it's a UI element or a user event. For example:
        - "[Vision button = true]" means that an interface of the vision modal trigger is shown to the user.
        If the user wants to complete some other impossible task, respond that you are a demo and cannot do that.

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
        textNode = <VBotMessage content={textStream.value} />;
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
      openCamera: {
        description: "Display the camera vision assistance trigger button",
        parameters: z.object({}),
        render: async function* ({}) {
          yield (
            <VBotCard>
              <VisionSkeleton />
            </VBotCard>
          );

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: "function",
                name: "showVision",
                content: JSON.stringify({}),
              },
            ],
          });

          const supabase = createClient();
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          return (
            <VBotCard>
            <AgentLoader text="Let me initialize vision agent" />
            <Vision userId={user?.id} shouldRecordScreen={false} />
          </VBotCard>
          );
        },
      },openScreen: {
        description: "Display the screen vision assistance trigger button",
        parameters: z.object({}),
        render: async function* ({}) {
          yield (
            <VBotCard>
              <VisionSkeleton />
            </VBotCard>
          );

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: "function",
                name: "showVision",
                content: JSON.stringify({}),
              },
            ],
          });

          const supabase = createClient();
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          return (
            <VBotCard>
              <AgentLoader text="Let me initialize vision agent" />
              <Vision userId={user?.id} shouldRecordScreen={true} />
            </VBotCard>
          );
        },
      },
    },
  });

  return ui;
}

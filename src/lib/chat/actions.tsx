//@ts-nocheck
import "server-only";

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  render,
  createStreamableValue,
} from "ai/rsc";
import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import {
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase,
} from "@/components/genUI/stocks";
import { spinner } from "@/components/ui/spinner";

import { createClient } from "@/utils/supabase/server";

import { z } from "zod";
import { EventsSkeleton } from "@/components/genUI/stocks/events-skeleton";
import { Events } from "@/components/genUI/stocks/events";
import { StocksSkeleton } from "@/components/genUI/stocks/stocks-skeleton";
import { Stocks } from "@/components/genUI/stocks/stocks";

import { StockSkeleton } from "@/components/genUI/stocks/stock-skeleton";
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid,
} from "@/lib/utils";

import { SpinnerMessage, UserMessage } from "@/components/genUI/stocks/message";
import { Chat } from "@/lib/types";
import { categorizeNextMove } from "./utilities";

import { renderUI } from "./uiRender";
import { renderWUI } from "./weatherUIRender";
import { renderVUI } from "./MultimodalUIRender";
import { renderRUI } from "./realtimeUIRender";
import { renderSUI } from "./spotifyUIRender";
import { renderDalleUI } from "./DalleUIRender";
import { renderPikaUI } from "./PikaUIRender";


import { Weather } from "@/components/genUI/weather";
import { Vision } from "@/components/genUI/vision";
import { SpotifySongs } from "@/components/genUI/spotify/spotify-songs";
import { Realtime } from "@/components/genUI/realtime";
import { WBotCard } from "@/components/genUI/weather";
import { VBotCard } from "@/components/genUI/vision";
import { RBotCard } from "@/components/genUI/realtime";
import { SBotCard } from "@/components/genUI/spotify";
import { DalleBotCard } from "@/components/genUI/dalle";
import { PikaBotCard } from "@/components/genUI/pika";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

async function confirmPurchase(symbol: string, price: number, amount: number) {
  "use server";

  const aiState = getMutableAIState<typeof AI>();

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  );

  const systemMessage = createStreamableUI(null);

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000);

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    );

    await sleep(1000);

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{" "}
          {formatNumber(amount * price)}
        </p>
      </div>
    );

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={" "}
        {formatNumber(amount * price)}.
      </SystemMessage>
    );

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages.slice(0, -1),
        {
          id: nanoid(),
          role: "function",
          name: "showStockPurchase",
          content: JSON.stringify({
            symbol,
            price,
            defaultAmount: amount,
            status: "completed",
          }),
        },
        {
          id: nanoid(),
          role: "system",
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`,
        },
      ],
    });
  });

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value,
    },
  };
}

async function submitUserMessage(content: string) {
  "use server";

  const aiState = getMutableAIState<typeof AI>();

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: "user",
        content,
      },
    ],
  });

  let nextMoveCategory = await categorizeNextMove(aiState);
  const nextMoveContent = nextMoveCategory.choices[0].message.content;
  console.log("categorization result is ", nextMoveContent);

  if (nextMoveContent == "WEATHER") {
    const ui = await renderWUI(aiState, openai, render, createStreamableValue);

    return {
      id: nanoid(),
      display: ui,
    };
  } else if (nextMoveContent == "CAMERA") {
    const ui = await renderVUI(aiState, openai, render, createStreamableValue);

    return {
      id: nanoid(),
      display: ui,
    };
  } else if (nextMoveContent == "REALTIME") {
    const ui = await renderRUI(aiState, openai, render, createStreamableValue);

    return {
      id: nanoid(),
      display: ui,
    };
  } else if (nextMoveContent == "SPOTIFY") {
    const ui = await renderSUI(aiState, openai, render, createStreamableValue);

    return {
      id: nanoid(),
      display: ui,
    };
  } else if (nextMoveContent == "DALLE") {
    const ui = await renderDalleUI(
      aiState,
      openai,
      render,
      createStreamableValue
    );

    return {
      id: nanoid(),
      display: ui,
    };
    
  } else if (nextMoveContent == "PIKA") {
    const ui = await renderPikaUI(aiState, openai, render, createStreamableValue);

    return {
      id: nanoid(),
      display: ui,
    };
  } else {
    const ui = await renderUI(aiState, openai, render, createStreamableValue);
    return {
      id: nanoid(),
      display: ui,
    };
  }
}

export type Message = {
  role: "user" | "assistant" | "system" | "function" | "data" | "tool";
  content: string;
  id: string;
  name?: string;
};

export type AIState = {
  chatId: string;
  messages: Message[];
};

export type UIState = {
  id: string;
  display: React.ReactNode;
}[];

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmPurchase,
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  unstable_onGetUIState: async () => {
    "use server";
    console.log("unstable_onGetUIState called");
  },
  unstable_onSetAIState: async ({ state, done }: { state: any; done: any }) => {
    "use server";
    console.log("unstable_onSetAIState called");
  },
});

export const getUIStateFromAIState = (aiState: Chat) => {
  //this function is not updated as per the new agents like dalle, gumloop, etc.
  console.log("getUIStateFromAIState called");

  return aiState.messages
    .filter((message) => message.role !== "system")
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === "function" ? (
          message.name === "listStocks" ? (
            <BotCard>
              <Stocks props={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === "showStockPrice" ? (
            <BotCard>
              <Stock props={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === "showStockPurchase" ? (
            <BotCard>
              <Purchase props={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === "getEvents" ? (
            <BotCard>
              <Events props={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === "showWeather" ? (
            <WBotCard>
              <Weather {...JSON.parse(message.content)} />
            </WBotCard>
          ) : message.name === "showVision" ? (
            <VBotCard>
              <Vision {...JSON.parse(message.content)} />
            </VBotCard>
          ) : message.name === "showRealtime" ? (
            <RBotCard>
              <Realtime {...JSON.parse(message.content)} />
            </RBotCard>
          ) : message.name === "showTopSongs" ? (
            <SBotCard>
              <SpotifySongs {...JSON.parse(message.content)} />
            </SBotCard>
          ) : null
        ) : message.role === "user" ? (
          <UserMessage>{message.content}</UserMessage>
        ) : (
          <BotMessage content={message.content} />
        ),
    }));
};

//@ts-nocheck
import "server-only";
import AgentLoader from "@/components/ui/AgentLoader";
import {
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase,
} from "@/components/genUI/stocks";
import fetch from "node-fetch"; // If you're in a Node.js environment

import { spinner } from "@/components/ui/spinner";

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
export async function renderUI(
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
        You are an agent orchestration bot, that is capable of running Ai agents that handle stuff such as stocks, weather, camera, generate images, and you have access to much more tools
        If the user asked about stocks then You are a stock trading conversation bot and you can help users buy stocks, step by step.
        You and the user can discuss stock prices and the user can adjust the amount of stocks they want to buy, or place an order, in the UI.

        Messages inside [] means that it's a UI element or a user event. For example:
        - "[Price of AAPL = 100]" means that an interface of the stock price of AAPL is shown to the user.
        - "[User has changed the amount of AAPL to 10]" means that the user has changed the amount of AAPL to 10 in the UI.

        If the user requests purchasing a stock, call \`show_stock_purchase_ui\` to show the purchase UI.
        If the user just wants the price, call \`show_stock_price\` to show the price.
        If you want to show trending stocks, call \`list_stocks\`.
        If you want to show events, call \`get_events\`.
        If the user wants to sell stock, or complete another impossible task, respond that you are a demo and cannot do that.

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
        textNode = <BotMessage content={textStream.value} />;
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
      listStocks: {
        description: "List three imaginary stocks that are trending.",
        parameters: z.object({
          stocks: z.array(
            z.object({
              symbol: z.string().describe("The symbol of the stock"),
              price: z.number().describe("The price of the stock"),
              delta: z.number().describe("The change in price of the stock"),
            })
          ),
        }),
        render: async function* ({ stocks }) {
          yield (
            <BotCard>
              <AgentLoader text="Agent fetching stocks information" />

              <StocksSkeleton />
            </BotCard>
          );

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: "function",
                name: "listStocks",
                content: JSON.stringify(stocks),
              },
            ],
          });

          return (
            <BotCard>
              <Stocks props={stocks} />
            </BotCard>
          );
        },
      },
      showStockPrice: {
        description:
          "Get the current stock price of a given stock or currency. Use this to show the price to the user.",
        parameters: z.object({
          symbol: z
            .string()
            .describe(
              "The name or symbol of the stock or currency. e.g. DOGE/AAPL/USD."
            ),
          price: z.number().describe("The price of the stock."),
          delta: z.number().describe("The change in price of the stock"),
        }),
        // Inside your showStockPrice function
        render: async function* ({ symbol, price, delta }) {
          yield (
            <BotCard>
              <AgentLoader text="Stock info loaded by agent. Displaying.." />
              <StockSkeleton />
            </BotCard>
          );

          // Fetching the actual stock price
          const apiKey = process.env.ALPHAVANTAGE_API_KEY;
          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

          try {
            const response = await fetch(url);
            const data = await response.json();
            const realPrice = data["Global Quote"]["05. price"]; // Adjust based on the actual response structure

            aiState.done({
              ...aiState.get(),
              messages: [
                ...aiState.get().messages,
                {
                  id: nanoid(),
                  role: "function",
                  name: "showStockPrice",
                  content: JSON.stringify({ symbol, price: realPrice, delta }),
                },
              ],
            });

            return (
              <BotCard>
                <Stock props={{ symbol, price: realPrice, delta }} />
              </BotCard>
            );
          } catch (error) {
            console.error("Failed to fetch stock price:", error);
            // Handle error or fallback
          }
        },
      },
      showStockPurchase: {
        description:
          "Show price and the UI to purchase a stock or currency. Use this if the user wants to purchase a stock or currency.",
        parameters: z.object({
          symbol: z
            .string()
            .describe(
              "The name or symbol of the stock or currency. e.g. DOGE/AAPL/USD."
            ),
          price: z.number().describe("The price of the stock."),
          numberOfShares: z
            .number()
            .describe(
              "The **number of shares** for a stock or currency to purchase. Can be optional if the user did not specify it."
            ),
        }),
        render: async function* ({ symbol, price, numberOfShares = 100 }) {
          if (numberOfShares <= 0 || numberOfShares > 1000) {
            aiState.done({
              ...aiState.get(),
              messages: [
                ...aiState.get().messages,
                {
                  id: nanoid(),
                  role: "system",
                  content: `[User has selected an invalid amount]`,
                },
              ],
            });

            return <BotMessage content={"Invalid amount"} />;
          }

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: "function",
                name: "showStockPurchase",
                content: JSON.stringify({
                  symbol,
                  price,
                  numberOfShares,
                }),
              },
            ],
          });

          return (
            <BotCard>
              <Purchase
                props={{
                  numberOfShares,
                  symbol,
                  price: +price,
                  status: "requires_action",
                }}
              />
            </BotCard>
          );
        },
      },
      getEvents: {
        description:
          "List funny imaginary events between user highlighted dates that describe stock activity.",
        parameters: z.object({
          events: z.array(
            z.object({
              date: z
                .string()
                .describe("The date of the event, in ISO-8601 format"),
              headline: z.string().describe("The headline of the event"),
              description: z.string().describe("The description of the event"),
            })
          ),
        }),
        render: async function* ({ events }) {
          yield (
            <BotCard>
              <EventsSkeleton />
            </BotCard>
          );

          await sleep(1000);

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: "function",
                name: "getEvents",
                content: JSON.stringify(events),
              },
            ],
          });

          return (
            <BotCard>
              <Events props={events} />
            </BotCard>
          );
        },
      },
    },
  });

  return ui;
}

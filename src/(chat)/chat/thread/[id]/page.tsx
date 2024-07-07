import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import React, { useState } from 'react'
import { Chat } from "@/components/chat/chat";
import { AI } from "@/lib/chat/actions";
import { Session } from "@/lib/types";
import { getMessages, getUserID } from "@/utils/crudactions";

export interface ChatPageProps {
  params: {
    id: string;
  };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const supabase = createClient();
  const modelName = "gpt-4-turbo"  

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login`);
  }

  const chatID = params.id;
  const userID = user?.id;

  const ogUserID = await getUserID(chatID);

  if (ogUserID !== userID) {
    return notFound();
  }

  const messages = await getMessages(userID, chatID);

  if (messages.length != 0) {
    const modifiedMessages = messages.map((message) => {
      const { name, ...rest } = message;
      return name === null ? rest : message;
    });

    console.log("the messages recieved are", modifiedMessages);


    return (
      <AI initialAIState={{ chatId: chatID, messages: messages }}>
        <Chat id={chatID} usersession={user} model={modelName}/>
      </AI>
    );
  }

  return (
    <AI initialAIState={{ chatId: chatID, messages: [] }}>
      <Chat id={chatID} usersession={user} />
    </AI>
  );
}

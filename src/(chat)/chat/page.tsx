import { nanoid } from "@/lib/utils";
import { AI } from "@/lib/chat/actions";
import { createClient } from "@/utils/supabase/server";
import { spinner } from "@/components/ui/spinner";
import { redirect } from "next/navigation";
import { writeChat } from "../../../utils/crudactions";
export const metadata = {
  title: "Agent1",
};

export default async function IndexPage() {
  //this page simply assigns an id to a new chat and sends to chat/[id]/page.tsx
  const id = nanoid();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("user id is ", user?.id.toString());
  console.log("IndexPage called");

  if (user) {
    if (id && user?.id) {
      console.log("chat id ", id, "user id", user.id.toString());
      await writeChat(id, user.id.toString());
      return redirect(`/chat/thread/${id}`);
    }
  } else {
    return redirect(`/login`);
  }

  return (
    <div className="flex justify-center items-center h-full">{spinner}</div>
  );
}

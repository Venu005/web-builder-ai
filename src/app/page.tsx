"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const trpc = useTRPC();
  const [value, setValue] = useState("");
  const { data: messages } = useQuery(trpc.messages.getMany.queryOptions());
  const invoke = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: () => {
        toast.success("Background job started");
      },
    })
  );
  return (
    <div>
      <Input value={value} onChange={(e) => setValue(e.target.value)} />

      <Button
        disabled={invoke.isPending}
        onClick={() => invoke.mutate({ value: value })}
      >
        Invoke
      </Button>
      {JSON.stringify(messages, null, 2)}
    </div>
  );
};

export default Page;

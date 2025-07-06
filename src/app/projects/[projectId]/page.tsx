import { ProjectView } from "@/modules/projects/ui/views/ProjectView";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import React, { Suspense } from "react";
interface ProjectProps {
  params: Promise<{
    projectId: string;
  }>;
}
const Page = async ({ params }: ProjectProps) => {
  const { projectId } = await params;
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.messages.getMany.queryOptions({
      projectId,
    })
  );
  // fetch the particularn project
  void queryClient.prefetchQuery(
    trpc.projects.getOne.queryOptions({
      id: projectId,
    })
  );

  return (
    <Suspense fallback = {<p>Loading ...</p>}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProjectView projectId={projectId} />
      </HydrationBoundary>
    </Suspense>
  );
};

export default Page;

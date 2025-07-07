"use client";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { MessageContainer } from "../components/MessageContainer";
import { Suspense, useState } from "react";
import { Fragment } from "@/generated/prisma";
import { ProjectHeader } from "../components/ProjectHeader";
import { FragmentWeb } from "../components/FragmentWeb.";
interface ProjectViewProps {
  projectId: string;
}

export const ProjectView = ({ projectId }: ProjectViewProps) => {
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={35}
          minSize={20}
          className="flex flex-col min-h-0"
        >
          <Suspense fallback={<p>Loading project...</p>}>
            <ProjectHeader projectId={projectId} />
          </Suspense>
          <Suspense fallback={<p>Loadiing...</p>}>
            <MessageContainer
              projectId={projectId}
              activeFragment={activeFragment}
              setActiveFragment={setActiveFragment}
            />
          </Suspense>
        </ResizablePanel>
        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={65} minSize={50}>
          {
            !!activeFragment && <FragmentWeb data = {activeFragment} />
          }
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

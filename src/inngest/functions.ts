import {
  createAgent,
  createTool,
  createNetwork,
  openai,
  type Tool,
  type Message,
  createState,
} from "@inngest/agent-kit";
import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandBox, lastAssistantTextMessageCotnent } from "./utils";
import { z } from "zod";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import prisma from "@/lib/prisma";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("nextjs-venu-web-ai-test");
      await sandbox.setTimeout(60_000 * 10 * 3);
      return sandbox.sandboxId;
    });
    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        const formattedMessages: Message[] = [];
        const messages = await prisma.message.findMany({
          where: {
            projectId: event.data.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        });
        for (const message of messages) {
          formattedMessages.push({
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
            type: "text",
          });
        }
        return formattedMessages.reverse();
      }
    );
    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      }
    );
    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      system: PROMPT,
      description: "An expert coding agent",
      model: openai({
        model: "gpt-4.1",
        apiKey: process.env.OPENAI_API_KEY,
        defaultParameters: {
          temperature: 0.1,
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run the commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };

              try {
                const sandBox = await getSandBox(sandboxId);
                const result = await sandBox.commands.run(command, {
                  onStdout(data) {
                    buffers.stdout += data;
                  },
                  onStderr(data) {
                    buffers.stderr += data;
                  },
                });

                return result.stdout;
              } catch (error) {
                console.error(
                  `Command failed: ${error} \n stdout:${buffers.stdout}\nsrderror:${buffers.stderr}`
                );

                return `Command failed: ${error} \n stdout:${buffers.stdout}\nsrderror:${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run(
              "createOrUpdateFiles",
              async () => {
                try {
                  const updatedFiles = network.state.data.files || {};
                  const sandBox = await getSandBox(sandboxId);
                  for (const file of files) {
                    await sandBox.files.write(file.path, file.content);
                    updatedFiles[file.path] = file.content;
                  }

                  return updatedFiles;
                } catch (error) {
                  return "Error:" + error;
                }
              }
            );
            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          },
        }),

        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandBox = await getSandBox(sandboxId);
                const contents = [];
                for (const file of files) {
                  const content = await sandBox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (error) {
                console.error(`Error reading files: ${error}`);
                return `Error reading files: ${error}`;
              }
            });
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageCotnent(result);
          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network, callCount }) => {
        const summary = network.state.data.summary;

        // First call: always run the codeAgent
        if (callCount === 0) {
          return codeAgent;
        }

        // Check if we have a summary indicating completion
        if (summary && summary.includes("<task_summary>")) {
          return; // Stop execution
        }

        // Continue with the agent if we haven't reached completion
        return codeAgent;
      },
    });

    const res = await network.run(event.data.value, { state: state });
    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      system: FRAGMENT_TITLE_PROMPT,
      description: "A fragment title generator",
      model: openai({
        model: "gpt-4o",
      }),
    });
    const responseGenerator = createAgent({
      name: "response-generator",
      system: RESPONSE_PROMPT,
      description: "A response generator",
      model: openai({
        model: "gpt-4o",
      }),
    });
    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      res.state.data.summary
    );
    const { output: responseOutput } = await responseGenerator.run(
      res.state.data.summary
    );
    const generateFragmentTitle = () => {
      if (fragmentTitleOutput[0].type !== "text") return "Fragment";

      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt) => txt).join("");
      } else {
        return fragmentTitleOutput[0].content;
      }
    };
    const generateResponse = () => {
      if (responseOutput[0].type !== "text") return "Here you go";

      if (Array.isArray(responseOutput[0].content)) {
        return responseOutput[0].content.map((txt) => txt).join("");
      } else {
        return responseOutput[0].content;
      }
    };
    const isError =
      !res.state.data.summary ||
      Object.keys(res.state.data.files || {}).length === 0;
    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandBox = await getSandBox(sandboxId);
      const host = sandBox.getHost(3000);

      return `https://${host}`;
    });
    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again later.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }
      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sanboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
              files: res.state.data.files,
            },
          },
        },
      });
    });
    return {
      status: "ok",
      sandboxUrl,
      title: "Fragment",
      files: res.state.data.files,
      summary: res.state.data.summary,
    };
  }
);

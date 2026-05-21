#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OpenAI } from "openai";
import { CodeAnalyzer } from "playwright-mcp-server/dist/code-analyzer.js";

const server = new McpServer({
  name: "Playwright Test Generator",
  version: "1.0.0",
});

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

server.tool(
  "listTestFiles",
  "List relevant Playwright test files for a given page by scanning the test directory.",
  {
    directory: z.string().min(1),
    pagePath: z.string().min(1),
  },
  async ({ directory, pagePath }) => {
    try {
      const testFiles = await CodeAnalyzer.findRelevantTestFiles(directory, pagePath);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(testFiles, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text:
              error instanceof Error
                ? `Error listing test files: ${error.message}`
                : "Error listing test files",
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "generateTest",
  "Generate a Playwright test for a given page and requirements prompt, following existing project patterns.",
  {
    directory: z.string().min(1),
    pagePath: z.string().min(1),
    prompt: z.string().min(1),
  },
  async ({ directory, pagePath, prompt }) => {
    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return {
          content: [
            {
              type: "text",
              text:
                "Missing OPENAI_API_KEY. Set it in the MCP server env (recommended via VS Code input variables).",
            },
          ],
          isError: true,
        };
      }

      const { codePatterns } = await CodeAnalyzer.analyzeTestFiles(directory, pagePath);

      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a test generation assistant. Generate Playwright test code based on the provided patterns and requirements.",
          },
          {
            role: "user",
            content: `Code Patterns:\n${JSON.stringify(
              codePatterns,
              null,
              2
            )}\n\nRequirements:\n${prompt}\n\nGenerate a Playwright test that follows these patterns and requirements.`,
          },
        ],
      });

      const generatedTest = response.choices?.[0]?.message?.content || "";
      return {
        content: [
          {
            type: "text",
            text: generatedTest,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text:
              error instanceof Error
                ? `Error generating test: ${error.message}`
                : "Error generating test",
          },
        ],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

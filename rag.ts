import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { pull } from "langchain/hub";
import * as fs from 'fs';

interface Command {
  extensionCommand: string;
  extensionCommandDescription: string;
}

interface Extension {
  extensionTitle: string;
  extensionDescription: string;
  extensionURL: string;
  extensionIconURL: string;
  extensionCreator: string;
  extensionCreatorURL: string;
  commands: Command[];
}


const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0 
});

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large"
});

const vectorStore = new MemoryVectorStore(embeddings);

// Load extension data
const extensionData: Extension[] = JSON.parse(fs.readFileSync('extensions.json', 'utf-8'));

// Convert extensions to searchable documents
const documents = extensionData.map((extension: Extension) => {
  const commandsList = extension.commands.map((cmd: Command) => 
    `Command: ${cmd.extensionCommand}\nDescription: ${cmd.extensionCommandDescription}`
  ).join('\n');
  
  return new Document({
    pageContent: `Extension: ${extension.extensionTitle}\nDescription: ${extension.extensionDescription}\nCreator: ${extension.extensionCreator}\nCommands:\n${commandsList}`,
    metadata: {
      title: extension.extensionTitle,
      url: extension.extensionURL,
      creator: extension.extensionCreator
    }
  });
});

// Index documents in vector store
await vectorStore.addDocuments(documents);

// Load QA prompt template
const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");

// Define state types for the pipeline
const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});


// Retrieve relevant documents
const retrieve = async (state: typeof InputStateAnnotation.State) => {
  const retrievedDocs = await vectorStore.similaritySearch(state.question)
  return { context: retrievedDocs };
};

// Generate answer using retrieved context
const generate = async (state: typeof StateAnnotation.State) => {
  const docsContent = state.context.map(doc => doc.pageContent).join("\n");
  const messages = await promptTemplate.invoke({ 
    question: state.question, 
    context: docsContent 
  });
  const response = await llm.invoke(messages);
  return { answer: response.content };
};


// Create and compile the processing graph
const graph = new StateGraph(StateAnnotation)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", "__end__")
  .compile();

// Example query
const USER_COMMAND = "pick a color"
const query = { 
  question: `Which extension and command would I use to ${USER_COMMAND}. Output extensionTitle, extensionCommand`
};

// Execute query and log result
const result = await graph.invoke(query);
console.log(result.answer);
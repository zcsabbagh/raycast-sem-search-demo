# raycast


## Setup Instructions

1. Set up your OpenAI API key:
   ```bash
   export OPENAI_API_KEY='your-api-key-here'
   ```

2. Install required dependencies:
   ```bash
   npm i zod playwright llm-scraper @ai-sdk/openai langchain @langchain/community @langchain/langgraph
   ```

3. Run the scraping script:
   Feel free to change the NUM_PAGES variable to scrape more or fewer pages.
   This might take a while to run.
   ```bash
   ts-node --loader ts-node/esm scrape.ts
   ```

4. Run the RAG script:
   Feel free to change the USER_COMMAND variable to test different queries.
      ```bash
   ts-node --loader ts-node/esm rag.ts
   ```


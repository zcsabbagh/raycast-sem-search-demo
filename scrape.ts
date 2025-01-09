import { chromium, Browser, Page } from 'playwright'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import LLMScraper from 'llm-scraper'
import fs from 'fs'

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
  commands?: Command[];
}

// Zod schemas
const commandSchema = z.object({
  extensionCommand: z.string(),
  extensionCommandDescription: z.string(),
});

const extensionSchema = z.object({
  extensionTitle: z.string(),
  extensionDescription: z.string(),
  extensionURL: z.string(),
  extensionIconURL: z.string(),
  extensionCreator: z.string(),
  extensionCreatorURL: z.string(),
  commands: z.array(commandSchema).optional()
});

const extensionsResponseSchema = z.object({
  top: z.array(extensionSchema).describe('10 listed extensions on Raycast'),
});

const commandsResponseSchema = z.object({
  top: z.array(commandSchema).describe('Extension commands'),
});

// Setup browser, llm and scraper
const browser: Promise<Browser> = chromium.launch();
const llm = openai.chat('gpt-4o');
const scraper = new LLMScraper(llm);

/**
 * Scrapes commands for a specific Raycast extension
 * @param url - The URL of the extension page
 * @returns Promise<Command[]> - Array of commands for the extension
 */
async function scrapeExtensionsCommands(url: string): Promise<Command[]> {
  const page: Page = await (await browser).newPage();
  await page.goto(url);

  // Click the Commands button to show commands list
  await page.click('span.PillLink_pillLink__NNekp.PillLink_active__vkybv');
  await new Promise(resolve => setTimeout(resolve, 500));

  const { data } = await scraper.run(page, commandsResponseSchema, {
    format: 'html',
  });

  await page.close();
  return data.top;
}

/**
 * Scrapes Raycast extensions from a specific page
 * @param url - The URL of the extensions page
 * @returns Promise<Extension[]> - Array of extensions with their commands
 */
async function scrapeRaycastExtensions(url: string): Promise<Extension[]> {
  const page: Page = await (await browser).newPage();
  await page.goto(url);

  const { data } = await scraper.run(page, extensionsResponseSchema, {
    format: 'html',
  });
  await page.close();

  // Fetch the commands for each extension
  for (const extension of data.top) {
    const commands = await scrapeExtensionsCommands(extension.extensionURL);
    extension.commands = commands;
  }

  console.log(JSON.stringify(data.top, null, 2));
  return data.top;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const NUM_PAGES = 1;
    const allExtensions: Extension[] = [];
    
    for (let i = 1; i <= NUM_PAGES; i++) {
      const extensions = await scrapeRaycastExtensions(`https://www.raycast.com/store/trending/${i}#list`);
      allExtensions.push(...extensions);
    }

    // Write all extensions to a file
    fs.writeFileSync(
      'extensions.json', 
      JSON.stringify(allExtensions, null, 2),
      'utf-8'
    );
    
    console.log(`Successfully wrote ${allExtensions.length} extensions to extensions.json`);
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await (await browser).close();
  }
}

// Execute the scraping
main().catch(console.error); 
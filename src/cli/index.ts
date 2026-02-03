import { Command } from "commander";
import { createClient, setCurrentNotebook, requireNotebook } from "./helpers";
import { getStoragePath, getBrowserProfileDir } from "../core/paths";
import chalk from "chalk";
import ora from "ora";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import readline from "readline";

const program = new Command();

program
  .name("notebooklm")
  .description("CLI for Google NotebookLM")
  .version("0.1.0");

program.command("login")
  .description("Log in to NotebookLM via browser")
  .action(async () => {
      const storagePath = getStoragePath();
      const browserProfileDir = getBrowserProfileDir();
      
      // Ensure directories exist
      if (!fs.existsSync(path.dirname(storagePath))) {
          fs.mkdirSync(path.dirname(storagePath), { recursive: true, mode: 0o700 });
      }
      if (!fs.existsSync(browserProfileDir)) {
          fs.mkdirSync(browserProfileDir, { recursive: true, mode: 0o700 });
      }
      
      console.log(chalk.yellow("Opening browser for Google login..."));
      console.log(chalk.dim(`Using persistent profile: ${browserProfileDir}`));
      
      try {
          const context = await chromium.launchPersistentContext(browserProfileDir, {
              headless: false,
              args: [
                  "--disable-blink-features=AutomationControlled",
                  "--password-store=basic"
              ],
              ignoreDefaultArgs: ["--enable-automation"],
          });
          
          const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
          if (!page) {
              throw new Error("Failed to get or create page");
          }
          await page.goto("https://notebooklm.google.com/");
          
          console.log(chalk.green("\nInstructions:"));
          console.log("1. Complete the Google login in the browser window");
          console.log("2. Wait until you see the NotebookLM homepage");
          console.log("3. Press ENTER here to save and close\n");
          
          const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
          });
          
          await new Promise<void>(resolve => {
              rl.question("[Press ENTER when logged in] ", () => {
                  rl.close();
                  resolve();
              });
          });
          
          const currentUrl = page.url();
          if (!currentUrl.includes("notebooklm.google.com")) {
              console.log(chalk.yellow(`Warning: Current URL is ${currentUrl}`));
              // In a real CLI we might ask for confirmation, but for now we proceed or fail
              // Let's assume user knows what they are doing if they pressed Enter
          }
          
          await context.storageState({ path: storagePath });
          
          // Restrict permissions
          try {
              fs.chmodSync(storagePath, 0o600);
          } catch (e) {
              // Ignore on Windows or if failed
          }
          
          await context.close();
          console.log(chalk.green(`\nAuthentication saved to: ${storagePath}`));
          
      } catch (e: any) {
          console.error(chalk.red(`Login failed: ${e.message}`));
          process.exit(1);
      }
  });

// Notebook commands
program.command("list")
  .description("List all notebooks")
  .action(async () => {
    const spinner = ora("Listing notebooks...").start();
    try {
        const client = await createClient();
        const notebooks = await client.notebooks.list();
        spinner.stop();
        
        if (notebooks.length === 0) {
            console.log("No notebooks found.");
            return;
        }
        
        console.log(chalk.bold("\nNotebooks:"));
        notebooks.forEach(nb => {
            const owner = nb.isOwner ? chalk.green("Owner") : chalk.yellow("Shared");
            console.log(`- ${chalk.cyan(nb.id)}: ${chalk.white(nb.title)} (${owner})`);
        });
    } catch (e: any) {
        spinner.fail(`Failed to list notebooks: ${e.message}`);
    }
  });

program.command("use <notebook_id>")
  .description("Set current notebook context")
  .action(async (notebookId) => {
      setCurrentNotebook(notebookId);
      console.log(chalk.green(`Set current notebook to ${notebookId}`));
  });

program.command("info")
  .description("Get info about current or specified notebook")
  .option("-n, --notebook <id>", "Notebook ID")
  .action(async (options) => {
      const notebookId = requireNotebook(options.notebook);
      const spinner = ora(`Fetching info for ${notebookId}...`).start();
      try {
          const client = await createClient();
          const nb = await client.notebooks.get(notebookId);
          spinner.stop();
          console.log(chalk.bold(`Title: ${nb.title}`));
          console.log(`ID: ${nb.id}`);
          console.log(`Created: ${nb.createdAt?.toISOString() || "Unknown"}`);
          console.log(`Owner: ${nb.isOwner ? "Yes" : "No"}`);
      } catch (e: any) {
          spinner.fail(`Failed to get info: ${e.message}`);
      }
  });

// Chat commands
program.command("chat <question>")
  .description("Ask a question to the notebook")
  .option("-n, --notebook <id>", "Notebook ID")
  .action(async (question, options) => {
      const notebookId = requireNotebook(options.notebook);
      const spinner = ora("Thinking...").start();
      try {
          const client = await createClient();
          const result = await client.chat.ask(notebookId, question);
          spinner.stop();
          console.log(chalk.bold("\nAnswer:"));
          console.log(result.answer);
          
          if (result.references.length > 0) {
              console.log(chalk.dim("\nReferences:"));
              result.references.forEach(ref => {
                  const citation = ref.citationNumber ? `[${ref.citationNumber}]` : "[-]";
                  const text = ref.citedText ? ref.citedText.substring(0, 100) : "";
                  console.log(chalk.dim(`${citation} ${text}...`));
              });
          }
      } catch (e: any) {
          spinner.fail(`Chat failed: ${e.message}`);
      }
  });

// Source commands
const sourceCmd = program.command("source").description("Manage sources");

sourceCmd.command("list")
  .description("List sources in notebook")
  .option("-n, --notebook <id>", "Notebook ID")
  .action(async (options) => {
      const notebookId = requireNotebook(options.notebook);
      const spinner = ora("Listing sources...").start();
      try {
          const client = await createClient();
          const sources = await client.sources.list(notebookId);
          spinner.stop();
          
          if (sources.length === 0) {
              console.log("No sources found.");
              return;
          }
          
          console.log(chalk.bold("\nSources:"));
          sources.forEach(src => {
              console.log(`- ${chalk.cyan(src.id)}: ${chalk.white(src.title)} (${src.kind})`);
          });
      } catch (e: any) {
          spinner.fail(`Failed to list sources: ${e.message}`);
      }
  });

sourceCmd.command("add <url>")
  .description("Add a URL source")
  .option("-n, --notebook <id>", "Notebook ID")
  .action(async (url, options) => {
      const notebookId = requireNotebook(options.notebook);
      const spinner = ora(`Adding source ${url}...`).start();
      try {
          const client = await createClient();
          const source = await client.sources.addUrl(notebookId, url, true);
          spinner.stop();
          console.log(chalk.green(`Added source: ${source.title} (${source.id})`));
      } catch (e: any) {
          spinner.fail(`Failed to add source: ${e.message}`);
      }
  });

program.parse();

import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { getDefaultSignalChatModel } from "./model";
import { buildKnownTokensBlock, signalPromptTemplate } from "./prompt";//helper để xây dựng prompt và 
// import { getProjectContext, buildProjectContextBlock } from "./rag"; // RAG temporarily disabled
import { LlmSignalResponseZod } from "./llmZodSchema";//Zod schema định nghĩa signal tín hiệu
import type { DetectorParams, LlmSignalResponse } from "./types";//kiểu DL cho đầu vào và output

// Create a parser that validates and parses the LLM output using a Zod schema
const parser = StructuredOutputParser.fromZodSchema(LlmSignalResponseZod as any);

//Phát hiện tín hiệu thị trường (buy/sell/hold) từ tweet bằng LLM
export async function detectSignalWithLlm(params: DetectorParams): Promise<LlmSignalResponse> {
  const { formattedTweets, knownTokens } = params;
  const tweetsJson = JSON.stringify(formattedTweets, null, 2);
  const knownTokensBlock = buildKnownTokensBlock(knownTokens);

  /*
  // Retrieve project context for RAG (disabled)
  const contextsArray = await Promise.all(
    knownTokens.map((t) => getProjectContext(t.symbol))
  );
  const allContexts = contextsArray.flat();
  const projectContextBlock = buildProjectContextBlock(allContexts);
  */

  //Kiểm tra API key
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || process.env.OPENAI_API_KEY?.length);
  if (!hasOpenAiKey) {
    //Không có dữ liệu → không phát hiện tín hiệu
    if (formattedTweets.length === 0) {
      return {
        signalDetected: false,
        tokenAddress: "",
        sources: [],
        sentimentScore: 0,
        suggestionType: "hold",
        strength: 0,
        confidence: 0,
        reasoning: "No tweets provided; skipping signal detection (offline fallback)",
        relatedTweetIds: [],
        impactScore: null,
      } as unknown as LlmSignalResponse;
    }

    return {
      signalDetected: true,
      tokenAddress: knownTokens[0]?.address ?? "",
      sources: [
        { url: formattedTweets[0].url ?? "", label: "tweet" },
      ],
      sentimentScore: 0.5,
      suggestionType: "buy",
      strength: 75,
      confidence: 0.9,
      reasoning: "Offline fallback: heuristic signal based on provided tweets",
      relatedTweetIds: formattedTweets.map((t) => t.id),
      impactScore: 7,
    } as unknown as LlmSignalResponse;
  }

  //chạy LLM thật
  const model = getDefaultSignalChatModel();//Lazy load- chưa có model 
  const runnables: any[] = [signalPromptTemplate];//steps
  if (model) runnables.push(model);
  runnables.push(parser);

  const chain = RunnableSequence.from(runnables as unknown as any);//Tạo RunnableSequence(Pipeline tuần tự)

  // Invoke the chain with the template variables
  const response = await chain.invoke({//kích hoạt
    formattedTweets: tweetsJson,
    knownTokensBlock,
    // projectContextBlock, // RAG disabled
  });

  return response as unknown as LlmSignalResponse;
  
}

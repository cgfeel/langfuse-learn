import OpenAI from 'openai';
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources';
import { sdk } from './instrumentation.js';
import { startActiveObservation } from '@langfuse/tracing';

// lesson-3
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

const handleGenerationObserver = ({ body, name }: ObserverProps) =>
  startActiveObservation(
    name,
    async (generation) => {
      const res = await client.chat.completions.create(body);
      const message = res.choices[0].message;

      // input：这次请求发出去的 messages 数组
      // output：模型这一跳的产出——content + reasoning_content
      const reasoning = 'reasoning_content' in message ? message.reasoning_content : undefined;
      generation.update({
        input: message,
        model: body.model,
        output: {
          content: message.content,
          ...(reasoning ? { reasoning_content: reasoning } : {}),
        },
        usageDetails: res.usage
          ? {
              input: res.usage.prompt_tokens,
              output: res.usage.completion_tokens,
              total: res.usage.total_tokens,
            }
          : undefined,
      });

      return [res, message, reasoning] as const;
    },
    { asType: 'generation' }
  );

async function main() {
  // 1. 先列出可用模型，自己确认真实情况
  console.log('=== 可用模型 ===');

  const models = await client.models.list();
  console.log(JSON.stringify(models.data, null, 2));

  // 2. 发一次真实的 chat completion
  const question = 'Langfuse 的 trace 和 span 有什么区别';
  const messages = [
    { role: 'system', content: '你是一个简洁的助手' },
    { role: 'user', content: question },
  ] as const;

  const [res, message, reasoning] = await handleGenerationObserver({
    body: {
      messages: [...messages],
      model: 'deepseek-flash',
    },
    name: 'deepseek-flash:chat',
  });

  // 3. 完整打印 usage
  console.log('\n=== usage ===');
  console.log(JSON.stringify(res.usage, null, 2));
  console.log('usage 的字段:', Object.keys(res.usage ?? {}));

  // 4. 完整打印 choices[0].message
  //   const message = res.choices[0].message;
  console.log('\n=== message ===');
  console.log(JSON.stringify(message, null, 2));
  console.log('message 的字段', Object.keys(message));

  // 5. 单独确认 reasoning_content 是否存在
  if (reasoning) {
    console.log('\n=== reasoning_content 存在 ===');
    console.log(reasoning);
  } else {
    console.log('\n=== 没有 reasoning_content（当前模型可能不是 reasoning 模型） ===');
  }

  // 6. 最后把自然语言回答也打出来，方便肉眼确认
  console.log('\n=== 回答 ===');
  console.log(message.content);
}

await main()
  .then(async () => {
    await sdk.shutdown();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('调用失败：', err);
    await sdk.shutdown();
    process.exit(1);
  });

interface ObserverProps {
  body: ChatCompletionCreateParamsNonStreaming;
  name: string;
}

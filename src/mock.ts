import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';
import { sdk } from './instrumentation.js';

// lesson-2
const question = 'Langfuse 的 trace 和 span 有什么区别?';
const answer = 'trace 是容器,span 是步骤。';

await propagateAttributes(
  {
    sessionId: 'session-abc',
    tags: ['learning', 'mock'],
    traceName: '回答用户问题',
    userId: 'user-42',
  },
  async () => {
    await startActiveObservation('回答用户问题', async (trace) => {
      // TODO 1: 给 trace 设置 input(用 question)
      trace.update({ input: question });

      // TODO 2: 建一个名为「检索知识库」的普通子步骤
      //         设置 input/output,然后 sleep 100ms 模拟耗时
      //         提示:不用手动 end(),回调结束自动结束
      await startActiveObservation('检索知识库', async (span) => {
        (span.update({
          input: { query: question },
          output: { docs: ['doc-1', 'doc-2'] },
        }),
          await new Promise((resolve) => setTimeout(resolve, 100)));
      });

      // TODO 3: 建一个名为「调用模型」的 generation
      //         选项要写 { asType: 'generation' }
      //         设置 model: 'deepseek-flash'
      //         设置 usageDetails: { input: 26, output: 41, total: 67 }
      //         设置 input(prompt 数组)和 output(response 对象)
      await startActiveObservation(
        '调用模型',
        async (generation) => {
          generation.update({
            input: [
              { role: 'system', content: '你是一个知识助手' },
              { role: 'user', content: question },
            ],
            model: 'deepseek-flash',
            usageDetails: { input: 26, output: 41, total: 67 },
          });
        },
        { asType: 'generation' }
      );

      // TODO 4: 给 trace 设置 output(用 answer)
      trace.update({ output: answer });
    });
  }
);

await sdk.shutdown();
console.log('✓ 已发送');

import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;
const baseUrl = process.env.LANGFUSE_BASE_URL;

const problems: string[] = [];
if (!publicKey || !secretKey) {
  problems.push('LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY 未设置');
} else if (!/^[\x20-\x7e]+$/.test(publicKey) || !/^[\x20-\x7e]+$/.test(secretKey)) {
  problems.push('key 里含有非 ASCII 字符(中文占位符没替换掉?)');
} else if (!publicKey.startsWith('pk-lf-') || !secretKey.startsWith('sk-lf-')) {
  problems.push('key 格式不对,应以 pk-lf- / sk-lf- 开头');
}

if (!baseUrl) {
  problems.push('LANGFUSE_BASE_URL 未设置');
} else if (!/^https?:\/\//i.test(baseUrl)) {
  problems.push(`LANGFUSE_BASE_URL 缺少协议(http://),当前是 "${baseUrl}"`);
} else if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
  // 自建 Langfuse 的头号坑:代码在本机跑时,localhost 指向本机,
  // 而不是部署 Langfuse 的那台服务器。
  console.warn(
    `[instrumentation] ⚠ LANGFUSE_BASE_URL=${baseUrl} 指向本机。` +
      ' 若 Langfuse 部署在另一台机器,请改成那台机器的局域网 IP。'
  );
}

if (problems.length > 0) {
  console.error('\n✗ 埋点配置有问题,已停止,避免发出一堆必然失败的请求:');
  for (const p of problems) console.error('  · ' + p);
  console.error('\n修复:编辑 .env,填入 Langfuse UI → Settings → API Keys 里的真实 key。\n');
  process.exit(1);
}

export const spanProcessor = new LangfuseSpanProcessor();
export const sdk = new NodeSDK({
  spanProcessors: [spanProcessor],
});

sdk.start();

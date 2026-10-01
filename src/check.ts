import { sdk } from './instrumentation.js';

// lesson-1
const baseUrl = process.env.LANGFUSE_BASE_URL ?? '';
const publicKey = process.env.LANGFUSE_PUBLIC_KEY ?? '';
const secretKey = process.env.LANGFUSE_SECRET_KEY ?? '';

// 只回显前缀和长度，避免完整密钥出现在终端输出或命令历史里
console.log('[check] base URL  :', baseUrl);
console.log('[check] public key:', publicKey ? `${publicKey.slice(0, 12)}…` : '(未设置)');
console.log('[check] secret key:', secretKey ? `***已设置(长度 ${secretKey.length})` : '(未设置)');

// Langfuse 的 Basic Auth 是 username=publicKey, password=secretKey,
// 中间的冒号不能少,否则服务端拆不出用户名/密码,直接 401
const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

let res: Response;
try {
  res = await fetch(`${baseUrl}/api/public/projects`, {
    headers: { Authorization: `Basic ${auth}` },
    // 加超时,否则地址不可达时可能挂很久
    signal: AbortSignal.timeout(10_000),
  });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ 连不上 ${baseUrl}`);
  console.error('  底层错误:', msg);
  console.error('\n排查:');
  console.error('  1. 地址对不对?自建 Langfuse 应是 http://<服务器IP>:3000');
  console.error('  2. 别写 localhost —— 那指向你自己这台机器');
  console.error('  3. 服务活没活?浏览器打开这个地址看有没有登录页');

  await sdk.shutdown();
  process.exit(1);
}

console.log('\n[check] HTTP 状态码:', res.status);
if (res.ok) {
  const body = (await res.json()) as { data?: Array<{ name: string }> };
  const names = body.data?.map(({ name }) => name).join(', ') ?? '(无)';

  console.log('✓ 认证通过。当前 key 可见的项目:', names);
  console.log('  ↑ 记住这个名字:数据会进这个项目,别在别的项目里找');
  console.log('\n下一步: npm run mock');
} else {
  console.error('✗ 认证失败。响应体:', (await res.text()).slice(0, 300));
  console.error('\n排查:');
  console.error('  401          → key 错了,检查是否整行粘贴、有无多余空格');
  console.error('  连不上/超时  → base URL 错了,应为 http://192.168.0.87:3000');
  console.error('  404          → 服务没起来,先访问一下 UI 首页');
}

// 短生命周期脚本必须 shutdown:
//   1. 把缓冲区里还没发出去的数据 flush 掉
//   2. 关掉 OTel 的后台定时器,否则进程会挂着不退出
await sdk.shutdown();
process.exit(res.ok ? 0 : 1);

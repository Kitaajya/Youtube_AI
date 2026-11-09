import {fileURLToPath, URL} from 'node:url';
import {defineConfig, loadEnv} from 'vite';
import {absolutePublicAssets} from './src/vite-plugin-absolute-assets.js';

/* ===== 多页入口 =====
 * 11 个 HTML 页面位于 frontend 根目录，逐个登记为构建入口，
 * 保持「一个页面一个 HTML」的原有多页结构，不合并成 SPA。
 * 构建后各页面输出到 dist 根目录，页面间的相对跳转（watch.html?id=xxx）继续可用。
 */
const PAGES = [
    'index',
    'login',
    'register',
    'watch',
    'shorts',
    'dynamic',
    'history',
    'message',
    'profile',
    'upload',
    'reports',
];

const input = Object.fromEntries(
    PAGES.map((name) => [name, fileURLToPath(new URL(`./${name}.html`, import.meta.url))])
);

/* ===== 开发代理 =====
 * 后端默认监听 8080，可用 VITE_BACKEND 覆盖（见 .env.development）。
 * 需要代理的前缀一共四类，缺一不可：
 *   /api           业务接口（视频、用户、动态、私信、AI）
 *   /captcha       验证码图片流 —— 注意它不带 /api 前缀
 *   /checkCaptcha  验证码校验   —— 同样不带 /api 前缀
 *   /videos        视频、封面、私信媒体的静态访问路径（后端映射到本地磁盘目录）
 *
 * 两个必须处理的特殊点：
 * 1. AI 接口返回 Flux<String> 流式数据，前端用 response.body.getReader() 逐块读取。
 *    http-proxy 默认会在空闲一段时间后掐断连接，因此把 timeout / proxyTimeout 都设为 0（不超时），
 *    否则「AI 总结评论区」这类长回复会在中途断流。
 * 2. 视频上传限制是 1024MB，代理层不能限制请求体大小，也不能提前超时。
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, fileURLToPath(new URL('./', import.meta.url)), '');
    const backend = env.VITE_BACKEND || 'http://localhost:8080';

    const apiProxy = {
        target: backend,
        changeOrigin: true,
        // 不限制空闲超时，保证 SSE / Flux 流式响应和超大文件上传不被中途掐断
        timeout: 0,
        proxyTimeout: 0,
    };

    return {
        plugins: [absolutePublicAssets()],

        // public/ 下的 css、js、图片、emoji 原样托管到站点根路径，
        // 与迁移前 Spring Boot static 目录的对外路径完全一致，源码无需改动
        publicDir: 'public',

        server: {
            host: '127.0.0.1',
            port: 5173,
            strictPort: false,
            proxy: {
                '/api': apiProxy,
                '/captcha': apiProxy,
                '/checkCaptcha': apiProxy,
                '/videos': apiProxy,
            },
        },

        preview: {
            host: '127.0.0.1',
            port: 4173,
            proxy: {
                '/api': apiProxy,
                '/captcha': apiProxy,
                '/checkCaptcha': apiProxy,
                '/videos': apiProxy,
            },
        },

        build: {
            outDir: 'dist',
            emptyOutDir: true,
            rollupOptions: { input },
        },
    };
});

import express from 'express';
import { spawn } from 'child_process';
import { readFile, access } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.CONSOLE_PORT || 8888;
const RUNTIME_ROOT = process.env.RUNTIME_ROOT || '/www/server/opinion-monitor';
const OPINIONCTL = join(RUNTIME_ROOT, 'scripts', 'opinionctl');

// 中间件
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// 仅允许 Nginx 本机反向代理和本机访问
const localOnlyMiddleware = (req, res, next) => {
  const remote = req.socket.remoteAddress || '';
  const isLocal = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (!isLocal) {
    return res.status(403).json({ error: 'Deployment console only accepts local proxy requests' });
  }
  next();
};

// 执行 opinionctl 命令
const execOpinionctl = (args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(OPINIONCTL, args, {
      env: { ...process.env, RUNTIME_ROOT },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`opinionctl exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
};

// API 路由

// 获取容器状态
app.get('/api/status', localOnlyMiddleware, async (req, res) => {
  try {
    const { stdout } = await execOpinionctl(['status']);
    const status = JSON.parse(stdout);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 健康检查
app.get('/api/health', localOnlyMiddleware, async (req, res) => {
  try {
    const { stdout } = await execOpinionctl(['health']);
    const health = JSON.parse(stdout);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 启动服务
app.post('/api/start', localOnlyMiddleware, async (req, res) => {
  try {
    await execOpinionctl(['start']);
    res.json({ success: true, message: '服务启动命令已执行' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 停止服务
app.post('/api/stop', localOnlyMiddleware, async (req, res) => {
  try {
    await execOpinionctl(['stop']);
    res.json({ success: true, message: '服务停止命令已执行' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 重启服务
app.post('/api/restart', localOnlyMiddleware, async (req, res) => {
  try {
    await execOpinionctl(['restart']);
    res.json({ success: true, message: '服务重启命令已执行' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 查看日志
app.get('/api/logs/:service?', localOnlyMiddleware, async (req, res) => {
  try {
    const service = req.params.service || '';
    const lines = req.query.lines || '100';
    const args = service ? ['logs', service, lines] : ['logs', '', lines];
    const { stdout } = await execOpinionctl(args);
    res.json({ logs: stdout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 构建并发布版本
app.post('/api/release', localOnlyMiddleware, async (req, res) => {
  try {
    const version = typeof req.body?.version === 'string' ? req.body.version : '';
    const { stdout, stderr } = await execOpinionctl(version ? ['release', version] : ['release']);
    res.json({ success: true, output: `${stdout}${stderr}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 首次初始化应用
app.post('/api/bootstrap', localOnlyMiddleware, async (req, res) => {
  try {
    const { stdout, stderr } = await execOpinionctl(['bootstrap']);
    res.json({ success: true, output: `${stdout}${stderr}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 备份数据库
app.post('/api/backup', localOnlyMiddleware, async (req, res) => {
  try {
    const backupId = typeof req.body?.backupId === 'string' ? req.body.backupId : '';
    const { stdout, stderr } = await execOpinionctl(backupId ? ['backup', backupId] : ['backup']);
    res.json({ success: true, output: `${stdout}${stderr}`, backupId: stdout.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 回滚应用
app.post('/api/rollback', localOnlyMiddleware, async (req, res) => {
  try {
    const version = req.body?.version;
    if (!version) {
      return res.status(400).json({ error: '缺少版本号' });
    }
    const { stdout, stderr } = await execOpinionctl(['rollback', version]);
    res.json({ success: true, output: `${stdout}${stderr}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 恢复数据库
app.post('/api/restore', localOnlyMiddleware, async (req, res) => {
  try {
    const backupId = req.body?.backupId;
    if (!backupId) {
      return res.status(400).json({ error: '缺少备份ID' });
    }
    const { stdout, stderr } = await execOpinionctl(['restore', backupId]);
    res.json({ success: true, output: `${stdout}${stderr}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取系统信息
app.get('/api/system-info', localOnlyMiddleware, async (req, res) => {
  try {
    const { execSync } = await import('child_process');

    const diskInfo = execSync('df -h | grep -E "/$"', { encoding: 'utf-8' });
    const memInfo = execSync('free -h | grep Mem', { encoding: 'utf-8' });

    res.json({
      disk: diskInfo.trim(),
      memory: memInfo.trim(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取可用备份列表
app.get('/api/backups', localOnlyMiddleware, async (req, res) => {
  try {
    const backupRoot = join(RUNTIME_ROOT, 'backups');
    const { readdir, readFile } = await import('fs/promises');
    const entries = await readdir(backupRoot, { withFileTypes: true });
    const backups = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = join(backupRoot, entry.name, 'metadata.json');
        try {
          const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
          backups.push({ id: entry.name, ...meta });
        } catch {
          backups.push({ id: entry.name, createdAt: 'unknown' });
        }
      }
    }

    backups.sort((a, b) => b.id.localeCompare(a.id));
    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: err.message, backups: [] });
  }
});

// 获取可用版本列表
app.get('/api/versions', localOnlyMiddleware, async (req, res) => {
  try {
    const siteRoot = process.env.SITE_ROOT || '/www/wwwroot/opinion-monitor';
    const releasesDir = join(siteRoot, 'releases');
    const { readdir, readFile } = await import('fs/promises');
    const entries = await readdir(releasesDir, { withFileTypes: true });
    const versions = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = join(releasesDir, entry.name, 'release.json');
        try {
          const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
          versions.push({ version: entry.name, ...meta });
        } catch {
          versions.push({ version: entry.name, createdAt: 'unknown' });
        }
      }
    }

    versions.sort((a, b) => b.version.localeCompare(a.version));
    res.json({ versions });
  } catch (err) {
    res.status(500).json({ error: err.message, versions: [] });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// 启动服务
app.listen(PORT, '127.0.0.1', () => {
  console.log(`部署控制台监听: http://127.0.0.1:${PORT}`);
  console.log(`运行时根目录: ${RUNTIME_ROOT}`);
  console.log(`opinionctl 路径: ${OPINIONCTL}`);
});

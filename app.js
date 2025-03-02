const express = require('express');
const multer = require('multer');
const fs = require('fs');
const app = express();
const upload = multer({ dest: 'uploads/' });

// 中间件设置
app.use(express.static('public'));
app.set('view engine', 'ejs');

// 首页路由
app.get('/', (req, res) => {
    res.render('index');
});

// 文件分析路由
app.post('/analyze', upload.single('jstackFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    const content = fs.readFileSync(req.file.path, 'utf8');
    const analysis = analyzeJstack(content);
    
    // 清理上传文件
    fs.unlinkSync(req.file.path);

    res.render('result', { analysis });
});

// 分析函数
function analyzeJstack(content) {
    const threads = [];
    const stateCount = { RUNNABLE: 0, BLOCKED: 0, WAITING: 0, TIMED_WAITING: 0 };
    const lockMap = new Map();
    let deadlocks = [];
    let currentThread = null;

    // 分割线程块
    const lines = content.split('\n');
    lines.forEach(line => {
        if (line.startsWith('"')) {
            if (currentThread) threads.push(currentThread);
            currentThread = {
                name: line.split('"')[1],
                state: '',
                stack: [],
                locked: null
            };
        } else if (line.includes('java.lang.Thread.State:')) {
            const state = line.split(': ')[1];
            currentThread.state = state.split(' ')[0];
            stateCount[currentThread.state]++;
        } else if (line.trim().startsWith('-')) {
            // 处理死锁信息
            if (line.includes('deadlock')) {
                deadlocks = lines.slice(lines.indexOf(line))
                    .join('\n')
                    .match(/Found (\d+) deadlock/);
            }
        } else if (line.trim()) {
            if (currentThread) {  // Add null check
                currentThread.stack.push(line.trim());
                // 检测锁信息
                const lockMatch = line.match(/waiting to lock <(0x[\da-f]+)>/);
                if (lockMatch) {
                    const lockId = lockMatch[1];
                    if (!lockMap.has(lockId)) lockMap.set(lockId, []);
                    lockMap.get(lockId).push(currentThread.name);
                }
            }  // End of null check
        }
    });

    // 分析潜在问题
    const potentialIssues = [];
    if (deadlocks && deadlocks[1] > 0) {
        potentialIssues.push(`发现 ${deadlocks[1]} 个死锁`);
    }

    lockMap.forEach((threads, lock) => {
        if (threads.length > 1) {
            potentialIssues.push(`锁 ${lock} 被 ${threads.length} 个线程等待: ${threads.join(', ')}`);
        }
    });

    return {
        totalThreads: threads.length,
        stateCount,
        potentialIssues,
        sampleThreads: threads.slice(0, 5) // 示例显示前5个线程
    };
}

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
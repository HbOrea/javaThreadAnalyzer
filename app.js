const express = require('express');
const multer = require('multer');
const fs = require('fs');
const app = express();
const upload = multer({ dest: 'uploads/' });
let analysisCache = null;

// 中间件设置
app.use(express.static('public'));
app.set('view engine', 'ejs');

// 首页路由
// 在路由处理中添加语言参数支持
app.get('/', (req, res) => {
    const lang = req.query.lang || 'en'; // 默认英文
    res.render('index', { lang });
});

// 文件分析路由
app.post('/analyze', upload.single('jstackFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    const content = fs.readFileSync(req.file.path, 'utf8');
    const analysis = analyzeJstack(content);
    analysisCache = analysis; // 缓存分析结果
    
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
    const threadGroups = {}; // 替换原来的 
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

    // 添加最后一个线程
    if (currentThread) {
        threads.push(currentThread);
    }

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

   // 按线程池名称分组统计
   threads.forEach(thread => {
        // 新正则匹配基础名称（如 "pool"）
        const groupMatch = thread.name.match(/^(.*?)(?:-\d+)+(?:-thread-\d+)?$/);
        if (groupMatch) {
            const baseName = groupMatch[1]; // 获取基础名称（如 "pool"）
            if (!threadGroups[baseName]) {
                threadGroups[baseName] = {
                    count: 0,
                    states: {},
                    instances: new Set() // 新增实例追踪
                };
            }
            threadGroups[baseName].count++;
            
            // 记录原始完整名称实例
            threadGroups[baseName].instances.add(thread.name);
            
            // 统计状态
            threadGroups[baseName].states[thread.state] = 
                (threadGroups[baseName].states[thread.state] || 0) + 1;
        }
    }); 

    return {
        totalThreads: threads.length,
        stateCount,
        potentialIssues,
        threadGroups,
        threads // 添加这行，将原始线程数据存入缓存 
    };
}

// 修改线程组详情路由
app.get('/thread-group/:instanceName', (req, res) => {
    const instanceName = decodeURIComponent(req.params.instanceName);
    if (!analysisCache || !analysisCache.threads) {
        return res.status(404).send('分析数据不可用');
    }
    
    // 查找完全匹配实例名的线程
    const groupThreads = analysisCache.threads.filter(t => 
        t.name === instanceName
    );
    
    res.render('group-details', {
        instanceName,
        threads: groupThreads,
        groupName: instanceName
    });
});

// 新增获取线程组详情的函数
function getGroupThreads(groupName) {
    // 这里需要实现从分析结果中获取指定线程组的逻辑
    // 示例返回结构：
    return [{
        name: 'pool-1-thread-1',
        state: 'RUNNABLE',
        stack: [
            'java.lang.Thread.sleep(Native Method)',
            'com.example.MyClass.run(MyClass.java:123)'
        ]
    }];
}

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
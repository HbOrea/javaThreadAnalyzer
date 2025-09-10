const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');

// 博客列表页面
router.get('/', (req, res) => {
    res.render('blog');
});

// 博客文章详情页面
router.get('/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const filePath = path.join(__dirname, '../blog', `${slug}.md`);
        
        // 读取Markdown文件
        const content = await fs.readFile(filePath, 'utf8');

        // 简单提取 description：取首段非空文字，去掉 Markdown 语法并截断到 160 字符
        const plainText = content
            .replace(/```[\s\S]*?```/g, ' ') // 去代码块
            .replace(/`[^`]*`/g, ' ') // 去行内 code
            .replace(/\!\[[^\]]*\]\([^)]*\)/g, ' ') // 去图片
            .replace(/\[[^\]]*\]\([^)]*\)/g, '$1') // 链接文本
            .replace(/^#{1,6}\s*/gm, '') // 标题井号
            .replace(/\*\*|__/g, '') // 粗体
            .replace(/\*|_/g, '') // 斜体
            .replace(/>\s?/g, '') // 引用
            .replace(/\r/g, ' ');

        const firstParagraph = plainText
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0)[0] || 'Java线程分析相关技术文章';
        const description = firstParagraph.length > 160 ? (firstParagraph.slice(0, 157) + '...') : firstParagraph;

        // 将Markdown转换为HTML
        const htmlContent = marked.parse(content);

        // 根据slug确定标题（兜底策略）
        let title;
        if (slug === 'Thread-Dump-Introduction') {
            title = 'Introduction to Thread Dump';
        } else if (slug === 'Thread-Dump-Analysis') {
            title = 'Thread Dump Analysis';
        } else {
            // 从 Markdown 第一行标题兜底提取
            const headingMatch = content.match(/^#{1,6}\s+(.+)$/m);
            title = headingMatch ? headingMatch[1].trim() : slug.replace(/-/g, ' ');
        }

        res.render('blog_post', {
            title: title,
            content: htmlContent,
            slug: slug,
            description: description
        });
    } catch (error) {
        console.error('Error reading blog post:', error);
        res.status(404).send('Blog post not found');
    }
});

module.exports = router;
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
        
        // 将Markdown转换为HTML
        const htmlContent = marked.parse(content);
        
        // 根据slug确定标题
        let title;
        if (slug === 'Thread-Dump-Introduction') {
            title = 'Introduction to Thread Dump';
        } else if (slug === 'threaddumpIntroduction') {
            title = 'Thread Dump介绍';
        }
        
        res.render('blog_post', {
            title: title,
            content: htmlContent
        });
    } catch (error) {
        console.error('Error reading blog post:', error);
        res.status(404).send('Blog post not found');
    }
});

module.exports = router; 
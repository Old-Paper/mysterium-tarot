# Mysterium · 古典马赛塔罗 Demo

一个无需安装依赖、可直接运行的多牌阵塔罗网页原型。

在线体验：[https://old-paper.github.io/mysterium-tarot/](https://old-paper.github.io/mysterium-tarot/)

## 运行

最简单的方法是直接双击 `index.html`。也可以在此目录启动本地静态服务器：

```powershell
python -m http.server 4173
```

然后访问 `http://localhost:4173`。

## 更新网站

本站由 GitHub Pages 从 `main` 分支根目录自动发布。修改完成后，在本目录执行：

```powershell
git add .
git commit -m "描述这次修改"
git push
```

推送完成后，GitHub 会自动重新部署网站。通常稍等片刻即可在上面的在线地址看到更新。

## 当前范围

- 完整 78 张历史马赛体系牌组：22 张 Jean Dodal 主牌与 56 张 BnF 馆藏 Conver 系小牌
- 小牌保留钱币、圣杯、宝剑、权杖四组各 14 张的传统点数牌结构
- 单张、三张、五张十字、七张马蹄、二选一、凯尔特十字、十二宫与四十二张综合牌阵
- 十二宫可选第 13 张主题牌
- 可实际抽取的 42 张 Waite 全景法：六叠七张、重叠为七叠六张、分组重洗并排成六行七张
- 默认默念问题模式，以及可切换的文字输入模式
- 浏览器加密随机数 + Fisher–Yates 洗牌 + 随机切牌
- 可选正逆位
- 按所选牌阵动态生成牌位、逐张翻牌、位置释读与综合线索
- 复制释读，以及包含问题、牌阵、全部牌位与解读边界的 AI 提示词
- 响应式与键盘可访问界面

## 史料边界

- 早期塔罗是 15 世纪欧洲的纸牌游戏，并非有证据支持的古埃及秘典。
- 1783–1784 年 Etteilla 的著作属于可核查的早期塔罗占卜系统文献。
- 除明确列出文献来源的牌法外，现代牌阵没有唯一标准版本；本站在抽牌前固定并展示每个牌位的定义。
- 凯尔特十字十个主体位置与 42 张全景法参考 A. E. Waite 1911 年公开文本；原凯尔特法另有人物牌。
- 42 张法使用完整 78 张牌与 42 张不重复牌；本站实现六行七张核心步骤，但不自动执行原文按性别指定人物牌的做法。
- 牌义是基于图像与当代反思用途的中文整理，不冒充 Etteilla 原文直译。

## 牌面与资料来源

- [OpenGameArt · Jean Dodal Major Arcana](https://opengameart.org/content/tarot-cards-major-arcana) — CC0，约 1701 年的马赛体系图像整理
- [BnF / Gallica · 完整历史马赛牌组](https://gallica.bnf.fr/ark:/12148/btv1b10539497f) — 本站 56 张小牌的扫描来源
- [法国国家图书馆 · Jean Dodal, Lyon, 1701](https://catalogue.bnf.fr/ark:/12148/cb391713667)
- [The Metropolitan Museum of Art · Before Fortune-Telling](https://www.metmuseum.org/perspectives/tarot-2)
- [Bibliothèque nationale de France · Etteilla, 1783–1784](https://catalogue.bnf.fr/ark:/12148/cb44214742d)
- [A. E. Waite · The Pictorial Key to the Tarot, Part III](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3)
- [Astrological System for Reading Tarot · Twelve Houses](https://www.daneel.franken.de/tarot/ATA/courses/astrological/ast.pdf)

## 下一阶段建议

1. 新增 Etteilla 历史模式，与现代马赛阅读模式分开呈现。
2. 增加抽牌记录、本地日记与多套牌面。
3. 增加完整牌库浏览、搜索与学习模式。

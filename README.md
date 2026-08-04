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

- 22 张 Jean Dodal 马赛体系大阿卡那
- 单张、三张、五张十字、七张马蹄、二选一、凯尔特十字与十二宫牌阵
- 十二宫可选第 13 张主题牌
- 42 张 Waite 全景法的使用说明；因当前牌库仅 22 张，暂不开放抽取
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
- 42 张法必须使用完整 78 张牌，不以 22 张大阿卡那重复抽取来伪造。
- 牌义是基于图像与当代反思用途的中文整理，不冒充 Etteilla 原文直译。

## 牌面与资料来源

- [OpenGameArt · Jean Dodal Major Arcana](https://opengameart.org/content/tarot-cards-major-arcana) — CC0，约 1701 年的马赛体系图像整理
- [法国国家图书馆 · Jean Dodal, Lyon, 1701](https://catalogue.bnf.fr/ark:/12148/cb391713667)
- [The Metropolitan Museum of Art · Before Fortune-Telling](https://www.metmuseum.org/perspectives/tarot-2)
- [Bibliothèque nationale de France · Etteilla, 1783–1784](https://catalogue.bnf.fr/ark:/12148/cb44214742d)
- [A. E. Waite · The Pictorial Key to the Tarot, Part III](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3)
- [Astrological System for Reading Tarot · Twelve Houses](https://www.daneel.franken.de/tarot/ATA/courses/astrological/ast.pdf)

## 下一阶段建议

1. 扩展为完整 78 张马赛牌，并为数字牌加入基于数与花色结构的解释。
2. 新增 Etteilla 历史模式，与现代马赛阅读模式分开呈现。
3. 增加抽牌记录、本地日记与多套牌面。
